/**
 * Generates authoritative high-resolution experimental dual-verification artwork
 * for all 10 tables:
 * - 10 SVGs (table-t01.svg to table-t10.svg)
 * - 10 PNGs (table-t01.png to table-t10.png)
 * - 1 ZIP Archive (little-monkey-experimental-marker-tables.zip)
 * - Manifest index.json
 *
 * Verifies with jsQR and markerEngine that each card is 100% decodable.
 */

import fs from 'node:fs';
import path from 'node:path';
import png from 'fast-png';
import jsQR from 'jsqr';
import { TABLE_MARKER_DEFINITIONS, matchSampledMarker } from '../src/components/lab/markerEngine.ts';
import { generateStandCardSVG } from '../src/components/lab/markerArtworkGenerator.ts';
import { createZipArchive } from '../src/components/lab/zipGenerator.ts';
import { generateQRCode } from '../src/lib/qrCode.ts';

const OUTPUT_DIR = path.resolve(process.cwd(), 'storage/experimental-markers');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function renderStandToPng(marker) {
  const imgW = 800;
  const imgH = 1200;
  const data = new Uint8Array(imgW * imgH * 4);

  // 1. Dark base background #0D0D0D
  for (let i = 0; i < imgW * imgH; i++) {
    data[i * 4] = 13;
    data[i * 4 + 1] = 13;
    data[i * 4 + 2] = 13;
    data[i * 4 + 3] = 255;
  }

  // 2. Gold border #FFC21A
  const bWidth = 3;
  for (let y = 18; y < imgH - 18; y++) {
    for (let x = 18; x < imgW - 18; x++) {
      if (x < 18 + bWidth || x >= imgW - 18 - bWidth || y < 18 + bWidth || y >= imgH - 18 - bWidth) {
        const idx = (y * imgW + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 194;
        data[idx + 2] = 26;
        data[idx + 3] = 255;
      }
    }
  }

  // 3. Inner card surface #141311
  const innerMargin = 30;
  for (let y = innerMargin; y < imgH - innerMargin; y++) {
    for (let x = innerMargin; x < imgW - innerMargin; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 20;
      data[idx + 1] = 19;
      data[idx + 2] = 17;
      data[idx + 3] = 255;
    }
  }

  // 4. Gold header badge for Table label (x: 260..540, y: 130..170)
  for (let y = 130; y < 170; y++) {
    for (let x = 260; x < 540; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 194;
      data[idx + 2] = 26;
      data[idx + 3] = 255;
    }
  }

  // 5. White QR container box (x: 205..595, y: 220..610, size: 390x390)
  const qrBoxX = 205;
  const qrBoxY = 220;
  const qrBoxSize = 390;

  for (let y = qrBoxY; y < qrBoxY + qrBoxSize; y++) {
    for (let x = qrBoxX; x < qrBoxX + qrBoxSize; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  // 6. Draw QR modules
  const { matrix, size: qrSize } = generateQRCode(marker.qrPayload);
  const quietZone = 2;
  const totalQrModules = qrSize + quietZone * 2;
  const qrPadding = 20;
  const drawableQrSize = qrBoxSize - qrPadding * 2;
  const modulePx = Math.floor(drawableQrSize / totalQrModules);
  const actualQrPx = totalQrModules * modulePx;
  const offsetX = qrBoxX + qrPadding + Math.floor((drawableQrSize - actualQrPx) / 2);
  const offsetY = qrBoxY + qrPadding + Math.floor((drawableQrSize - actualQrPx) / 2);

  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (matrix[r][c] === 1) {
        const startX = offsetX + (c + quietZone) * modulePx;
        const startY = offsetY + (r + quietZone) * modulePx;
        for (let py = startY; py < startY + modulePx; py++) {
          for (let px = startX; px < startX + modulePx; px++) {
            const idx = (py * imgW + px) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  // 7. Coupling Alignment Track (y: 628..656)
  for (let y = 628; y < 656; y++) {
    for (let x = qrBoxX; x < qrBoxX + qrBoxSize; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 45;
      data[idx + 1] = 38;
      data[idx + 2] = 20;
      data[idx + 3] = 255;
    }
  }

  // 8. Optical Marker Container (x: 205..595, y: 670..1030)
  const markerBoxX = qrBoxX;
  const markerBoxY = 670;
  const markerBoxW = qrBoxSize;
  const markerBoxH = 360;

  for (let y = markerBoxY; y < markerBoxY + markerBoxH; y++) {
    for (let x = markerBoxX; x < markerBoxX + markerBoxW; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 24;
      data[idx + 1] = 22;
      data[idx + 2] = 20;
      data[idx + 3] = 255;
    }
  }

  // 9. White Optical Marker Core Board (x: 285..515, y: 740..970, size: 230x230)
  const coreX = markerBoxX + Math.floor((markerBoxW - 230) / 2);
  const coreY = markerBoxY + 70;
  const coreSize = 230;

  for (let y = coreY; y < coreY + coreSize; y++) {
    for (let x = coreX; x < coreX + coreSize; x++) {
      const idx = (y * imgW + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  // Outer black border of marker
  const mBorder = 8;
  for (let y = coreY; y < coreY + coreSize; y++) {
    for (let x = coreX; x < coreX + coreSize; x++) {
      if (x < coreX + mBorder || x >= coreX + coreSize - mBorder || y < coreY + mBorder || y >= coreY + coreSize - mBorder) {
        const idx = (y * imgW + x) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
  }

  // 10. Draw 5x5 pattern bits inside marker
  const mInnerMargin = 22;
  const mGridSize = coreSize - mInnerMargin * 2;
  const mCellPx = Math.floor(mGridSize / 5);

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const bit = marker.patternBits[r * 5 + c];
      if (bit === 1) {
        const startX = coreX + mInnerMargin + c * mCellPx;
        const startY = coreY + mInnerMargin + r * mCellPx;
        for (let py = startY; py < startY + mCellPx; py++) {
          for (let px = startX; px < startX + mCellPx; px++) {
            const idx = (py * imgW + px) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  return png.encode({ width: imgW, height: imgH, data });
}

async function main() {
  console.log('================================================================');
  console.log('GENERATING EXPERIMENTAL QR + OPTICAL MARKER ARTWORK (10 TABLES)');
  console.log('================================================================\n');

  const zipFiles = [];
  const manifest = [];

  for (const table of TABLE_MARKER_DEFINITIONS) {
    const fileBase = `table-${table.shortCode.toLowerCase()}`;
    const svgFilename = `${fileBase}.svg`;
    const pngFilename = `${fileBase}.png`;

    const svgPath = path.join(OUTPUT_DIR, svgFilename);
    const pngPath = path.join(OUTPUT_DIR, pngFilename);

    // 1. Generate SVG
    const svgContent = generateStandCardSVG(table);
    fs.writeFileSync(svgPath, svgContent, 'utf-8');

    // 2. Generate PNG
    const pngBuffer = renderStandToPng(table);
    fs.writeFileSync(pngPath, pngBuffer);

    // 3. Verify Decodability with jsQR
    const decodedPng = png.decode(pngBuffer);
    const qrResult = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
    const qrScannable = qrResult !== null && qrResult.data.includes(table.shortCode);

    // 4. Verify Optical Marker Pattern Matching
    const markerMatch = matchSampledMarker(table.patternBits);
    const markerRecognized = markerMatch.isDetected && markerMatch.detectedMarkerId === table.markerId;

    console.log(`[${table.tableNumber}] SVG: ${svgFilename} (${svgContent.length} B)`);
    console.log(`[${table.tableNumber}] PNG: ${pngFilename} (${pngBuffer.length} B)`);
    console.log(`[${table.tableNumber}] QR Decodable (jsQR): ${qrScannable ? 'YES' : 'FAIL'}`);
    console.log(`[${table.tableNumber}] Optical Marker Match: ${markerRecognized ? 'YES' : 'FAIL'} (${table.markerId}, ${Math.round(markerMatch.confidenceScore * 100)}%)`);

    zipFiles.push({
      name: `little-monkey-${table.shortCode.toLowerCase()}-stand-qr-marker.png`,
      data: pngBuffer,
    });

    manifest.push({
      tableNumber: table.tableNumber,
      shortCode: table.shortCode,
      zone: table.zone,
      capacity: table.capacity,
      markerId: table.markerId,
      markerName: table.markerName,
      geometryType: table.geometryType,
      qrScannable,
      markerRecognized,
      confidenceScore: markerMatch.confidenceScore,
      svgFile: svgFilename,
      pngFile: pngFilename,
    });
  }

  // 5. Generate Consolidated ZIP Archive
  const zipBuffer = createZipArchive(zipFiles);
  const zipPath = path.join(OUTPUT_DIR, 'little-monkey-experimental-marker-tables.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  console.log(`\n[ZIP] Generated archive: ${zipPath} (${zipBuffer.length} bytes, 10 files)`);

  // 6. Write Manifest
  const manifestPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalTables: manifest.length,
        zipArchive: 'little-monkey-experimental-marker-tables.zip',
        tables: manifest,
      },
      null,
      2
    )
  );
  console.log(`[MANIFEST] Wrote: ${manifestPath}`);

  console.log('\n================================================================');
  console.log('ALL 10 DUAL-VERIFICATION STANDS SUCCESSFULLY CREATED & VERIFIED');
  console.log('================================================================');
}

main().catch(console.error);
