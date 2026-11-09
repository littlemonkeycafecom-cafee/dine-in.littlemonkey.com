/**
 * auth.ts — Client-Side Customer Authentication & Session Management
 *
 * Implements:
 * - Shared customer authentication with Little Monkey Café backend
 * - Server-side cryptographic token validation before granting Dine-In menu access
 * - Cross-origin / shared storage detection of existing Takeaway sessions
 * - Seamless single sign-on handoff without duplicate customer records
 */

import { CustomerSession } from '../types';

export interface ValidationResult {
  valid: boolean;
  user?: {
    id: string;
    phone: string;
    name: string;
    role: string;
  };
  token?: string;
  error?: string;
  message?: string;
}

export const AUTH_STORAGE_KEYS = {
  DINE_IN: 'lm_dinein_auth_v2',
  DINING_SESSION: 'lm_dining_session_token',
  QR_PROOF: 'lm_dining_qr_proof',
  TWO_FA_CHALLENGE: 'lm_dining_2fa_challenge',
};

export interface CustomerRecordResult {
  success: boolean;
  status?: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER' | 'EXISTING_CUSTOMER_NAME_MISMATCH';
  customer?: {
    customerId: string;
    name: string;
    submittedName?: string;
    mobile: string;
    role?: string;
  };
  sessionToken?: string;
  session?: any;
  error?: string;
  message?: string;
}

/**
 * Normalizes input string to a 10-digit Indian mobile number.
 * Strips non-digits, country code +91 or 91 prefix, and leading 0.
 */
export function normalizeIndianMobile(raw: string): string {
  let cleaned = String(raw || '').replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Validates whether string is a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).
 */
export function isValidIndianMobile(raw: string): boolean {
  const normalized = normalizeIndianMobile(raw);
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Performs a password-free lookup for an existing customer by 10-digit mobile number.
 * Requires an unconsumed qrProofToken.
 */
export async function lookupCustomer(
  mobile: string,
  qrProofToken: string
): Promise<{
  success: boolean;
  exists?: boolean;
  customer?: { customerId: string; name: string; mobile: string };
  mobile?: string;
  error?: string;
  message?: string;
}> {
  const cleanMobile = normalizeIndianMobile(mobile);
  if (!isValidIndianMobile(cleanMobile)) {
    return {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    };
  }

  if (!qrProofToken) {
    return {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Physical table QR verification is required to verify mobile number.',
    };
  }

  try {
    const res = await fetch('/api/dine-in/customer/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: cleanMobile,
        qrProofToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'LOOKUP_FAILED',
        message: data.message || 'Unable to verify mobile number. Please try again.',
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to connect to customer verification service. Please check your network connection.',
    };
  }
}

/**
 * Continues into a 15-minute Dining Session as an existing registered customer.
 * Uses the server-stored authoritative identity (never allows overwriting).
 */
export async function continueExistingCustomer(
  mobile: string,
  qrProofToken: string
): Promise<CustomerRecordResult> {
  const cleanMobile = normalizeIndianMobile(mobile);
  if (!isValidIndianMobile(cleanMobile)) {
    return {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Please enter a valid 10-digit Indian mobile number.',
    };
  }

  if (!qrProofToken) {
    return {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Physical table QR verification is required.',
    };
  }

  try {
    const res = await fetch('/api/dine-in/customer/continue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: cleanMobile,
        qrProofToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.status) {
      return {
        success: false,
        error: data.error || 'CONTINUE_FAILED',
        message: data.message || 'Customer continuation failed. Please try again.',
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to connect to customer service. Please check your network connection.',
    };
  }
}

/**
 * Submits customer name and 10-digit mobile to server-side Google Sheets customer service.
 * Requires verified qrProofToken from physical table QR scan.
 */
export async function submitCustomerRecord(
  name: string,
  mobile: string,
  qrProofToken: string,
  confirmedExistingName?: boolean
): Promise<CustomerRecordResult> {
  const cleanMobile = normalizeIndianMobile(mobile);
  const cleanName = String(name || '').trim();

  if (!cleanName || cleanName.length < 1 || cleanName.length > 60) {
    return {
      success: false,
      error: 'INVALID_NAME',
      message: 'Please enter a valid full name (1 to 60 characters).',
    };
  }

  if (!isValidIndianMobile(cleanMobile)) {
    return {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    };
  }

  if (!qrProofToken) {
    return {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Physical table QR verification is required to register.',
    };
  }

  try {
    const res = await fetch('/api/dine-in/customer-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanName,
        mobile: cleanMobile,
        qrProofToken,
        confirmedExistingName: Boolean(confirmedExistingName),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.status) {
      return {
        success: false,
        error: data.error || 'REGISTRATION_FAILED',
        message: data.message || 'Customer record processing failed. Please try again.',
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to connect to customer registration service. Please check your network connection.',
    };
  }
}

/**
 * Validates a customer token server-side via /api/auth/validate-session.
 * Never trusts unverified frontend localStorage flags.
 */
export async function validateSessionToken(token: string): Promise<ValidationResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'NO_TOKEN', message: 'No token provided' };
  }

  try {
    const res = await fetch('/api/auth/validate-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        user: data.user,
        token,
      };
    }

    return {
      valid: false,
      error: data.error || 'INVALID_SESSION',
      message: data.message || 'Session validation failed',
    };
  } catch (err: any) {
    console.warn('[authService] Server session validation network error:', err?.message);
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to reach the authentication service.',
    };
  }
}

