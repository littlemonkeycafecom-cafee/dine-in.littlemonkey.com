import fs from 'node:fs';
import path from 'node:path';
import png from 'fast-png';
import jsQR from 'jsqr';

console.log('=== COMPARING STORAGE/QR-CODES WITH ACTIVE CREDENTIALS ===\n');

const creds = JSON.parse(fs.readFileSync('.qr_credentials.json', 'utf8'));
const activeCreds = creds.filter(c => c.isActive);

const activeMap = new Map();
for (const c of activeCreds) {
  activeMap.set(c.tableNumber.toLowerCase(), c);
}

const dir = 'storage/qr-codes';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

for (const f of files) {
  const fullPath = path.join(dir, f);
  const buffer = fs.readFileSync(fullPath);
  const decodedPng = png.decode(buffer);
  const qr = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
  
  if (!qr) {
    console.log(`[DECODE ERROR] ${f} could not be decoded!`);
    continue;
  }

  // Parse QR url
  const url = new URL(qr.data);
  const t = url.searchParams.get('t') || url.searchParams.get('table');
  const cred = url.searchParams.get('cred') || url.searchParams.get('credential');
  const dotIndex = cred ? cred.indexOf('.') : -1;
  const credId = dotIndex > -1 ? cred.substring(0, dotIndex) : cred;

  // Find in creds list
  const existingRec = creds.find(c => c.credentialId === credId);
  const tableKey = existingRec ? existingRec.tableNumber.toLowerCase() : '';
  const currentActive = activeMap.get(tableKey);

  console.log(`[${f}] Encoded Table: "${t}" | Credential ID: "${credId}"`);
  console.log(`       Is in .qr_credentials.json: ${!!existingRec}`);
  console.log(`       Record isActive in file: ${existingRec ? existingRec.isActive : 'N/A'}`);
  console.log(`       Matches Current Active for ${existingRec?.tableNumber}: ${currentActive && currentActive.credentialId === credId}`);
  if (existingRec && !existingRec.isActive) {
    console.log(`       *** THIS PHYSICAL ARTWORK IS REVOKED OR REPLACED! ***`);
    console.log(`       Current Active Credential ID: ${currentActive ? currentActive.credentialId : 'NONE'}`);
  }
  console.log('');
}
