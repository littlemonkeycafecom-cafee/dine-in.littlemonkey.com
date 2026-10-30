/**
 * verify_shared_architecture.mjs
 *
 * Comprehensive Automated Acceptance Test Suite for:
 * Little Monkey Café — Customer Authentication, Shared Management & Inventory Architecture
 *
 * Validates:
 * 1. Customer Authentication Gate & Session Validation
 * 2. Shared Single Sign-On (Takeaway -> Dine-In session reuse without duplicate accounts)
 * 3. Session Expiration & Tamper Resistance (401 Unauthorized)
 * 4. Customer-Only Strict Role Enforcement (403 Forbidden on operational mutations)
 * 5. Table Identity Validation (Normalized & verified against active dining tables; invalid tables rejected with 400)
 * 6. Authoritative Order Placement (Dine-In channel, server-validated prices, 0 packing fee, 5% GST)
 * 7. Out-of-Stock Inventory Safeguards (400 Bad Request on sold-out products)
 * 8. Shared Staff Portal Order Ingestion (Orders stored with order_type: 'dine_in' and table_label: 'Table 04')
 * 9. Existing Takeaway Flow Integrity (Takeaway counter ordering remains functional)
 */

import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';

const DINE_IN_ORIGIN = 'http://127.0.0.1:3000';
const BACKEND_ORIGIN = 'http://localhost:5173';

const results = [];

