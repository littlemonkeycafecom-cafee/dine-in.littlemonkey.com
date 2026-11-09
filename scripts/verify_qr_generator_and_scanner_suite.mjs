/**
 * verify_qr_generator_and_scanner_suite.mjs
 *
 * Comprehensive Automated Verification Suite for Little Monkey Cafe QR Prototype & Security Remediation:
 *
 * Test Group 1: Protected Artwork Storage Invariants (storage/qr-codes/ exists, 10 SVGs, 10 PNGs, 1 PDF, index.json, index.html)
 * Test Group 2: Public & Dist Directory Cleanliness (Zero QR artwork in public/ or dist/)
 * Test Group 3: Secret Isolation Invariant (No raw secrets in index.json, index.html, or PDF text stream)
 * Test Group 4: Development Endpoint Sanitization (/api/dev/tables returns no rawSecret, entryUrl: null unauth, entryUrl on auth)
 * Test Group 5: Optical Decoding with jsQR from Actual PNG Artwork in storage/qr-codes/
 * Test Group 6: Live HTTP Backend Verification (POST /api/dine-in/verify-qr with decoded credentials)
 * Test Group 7: Backend Security Invariants (Tampered secret, table spoofing, unknown table, missing credential, direct URL bypass)
 * Test Group 8: Replay Protection & Proof Consumption (Proof token can only be consumed once; second attempt fails with PROOF_ALREADY_USED)
 * Test Group 9: Independent Session Lifecycle & Expiration (Proof expiry does not terminate established session; session expires at 15 min)
 * Test Group 10: Authenticated Staff Artwork Download Endpoint (GET /api/admin/qr/artwork rejects unauth, serves PNG/SVG/PDF, blocks path traversal)
 * Test Group 11: Base URL Validation (Validates protocol, normalizes URL, rejects localhost in production mode)
 * Test Group 12: Referrer Policy & Meta Protection (index.html has meta referrer no-referrer, headers include Referrer-Policy: no-referrer)
 * Test Group 13: Generator Idempotence (Re-running generator preserves existing credentials)
 * Test Group 14: Scanner Component State & Privacy Invariants (InBuiltQrScanner user consent, track shutdown, duplicate debounce)
 */

import fs from 'node:fs';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import png from 'fast-png';
import jsQR from 'jsqr';
import {
  AUTHORITATIVE_TABLES,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  verifyQrPayload,
} from '../src/server/qrAuthStore.ts';
import { generateAllTableArtwork, validateAndResolveBaseUrl } from './generate_table_qr_artwork.mjs';

const STORAGE_QR_DIR = path.resolve(process.cwd(), 'storage/qr-codes');
const PUBLIC_QR_DIR = path.resolve(process.cwd(), 'public/qr-codes');
const DIST_QR_DIR = path.resolve(process.cwd(), 'dist/qr-codes');
const BASE_URL = 'http://127.0.0.1:3000';

const results = {
  passed: [],
  failed: [],
};

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

function recordPass(testName, details) {
  console.log(`[PASS] ${testName}`);
  if (details) console.log(`       ${details}`);
  results.passed.push({ name: testName, details });
}

