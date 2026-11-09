import fs from 'node:fs';

async function runSingleLiveRegistration() {
  const BASE_URL = 'http://127.0.0.1:3000';
  const LOCAL_SHEET = 'src/data/local-customers-sheet.json';
  const localSheetBefore = fs.existsSync(LOCAL_SHEET) ? fs.readFileSync(LOCAL_SHEET, 'utf8') : '[]';

  console.log('--- STEP 1: VERIFY SERVER CONFIGURATION & EMULATOR STATUS ---');
  const resetResp = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const serverState = await resetResp.json();
  console.log('Server Live Emulator Forced:', serverState.emulatorForced);
  if (serverState.emulatorForced !== false) {
    throw new Error('ABORT: Server is in emulator mode!');
  }

  console.log('\n--- STEP 2: VERIFY PHYSICAL TABLE 01 QR CREDENTIALS ---');
  const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const tablesData = await tablesResp.json();
  const table01 = tablesData.tables.find(t => t.tableNumber === 'Table 01') || tablesData.tables[0];
  console.log('Selected Table:', table01.tableNumber, '| Credential ID:', table01.credentialId);

  const qrResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: table01.tableNumber,
      cred: `${table01.credentialId}.${table01.rawSecret}`
    })
  });
  const qrData = await qrResp.json();
  console.log('QR Verification HTTP Status:', qrResp.status);
  console.log('QR Proof Token Acquired:', Boolean(qrData.qrProofToken), qrData.qrProofToken?.slice(0, 30) + '...');
  if (!qrData.qrProofToken) {
    throw new Error('ABORT: Failed to obtain valid QR Proof Token');
  }

  console.log('\n--- STEP 3: DISPATCHING EXACTLY ONE LIVE REGISTRATION REQUEST ---');
  console.log('Customer Name: tejja');
  console.log('Mobile Number: 7894561235');
  const startTime = Date.now();

  const regResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: 'tejja',
      mobile: '7894561235',
      qrProofToken: qrData.qrProofToken
    })
  });
  const durationMs = Date.now() - startTime;
  const regData = await regResp.json();

  console.log('\n--- STEP 4: LIVE RESPONSE RECEIVED ---');
  console.log('HTTP Status Code:', regResp.status);
  console.log('Round-Trip Time:', `${durationMs}ms`);
  console.log('Response Payload:', JSON.stringify(regData, null, 2));

  console.log('\n--- STEP 5: VERIFY LOCAL EMULATOR REMAINED UNTOUCHED ---');
  const localSheetAfter = fs.existsSync(LOCAL_SHEET) ? fs.readFileSync(LOCAL_SHEET, 'utf8') : '[]';
  const localUntouched = localSheetBefore === localSheetAfter;
  console.log('Local sheet file untouched (Not written to local disk):', localUntouched);
}

runSingleLiveRegistration().catch(err => {
  console.error('[ERROR]:', err);
  process.exit(1);
});
