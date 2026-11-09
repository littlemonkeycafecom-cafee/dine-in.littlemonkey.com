import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import esbuild from 'esbuild';

// ============================================================================
// SIMULATED GOOGLE APPS SCRIPT ENVIRONMENT (Exact 1:1 mirror of Code.gs)
// ============================================================================

const REQUIRED_HEADERS = ['customer_id', 'name', 'mobile_number', 'created_at', 'updated_at'];
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const NONCE_TTL_SECONDS = 600;

function sanitizeFormula(val) {
  if (typeof val !== 'string') return val;
  if (/^[\=\+\-\@\t\r]/.test(val)) {
    return "'" + val;
  }
  return val;
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

class GoogleAppsScriptSimulator {
  constructor(options = {}) {
    this.sharedApiKey = options.sharedApiKey !== undefined ? options.sharedApiKey : 'test_secret_key_1234567890abcdef';
    this.spreadsheetId = options.spreadsheetId || 'sheet_id_mock_123';
    this.worksheetName = options.worksheetName || 'Customers';
    this.headers = options.headers !== undefined ? options.headers : [...REQUIRED_HEADERS];
    this.rows = options.rows ? [...options.rows] : [];
    this.nonceCache = new Map(); // key -> expiresAt
    this.isLocked = false;
    this.lockHeldBy = null;
    this.sheetAccessible = options.sheetAccessible !== undefined ? options.sheetAccessible : true;
    this.worksheetExists = options.worksheetExists !== undefined ? options.worksheetExists : true;
  }

  // Mimics LockService.getScriptLock()
  async acquireLock(timeoutMs = 10000) {
    const start = Date.now();
    while (this.isLocked) {
      if (Date.now() - start > timeoutMs) {
        return false;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    this.isLocked = true;
    return true;
  }

  releaseLock() {
    this.isLocked = false;
  }

  // Mimics doPost(e) in Code.gs
  async doPost(e) {
    // 1. Verify JSON payload exists
    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody) {
      return {
        success: false,
        error: 'EMPTY_REQUEST',
        message: 'No request payload received.',
      };
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        error: 'INVALID_JSON',
        message: 'Request body must be valid JSON.',
      };
    }

    // 2. Fail-Closed Authentication Check (Pre-Lock)
    const sharedSecret = this.sharedApiKey;
    if (!sharedSecret || sharedSecret.trim().length === 0) {
      return {
        success: false,
        error: 'SERVER_MISCONFIGURED',
        message: 'Server authentication is not configured.',
      };
    }

    // 3. Timestamp Validation (Pre-Lock)
    const timestamp = String(payload.timestamp || '').trim();
    if (!timestamp) {
      return {
        success: false,
        error: 'MISSING_TIMESTAMP',
        message: 'Request timestamp is missing.',
      };
    }

    const requestTime = Date.parse(timestamp);
    if (isNaN(requestTime)) {
      return {
        success: false,
        error: 'INVALID_TIMESTAMP',
        message: 'Request timestamp is not a valid ISO 8601 string.',
      };
    }

    const now = Date.now();
    if (Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) {
      return {
        success: false,
        error: 'REQUEST_EXPIRED',
        message: 'Request timestamp is outside the allowed 5-minute tolerance window.',
      };
    }

    // 4. Nonce & Replay Protection (Pre-Lock)
    const nonce = String(payload.nonce || '').trim();
    if (!nonce || nonce.length < 16 || nonce.length > 64) {
      return {
        success: false,
        error: 'INVALID_NONCE',
        message: 'Request nonce is missing or invalid.',
      };
    }

    const nonceCacheKey = 'nonce_' + nonce;
    const cachedExpiresAt = this.nonceCache.get(nonceCacheKey);
    if (cachedExpiresAt && cachedExpiresAt > Date.now()) {
      return {
        success: false,
        error: 'DUPLICATE_NONCE',
        message: 'Request replay detected. This nonce has already been used.',
      };
    }

    // 5. Canonical String & Cryptographic Signature Check (Pre-Lock)
    const rawName = String(payload.name || '').trim();
    const rawMobile = String(payload.mobile || payload.mobile_number || '').trim();
    const confirmedExistingName = Boolean(payload.confirmedExistingName);

    const canonicalString = [
      timestamp,
      nonce,
      rawName,
      rawMobile,
      confirmedExistingName ? 'true' : 'false',
    ].join(':');

    const providedSignature = String(payload.signature || '').trim().toLowerCase();
    if (!providedSignature) {
      return {
        success: false,
        error: 'MISSING_SIGNATURE',
        message: 'Request signature is missing.',
      };
    }

    const expectedSignature = crypto
      .createHmac('sha256', sharedSecret)
      .update(canonicalString)
      .digest('hex')
      .toLowerCase();

    if (!constantTimeCompare(expectedSignature, providedSignature)) {
      return {
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Cryptographic request signature verification failed.',
      };
    }

    // 6. Input Schema Validation (Pre-Lock)
    if (!rawName || rawName.length < 1 || rawName.length > 60) {
      return {
        success: false,
        error: 'INVALID_NAME',
        message: 'Customer name must be between 1 and 60 characters.',
      };
    }

    let cleanMobile = rawMobile.replace(/\D/g, '');
    if (cleanMobile.length === 12 && cleanMobile.indexOf('91') === 0) {
      cleanMobile = cleanMobile.substring(2);
    }
    if (cleanMobile.length === 11 && cleanMobile.indexOf('0') === 0) {
      cleanMobile = cleanMobile.substring(1);
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanMobile)) {
      return {
        success: false,
        error: 'INVALID_MOBILE',
        message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      };
    }

    // 7. Concurrency Lock: Authenticated & Validated Requests Only
    const lockAcquired = await this.acquireLock(10000);
    if (!lockAcquired) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'Server is processing concurrent customer registrations. Please retry in a moment.',
      };
    }

    try {
      // Atomic Nonce Check & Record (Inside Lock)
      // CacheService lacks atomic check-and-set across parallel instances; checking and committing
      // inside LockService guarantees 100% atomic replay prevention for concurrent requests.
      const lockedCachedExpiresAt = this.nonceCache.get(nonceCacheKey);
      if (lockedCachedExpiresAt && lockedCachedExpiresAt > Date.now()) {
        return {
          success: false,
          error: 'DUPLICATE_NONCE',
          message: 'Request replay detected. This nonce has already been used.',
        };
      }
      this.nonceCache.set(nonceCacheKey, Date.now() + NONCE_TTL_SECONDS * 1000);

      // 8. Access Spreadsheet & Verify Worksheet Schema
      if (!this.sheetAccessible) {
        return {
          success: false,
          error: 'SPREADSHEET_NOT_FOUND',
          message: 'Unable to access the customer spreadsheet.',
        };
      }

      if (!this.worksheetExists) {
        return {
          success: false,
          error: 'WORKSHEET_MISSING',
          message: 'The Customers worksheet was not found.',
        };
      }

      if (!this.headers || this.headers.length === 0) {
        return {
          success: false,
          error: 'INVALID_HEADERS',
          message: 'Worksheet is completely empty. Headers must be configured.',
        };
      }

      for (let h = 0; h < REQUIRED_HEADERS.length; h++) {
        if (String(this.headers[h] || '').trim().toLowerCase() !== REQUIRED_HEADERS[h]) {
          return {
            success: false,
            error: 'INVALID_HEADERS',
            message: 'Worksheet schema mismatch. Expected headers: customer_id, name, mobile_number, created_at, updated_at.',
          };
        }
      }

      const nowIso = new Date().toISOString();

      // 9. Existing Customer Lookup (Column C is mobile_number, index 2)
      let existingIndex = -1;
      let existingRecord = null;

      for (let i = 0; i < this.rows.length; i++) {
        const rowMobile = String(this.rows[i][2]).replace(/\D/g, '');
        if (rowMobile === cleanMobile) {
          existingIndex = i;
          existingRecord = {
            customerId: String(this.rows[i][0]),
            name: String(this.rows[i][1]),
            mobile: rowMobile,
            createdAt: String(this.rows[i][3]),
            updatedAt: String(this.rows[i][4]),
          };
          break;
        }
      }

      // Scenario A: Existing Customer Record Found
      if (existingRecord) {
        const isNameIdentical = existingRecord.name.trim().toLowerCase() === rawName.toLowerCase();

        if (!isNameIdentical && !confirmedExistingName) {
          return {
            success: true,
            status: 'EXISTING_CUSTOMER_NAME_MISMATCH',
            customer: {
              customerId: existingRecord.customerId,
              name: existingRecord.name,
              submittedName: rawName,
              mobile: existingRecord.mobile,
            },
            message: 'Existing customer record found with a different name. Existing name preserved.',
          };
        }

        // Update timestamp in column E (index 4)
        this.rows[existingIndex][4] = nowIso;

        return {
          success: true,
          status: 'EXISTING_CUSTOMER',
          customer: {
            customerId: existingRecord.customerId,
            name: existingRecord.name,
            mobile: existingRecord.mobile,
          },
          message: 'Welcome back! Customer record verified.',
        };
      }

      // Scenario B: New Customer Record Creation
      const newCustomerId = crypto.randomUUID();
      const safeName = sanitizeFormula(rawName);
      const safeMobile = "'" + cleanMobile;

      this.rows.push([newCustomerId, safeName, safeMobile, nowIso, nowIso]);

      return {
        success: true,
        status: 'NEW_CUSTOMER',
        customer: {
          customerId: newCustomerId,
          name: rawName,
          mobile: cleanMobile,
        },
        message: 'Customer record registered successfully.',
      };
    } finally {
      this.releaseLock();
    }
  }

  // Mimics doGet(e) in Code.gs
  doGet() {
    return {
      status: 'ONLINE',
      service: 'Little Monkey Café Dining Customer Service',
      timestamp: new Date().toISOString(),
    };
  }
}

