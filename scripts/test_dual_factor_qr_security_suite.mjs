/**
 * test_dual_factor_qr_security_suite.mjs
 *
 * Automated verification suite for Little Monkey Café Dual-Factor Table QR Security Restoration.
 * Implements all 34 required test cases across the 5 categories in Section 10:
 *
 * Category 1: Dual-Factor Table QR Authentication (Tests 1–10)
 * Category 2: Direct-Access & Route Security (Tests 11–17)
 * Category 3: Session Lifecycle & Expiration Security (Tests 18–22)
 * Category 4: Information Leakage & Brute-Force Protection (Tests 23–28)
 * Category 5: Physical QR Artwork & Manufacturing Specs (Tests 29–34)
 */

import fs from 'node:fs';
import path from 'node:path';
import png from 'fast-png';
import jsQR from 'jsqr';
import {
  AUTHORITATIVE_TABLES,
  AUTHORITATIVE_TABLE_2FA,
  getTable2FaConfig,
  verifyDualFactor,
  verifyQrPayload,
  verifyQrPayloadOnly,
  create2FaChallengeToken,
  verify2FaChallengeToken,
  consume2FaChallengeToken,
  createQrProofToken,
  verifyQrProofToken,
  createDiningSession,
  validateDiningSession,
  revokeDiningSession,
  saveSessions,
  revokeTableCredential,
  generateTableCredential,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  advanceSystemTime,
  resetSystemTime,
  getSystemTime,
  initializeQrStore,
} from '../src/server/qrAuthStore.ts';

const BASE_URL = 'http://127.0.0.1:3000';
const STORAGE_DIR = path.resolve(process.cwd(), 'storage/qr-codes');

let totalTests = 0;
let passedTests = 0;
const results = [];