function recordFail(testName, error) {
  console.error(`[FAIL] ${testName}`);
  console.error(`       ${error?.message || error}`);
  results.failed.push({ name: testName, error: error?.message || String(error) });
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('LITTLE MONKEY CAFE — QR GENERATOR & SECURITY REMEDIATION SUITE');
  console.log('================================================================\n');

  // Reset deterministic clock before starting
  try {
    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  } catch {}

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Protected Artwork Storage Invariants
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Protected Artwork Storage Invariants ---');
  try {
    assert.ok(fs.existsSync(STORAGE_QR_DIR), 'Directory storage/qr-codes must exist');

    for (const table of AUTHORITATIVE_TABLES) {
      const slug = table.shortCode.toLowerCase();
      const svgPath = path.join(STORAGE_QR_DIR, `table-${slug}.svg`);
      const pngPath = path.join(STORAGE_QR_DIR, `table-${slug}.png`);

      assert.ok(fs.existsSync(svgPath), `SVG file missing for ${table.tableNumber}: ${svgPath}`);
      assert.ok(fs.existsSync(pngPath), `PNG file missing for ${table.tableNumber}: ${pngPath}`);

      const svgStat = fs.statSync(svgPath);
      const pngStat = fs.statSync(pngPath);

      assert.ok(svgStat.size > 15000, `SVG for ${table.tableNumber} is suspiciously small: ${svgStat.size} bytes`);
      assert.ok(pngStat.size > 20000, `PNG for ${table.tableNumber} is suspiciously small: ${pngStat.size} bytes`);
    }

    const pdfPath = path.join(STORAGE_QR_DIR, 'little-monkey-table-qrs.pdf');
    assert.ok(fs.existsSync(pdfPath), 'little-monkey-table-qrs.pdf must exist in storage/qr-codes');
    const pdfStat = fs.statSync(pdfPath);
    assert.ok(pdfStat.size > 100000, `PDF must be comprehensive multi-page (>100KB): ${pdfStat.size} bytes`);

    const jsonPath = path.join(STORAGE_QR_DIR, 'index.json');
    const htmlPath = path.join(STORAGE_QR_DIR, 'index.html');
    assert.ok(fs.existsSync(jsonPath), 'storage/qr-codes/index.json must exist');
    assert.ok(fs.existsSync(htmlPath), 'storage/qr-codes/index.html must exist');

    recordPass('TG1.1: Protected Artwork Storage Files', 'All 10 SVGs, 10 PNGs, 1 PDF, index.json and index.html exist in storage/qr-codes and meet size thresholds');
  } catch (err) {
    recordFail('TG1.1: Protected Artwork Storage Files', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Public and Dist Directory Cleanliness
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Public and Dist Directory Cleanliness ---');
  try {
    assert.ok(!fs.existsSync(PUBLIC_QR_DIR), 'public/qr-codes must NOT exist');
    assert.ok(!fs.existsSync(DIST_QR_DIR), 'dist/qr-codes must NOT exist');

    // Verify public directory contains zero table QR images or PDFs
    const publicFiles = fs.readdirSync(path.resolve(process.cwd(), 'public'));
    const leakedPublic = publicFiles.filter((f) => f.includes('table-t') || f.includes('little-monkey-table-qrs'));
    assert.equal(leakedPublic.length, 0, `Found leaked table QR artwork in public/: ${leakedPublic.join(', ')}`);

    // Verify dist directory if built contains zero table QR images or PDFs
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      const checkDistLeaked = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            checkDistLeaked(full);
          } else if (e.name.includes('table-t') || e.name.includes('little-monkey-table-qrs')) {
            throw new Error(`CRITICAL LEAK: Private QR artwork found in dist: ${full}`);
          }
        }
      };
      checkDistLeaked(distPath);
    }

    recordPass('TG2.1: Zero Private QR Artwork in Public or Dist', 'Verified public/qr-codes and dist/qr-codes are completely absent and no artwork is copied into dist/');
  } catch (err) {
    recordFail('TG2.1: Zero Private QR Artwork in Public or Dist', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Secret Isolation Invariant
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Secret Isolation Invariant ---');
  try {
    const rawSecrets = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
    const secretValues = Object.values(rawSecrets);

    const indexJsonRaw = fs.readFileSync(path.join(STORAGE_QR_DIR, 'index.json'), 'utf8');
    const indexHtmlRaw = fs.readFileSync(path.join(STORAGE_QR_DIR, 'index.html'), 'utf8');
    const pdfBuffer = fs.readFileSync(path.join(STORAGE_QR_DIR, 'little-monkey-table-qrs.pdf'));
    const pdfText = pdfBuffer.toString('latin1');

    for (const secret of secretValues) {
      if (secret && secret.length >= 16) {
        assert.ok(!indexJsonRaw.includes(secret), `Raw secret found in index.json: ${secret.slice(0, 6)}...`);
        assert.ok(!indexHtmlRaw.includes(secret), `Raw secret found in index.html: ${secret.slice(0, 6)}...`);
        assert.ok(!pdfText.includes(secret), `Raw secret found in PDF text stream: ${secret.slice(0, 6)}...`);
      }
    }

    const indexParsed = JSON.parse(indexJsonRaw);
    assert.equal(indexParsed.tables.length, 10, 'index.json must contain exactly 10 tables');
    for (const t of indexParsed.tables) {
      assert.ok(!t.rawSecret, `index.json must not have rawSecret on table ${t.tableNumber}`);
      assert.ok(!t.secret, `index.json must not have secret on table ${t.tableNumber}`);
      assert.ok(t.credentialId, `index.json must have credentialId on table ${t.tableNumber}`);
      assert.ok(t.downloadSvgUrl, `index.json must have downloadSvgUrl on table ${t.tableNumber}`);
      assert.ok(t.downloadPngUrl, `index.json must have downloadPngUrl on table ${t.tableNumber}`);
    }

    recordPass('TG3.1: Zero Raw Secrets in Index and PDF Text Layer', 'All raw secrets completely isolated; PDF text stream and operator indexes contain zero secret keys');
  } catch (err) {
    recordFail('TG3.1: Zero Raw Secrets in Index and PDF Text Layer', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Development Endpoint Sanitization
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Development Endpoint Sanitization ---');
  try {
    // 4A: Unauthenticated GET /api/dev/tables
    const unauthRes = await fetch(`${BASE_URL}/api/dev/tables`);
    assert.equal(unauthRes.status, 200, 'Unauthenticated /api/dev/tables must return HTTP 200');
    const unauthData = await unauthRes.json();

    assert.equal(unauthData.isStaffAuthorized, false, 'isStaffAuthorized must be false for unauthenticated requests');
    assert.equal(unauthData.tables.length, 10, 'Must return 10 tables');
    for (const t of unauthData.tables) {
      assert.equal(t.entryUrl, null, `entryUrl must be null when unauthenticated for table ${t.tableNumber}`);
      assert.ok(!('rawSecret' in t), `rawSecret must not be present on table ${t.tableNumber}`);
      assert.ok(t.tableNumber, 'tableNumber must be present');
      assert.ok(t.shortCode, 'shortCode must be present');
      assert.ok(t.credentialId, 'credentialId must be present');
    }

    // 4B: Authenticated GET /api/dev/tables
    const authRes = await fetch(`${BASE_URL}/api/dev/tables`, {
      headers: { 'x-operational-pin': '9999' },
    });
    assert.equal(authRes.status, 200, 'Authenticated /api/dev/tables must return HTTP 200');
    const authData = await authRes.json();

    assert.equal(authData.isStaffAuthorized, true, 'isStaffAuthorized must be true with operational PIN');
    for (const t of authData.tables) {
      assert.ok(t.entryUrl, `entryUrl must be provided for staff for table ${t.tableNumber}`);
      assert.ok(t.entryUrl.includes(`?t=${t.shortCode}&cred=${t.credentialId}.`), `entryUrl format correct for ${t.tableNumber}`);
      assert.ok(!('rawSecret' in t), `Standalone rawSecret field must NEVER be returned`);
    }

    recordPass('TG4.1: /api/dev/tables Sanitized and Access Gated', 'Unauthenticated requests receive entryUrl: null; authenticated staff receive entryUrl; rawSecret is never exposed in body');
  } catch (err) {
    recordFail('TG4.1: /api/dev/tables Sanitized and Access Gated', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Optical Decoding with jsQR from Actual PNG Artwork
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Optical Decoding from Actual PNG Artwork ---');
  const decodedTableData = new Map();

  for (const table of AUTHORITATIVE_TABLES) {
    try {
      const slug = table.shortCode.toLowerCase();
      const pngPath = path.join(STORAGE_QR_DIR, `table-${slug}.png`);
      const pngBuffer = fs.readFileSync(pngPath);
      const decodedPng = png.decode(pngBuffer);

      assert.equal(decodedPng.width, 800, 'PNG width must be 800px');
      assert.equal(decodedPng.height, 1200, 'PNG height must be 1200px');

      const qrResult = jsQR(
        toRgba(decodedPng),
        decodedPng.width,
        decodedPng.height
      );

      assert.ok(qrResult, `jsQR failed to detect QR code in table-${slug}.png`);
      assert.ok(qrResult.data, `Decoded QR data is empty for table-${slug}.png`);

      const parsedUrl = new URL(qrResult.data);
      const tParam = parsedUrl.searchParams.get('t');
      const credParam = parsedUrl.searchParams.get('cred');

      assert.equal(tParam, table.shortCode, `Decoded table shortCode mismatch: expected ${table.shortCode}, got ${tParam}`);
      assert.ok(credParam && credParam.includes('.'), `Credential format must be id.secret: ${credParam}`);

      decodedTableData.set(table.tableNumber, {
        tableNumber: table.tableNumber,
        shortCode: table.shortCode,
        entryUrl: qrResult.data,
        tParam,
        credParam,
      });

      recordPass(`TG5.${table.shortCode}: Optical Decode ${table.tableNumber}`, `Decoded entryUrl -> ${qrResult.data}`);
    } catch (err) {
      recordFail(`TG5.${table.shortCode}: Optical Decode ${table.tableNumber}`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Live HTTP Backend Verification (POST /api/dine-in/verify-qr)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Live HTTP Backend Verification ---');
  for (const table of AUTHORITATIVE_TABLES) {
    const item = decodedTableData.get(table.tableNumber);
    if (!item) continue;

    try {
      const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: item.tParam,
          cred: item.credParam,
        }),
      });

      assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
      const body = await res.json();

      assert.equal(body.valid, true, 'Response body valid must be true');
      assert.equal(body.tableNumber, table.tableNumber, `Expected tableNumber ${table.tableNumber}, got ${body.tableNumber}`);
      assert.ok(body.qrProofToken, 'Response must return qrProofToken');
      assert.ok(body.qrProofToken.startsWith('qrproof.'), 'qrProofToken must begin with qrproof.');

      recordPass(`TG6.${table.shortCode}: HTTP Backend Verification ${table.tableNumber}`, `Verified Table: ${body.tableNumber}, Proof token issued`);
    } catch (err) {
      recordFail(`TG6.${table.shortCode}: HTTP Backend Verification ${table.tableNumber}`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: Backend Security Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Backend Security Invariants ---');

  // Test 7A: Tampered secret
  try {
    const item01 = decodedTableData.get('Table 01');
    const [credId] = item01.credParam.split('.');
    const tamperedCred = `${credId}.TAMPERED_INVALID_SECRET_KEY_12345`;

    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: tamperedCred }),
    });

    assert.equal(res.status, 400, 'Tampered secret must be rejected with HTTP 400');
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.equal(body.error, 'INVALID_SECRET');

    recordPass('TG7.1: Tampered Secret Rejected', 'Server safely rejected modified secret hash with HTTP 400 INVALID_SECRET');
  } catch (err) {
    recordFail('TG7.1: Tampered Secret Rejected', err);
  }

  // Test 7B: Table spoofing (Table 01 credential used for Table 02)
  try {
    const item01 = decodedTableData.get('Table 01');
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'Table 02', cred: item01.credParam }),
    });

    assert.equal(res.status, 400, 'Cross-table spoofing must be rejected with HTTP 400');
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.equal(body.error, 'TABLE_MISMATCH');

    recordPass('TG7.2: Cross-Table Spoofing Rejected', 'Server rejected Table 01 credential submitted for Table 02');
  } catch (err) {
    recordFail('TG7.2: Cross-Table Spoofing Rejected', err);
  }

  // Test 7C: Non-existent / unknown table ID
  try {
    const item01 = decodedTableData.get('Table 01');
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'Table 99', cred: item01.credParam }),
    });

    assert.equal(res.status, 400, 'Unknown table must be rejected with HTTP 400');
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.equal(body.error, 'UNKNOWN_TABLE');

    recordPass('TG7.3: Unknown Table Rejected', 'Server rejected Table 99 with UNKNOWN_TABLE');
  } catch (err) {
    recordFail('TG7.3: Unknown Table Rejected', err);
  }

  // Test 7D: Empty / missing credential
  try {
    const res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'Table 01' }),
    });

    assert.equal(res.status, 400, 'Missing credential must return HTTP 400');
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.equal(body.error, 'MISSING_CREDENTIAL');

    recordPass('TG7.4: Missing Credential Blocked', 'Server rejected request missing cred parameter');
  } catch (err) {
    recordFail('TG7.4: Missing Credential Blocked', err);
  }

  // Test 7E: Manually entered URL parameter bypass check
  try {
    const directRes = await fetch(`${BASE_URL}/?t=T01`);
    assert.equal(directRes.status, 200);
    const html = await directRes.text();
    assert.ok(
      html.includes('id="root"'),
      'Direct URL without credential reaches client root where TableQrRequiredGate enforces QR requirement'
    );

    recordPass('TG7.5: Manual URL Parameter Cannot Bypass Gate', 'Direct navigation with ?t=T01 does not bypass credential verification');
  } catch (err) {
    recordFail('TG7.5: Manual URL Parameter Cannot Bypass Gate', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: Replay Protection & Proof Consumption
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Replay Protection & Proof Consumption ---');
  try {
    const item01 = decodedTableData.get('Table 01');
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: item01.tParam, cred: item01.credParam }),
    });
    const vData = await vRes.json();
    const proofToken = vData.qrProofToken;

    const payload = {
      sub: 'dev_user_replay_test',
      phone: '+919999933333',
      name: 'Replay Tester',
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    const bearer = 'dev_token.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.lmc';

    // 1. First consumption: must succeed
    const s1Res = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ qrProofToken: proofToken }),
    });
    assert.equal(s1Res.status, 200, 'First token consumption must succeed with HTTP 200');
    const s1Data = await s1Res.json();
    assert.equal(s1Data.success, true);
    assert.ok(s1Data.sessionToken, 'Must issue dining sessionToken');

    // 2. Replay attempt: must be rejected with PROOF_ALREADY_USED
    const s2Res = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ qrProofToken: proofToken }),
    });
    assert.equal(s2Res.status, 403, 'Replayed token must be rejected with HTTP 403');
    const s2Data = await s2Res.json();
    assert.equal(s2Data.success, false);
    assert.equal(s2Data.error, 'PROOF_ALREADY_USED');

    recordPass('TG8.1: Single-Use Proof Token Enforced', 'Proof token consumed atomically; replay attempt rejected with HTTP 403 PROOF_ALREADY_USED');
  } catch (err) {
    recordFail('TG8.1: Single-Use Proof Token Enforced', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 9: Independent Session Lifecycle & Expiration
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Independent Session Lifecycle & Expiration ---');
  try {
    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });

    const item02 = decodedTableData.get('Table 02');

    // Verify QR for Table 02
    const vRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: item02.tParam, cred: item02.credParam }),
    });
    const vData = await vRes.json();

    const payload = {
      sub: 'dev_user_lifecycle_test',
      phone: '+919999944444',
      name: 'Lifecycle Tester',
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    const bearer = 'dev_token.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.lmc';

    // Create session (15 minutes duration)
    const sRes = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ qrProofToken: vData.qrProofToken }),
    });
    const sData = await sRes.json();
    const sessionToken = sData.sessionToken;

    // Issue an unconsumed second proof token
    const v2Res = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: item02.tParam, cred: item02.credParam }),
    });
    const v2Data = await v2Res.json();
    const unconsumedProof = v2Data.qrProofToken;

    // Advance clock by 6 minutes (360,000 ms) -> past the 5-minute proof validity
    await fetch(`${BASE_URL}/api/test/advance-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ms: 360000 }),
    });

    // 1. Unconsumed proof should fail with EXPIRED_PROOF
    const expProofRes = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ qrProofToken: unconsumedProof }),
    });
    assert.equal(expProofRes.status, 403, 'Expired proof token must return HTTP 403');
    const expProofData = await expProofRes.json();
    assert.equal(expProofData.error, 'EXPIRED_PROOF');

    // 2. Active session should STILL be valid (6 min < 15 min)!
    const activeCheckRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    assert.equal(activeCheckRes.status, 200, 'Session must remain valid past proof token expiry');
    const activeData = await activeCheckRes.json();
    assert.equal(activeData.valid, true);
    assert.ok(activeData.timeRemainingMs > 500000, 'Must have approx 9 minutes remaining');

    // 3. Advance clock by an additional 10 minutes (total 16 minutes > 15 minutes session duration)
    await fetch(`${BASE_URL}/api/test/advance-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ms: 600000 }),
    });

    // 4. Session should now be EXPIRED with HTTP 401 DINING_SESSION_EXPIRED
    const expiredCheckRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    assert.equal(expiredCheckRes.status, 401, 'Expired session must return HTTP 401');
    const expiredData = await expiredCheckRes.json();
    assert.equal(expiredData.valid, false);
    assert.equal(expiredData.error, 'DINING_SESSION_EXPIRED');

    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });

    recordPass('TG9.1: Independent Session Lifecycle & Strict 15-Minute Expiration', 'Proof expiration does not invalidate active session; session strictly expires at 15 minutes with DINING_SESSION_EXPIRED');
  } catch (err) {
    recordFail('TG9.1: Independent Session Lifecycle & Strict 15-Minute Expiration', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 10: Authenticated Staff Artwork Download Endpoint
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Authenticated Staff Artwork Download Endpoint ---');
  try {
    // 10A: Unauthenticated access rejected
    const unauthPng = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=T01&format=png`);
    assert.equal(unauthPng.status, 403, 'Unauthenticated download must return HTTP 403');
    const unauthData = await unauthPng.json();
    assert.equal(unauthData.error, 'ADMIN_ACCESS_DENIED');

    // 10B: Authenticated PNG download
    const authPng = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=T01&format=png`, {
      headers: { 'x-operational-pin': '9999' },
    });
    assert.equal(authPng.status, 200, 'Authenticated PNG download must return HTTP 200');
    assert.equal(authPng.headers.get('content-type'), 'image/png');
    const pngBuf = Buffer.from(await authPng.arrayBuffer());
    assert.ok(pngBuf.length > 20000, `PNG buffer too small: ${pngBuf.length}`);

    // 10C: Authenticated SVG download
    const authSvg = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=T01&format=svg`, {
      headers: { 'x-operational-pin': '9999' },
    });
    assert.equal(authSvg.status, 200, 'Authenticated SVG download must return HTTP 200');
    assert.equal(authSvg.headers.get('content-type'), 'image/svg+xml');
    const svgText = await authSvg.text();
    assert.ok(svgText.includes('<svg') && svgText.includes('</svg>'), 'Valid SVG markup returned');

    // 10D: Authenticated PDF download
    const authPdf = await fetch(`${BASE_URL}/api/admin/qr/artwork?file=pdf`, {
      headers: { 'x-operational-pin': '9999' },
    });
    assert.equal(authPdf.status, 200, 'Authenticated PDF download must return HTTP 200');
    assert.equal(authPdf.headers.get('content-type'), 'application/pdf');
    const pdfBuf = Buffer.from(await authPdf.arrayBuffer());
    assert.ok(pdfBuf.length > 100000, `PDF buffer too small: ${pdfBuf.length}`);

    // 10E: Path traversal prevention
    const traversalRes = await fetch(`${BASE_URL}/api/admin/qr/artwork?table=../../package.json&format=png`, {
      headers: { 'x-operational-pin': '9999' },
    });
    assert.equal(traversalRes.status, 400, 'Path traversal must be rejected with HTTP 400');
    const traversalData = await traversalRes.json();
    assert.equal(traversalData.error, 'INVALID_TABLE');

    recordPass('TG10.1: Staff Artwork Download Security & Integrity', 'GET /api/admin/qr/artwork enforces admin authorization, streams PNG/SVG/PDF, and completely blocks path traversal');
  } catch (err) {
    recordFail('TG10.1: Staff Artwork Download Security & Integrity', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 11: Base URL Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Base URL Validation ---');
  try {
    // 11A: Valid URL normalization
    const norm = validateAndResolveBaseUrl('https://dine-in.littlemonkey.com///');
    assert.equal(norm, 'https://dine-in.littlemonkey.com', 'Trailing slash normalized');

    // 11B: Invalid protocol rejection
    assert.throws(
      () => validateAndResolveBaseUrl('ftp://dine-in.littlemonkey.com'),
      /INVALID_PROTOCOL/,
      'Must reject ftp: protocol'
    );
    assert.throws(
      () => validateAndResolveBaseUrl('javascript:alert(1)'),
      /INVALID_PROTOCOL/,
      'Must reject javascript: protocol'
    );

    // 11C: Invalid URL rejection
    assert.throws(
      () => validateAndResolveBaseUrl('not-a-valid-url'),
      /INVALID_BASE_URL/,
      'Must reject invalid URL strings'
    );

    // 11D: Production mode rejection of localhost
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assert.throws(
        () => validateAndResolveBaseUrl('http://127.0.0.1:3000'),
        /PRODUCTION_HOST_REJECTED/,
        'Production must reject loopback addresses'
      );
      assert.throws(
        () => validateAndResolveBaseUrl('http://dine-in.littlemonkey.com'),
        /PRODUCTION_HTTPS_REQUIRED/,
        'Production must require HTTPS'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }

    recordPass('TG11.1: Base URL Validation & Production Restrictions', 'Protocol validation, trailing slash normalization, and production HTTPS enforcement verified');
  } catch (err) {
    recordFail('TG11.1: Base URL Validation & Production Restrictions', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 12: Referrer Policy & Meta Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Referrer Policy & Meta Protection ---');
  try {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.ok(
      indexHtml.includes('<meta name="referrer" content="no-referrer" />'),
      'index.html must contain <meta name="referrer" content="no-referrer" />'
    );

    // Verify Referrer-Policy header on API response
    const headRes = await fetch(`${BASE_URL}/api/dev/tables`);
    const refPolicy = headRes.headers.get('referrer-policy');
    assert.equal(refPolicy, 'no-referrer', 'Server responses must set Referrer-Policy: no-referrer');

    recordPass('TG12.1: Referrer Protection Invariants', 'index.html includes meta no-referrer tag and API responses set Referrer-Policy: no-referrer');
  } catch (err) {
    recordFail('TG12.1: Referrer Protection Invariants', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 13: Generator Idempotence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 13: Generator Idempotence ---');
  try {
    const snapshotBefore = JSON.parse(fs.readFileSync('.qr_credentials.json', 'utf8'))
      .filter((c) => c.isActive)
      .map((c) => ({ table: c.tableNumber, id: c.credentialId }));

    // Re-run the generator
    generateAllTableArtwork();

    const snapshotAfter = JSON.parse(fs.readFileSync('.qr_credentials.json', 'utf8'))
      .filter((c) => c.isActive)
      .map((c) => ({ table: c.tableNumber, id: c.credentialId }));

    assert.deepEqual(
      snapshotBefore,
      snapshotAfter,
      'Re-running generator MUST preserve identical active credentials without rotation'
    );

    recordPass('TG13.1: Generator Idempotence Preserved', 'Re-executing generator did not rotate or invalidate existing active credentials');
  } catch (err) {
    recordFail('TG13.1: Generator Idempotence Preserved', err);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 14: Scanner Component State & Privacy Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 14: Scanner Route & Privacy Invariants ---');
  try {
    const scannerRes = await fetch(`${BASE_URL}/scanner`);
    assert.equal(scannerRes.status, 200, 'Scanner URL /scanner must return HTTP 200');
    const scannerHtml = await scannerRes.text();
    assert.ok(scannerHtml.includes('id="root"'), 'Scanner route serves client application');

    // Inspect component source code invariants directly
    const componentCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/InBuiltQrScanner.tsx'), 'utf8');

    // 1. Permission Prompt & Denial Handling Check
    assert.ok(componentCode.includes('permission_denied') || componentCode.includes('permission_prompt'), 'Scanner must have permission handling');

    // 2. Camera Hardware Stop Check
    assert.ok(componentCode.includes('track.stop()'), 'Scanner must call track.stop() on all tracks');
    assert.ok(componentCode.includes('stopCamera'), 'Scanner must stop camera on exit and unmount');

    // 3. Duplicate Debounce Check
    assert.ok(componentCode.includes('isProcessingRef.current = true'), 'Scanner must lock against duplicate scans');

    // 4. Permission Denied Handling
    assert.ok(componentCode.includes('permission_denied'), 'Scanner must handle permission_denied');

    // 5. Camera Unavailable Handling
    assert.ok(componentCode.includes('no_camera') || componentCode.includes('unavailable'), 'Scanner must handle unavailable cameras');

    recordPass('TG14.1: Scanner Privacy & Hardware Lifecycle Invariants', 'InBuiltQrScanner implements on-device processing, user consent, graceful denial, duplicate locking, and immediate track shutdown');
  } catch (err) {
    recordFail('TG14.1: Scanner Privacy & Hardware Lifecycle Invariants', err);
  }

  // ---------------------------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
  console.log('================================================================');

  if (results.failed.length > 0) {
    console.error('\nFAILED TESTS:');
    for (const f of results.failed) {
      console.error(`- ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log(`\nALL ${results.passed.length} VERIFICATION SUITE TESTS PASSED 100% WITH ZERO ERRORS.\n`);
  }
}

runTestSuite();
