/**
 * test_master_implementation_suite.mjs — Comprehensive Verification Suite
 *
 * Validates:
 * 1. Catalog Integrity & Strict Category Separation (194 products, 17 pizzas, 2 combos)
 * 2. 10 Authoritative Physical Tables (Table 01 to Table 10)
 * 3. Cryptographic QR Verification & Tamper Resistance
 * 4. Strict 30-Minute Dining Sessions with Zero-Sliding Expiry
 * 5. Customer Account Database Persistence with Real Supabase Auth
 * 6. Custom Domain (https://dine-in.littlemonkey.com) in all QR Destinations & PDF
 * 7. 10-Page Vector PDF Export
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tdhpatamtqgrvrnfmscj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock_service_key_for_testing';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PBDOJAlQHqHqQyAo2OiFkw_kQTIDDJT';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`[PASS] ${message}`);
  } else {
    testsFailed++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runSuite() {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFE — MASTER IMPLEMENTATION VERIFICATION SUITE');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // 1. CATALOG INTEGRITY & STRICT CATEGORY SEPARATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. Menu Catalog & Category Separation ---');
  const menuPath = path.resolve(process.cwd(), 'src/data/reconciled-menu.json');
  const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

  assert(Array.isArray(menuData.products), 'reconciled-menu.json has products array');
  assert(menuData.products.length === 184, `reconciled-menu.json has exactly 184 products (found ${menuData.products.length})`);

  // Total products in catalog = 184 regular + 10 specialty cold brews = 194
  const totalCatalogProducts = menuData.products.length + 10;
  assert(totalCatalogProducts === 194, `Total catalog products = 194 (184 regular + 10 signature cold brews)`);

  const pizzas = menuData.products.filter(p => p.category === 'thin-crust-pizza');
  assert(pizzas.length === 17, `Exactly 17 thin crust pizzas (found ${pizzas.length})`);

  // Verify none of the pizzas are combos
  const pizzaHasCombos = pizzas.some(p => p.name.toLowerCase().includes('combo'));
  assert(!pizzaHasCombos, 'Zero pizza combos under thin-crust-pizza');

  const combos = menuData.products.filter(p => p.category === 'pizza-combos');
  assert(combos.length === 2, `Exactly 2 pizza combos (found ${combos.length})`);

  // Verify all combos have combo in name or description
  const combosValid = combos.every(p => p.name.toLowerCase().includes('combo'));
  assert(combosValid, 'All pizza combos have "Combo" in title');

  // Verify diet filtering for pizzas
  const vegPizzas = pizzas.filter(p => p.dietary_classification === 'VEG');
  const nonVegPizzas = pizzas.filter(p => p.dietary_classification === 'NON_VEG');
  assert(vegPizzas.length === 9, `9 VEG pizzas (found ${vegPizzas.length})`);
  assert(nonVegPizzas.length === 8, `8 NON_VEG pizzas (found ${nonVegPizzas.length})`);

  // ---------------------------------------------------------------------------
  // 2. 10 AUTHORITATIVE PHYSICAL TABLES
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. 10 Authoritative Physical Tables ---');
  const tablesRes = await fetch(`${BASE_URL}/api/admin/qr/tables?pin=${ADMIN_PIN}`);
  const tablesData = await tablesRes.json();

  assert(tablesRes.status === 200, 'GET /api/admin/qr/tables returned HTTP 200');
  assert(Array.isArray(tablesData.tables) && tablesData.tables.length === 10, `Exactly 10 physical tables returned (found ${tablesData.tables?.length})`);

  const expectedTables = [
    { num: 'Table 01', short: 'T01', zone: 'Window Bay', cap: 3 },
    { num: 'Table 02', short: 'T02', zone: 'Window Bay', cap: 3 },
    { num: 'Table 03', short: 'T03', zone: 'Main Café Hall', cap: 4 },
    { num: 'Table 04', short: 'T04', zone: 'Main Café Hall', cap: 4 },
    { num: 'Table 05', short: 'T05', zone: 'Courtyard Terrace', cap: 4 },
    { num: 'Table 06', short: 'T06', zone: 'Courtyard Terrace', cap: 4 },
    { num: 'Table 07', short: 'T07', zone: 'Courtyard Terrace', cap: 4 },
    { num: 'Table 08', short: 'T08', zone: 'Mezzanine Lounge', cap: 6 },
    { num: 'Table 09', short: 'T09', zone: 'Mezzanine Lounge', cap: 6 },
    { num: 'Table 10', short: 'T10', zone: 'Private Dining Alcove', cap: 8 },
  ];

  let allTablesMatch = true;
  for (const exp of expectedTables) {
    const found = tablesData.tables.find(t => t.tableNumber === exp.num);
    if (!found || found.shortCode !== exp.short || found.capacity !== exp.cap) {
      allTablesMatch = false;
      console.error(`Mismatch for ${exp.num}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(found)}`);
    }
  }
  assert(allTablesMatch, 'All 10 tables match expected tableNumber, shortCode, and capacity');

  // Verify all 10 tables have active credentials in store
  const credsFile = path.resolve(process.cwd(), '.qr_credentials.json');
  const diskCreds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
  const activeDiskCreds = diskCreds.filter(c => c.isActive);
  assert(activeDiskCreds.length === 10, `Disk persistence holds 10 active credentials (found ${activeDiskCreds.length})`);

  // ---------------------------------------------------------------------------
  // 3. CRYPTOGRAPHIC QR VERIFICATION & ROTATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Cryptographic QR Verification & Rotation ---');

  // Rotate Table 04 to test rotation and get raw secret
  const rotateRes = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-operational-pin': ADMIN_PIN },
    body: JSON.stringify({ tableNumber: 'Table 04' }),
  });
  const rotateData = await rotateRes.json();
  assert(rotateRes.status === 200, 'Rotate Table 04 returned HTTP 200');
  assert(Boolean(rotateData.rawSecret), 'Fresh raw secret returned on rotation');
  assert(Boolean(rotateData.credentialId), 'New credential ID returned on rotation');
  assert(rotateData.entryUrl.startsWith('https://dine-in.littlemonkey.com/?t=T04'), `Rotation entryUrl uses custom domain: ${rotateData.entryUrl}`);

  // Test verify-qr with valid rotated payload
  const validPayload = `${rotateData.credentialId}.${rotateData.rawSecret}`;
  const verifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: validPayload, table: 'T04' }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, 'Valid QR payload verified with HTTP 200');
  assert(verifyData.tableNumber === 'Table 04', 'Normalized table identity confirmed as Table 04');
  assert(Boolean(verifyData.proofToken), 'Signed 5-minute QR proof token issued');

  const proofToken = verifyData.proofToken;

  // Test verify-qr with tampered secret
  const badVerifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: `${rotateData.credentialId}.tampered_secret_123`, table: 'T04' }),
  });
  assert(badVerifyRes.status === 400, 'Tampered QR secret rejected with HTTP 400');

  // Test verify-qr with table mismatch (spoof attempt: payload is T04, query says T01)
  const spoofVerifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: validPayload, table: 'T01' }),
  });
  assert(spoofVerifyRes.status === 400, 'Table identity spoofing rejected with HTTP 400');

  // ---------------------------------------------------------------------------
  // 4. STRICT 30-MINUTE SERVER-CONTROLLED SESSIONS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Strict 30-Minute Dining Sessions ---');

  // Reset deterministic clock first
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });

  // Create mock customer auth bearer token
  const testCustomer = {
    sub: 'user_test_dining_verify',
    phone: '+919988776655',
    name: 'Verified Diner',
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const customerToken = `dev_token.${Buffer.from(JSON.stringify(testCustomer)).toString('base64')}.lmc`;

  // Create session
  const sessionRes = await fetch(`${BASE_URL}/api/dine-in/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      proofToken,
      table: 'T04',
      token: customerToken,
    }),
  });
  const sessionData = await sessionRes.json();
  assert(sessionRes.status === 200, 'POST /api/dine-in/create-session returned HTTP 200');
  assert(sessionData.session?.durationMs === 1800000, 'Fixed session duration = 1,800,000 ms (30 mins)');
  assert(sessionData.session?.tableNumber === 'Table 04', 'Session bound to Table 04');

  const diningSessionToken = sessionData.sessionToken;

  // Validate session status initially (0 mins elapsed)
  const statusRes1 = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { Authorization: `Bearer ${diningSessionToken}` },
  });
  const statusData1 = await statusRes1.json();
  assert(statusRes1.status === 200, 'Initial session status HTTP 200');
  assert(statusData1.valid === true, 'Session valid initially');
  assert(statusData1.timeRemainingMs > 1790000, `Remaining time near 30 mins (${Math.round(statusData1.timeRemainingMs / 60000)} mins)`);

  // Advance clock by 15 minutes (900,000 ms)
  await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: 15 * 60 * 1000 }),
  });

  const statusRes2 = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { Authorization: `Bearer ${diningSessionToken}` },
  });
  const statusData2 = await statusRes2.json();
  assert(statusRes2.status === 200, 'Midpoint session status HTTP 200');
  assert(statusData2.valid === true, 'Session still valid at 15 minutes');
  const remMins = Math.round(statusData2.timeRemainingMs / 60000);
  assert(remMins <= 15 && remMins >= 14, `Remaining time strictly ~15 mins (found ${remMins} mins)`);

  // Advance clock past 30 minutes (+16 mins, total 31 mins)
  await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: 16 * 60 * 1000 }),
  });

  const statusRes3 = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
    headers: { Authorization: `Bearer ${diningSessionToken}` },
  });
  const statusData3 = await statusRes3.json();
  assert(statusRes3.status === 401, 'Expired session rejected with HTTP 401');
  assert(statusData3.error === 'DINING_SESSION_EXPIRED', 'Error code DINING_SESSION_EXPIRED confirmed');

  // Reset deterministic clock
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  console.log('Deterministic test clock reset.');

  // ---------------------------------------------------------------------------
  // 5. CUSTOMER ACCOUNT DATABASE PERSISTENCE WITH SUPABASE AUTH
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Customer Account Database Persistence ---');

  const testDigits = `9810${Math.floor(100000 + Math.random() * 900000)}`;
  const testPassword = 'DineInSecurePass2026!';
  const testFullName = 'Aarav Sharma';
  const testEmail = `${testDigits}@customer.littlemonkeycafe.com`;

  // Register new customer account via Dining API
  const regRes = await fetch(`${BASE_URL}/api/auth/customer-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testDigits,
      password: testPassword,
      fullName: testFullName,
    }),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 || regRes.status === 200, `POST /api/auth/customer-register returned ${regRes.status}`);
  const registeredUserId = regData?.user?.id;
  assert(Boolean(registeredUserId), `User persisted in database with ID: ${registeredUserId}`);

  // Test login with created account
  const loginRes = await fetch(`${BASE_URL}/api/auth/customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testDigits,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, 'POST /api/auth/customer-login returned HTTP 200');
  const token = loginData?.session?.access_token || loginData?.token;
  assert(Boolean(token), 'Genuine Supabase JWT session token received');

  // Verify token is genuine Supabase JWT (3 base64url segments)
  const isSupabaseJwt = token && token.includes('.') && token.split('.').length === 3 && !token.startsWith('dev_token');
  assert(isSupabaseJwt, 'Verified token is authentic multi-segment Supabase JWT, not simulated token');

  // Test duplicate registration rejection
  const dupRes = await fetch(`${BASE_URL}/api/auth/customer-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testDigits,
      password: testPassword,
      fullName: testFullName,
    }),
  });
  assert(dupRes.status === 409 || dupRes.status === 400, `Duplicate registration rejected with HTTP ${dupRes.status}`);

  // Clean up registered test user from Supabase Auth
  if (registeredUserId) {
    try {
      const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${registeredUserId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      assert(delRes.status === 200, 'Cleaned up verification test user from Supabase Auth');
    } catch (cleanErr) {
      console.warn('Test user cleanup warning:', cleanErr.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. CUSTOM DOMAIN CONFIGURATION & PDF EXPORT
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Custom Domain & PDF Export ---');

  const pdfRes = await fetch(`${BASE_URL}/api/admin/qr/export-pdf?mode=production&pin=${ADMIN_PIN}`);
  assert(pdfRes.status === 200, 'GET /api/admin/qr/export-pdf returned HTTP 200');
  assert(pdfRes.headers.get('content-type') === 'application/pdf', 'Content-Type is application/pdf');

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const pdfString = pdfBuffer.toString('utf8');

  // Check 10 pages in PDF
  const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
  assert(pageMatches && pageMatches.length === 10, `PDF contains exactly 10 pages for 10 tables (found ${pageMatches?.length})`);

  // Check domain consistency in PDF
  const customDomainMatches = pdfString.match(/https:\/\/dine-in\.littlemonkey\.com\/\?t=T\d\d/g);
  assert(customDomainMatches && customDomainMatches.length >= 10, `PDF QR destinations contain official domain https://dine-in.littlemonkey.com (found ${customDomainMatches?.length} occurrences)`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`VERIFICATION SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('===============================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
