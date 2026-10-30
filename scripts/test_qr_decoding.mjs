import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const jsQR = require('jsqr');
import { generateQRCode } from '../src/lib/qrCode.ts';

const BASE_URL = 'http://127.0.0.1:3000';

async function testDecoding() {
  console.log('--- Testing Decoding of All 6 Physical Table QR Codes ---');
  
  // 1. Fetch tables overview from server
  const res = await fetch(`${BASE_URL}/api/admin/qr/tables`, {
    headers: { 'X-Operational-PIN': '9999' }
  });
  assert.strictEqual(res.status, 200);
  const { tables } = await res.json();
  assert.strictEqual(tables.length, 6);

  for (const table of tables) {
    // Generate/rotate a fresh credential to get raw secret
    const rotRes = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Operational-PIN': '9999' },
      body: JSON.stringify({ tableNumber: table.tableNumber })
    });
    assert.strictEqual(rotRes.status, 200);
    const rotData = await rotRes.json();
    const entryUrl = rotData.entryUrl;

    console.log(`\nTesting ${table.tableNumber} (${table.shortCode}):`);
    console.log(`Entry URL: ${entryUrl}`);

    // Generate QR matrix
    const { matrix, size } = generateQRCode(entryUrl);
    const quietZone = 4;
    const totalSize = size + quietZone * 2;
    const scale = 8; // 8x8 pixels per module for realistic camera-scan resolution
    const pixelWidth = totalSize * scale;
    const pixelHeight = totalSize * scale;

    // Convert matrix to RGBA pixel buffer
    const rgba = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);

    for (let py = 0; py < pixelHeight; py++) {
      for (let px = 0; px < pixelWidth; px++) {
        const mx = Math.floor(px / scale) - quietZone;
        const my = Math.floor(py / scale) - quietZone;
        const isDark = mx >= 0 && mx < size && my >= 0 && my < size && matrix[my][mx] === 1;

        const idx = (py * pixelWidth + px) * 4;
        const val = isDark ? 0 : 255;
        rgba[idx] = val;     // R
        rgba[idx + 1] = val; // G
        rgba[idx + 2] = val; // B
        rgba[idx + 3] = 255; // A
      }
    }

    // Decode with jsQR
    const code = jsQR(rgba, pixelWidth, pixelHeight);
    assert(code, `Failed to decode QR code for ${table.tableNumber}`);
    assert.strictEqual(code.data, entryUrl, `Decoded payload mismatch for ${table.tableNumber}`);

    console.log(`[PASS] Decoded successfully: "${code.data}"`);

    // Verify server accepts this decoded payload
    const parsed = new URL(code.data);
    const tParam = parsed.searchParams.get('t');
    const credParam = parsed.searchParams.get('cred');

    const verifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tParam, cred: credParam })
    });
    assert.strictEqual(verifyRes.status, 200, 'Server must accept scanned QR payload');
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.tableNumber, table.tableNumber);
    console.log(`[PASS] Server validated decoded payload -> Confirmed table: ${verifyData.tableNumber}`);
  }

  console.log('\n=============================================================');
  console.log('ALL 6 TABLE QR CODES GENERATED, DECODED, AND SERVER-VERIFIED');
  console.log('=============================================================');
}

testDecoding().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
