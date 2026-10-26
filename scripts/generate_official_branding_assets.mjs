import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const inputPath = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/.user_uploaded/media_1793038508675_44f096e7.png';
const brandingDir = path.resolve('public/branding');
const publicDir = path.resolve('public');

if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. PNG Decoder
// ---------------------------------------------------------------------------
function decodePng(buf) {
  let pos = 8;
  const idatChunks = [];
  let width = 0, height = 0;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const scanlineLength = 1 + width * bpp;
  const pixels = Buffer.alloc(width * height * 4);
  let prevScanline = Buffer.alloc(width * bpp);

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    const filter = decompressed[offset];
    const currScanline = Buffer.alloc(width * bpp);

    for (let x = 0; x < width * bpp; x++) {
      const raw = decompressed[offset + 1 + x];
      const a = x >= bpp ? currScanline[x - bpp] : 0;
      const b = prevScanline[x];
      const c = x >= bpp ? prevScanline[x - bpp] : 0;

      let val = 0;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + a) & 0xff;
      else if (filter === 2) val = (raw + b) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
        val = (raw + pr) & 0xff;
      }
      currScanline[x] = val;
    }
    currScanline.copy(pixels, y * width * bpp);
    prevScanline = currScanline;
  }
  return { width, height, pixels };
}

// ---------------------------------------------------------------------------
// 2. PNG Encoder
// ---------------------------------------------------------------------------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);

  const chunk = Buffer.alloc(4 + body.length + 4);
  chunk.writeUInt32BE(len, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc, 4 + body.length);
  return chunk;
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrData);

  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0;
    rgbaBuffer.copy(rawData, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ---------------------------------------------------------------------------
// 3. Bilinear Resampler
// ---------------------------------------------------------------------------
function resizeRgba(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const yLerp = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const xLerp = sx - x0;

      const idx00 = (y0 * srcW + x0) * 4;
      const idx10 = (y0 * srcW + x1) * 4;
      const idx01 = (y1 * srcW + x0) * 4;
      const idx11 = (y1 * srcW + x1) * 4;

      const dstIdx = (dy * dstW + dx) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src[idx00 + c] * (1 - xLerp) + src[idx10 + c] * xLerp;
        const bottom = src[idx01 + c] * (1 - xLerp) + src[idx11 + c] * xLerp;
        dst[dstIdx + c] = Math.round(top * (1 - yLerp) + bottom * yLerp);
      }
    }
  }
  return dst;
}

// ---------------------------------------------------------------------------
// 4. Main Processing
// ---------------------------------------------------------------------------
console.log('Reading official uploaded logo from:', inputPath);
const originalFileBuf = fs.readFileSync(inputPath);

// Save exact raw uploaded file
fs.writeFileSync(path.join(brandingDir, 'little-monkey-official-logo.png'), originalFileBuf);
fs.writeFileSync(path.join(brandingDir, 'little-monkey-logo.png'), originalFileBuf);
console.log('✓ Preserved raw official logo in public/branding/little-monkey-official-logo.png');

const decoded = decodePng(originalFileBuf);
const { width, height, pixels } = decoded;

// Flood fill from outer edges to identify outer black space
const isOuterBlack = new Uint8Array(width * height);
const queue = [];

function checkAndQueue(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const pos = y * width + x;
  if (isOuterBlack[pos]) return;
  const idx = pos * 4;
  const r = pixels[idx];
  const g = pixels[idx + 1];
  const b = pixels[idx + 2];
  // Outer black threshold: luminance under 22
  if (r < 22 && g < 22 && b < 22) {
    isOuterBlack[pos] = 1;
    queue.push(pos);
  }
}

for (let x = 0; x < width; x++) {
  checkAndQueue(x, 0);
  checkAndQueue(x, height - 1);
}
for (let y = 0; y < height; y++) {
  checkAndQueue(0, y);
  checkAndQueue(width - 1, y);
}

let head = 0;
while (head < queue.length) {
  const pos = queue[head++];
  const x = pos % width;
  const y = Math.floor(pos / width);
  checkAndQueue(x + 1, y);
  checkAndQueue(x - 1, y);
  checkAndQueue(x, y + 1);
  checkAndQueue(x, y - 1);
}

console.log(`Isolated ${queue.length} outer background pixels for transparency`);

// Find artwork bounding box
let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const pos = y * width + x;
    if (!isOuterBlack[pos]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log('Artwork bounds:', { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });

// Create transparent version with smooth alpha anti-aliasing on outer border
const pad = 12;
const cropX0 = Math.max(0, minX - pad);
const cropY0 = Math.max(0, minY - pad);
const cropX1 = Math.min(width - 1, maxX + pad);
const cropY1 = Math.min(height - 1, maxY + pad);

const cropW = cropX1 - cropX0 + 1;
const cropH = cropY1 - cropY0 + 1;
const transparentPixels = Buffer.alloc(cropW * cropH * 4);

for (let cy = 0; cy < cropH; cy++) {
  const srcY = cropY0 + cy;
  for (let cx = 0; cx < cropW; cx++) {
    const srcX = cropX0 + cx;
    const srcPos = srcY * width + srcX;
    const srcIdx = srcPos * 4;
    const dstIdx = (cy * cropW + cx) * 4;

    const r = pixels[srcIdx];
    const g = pixels[srcIdx + 1];
    const b = pixels[srcIdx + 2];

    if (isOuterBlack[srcPos]) {
      // Check distance to artwork edge for smooth 1px anti-aliasing
      let maxNearLuma = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = srcX + dx;
          const ny = srcY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nPos = ny * width + nx;
            if (!isOuterBlack[nPos]) {
              const nIdx = nPos * 4;
              const nLuma = (pixels[nIdx] + pixels[nIdx + 1] + pixels[nIdx + 2]) / 3;
              if (nLuma > maxNearLuma) maxNearLuma = nLuma;
            }
          }
        }
      }

      if (maxNearLuma > 30) {
        // Soft fringe transition
        transparentPixels[dstIdx] = r;
        transparentPixels[dstIdx + 1] = g;
        transparentPixels[dstIdx + 2] = b;
        transparentPixels[dstIdx + 3] = Math.min(255, Math.round(maxNearLuma * 0.4));
      } else {
        transparentPixels[dstIdx] = 0;
        transparentPixels[dstIdx + 1] = 0;
        transparentPixels[dstIdx + 2] = 0;
        transparentPixels[dstIdx + 3] = 0;
      }
    } else {
      transparentPixels[dstIdx] = r;
      transparentPixels[dstIdx + 1] = g;
      transparentPixels[dstIdx + 2] = b;
      transparentPixels[dstIdx + 3] = 255;
    }
  }
}

