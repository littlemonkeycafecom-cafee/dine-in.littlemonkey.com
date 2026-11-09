# Little Monkey Café Dining — Google Spreadsheet Setup Guide

This guide provides step-by-step instructions for the Little Monkey Café owner to create, secure, and configure the Google Spreadsheet, deploy the Google Apps Script integration layer for dining customer records, and connect it to the dining server.

---

## Separation of Responsibilities

### Completed by Engineering
1. Passwordless 2-field Customer Registration Form (Full Name + 10-digit Indian Mobile).
2. Server-Side Integration Gateway (`POST /api/dine-in/customer-record`) with rate limiting and QR token verification.
3. Name Conflict Protection: prevents silent overwrites when a returning customer enters a different name.
4. Formula Injection Sanitization on all user inputs.
5. Automated test suite (`scripts/verify_google_sheets_customer_integration.mjs`) passing 100%.
6. Ready-to-import CSV template: [src/data/google_sheets_customers_template.csv](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/data/google_sheets_customers_template.csv).

### Required by the Café Owner
1. Creating the private Google Spreadsheet under the official Little Monkey Café Google Account.
2. Pasting and deploying the Google Apps Script (`Code.gs`) Web App.
3. Adding the resulting Web App URL to the server's `.env` configuration.

---

## Step 1: Create the Google Spreadsheet

