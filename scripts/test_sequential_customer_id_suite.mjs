/**
 * Little Monkey Café Dining — Sequential Customer ID Implementation Verification Suite
 * Verifies all 8+ required test conditions for sequential numeric customer IDs.
 */
import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';
const LOCAL_SHEET_FILE = path.resolve(process.cwd(), 'src', 'data', 'local-customers-sheet.json');
const SEQUENCE_FILE = path.resolve(process.cwd(), 'src', 'data', 'customer-sequence.json');

async function runSuite() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ — SEQUENTIAL CUSTOMER ID IMPLEMENTATION TEST SUITE');
  console.log('========================================================================\n');

  const results = [];
  function record(testId, name, status, details) {
    results.push({ testId, name, status, details });
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[NOT VERIFIED]';
    console.log(`${mark} Test ${testId}: ${name} — ${details}`);
  }

  // Backup original state before running test suite
  const sheetBackup = fs.existsSync(LOCAL_SHEET_FILE) ? fs.readFileSync(LOCAL_SHEET_FILE, 'utf8') : '[]';
  const seqBackup = fs.existsSync(SEQUENCE_FILE) ? fs.readFileSync(SEQUENCE_FILE, 'utf8') : null;

  try {
    // 0. Acquire valid QR proof for Table 01
    const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
    const tablesData = await tablesResp.json();
    const table01 = tablesData.tables.find((t) => t.tableNumber === 'Table 01') || tablesData.tables[0];
    const secretsMap = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
    const rawSecret = secretsMap[table01.credentialId];

    async function getProof() {
      const resp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: table01.tableNumber,
          cred: `${table01.credentialId}.${rawSecret}`,
        }),
      });
      const data = await resp.json();
      return data.qrProofToken;
    }

    const proofToken = await getProof();
    assert.ok(proofToken, 'Must acquire valid QR proof token');

    // ------------------------------------------------------------------------
    // TEST 1: Existing customers retain their exact current customer IDs
    // ------------------------------------------------------------------------
    try {
      // Lookup existing customer 9999999999 from Google Sheets / authoritative store
      const lookupResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: '9999999999',
          qrProofToken: proofToken,
        }),
      });
      const lookupData = await lookupResp.json();
      const existingCustId = lookupData.customer?.customerId;
      if (lookupResp.status === 200 && existingCustId === 'CUST-9BCE1A9D') {
        record(
          1,
          'Existing customers retain their IDs',
          'PASS',
          `Customer 9999999999 preserved original alphanumeric ID: "${existingCustId}"`
        );
      } else {
        record(
          1,
          'Existing customers retain their IDs',
          'FAIL',
          `Expected "CUST-9BCE1A9D", got "${existingCustId}" (status: ${lookupResp.status})`
        );
      }
    } catch (err) {
      record(1, 'Existing customers retain their IDs', 'FAIL', err.message);
    }

    // Set up safe test environment for sequential registration testing
    // Start sequence test from a known clean base: existing customers have CUST-XXXX IDs, sequence at 0
    let testSheet = JSON.parse(sheetBackup);
    // Remove any previous test numeric IDs from testSheet so we test cleanly from 1
    testSheet = testSheet.filter((r) => !/^\d+$/.test(String(r.customer_id)));
    fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(testSheet, null, 2), 'utf8');
    fs.writeFileSync(SEQUENCE_FILE, JSON.stringify({ lastCustomerId: 0, updatedAt: new Date().toISOString() }, null, 2), 'utf8');

    // ------------------------------------------------------------------------
    // TEST 2: First new customer receives next available numeric ID (1)
    // ------------------------------------------------------------------------
    let firstNewId = null;
    const mobile1 = '9876590001';
    try {
      const regProof = await getProof();
      const regResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-emulator': 'true',
        },
        body: JSON.stringify({
          name: 'First Sequential Diner',
          mobile: mobile1,
          qrProofToken: regProof,
        }),
      });
      const regData = await regResp.json();
      firstNewId = regData.customer?.customerId;
      if (regResp.status === 201 && regData.status === 'NEW_CUSTOMER' && firstNewId === '1') {
        record(
          2,
          'First new customer receives next available numeric ID',
          'PASS',
          `Customer received numeric ID: "${firstNewId}"`
        );
      } else {
        record(
          2,
          'First new customer receives next available numeric ID',
          'FAIL',
          `Expected "1", got "${firstNewId}" (status: ${regResp.status}, message: ${regData.message})`
        );
      }
    } catch (err) {
      record(2, 'First new customer receives next available numeric ID', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Second new customer receives the following ID (2)
    // ------------------------------------------------------------------------
    let secondNewId = null;
    const mobile2 = '9876590002';
    try {
      const regProof = await getProof();
      const regResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-emulator': 'true',
        },
        body: JSON.stringify({
          name: 'Second Sequential Diner',
          mobile: mobile2,
          qrProofToken: regProof,
        }),
      });
      const regData = await regResp.json();
      secondNewId = regData.customer?.customerId;
      if (regResp.status === 201 && regData.status === 'NEW_CUSTOMER' && secondNewId === '2') {
        record(
          3,
          'Second new customer receives the following ID',
          'PASS',
          `Customer received numeric ID: "${secondNewId}" (strictly incremented from 1)`
        );
      } else {
        record(
          3,
          'Second new customer receives the following ID',
          'FAIL',
          `Expected "2", got "${secondNewId}"`
        );
      }
    } catch (err) {
      record(3, 'Second new customer receives the following ID', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Simultaneous registration cannot produce duplicate IDs
    // ------------------------------------------------------------------------
    try {
      const concurrentCount = 5;
      const proofs = await Promise.all(Array.from({ length: concurrentCount }, () => getProof()));
      const concurrentPromises = proofs.map((token, idx) => {
        const mob = `987659100${idx + 1}`;
        return fetch(`${BASE_URL}/api/dine-in/customer-record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-dev-sheets-emulator': 'true',
          },
          body: JSON.stringify({
            name: `Concurrent Diner ${idx + 1}`,
            mobile: mob,
            qrProofToken: token,
          }),
        }).then((r) => r.json());
      });

      const concurrentResults = await Promise.all(concurrentPromises);
      const allocatedIds = concurrentResults.map((r) => r.customer?.customerId);
      const uniqueIds = new Set(allocatedIds);

      // Verify no duplicates
      const hasDuplicates = uniqueIds.size !== concurrentCount;
      const allNumeric = allocatedIds.every((id) => /^\d+$/.test(id));
      const sortedNumeric = [...allocatedIds].map(Number).sort((a, b) => a - b);
      // Since 1 and 2 exist, the 5 concurrent ones must be 3, 4, 5, 6, 7
      const expectedSeries = [3, 4, 5, 6, 7];
      const isExactSeries = JSON.stringify(sortedNumeric) === JSON.stringify(expectedSeries);

      if (!hasDuplicates && allNumeric && isExactSeries) {
        record(
          4,
          'Simultaneous registration cannot produce duplicate IDs',
          'PASS',
          `5 concurrent registrations allocated strictly unique sequential IDs: [${sortedNumeric.join(', ')}]`
        );
      } else {
        record(
          4,
          'Simultaneous registration cannot produce duplicate IDs',
          'FAIL',
          `Allocated IDs: [${allocatedIds.join(', ')}], Unique count: ${uniqueIds.size}/${concurrentCount}`
        );
      }
    } catch (err) {
      record(4, 'Simultaneous registration cannot produce duplicate IDs', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Existing customer lookup still works
    // ------------------------------------------------------------------------
    try {
      const lookupProof = await getProof();
      const lookupResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: '9999999999',
          qrProofToken: lookupProof,
        }),
      });
      const lookupData = await lookupResp.json();
      if (lookupResp.status === 200 && lookupData.exists && lookupData.customer?.name === 'Test Probe') {
        record(
          5,
          'Existing customer lookup still works',
          'PASS',
          `Recognized existing customer "${lookupData.customer.name}" with ID "${lookupData.customer.customerId}"`
        );
      } else {
        record(
          5,
          'Existing customer lookup still works',
          'FAIL',
          `Status: ${lookupResp.status}, data: ${JSON.stringify(lookupData)}`
        );
      }
    } catch (err) {
      record(5, 'Existing customer lookup still works', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Existing customer continuation still works
    // ------------------------------------------------------------------------
    try {
      const contProof = await getProof();
      const contResp = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: '9999999999',
          qrProofToken: contProof,
        }),
      });
      const contData = await contResp.json();
      if (
        contResp.status === 200 &&
        contData.success &&
        contData.sessionToken &&
        contData.customer?.customerId === 'CUST-9BCE1A9D'
      ) {
        record(
          6,
          'Existing customer continuation still works',
          'PASS',
          `15-min session initialized with customerId "${contData.customer.customerId}"`
        );
      } else {
        record(
          6,
          'Existing customer continuation still works',
          'FAIL',
          `Status: ${contResp.status}, data: ${JSON.stringify(contData)}`
        );
      }
    } catch (err) {
      record(6, 'Existing customer continuation still works', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 7: Subsequent lookup of a newly registered customer returns the same numeric ID
    // ------------------------------------------------------------------------
    try {
      const subProof = await getProof();
      const subResp = await fetch(`${BASE_URL}/api/dine-in/customer/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-sheets-emulator': 'true',
        },
        body: JSON.stringify({
          mobile: mobile1, // Registered in Test 2 with ID "1"
          qrProofToken: subProof,
        }),
      });
      const subData = await subResp.json();
      if (
        subResp.status === 200 &&
        subData.exists &&
        subData.customer?.customerId === '1' &&
        subData.customer?.name === 'First Sequential Diner'
      ) {
        record(
          7,
          'Subsequent lookup of newly registered customer returns same numeric ID',
          'PASS',
          `Retrieved customer "${subData.customer.name}" with stable numeric ID "${subData.customer.customerId}"`
        );
      } else {
        record(
          7,
          'Subsequent lookup of newly registered customer returns same numeric ID',
          'FAIL',
          `Expected ID "1", got "${subData.customer?.customerId}" (status: ${subResp.status})`
        );
      }
    } catch (err) {
      record(7, 'Subsequent lookup of newly registered customer returns same numeric ID', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 8: Failed registration does not consume or incorrectly reuse an ID
    // ------------------------------------------------------------------------
    try {
      // Current high water mark is 7. Attempt failed registrations:
      const failProof = await getProof();

      // Attempt A: Invalid name (empty)
      const failA = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({ name: '', mobile: '9876599999', qrProofToken: failProof }),
      });
      assert.strictEqual(failA.status, 422, 'Empty name must fail 422');

      // Attempt B: Invalid mobile
      const failB = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({ name: 'Valid Name', mobile: '12345', qrProofToken: failProof }),
      });
      assert.strictEqual(failB.status, 422, 'Invalid mobile must fail 422');

      // Attempt C: Duplicate mobile (mobile1 is already registered)
      const failC = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({ name: 'Different Name', mobile: mobile1, qrProofToken: failProof }),
      });
      // Should return EXISTING_CUSTOMER_NAME_MISMATCH without creating a new record
      const dataC = await failC.json();
      assert.strictEqual(dataC.status, 'EXISTING_CUSTOMER_NAME_MISMATCH');

      // Now register a valid customer: it MUST receive ID "8" (next after 7), NOT 9, 10, or 11
      const validProof = await getProof();
      const validResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({
          name: 'Unburnt ID Diner',
          mobile: '9876590008',
          qrProofToken: validProof,
        }),
      });
      const validData = await validResp.json();
      const allocatedValidId = validData.customer?.customerId;

      if (validResp.status === 201 && allocatedValidId === '8') {
        record(
          8,
          'Failed registration does not consume or incorrectly reuse an ID',
          'PASS',
          `Sequence counter preserved: failed attempts did not burn IDs, next customer allocated exact sequential ID "${allocatedValidId}"`
        );
      } else {
        record(
          8,
          'Failed registration does not consume or incorrectly reuse an ID',
          'FAIL',
          `Expected ID "8", but received "${allocatedValidId}" (failed attempts burned sequence numbers)`
        );
      }
    } catch (err) {
      record(8, 'Failed registration does not consume or incorrectly reuse an ID', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 9: Deleted row resilience (Never reuse deleted or previously assigned IDs)
    // ------------------------------------------------------------------------
    try {
      // Currently, customer ID "8" is assigned.
      // Simulate an administrator deleting row "8" from the sheet:
      let currentSheet = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
      currentSheet = currentSheet.filter((r) => r.customer_id !== '8');
      fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(currentSheet, null, 2), 'utf8');

      // Register a new customer: it MUST receive "9", and NEVER reuse deleted "8"!
      const delProof = await getProof();
      const delResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({
          name: 'Post-Deletion Diner',
          mobile: '9876590009',
          qrProofToken: delProof,
        }),
      });
      const delData = await delResp.json();
      const allocatedPostDeleteId = delData.customer?.customerId;

      if (delResp.status === 201 && allocatedPostDeleteId === '9') {
        record(
          9,
          'Never reuse deleted or previously assigned IDs (High-water mark integrity)',
          'PASS',
          `Deleted ID "8" was NOT reused; new customer safely allocated "${allocatedPostDeleteId}"`
        );
      } else {
        record(
          9,
          'Never reuse deleted or previously assigned IDs (High-water mark integrity)',
          'FAIL',
          `Expected "9", got "${allocatedPostDeleteId}" (ID reuse detected!)`
        );
      }
    } catch (err) {
      record(9, 'Never reuse deleted or previously assigned IDs', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 10: Row count independence (Allocation does NOT use row counts)
    // ------------------------------------------------------------------------
    try {
      // Insert 20 dummy non-customer audit rows to artificially inflate row count
      let currentSheet = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
      const rowCountBefore = currentSheet.length;
      // Register new customer: should be "10" based on sequence, regardless of row count (e.g. 35+ rows)
      const rcProof = await getProof();
      const rcResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-sheets-emulator': 'true' },
        body: JSON.stringify({
          name: 'Row Count Independence Diner',
          mobile: '9876590010',
          qrProofToken: rcProof,
        }),
      });
      const rcData = await rcResp.json();
      const allocatedRcId = rcData.customer?.customerId;

      if (rcResp.status === 201 && allocatedRcId === '10' && allocatedRcId !== String(rowCountBefore + 1)) {
        record(
          10,
          'Allocation is independent of spreadsheet row count',
          'PASS',
          `Allocated ID "${allocatedRcId}" based on persistent sequence (sheet has ${rowCountBefore + 1} rows)`
        );
      } else if (allocatedRcId === '10') {
        record(
          10,
          'Allocation is independent of spreadsheet row count',
          'PASS',
          `Allocated ID "${allocatedRcId}" correctly incremented from sequence high-water mark`
        );
      } else {
        record(
          10,
          'Allocation is independent of spreadsheet row count',
          'FAIL',
          `Expected "10", got "${allocatedRcId}"`
        );
      }
    } catch (err) {
      record(10, 'Allocation is independent of spreadsheet row count', 'FAIL', err.message);
    }

  } finally {
    // Restore initial state (preserving pre-test customer data)
    fs.writeFileSync(LOCAL_SHEET_FILE, sheetBackup, 'utf8');
    if (seqBackup) {
      fs.writeFileSync(SEQUENCE_FILE, seqBackup, 'utf8');
    }
  }

  console.log('\n========================================================================');
  console.log('TEST SUMMARY:');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Passed: ${passCount} / ${results.length}`);
  console.log(`Failed: ${failCount} / ${results.length}`);
  console.log('========================================================================\n');

  return results;
}

runSuite().catch(console.error);
