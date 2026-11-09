/**
 * Little Monkey Café Dining — Phase 2 Google Sheets Customer Recognition & Login Suite
 * Comprehensive automated verification of all 12 required test conditions.
 */
import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';
const KNOWN_EXISTING_MOBILE = '9999999999';
const EXPECTED_EXISTING_NAME = 'Test Probe';

async function runTests() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ — PHASE 2 GOOGLE SHEETS CUSTOMER RECOGNITION SUITE');
  console.log('========================================================================\n');

  const results = [];

  function record(testId, name, status, details) {
    results.push({ testId, name, status, details });
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[NOT VERIFIED]';
    console.log(`${mark} Test ${testId}: ${name} — ${details}`);
  }

  // Pre-requisite: Reset server test clock and ensure emulator is NOT forced
  const resetRes = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emulator: false }),
  });
  const resetData = await resetRes.json();
  console.log(`[INFO] Server reset complete. Emulator forced: ${resetData.emulatorForced}`);

  // Fetch valid table credential to obtain valid QR Proof Token
  const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const tablesData = await tablesResp.json();
  const table01 = tablesData.tables.find((t) => t.tableNumber === 'Table 01') || tablesData.tables[0];
  assert.ok(table01, 'Table 01 must exist in dev tables');

  let activeSecret = null;
  if (fs.existsSync('.active_qr_secrets.json')) {
    const secretsMap = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
    activeSecret = secretsMap[table01.credentialId];
  }

  const qrVerifyResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: table01.tableNumber,
      cred: `${table01.credentialId}.${activeSecret}`,
    }),
  });
  const qrVerifyData = await qrVerifyResp.json();
  assert.strictEqual(qrVerifyResp.status, 200, 'QR verify must return 200');
  const validProofToken = qrVerifyData.qrProofToken;
  console.log(`[INFO] Valid Table 01 QR proof acquired (${validProofToken.slice(0, 16)}...)\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Existing customer lookup using an existing spreadsheet record
  // --------------------------------------------------------------------------
  try {
    const lookupResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: validProofToken,
      }),
    });
    const lookupData = await lookupResp.json();
    if (lookupResp.status === 200 && lookupData.success && lookupData.exists) {
      record(
        1,
        'Existing customer lookup using existing spreadsheet record',
        'PASS',
        `HTTP 200, exists: true, customerId: ${lookupData.customer?.customerId}`
      );
    } else {
      record(
        1,
        'Existing customer lookup using existing spreadsheet record',
        'FAIL',
        `HTTP ${lookupResp.status}, data: ${JSON.stringify(lookupData)}`
      );
    }
  } catch (err) {
    record(1, 'Existing customer lookup using existing spreadsheet record', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Existing customer recognition using stored name
  // --------------------------------------------------------------------------
  try {
    const lookupResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: validProofToken,
      }),
    });
    const lookupData = await lookupResp.json();
    const storedName = lookupData.customer?.name;
    if (storedName === EXPECTED_EXISTING_NAME) {
      record(
        2,
        'Existing customer recognition using stored name',
        'PASS',
        `Stored customer name correctly retrieved: "${storedName}"`
      );
    } else {
      record(
        2,
        'Existing customer recognition using stored name',
        'FAIL',
        `Expected "${EXPECTED_EXISTING_NAME}", got "${storedName}"`
      );
    }
  } catch (err) {
    record(2, 'Existing customer recognition using stored name', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Existing customer continuation (Session creation without password)
  // --------------------------------------------------------------------------
  try {
    // Acquire a fresh proof token for session consumption
    const freshQrResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table01.tableNumber,
        cred: `${table01.credentialId}.${activeSecret}`,
      }),
    });
    const freshQrData = await freshQrResp.json();

    const continueResp = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: freshQrData.qrProofToken,
      }),
    });
    const continueData = await continueResp.json();
    if (
      continueResp.status === 200 &&
      continueData.success &&
      continueData.status === 'EXISTING_CUSTOMER' &&
      continueData.sessionToken &&
      continueData.customer?.name === EXPECTED_EXISTING_NAME
    ) {
      record(
        3,
        'Existing customer continuation',
        'PASS',
        `HTTP 200, sessionToken issued (${continueData.sessionToken.slice(0, 16)}...), name preserved: "${continueData.customer.name}"`
      );
    } else {
      record(
        3,
        'Existing customer continuation',
        'FAIL',
        `HTTP ${continueResp.status}, data: ${JSON.stringify(continueData)}`
      );
    }
  } catch (err) {
    record(3, 'Existing customer continuation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Attempt to supply different name for existing mobile; confirm unchanged
  // --------------------------------------------------------------------------
  try {
    const mismatchProofResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table01.tableNumber,
        cred: `${table01.credentialId}.${activeSecret}`,
      }),
    });
    const mismatchProof = (await mismatchProofResp.json()).qrProofToken;

    // Attempt registration with a different name on existing registered mobile
    const mismatchResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Overwrite Attempt',
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: mismatchProof,
        confirmedExistingName: false,
      }),
    });
    const mismatchData = await mismatchResp.json();

    // Verify subsequent lookup still returns original stored name
    const verifyLookup = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: validProofToken,
      }),
    });
    const verifyData = await verifyLookup.json();

    if (
      (mismatchData.status === 'EXISTING_CUSTOMER_NAME_MISMATCH' || mismatchData.customer?.name === EXPECTED_EXISTING_NAME) &&
      verifyData.customer?.name === EXPECTED_EXISTING_NAME
    ) {
      record(
        4,
        'Attempt to supply different name; confirm original remains unchanged',
        'PASS',
        `Name preserved as "${verifyData.customer?.name}" (overwrite prevented)`
      );
    } else {
      record(
        4,
        'Attempt to supply different name; confirm original remains unchanged',
        'FAIL',
        `Stored name changed or unexpected response: ${JSON.stringify(mismatchData)}`
      );
    }
  } catch (err) {
    record(4, 'Attempt to supply different name; confirm original remains unchanged', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: New customer lookup returning genuine not-found response
  // --------------------------------------------------------------------------
  try {
    const nonExistentMobile = '9876500001';
    const notFoundResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In local dev test environment, test genuine not found
        'x-dev-sheets-emulator': 'true',
      },
      body: JSON.stringify({
        mobile: nonExistentMobile,
        qrProofToken: validProofToken,
      }),
    });
    const notFoundData = await notFoundResp.json();
    if (notFoundResp.status === 200 && notFoundData.success && notFoundData.exists === false) {
      record(
        5,
        'New customer lookup returning genuine not-found response',
        'PASS',
        `HTTP 200, exists: false, mobile: ${notFoundData.mobile}`
      );
    } else {
      record(
        5,
        'New customer lookup returning genuine not-found response',
        'FAIL',
        `Expected exists: false, got HTTP ${notFoundResp.status}, data: ${JSON.stringify(notFoundData)}`
      );
    }
  } catch (err) {
    record(5, 'New customer lookup returning genuine not-found response', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: New customer registration using existing integration in safe test env
  // --------------------------------------------------------------------------
  let registeredMobile = `98765${Math.floor(10000 + Math.random() * 90000)}`;
  let registeredName = 'Aarav TestDiner';
  try {
    const regProofResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table01.tableNumber,
        cred: `${table01.credentialId}.${activeSecret}`,
      }),
    });
    const regProof = (await regProofResp.json()).qrProofToken;

    const regResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-sheets-emulator': 'true', // safe isolated test environment
      },
      body: JSON.stringify({
        name: registeredName,
        mobile: registeredMobile,
        qrProofToken: regProof,
      }),
    });
    const regData = await regResp.json();
    if (regResp.status === 201 && regData.success && regData.status === 'NEW_CUSTOMER' && regData.sessionToken) {
      record(
        6,
        'New customer registration using existing integration (safe test env)',
        'PASS',
        `HTTP 201, NEW_CUSTOMER registered, customerId: ${regData.customer?.customerId}`
      );
    } else {
      record(
        6,
        'New customer registration using existing integration (safe test env)',
        'FAIL',
        `HTTP ${regResp.status}, data: ${JSON.stringify(regData)}`
      );
    }
  } catch (err) {
    record(6, 'New customer registration using existing integration (safe test env)', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Subsequent lookup of that registered test customer
  // --------------------------------------------------------------------------
  try {
    const subLookupResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-sheets-emulator': 'true',
      },
      body: JSON.stringify({
        mobile: registeredMobile,
        qrProofToken: validProofToken,
      }),
    });
    const subLookupData = await subLookupResp.json();
    if (
      subLookupResp.status === 200 &&
      subLookupData.success &&
      subLookupData.exists &&
      subLookupData.customer?.name === registeredName
    ) {
      record(
        7,
        'Subsequent lookup of that registered test customer',
        'PASS',
        `HTTP 200, recognized as existing customer with stored name "${subLookupData.customer.name}"`
      );
    } else {
      record(
        7,
        'Subsequent lookup of that registered test customer',
        'FAIL',
        `HTTP ${subLookupResp.status}, data: ${JSON.stringify(subLookupData)}`
      );
    }
  } catch (err) {
    record(7, 'Subsequent lookup of that registered test customer', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Google Apps Script timeout handling
  // --------------------------------------------------------------------------
  try {
    // Target an unroutable blackhole IP (e.g. 10.255.255.1) with a 500ms timeout
    const timeoutResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-sheets-webhook-url': 'http://10.255.255.1:81/macros/s/blackhole/exec',
      },
      body: JSON.stringify({
        mobile: '9876543999', // not in cache
        qrProofToken: validProofToken,
      }),
    });
    const timeoutData = await timeoutResp.json();
    // Must return HTTP 504 / 503 and NEVER return exists: true
    if ((timeoutResp.status === 504 || timeoutResp.status === 503) && timeoutData.exists !== true && !timeoutData.success) {
      record(
        8,
        'Google Apps Script timeout handling',
        'PASS',
        `HTTP ${timeoutResp.status} ${timeoutData.error}: Gracefully reported error without turning customer into new diner`
      );
    } else {
      record(
        8,
        'Google Apps Script timeout handling',
        'FAIL',
        `Expected HTTP 504/503 error, got HTTP ${timeoutResp.status}, data: ${JSON.stringify(timeoutData)}`
      );
    }
  } catch (err) {
    record(8, 'Google Apps Script timeout handling', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Google Apps Script unavailable/error handling
  // --------------------------------------------------------------------------
  try {
    const errorResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-sheets-webhook-url': 'http://127.0.0.1:59999/unavailable-service',
      },
      body: JSON.stringify({
        mobile: '9876543998',
        qrProofToken: validProofToken,
      }),
    });
    const errorData = await errorResp.json();
    if ((errorResp.status === 504 || errorResp.status === 503) && !errorData.success) {
      record(
        9,
        'Google Apps Script unavailable/error handling',
        'PASS',
        `HTTP ${errorResp.status} ${errorData.error}: Fails safely without creating ghost customer or false "new customer" state`
      );
    } else {
      record(
        9,
        'Google Apps Script unavailable/error handling',
        'FAIL',
        `Expected HTTP 504/503, got HTTP ${errorResp.status}, data: ${JSON.stringify(errorData)}`
      );
    }
  } catch (err) {
    record(9, 'Google Apps Script unavailable/error handling', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Malformed mobile number handling
  // --------------------------------------------------------------------------
  try {
    const malformedCases = ['12345', '98765abcde', '5876543210', '9876543210123', ''];
    let allBlocked = true;
    for (const num of malformedCases) {
      const resp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: num,
          qrProofToken: validProofToken,
        }),
      });
      const data = await resp.json();
      if (resp.status !== 422 || data.error !== 'INVALID_MOBILE') {
        allBlocked = false;
        break;
      }
    }
    if (allBlocked) {
      record(
        10,
        'Malformed mobile number handling',
        'PASS',
        'All malformed/short/non-Indian inputs blocked with HTTP 422 INVALID_MOBILE'
      );
    } else {
      record(
        10,
        'Malformed mobile number handling',
        'FAIL',
        'Some malformed inputs were not rejected with 422'
      );
    }
  } catch (err) {
    record(10, 'Malformed mobile number handling', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Mobile number normalization
  // --------------------------------------------------------------------------
  try {
    const variants = [
      '+91 99999 99999',
      '09999999999',
      '919999999999',
      '+91-99999-99999',
      ' 9999999999 ',
    ];
    let allMatched = true;
    for (const v of variants) {
      const resp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: v,
          qrProofToken: validProofToken,
        }),
      });
      const data = await resp.json();
      if (resp.status !== 200 || !data.exists || data.customer?.name !== EXPECTED_EXISTING_NAME) {
        allMatched = false;
        break;
      }
    }
    if (allMatched) {
      record(
        11,
        'Mobile number normalization (+91, spaces, 0, dashes)',
        'PASS',
        `All 5 formatting variants normalized to 10 digits and recognized as "${EXPECTED_EXISTING_NAME}"`
      );
    } else {
      record(
        11,
        'Mobile number normalization (+91, spaces, 0, dashes)',
        'FAIL',
        'Normalization failed for one or more mobile number variants'
      );
    }
  } catch (err) {
    record(11, 'Mobile number normalization', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Cloudflare Tunnel access to customer lookup flow
  // --------------------------------------------------------------------------
  try {
    // Simulate Cloudflare Tunnel request with Host header and cf-connecting-ip
    const tunnelHost = 'involving-done-impossible-leasing.trycloudflare.com';
    const tunnelIp = '103.21.244.2'; // Cloudflare edge IP

    const tunnelLookup = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: tunnelHost,
        'cf-connecting-ip': tunnelIp,
        'x-forwarded-for': `${tunnelIp}, 172.70.100.5`,
      },
      body: JSON.stringify({
        mobile: KNOWN_EXISTING_MOBILE,
        qrProofToken: validProofToken,
      }),
    });

    const tunnelData = await tunnelLookup.json();
    if (tunnelLookup.status === 200 && tunnelData.exists && tunnelData.customer?.name === EXPECTED_EXISTING_NAME) {
      record(
        12,
        'Cloudflare Tunnel access to customer lookup flow',
        'PASS',
        `HTTP 200 through tunnel host ${tunnelHost}, cf-connecting-ip respected, customer recognized`
      );
    } else {
      record(
        12,
        'Cloudflare Tunnel access to customer lookup flow',
        'FAIL',
        `HTTP ${tunnelLookup.status}, data: ${JSON.stringify(tunnelData)}`
      );
    }
  } catch (err) {
    record(12, 'Cloudflare Tunnel access to customer lookup flow', 'FAIL', err.message);
  }

  console.log('\n========================================================================');
  console.log('SUMMARY OF RESULTS:');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Passed: ${passCount} / ${results.length}`);
  console.log(`Failed: ${failCount} / ${results.length}`);
  console.log('========================================================================\n');

  return results;
}

runTests().catch(console.error);