/**
 * Signs in via the shared Little Monkey Café customer authentication system.
 * Uses mobile number and password only.
 */
export async function customerSignIn(
  mobile: string,
  password?: string
): Promise<{ success: boolean; session?: any; user?: any; token?: string; error?: string }> {
  try {
    const cleanMobile = mobile.replace(/\D/g, '');
    const res = await fetch('/api/auth/customer-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanMobile,
        password: password || 'nopassword',
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || 'Authentication failed. Please check your credentials.',
      };
    }

    const token = data.session?.access_token || data.token || data.sessionToken;
    const user = data.user || data.session?.user;

    return {
      success: true,
      session: data.session,
      user,
      token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to reach authentication server. Please check your network connection.',
    };
  }
}

/**
 * Registers a new customer in the shared Little Monkey Café account database.
 */
export async function customerSignUp(
  fullName: string,
  mobile: string,
  password?: string
): Promise<{ success: boolean; session?: any; user?: any; token?: string; error?: string }> {
  try {
    const cleanMobile = mobile.replace(/\D/g, '');
    const res = await fetch('/api/auth/customer-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: cleanMobile,
        password: password || 'nopassword',
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || 'Failed to create account.',
      };
    }

    const token = data.session?.access_token || data.token;
    const user = data.user || data.session?.user;

    return {
      success: true,
      session: data.session,
      user,
      token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to connect to registration server. Please try again.',
    };
  }
}

/**
 * Creates an authentic server-side guest session for diners.
 */
export async function createGuestSession(
  _tableNumber: string
): Promise<{ token: string; user: any }> {
  throw new Error('Guest preview mode has been decommissioned. Mandatory customer registration or sign-in is required.');
}

/**
 * Resolves any existing customer session in this application's local storage.
 * Follows standard session management without custom SSO, token sniffing, or URL parameters.
 */
export function detectCandidateToken(): { token: string; candidateUser?: any } | null {
  if (typeof window === 'undefined') return null;

  // 1. Check standard Dine-In session storage
  try {
    const savedDineIn = localStorage.getItem(AUTH_STORAGE_KEYS.DINE_IN);
    if (savedDineIn) {
      const parsed = JSON.parse(savedDineIn);
      const token = parsed?.token || parsed?.access_token;
      if (token) return { token, candidateUser: parsed };
    }
  } catch {}

  // 2. Check standard Supabase client token storage (sb-*-auth-token)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token || parsed?.token;
          if (token) return { token, candidateUser: parsed?.user };
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Strips auth token query params from URL without page reload.
 */
export function cleanAuthUrlParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const p of ['auth_token', 'token', 'session']) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }
  } catch {}
}

/**
 * Persists a verified customer session to local storage.
 */
export function persistCustomerSession(session: CustomerSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.DINE_IN, JSON.stringify(session));
  } catch {}
}

/**
 * Verifies a scanned table QR credential against the backend.
 */
