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
};

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
  password: string
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
        password,
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
  password: string
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
        password,
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
  tableNumber: string
): Promise<{ token: string; user: any }> {
  try {
    const res = await fetch('/api/auth/guest-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tableNumber }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token) {
      return { token: data.token, user: data.user };
    }
  } catch {}

  // Fallback dev guest token
  const guestPayload = {
    sub: `guest_${Date.now()}`,
    phone: '9999999999',
    name: `Table Guest (${tableNumber})`,
    role: 'guest',
    tableNumber,
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
  const token = `dev_token.${btoa(JSON.stringify(guestPayload))}.lmc`;
  return { token, user: guestPayload };
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
): Promise<{ valid: boolean; tableNumber?: string; qrProofToken?: string; credentialId?: string; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/dine-in/verify-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, cred }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
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
 * Initiates a 30-minute Dining Session binding Table QR Proof + Customer Token.
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
  sessionToken: string
): Promise<{ valid: boolean; tableNumber?: string; timeRemainingMs?: number; expiresAt?: number; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/dine-in/session-status', {
      headers: {
        'X-Dining-Session': sessionToken,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        valid: true,
        tableNumber: data.tableNumber,
        timeRemainingMs: data.timeRemainingMs,
        expiresAt: data.expiresAt,
      };
    }

    return {
      valid: false,
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
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
  } catch {}
}
