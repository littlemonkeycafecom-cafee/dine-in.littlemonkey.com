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
 * - Replay Protection: Unique request nonces checked via CacheService (600s TTL).
 * - Nonce Atomicity: Checked and committed inside LockService to eliminate race conditions.
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

  // 4. Nonce & Replay Protection (Pre-Lock Fast Check)
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
  var action = String(payload.action || 'register').trim().toLowerCase();
  var rawName = String(payload.name || '').trim();
  var rawMobile = String(payload.mobile || payload.mobile_number || '').trim();
  var confirmedExistingName = Boolean(payload.confirmedExistingName);

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

  // Canonical string supports both action-based lookup/continue and legacy 5-field registration
  var canonicalStrings = [];
  if (action === 'lookup') {
    canonicalStrings.push([timestamp, nonce, 'lookup', cleanMobile].join(':'));
  } else if (action === 'continue') {
    canonicalStrings.push([timestamp, nonce, 'continue', cleanMobile].join(':'));
  }
  // Standard / legacy canonical string (always supported for compatibility)
  canonicalStrings.push([
    timestamp,
    nonce,
    rawName,
    rawMobile,
    confirmedExistingName ? 'true' : 'false'
  ].join(':'));

  var providedSignature = String(payload.signature || '').trim().toLowerCase();
  if (!providedSignature) {
    return createJsonResponse({
      success: false,
      error: 'MISSING_SIGNATURE',
      message: 'Request signature is missing.'
    });
  }

  var signatureValid = false;
  for (var s = 0; s < canonicalStrings.length; s++) {
    var expectedBytes = Utilities.computeHmacSha256Signature(canonicalStrings[s], sharedSecret);
    var expectedSig = toHex(expectedBytes);
    if (constantTimeCompare(expectedSig, providedSignature)) {
      signatureValid = true;
      break;
    }
  }

  if (!signatureValid) {
    console.error('[SECURITY_ALERT] Invalid HMAC signature received for mobile ending in ' + cleanMobile.slice(-4));
    return createJsonResponse({
      success: false,
      error: 'INVALID_SIGNATURE',
      message: 'Cryptographic request signature verification failed.'
    });
  }

  // 6. Action: READ-ONLY CUSTOMER LOOKUP
  if (action === 'lookup') {
    // Lookup is strictly read-only: no LockService required, never appends or alters rows
    var spreadsheetLookup = getTargetSpreadsheet(scriptProps);
    if (!spreadsheetLookup) {
      return createJsonResponse({
        success: false,
        error: 'SPREADSHEET_NOT_FOUND',
        message: 'Unable to access the customer spreadsheet.'
      });
    }

    var sheetLookup = spreadsheetLookup.getSheetByName(WORKSHEET_NAME);
    if (!sheetLookup) {
      return createJsonResponse({
        success: false,
        error: 'WORKSHEET_MISSING',
        message: 'The Customers worksheet was not found.'
      });
    }

    var lookupData = sheetLookup.getDataRange().getValues();
    if (!lookupData || lookupData.length <= 1) {
      return createJsonResponse({
        success: true,
        exists: false,
        mobile: cleanMobile,
        message: 'No registered customer found for this mobile number.'
      });
    }

    for (var l = 1; l < lookupData.length; l++) {
      var rowMob = String(lookupData[l][2]).replace(/\D/g, '');
      if (rowMob === cleanMobile) {
        return createJsonResponse({
          success: true,
          exists: true,
          customer: {
            customerId: String(lookupData[l][0]),
            name: String(lookupData[l][1]),
            mobile: rowMob,
            createdAt: String(lookupData[l][3]),
            updatedAt: String(lookupData[l][4])
          },
          message: 'Existing customer record found.'
        });
      }
    }

    return createJsonResponse({
      success: true,
      exists: false,
      mobile: cleanMobile,
      message: 'No registered customer found for this mobile number.'
    });
  }

  // 7. Action: REGISTRATION / CONTINUATION INPUT VALIDATION
  if (action !== 'continue') {
    if (!rawName || rawName.length < 1 || rawName.length > 60) {
      return createJsonResponse({
        success: false,
        error: 'INVALID_NAME',
        message: 'Customer name must be between 1 and 60 characters.'
      });
    }
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
    // Checking and setting inside LockService guarantees atomic replay prevention for concurrent requests.
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
      if (action !== 'continue') {
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

    // If action is continue but record not found, reject with CUSTOMER_NOT_FOUND without appending
    if (action === 'continue') {
      return createJsonResponse({
        success: false,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'No registered customer found for this mobile number.'
      });
    }

    // Scenario B: Sequential Numeric Customer ID Allocation
    // 1. Scan sheet data for max existing numeric ID (ignores CUST-XXXX alphanumeric IDs)
    var maxNumericId = 0;
    for (var r = 1; r < data.length; r++) {
      var rowIdStr = String(data[r][0] || '').trim();
      if (/^\d+$/.test(rowIdStr)) {
        var num = parseInt(rowIdStr, 10);
        if (num > maxNumericId) {
          maxNumericId = num;
        }
      }
    }

    // 2. Read persistent sequence high-water mark from ScriptProperties
    var lastPropertyId = 0;
    var rawProp = scriptProps.getProperty('LAST_CUSTOMER_ID');
    if (rawProp && /^\d+$/.test(rawProp.trim())) {
      lastPropertyId = parseInt(rawProp.trim(), 10);
    }

    // 3. Allocate next sequential numeric ID without using row counts or reusing deleted IDs
    var nextSequentialId = Math.max(maxNumericId, lastPropertyId) + 1;
    var newCustomerId = String(nextSequentialId);

    // 4. Update persistent sequence high-water mark (atomic inside LockService)
    scriptProps.setProperty('LAST_CUSTOMER_ID', newCustomerId);

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