export async function verifyScannedQr(
  table: string,
  cred: string
): Promise<{
  valid: boolean;
  requires2fa?: boolean;
  challengeToken?: string;
  tableNumber?: string;
  shortCode?: string;
  qrProofToken?: string;
  credentialId?: string;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/dine-in/verify-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, cred }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.requires2fa) {
      return {
        valid: false,
        requires2fa: true,
        challengeToken: data.challengeToken,
        tableNumber: data.tableNumber,
        shortCode: data.shortCode,
        message: data.message,
      };
    }

    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
        shortCode: data.shortCode,
        qrProofToken: data.qrProofToken,
        credentialId: data.credentialId,
        message: data.message,
      };
    }

    return {
      valid: false,
      error: data.error || 'INVALID_QR',
      message: data.message || 'QR code verification failed.',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Failed to verify QR code with café server.',
    };
  }
}

/**
 * Validates second factor (table symbol / code) against challenge token.
 */
export async function verifyDualFactorChallenge(params: {
  challengeToken?: string;
  table?: string;
  cred?: string;
  symbol?: string;
  code?: string;
}): Promise<{
  valid: boolean;
  tableNumber?: string;
  shortCode?: string;
  qrProofToken?: string;
  credentialId?: string;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
        shortCode: data.shortCode,
        qrProofToken: data.qrProofToken,
        credentialId: data.credentialId,
        message: data.message,
      };
    }

    return {
      valid: false,
      error: data.error || 'VERIFICATION_FAILED',
      message: data.message || 'Table verification failed.',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Failed to connect to verification server. Please check your network connection.',
    };
  }
}

/**
 * Verifies an active unconsumed QR proof token (e.g. on page refresh).
 */
export async function checkQrProofStatus(
  qrProofToken: string
): Promise<{ valid: boolean; tableNumber?: string; credentialId?: string; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/dine-in/verify-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrProofToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
        credentialId: data.credentialId,
      };
    }

    return {
      valid: false,
      error: data.error || 'INVALID_QR_PROOF',
      message: data.message || 'Table QR proof verification failed.',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Failed to verify QR proof with café server.',
    };
  }
}

/**
 * Initiates a 15-minute Dining Session binding Table QR Proof + Customer Token.
 */
export async function initiateDiningSession(
  qrProofToken: string,
  customerToken: string
): Promise<{ success: boolean; sessionToken?: string; session?: any; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/dine-in/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrProofToken, token: customerToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return {
        success: true,
        sessionToken: data.sessionToken,
        session: data.session,
      };
    }

    return {
      success: false,
      error: data.error || 'SESSION_CREATION_FAILED',
      message: data.message || 'Could not initiate dining session.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to dining session server.',
    };
  }
}

/**
 * Checks active Dining Session validity & remaining time.
 */
export async function checkDiningSessionStatus(
  sessionToken?: string
): Promise<{
  valid: boolean;
  tableNumber?: string;
  timeRemainingMs?: number;
  expiresAt?: number;
  durationMs?: number;
  serverTime?: number;
  error?: string;
  message?: string;
  customer?: { id: string; name: string; phone: string; role?: string };
}> {
  try {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['X-Dining-Session'] = sessionToken;
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    const res = await fetch('/api/dine-in/session-status', {
      headers,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
        timeRemainingMs: data.timeRemainingMs,
        expiresAt: data.expiresAt,
        durationMs: data.durationMs,
        serverTime: data.serverTime,
        customer: data.customer,
      };
    }

    return {
      valid: false,
      tableNumber: data.tableNumber,
      error: data.error || 'INVALID_SESSION',
      message: data.message || 'Dining session is no longer active.',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Could not contact dining session service.',
    };
  }
}

/**
 * Explicitly terminates active dining session on the server.
 */
export async function terminateDiningSession(sessionToken?: string): Promise<void> {
  if (!sessionToken) return;
  try {
    await fetch('/api/dine-in/logout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dining-Session': sessionToken,
      },
      body: JSON.stringify({ sessionToken }),
    });
  } catch {}
}

/**
 * Cleans QR credential query params from URL without page reload.
 */
export function cleanQrUrlParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const p of ['cred', 'c', 'auth_token', 'token']) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }
  } catch {}
}

/**
 * Clears customer session from local storage.
 */
export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.DINE_IN);
  } catch {}
}
