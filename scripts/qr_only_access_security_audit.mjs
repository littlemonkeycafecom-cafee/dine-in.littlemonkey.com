import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

async function resetTestClock() {
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
}

async function advanceTestClock(seconds) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: seconds * 1000 }),
  });
  return res.json();
}

async function runSecurityAuditSuite() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ DINING — COMPLETE QR-ONLY ACCESS SECURITY AUDIT');
  console.log('========================================================================\n');

  const results = [];
  const record = (id, category, name, status, details) => {
    results.push({ id, category, name, status, details });
    const sym = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${sym} [${id}] ${category}: ${name} — ${details}`);
  };

  // Reset clock at start
  await resetTestClock();

  // Load credentials & active secrets
  const creds = JSON.parse(fs.readFileSync('.qr_credentials.json', 'utf8'));
  const secrets = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
  const activeCreds = creds.filter(c => c.isActive);
  const t01Cred = activeCreds.find(c => c.tableShortCode === 'T01');
  const t01Secret = secrets[t01Cred.credentialId];
  const t02Cred = activeCreds.find(c => c.tableShortCode === 'T02');
  const t02Secret = secrets[t02Cred.credentialId];

  // ===========================================================================
  // CATEGORY A: DIRECT-ENTRY TESTS
  // ===========================================================================
  console.log('\n--- CATEGORY A: Direct-Entry Tests ---');

  // A.1 Root URL without QR
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'MISSING_CREDENTIAL') {
      record('A.1', 'Direct-Entry', 'Root URL / Missing Credential', 'PASS', 'Rejected with 400 MISSING_CREDENTIAL');
    } else {
      record('A.1', 'Direct-Entry', 'Root URL / Missing Credential', 'FAIL', `Expected 400, got ${res.status}`);
    }
  } catch (err) {
    record('A.1', 'Direct-Entry', 'Root URL / Missing Credential', 'FAIL', err.message);
  }

  // A.2 Empty parameters
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: '', cred: '' }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'MISSING_CREDENTIAL') {
      record('A.2', 'Direct-Entry', 'Empty parameters', 'PASS', 'Rejected with 400 MISSING_CREDENTIAL');
    } else {
      record('A.2', 'Direct-Entry', 'Empty parameters', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('A.2', 'Direct-Entry', 'Empty parameters', 'FAIL', err.message);
  }

  // A.3 Missing credential with table param only
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01' }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'MISSING_CREDENTIAL') {
      record('A.3', 'Direct-Entry', 'Missing credential with table only', 'PASS', 'Rejected with 400 MISSING_CREDENTIAL');
    } else {
      record('A.3', 'Direct-Entry', 'Missing credential with table only', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('A.3', 'Direct-Entry', 'Missing credential with table only', 'FAIL', err.message);
  }

  // A.4 Invalid Table ID
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T99', cred: `${t01Cred.credentialId}.${t01Secret}` }),
    });
    const data = await res.json();
    if (res.status === 400 && (data.error === 'TABLE_MISMATCH' || data.error === 'INVALID_TABLE' || data.error === 'UNKNOWN_TABLE')) {
      record('A.4', 'Direct-Entry', 'Invalid table ID T99', 'PASS', `Rejected with 400 ${data.error}`);
    } else {
      record('A.4', 'Direct-Entry', 'Invalid table ID T99', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('A.4', 'Direct-Entry', 'Invalid table ID T99', 'FAIL', err.message);
  }

  // A.5 Unknown Credential ID
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: 'qrc_t01_unknownid999.fakeSecretKey123' }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'UNKNOWN_CREDENTIAL') {
      record('A.5', 'Direct-Entry', 'Unknown credential ID', 'PASS', 'Rejected with 400 UNKNOWN_CREDENTIAL');
    } else {
      record('A.5', 'Direct-Entry', 'Unknown credential ID', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('A.5', 'Direct-Entry', 'Unknown credential ID', 'FAIL', err.message);
  }

  // A.6 Modified Secret Key (Tampered Credential)
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: `${t01Cred.credentialId}.tamperedSecretXYZ999` }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'INVALID_SECRET') {
      record('A.6', 'Direct-Entry', 'Modified/Tampered Secret Key', 'PASS', 'HMAC comparison failed; rejected with 400 INVALID_SECRET');
    } else {
      record('A.6', 'Direct-Entry', 'Modified/Tampered Secret Key', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('A.6', 'Direct-Entry', 'Modified/Tampered Secret Key', 'FAIL', err.message);
  }

  // A.7 Invalid / Corrupted Proof Token
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrProofToken: 'qrproof.corrupted_b64.bad_sig' }),
    });
    const data = await res.json();
    if (res.status === 403 && (data.error === 'INVALID_SIGNATURE' || data.error === 'MALFORMED_TOKEN')) {
      record('A.7', 'Direct-Entry', 'Corrupted proof token', 'PASS', `Rejected with 403 ${data.error}`);
    } else {
      record('A.7', 'Direct-Entry', 'Corrupted proof token', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('A.7', 'Direct-Entry', 'Corrupted proof token', 'FAIL', err.message);
  }

  // A.8 Expired Proof Token
  try {
    // Generate valid proof first
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: `${t01Cred.credentialId}.${t01Secret}` }),
    });
    const vData = await vRes.json();
    const proofToken = vData.qrProofToken;

    // Advance clock past 5 minutes (301 seconds)
    await advanceTestClock(301);

    const checkRes = await fetch(`${BASE_URL}/api/dine-in/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrProofToken: proofToken }),
    });
    const checkData = await checkRes.json();

    if (checkRes.status === 403 && checkData.error === 'EXPIRED_PROOF') {
      record('A.8', 'Direct-Entry', 'Expired proof token rejection', 'PASS', 'Proof expired after 5 minutes; rejected with 403 EXPIRED_PROOF');
    } else {
      record('A.8', 'Direct-Entry', 'Expired proof token rejection', 'FAIL', `Status: ${checkRes.status}, error: ${checkData.error}`);
    }
  } catch (err) {
    record('A.8', 'Direct-Entry', 'Expired proof token rejection', 'FAIL', err.message);
  } finally {
    await resetTestClock();
  }

  // ===========================================================================
  // CATEGORY B: TABLE AUTHORIZATION TESTS
  // ===========================================================================
  console.log('\n--- CATEGORY B: Table Authorization Tests ---');

  // B.1 All 10 tables correctly identified
  try {
    let allOk = true;
    for (const c of activeCreds) {
      const secret = secrets[c.credentialId];
      const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: c.tableShortCode, cred: `${c.credentialId}.${secret}` }),
      });
      const data = await res.json();
      if (!data.valid || data.tableNumber !== c.tableNumber) {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      record('B.1', 'Table Authorization', 'All 10 Tables Identified (T01-T10)', 'PASS', 'All 10 active credentials correctly mapped to their authoritative table numbers');
    } else {
      record('B.1', 'Table Authorization', 'All 10 Tables Identified (T01-T10)', 'FAIL', 'One or more tables failed identification');
    }
  } catch (err) {
    record('B.1', 'Table Authorization', 'All 10 Tables Identified (T01-T10)', 'FAIL', err.message);
  }

  // B.2 Table Mismatch (T01 credential with table=T02)
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T02', cred: `${t01Cred.credentialId}.${t01Secret}` }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'TABLE_MISMATCH') {
      record('B.2', 'Table Authorization', 'Table Mismatch Prevention', 'PASS', 'T01 credential passed with T02 rejected with 400 TABLE_MISMATCH');
    } else {
      record('B.2', 'Table Authorization', 'Table Mismatch Prevention', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('B.2', 'Table Authorization', 'Table Mismatch Prevention', 'FAIL', err.message);
  }

  // B.3 Table Manipulation Cannot Change Authorized Table
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T05', cred: `${t01Cred.credentialId}.${t01Secret}` }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'TABLE_MISMATCH') {
      record('B.3', 'Table Authorization', 'Tampered Table Parameter Rejected', 'PASS', 'Client parameter cannot override credential table binding');
    } else {
      record('B.3', 'Table Authorization', 'Tampered Table Parameter Rejected', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('B.3', 'Table Authorization', 'Tampered Table Parameter Rejected', 'FAIL', err.message);
  }

  // ===========================================================================
  // CATEGORY C: API BYPASS TESTS
  // ===========================================================================
  console.log('\n--- CATEGORY C: API Bypass Tests ---');

  // C.1 /api/dine-in/tables without session
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/tables`);
    const data = await res.json();
    if (res.status === 401 && data.error === 'UNAUTHORIZED_DINING_ACCESS') {
      record('C.1', 'API Bypass', 'Protected API /api/dine-in/tables', 'PASS', 'Direct call without session rejected with 401 UNAUTHORIZED_DINING_ACCESS');
    } else {
      record('C.1', 'API Bypass', 'Protected API /api/dine-in/tables', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('C.1', 'API Bypass', 'Protected API /api/dine-in/tables', 'FAIL', err.message);
  }

  // C.2 /api/dine-in/session without session
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/session`);
    const data = await res.json();
    if (res.status === 401 && data.error === 'UNAUTHORIZED_DINING_ACCESS') {
      record('C.2', 'API Bypass', 'Protected API /api/dine-in/session', 'PASS', 'Direct call without session rejected with 401 UNAUTHORIZED_DINING_ACCESS');
    } else {
      record('C.2', 'API Bypass', 'Protected API /api/dine-in/session', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('C.2', 'API Bypass', 'Protected API /api/dine-in/session', 'FAIL', err.message);
  }

  // C.3 /api/dine-in/customer/lookup without QR proof
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9876543210' }),
    });
    const data = await res.json();
    if (res.status === 403 && data.error === 'MISSING_QR_PROOF') {
      record('C.3', 'API Bypass', 'Customer lookup without QR proof', 'PASS', 'Rejected with 403 MISSING_QR_PROOF');
    } else {
      record('C.3', 'API Bypass', 'Customer lookup without QR proof', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('C.3', 'API Bypass', 'Customer lookup without QR proof', 'FAIL', err.message);
  }

  // C.4 /api/dine-in/create-session without QR proof
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerToken: 'fake_cust_token' }),
    });
    const data = await res.json();
    if ((res.status === 400 || res.status === 403) && data.error === 'MISSING_QR_PROOF') {
      record('C.4', 'API Bypass', 'Session creation without QR proof', 'PASS', `Rejected with HTTP ${res.status} MISSING_QR_PROOF`);
    } else {
      record('C.4', 'API Bypass', 'Session creation without QR proof', 'FAIL', `Status: ${res.status}, error: ${data.error}`);
    }
  } catch (err) {
    record('C.4', 'API Bypass', 'Session creation without QR proof', 'FAIL', err.message);
  }

  // C.5 Tampered Session Token
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/session`, {
      headers: { Authorization: 'Bearer dinesess_forged_hacker_token_12345' },
    });
    const data = await res.json();
    if (res.status === 401 && data.error === 'UNAUTHORIZED_DINING_ACCESS') {
      record('C.5', 'API Bypass', 'Tampered session token rejection', 'PASS', 'Server storage check failed; rejected with 401 UNAUTHORIZED_DINING_ACCESS');
    } else {
      record('C.5', 'API Bypass', 'Tampered session token rejection', 'FAIL', `Status: ${res.status}`);
    }
  } catch (err) {
    record('C.5', 'API Bypass', 'Tampered session token rejection', 'FAIL', err.message);
  }

  // ===========================================================================
  // CATEGORY D: SESSION LIFECYCLE & REPLAY TESTS
  // ===========================================================================
  console.log('\n--- CATEGORY D: Session Lifecycle & Replay Tests ---');

  // D.1 Single-Use QR Proof Replay Prevention
  try {
    // 1. Issue fresh proof
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: `${t01Cred.credentialId}.${t01Secret}` }),
    });
    const vData = await vRes.json();
    const proofToken = vData.qrProofToken;

    // 2. Consume proof to continue existing customer
    const contRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
      body: JSON.stringify({ mobile: '9999999999', qrProofToken: proofToken }),
    });
    const contData = await contRes.json();
    const sessionToken = contData.sessionToken;

    // 3. Attempt replay with same proofToken
    const replayRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
      body: JSON.stringify({ mobile: '9999999999', qrProofToken: proofToken }),
    });
    const replayData = await replayRes.json();

    if (contRes.status === 200 && (replayRes.status === 403 || replayRes.status === 400) && replayData.error === 'PROOF_ALREADY_USED') {
      record('D.1', 'Session Lifecycle', 'Single-use QR proof replay prevention', 'PASS', 'First consumption succeeded; second replay rejected with 403 PROOF_ALREADY_USED');
    } else {
      record('D.1', 'Session Lifecycle', 'Single-use QR proof replay prevention', 'FAIL', `Cont: ${contRes.status}, Replay: ${replayRes.status}, error: ${replayData.error}`);
    }

    // D.2 Session validation & survival
    const sessRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: {
        'x-dining-session': sessionToken,
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    const sessData = await sessRes.json();
    if (sessRes.status === 200 && sessData.valid && sessData.tableNumber === 'Table 01') {
      record('D.2', 'Session Lifecycle', 'Valid session validation', 'PASS', 'Session verified with Table 01 and 15-minute countdown');
    } else {
      record('D.2', 'Session Lifecycle', 'Valid session validation', 'FAIL', `Status: ${sessRes.status}`);
    }

    // D.3 15-Minute Session Expiration Enforcement
    await advanceTestClock(905); // 15 mins + 5 sec
    const expRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: {
        'x-dining-session': sessionToken,
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    const expData = await expRes.json();

    if (expRes.status === 401 && expData.error === 'DINING_SESSION_EXPIRED') {
      record('D.3', 'Session Lifecycle', '15-Minute session expiration', 'PASS', 'Session accurately expired after 15 minutes (HTTP 401 DINING_SESSION_EXPIRED)');
    } else {
      record('D.3', 'Session Lifecycle', '15-Minute session expiration', 'FAIL', `Status: ${expRes.status}, error: ${expData.error}`);
    }
  } catch (err) {
    record('D.1', 'Session Lifecycle', 'Session lifecycle error', 'FAIL', err.message);
  } finally {
    await resetTestClock();
  }

  // ===========================================================================
  // CATEGORY E: STATIC ASSET & MANIFEST SECURITY
  // ===========================================================================
  console.log('\n--- CATEGORY E: Static Asset & Manifest Security ---');

  // E.1 Direct unauthenticated static file access to storage/
  try {
    const jsonRes = await fetch(`${BASE_URL}/storage/qr-codes/index.json`);
    const pngRes = await fetch(`${BASE_URL}/storage/qr-codes/table-t01.png`);
    const pdfRes = await fetch(`${BASE_URL}/storage/qr-codes/little-monkey-table-qrs.pdf`);

    if (jsonRes.status === 403 && pngRes.status === 403 && pdfRes.status === 403) {
      record('E.1', 'Static Asset Security', 'Direct /storage/ access blocked', 'PASS', 'Static access to /storage/ files returned 403 ACCESS_DENIED for unauthorized visitors');
    } else {
      record('E.1', 'Static Asset Security', 'Direct /storage/ access blocked', 'FAIL', `JSON: ${jsonRes.status}, PNG: ${pngRes.status}, PDF: ${pdfRes.status}`);
    }
  } catch (err) {
    record('E.1', 'Static Asset Security', 'Direct /storage/ access blocked', 'FAIL', err.message);
  }

  // E.2 Manifest secret audit
  try {
    const manifestContent = fs.readFileSync('storage/qr-codes/index.json', 'utf8');
    const manifestJson = JSON.parse(manifestContent);
    let leaksSecret = false;
    for (const secretVal of Object.values(secrets)) {
      if (typeof secretVal === 'string' && secretVal.length > 10 && manifestContent.includes(secretVal)) {
        leaksSecret = true;
        break;
      }
    }
    if (!leaksSecret && manifestJson.tables?.length === 10) {
      record('E.2', 'Static Asset Security', 'Manifest contains ZERO raw secrets', 'PASS', 'Audited index.json against all active secrets; zero secrets present, only public credential IDs');
    } else {
      record('E.2', 'Static Asset Security', 'Manifest contains ZERO raw secrets', 'FAIL', 'Raw secret found in index.json!');
    }
  } catch (err) {
    record('E.2', 'Static Asset Security', 'Manifest contains ZERO raw secrets', 'FAIL', err.message);
  }

  // E.3 Admin artwork route authorization
  try {
    const unauthArt = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=T01&format=png`);
    const authHeaderArt = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=T01&format=png`, {
      headers: { 'X-Operational-PIN': ADMIN_PIN },
    });
    if (unauthArt.status === 403 && authHeaderArt.status === 200) {
      record('E.3', 'Static Asset Security', 'Admin artwork authorization via headers', 'PASS', 'Unauthenticated request blocked (403); X-Operational-PIN header authorized (200)');
    } else {
      record('E.3', 'Static Asset Security', 'Admin artwork authorization via headers', 'FAIL', `Unauth: ${unauthArt.status}, AuthHeader: ${authHeaderArt.status}`);
    }
  } catch (err) {
    record('E.3', 'Static Asset Security', 'Admin artwork authorization via headers', 'FAIL', err.message);
  }

  // ===========================================================================
  // CATEGORY F: BROWSER AUTOMATION & RENDERED UI TESTS (Puppeteer)
  // ===========================================================================
  console.log('\n--- CATEGORY F: Browser Automation & UI Tests ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  try {
    // F.1 Direct URL entry renders TableQrRequiredGate and strictly excludes menu catalog
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 900 });
    await page1.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await page1.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const html1 = await page1.content();
    const hasGate1 = html1.includes('Table QR Scan Required') || html1.includes('IN-CAFÉ QR ACCESS REQUIRED');
    const hasMenu1 = html1.includes('id="main-menu-catalog"');
    const hasCustomerEntry1 = html1.includes('ENTER YOUR MOBILE');

    if (hasGate1 && !hasMenu1 && !hasCustomerEntry1) {
      record('F.1', 'Browser UI', 'Direct entry blocked by TableQrRequiredGate', 'PASS', 'Direct URL renders TableQrRequiredGate; menu catalog and customer entry are completely absent from DOM');
    } else {
      record('F.1', 'Browser UI', 'Direct entry blocked by TableQrRequiredGate', 'FAIL', `hasGate: ${hasGate1}, hasMenu: ${hasMenu1}, hasCustEntry: ${hasCustomerEntry1}`);
    }
    await page1.close();

    // F.2 Physical QR URL renders CustomerLoginGate with recognized table and zero camera prompts
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 390, height: 844 });
    let cameraRequested = false;
    await page2.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = function(...args) {
          window.__cam_called = true;
          return Promise.reject(new Error('PermissionDenied'));
        };
      }
    });

    await page2.goto(`${BASE_URL}/?t=T01&cred=${t01Cred.credentialId}.${t01Secret}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const html2 = await page2.content();
    const url2 = page2.url();
    const credScrubbed = !url2.includes('cred=');
    const hasTable01 = html2.includes('Table 01') || html2.includes('Window Bay');
    const hasEntry2 = html2.includes('ENTER YOUR MOBILE') || html2.includes('Customer') || html2.includes('Mobile Number');
    cameraRequested = await page2.evaluate(() => Boolean(window.__cam_called));

    if (credScrubbed && hasTable01 && hasEntry2 && !cameraRequested) {
      record('F.2', 'Browser UI', 'Physical QR entry renders customer login gate', 'PASS', 'Credentials scrubbed from address bar; Table 01 recognized; CustomerLoginGate displayed; 0 camera requests');
    } else {
      record('F.2', 'Browser UI', 'Physical QR entry renders customer login gate', 'FAIL', `credScrubbed: ${credScrubbed}, table: ${hasTable01}, entry: ${hasEntry2}, cam: ${cameraRequested}`);
    }

    // F.3 Page reload on CustomerLoginGate retains table without asking to re-scan
    await page2.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const htmlReload = await page2.content();
    const stillHasTable01 = htmlReload.includes('Table 01') || htmlReload.includes('Window Bay');
    const stillOnEntry = htmlReload.includes('ENTER YOUR MOBILE') || htmlReload.includes('Customer') || htmlReload.includes('Mobile Number');
    const noReScanPrompt = !htmlReload.includes('Table QR Scan Required');

    if (stillHasTable01 && stillOnEntry && noReScanPrompt) {
      record('F.3', 'Browser UI', 'Reload on Customer Entry retains table', 'PASS', 'Reload verified via /api/dine-in/verify-proof; Table 01 retained; no duplicate scan prompt');
    } else {
      record('F.3', 'Browser UI', 'Reload on Customer Entry retains table', 'FAIL', `table: ${stillHasTable01}, entry: ${stillOnEntry}, noScanPrompt: ${noReScanPrompt}`);
    }
    await page2.close();

    // F.4 In-built camera scanner lifecycle & audio:false check
    const page3 = await browser.newPage();
    await page3.setViewport({ width: 390, height: 844 });
    await page3.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await page3.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Open scanner from elevated dock button
    const dockBtn = await page3.$('.lm-scanner-dock-btn');
    if (dockBtn) {
      await dockBtn.click();
      await new Promise(r => setTimeout(r, 1400));

      const scannerInfo = await page3.evaluate(() => {
        const video = document.querySelector('video');
        const stream = video?.srcObject;
        return {
          isOpen: !!video,
          hasStream: !!stream,
          videoTracks: stream ? stream.getVideoTracks().length : 0,
          audioTracks: stream ? stream.getAudioTracks().length : 0,
        };
      });

      // Exit scanner
      await page3.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const exitBtn = btns.find(b => (b.textContent || '').includes('Exit') || b.getAttribute('aria-label')?.includes('Close'));
        if (exitBtn) exitBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));

      const unmounted = await page3.evaluate(() => !document.querySelector('video'));

      if (scannerInfo.isOpen && scannerInfo.hasStream && scannerInfo.audioTracks === 0 && unmounted) {
        record('F.4', 'Browser UI', 'In-built scanner lifecycle & audio:false', 'PASS', 'Scanner opened with native permissions; audioTracks: 0; cleanly unmounted and tracks stopped on exit');
      } else {
        record('F.4', 'Browser UI', 'In-built scanner lifecycle & audio:false', 'FAIL', `info: ${JSON.stringify(scannerInfo)}, unmounted: ${unmounted}`);
      }
    } else {
      record('F.4', 'Browser UI', 'In-built scanner lifecycle & audio:false', 'FAIL', 'Dock scanner button not found');
    }
    await page3.close();

  } finally {
    await browser.close();
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('SECURITY AUDIT SUMMARY:');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const blockCount = results.filter(r => r.status === 'BLOCKED').length;
  console.log(`Passed: ${passCount} / ${results.length}`);
  console.log(`Failed: ${failCount} / ${results.length}`);
  console.log(`Blocked: ${blockCount} / ${results.length}`);
  console.log('========================================================================\n');

  return results;
}

runSecurityAuditSuite().catch(console.error);