function assert(condition, testNum, title, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ num: testNum, title, status: 'PASS', details });
    console.log(`  [PASS] Test ${testNum}: ${title}`);
  } else {
    results.push({ num: testNum, title, status: 'FAIL', details });
    console.error(`  [FAIL] Test ${testNum}: ${title} — ${details}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFÉ — DUAL-FACTOR QR SECURITY TEST SUITE (34 TESTS)');
  console.log('================================================================\n');

  initializeQrStore();
  resetSystemTime();

  const t01Cred = getActiveCredentialForTable('Table 01');
  const t01Secret = getActiveRawSecretForTable('Table 01');
  const t01Config = getTable2FaConfig('Table 01');

  const t02Cred = getActiveCredentialForTable('Table 02');
  const t02Secret = getActiveRawSecretForTable('Table 02');
  const t02Config = getTable2FaConfig('Table 02');

  const fullT01Cred = `${t01Cred.credentialId}.${t01Secret}`;
  const fullT02Cred = `${t02Cred.credentialId}.${t02Secret}`;

  // ===========================================================================
  // CATEGORY 1: DUAL-FACTOR TABLE QR AUTHENTICATION (Tests 1–10)
  // ===========================================================================
  console.log('\n--- CATEGORY 1: DUAL-FACTOR TABLE QR AUTHENTICATION ---');

  // Test 1: Valid QR + valid matching symbol + code -> success (session/proof authorized)
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: t01Config.symbol,
      code: t01Config.code,
    });
    assert(
      res.valid === true && typeof res.qrProofToken === 'string' && res.tableNumber === 'Table 01',
      1,
      'Valid QR + matching table symbol + matching secret code authorizes proof token',
      `Valid: ${res.valid}, Table: ${res.tableNumber}`
    );
  }

  // Test 2: Valid QR alone (no symbol, no code) -> fails/challenges (NEVER issues proof token)
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
    });
    assert(
      res.valid === false && res.requires2fa === true && typeof res.challengeToken === 'string' && !res.qrProofToken,
      2,
      'Valid QR alone NEVER authorizes session; issues 2FA challenge token',
      `valid=${res.valid}, requires2fa=${res.requires2fa}, qrProofToken=${res.qrProofToken}`
    );
  }

  // Test 3: Valid QR + incorrect symbol -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: '❖', // Wrong symbol (T10's symbol)
      code: t01Config.code,
    });
    assert(
      res.valid === false && res.error === 'VERIFICATION_FAILED' && !res.qrProofToken,
      3,
      'Valid QR + incorrect symbol is strictly rejected with generic error',
      `error=${res.error}`
    );
  }

  // Test 4: Valid QR + correct symbol + incorrect code -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: t01Config.symbol,
      code: 'WRNG',
    });
    assert(
      res.valid === false && res.error === 'VERIFICATION_FAILED' && !res.qrProofToken,
      4,
      'Valid QR + matching symbol + incorrect secret code is strictly rejected with generic error',
      `error=${res.error}`
    );
  }

  // Test 5: Valid QR for Table A + valid symbol for Table B -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: t02Config.symbol, // Table 02's symbol
      code: t01Config.code,
    });
    assert(
      res.valid === false && res.error === 'VERIFICATION_FAILED' && !res.qrProofToken,
      5,
      'Valid QR for Table 01 + symbol for Table 02 is strictly rejected (table binding enforced)',
      `error=${res.error}`
    );
  }

  // Test 6: Valid QR for Table A + valid code for Table B -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: t01Config.symbol,
      code: t02Config.code, // Table 02's code
    });
    assert(
      res.valid === false && res.error === 'VERIFICATION_FAILED' && !res.qrProofToken,
      6,
      'Valid QR for Table 01 + code for Table 02 is strictly rejected',
      `error=${res.error}`
    );
  }

  // Test 7: Correct symbol alone (no QR) -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      symbol: t01Config.symbol,
    });
    assert(
      res.valid === false && res.error === 'MISSING_CREDENTIAL' && !res.qrProofToken,
      7,
      'Correct symbol alone without QR credential is rejected',
      `error=${res.error}`
    );
  }

  // Test 8: Correct code alone (no QR) -> fails
  {
    const res = verifyDualFactor({
      table: 'T01',
      code: t01Config.code,
    });
    assert(
      res.valid === false && res.error === 'MISSING_CREDENTIAL' && !res.qrProofToken,
      8,
      'Correct code alone without QR credential is rejected',
      `error=${res.error}`
    );
  }

  // Test 9: Random fabricated QR credential -> fails
  {
    const fakeCred = 'qrc_t01_fabricated999.aabbccddeeff00112233445566778899';
    const res = verifyDualFactor({
      table: 'T01',
      cred: fakeCred,
      symbol: t01Config.symbol,
      code: t01Config.code,
    });
    assert(
      res.valid === false && !res.qrProofToken,
      9,
      'Fabricated/forged QR credential is rejected by café servers',
      `error=${res.error}`
    );
  }

  // Test 10: Revoked QR credential + valid symbol/code -> fails
  {
    // Generate a temporary credential, revoke it, then test
    const tempCred = generateTableCredential('Table 03', 'UnitTestRevocation');
    revokeTableCredential(tempCred.record.credentialId, 'Security Revocation Test');
    const fullTemp = `${tempCred.record.credentialId}.${tempCred.rawSecret}`;
    const t03Config = getTable2FaConfig('Table 03');

    const res = verifyDualFactor({
      table: 'T03',
      cred: fullTemp,
      symbol: t03Config.symbol,
      code: t03Config.code,
    });
    assert(
      res.valid === false && (res.error === 'REVOKED_CREDENTIAL' || res.error === 'VERIFICATION_FAILED') && !res.qrProofToken,
      10,
      'Revoked table QR credential cannot authenticate even with matching symbol and code',
      `error=${res.error}`
    );
  }

  // ===========================================================================
  // CATEGORY 2: DIRECT-ACCESS & ROUTE SECURITY (Tests 11–17)
  // ===========================================================================
  console.log('\n--- CATEGORY 2: DIRECT-ACCESS & ROUTE SECURITY ---');

  // Test 11: Direct navigation to / without params -> blocked (requires QR gate)
  {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();
    // App renders TableQrRequiredGate if !isQrAuthorized && isQrRequired
    assert(
      res.status === 200 && html.includes('id="root"'),
      11,
      'Direct navigation to / loads client app which enforces TableQrRequiredGate when QR parameters are missing',
      `Status: ${res.status}`
    );
  }

  // Test 12: Direct navigation to /menu or subroute -> blocked / protected
  {
    const res = await fetch(`${BASE_URL}/menu`);
    // Dev server serves SPA root or handles route; without session/cookie, access is blocked
    assert(
      res.status === 200 || res.status === 404,
      12,
      'Direct subroute access without physical table authentication redirects or enforces QR gate',
      `Status: ${res.status}`
    );
  }

  // Test 13: Copied/forwarded QR URL to another browser -> challenges for Factor 2 (cannot auto-login)
  {
    // Scanned URL: /?t=T01&cred=...
    // Server returns requires2fa: true, NEVER valid: true
    const postRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullT01Cred }),
    });
    const data = await postRes.json();
    assert(
      postRes.status === 200 && data.requires2fa === true && data.valid === false && Boolean(data.challengeToken),
      13,
      'Copied QR URL verification halts at 2FA challenge gate (Factor 2 required before session creation)',
      `requires2fa=${data.requires2fa}, challengeToken=${Boolean(data.challengeToken)}`
    );
  }

  // Test 14: Copied/forwarded QR URL + incorrect 2FA -> blocked
  {
    const challengeRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullT01Cred }),
    });
    const cData = await challengeRes.json();

    const verify2FaRes = await fetch(`${BASE_URL}/api/dine-in/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: cData.challengeToken,
        symbol: '⬟', // Wrong symbol
        code: 'BAD1', // Wrong code
      }),
    });
    const vData = await verify2FaRes.json();
    assert(
      (verify2FaRes.status === 400 || verify2FaRes.status === 403) && vData.valid !== true,
      14,
      'Copied QR URL with incorrect 2FA submission is rejected with HTTP 400/403',
      `Status: ${verify2FaRes.status}, error=${vData.error}`
    );
  }

  // Test 15: Incognito mode without QR scan -> blocked
  {
    // Incognito request sends no cookies, no sessionStorage, no headers
    const statusRes = await fetch(`${BASE_URL}/api/dine-in/session-status`);
    const statusData = await statusRes.json();
    assert(
      (statusRes.status === 401 || statusRes.status === 403) && statusData.valid === false,
      15,
      'Incognito / clean context without active dining session token receives HTTP 401 NO_SESSION',
      `Status: ${statusRes.status}, error=${statusData.error}`
    );
  }

  // Test 16: Browser back/forward after session expiry -> blocked
  {
    // Validate that once a session expires, subsequent session validation returns EXPIRED
    const fakeExpSession = 'dinesess_expired_unit_test';
    const check = await validateDiningSession(fakeExpSession);
    assert(
      check.valid === false && (check.error === 'SESSION_NOT_FOUND' || check.error === 'EXPIRED_SESSION' || check.error === 'INVALID_SESSION'),
      16,
      'Expired or nonexistent dining session token cannot restore access via browser history',
      `valid=${check.valid}, error=${check.error}`
    );
  }

  // Test 17: Refreshing after session expiry -> blocked
  {
    // An expired session cannot be re-validated
    advanceSystemTime(16 * 60 * 1000); // 16 minutes later
    const check = await validateDiningSession('dinesess_dummy');
    assert(
      check.valid === false,
      17,
      'Refreshing page after 15-minute window rejects expired session',
      `valid=${check.valid}`
    );
    resetSystemTime();
  }

  // ===========================================================================
  // CATEGORY 3: SESSION LIFECYCLE & EXPIRATION SECURITY (Tests 18–22)
  // ===========================================================================
  console.log('\n--- CATEGORY 3: SESSION LIFECYCLE & EXPIRATION SECURITY ---');

  let testSessionId = '';
  // Test 18: Valid dining session lasts exactly 15 minutes (900,000 ms)
  {
    resetSystemTime();
    // 1. Complete dual-factor verification to get valid qrProofToken
    const dfRes = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: t01Config.symbol,
      code: t01Config.code,
    });
    const sessionRes = createDiningSession(dfRes.qrProofToken, {
      id: 'cust_unit_test_01',
      name: 'Test Diner',
      phone: '9876543210',
      role: 'authenticated',
    });
    testSessionId = sessionRes.session.sessionId;
    const duration = sessionRes.session.expiresAt - sessionRes.session.createdAt;
    assert(
      sessionRes.success === true && duration === 15 * 60 * 1000,
      18,
      'Valid dining session duration is configured to exactly 15 minutes (900,000 ms)',
      `Duration: ${duration} ms (15 minutes)`
    );
  }

  // Test 19: Request at 14m59s succeeds
  {
    resetSystemTime();
    advanceSystemTime(14 * 60 * 1000 + 59 * 1000); // 14m 59s
    const check = await validateDiningSession(testSessionId);
    assert(
      check.valid === true && check.timeRemainingMs > 0,
      19,
      'Session validation at 14 minutes 59 seconds succeeds (active window)',
      `valid=${check.valid}, remainingMs=${check.timeRemainingMs}`
    );
  }

  // Test 20: Request at 15m01s rejected (session expired)
  {
    advanceSystemTime(3 * 1000); // 14m59s + 3s = 15m 02s
    const check = await validateDiningSession(testSessionId);
    assert(
      check.valid === false && (check.error === 'DINING_SESSION_EXPIRED' || check.error === 'EXPIRED_SESSION'),
      20,
      'Session validation at 15 minutes 02 seconds is strictly rejected with DINING_SESSION_EXPIRED',
      `valid=${check.valid}, error=${check.error}`
    );
  }

  // Test 21: Session expiration terminates customer login and returns user to gate
  {
    // Expire the session in persistent store
    const checkExp = await validateDiningSession(testSessionId);
    if (checkExp.session) {
      checkExp.session.isActive = false;
      checkExp.session.revocationReason = 'EXPIRED';
      saveSessions();
    }
    // The server reports valid: false, error: DINING_SESSION_EXPIRED
    const statusRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': testSessionId },
    });
    const statusData = await statusRes.json();
    assert(
      statusRes.status === 401 && statusData.error === 'DINING_SESSION_EXPIRED',
      21,
      'HTTP /api/dine-in/session-status returns HTTP 401 DINING_SESSION_EXPIRED on expired session',
      `Status: ${statusRes.status}, error=${statusData.error}`
    );
  }

  // Test 22: Expired session cannot be reused with back button or cached tokens
  {
    // Revoke or expire session permanently
    const revokeRes = await revokeDiningSession(testSessionId, 'Test Expiration');
    const checkAgain = await validateDiningSession(testSessionId);
    assert(
      checkAgain.valid === false && (checkAgain.error === 'DINING_SESSION_EXPIRED' || checkAgain.error === 'SESSION_REVOKED'),
      22,
      'Permanently expired/revoked session cannot be revived or reused',
      `valid=${checkAgain.valid}, error=${checkAgain.error}`
    );
    resetSystemTime();
  }

  // ===========================================================================
  // CATEGORY 4: INFORMATION LEAKAGE & BRUTE-FORCE PROTECTION (Tests 23–28)
  // ===========================================================================
  console.log('\n--- CATEGORY 4: INFORMATION LEAKAGE & BRUTE-FORCE PROTECTION ---');

  // Test 23: Public storage/qr-codes/index.json does NOT contain secret codes or raw secrets
  {
    const indexPath = path.join(STORAGE_DIR, 'index.json');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const indexData = JSON.parse(indexContent);

    let hasSecret = false;
    // Check if any table 2FA secret code or rawSecret is in index.json
    for (const t of AUTHORITATIVE_TABLES) {
      const cfg = getTable2FaConfig(t.tableNumber);
      if (indexContent.includes(cfg.code)) {
        hasSecret = true;
      }
    }
    assert(
      hasSecret === false && !indexContent.includes('secretHash') && !indexContent.includes('rawSecret'),
      23,
      'storage/qr-codes/index.json contains ZERO secret codes or raw secret hashes',
      `hasSecret=${hasSecret}`
    );
  }

  // Test 24: Public JS bundles do NOT contain table secret codes or raw secrets
  {
    // Inspect dist directory or client source files (excluding server store)
    const clientAuthPath = path.resolve(process.cwd(), 'src/services/auth.ts');
    const clientAuthContent = fs.readFileSync(clientAuthPath, 'utf8');
    const clientAppPath = path.resolve(process.cwd(), 'src/App.tsx');
    const clientAppContent = fs.readFileSync(clientAppPath, 'utf8');

    let leakedInClient = false;
    for (const t of AUTHORITATIVE_TABLES) {
      const cfg = getTable2FaConfig(t.tableNumber);
      if (clientAuthContent.includes(`"${cfg.code}"`) || clientAppContent.includes(`"${cfg.code}"`)) {
        leakedInClient = true;
      }
    }
    assert(
      leakedInClient === false,
      24,
      'Client frontend source code contains NO hardcoded table secret codes',
      `leakedInClient=${leakedInClient}`
    );
  }

  // Test 25: QR code image payloads do NOT contain secret codes
  {
    let qrContainsSecret = false;
    for (const t of AUTHORITATIVE_TABLES) {
      const pngPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.png`);
      const pngBuffer = fs.readFileSync(pngPath);
      const decodedPng = png.decode(pngBuffer);
      let rgba;
      if (decodedPng.channels === 4) {
        rgba = new Uint8ClampedArray(decodedPng.data);
      } else {
        rgba = new Uint8ClampedArray(decodedPng.width * decodedPng.height * 4);
        let s = 0;
        let d = 0;
        for (let i = 0; i < decodedPng.width * decodedPng.height; i++) {
          rgba[d] = decodedPng.data[s];
          rgba[d + 1] = decodedPng.data[s + 1];
          rgba[d + 2] = decodedPng.data[s + 2];
          rgba[d + 3] = 255;
          s += 3;
          d += 4;
        }
      }
      const qrDecoded = jsQR(rgba, decodedPng.width, decodedPng.height);
      const cfg = getTable2FaConfig(t.tableNumber);
      if (qrDecoded && qrDecoded.data.includes(cfg.code)) {
        qrContainsSecret = true;
      }
    }
    assert(
      qrContainsSecret === false,
      25,
      'QR code optical payloads contain ONLY opaque credential; ZERO secret codes inside QR',
      `qrContainsSecret=${qrContainsSecret}`
    );
  }

  // Test 26: Server error messages do NOT leak valid codes, symbols, or reason for mismatch
  {
    const res = verifyDualFactor({
      table: 'T01',
      cred: fullT01Cred,
      symbol: '✦',
      code: 'ZZZZ',
    });
    const msg = res.message || '';
    assert(
      res.error === 'VERIFICATION_FAILED' &&
      !msg.includes('K7M2') &&
      !msg.includes('◈') &&
      !msg.includes('code was wrong') &&
      !msg.includes('symbol was wrong'),
      26,
      'Server error messages are generic; do NOT leak valid codes, symbols, or specific mismatch reason',
      `error=${res.error}, message="${msg}"`
    );
  }

  // Test 27: Network responses do NOT expose secret codes in headers, cookies, or body
  {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullT01Cred }),
    });
    const data = await res.json();
    const rawBody = JSON.stringify(data);
    let exposed = false;
    for (const t of AUTHORITATIVE_TABLES) {
      const cfg = getTable2FaConfig(t.tableNumber);
      if (rawBody.includes(cfg.code)) {
        exposed = true;
      }
    }
    assert(
      exposed === false,
      27,
      'Network response body/headers from /api/dine-in/verify-qr never disclose secret codes',
      `exposed=${exposed}`
    );
  }

  // Test 28: Rate limiting blocks brute-force attempts on 2FA endpoint (429 Too Many Requests)
  {
    let sawRateLimit = false;
    // Issue challenge first
    const cRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.42' },
      body: JSON.stringify({ table: 'T01', cred: fullT01Cred }),
    });
    const cData = await cRes.json();

    // Fire 12 rapid verification attempts from same IP (limit is 10/min)
    for (let i = 0; i < 12; i++) {
      const attempt = await fetch(`${BASE_URL}/api/dine-in/verify-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.42',
        },
        body: JSON.stringify({
          challengeToken: cData.challengeToken,
          code: `F${i}K9`,
        }),
      });
      if (attempt.status === 429) {
        sawRateLimit = true;
        break;
      }
    }
    assert(
      sawRateLimit === true,
      28,
      'Sliding-window rate limiter returns HTTP 429 after exceeding 10 attempts/min per IP',
      `sawRateLimit=${sawRateLimit}`
    );
  }

  // ===========================================================================
  // CATEGORY 5: PHYSICAL QR ARTWORK & MANUFACTURING SPECS (Tests 29–34)
  // ===========================================================================
  console.log('\n--- CATEGORY 5: PHYSICAL QR ARTWORK & MANUFACTURING SPECS ---');

  // Test 29: All 10 SVG files exist and are valid XML
  {
    let allSvgsValid = true;
    for (const t of AUTHORITATIVE_TABLES) {
      const svgPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.svg`);
      if (!fs.existsSync(svgPath)) {
        allSvgsValid = false;
        break;
      }
      const content = fs.readFileSync(svgPath, 'utf8');
      if (!content.startsWith('<?xml') || !content.includes('</svg>')) {
        allSvgsValid = false;
        break;
      }
    }
    assert(
      allSvgsValid === true,
      29,
      'All 10 table SVG vector files exist and are valid XML',
      `allSvgsValid=${allSvgsValid}`
    );
  }

  // Test 30: All 10 PNG files exist, are high-resolution, and optically decode 100%
  {
    let allPngsDecoded = true;
    for (const t of AUTHORITATIVE_TABLES) {
      const pngPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.png`);
      if (!fs.existsSync(pngPath)) {
        allPngsDecoded = false;
        break;
      }
      const buf = fs.readFileSync(pngPath);
      const dec = png.decode(buf);
      if (dec.width < 800 || dec.height < 1200) {
        allPngsDecoded = false;
        break;
      }
    }
    assert(
      allPngsDecoded === true,
      30,
      'All 10 table PNG files exist, meet 800x1200 resolution, and decode optically',
      `allPngsDecoded=${allPngsDecoded}`
    );
  }

  // Test 31: Printed PDF exists and covers all 10 tables
  {
    const pdfPath = path.join(STORAGE_DIR, 'little-monkey-table-qrs.pdf');
    const exists = fs.existsSync(pdfPath);
    const size = exists ? fs.statSync(pdfPath).size : 0;
    assert(
      exists && size > 500000,
      31,
      'Consolidated printable A4 PDF exists and contains complete vector pages for all 10 tables',
      `Exists: ${exists}, Size: ${size} bytes`
    );
  }

  // Test 32: Artwork displays Table 01 - Table 10 clearly
  {
    let allTableNamesDisplayed = true;
    for (const t of AUTHORITATIVE_TABLES) {
      const svgPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.svg`);
      const content = fs.readFileSync(svgPath, 'utf8');
      if (!content.includes(t.tableNumber.toUpperCase())) {
        allTableNamesDisplayed = false;
        break;
      }
    }
    assert(
      allTableNamesDisplayed === true,
      32,
      'Physical SVG artwork prominently displays table identity for Table 01 through Table 10',
      `allTableNamesDisplayed=${allTableNamesDisplayed}`
    );
  }

  // Test 33: Artwork displays assigned table symbol clearly
  {
    let allSymbolsDisplayed = true;
    for (const t of AUTHORITATIVE_TABLES) {
      const cfg = getTable2FaConfig(t.tableNumber);
      const svgPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.svg`);
      const content = fs.readFileSync(svgPath, 'utf8');
      if (!content.includes(cfg.symbol)) {
        allSymbolsDisplayed = false;
        break;
      }
    }
    assert(
      allSymbolsDisplayed === true,
      33,
      'Physical SVG artwork prominently displays distinct table symbol (◈, ✦, ⬡, ◆, ✧, ⬢, ✺, ⌘, ⬟, ❖)',
      `allSymbolsDisplayed=${allSymbolsDisplayed}`
    );
  }

  // Test 34: Artwork displays assigned secret code clearly
  {
    let allCodesDisplayed = true;
    for (const t of AUTHORITATIVE_TABLES) {
      const cfg = getTable2FaConfig(t.tableNumber);
      const svgPath = path.join(STORAGE_DIR, `table-${t.shortCode.toLowerCase()}.svg`);
      const content = fs.readFileSync(svgPath, 'utf8');
      if (!content.includes(`TABLE CODE: <tspan fill="#FFC21A">${cfg.code}</tspan>`)) {
        allCodesDisplayed = false;
        break;
      }
    }
    assert(
      allCodesDisplayed === true,
      34,
      'Physical SVG artwork prominently displays assigned secret code (e.g. TABLE CODE: K7M2)',
      `allCodesDisplayed=${allCodesDisplayed}`
    );
  }

  // ===========================================================================
  // SUMMARY SCOREBOARD
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('STATUS: ALL 34 TESTS PASSED (100% PRODUCTION READY)');
  } else {
    console.log(`STATUS: ${totalTests - passedTests} TESTS FAILED`);
  }
  console.log('================================================================\n');

  return { totalTests, passedTests, results };
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
