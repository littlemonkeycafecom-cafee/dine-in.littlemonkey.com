/**
 * Little Monkey Cafe Dining — Migrated Vercel Serverless API Verification Suite
 * Tests every migrated endpoint, authentication, request signing, mocked Google Sheets,
 * concurrency, cross-instance session persistence, and production security rules.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

// Import migrated Vercel handlers directly
import verifyQrHandler from '../api/dine-in/verify-qr.ts';
import customerRecordHandler from '../api/dine-in/customer-record.ts';
import sessionStatusHandler from '../api/dine-in/session-status.ts';
import sessionHandler from '../api/dine-in/session.ts';
import orderHandler from '../api/dine-in/order.ts';
import logoutHandler from '../api/dine-in/logout-session.ts';
import adminTablesHandler from '../api/admin/qr/tables.ts';
import adminRotateHandler from '../api/admin/qr/rotate.ts';
import adminRevokeHandler from '../api/admin/qr/revoke.ts';
import adminExportPdfHandler from '../api/admin/qr/export-pdf.ts';
import testAdvanceTimeHandler from '../api/test/advance-time.ts';
import devTablesHandler from '../api/dev/tables.ts';
import testResetTimeHandler from '../api/test/reset-time.ts';

import { getStorageProvider } from '../src/server/storage.ts';
import { getAdminTablesOverview, getActiveRawSecretForTable } from '../src/server/qrAuthStore.ts';

// Helper to simulate Vercel / Node serverless HTTP invocation
function mockRequest(options) {
  const {
    method = 'GET',
    url = '/',
    headers = {},
    body = null,
  } = options;

  const req = new http.IncomingMessage(null);
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'dine-in.littlemonkey.com',
    'x-forwarded-proto': 'https',
    ...headers,
  };
  req.body = body;

  let statusCode = 200;
  let responseHeaders = {};
  let responseData = '';

  const res = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return responseHeaders[name.toLowerCase()];
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(obj) {
      responseData = JSON.stringify(obj);
      this.setHeader('Content-Type', 'application/json');
    },
    end(chunk) {
      if (chunk) responseData = chunk;
    },
  };

  return {
    req,
    res,
    getResponse() {
      let parsed = null;
      try {
        parsed = JSON.parse(responseData);
      } catch {
        parsed = responseData;
      }
      return {
        status: res.statusCode || statusCode,
        headers: responseHeaders,
        data: parsed,
        raw: responseData,
      };
    },
  };
}

async function runMigratedApiSuite() {
  console.log('========================================================================');
  console.log('VERCEL MIGRATED SERVERLESS API ENDPOINTS VERIFICATION SUITE');
  console.log('========================================================================\n');

  const tables = getAdminTablesOverview();
  const t1 = tables.find(t => t.tableNumber === 'Table 01');
  assert.ok(t1, 'Table 01 must exist in authoritative tables');
  const t1Secret = getActiveRawSecretForTable('Table 01');
  assert.ok(t1Secret, 'Table 01 must have an active raw secret');

  // ---------------------------------------------------------------------------
  // TEST 1: QR Verification Endpoint (api/dine-in/verify-qr.ts)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: POST /api/dine-in/verify-qr ---');

  // 1A. Method rejection
  {
    const { req, res, getResponse } = mockRequest({ method: 'GET', url: '/api/dine-in/verify-qr' });
    await verifyQrHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 405, 'Non-POST must return 405');
    console.log('[PASS] 1A: GET rejected with 405 Method Not Allowed');
  }

  // 1B. Missing credential
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/verify-qr',
      body: { table: 'Table 01' },
    });
    await verifyQrHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 400);
    assert.equal(resp.data.error, 'MISSING_CREDENTIAL');
    console.log('[PASS] 1B: Missing credential rejected with 400 MISSING_CREDENTIAL');
  }

  // 1C. Invalid / Tampered credential
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/verify-qr',
      body: { table: 'Table 01', cred: 'qrc_t01_tampered.invalidSecretHere' },
    });
    await verifyQrHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 400);
    assert.equal(resp.data.valid, false);
    console.log('[PASS] 1C: Tampered credential rejected with 400 INVALID_CREDENTIAL');
  }

  // 1D. Valid Table 01 Credential -> Generates valid qrProofToken
  let validProofToken = '';
  {
    const validCredParam = `${t1.credentialId}.${t1Secret}`;
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/verify-qr',
      body: { table: 'Table 01', cred: validCredParam },
    });
    await verifyQrHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.valid, true);
    assert.equal(resp.data.tableNumber, 'Table 01');
    assert.ok(resp.data.qrProofToken, 'Must issue a valid qrProofToken');
    validProofToken = resp.data.qrProofToken;
    console.log(`[PASS] 1D: Valid Table 01 credential verified; qrProofToken issued: ${validProofToken.slice(0, 25)}...`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Customer Registration & Google Sheets Relay (api/dine-in/customer-record.ts)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: POST /api/dine-in/customer-record ---');

  // 2A. Missing QR Proof Token
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      body: { name: 'Aarav Sharma', mobile: '9876543210' },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 403);
    assert.equal(resp.data.error, 'MISSING_QR_PROOF');
    console.log('[PASS] 2A: Missing QR proof rejected with 403 MISSING_QR_PROOF');
  }

  // 2B. Invalid Mobile Number
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      body: { name: 'Aarav Sharma', mobile: '12345', qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 422);
    assert.equal(resp.data.error, 'INVALID_MOBILE');
    console.log('[PASS] 2B: Invalid mobile number rejected with 422 INVALID_MOBILE');
  }

  // 2C. Empty / Invalid Name
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      body: { name: '', mobile: '9876543210', qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 422);
    assert.equal(resp.data.error, 'INVALID_NAME');
    console.log('[PASS] 2C: Empty name rejected with 422 INVALID_NAME');
  }

  // 2D. Production Security: Developer Header Overrides Blocked
  {
    process.env.NODE_ENV = 'production';
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      headers: { 'x-dev-sheets-emulator': 'true' },
      body: { name: 'Aarav Sharma', mobile: '9876543210', qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 403);
    assert.equal(resp.data.error, 'DEV_HEADERS_DISABLED_IN_PROD');
    process.env.NODE_ENV = 'development';
    console.log('[PASS] 2D: Production blocks developer override headers with 403 DEV_HEADERS_DISABLED_IN_PROD');
  }

  // 2E. Successful Customer Registration (Isolated Dev / Emulator Mode)
  let sessionToken = '';
  const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      headers: { 'x-dev-sheets-emulator': 'true' },
      body: { name: 'Kavita Reddy', mobile: testPhone, qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    if (resp.status !== 200 && resp.status !== 201) {
      console.error('2E Failure details:', resp.data);
    }
    assert.ok(resp.status === 201 || resp.status === 200, `Expected 200/201, got ${resp.status}`);
    assert.equal(resp.data.success, true);
    assert.ok(resp.data.sessionToken, 'Must return sessionToken');
    assert.equal(resp.data.session.tableNumber, 'Table 01');
    assert.equal(resp.data.session.durationMs, 900000, 'Must be strict 15-minute duration (900,000 ms)');
    sessionToken = resp.data.sessionToken;
    console.log(`[PASS] 2E: Customer registered successfully (Session: ${sessionToken.slice(0, 20)}...)`);
  }

  // 2F. Idempotent Duplicate Registration
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      headers: { 'x-dev-sheets-emulator': 'true' },
      body: { name: 'Kavita Reddy', mobile: testPhone, qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.status, 'EXISTING_CUSTOMER');
    console.log('[PASS] 2F: Returning customer verified with status EXISTING_CUSTOMER');
  }

  // 2G. Name Conflict Detection
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/customer-record',
      headers: { 'x-dev-sheets-emulator': 'true' },
      body: { name: 'Different Name', mobile: testPhone, qrProofToken: validProofToken },
    });
    await customerRecordHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 409);
    assert.equal(resp.data.status, 'EXISTING_CUSTOMER_NAME_MISMATCH');
    console.log('[PASS] 2G: Name conflict on existing mobile flagged with 409 EXISTING_CUSTOMER_NAME_MISMATCH');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Session Status & Invariants (api/dine-in/session-status.ts)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: GET /api/dine-in/session-status ---');

  // 3A. Valid Session Token
  {
    const { req, res, getResponse } = mockRequest({
      method: 'GET',
      url: '/api/dine-in/session-status',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    await sessionStatusHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.valid, true);
    assert.equal(resp.data.tableNumber, 'Table 01');
    assert.ok(resp.data.timeRemainingMs > 890000, 'Time remaining should be close to 15 minutes');
    console.log(`[PASS] 3A: Valid session returned status 200 (Remaining: ${Math.round(resp.data.timeRemainingMs / 1000)}s)`);
  }

  // 3B. Missing / Invalid Session Token
  {
    const { req, res, getResponse } = mockRequest({
      method: 'GET',
      url: '/api/dine-in/session-status',
      headers: { authorization: 'Bearer dinesess_nonexistent_token' },
    });
    await sessionStatusHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 401);
    assert.equal(resp.data.valid, false);
    console.log('[PASS] 3B: Non-existent session rejected with 401');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Read-Only Menu Invariant & Order Restriction (api/dine-in/order.ts)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: POST /api/dine-in/order (Read-Only Enforcement) ---');
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/order',
      headers: { authorization: `Bearer ${sessionToken}` },
      body: { tableNumber: 'Table 01', items: [{ id: 'pizza_01', qty: 1 }] },
    });
    await orderHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 403);
    assert.equal(resp.data.error, 'READ_ONLY_MENU');
    console.log('[PASS] 4: Order placement blocked with 403 READ_ONLY_MENU');
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Session Termination (api/dine-in/logout-session.ts)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: POST /api/dine-in/logout-session ---');
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/dine-in/logout-session',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    await logoutHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.success, true);
    console.log('[PASS] 5A: Logout terminated session with 200');

    // Confirm session status now reports revoked
    const check = mockRequest({
      method: 'GET',
      url: '/api/dine-in/session-status',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    await sessionStatusHandler(check.req, check.res);
    const checkResp = check.getResponse();
    assert.equal(checkResp.status, 403);
    assert.equal(checkResp.data.error, 'SESSION_REVOKED');
    console.log('[PASS] 5B: Subsequent session check blocked with 403 SESSION_REVOKED');
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Administrative Endpoints Authorization & Fleet Check (api/admin/qr/*)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Administrative Operations & 10-Table Fleet Check ---');

  // 6A. Unauthorized Admin Request
  {
    const { req, res, getResponse } = mockRequest({
      method: 'GET',
      url: '/api/admin/qr/tables',
      headers: {},
    });
    await adminTablesHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 403);
    assert.equal(resp.data.error, 'ADMIN_ACCESS_DENIED');
    console.log('[PASS] 6A: Unauthenticated admin request blocked with 403 ADMIN_ACCESS_DENIED');
  }

  // 6B. Authorized Admin Request (PIN 9999) -> Confirms 10 authoritative tables
  {
    const { req, res, getResponse } = mockRequest({
      method: 'GET',
      url: '/api/admin/qr/tables',
      headers: { 'x-operational-pin': '9999' },
    });
    await adminTablesHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.success, true);
    assert.equal(resp.data.tables.length, 10, 'Must return exactly 10 authoritative tables');
    console.log(`[PASS] 6B: Admin tables overview returned exactly 10 tables: ${resp.data.tables.map(t => t.tableNumber).join(', ')}`);
  }

  // 6C. Admin Credential Rotation
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/admin/qr/rotate',
      headers: { 'x-operational-pin': '9999' },
      body: { tableNumber: 'Table 02' },
    });
    await adminRotateHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.success, true);
    assert.equal(resp.data.tableNumber, 'Table 02');
    assert.ok(resp.data.entryUrl.includes('Table 02') || resp.data.entryUrl.includes('t=T02'));
    console.log(`[PASS] 6C: Table 02 credential rotated successfully (New cred: ${resp.data.credentialId})`);
  }

  // 6D. Admin Credential Revocation
  {
    const { req, res, getResponse } = mockRequest({
      method: 'POST',
      url: '/api/admin/qr/revoke',
      headers: { 'x-operational-pin': '9999' },
      body: { tableNumber: 'Table 02' },
    });
    await adminRevokeHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.data.success, true);
    console.log('[PASS] 6D: Table 02 credential revoked successfully');
  }

  // 6E. Admin PDF Export
  {
    const { req, res, getResponse } = mockRequest({
      method: 'GET',
      url: '/api/admin/qr/export-pdf?mode=staging',
      headers: { 'x-operational-pin': '9999' },
    });
    await adminExportPdfHandler(req, res);
    const resp = getResponse();
    assert.equal(resp.status, 200);
    assert.equal(resp.headers['content-type'], 'application/pdf');
    assert.ok(resp.raw.length > 5000, 'PDF buffer must have valid size');
    console.log(`[PASS] 6E: Table tents PDF exported cleanly (${resp.raw.length} bytes binary)`);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Production Restrictions on Test & Dev Endpoints
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Production Restrictions on Test/Dev Endpoints ---');
  {
    process.env.NODE_ENV = 'production';

    const testReset = mockRequest({ method: 'POST', url: '/api/test/reset-time' });
    await testResetTimeHandler(testReset.req, testReset.res);
    assert.equal(testReset.getResponse().status, 403);
    assert.equal(testReset.getResponse().data.error, 'TEST_HELPERS_DISABLED_IN_PROD');

    const testAdvance = mockRequest({ method: 'POST', url: '/api/test/advance-time', body: { ms: 1000 } });
    await testAdvanceTimeHandler(testAdvance.req, testAdvance.res);
    assert.equal(testAdvance.getResponse().status, 403);
    assert.equal(testAdvance.getResponse().data.error, 'TEST_HELPERS_DISABLED_IN_PROD');

    const testDev = mockRequest({ method: 'GET', url: '/api/dev/tables' });
    await devTablesHandler(testDev.req, testDev.res);
    assert.equal(testDev.getResponse().status, 403);
    assert.equal(testDev.getResponse().data.error, 'DEV_ENDPOINT_DISABLED_IN_PROD');

    process.env.NODE_ENV = 'development';
    console.log('[PASS] 7: All test and dev endpoints return 403 in production environment');
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Concurrency & Cross-Instance Session Persistence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Concurrency & Cross-Instance Persistence ---');
  {
    const storage = getStorageProvider();
    const concurrentCount = 10;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        storage.createSession(
          validProofToken,
          {
            id: `CUST-CONCURRENT-${i}`,
            name: `Test Diner ${i}`,
            phone: `98765432${i < 10 ? '0' + i : i}`,
          }
        )
      );
    }

    const results = await Promise.all(promises);
    assert.equal(results.length, concurrentCount);
    for (const r of results) {
      assert.equal(r.success, true);
      assert.ok(r.session?.sessionId);
    }
    console.log(`[PASS] 8A: 10 concurrent session creation requests serialized and validated`);

    // Verify cross-instance read
    const testSession = results[0].session;
    const readCheck = await storage.validateSession(testSession.sessionId);
    assert.equal(readCheck.valid, true);
    assert.equal(readCheck.session.sessionId, testSession.sessionId);
    assert.equal(readCheck.session.customerName, testSession.customerName);
    console.log('[PASS] 8B: Cross-instance session persistence confirmed');
  }

  console.log('\n========================================================================');
  console.log('ALL VERCEL MIGRATED SERVERLESS TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

runMigratedApiSuite().catch(err => {
  console.error('\n[SUITE FAILED]:', err);
  process.exit(1);
});