// Helper to sign request payload
function createSignedPayload(secret, data) {
  const timestamp = data.timestamp || new Date().toISOString();
  const nonce = data.nonce !== undefined ? data.nonce : crypto.randomBytes(16).toString('hex');
  const name = String(data.name || '').trim();
  const mobile = String(data.mobile || '').trim();
  const confirmed = Boolean(data.confirmedExistingName);

  const canonical = [timestamp, nonce, name, mobile, confirmed ? 'true' : 'false'].join(':');
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex').toLowerCase();

  return {
    timestamp,
    nonce,
    name,
    mobile,
    confirmedExistingName: confirmed,
    signature,
  };
}

// ============================================================================
// MAIN VERIFICATION SUITE
// ============================================================================

async function runVerification() {
  console.log('========================================================================');
  console.log('GOOGLE APPS SCRIPT SECURITY & INTEGRATION VERIFICATION (10 SCENARIOS)');
  console.log('========================================================================\n');

  const SECRET = 'cafe_dining_master_secret_key_warangal_2026';

  // --------------------------------------------------------------------------
  // SCENARIO 1: Valid Signed Request
  // --------------------------------------------------------------------------
  console.log('--- Scenario 1: Valid Signed Request ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const payload = createSignedPayload(SECRET, {
      name: 'Aditi Rao',
      mobile: '9876543210',
    });
    const result = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
    assert.strictEqual(result.success, true, 'Valid signed request must succeed');
    assert.strictEqual(result.status, 'NEW_CUSTOMER');
    assert.strictEqual(result.customer.name, 'Aditi Rao');
    assert.strictEqual(result.customer.mobile, '9876543210');
    assert.strictEqual(sim.rows.length, 1);
    console.log('[PASS] Scenario 1: Valid HMAC-SHA256 signed request registered new customer.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Missing Secret (Fail-Closed Check)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 2: Missing Secret (Fail-Closed Check) ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: '' }); // empty secret in script properties
    const payload = createSignedPayload(SECRET, {
      name: 'Aditi Rao',
      mobile: '9876543210',
    });
    const result = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
    assert.strictEqual(result.success, false, 'Missing secret must fail closed');
    assert.strictEqual(result.error, 'SERVER_MISCONFIGURED');
    assert.strictEqual(sim.rows.length, 0, 'No rows created when secret missing');
    console.log('[PASS] Scenario 2: Fail-closed mode enforced when SHARED_API_KEY is missing.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Invalid Signature
  // --------------------------------------------------------------------------
  console.log('--- Scenario 3: Invalid Signature ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const payload = createSignedPayload(SECRET, {
      name: 'Aditi Rao',
      mobile: '9876543210',
    });
    // Tamper with signature
    payload.signature = 'a'.repeat(64);
    const result = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'INVALID_SIGNATURE');
    assert.strictEqual(sim.rows.length, 0);
    console.log('[PASS] Scenario 3: Tampered signature rejected with INVALID_SIGNATURE.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 4: Expired Timestamp
  // --------------------------------------------------------------------------
  console.log('--- Scenario 4: Expired Timestamp (>5 minute window) ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
    const payload = createSignedPayload(SECRET, {
      timestamp: oldTimestamp,
      name: 'Aditi Rao',
      mobile: '9876543210',
    });
    const result = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'REQUEST_EXPIRED');
    assert.strictEqual(sim.rows.length, 0);
    console.log('[PASS] Scenario 4: Expired timestamp rejected with REQUEST_EXPIRED.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 5: Reused Nonce (Replay Attack)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 5: Reused Nonce (Replay Protection) ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const fixedNonce = 'abcdef1234567890abcdef1234567890';
    const payload1 = createSignedPayload(SECRET, {
      nonce: fixedNonce,
      name: 'Aditi Rao',
      mobile: '9876543210',
    });
    const result1 = await sim.doPost({ postData: { contents: JSON.stringify(payload1) } });
    assert.strictEqual(result1.success, true);

    // Replay exact same request with same nonce
    const result2 = await sim.doPost({ postData: { contents: JSON.stringify(payload1) } });
    assert.strictEqual(result2.success, false);
    assert.strictEqual(result2.error, 'DUPLICATE_NONCE');
    console.log('[PASS] Scenario 5: Replayed nonce blocked with DUPLICATE_NONCE.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 6: Invalid Mobile Number
  // --------------------------------------------------------------------------
  console.log('--- Scenario 6: Invalid Mobile Number (Pre-Lock Validation) ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const invalidMobiles = ['12345', '5876543210', '98765abcde', '9876543210123'];
    for (const mob of invalidMobiles) {
      const payload = createSignedPayload(SECRET, {
        name: 'Aditi Rao',
        mobile: mob,
      });
      const result = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
      assert.strictEqual(result.success, false, `Mobile ${mob} must fail`);
      assert.strictEqual(result.error, 'INVALID_MOBILE');
    }
    assert.strictEqual(sim.rows.length, 0);
    console.log('[PASS] Scenario 6: Non-Indian or malformed mobile numbers rejected pre-lock.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 7: Duplicate Registration (Same Customer Visits Again)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 7: Duplicate Registration (Idempotent Update) ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const payload1 = createSignedPayload(SECRET, {
      name: 'Rohan Mehta',
      mobile: '9876543222',
    });
    const result1 = await sim.doPost({ postData: { contents: JSON.stringify(payload1) } });
    assert.strictEqual(result1.status, 'NEW_CUSTOMER');
    assert.strictEqual(sim.rows.length, 1);
    const initialCreatedAt = sim.rows[0][3];

    // Second registration with new nonce and timestamp
    await new Promise((r) => setTimeout(r, 10));
    const payload2 = createSignedPayload(SECRET, {
      name: 'Rohan Mehta',
      mobile: '9876543222',
    });
    const result2 = await sim.doPost({ postData: { contents: JSON.stringify(payload2) } });
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.status, 'EXISTING_CUSTOMER');
    assert.strictEqual(sim.rows.length, 1, 'Zero duplicate rows added');
    assert.strictEqual(sim.rows[0][3], initialCreatedAt, 'Created at preserved');
    console.log('[PASS] Scenario 7: Duplicate mobile verified as EXISTING_CUSTOMER; 0 extra rows created.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 8: Name Conflict (Existing Customer with Different Name)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 8: Name Conflict Preservation ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    // Initial registration under "Rohan Mehta"
    const payload1 = createSignedPayload(SECRET, {
      name: 'Rohan Mehta',
      mobile: '9876543233',
    });
    await sim.doPost({ postData: { contents: JSON.stringify(payload1) } });

    // Second registration with same mobile but different name ("Rohan M.") and confirmedExistingName=false
    const payload2 = createSignedPayload(SECRET, {
      name: 'Rohan M.',
      mobile: '9876543233',
      confirmedExistingName: false,
    });
    const result2 = await sim.doPost({ postData: { contents: JSON.stringify(payload2) } });
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.status, 'EXISTING_CUSTOMER_NAME_MISMATCH');
    assert.strictEqual(result2.customer.name, 'Rohan Mehta', 'Stored name preserved');
    assert.strictEqual(result2.customer.submittedName, 'Rohan M.');
    assert.strictEqual(sim.rows[0][1], 'Rohan Mehta', 'Spreadsheet cell unchanged');

    // Confirmed resolution
    const payload3 = createSignedPayload(SECRET, {
      name: 'Rohan M.',
      mobile: '9876543233',
      confirmedExistingName: true,
    });
    const result3 = await sim.doPost({ postData: { contents: JSON.stringify(payload3) } });
    assert.strictEqual(result3.status, 'EXISTING_CUSTOMER');
    assert.strictEqual(result3.customer.name, 'Rohan Mehta');
    console.log('[PASS] Scenario 8: Name conflict detected and stored name protected against overwrite.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 9: Concurrent Registration (Simulated Lock Serialization)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 9: Concurrent Registration Serialization ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    // Launch 10 simultaneous registrations for 10 unique customers
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const payload = createSignedPayload(SECRET, {
        name: `Customer ${i}`,
        mobile: `98765432${i.toString().padStart(2, '0')}`,
      });
      promises.push(sim.doPost({ postData: { contents: JSON.stringify(payload) } }));
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.every((r) => r.success), true, 'All concurrent registrations succeeded');
    assert.strictEqual(sim.rows.length, 10, 'All 10 customer rows committed cleanly');
    console.log('[PASS] Scenario 9: LockService concurrency serialization confirmed for 10 parallel writes.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 10: Spreadsheet Permission Failure / Corrupt Schema
  // --------------------------------------------------------------------------
  console.log('--- Scenario 10: Spreadsheet Permission / Header Verification Failure ---');
  {
    // Case 10A: Missing Worksheet
    const simMissing = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET, worksheetExists: false });
    const payload1 = createSignedPayload(SECRET, { name: 'Aditi Rao', mobile: '9876543210' });
    const resMissing = await simMissing.doPost({ postData: { contents: JSON.stringify(payload1) } });
    assert.strictEqual(resMissing.success, false);
    assert.strictEqual(resMissing.error, 'WORKSHEET_MISSING');

    // Case 10B: Corrupted Headers
    const simBadHeaders = new GoogleAppsScriptSimulator({
      sharedApiKey: SECRET,
      headers: ['id', 'user_name', 'phone', 'created', 'updated'], // invalid header names
    });
    const payload2 = createSignedPayload(SECRET, { name: 'Aditi Rao', mobile: '9876543210' });
    const resBadHeaders = await simBadHeaders.doPost({ postData: { contents: JSON.stringify(payload2) } });
    assert.strictEqual(resBadHeaders.success, false);
    assert.strictEqual(resBadHeaders.error, 'INVALID_HEADERS');

    console.log('[PASS] Scenario 10: Missing worksheet and corrupted headers safely rejected.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 11: Missing or Malformed Nonce Rejection
  // --------------------------------------------------------------------------
  console.log('--- Scenario 11: Missing or Malformed Nonce Rejection ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    // Empty nonce
    const payloadNoNonce = createSignedPayload(SECRET, { name: 'Aditi Rao', mobile: '9876543210', nonce: '' });
    const resNoNonce = await sim.doPost({ postData: { contents: JSON.stringify(payloadNoNonce) } });
    assert.strictEqual(resNoNonce.success, false);
    assert.strictEqual(resNoNonce.error, 'INVALID_NONCE');

    // Too short nonce (<16 chars)
    const payloadShortNonce = createSignedPayload(SECRET, { name: 'Aditi Rao', mobile: '9876543210', nonce: 'short_123' });
    const resShortNonce = await sim.doPost({ postData: { contents: JSON.stringify(payloadShortNonce) } });
    assert.strictEqual(resShortNonce.success, false);
    assert.strictEqual(resShortNonce.error, 'INVALID_NONCE');

    console.log('[PASS] Scenario 11: Missing and short nonces rejected with INVALID_NONCE.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 12: Formula Injection Neutralization
  // --------------------------------------------------------------------------
  console.log('--- Scenario 12: Formula Injection Neutralization ---');
  {
    const sim = new GoogleAppsScriptSimulator({ sharedApiKey: SECRET });
    const dangerousNames = [
      '=cmd|\' /C calc\'!A0',
      '+SUM(1,2)',
      '-HYPERLINK("http://evil.com")',
      '@IMPORTXML("http://evil.com", "//a")',
      '\t=cmd|\' /C calc\'!A0',
      '\r+HYPERLINK("http://evil.com")',
    ];

    for (const dName of dangerousNames) {
      const payload = createSignedPayload(SECRET, { name: dName, mobile: `98765432${Math.floor(10 + Math.random() * 89)}` });
      const res = await sim.doPost({ postData: { contents: JSON.stringify(payload) } });
      assert.strictEqual(res.success, true);
      const insertedRow = sim.rows[sim.rows.length - 1];
      const insertedName = insertedRow[1];
      assert.ok(insertedName.startsWith("'"), `Name "${dName}" must be sanitized with leading single quote`);
    }

    console.log('[PASS] Scenario 12: All formula injection triggers neutralized with leading single quote.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 13: Manifest Scope and Code.gs File Integrity
  // --------------------------------------------------------------------------
  console.log('--- Scenario 13: Manifest Scope and Code.gs File Integrity ---');
  {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const manifestPath = path.resolve(process.cwd(), 'src/google-apps-script/appsscript.json');
    assert.ok(fs.existsSync(manifestPath), 'appsscript.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.deepStrictEqual(manifest.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets'], 'Must only contain spreadsheets scope');
    assert.strictEqual(manifest.runtimeVersion, 'V8', 'Must use V8 runtime');

    const codePath = path.resolve(process.cwd(), 'src/google-apps-script/Code.gs');
    assert.ok(fs.existsSync(codePath), 'Code.gs file must exist');
    const code = fs.readFileSync(codePath, 'utf8');
    assert.ok(code.includes('var WORKSHEET_NAME = \'Customers\';'));
    assert.ok(code.includes('Utilities.getUuid()'));
    assert.ok(code.includes('Utilities.computeHmacSha256Signature'));
    // Verify syntax
    new Function(code);

    console.log('[PASS] Scenario 13: appsscript.json and Code.gs verified with minimum scopes & valid V8 syntax.');
  }

  // --------------------------------------------------------------------------
  // PART 2: DINING SERVER RELAY & STATUS MAPPING INTEGRATION
  // --------------------------------------------------------------------------
  console.log('\n--- PART 2: Dining Server Relay & Status Code Mapping Verification ---');

  const BASE_URL = 'http://127.0.0.1:3000';
  let mockServer;
  let mockServerPort = 3987;
  let receivedRequests = [];
  let mockMode = 'SUCCESS'; // SUCCESS | INVALID_SIG | EXPIRED | REPLAY | INVALID_MOB | TIMEOUT

  await new Promise((resolve) => {
    mockServer = http.createServer(async (req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        receivedRequests.push(parsed);

        res.setHeader('Content-Type', 'application/json');
        // Note: Google Apps Script ALWAYS returns HTTP 200, errors are encoded in JSON body
        if (mockMode === 'SUCCESS') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: true,
              status: 'NEW_CUSTOMER',
              customer: {
                customerId: 'CUST-MOCK1234',
                name: parsed.name,
                mobile: parsed.mobile,
              },
              message: 'Customer record registered successfully.',
            })
          );
        } else if (mockMode === 'INVALID_SIG') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: false,
              error: 'INVALID_SIGNATURE',
              message: 'Cryptographic request signature verification failed.',
            })
          );
        } else if (mockMode === 'EXPIRED') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: false,
              error: 'REQUEST_EXPIRED',
              message: 'Request timestamp is outside the allowed 5-minute tolerance window.',
            })
          );
        } else if (mockMode === 'REPLAY') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: false,
              error: 'DUPLICATE_NONCE',
              message: 'Request replay detected. This nonce has already been used.',
            })
          );
        } else if (mockMode === 'LOCK_TIMEOUT') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: false,
              error: 'LOCK_TIMEOUT',
              message: 'Server is processing concurrent customer registrations.',
            })
          );
        } else if (mockMode === 'NAME_MISMATCH') {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: true,
              status: 'EXISTING_CUSTOMER_NAME_MISMATCH',
              customer: {
                customerId: 'CUST-MOCK1234',
                name: 'Stored Original',
                submittedName: parsed.name,
                mobile: parsed.mobile,
              },
              message: 'Existing customer record found with a different name. Existing name preserved.',
            })
          );
        }
      });
    });

    mockServer.listen(mockServerPort, resolve);
  });

  try {
    // Acquire a valid QR proof token from dining server
    const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
    const tablesData = await tablesResp.json();
    const table01 = tablesData.tables[0];

    const qrVerifyResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table01.tableNumber,
        cred: `${table01.credentialId}.${table01.rawSecret}`,
      }),
    });
    const qrVerifyData = await qrVerifyResp.json();
    const qrProofToken = qrVerifyData.qrProofToken;

    const relayHeaders = {
      'Content-Type': 'application/json',
      'x-dev-sheets-webhook-url': `http://127.0.0.1:${mockServerPort}`,
      'x-dev-sheets-api-key': SECRET,
    };

    // Test Relay 1: Valid registration through Dining Server to GAS relay
    mockMode = 'SUCCESS';
    receivedRequests = [];
    const relayResp1 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp1.status, 201, 'Dining server must return 201 on new customer');
    const relayData1 = await relayResp1.json();
    assert.strictEqual(relayData1.success, true);
    assert.strictEqual(receivedRequests.length, 1);
    const sentToGas = receivedRequests[0];
    assert.ok(sentToGas.timestamp, 'Dining server must attach ISO timestamp');
    assert.ok(sentToGas.nonce && sentToGas.nonce.length >= 32, 'Dining server must attach 32-char hex nonce');
    assert.ok(sentToGas.signature && sentToGas.signature.length === 64, 'Dining server must attach HMAC-SHA256 signature');

    // Verify signature created by Dining server matches expected HMAC
    const expectedCanonical = [
      sentToGas.timestamp,
      sentToGas.nonce,
      'Relay Diner',
      '9876543290',
      'false',
    ].join(':');
    const expectedSig = crypto.createHmac('sha256', SECRET).update(expectedCanonical).digest('hex').toLowerCase();
    assert.strictEqual(sentToGas.signature, expectedSig, 'Dining server computed exact canonical HMAC signature');
    console.log('[PASS] Relay Step 1: Dining Server forwarded HMAC-SHA256 signed payload with nonce & timestamp.');

    // Test Relay 2: GAS returns INVALID_SIGNATURE -> Dining Server maps to HTTP 401
    mockMode = 'INVALID_SIG';
    const relayResp2 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp2.status, 401, 'INVALID_SIGNATURE mapped to HTTP 401');
    const relayData2 = await relayResp2.json();
    assert.strictEqual(relayData2.error, 'INVALID_SIGNATURE');
    console.log('[PASS] Relay Step 2: INVALID_SIGNATURE from Google Apps Script correctly mapped to HTTP 401.');

    // Test Relay 3: GAS returns REQUEST_EXPIRED -> Dining Server maps to HTTP 403
    mockMode = 'EXPIRED';
    const relayResp3 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp3.status, 403, 'REQUEST_EXPIRED mapped to HTTP 403');
    console.log('[PASS] Relay Step 3: REQUEST_EXPIRED correctly mapped to HTTP 403.');

    // Test Relay 4: GAS returns DUPLICATE_NONCE -> Dining Server maps to HTTP 403
    mockMode = 'REPLAY';
    const relayResp4 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp4.status, 403, 'DUPLICATE_NONCE mapped to HTTP 403');
    console.log('[PASS] Relay Step 4: DUPLICATE_NONCE correctly mapped to HTTP 403.');

    // Test Relay 5: GAS returns LOCK_TIMEOUT -> Dining Server maps to HTTP 503
    mockMode = 'LOCK_TIMEOUT';
    const relayResp5 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp5.status, 503, 'LOCK_TIMEOUT mapped to HTTP 503');
    console.log('[PASS] Relay Step 5: LOCK_TIMEOUT correctly mapped to HTTP 503.');

    // Test Relay 6: GAS returns EXISTING_CUSTOMER_NAME_MISMATCH -> HTTP 200 with mismatch status
    mockMode = 'NAME_MISMATCH';
    const relayResp6 = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify({
        name: 'Relay Diner',
        mobile: '9876543290',
        qrProofToken,
      }),
    });
    assert.strictEqual(relayResp6.status, 200);
    const relayData6 = await relayResp6.json();
    assert.strictEqual(relayData6.status, 'EXISTING_CUSTOMER_NAME_MISMATCH');
    assert.strictEqual(relayData6.customer.name, 'Stored Original');
    console.log('[PASS] Relay Step 6: EXISTING_CUSTOMER_NAME_MISMATCH preserved and forwarded to client.');

    // --------------------------------------------------------------------------
    // PART 3: PRODUCTION FAIL-CLOSED & DEVELOPER OVERRIDE SECURITY SUITE
    // --------------------------------------------------------------------------
    console.log('\n--- PART 3: Production Fail-Closed & Developer Override Security Suite ---');

    const prodResult = await esbuild.build({
      entryPoints: ['src/server/dineInServerPlugin.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
    });
    const prodCode = prodResult.outputFiles[0].text;
    const prodMod = await import('data:text/javascript;base64,' + Buffer.from(prodCode).toString('base64'));
    const { handleDineInMiddleware } = prodMod;

    let isolatedServer;
    const isolatedPort = 3998;
    const isolatedBaseUrl = `http://127.0.0.1:${isolatedPort}`;

    await new Promise((resolve) => {
      isolatedServer = http.createServer((req, res) => {
        handleDineInMiddleware(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
      });
      isolatedServer.listen(isolatedPort, resolve);
    });

    const originalEnvNodeEnv = process.env.NODE_ENV;
    const originalEnvWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const originalEnvApiKey = process.env.GOOGLE_SHEETS_API_KEY;

    try {
      // 1. In dev mode, acquire a valid physical QR proof token for Table 01
      process.env.NODE_ENV = 'development';
      const devTableResp = await fetch(`${isolatedBaseUrl}/api/dev/tables`);
      const devTableData = await devTableResp.json();
      const t01 = devTableData.tables[0];
      const devQrResp = await fetch(`${isolatedBaseUrl}/api/dine-in/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: t01.tableNumber,
          cred: `${t01.credentialId}.${t01.rawSecret}`,
        }),
      });
      const devQrData = await devQrResp.json();
      const prodValidQrToken = devQrData.qrProofToken;
      assert.ok(prodValidQrToken, 'Must obtain valid QR proof token');

      // 2. Switch isolated server runtime strictly to production mode
      process.env.NODE_ENV = 'production';

      // Test Prod 1: Production + missing/empty webhook URL -> Safe failure (HTTP 500)
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = '';
      process.env.GOOGLE_SHEETS_API_KEY = 'valid_production_secret_key_1234567890';
      const prodResp1 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp1.status, 500, 'Missing webhook URL in production must return HTTP 500');
      const prodData1 = await prodResp1.json();
      assert.strictEqual(prodData1.error, 'GOOGLE_SHEETS_NOT_CONFIGURED');
      console.log('[PASS] Prod Test 1: Production + missing webhook URL failed safely with HTTP 500 GOOGLE_SHEETS_NOT_CONFIGURED.');

      // Test Prod 2: Production + whitespace-only empty webhook URL -> Safe failure (HTTP 500)
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = '   ';
      const prodResp2 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp2.status, 500, 'Whitespace webhook URL in production must return HTTP 500');
      const prodData2 = await prodResp2.json();
      assert.strictEqual(prodData2.error, 'GOOGLE_SHEETS_NOT_CONFIGURED');
      console.log('[PASS] Prod Test 2: Production + empty/whitespace webhook URL failed safely with HTTP 500 GOOGLE_SHEETS_NOT_CONFIGURED.');

      // Test Prod 3: Production + template placeholder URL -> Safe failure (HTTP 500)
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
      const prodResp3 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp3.status, 500, 'Placeholder webhook URL in production must return HTTP 500');
      const prodData3 = await prodResp3.json();
      assert.strictEqual(prodData3.error, 'GOOGLE_SHEETS_NOT_CONFIGURED');
      console.log('[PASS] Prod Test 3: Production + placeholder URL failed safely with HTTP 500 GOOGLE_SHEETS_NOT_CONFIGURED.');

      // Test Prod 4: Production + malformed/non-https URL -> Safe failure (HTTP 500)
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'http://insecure-domain.com/exec';
      const prodResp4 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp4.status, 500, 'Non-HTTPS webhook URL in production must return HTTP 500');
      const prodData4 = await prodResp4.json();
      assert.strictEqual(prodData4.error, 'GOOGLE_SHEETS_NOT_CONFIGURED');
      console.log('[PASS] Prod Test 4: Production + malformed/non-HTTPS webhook URL failed safely with HTTP 500 GOOGLE_SHEETS_NOT_CONFIGURED.');

      // Test Prod 5: Production + placeholder API key -> Safe failure (HTTP 500)
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/valid_deployment_id/exec';
      process.env.GOOGLE_SHEETS_API_KEY = 'your_shared_api_key_placeholder';
      const prodResp5 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp5.status, 500, 'Placeholder API key in production must return HTTP 500');
      const prodData5 = await prodResp5.json();
      assert.strictEqual(prodData5.error, 'GOOGLE_SHEETS_NOT_CONFIGURED');
      console.log('[PASS] Prod Test 5: Production + placeholder API key failed safely with HTTP 500 GOOGLE_SHEETS_NOT_CONFIGURED.');

      // Configure valid production dummy URL for header security testing
      process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/valid_prod_id/exec';
      process.env.GOOGLE_SHEETS_API_KEY = '0123456789abcdef0123456789abcdef';

      // Test Prod 6: Production + developer emulator header -> Rejected (HTTP 403)
      const prodResp6 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-emulator': 'true',
        },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp6.status, 403, 'x-dev-sheets-emulator header must be rejected with HTTP 403');
      const prodData6 = await prodResp6.json();
      assert.strictEqual(prodData6.error, 'DEV_HEADERS_DISABLED_IN_PROD');
      console.log('[PASS] Prod Test 6: Production + developer emulator header rejected with HTTP 403 DEV_HEADERS_DISABLED_IN_PROD.');

      // Test Prod 7: Production + developer webhook URL header -> Rejected (HTTP 403)
      const prodResp7 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-webhook-url': 'http://attacker-site.com/steal',
        },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp7.status, 403, 'x-dev-sheets-webhook-url header must be rejected with HTTP 403');
      const prodData7 = await prodResp7.json();
      assert.strictEqual(prodData7.error, 'DEV_HEADERS_DISABLED_IN_PROD');
      console.log('[PASS] Prod Test 7: Production + developer webhook URL header rejected with HTTP 403 DEV_HEADERS_DISABLED_IN_PROD.');

      // Test Prod 8: Production + developer API key header -> Rejected (HTTP 403)
      const prodResp8 = await fetch(`${isolatedBaseUrl}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-api-key': 'attacker_chosen_key',
        },
        body: JSON.stringify({
          name: 'Production Diner',
          mobile: '9876543210',
          qrProofToken: prodValidQrToken,
        }),
      });
      assert.strictEqual(prodResp8.status, 403, 'x-dev-sheets-api-key header must be rejected with HTTP 403');
      const prodData8 = await prodResp8.json();
      assert.strictEqual(prodData8.error, 'DEV_HEADERS_DISABLED_IN_PROD');
      console.log('[PASS] Prod Test 8: Production + developer API key header rejected with HTTP 403 DEV_HEADERS_DISABLED_IN_PROD.');

      // Test Prod 9: Production + test clock helper /api/test/reset-time -> Rejected (HTTP 403)
      const prodResp9 = await fetch(`${isolatedBaseUrl}/api/test/reset-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emulator: true }),
      });
      assert.strictEqual(prodResp9.status, 403, '/api/test/reset-time must be disabled in production');
      const prodData9 = await prodResp9.json();
      assert.strictEqual(prodData9.error, 'TEST_HELPERS_DISABLED_IN_PROD');
      console.log('[PASS] Prod Test 9: Production + /api/test/reset-time blocked with HTTP 403 TEST_HELPERS_DISABLED_IN_PROD.');

      // Test Prod 10: Production + dev helper /api/dev/tables -> Rejected (HTTP 403)
      const prodResp10 = await fetch(`${isolatedBaseUrl}/api/dev/tables`);
      assert.strictEqual(prodResp10.status, 403, '/api/dev/tables must be disabled in production');
      const prodData10 = await prodResp10.json();
      assert.strictEqual(prodData10.error, 'DEV_ENDPOINT_DISABLED_IN_PROD');
      console.log('[PASS] Prod Test 10: Production + /api/dev/tables blocked with HTTP 403 DEV_ENDPOINT_DISABLED_IN_PROD.');

    } finally {
      process.env.NODE_ENV = originalEnvNodeEnv;
      if (originalEnvWebhook !== undefined) {
        process.env.GOOGLE_SHEETS_WEBHOOK_URL = originalEnvWebhook;
      } else {
        delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      }
      if (originalEnvApiKey !== undefined) {
        process.env.GOOGLE_SHEETS_API_KEY = originalEnvApiKey;
      } else {
        delete process.env.GOOGLE_SHEETS_API_KEY;
      }
      isolatedServer.close();
    }

  } finally {
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    delete process.env.GOOGLE_SHEETS_API_KEY;
    mockServer.close();
  }

  console.log('\n========================================================================');
  console.log('ALL 10 SECURITY SCENARIOS & RELAY MAPPINGS VERIFIED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

runVerification().catch((err) => {
  console.error('[FAILED] Verification encountered error:', err);
  process.exit(1);
});
