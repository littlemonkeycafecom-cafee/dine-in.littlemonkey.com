import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:3000';

async function run() {
  console.log('--- 1. Testing Admin Authorization ---');
  // Without PIN -> 403
  const resNoAuth = await fetch(`${BASE_URL}/api/admin/qr/tables`);
  assert.strictEqual(resNoAuth.status, 403, 'Admin endpoint must reject unauthenticated request');
  console.log('[PASS] Unauthenticated admin query rejected with 403');

  // With PIN -> 200
  const resAuth = await fetch(`${BASE_URL}/api/admin/qr/tables`, {
    headers: { 'X-Operational-PIN': '9999' }
  });
  assert.strictEqual(resAuth.status, 200, 'Admin endpoint must succeed with valid PIN');
  const adminData = await resAuth.json();
  assert(Array.isArray(adminData.tables), 'tables must be an array');
  assert.strictEqual(adminData.tables.length, 6, 'Must list exactly 6 tables');
  console.log('[PASS] Admin endpoint returns exactly 6 tables with active credentials');
  console.log('Tables found:', adminData.tables.map(t => `${t.tableNumber} (${t.credentialId}, active=${t.isActive})`));

  console.log('\n--- 2. Testing Credential Rotation & Retrieval ---');
  const rotateRes = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operational-PIN': '9999'
    },
    body: JSON.stringify({ tableNumber: 'Table 01' })
  });
  assert.strictEqual(rotateRes.status, 200, 'Credential rotation must succeed');
  const rotateData = await rotateRes.json();
  assert(rotateData.rawSecret, 'Must return rawSecret once');
  assert(rotateData.credentialId, 'Must return credentialId');
  assert(rotateData.entryUrl, 'Must return entryUrl');
  console.log('[PASS] Rotated Table 01 credential:', {
    credentialId: rotateData.credentialId,
    entryUrl: rotateData.entryUrl
  });

  console.log('\n--- 3. Testing QR Verification ---');
  // Unknown credential -> 400
  const verifyBad = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'Table 01', cred: 'qrc_t01_fake.fakeSecret' })
  });
  assert.strictEqual(verifyBad.status, 400, 'Unknown credential must be rejected');
  console.log('[PASS] Unknown QR credential rejected');

  // Valid credential -> 200
  const validCredParam = `${rotateData.credentialId}.${rotateData.rawSecret}`;
  const verifyGood = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'Table 01', cred: validCredParam })
  });
  assert.strictEqual(verifyGood.status, 200, 'Valid credential must be accepted');
  const verifyGoodData = await verifyGood.json();
  assert(verifyGoodData.qrProofToken, 'Must issue qrProofToken');
  console.log('[PASS] Valid QR verified, issued qrProofToken:', verifyGoodData.qrProofToken);

  console.log('\n--- 4. Testing 30-Minute Dining Session Creation ---');
  // Without customer token -> 401
  const sessNoAuth = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrProofToken: verifyGoodData.qrProofToken })
  });
  assert.strictEqual(sessNoAuth.status, 401, 'Customer auth required');
  console.log('[PASS] Session creation blocked without customer authentication');

  // With customer token -> 200
  const sessGood = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_token_guest'
    },
    body: JSON.stringify({ qrProofToken: verifyGoodData.qrProofToken })
  });
  assert.strictEqual(sessGood.status, 200, 'Session creation must succeed with valid token');
  const sessData = await sessGood.json();
  assert(sessData.sessionToken, 'Must return sessionToken');
  assert.strictEqual(sessData.session.tableNumber, 'Table 01', 'Must be Table 01');
  assert.strictEqual(sessData.session.durationMs, 1800000, 'Duration must be exactly 30 mins (1,800,000 ms)');
  console.log('[PASS] Created 30-minute dining session:', {
    sessionId: sessData.sessionToken,
    table: sessData.session.tableNumber,
    expiresAt: new Date(sessData.session.expiresAt).toLocaleTimeString(),
    timeRemainingMs: sessData.session.timeRemainingMs
  });

  console.log('\n--- 5. Testing Session Status Endpoint ---');
  const statusRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { 'X-Dining-Session': sessData.sessionToken }
  });
  assert.strictEqual(statusRes.status, 200, 'Session status check must succeed');
  const statusData = await statusRes.json();
  assert.strictEqual(statusData.tableNumber, 'Table 01');
  console.log('[PASS] Active session status validated. Time remaining:', Math.round(statusData.timeRemainingMs / 1000), 'seconds');

  console.log('\n--- 6. Testing Deterministic 30-Minute Session Expiry ---');
  // Reset clock first
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });

  // Advance time by 29 minutes (1740 seconds) -> should still be active
  await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: 29 * 60 * 1000 })
  });

  const status29m = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { 'X-Dining-Session': sessData.sessionToken }
  });
  assert.strictEqual(status29m.status, 200, 'Session must still be active at 29 minutes');
  const data29m = await status29m.json();
  console.log('[PASS] At 29 mins: Session still active, ~60s remaining:', Math.round(data29m.timeRemainingMs / 1000), 'seconds');

  // Advance time by another 2 minutes (total 31 minutes > 30 minutes) -> MUST expire!
  await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: 2 * 60 * 1000 })
  });

  const status31m = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { 'X-Dining-Session': sessData.sessionToken }
  });
  assert.strictEqual(status31m.status, 401, 'Session must expire after 30 minutes');
  const data31m = await status31m.json();
  assert.strictEqual(data31m.error, 'DINING_SESSION_EXPIRED');
  console.log('[PASS] At 31 mins: Server strictly rejected expired session with 401 DINING_SESSION_EXPIRED');

  // Reset clock
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  console.log('[PASS] Test clock reset');

  console.log('\n--- 7. Testing Credential Revocation Cascading ---');
  // Create fresh session on Table 02
  const rotT2 = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Operational-PIN': '9999' },
    body: JSON.stringify({ tableNumber: 'Table 02' })
  }).then(r => r.json());

  const vT2 = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'Table 02', cred: `${rotT2.credentialId}.${rotT2.rawSecret}` })
  }).then(r => r.json());

  const sT2 = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev_token_guest' },
    body: JSON.stringify({ qrProofToken: vT2.qrProofToken })
  }).then(r => r.json());

  // Check session is valid
  const checkT2Before = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { 'X-Dining-Session': sT2.sessionToken }
  });
  assert.strictEqual(checkT2Before.status, 200);

  // Now revoke Table 02 credential!
  const revokeT2 = await fetch(`${BASE_URL}/api/admin/qr/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Operational-PIN': '9999' },
    body: JSON.stringify({ tableNumber: 'Table 02' })
  });
  assert.strictEqual(revokeT2.status, 200);

  // Session must now be rejected with 403 CREDENTIAL_REVOKED!
  const checkT2After = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { 'X-Dining-Session': sT2.sessionToken }
  });
  assert.strictEqual(checkT2After.status, 403, 'Session must be immediately revoked');
  const checkT2Data = await checkT2After.json();
  assert.strictEqual(checkT2Data.error, 'CREDENTIAL_REVOKED');
  console.log('[PASS] Revoking table credential immediately invalidates all active dining sessions');

  console.log('\n--- 8. Testing Vector PDF Export ---');
  const pdfRes = await fetch(`${BASE_URL}/api/admin/qr/export-pdf?mode=staging`, {
    headers: { 'X-Operational-PIN': '9999' }
  });
  assert.strictEqual(pdfRes.status, 200);
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = await pdfRes.arrayBuffer();
  assert(pdfBytes.byteLength > 10000, 'PDF buffer must contain substantial vector content');
  console.log('[PASS] Generated 6-table scannable vector PDF. Size:', pdfBytes.byteLength, 'bytes');

  console.log('\n======================================================');
  console.log('ALL SERVER-SIDE QR & SESSION TESTS PASSED WITH EVIDENCE');
  console.log('======================================================');
}

run().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