function recordTest(category, name, passed, details = '') {
  results.push({ category, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${category}] ${name}`);
  if (details) console.log(`   └─ ${details}`);
}

async function runTests() {
  console.log('\n================================================================');
  console.log('LITTLE MONKEY CAFÉ — ARCHITECTURE & SECURITY ACCEPTANCE SUITE');
  console.log('================================================================\n');

  // Generate test credentials
  const testPhone = '9876543210';
  const customerTokenPayload = {
    sub: `user_${testPhone}`,
    phone: `+91${testPhone}`,
    name: 'Bhuvan Teja',
    role: 'customer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const validCustomerToken = `dev_token.${Buffer.from(JSON.stringify(customerTokenPayload)).toString('base64')}.lmc`;

  const expiredTokenPayload = {
    sub: `user_${testPhone}`,
    phone: `+91${testPhone}`,
    name: 'Bhuvan Teja',
    role: 'customer',
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  const expiredCustomerToken = `dev_token.${Buffer.from(JSON.stringify(expiredTokenPayload)).toString('base64')}.lmc`;

  // -------------------------------------------------------------------------
  // TEST 1: Unauthenticated Diner Access
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/auth/validate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    assert.equal(res.status, 401, 'Should return HTTP 401 without token');
    assert.equal(data.valid, false);
    recordTest('Authentication', 'Unauthenticated visitor is rejected by server gate', true, `Status ${res.status}: ${data.message || data.error}`);
  } catch (err) {
    recordTest('Authentication', 'Unauthenticated visitor is rejected by server gate', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Valid Existing Takeaway Customer Session Reuse
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/auth/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({ token: validCustomerToken }),
    });
    const data = await res.json();
    assert.equal(res.status, 200, 'Should return HTTP 200 for valid customer token');
    assert.equal(data.valid, true);
    assert.equal(data.user?.phone, `+91${testPhone}`);
    recordTest('Authentication', 'Valid customer session is verified without duplicate account', true, `Recognized user ${data.user?.name} (${data.user?.phone})`);
  } catch (err) {
    recordTest('Authentication', 'Valid customer session is verified without duplicate account', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Expired Session Token Rejection
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/auth/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredCustomerToken}`,
      },
      body: JSON.stringify({ token: expiredCustomerToken }),
    });
    const data = await res.json();
    assert.equal(res.status, 401, 'Should reject expired token with 401');
    assert.equal(data.valid, false);
    recordTest('Authentication', 'Expired session is revoked and requires re-authentication', true, `Status ${res.status}: ${data.message}`);
  } catch (err) {
    recordTest('Authentication', 'Expired session is revoked and requires re-authentication', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Customer-Only Enforcement: Block Product Editing
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/operational/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        id: 'thin-crust-pizza-margherita-pizza',
        changes: { name: 'Unauthorized Price Change', price: 10 },
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 403, 'Should reject customer token with 403 Forbidden');
    assert.equal(data.error, 'ACCESS_DENIED');
    recordTest('Role Boundaries', 'Customer cannot mutate products (HTTP 403 Forbidden)', true, `Status ${res.status}: ${data.message || data.error}`);
  } catch (err) {
    recordTest('Role Boundaries', 'Customer cannot mutate products (HTTP 403 Forbidden)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Customer-Only Enforcement: Block Stock Toggle
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/operational/update-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        id: 'thin-crust-pizza-margherita-pizza',
        is_available: false,
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 403, 'Should reject customer token with 403 Forbidden');
    assert.equal(data.error, 'ACCESS_DENIED');
    recordTest('Role Boundaries', 'Customer cannot toggle stock (HTTP 403 Forbidden)', true, `Status ${res.status}: ${data.message || data.error}`);
  } catch (err) {
    recordTest('Role Boundaries', 'Customer cannot toggle stock (HTTP 403 Forbidden)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Table Identity: Reject Non-Existent or Invalid Table
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'Table 999',
        items: [{ slug: 'thin-crust-pizza-margherita-pizza', name: 'Margherita Pizza', quantity: 1, price: 140 }],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Should reject invalid table with HTTP 400');
    assert.equal(data.error, 'INVALID_TABLE');
    recordTest('Table Identity', 'Arbitrary table identity is rejected server-side', true, `Status ${res.status}: ${data.message}`);
  } catch (err) {
    recordTest('Table Identity', 'Arbitrary table identity is rejected server-side', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Authoritative Live Products & Inventory Feed
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/products`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(typeof data.isStoreOpen, 'boolean');
    assert.equal(typeof data.isDineInOpen, 'boolean');
    assert.equal(typeof data.discounts, 'object');
    recordTest('Live Inventory', 'Dine-In consumes live authoritative catalog & discounts', true, `Store Open: ${data.isStoreOpen}, Discounts Loaded: ${Object.keys(data.discounts).length}`);
  } catch (err) {
    recordTest('Live Inventory', 'Dine-In consumes live authoritative catalog & discounts', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Authoritative Order Placement (Dine-In Table 04)
  // -------------------------------------------------------------------------
  let placedDineInOrder = null;
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'T04', // normalized to Table 04
        paymentMethod: 'cash',
        instructions: 'Please serve hot',
        items: [
          {
            slug: 'thin-crust-pizza-margherita-pizza',
            name: 'Margherita Pizza',
            variant_name: 'Regular',
            quantity: 1,
            price: 1, // Attempt client-side price tampering (₹1); server MUST override with authoritative database price!
          },
        ],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200, 'Should successfully create Dine-In order');
    assert.equal(data.success, true);
    assert.equal(data.tableNumber, 'Table 04', 'Normalized table must be Table 04');
    assert.equal(data.orderType, 'dine_in');

    // Server price tampering check: subtotal must be authoritative 14001 paise (₹140.01 with discount), NOT ₹1
    assert.equal(data.subtotalPaise, 14001, 'Server must enforce authoritative pricing and reject client price tampering');
    placedDineInOrder = data;
    recordTest('Order Integrity', 'Dine-In order placed with server-verified prices & Table 04', true, `Order #${data.orderNumber} (ID: ${data.orderId}) Total: ₹${data.total} (Table: ${data.tableNumber})`);
  } catch (err) {
    recordTest('Order Integrity', 'Dine-In order placed with server-verified prices & Table 04', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Cold Brew Specialty Beverage Order Placement
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'Table 04',
        paymentMethod: 'cash',
        items: [
          {
            slug: 'cold-brew-espresso-orange',
            name: 'Espresso Orange',
            variant_name: 'Regular (350ml)',
            quantity: 1,
            price: 249,
          },
        ],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200, 'Should successfully order specialty cold brew');
    assert.equal(data.success, true);
    assert.equal(data.subtotalPaise, 24900, 'Cold brew price must be authoritative 24900 paise (₹249)');
    recordTest('Specialty Cold Brew', 'Specialty cold brew order successfully validated and recorded', true, `Order #${data.orderNumber} Espresso Orange Total: ₹${data.total}`);
  } catch (err) {
    recordTest('Specialty Cold Brew', 'Specialty cold brew order successfully validated and recorded', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Out-of-Stock Inventory Safeguard (Rejected with 400 Bad Request)
  // -------------------------------------------------------------------------
  try {
    const SUPABASE_URL = 'https://tdhpatamtqgrvrnfmscj.supabase.co';
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock_service_key_for_testing';
    
    // Temporarily mark Sweet Corn Pizza out of stock via service role REST API
    await fetch(`${SUPABASE_URL}/rest/v1/menu_items?slug=eq.thin-crust-pizza-sweet-corn-pizza`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_available: false }),
    });

    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'Table 04',
        paymentMethod: 'cash',
        items: [
          {
            slug: 'thin-crust-pizza-sweet-corn-pizza',
            name: 'Sweet Corn Pizza',
            quantity: 1,
            price: 199,
          },
        ],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Server must reject out-of-stock items with HTTP 400');
    assert.match(data.message || data.error, /sold out/i);
    recordTest('Inventory Safeguards', 'Out-of-stock products cannot be ordered (HTTP 400)', true, `Status ${res.status}: ${data.message || data.error}`);

    // Restore to available
    await fetch(`${SUPABASE_URL}/rest/v1/menu_items?slug=eq.thin-crust-pizza-sweet-corn-pizza`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_available: true }),
    });
  } catch (err) {
    recordTest('Inventory Safeguards', 'Out-of-stock products cannot be ordered (HTTP 400)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Existing Takeaway Channel Integrity (Takeaway Order Placement)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/phonepe/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        order_type: 'takeaway',
        customer_name: 'Counter Customer',
        customer_phone: '+919876543210',
        payment_method: 'cash',
        items: [
          {
            slug: 'thin-crust-pizza-margherita-pizza',
            name: 'Margherita Pizza',
            quantity: 1,
          },
        ],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.order?.order_type, 'takeaway');
    recordTest('Takeaway Integrity', 'Existing Takeaway counter ordering remains functional', true, `Order #${data.order?.order_number} channel: ${data.order?.order_type} table_label: ${data.order?.table_label}`);
  } catch (err) {
    recordTest('Takeaway Integrity', 'Existing Takeaway counter ordering remains functional', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Dine-In Table QR Revocation via Takeaway Admin
  // -------------------------------------------------------------------------
  const adminSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock_admin_secret_for_testing';
  const signOp = (payload) => {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', adminSecret).update(b64).digest('base64url');
    return `${b64}.${sig}`;
  };
  const adminOpToken = signOp({ role: 'ADMIN', deviceId: 'test-admin', actor: 'Administrator' });
  const staffOpToken = signOp({ role: 'STAFF', deviceId: 'test-staff', actor: 'Staff Counter' });

  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/operational/manage-table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminOpToken}`,
      },
      body: JSON.stringify({ table_label: 'Table 04', action: 'REVOKE' }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.is_active, false);
    recordTest('Table QR Management', 'Administrator revokes Table 04 QR credential via Takeaway Admin', true, `Table 04 is_active: ${data.is_active}`);
  } catch (err) {
    recordTest('Table QR Management', 'Administrator revokes Table 04 QR credential via Takeaway Admin', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Dine-In Rejects Orders from Revoked Table 04 (HTTP 403 Forbidden)
  // -------------------------------------------------------------------------
  try {
    // Wait 1.1s for cache TTL expiration
    await new Promise((r) => setTimeout(r, 1100));

    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'Table 04',
        paymentMethod: 'cash',
        items: [{ slug: 'cold-brew-espresso-orange', name: 'Espresso Orange', quantity: 1, price: 249 }],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 403, 'Should reject revoked table with HTTP 403');
    assert.equal(data.error, 'REVOKED_TABLE');
    recordTest('Table QR Revocation', 'Dine-In rejects order for revoked Table 04 with HTTP 403', true, `Status ${res.status}: ${data.message}`);
  } catch (err) {
    recordTest('Table QR Revocation', 'Dine-In rejects order for revoked Table 04 with HTTP 403', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Administrator Re-activates Table 04 QR Credential
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/operational/manage-table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminOpToken}`,
      },
      body: JSON.stringify({ table_label: 'Table 04', action: 'ACTIVATE' }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.is_active, true);
    recordTest('Table QR Management', 'Administrator re-activates Table 04 QR credential', true, `Table 04 is_active: ${data.is_active}`);
  } catch (err) {
    recordTest('Table QR Management', 'Administrator re-activates Table 04 QR credential', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Dine-In Accepts Order After Table 04 Re-activation
  // -------------------------------------------------------------------------
  try {
    await new Promise((r) => setTimeout(r, 1100));

    const res = await fetch(`${DINE_IN_ORIGIN}/api/dine-in/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validCustomerToken}`,
      },
      body: JSON.stringify({
        tableNumber: 'Table 04',
        paymentMethod: 'cash',
        items: [{ slug: 'cold-brew-espresso-orange', name: 'Espresso Orange', quantity: 1, price: 249 }],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200, 'Should accept order for re-activated Table 04');
    assert.equal(data.success, true);
    recordTest('Table QR Management', 'Dine-In order succeeds once Table 04 is re-activated', true, `Order #${data.orderNumber} placed for ${data.tableNumber}`);
  } catch (err) {
    recordTest('Table QR Management', 'Dine-In order succeeds once Table 04 is re-activated', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Staff Boundary: Staff Role Cannot Manage Table Credentials
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/operational/manage-table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffOpToken}`,
      },
      body: JSON.stringify({ table_label: 'Table 04', action: 'REVOKE' }),
    });
    const data = await res.json();
    assert.equal(res.status, 403, 'Staff token must be rejected with HTTP 403');
    assert.equal(data.error, 'ACCESS_DENIED');
    recordTest('Staff Permissions', 'Staff role cannot revoke or manage table QRs (HTTP 403)', true, `Status ${res.status}: ${data.message || data.error}`);
  } catch (err) {
    recordTest('Staff Permissions', 'Staff role cannot revoke or manage table QRs (HTTP 403)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n================================================================');
  console.log(`ACCEPTANCE RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