const transparentPng = encodePng(cropW, cropH, transparentPixels);
fs.writeFileSync(path.join(brandingDir, 'little-monkey-logo-transparent.png'), transparentPng);
console.log(`✓ Generated little-monkey-logo-transparent.png (${cropW}x${cropH}, ${transparentPng.length} bytes)`);

// Generate nav variant (436 x 190)
const navW = 436;
const navH = Math.round((cropH / cropW) * navW);
const navPixels = resizeRgba(transparentPixels, cropW, cropH, navW, navH);
const navPng = encodePng(navW, navH, navPixels);
fs.writeFileSync(path.join(brandingDir, 'little-monkey-logo-nav.png'), navPng);
console.log(`✓ Generated little-monkey-logo-nav.png (${navW}x${navH}, ${navPng.length} bytes)`);

// ---------------------------------------------------------------------------
// 5. Square App & Browser Icons (Favicon, Apple Touch Icon, Android, PWA)
// ---------------------------------------------------------------------------
function generateSquareIcon(size, emblemPaddingRatio = 0.12) {
  const icon = Buffer.alloc(size * size * 4);
  // Fill with #050505 background
  for (let i = 0; i < size * size; i++) {
    icon[i * 4] = 0x05;     // R
    icon[i * 4 + 1] = 0x05; // G
    icon[i * 4 + 2] = 0x05; // B
    icon[i * 4 + 3] = 0xFF; // A
  }

  // Calculate target emblem width and height preserving aspect ratio
  const maxEmblemW = Math.round(size * (1 - emblemPaddingRatio * 2));
  const maxEmblemH = Math.round(size * (1 - emblemPaddingRatio * 2));

  let emblemW = maxEmblemW;
  let emblemH = Math.round((cropH / cropW) * emblemW);
  if (emblemH > maxEmblemH) {
    emblemH = maxEmblemH;
    emblemW = Math.round((cropW / cropH) * emblemH);
  }

  const resizedEmblem = resizeRgba(transparentPixels, cropW, cropH, emblemW, emblemH);
  const offsetX = Math.round((size - emblemW) / 2);
  const offsetY = Math.round((size - emblemH) / 2);

  for (let y = 0; y < emblemH; y++) {
    for (let x = 0; x < emblemW; x++) {
      const srcIdx = (y * emblemW + x) * 4;
      const alpha = resizedEmblem[srcIdx + 3] / 255;
      if (alpha > 0) {
        const dstIdx = ((offsetY + y) * size + (offsetX + x)) * 4;
        icon[dstIdx] = Math.round(icon[dstIdx] * (1 - alpha) + resizedEmblem[srcIdx] * alpha);
        icon[dstIdx + 1] = Math.round(icon[dstIdx + 1] * (1 - alpha) + resizedEmblem[srcIdx + 1] * alpha);
        icon[dstIdx + 2] = Math.round(icon[dstIdx + 2] * (1 - alpha) + resizedEmblem[srcIdx + 2] * alpha);
      }
    }
  }

  return encodePng(size, size, icon);
}

// 512x512 PWA Icon
const icon512 = generateSquareIcon(512, 0.10);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);

// 192x192 Android / PWA Icon
const icon192 = generateSquareIcon(192, 0.10);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);

// 180x180 Apple Touch Icon
const appleTouchIcon = generateSquareIcon(180, 0.10);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon);

// 32x32 Favicon PNG
const favicon32 = generateSquareIcon(32, 0.08);
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon32);

// 16x16 Favicon PNG
const favicon16 = generateSquareIcon(16, 0.05);
fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), favicon16);

// Create standard multi-image ICO file with 16x16 and 32x32 icons
function createIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let dataOffset = 6 + count * 16;

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.width >= 256 ? 0 : img.width;
    entry[1] = img.height >= 256 ? 0 : img.height;
    entry[2] = 0; // color palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    dataOffset += img.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map((img) => img.data)]);
}

const faviconIco = createIco([
  { width: 16, height: 16, data: favicon16 },
  { width: 32, height: 32, data: favicon32 },
]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconIco);
console.log('✓ Generated favicon.ico, favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png, icon-192.png, icon-512.png');

// ---------------------------------------------------------------------------
// 6. Web App Manifest
// ---------------------------------------------------------------------------
const manifest = {
  name: 'Little Monkey Café',
  short_name: 'Little Monkey',
  description: 'Little Monkey Café — In-Café Dining & Artisanal Handcrafted Flavors',
  start_url: '/',
  display: 'standalone',
  background_color: '#050505',
  theme_color: '#FFC21A',
  icons: [
    {
      src: '/favicon-32x32.png',
      sizes: '32x32',
      type: 'image/png'
    },
    {
      src: '/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png'
    },
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('✓ Generated manifest.json');
console.log('ALL BRANDING ASSETS GENERATED SUCCESSFULLY!');
