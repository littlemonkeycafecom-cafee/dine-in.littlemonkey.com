import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const outDir = path.resolve('public/images/cold-brew');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Robust PNG Decoder (Supports ColorType 2 RGB and ColorType 6 RGBA)
// ---------------------------------------------------------------------------
function decodePng(buf) {
  let pos = 8;
  const idatChunks = [];
  let width = 0, height = 0, bitDepth = 0, colorType = 0;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      bitDepth = buf.readUInt8(pos + 16);
      colorType = buf.readUInt8(pos + 17);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const scanlineLength = 1 + width * bpp;
  const rawPixels = Buffer.alloc(width * height * bpp);
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
    currScanline.copy(rawPixels, y * width * bpp);
    prevScanline = currScanline;
  }

  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 6) {
      pixels[i * 4] = rawPixels[i * 4];
      pixels[i * 4 + 1] = rawPixels[i * 4 + 1];
      pixels[i * 4 + 2] = rawPixels[i * 4 + 2];
      pixels[i * 4 + 3] = rawPixels[i * 4 + 3];
    } else {
      pixels[i * 4] = rawPixels[i * 3];
      pixels[i * 4 + 1] = rawPixels[i * 3 + 1];
      pixels[i * 4 + 2] = rawPixels[i * 3 + 2];
      pixels[i * 4 + 3] = 255;
    }
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

function cropRgba(srcPixels, srcW, srcH, x0, y0, cropW, cropH) {
  const out = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= srcH) continue;
    const srcOffset = (sy * srcW + x0) * 4;
    const dstOffset = y * cropW * 4;
    srcPixels.copy(out, dstOffset, srcOffset, srcOffset + cropW * 4);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Process Cold Brew Campaign Menu Assets
// ---------------------------------------------------------------------------
const bannerPath = path.join(outDir, 'cold-brew-campaign-menu.png');
console.log('Loading campaign banner from:', bannerPath);
const banner = decodePng(fs.readFileSync(bannerPath));
console.log(`Loaded banner: ${banner.width}x${banner.height}`);

// 1. Espresso Orange (Left drink with orange slice on wooden coaster)
// Dimensions: 310 x 330, y0=595, cleanly frames drink and coaster
const eoCrop = cropRgba(banner.pixels, banner.width, banner.height, 65, 595, 310, 330);
const eoPng = encodePng(310, 330, eoCrop);
fs.writeFileSync(path.join(outDir, 'espresso-orange.png'), eoPng);
console.log('✓ Generated espresso-orange.png (310x330)');

// 2. Tiger Bomb (Center drink with marbled espresso and silky cream layers)
// Dimensions: 280 x 360
const tbCrop = cropRgba(banner.pixels, banner.width, banner.height, 405, 565, 280, 360);
const tbPng = encodePng(280, 360, tbCrop);
fs.writeFileSync(path.join(outDir, 'tiger-bomb.png'), tbPng);
console.log('✓ Generated tiger-bomb.png (280x360)');

// 3. Passion Fruit Cold Brew (Right drink with passion fruit seeds, tonic & mint)
// Dimensions: 310 x 380
const pfCrop = cropRgba(banner.pixels, banner.width, banner.height, 680, 545, 310, 380);
const pfPng = encodePng(310, 380, pfCrop);
fs.writeFileSync(path.join(outDir, 'passion-fruit-cold-brew.png'), pfPng);
console.log('✓ Generated passion-fruit-cold-brew.png (310x380)');

// 4. Hero Panoramic Wide Crop (Header branding + Craft Meets Cold + 3 drinks)
// From y=0 to y=940 (1055 x 940)
const heroWideCrop = cropRgba(banner.pixels, banner.width, banner.height, 0, 0, banner.width, 940);
const heroWidePng = encodePng(banner.width, 940, heroWideCrop);
fs.writeFileSync(path.join(outDir, 'cold-brew-hero-wide.png'), heroWidePng);
console.log('✓ Generated cold-brew-hero-wide.png (1055x940)');

console.log('All cold brew images generated successfully!');