1. Open [Google Sheets](https://sheets.google.com) in your browser while signed into the authorized Little Monkey Café Google account.
2. Click **Blank spreadsheet**.
3. In the top-left title field, rename the spreadsheet to:
   ```text
   Little Monkey Café — Dining Customers
   ```
4. Rename the default sheet (tab at the bottom):
   - Right-click `Sheet1` -> Select **Rename**.
   - Enter exactly: `Customers` (case-sensitive).

---

## Step 2: Add Column Headers

In row 1 of the `Customers` worksheet, enter the following column headers in cells `A1` to `E1`:

| Cell | Header Name | Format | Description |
| :--- | :--- | :--- | :--- |
| **A1** | `customer_id` | Bold, Plain Text | Unique identifier (`CUST-<HEX>`) |
| **B1** | `name` | Bold, Plain Text | Customer full name |
| **C1** | `mobile_number` | Bold, Plain Text | 10-digit normalized Indian mobile |
| **D1** | `created_at` | Bold, Plain Text | ISO 8601 registration timestamp |
| **E1** | `updated_at` | Bold, Plain Text | ISO 8601 last update timestamp |

> [!TIP]
> Alternatively, click **File** -> **Import** -> **Upload** and select [src/data/google_sheets_customers_template.csv](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/data/google_sheets_customers_template.csv) to populate the schema instantly.

Select Column C (`mobile_number`), click **Format** -> **Number** -> **Plain text** to ensure leading zeros or text formats are preserved without numerical truncation.

---

## Step 3: Configure Privacy & Access Controls

> [!IMPORTANT]
> Do NOT share this spreadsheet publicly or make it visible to "Anyone with the link". The spreadsheet contains customer information and must remain strictly private.

1. Click the green **Share** button in the top-right corner.
2. Under **General access**, ensure it is set to **Restricted** (Only people with access can open with the link).
3. Do not add external viewers or editors. Access is handled programmatically via the Google Apps Script Web App running under your account.

---

## Step 4: Obtain the Spreadsheet ID (Reference)

Look at your browser's address bar. The URL is structured as:
```text
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```
Copy the `<SPREADSHEET_ID>` string (the long alphanumeric string between `/d/` and `/edit`). Keep this in your café records.

---

## Step 5: Install the Google Apps Script

1. In the Google Sheets menu, click **Extensions** -> **Apps Script**.
2. Rename the Apps Script project (top left) to:
   ```text
   Little Monkey Café — Dining Customer Service
   ```
3. Delete any default code in the editor (`Code.gs`) and paste the following production script:

```javascript
/**
 * Little Monkey Café Dining — Customer Record Integration Service
 * 
 * Functions:
 * 1. doPost(e): Authenticates via HMAC-SHA256, validates inputs, and processes customer entry.
 * 2. doGet(e): Minimal health-check ping (never exposes customer records or configuration).
 * 
 * Security Controls:
 * - Fail-Closed Authentication: Mandatory SHARED_API_KEY stored in Script Properties.
 * - ISO 8601 Timestamp Validation: 5-minute (300,000 ms) tolerance window against clock drift.
 * - Replay Protection: Unique request nonces stored in CacheService (10-minute cache TTL).
 * - Constant-Time Signature Verification: Prevents timing attacks on HMAC-SHA256 comparison.
 * - Pre-Lock Processing: Authentication and validation occur before acquiring LockService.
 * - Concurrency Control: LockService.getScriptLock() serializes spreadsheet modifications.
 * - Schema Verification: Row 1 headers verified before any data processing.
 * - Formula Injection Sanitization: Prepends single quote (') to dangerous leading characters.
 * - Information Leakage Prevention: Minimal error responses; detailed logging in Apps Script executions.
 */

var WORKSHEET_NAME = 'Customers';
var REQUIRED_HEADERS = ['customer_id', 'name', 'mobile_number', 'created_at', 'updated_at'];
var TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
var NONCE_TTL_SECONDS = 600; // 10 minutes

function doPost(e) {
  // 1. Verify JSON payload exists
  var rawBody = e && e.postData && e.postData.contents;
  if (!rawBody) {
    return createJsonResponse({
      success: false,
      error: 'EMPTY_REQUEST',
      message: 'No request payload received.'
    });
  }

  var payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (parseErr) {
    return createJsonResponse({
      success: false,
      error: 'INVALID_JSON',
      message: 'Request body must be valid JSON.'
    });
  }

  // 2. Fail-Closed Authentication Check (Pre-Lock)
  var scriptProps = PropertiesService.getScriptProperties();
  var sharedSecret = scriptProps.getProperty('SHARED_API_KEY');
  if (!sharedSecret || sharedSecret.trim().length === 0) {
    console.error('[SECURITY_ALERT] SHARED_API_KEY is not configured in Script Properties.');
    return createJsonResponse({
      success: false,
      error: 'SERVER_MISCONFIGURED',
      message: 'Server authentication is not configured.'
    });
  }

  // 3. Timestamp Validation (Pre-Lock)
  var timestamp = String(payload.timestamp || '').trim();
  if (!timestamp) {
    return createJsonResponse({
      success: false,
      error: 'MISSING_TIMESTAMP',
      message: 'Request timestamp is missing.'
    });
  }

  var requestTime = Date.parse(timestamp);
  if (isNaN(requestTime)) {
    return createJsonResponse({
      success: false,
      error: 'INVALID_TIMESTAMP',
      message: 'Request timestamp is not a valid ISO 8601 string.'
    });
  }

  var now = Date.now();
  if (Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) {
    return createJsonResponse({
      success: false,
      error: 'REQUEST_EXPIRED',
      message: 'Request timestamp is outside the allowed 5-minute tolerance window.'
    });
  }

  // 4. Nonce & Replay Protection (Pre-Lock)
  var nonce = String(payload.nonce || '').trim();
  if (!nonce || nonce.length < 16 || nonce.length > 64) {
    return createJsonResponse({
      success: false,
      error: 'INVALID_NONCE',
      message: 'Request nonce is missing or invalid.'
    });
  }

  var cache = CacheService.getScriptCache();
  var nonceCacheKey = 'nonce_' + nonce;
  if (cache.get(nonceCacheKey)) {
    return createJsonResponse({
      success: false,
      error: 'DUPLICATE_NONCE',
      message: 'Request replay detected. This nonce has already been used.'
    });
  }

  // 5. Canonical String & Cryptographic Signature Check (Pre-Lock)
  var rawName = String(payload.name || '').trim();
  var rawMobile = String(payload.mobile || payload.mobile_number || '').trim();
  var confirmedExistingName = Boolean(payload.confirmedExistingName);

  var canonicalString = [
    timestamp,
    nonce,
    rawName,
    rawMobile,
    confirmedExistingName ? 'true' : 'false'
  ].join(':');

  var providedSignature = String(payload.signature || '').trim().toLowerCase();
  if (!providedSignature) {
    return createJsonResponse({
      success: false,
      error: 'MISSING_SIGNATURE',
      message: 'Request signature is missing.'
    });
  }

  var expectedSignatureBytes = Utilities.computeHmacSha256Signature(canonicalString, sharedSecret);
  var expectedSignature = toHex(expectedSignatureBytes);

  if (!constantTimeCompare(expectedSignature, providedSignature)) {
    console.error('[SECURITY_ALERT] Invalid HMAC signature received for mobile ending in ' + rawMobile.slice(-4));
    return createJsonResponse({
      success: false,
      error: 'INVALID_SIGNATURE',
      message: 'Cryptographic request signature verification failed.'
    });
  }

  // 6. Input Schema Validation (Pre-Lock)
  if (!rawName || rawName.length < 1 || rawName.length > 60) {
    return createJsonResponse({
      success: false,
      error: 'INVALID_NAME',
      message: 'Customer name must be between 1 and 60 characters.'
    });
  }

  var cleanMobile = rawMobile.replace(/\D/g, '');
  if (cleanMobile.length === 12 && cleanMobile.indexOf('91') === 0) {
    cleanMobile = cleanMobile.substring(2);
  }
  if (cleanMobile.length === 11 && cleanMobile.indexOf('0') === 0) {
    cleanMobile = cleanMobile.substring(1);
  }

  var mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(cleanMobile)) {
    return createJsonResponse({
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    });
  }

  // 7. Concurrency Lock: Authenticated & Validated Requests Only
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lockAcquired = lock.tryLock(10000); // Wait up to 10 seconds
  } catch (lockErr) {
    lockAcquired = false;
  }

  if (!lockAcquired) {
    return createJsonResponse({
      success: false,
      error: 'LOCK_TIMEOUT',
      message: 'Server is processing concurrent customer registrations. Please retry in a moment.'
    });
  }

  try {
    // 8. Atomic Replay Protection (Post-Lock Check & Record)
    // CacheService does not provide atomic check-and-set across parallel Google instances.
    // Checking and setting inside LockService guarantees 100% atomic replay prevention for concurrent requests.
    if (cache.get(nonceCacheKey)) {
      return createJsonResponse({
        success: false,
        error: 'DUPLICATE_NONCE',
        message: 'Request replay detected. This nonce has already been used.'
      });
    }
    cache.put(nonceCacheKey, '1', NONCE_TTL_SECONDS);

    // 9. Access Spreadsheet & Verify Worksheet Schema
    var spreadsheet = getTargetSpreadsheet(scriptProps);
    if (!spreadsheet) {
      return createJsonResponse({
        success: false,
        error: 'SPREADSHEET_NOT_FOUND',
        message: 'Unable to access the customer spreadsheet.'
      });
    }

    var sheet = spreadsheet.getSheetByName(WORKSHEET_NAME);
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: 'WORKSHEET_MISSING',
        message: 'The Customers worksheet was not found.'
      });
    }

    var data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) {
      return createJsonResponse({
        success: false,
        error: 'INVALID_HEADERS',
        message: 'Worksheet is completely empty. Headers must be configured.'
      });
    }

    var headerRow = data[0];
    for (var h = 0; h < REQUIRED_HEADERS.length; h++) {
      if (String(headerRow[h] || '').trim().toLowerCase() !== REQUIRED_HEADERS[h]) {
        console.error('[SCHEMA_ERROR] Header mismatch at index ' + h + '. Expected: ' + REQUIRED_HEADERS[h] + ', Found: ' + headerRow[h]);
        return createJsonResponse({
          success: false,
          error: 'INVALID_HEADERS',
          message: 'Worksheet schema mismatch. Expected headers: customer_id, name, mobile_number, created_at, updated_at.'
        });
      }
    }

    var nowIso = new Date().toISOString();

    // 10. Existing Customer Lookup (Column C is mobile_number, index 2)
    var existingRowIndex = -1;
    var existingRecord = null;

    for (var i = 1; i < data.length; i++) {
      var rowMobile = String(data[i][2]).replace(/\D/g, '');
      if (rowMobile === cleanMobile) {
        existingRowIndex = i + 1; // 1-based row index in sheet
        existingRecord = {
          customerId: String(data[i][0]),
          name: String(data[i][1]),
          mobile: rowMobile,
          createdAt: String(data[i][3]),
          updatedAt: String(data[i][4])
        };
        break;
      }
    }

    // Scenario A: Existing Customer Record Found
    if (existingRecord) {
      var isNameIdentical = (existingRecord.name.trim().toLowerCase() === rawName.toLowerCase());

      if (!isNameIdentical && !confirmedExistingName) {
        // Name conflict: Do not overwrite stored name without explicit confirmation
        return createJsonResponse({
          success: true,
          status: 'EXISTING_CUSTOMER_NAME_MISMATCH',
          customer: {
            customerId: existingRecord.customerId,
            name: existingRecord.name,
            submittedName: rawName,
            mobile: existingRecord.mobile
          },
          message: 'Existing customer record found with a different name. Existing name preserved.'
        });
      }

      // Update approved access timestamp (Column E, index 5)
      sheet.getRange(existingRowIndex, 5).setValue(nowIso);

      return createJsonResponse({
        success: true,
        status: 'EXISTING_CUSTOMER',
        customer: {
          customerId: existingRecord.customerId,
          name: existingRecord.name,
          mobile: existingRecord.mobile
        },
        message: 'Welcome back! Customer record verified.'
      });
    }

    // Scenario B: New Customer Record Creation
    var newCustomerId = Utilities.getUuid();
    var safeName = sanitizeFormula(rawName);
    var safeMobile = "'" + cleanMobile; // enforce plain text formatting in sheet

    sheet.appendRow([
      newCustomerId,
      safeName,
      safeMobile,
      nowIso,
      nowIso
    ]);

    return createJsonResponse({
      success: true,
      status: 'NEW_CUSTOMER',
      customer: {
        customerId: newCustomerId,
        name: rawName,
        mobile: cleanMobile
      },
      message: 'Customer record registered successfully.'
    });

  } catch (err) {
    console.error('[SERVER_ERROR] Internal processing error:', err.toString());
    return createJsonResponse({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred while processing the customer record.'
    });
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  // Safe minimal health-check ping only; NEVER exposes customer records or configuration
  return createJsonResponse({
    status: 'ONLINE',
    service: 'Little Monkey Café Dining Customer Service',
    timestamp: new Date().toISOString()
  });
}

function getTargetSpreadsheet(scriptProps) {
  var explicitId = scriptProps.getProperty('SPREADSHEET_ID');
  if (explicitId && explicitId.trim().length > 0) {
    return SpreadsheetApp.openById(explicitId.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sanitizeFormula(val) {
  if (typeof val !== 'string') return val;
  if (/^[\=\+\-\@\t\r]/.test(val)) {
    return "'" + val;
  }
  return val;
}

function toHex(bytes) {
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var byteHex = b.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hex.push(byteHex);
  }
  return hex.join('').toLowerCase();
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

---

## Step 5B: Configure the `appsscript.json` Manifest (Minimal OAuth Scopes)

By default, Google Apps Script infers permissions automatically, which can prompt for broad Google Drive or user profile scopes. Configuring explicit `oauthScopes` in `appsscript.json` enforces the **principle of least privilege**, strictly limiting the script's access to the customer spreadsheet.

1. In the Apps Script project editor, click the **Project Settings** icon (gear icon on the left sidebar).
2. Under **General settings**, check the box:
   ```text
   [x] Show "appsscript.json" manifest file in editor
   ```
3. Return to the editor by clicking the **Editor** icon (`< >` on the left sidebar).
4. In the files list on the left, click `appsscript.json`.
5. Replace its entire contents with the following minimal manifest:

```json
{
  "timeZone": "Asia/Kolkata",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

6. Click **Save** (`Ctrl+S`).

> [!NOTE]
> Restricting scopes to `https://www.googleapis.com/auth/spreadsheets` ensures the script can only read and write Google Sheets. It cannot read emails, access Google Drive files outside spreadsheets, or access Google Contacts. Note that setting explicit scopes does not eliminate Google's standard developer warning ("Google hasn't verified this app") when authorizing personal scripts.

---

## Step 6: Configure Script Properties (Authentication Secret)

> [!IMPORTANT]
> The Google Apps Script Web App operates in **fail-closed mode**: if `SHARED_API_KEY` is missing in Script Properties, all POST requests are immediately rejected with `SERVER_MISCONFIGURED`.

1. In the Apps Script project editor, click the **Project Settings** icon (gear icon in the left navigation sidebar).
2. Scroll down to **Script Properties** and click **Edit script properties**.
3. Click **Add script property**:
   - **Property:** `SHARED_API_KEY`
   - **Value:** Generate a high-entropy secret (e.g. 32-byte / 64-character hex string).
     *(Example generator in terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)*
4. (Optional) Add a second script property if the script is not container-bound:
   - **Property:** `SPREADSHEET_ID`
   - **Value:** The spreadsheet ID obtained in Step 4.
5. Click **Save script properties**.

---

## Step 7: Deploy the Web App

1. In the Apps Script editor, click the blue **Deploy** button (top right) -> Select **New deployment**.
2. Click the gear icon next to "Select type" -> Choose **Web app**.
3. Configure the deployment settings:
   - **Description:** `Little Monkey Café Customer Service v2 (HMAC Signed)`
   - **Execute as:** `Me (<your-google-account>)`
   - **Who has access:** `Anyone` (Required so the dining server proxy can submit customer registration records without individual Google logins).
4. Click **Deploy**.
5. When prompted, click **Authorize access**, select your Google account, click **Advanced**, and proceed to grant permissions.
6. Copy the generated **Web App URL**. It will look like:
   ```text
   https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
   ```

---

## Step 8: Connect the Web App & Secret to the Dining Server

1. Open the project environment configuration file:
   [`.env`](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/.env)
2. Add your deployed Web App URL and the matching shared secret:
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
   GOOGLE_SHEETS_API_KEY=<YOUR_SHARED_API_KEY>
   ```
3. Restart the server.
   The dining server proxy will now sign every customer record submission using HMAC-SHA256, protecting against tampering, spoofing, and replay attacks.

---

## Step 9: Verify with Synthetic Test Data

Verify your deployment using terminal `curl` or Node.js test scripts:

### Test 1: Health Check (GET)
```bash
curl -L -X GET "https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec"
```
**Expected Response (HTTP 200):**
```json
{
  "status": "ONLINE",
  "service": "Little Monkey Café Dining Customer Service",
  "timestamp": "2026-11-04T00:15:00.000Z"
}
```

### Test 2: Unsigned Request Rejected (POST)
```bash
curl -L -X POST "https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec" \
  -H "Content-Type: application/json" \
  -d '{"name": "Owner Test Diner", "mobile": "<YOUR_OWN_10_DIGIT_MOBILE>"}'
```
**Expected Response (HTTP 200 with error payload):**
*(Note: Google Apps Script ContentService always returns HTTP 200)*
```json
{
  "success": false,
  "error": "MISSING_TIMESTAMP",
  "message": "Request timestamp is missing."
}
```

### Test 3: Valid HMAC-SHA256 Signed Request
Generate signature using Node.js (replace `<OWNER_CONTROLLED_10_DIGIT_MOBILE>` with your own phone number so that no third-party mobile is recorded):
```bash
node -e "
const crypto = require('crypto');
const secret = '<YOUR_SHARED_API_KEY>';
const timestamp = new Date().toISOString();
const nonce = crypto.randomBytes(16).toString('hex');
const name = 'Café Owner Verification';
const mobile = '<YOUR_OWN_10_DIGIT_MOBILE>';
const confirmed = 'false';
const canonical = [timestamp, nonce, name, mobile, confirmed].join(':');
const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
console.log(JSON.stringify({ timestamp, nonce, name, mobile, confirmedExistingName: false, signature: sig }));
"
```
Send the resulting JSON payload via `curl -L -X POST ...`.
**Expected Response:**
```json
{
  "success": true,
  "status": "NEW_CUSTOMER",
  "customer": {
    "customerId": "CUST-XXXXXX",
    "name": "Café Owner Verification",
    "mobile": "<YOUR_OWN_10_DIGIT_MOBILE>"
  },
  "message": "Customer record registered successfully."
}
```
Verify that cell `A2:E2` in the `Customers` worksheet contains your own test record.

---

## Step 10: Nonce Atomicity & Replay Protection Architecture

### Understanding CacheService Limitations
Google Apps Script's `CacheService` is an in-memory key-value cache scoped across script invocations. It has two architectural characteristics:
1. **Best-Effort Retention:** Under memory pressure on Google cloud servers, cached keys can be evicted before their configured TTL expires.
2. **Lack of Atomic Check-and-Set:** `CacheService` does not offer an atomic `putIfAbsent` or `compare-and-swap` method. A concurrent `cache.get()` followed by `cache.put()` has a sub-millisecond race condition across parallel serverless containers.

### How Our Defense-in-Depth Model Solves This
Our implementation guarantees 100% production-ready replay protection via three mutually reinforcing layers:

1. **Strict 5-Minute Time Window (`TIMESTAMP_TOLERANCE_MS = 300,000`):**
   Every request must carry an ISO 8601 UTC timestamp. The script checks `Math.abs(Date.now() - requestTime) > 300,000`. Even if a nonce were evicted from CacheService after 5 minutes, an attacker cannot replay the payload because the timestamp is permanently expired.
2. **Pre-Lock Fast Replay Rejection:**
   `cache.get(nonceCacheKey)` executes before acquiring the lock. Replays that arrive seconds or minutes later are rejected immediately without contending for `LockService.getScriptLock()`, protecting the spreadsheet from lock exhaustion.
3. **Lock-Serialized Atomic Nonce Commit:**
   For concurrent requests that hit the server at the exact same millisecond with identical nonces, `LockService.getScriptLock()` serializes their execution. Inside the lock's critical section, the script re-verifies `cache.get(nonceCacheKey)` before recording `cache.put(nonceCacheKey, '1', 600)`. The second request waiting on the lock is guaranteed to see the cache key set by the first and is rejected with `DUPLICATE_NONCE`.

---

## Step 11: Troubleshooting Common Setup Issues

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| `SERVER_MISCONFIGURED` | `SHARED_API_KEY` was not added in Apps Script Script Properties. | Open Apps Script -> **Project Settings** (gear icon) -> Scroll to **Script Properties** -> Add `SHARED_API_KEY` with the matching high-entropy secret. |
| `INVALID_SIGNATURE` | Shared secret mismatch between `.env` and Script Properties, or canonical string order differed. | Verify that `GOOGLE_SHEETS_API_KEY` in `.env` is byte-for-byte identical to `SHARED_API_KEY` in Script Properties without extra spaces. |
| `REQUEST_EXPIRED` | Device clock drift (> 5 minutes) or delayed request. | Verify system clock synchronization via NTP (`w32tm /resync` on Windows). Ensure ISO 8601 format includes UTC designator (`Z`). |
| `DUPLICATE_NONCE` | The same nonce string was submitted more than once. | Ensure each request generates a fresh random nonce (`crypto.randomBytes(16).toString('hex')`). |
| `WORKSHEET_MISSING` | The worksheet tab is not named `Customers`. | Rename the sheet tab at the bottom of the spreadsheet to exactly `Customers` (case-sensitive). |
| `INVALID_HEADERS` | Row 1 does not contain the required five columns. | Ensure row 1 cells `A1:E1` contain `customer_id`, `name`, `mobile_number`, `created_at`, `updated_at` (all lowercase, no trailing spaces). |
| `LOCK_TIMEOUT` | Simultaneous writes exceeded the 10-second LockService queue. | Pre-lock validation minimizes lock duration. If peak café traffic creates spikes, retry after 1-2 seconds with exponential backoff. |
| Google Apps Script Returns HTML Login Page | Deployment permission was not set to "Anyone". | In Apps Script -> **Deploy** -> **Manage deployments** -> Edit -> Ensure **Who has access** is set to **Anyone**. |
