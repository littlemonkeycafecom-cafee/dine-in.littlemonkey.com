import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const BASE_URL = 'http://127.0.0.1:3000';

async function runAuthSecurityTests() {
  console.log('================================================================');
  console.log('SUITE 1: AUTHENTICATION, SECURITY & GUEST ACCESS VERIFICATION');
  console.log('================================================================\n');

  const testResults = [];

  function record(name, status, details = '') {
    testResults.push({ name, status, details });
    const sym = status === 'PASS' ? '[PASS]' : '[FAIL]';
    console.log(`${sym} ${name}${details ? ` -> ${details}` : ''}`);
  }

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated API Boundary Tests
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Server-Side API Authorization Enforcement');

  // 1A. /api/dine-in/session without token
  const resSessionNoAuth = await fetch(`${BASE_URL}/api/dine-in/session`);
  const dataSessionNoAuth = await resSessionNoAuth.json().catch(() => ({}));
  if (resSessionNoAuth.status === 401 && dataSessionNoAuth.error === 'UNAUTHORIZED') {
    record('API: Protected session rejects unauthenticated request with 401', 'PASS');
  } else {
    record('API: Protected session rejects unauthenticated request with 401', 'FAIL', `Status: ${resSessionNoAuth.status}`);
  }

  // 1B. /api/dine-in/order without token
  const resOrderNoAuth = await fetch(`${BASE_URL}/api/dine-in/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableNumber: 'Table 04', items: [{ slug: 'cold-brew', quantity: 1 }] }),
  });
  const dataOrderNoAuth = await resOrderNoAuth.json().catch(() => ({}));
  if (resOrderNoAuth.status === 401 && dataOrderNoAuth.error === 'UNAUTHORIZED') {
    record('API: Protected order endpoint rejects unauthenticated request with 401', 'PASS');
  } else {
    record('API: Protected order endpoint rejects unauthenticated request with 401', 'FAIL', `Status: ${resOrderNoAuth.status}`);
  }

  // 1C. /api/operational/manage-device without admin credentials
  const resAdminNoAuth = await fetch(`${BASE_URL}/api/operational/manage-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'test_dev', subAction: 'REGISTER' }),
  });
  const dataAdminNoAuth = await resAdminNoAuth.json().catch(() => ({}));
  if (resAdminNoAuth.status === 403 && dataAdminNoAuth.error === 'ACCESS_DENIED') {
    record('API: Administrative endpoint rejects unauthenticated request with 403', 'PASS');
  } else {
    record('API: Administrative endpoint rejects unauthenticated request with 403', 'FAIL', `Status: ${resAdminNoAuth.status}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Input Validation & Anti-Brute Force Protection
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Credential Validation & Failure Handlers');

  // 2A. Invalid phone number format
  const resBadPhone = await fetch(`${BASE_URL}/api/auth/customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '123', password: 'secretpassword' }),
  });
  const dataBadPhone = await resBadPhone.json().catch(() => ({}));
  if (resBadPhone.status === 400 && dataBadPhone.error) {
    record('Auth: Invalid phone number rejected with HTTP 400', 'PASS', dataBadPhone.error);
  } else {
    record('Auth: Invalid phone number rejected with HTTP 400', 'FAIL', `Status: ${resBadPhone.status}`);
  }

  // 2B. Short password (< 4 chars)
  const resShortPass = await fetch(`${BASE_URL}/api/auth/customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', password: '12' }),
  });
  const dataShortPass = await resShortPass.json().catch(() => ({}));
  if (resShortPass.status === 400 && dataShortPass.error) {
    record('Auth: Short password rejected with HTTP 400', 'PASS', dataShortPass.error);
  } else {
    record('Auth: Short password rejected with HTTP 400', 'FAIL', `Status: ${resShortPass.status}`);
  }

  // ---------------------------------------------------------------------------
  // 3. Customer Session Authentication & Server Token Validation
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Customer Login & Cryptographic Token Verification');

  const validTestPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
  const validTestPassword = 'StrongPassword123';
  
  // Register customer in shared database
  const resRegister = await fetch(`${BASE_URL}/api/auth/customer-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Verified Diner',
      phone: validTestPhone,
      password: validTestPassword,
    }),
  });
  const dataRegister = await resRegister.json().catch(() => ({}));
  if (resRegister.ok && dataRegister.user) {
    record('Auth: Customer registration in shared Supabase backend succeeds', 'PASS', `ID: ${dataRegister.user.id}`);
  } else {
    record('Auth: Customer registration in shared Supabase backend succeeds', 'FAIL', JSON.stringify(dataRegister));
  }

  // Log in with created credentials
  const resLogin = await fetch(`${BASE_URL}/api/auth/customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: validTestPhone, password: validTestPassword }),
  });
  const dataLogin = await resLogin.json().catch(() => ({}));
  const customerToken = dataLogin.session?.access_token || dataLogin.token;

  if (resLogin.ok && customerToken) {
    record('Auth: Valid customer login succeeds and returns authentic session JWT', 'PASS', `Token length: ${customerToken.length}`);
  } else {
    record('Auth: Valid customer login succeeds and returns authentic session JWT', 'FAIL', JSON.stringify(dataLogin));
  }

  // Validate the customer token server-side
  const resValCustomer = await fetch(`${BASE_URL}/api/auth/validate-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ token: customerToken }),
  });
  const dataValCustomer = await resValCustomer.json().catch(() => ({}));
  if (resValCustomer.ok && dataValCustomer.valid && dataValCustomer.user?.role !== 'guest') {
    record('Auth: Server cryptographic session validation confirms customer role', 'PASS', `User: ${dataValCustomer.user?.name} (Role: ${dataValCustomer.user?.role})`);
  } else {
    record('Auth: Server cryptographic session validation confirms customer role', 'FAIL', JSON.stringify(dataValCustomer));
  }

  // ---------------------------------------------------------------------------
  // 4. Expired Token Enforcement
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Expired Token Rejection');

  const expiredPayload = {
    sub: 'user_expired_test',
    phone: '+919876543210',
    name: 'Expired Diner',
    role: 'customer',
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
  };
  const expiredToken = `dev_token.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64')}.lmc`;

  const resValExpired = await fetch(`${BASE_URL}/api/auth/validate-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${expiredToken}`,
    },
    body: JSON.stringify({ token: expiredToken }),
  });
  const dataValExpired = await resValExpired.json().catch(() => ({}));
  if (resValExpired.status === 401 && dataValExpired.error === 'EXPIRED_SESSION') {
    record('Auth: Expired session token is cryptographically rejected with 401 EXPIRED_SESSION', 'PASS');
  } else {
    record('Auth: Expired session token is cryptographically rejected with 401 EXPIRED_SESSION', 'FAIL', JSON.stringify(dataValExpired));
  }

  // ---------------------------------------------------------------------------
  // 5. Guest Preview Security & Role Restrictions
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Guest Preview Security Boundaries');

  // 5A. Generate guest session in dev
  const resGuest = await fetch(`${BASE_URL}/api/auth/guest-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableNumber: 'Table 04' }),
  });
  const dataGuest = await resGuest.json().catch(() => ({}));
  const guestToken = dataGuest.token;

  if (resGuest.ok && guestToken && dataGuest.user?.role === 'guest') {
    record('Guest: Dev guest preview generates token with explicit role: "guest"', 'PASS', `User: ${dataGuest.user?.name}`);
  } else {
    record('Guest: Dev guest preview generates token with explicit role: "guest"', 'FAIL', JSON.stringify(dataGuest));
  }

  // 5B. Verify guest session token validation confirms role === 'guest'
  const resValGuest = await fetch(`${BASE_URL}/api/auth/validate-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`,
    },
    body: JSON.stringify({ token: guestToken }),
  });
  const dataValGuest = await resValGuest.json().catch(() => ({}));
  if (resValGuest.ok && dataValGuest.valid && dataValGuest.user?.role === 'guest') {
    record('Guest: Server validation confirms role is strictly "guest"', 'PASS');
  } else {
    record('Guest: Server validation confirms role is strictly "guest"', 'FAIL');
  }

  // 5C. Confirm guest cannot access administrative endpoints
  const resGuestAdmin = await fetch(`${BASE_URL}/api/operational/manage-device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`,
    },
    body: JSON.stringify({ deviceId: 'test_dev', subAction: 'REGISTER' }),
  });
  const dataGuestAdmin = await resGuestAdmin.json().catch(() => ({}));
  if (resGuestAdmin.status === 403 && dataGuestAdmin.error === 'ACCESS_DENIED') {
    record('Guest: Guest token blocked from administrative APIs with HTTP 403 ACCESS_DENIED', 'PASS');
  } else {
    record('Guest: Guest token blocked from administrative APIs with HTTP 403 ACCESS_DENIED', 'FAIL', `Status: ${resGuestAdmin.status}`);
  }

  // 5D. Confirm guest cannot place orders via API
  const resGuestOrder = await fetch(`${BASE_URL}/api/dine-in/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`,
    },
    body: JSON.stringify({
      tableNumber: 'Table 04',
      items: [{ slug: 'vietnamese-cold-brew', quantity: 1, unitPrice: 249 }],
    }),
  });
  const dataGuestOrder = await resGuestOrder.json().catch(() => ({}));
  if (resGuestOrder.status === 403 && dataGuestOrder.error === 'GUEST_ORDERING_FORBIDDEN') {
    record('Guest: Guest token blocked from placing orders with HTTP 403 GUEST_ORDERING_FORBIDDEN', 'PASS');
  } else {
    record('Guest: Guest token blocked from placing orders with HTTP 403 GUEST_ORDERING_FORBIDDEN', 'FAIL', `Status: ${resGuestOrder.status} ${JSON.stringify(dataGuestOrder)}`);
  }

  // ---------------------------------------------------------------------------
  // 6. Frontend Login Gate & Absence of OTP / SMS / Email
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Frontend Auth Gate Inspection');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(`${BASE_URL}/?table=4`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form', { timeout: 4000 });

  const authFormAudit = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const inputTypes = inputs.map(i => i.getAttribute('type') || 'text');
    const inputPlaceholders = inputs.map(i => i.getAttribute('placeholder') || '');
    const bodyText = document.body.innerText.toLowerCase();

    const hasOtpInput = inputPlaceholders.some(p => p.toLowerCase().includes('otp') || p.toLowerCase().includes('sms'));
    const hasEmailInput = inputTypes.includes('email') || inputPlaceholders.some(p => p.toLowerCase().includes('email'));
    const mentionsOtpOrSms = bodyText.includes('enter otp') || bodyText.includes('sms verification') || bodyText.includes('one-time password');

    const hasMobileInput = inputPlaceholders.some(p => p.toLowerCase().includes('10-digit') || p.toLowerCase().includes('number'));
    const hasPasswordInput = inputTypes.includes('password');

    return {
      inputsCount: inputs.length,
      hasOtpInput,
      hasEmailInput,
      mentionsOtpOrSms,
      hasMobileInput,
      hasPasswordInput,
    };
  });

  console.log('  Auth Form Audit Details:', authFormAudit);
  assert(!authFormAudit.hasOtpInput, 'No OTP input field should exist');
  assert(!authFormAudit.hasEmailInput, 'No Email input field should exist');
  assert(!authFormAudit.mentionsOtpOrSms, 'No OTP or SMS verification text should exist');
  assert(authFormAudit.hasMobileInput, 'Mobile number input must exist');
  assert(authFormAudit.hasPasswordInput, 'Password input must exist');

  record('UI: Authentication is strictly 10-digit mobile number + password (NO OTP, NO SMS, NO Email)', 'PASS');

  // ---------------------------------------------------------------------------
  // 7. Logout Verification
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Logout Flow & Session Revocation');

  // Log in as guest diner
  const guestBtn = await page.waitForSelector('button ::-p-text(Continue as Guest)', { timeout: 3000 });
  await guestBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // Verify entered menu
  await page.waitForSelector('header', { timeout: 3000 });

  // Open user dropdown and click Sign Out
  const userAvatar = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    return btns.find(b => b.innerText.includes('Guest') || b.querySelector('div[style*="border-radius: 50%"]'));
  });
  await userAvatar.click();
  await new Promise(r => setTimeout(r, 300));

  const signOutBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.innerText.includes('Sign Out'));
  });
  await signOutBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // Verify returned to login gate
  const backToLoginGate = await page.waitForSelector('input[type="tel"], input[placeholder*="10-digit"]', { timeout: 3000 });
  assert(backToLoginGate, 'Sign Out must return user to the mandatory login gate.');

  const sessionCleared = await page.evaluate(() => {
    return !localStorage.getItem('lm_dinein_auth_v2') && !sessionStorage.getItem('lm_dinein_session');
  });
  assert(sessionCleared, 'Customer session must be purged from storage upon logout.');

  record('UI: Sign Out successfully purges session and returns to login gate', 'PASS');

  await browser.close();

  console.log('\n================================================================');
  console.log(`SUITE 1 COMPLETE: ${testResults.filter(r => r.status === 'PASS').length} of ${testResults.length} TESTS PASSED`);
  console.log('================================================================\n');

  return testResults;
}

runAuthSecurityTests().catch(err => {
  console.error('\nSuite 1 encountered an unexpected failure:', err);
  process.exit(1);
});
