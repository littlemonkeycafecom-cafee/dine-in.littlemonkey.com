import fs from 'node:fs';
import path from 'node:path';
import png from 'fast-png';
import jsQR from 'jsqr';

const directories = [
  'public/table-qr',
  'public/table-stands',
  'public/marker-stands',
];

console.log('=== AUDITING ALL GENERATED QR ARTWORK ON DISK ===\n');

for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    continue;
  }
  console.log(`Scanning directory: ${dir}`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  for (const f of files) {
    const fullPath = path.join(dir, f);
    try {
      const buffer = fs.readFileSync(fullPath);
      const decodedPng = png.decode(buffer);
      const qr = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
      console.log(`  ${f}: ${qr ? qr.data : 'FAILED TO DECODE'}`);
    } catch (err) {
      console.log(`  ${f}: ERROR (${err.message})`);
    }
  }
}
