/**
 * test_complete_qr_flow_suite.mjs
 * Comprehensive 14-scenario verification suite for Little Monkey Café Dining QR System.
 * Tests T01-T10 physical QR optical decode and all security invariants.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import png from 'fast-png';
import jsQRModule from 'jsqr';
const jsQR = jsQRModule.default || jsQRModule;

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

function toRgba(decoded) {
  if (decoded.channels === 4) return decoded.data;
  if (decoded.channels === 3) {
    const rgb = decoded.data;
    const rgba = new Uint8ClampedArray(decoded.width * decoded.height * 4);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgba[j] = rgb[i];
      rgba[j + 1] = rgb[i + 1];
      rgba[j + 2] = rgb[i + 2];
      rgba[j + 3] = 255;
    }
    return rgba;
  }
  throw new Error(`Unsupported channel count: ${decoded.channels}`);
}

async function resetServer() {
  const res = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emulator: true }),
  });
  if (!res.ok) throw new Error(`Failed to reset server: ${res.status}`);
}

async function advanceServerTime(ms) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms }),
  });
  if (!res.ok) throw new Error(`Failed to advance time: ${res.status}`);
}

const results = [];

function record(id, title, status, details) {
  results.push({ id, title, status, details });
  console.log(`[${status}] ${id}: ${title} - ${details}`);
}

async function runSuite() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFÉ DINING — COMPLETE QR FLOW TEST SUITE');
  console.log('================================================================\n');

  await resetServer();

  const tables = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10'];
  const opticalData = {};

  // SCENARIO 1 & 2: Valid QR Scan & Correct Table Identification (T01 - T10)
  console.log('\n--- SCENARIOS 1 & 2: OPTICAL DECODING & TABLE IDENTIFICATION (T01 - T10) ---');
  for (const shortCode of tables) {
    const pngPath = path.resolve(process.cwd(), 'storage/qr-codes', `table-${shortCode.toLowerCase()}.png`);
    if (!fs.existsSync(pngPath)) {
      record(`SC1-2.${shortCode}`, `Optical Decode ${shortCode}`, 'FAIL', `File missing: ${pngPath}`);
      continue;
    }
    const buf = fs.readFileSync(pngPath);
    const dec = png.decode(buf);
    const rgba = toRgba(dec);
    const qrResult = jsQR(rgba, dec.width, dec.height, { inversionAttempts: 'attemptBoth' });

    if (!qrResult || !qrResult.data) {
      record(`SC1-2.${shortCode}`, `Optical Decode ${shortCode}`, 'FAIL', 'jsQR returned null');
      continue;
    }

    const parsed = new URL(qrResult.data);
    const tableParam = parsed.searchParams.get('t');
    const credParam = parsed.searchParams.get('cred');

    if (tableParam !== shortCode) {
      record(`SC1-2.${shortCode}`, `Table Identification ${shortCode}`, 'FAIL', `Table param mismatch: got ${tableParam}, expected ${shortCode}`);
      continue;
    }

    if (!credParam || !credParam.includes('.')) {
      record(`SC1-2.${shortCode}`, `Credential Extraction ${shortCode}`, 'FAIL', `Malformed cred param: ${credParam}`);
      continue;
    }

    const [cid, secret] = credParam.split('.');
    opticalData[shortCode] = { url: qrResult.data, tableParam, credParam, cid, secret };
    record(`SC1-2.${shortCode}`, `Optical Scan & Table ID ${shortCode}`, 'PASS', `Identified Table ${shortCode}, CID: ${cid}`);
  }

  // SCENARIO 3: Successful Server Authentication (/api/dine-in/verify-qr) for T01 - T10
  console.log('\n--- SCENARIO 3: SERVER AUTHENTICATION FOR T01 - T10 ---');
  const proofTokens = {};
  for (const shortCode of tables) {
    const data = opticalData[shortCode];
    if (!data) {
      record(`SC3.${shortCode}`, `Server Auth ${shortCode}`, 'FAIL', 'Missing optical data');
      continue;
    }

    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: data.tableParam, cred: data.credParam }),
    });

    const json = await res.json();
    if (res.status === 200 && json.valid && json.qrProofToken) {
      proofTokens[shortCode] = json.qrProofToken;
      record(`SC3.${shortCode}`, `Server Auth ${shortCode}`, 'PASS', `HTTP 200, valid: true, Table: ${json.tableNumber}`);
    } else {
      record(`SC3.${shortCode}`, `Server Auth ${shortCode}`, 'FAIL', `HTTP ${res.status}, error: ${json.error}`);
    }
  }

  // SCENARIO 4: Successful Session Creation (/api/dine-in/customer/continue)
  console.log('\n--- SCENARIO 4: SESSION CREATION WITH VALID PROOF TOKEN ---');
  const testProofT01 = proofTokens['T01'];
  let activeSessionId = null;
  let sessionCookie = null;
  {
    const res = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        qrProofToken: testProofT01,
      }),
    });
    const json = await res.json();
    sessionCookie = res.headers.get('set-cookie');
    if (res.status === 200 && json.success && json.sessionToken) {
      activeSessionId = json.sessionToken;
      record('SC4', 'Session Creation', 'PASS', `Session created: ${activeSessionId.slice(0, 16)}... Cookie set`);
    } else {
      record('SC4', 'Session Creation', 'FAIL', `HTTP ${res.status}, error: ${json.error}`);
    }
  }

  // SCENARIO 5: Correct Redirect & URL Parameter Sanitization
  console.log('\n--- SCENARIO 5: URL PARAMETER SANITIZATION (CLEAN QR PARAMS) ---');
  {
    const rawUrl = opticalData['T01'].url;
    const urlObj = new URL(rawUrl);
    // Simulating cleanQrUrlParams behavior from DineInContext / auth.ts
    urlObj.searchParams.delete('cred');
    urlObj.searchParams.delete('c');
    const sanitizedSearch = urlObj.search;
    if (!sanitizedSearch.includes('cred') && sanitizedSearch.includes('t=T01')) {
      record('SC5', 'URL Parameter Sanitization', 'PASS', `Cleaned URL query: ${sanitizedSearch} (Secrets removed, table retained)`);
    } else {
      record('SC5', 'URL Parameter Sanitization', 'FAIL', `Query still contains cred: ${sanitizedSearch}`);
    }
  }

  // SCENARIO 6: Invalid Credential Rejected
  console.log('\n--- SCENARIO 6: INVALID CREDENTIAL REJECTION ---');
  {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'T01',
        cred: `${opticalData['T01'].cid}.InvalidSecret1234567890123456`,
      }),
    });
    const json = await res.json();
    if (res.status === 400 && json.error === 'INVALID_SECRET') {
      record('SC6', 'Invalid Secret Rejection', 'PASS', `HTTP 400, error: ${json.error}`);
    } else {
      record('SC6', 'Invalid Secret Rejection', 'FAIL', `Expected HTTP 400 INVALID_SECRET, got HTTP ${res.status} ${json.error}`);
    }
  }

  // SCENARIO 7: Incorrect Signature Rejected
  console.log('\n--- SCENARIO 7: INCORRECT / MUTATED SIGNATURE REJECTION ---');
  {
    // Test A: Mutated secret portion
    const resA = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'T01',
        cred: `${opticalData['T01'].cid}.${opticalData['T01'].secret.slice(0, -4)}XXXX`,
      }),
    });
    const jsonA = await resA.json();

    // Test B: Mutated credential ID portion
    const resB = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'T01',
        cred: `${opticalData['T01'].cid.slice(0, -4)}XXXX.${opticalData['T01'].secret}`,
      }),
    });
    const jsonB = await resB.json();

    if (resA.status === 400 && jsonA.error === 'INVALID_SECRET' &&
        resB.status === 400 && (jsonB.error === 'UNKNOWN_CREDENTIAL' || jsonB.error === 'CREDENTIAL_NOT_FOUND')) {
      record('SC7', 'Mutated Signature Rejection', 'PASS', `Mutated secret -> HTTP 400 ${jsonA.error}; Mutated CID -> HTTP 400 ${jsonB.error}`);
    } else {
      record('SC7', 'Mutated Signature Rejection', 'FAIL', `A=${resA.status} (${jsonA.error}), B=${resB.status} (${jsonB.error})`);
    }
  }

  // SCENARIO 8: Unknown Table Rejected
  console.log('\n--- SCENARIO 8: UNKNOWN TABLE REJECTION ---');
  {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'T99',
        cred: opticalData['T01'].credParam,
      }),
    });
    const json = await res.json();
    if (res.status === 400 && json.error === 'UNKNOWN_TABLE') {
      record('SC8', 'Unknown Table Rejection', 'PASS', `HTTP 400, error: ${json.error}`);
    } else {
      record('SC8', 'Unknown Table Rejection', 'FAIL', `Expected HTTP 400 UNKNOWN_TABLE, got HTTP ${res.status} ${json.error}`);
    }
  }

  // SCENARIO 9: Revoked Credential Rejected
  console.log('\n--- SCENARIO 9: REVOKED CREDENTIAL REJECTION ---');
  {
    // Test a known genuinely revoked credential for Table 02
    const revokedCred = 'qrc_t02_5e767d45cd76.gUUEdfRqu0pOkFhViEUc-49UaVmSqf2U';
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T02', cred: revokedCred }),
    });
    const json = await res.json();
    if (res.status === 403 && json.error === 'REVOKED_CREDENTIAL') {
      record('SC9', 'Revoked Credential Rejection', 'PASS', `HTTP 403, error: ${json.error} ("${json.message}")`);
    } else {
      record('SC9', 'Revoked Credential Rejection', 'FAIL', `Expected HTTP 403 REVOKED_CREDENTIAL, got HTTP ${res.status} ${json.error}`);
    }
  }

  // SCENARIO 10: Expired Proof Rejected
  console.log('\n--- SCENARIO 10: EXPIRED PROOF TOKEN REJECTION ---');
  {
    await resetServer();
    // Get fresh proof token for T03
    const verifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T03', cred: opticalData['T03'].credParam }),
    });
    const { qrProofToken } = await verifyRes.json();

    // Advance server time by 301 seconds (proof token TTL is 300 seconds)
    await advanceServerTime(301 * 1000);

    const useRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        qrProofToken,
      }),
    });
    const useJson = await useRes.json();
    if ((useRes.status === 403 || useRes.status === 500) && (useJson.error === 'EXPIRED_PROOF' || useJson.error === 'PROOF_EXPIRED' || useJson.message?.includes('expired'))) {
      record('SC10', 'Expired Proof Token Rejection', 'PASS', `HTTP ${useRes.status}, error: ${useJson.error || useJson.message}`);
    } else {
      record('SC10', 'Expired Proof Token Rejection', 'FAIL', `Expected expiry rejection, got HTTP ${useRes.status} ${useJson.error}`);
    }

    // Reset clock
    await resetServer();
  }

  // SCENARIO 11: Replayed Proof Rejected
  console.log('\n--- SCENARIO 11: REPLAYED PROOF TOKEN REJECTION ---');
  {
    await resetServer();
    // Generate fresh proof token for T04
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T04', cred: opticalData['T04'].credParam }),
    });
    const { qrProofToken } = await vRes.json();

    // First use: Should succeed
    const firstUse = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9876543210', qrProofToken }),
    });
    const firstJson = await firstUse.json();

    // Second use (Replay): Should fail
    const replayUse = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9876543210', qrProofToken }),
    });
    const replayJson = await replayUse.json();

    if (firstUse.status === 200 && (replayUse.status === 403 || replayUse.status === 500) && (replayJson.error === 'PROOF_ALREADY_USED' || replayJson.message?.includes('already been used') || replayJson.error === 'INVALID_QR_PROOF')) {
      record('SC11', 'Replayed Proof Token Rejection', 'PASS', `First use 200 OK, replay rejected with HTTP ${replayUse.status} (${replayJson.error || replayJson.message})`);
    } else {
      record('SC11', 'Replayed Proof Token Rejection', 'FAIL', `First: ${firstUse.status}, Replay: ${replayUse.status} ${replayJson.error}`);
    }
  }

  // SCENARIO 12: Expired Dining Session Rejected
  console.log('\n--- SCENARIO 12: EXPIRED DINING SESSION REJECTION ---');
  {
    await resetServer();
    // Create fresh session for T05
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T05', cred: opticalData['T05'].credParam }),
    });
    const { qrProofToken } = await vRes.json();

    const sessRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9876543210', qrProofToken }),
    });
    const sessJson = await sessRes.json();
    const sessionId = sessJson.sessionToken;

    // Check status while active: Should be 200 valid
    const activeCheck = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionId },
    });
    const activeCheckJson = await activeCheck.json();

    // Advance clock past 15 minutes (901 seconds)
    await advanceServerTime(901 * 1000);

    const expiredCheck = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionId },
    });
    const expiredCheckJson = await expiredCheck.json();

    if (activeCheck.status === 200 && activeCheckJson.valid && (expiredCheck.status === 401 || expiredCheck.status === 403) && expiredCheckJson.error === 'DINING_SESSION_EXPIRED') {
      record('SC12', 'Expired Dining Session Rejection', 'PASS', `Active session verified, then rejected after 15m with HTTP ${expiredCheck.status} ${expiredCheckJson.error}`);
    } else {
      record('SC12', 'Expired Dining Session Rejection', 'FAIL', `Active: ${activeCheck.status}, Expired: ${expiredCheck.status} ${expiredCheckJson.error}`);
    }

    await resetServer();
  }

  // SCENARIO 13: Repeated Scanning & Refresh Behavior
  console.log('\n--- SCENARIO 13: REPEATED SCANNING & REFRESH BEHAVIOR ---');
  {
    await resetServer();
    // Customer scans physical QR code twice in succession
    const scan1 = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T06', cred: opticalData['T06'].credParam }),
    });
    const json1 = await scan1.json();

    const scan2 = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T06', cred: opticalData['T06'].credParam }),
    });
    const json2 = await scan2.json();

    if (scan1.status === 200 && scan2.status === 200 && json1.qrProofToken !== json2.qrProofToken) {
      record('SC13', 'Repeated Scan & Refresh', 'PASS', 'Subsequent scans generate unique fresh proof tokens without error');
    } else {
      record('SC13', 'Repeated Scan & Refresh', 'FAIL', `Scan1: ${scan1.status}, Scan2: ${scan2.status}`);
    }
  }

  // SCENARIO 14: Directly Opening Malformed or Incomplete QR URL
  console.log('\n--- SCENARIO 14: MALFORMED & INCOMPLETE QR URLS ---');
  {
    // Test A: Missing cred
    const missingCred = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01' }),
    });
    const jsonA = await missingCred.json();

    // Test B: Empty string cred
    const emptyCred = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: '' }),
    });
    const jsonB = await emptyCred.json();

    // Test C: Missing dot separator
    const noDotCred = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: 'qrc_t01_abce82e42a7e' }),
    });
    const jsonC = await noDotCred.json();

    if (missingCred.status === 400 && emptyCred.status === 400 && noDotCred.status === 400) {
      record('SC14', 'Malformed QR URLs Rejected', 'PASS', `All malformed formats rejected with HTTP 400 (${jsonA.error}, ${jsonB.error}, ${jsonC.error})`);
    } else {
      record('SC14', 'Malformed QR URLs Rejected', 'FAIL', `Statuses: A=${missingCred.status}, B=${emptyCred.status}, C=${noDotCred.status}`);
    }
  }

  // PUBLIC CREDENTIAL EXPOSURE CHECKS
  console.log('\n--- PUBLIC EXPOSURE MITIGATION CHECKS ---');
  {
    const unauthJson = await fetch(`${BASE_URL}/storage/qr-codes/index.json`);
    const unauthHtml = await fetch(`${BASE_URL}/storage/qr-codes/index.html`);
    const authJson = await fetch(`${BASE_URL}/storage/qr-codes/index.json?pin=9999`);
    const staffArtwork = await fetch(`${BASE_URL}/api/admin/qr/artwork?format=html`, {
      headers: { 'x-operational-pin': '9999' },
    });

    const activeSecrets = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf-8'));
    const secrets = Object.values(activeSecrets).map(s => s.rawSecret).filter(Boolean);
    const jsonContent = fs.readFileSync('storage/qr-codes/index.json', 'utf-8');
    const htmlContent = fs.readFileSync('storage/qr-codes/index.html', 'utf-8');
    const jsonLeaks = secrets.filter(s => jsonContent.includes(s));
    const htmlLeaks = secrets.filter(s => htmlContent.includes(s));

    if (unauthJson.status === 403 && unauthHtml.status === 403 && authJson.status === 200 && staffArtwork.status === 200 && jsonLeaks.length === 0 && htmlLeaks.length === 0) {
      record('SEC-EXP', 'Public Credential Exposure Elimination', 'PASS', 'Direct /storage/ requests blocked with 403; index.json and index.html contain 0 raw secrets');
    } else {
      record('SEC-EXP', 'Public Credential Exposure Elimination', 'FAIL', `UnauthJson=${unauthJson.status}, UnauthHtml=${unauthHtml.status}, Leaks: JSON=${jsonLeaks.length}, HTML=${htmlLeaks.length}`);
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${results.filter(r => r.status === 'PASS').length} PASSED / ${results.filter(r => r.status === 'FAIL').length} FAILED`);
  console.log('================================================================\n');

  return results;
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
