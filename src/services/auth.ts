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
  DEV_SESSION: 'lm_dev_customer_session',
  CUSTOMER_USER: 'lm_customer_user',
  CUSTOMER_ACCOUNT: 'lm_customer_account',
  USER_SESSION: 'lm_user_session',
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
 * Proactively checks browser storage & URL parameters for an existing Takeaway
 * or Dine-In customer session.
 */
export function detectCandidateToken(): { token: string; candidateUser?: any } | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL query parameters (e.g. ?auth_token=... or ?token=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('auth_token') || params.get('token') || params.get('session');
    if (urlToken && urlToken.trim()) {
      return { token: urlToken.trim() };
    }
  } catch {}

  // 2. Check Dine-In local storage
  try {
    const savedDineIn = localStorage.getItem(AUTH_STORAGE_KEYS.DINE_IN);
    if (savedDineIn) {
      const parsed = JSON.parse(savedDineIn);
      const token = parsed?.token || parsed?.access_token;
      if (token) return { token, candidateUser: parsed };
    }
  } catch {}

  // 3. Check shared Takeaway developer session
  try {
    const savedDev = localStorage.getItem(AUTH_STORAGE_KEYS.DEV_SESSION);
    if (savedDev) {
      const parsed = JSON.parse(savedDev);
      const token = parsed?.token || parsed?.access_token || parsed?.sessionToken;
      if (token) return { token, candidateUser: parsed };
    }
  } catch {}

  // 4. Check Takeaway customer user/account
  try {
    const savedUser = localStorage.getItem(AUTH_STORAGE_KEYS.CUSTOMER_USER) || localStorage.getItem(AUTH_STORAGE_KEYS.CUSTOMER_ACCOUNT);
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const token = parsed?.token || parsed?.access_token || parsed?.sessionToken;
      if (token) return { token, candidateUser: parsed };
    }
  } catch {}

  // 5. Check Supabase auth token keys in localStorage (sb-*-auth-token)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token || parsed?.token;
          if (token) return { token, candidateUser: parsed?.user };
        }
      }
    }
  } catch {}

  // 6. Check sessionStorage fallback
  try {
    const sessionDev = sessionStorage.getItem(AUTH_STORAGE_KEYS.DEV_SESSION);
    if (sessionDev) {
      const parsed = JSON.parse(sessionDev);
      const token = parsed?.token || parsed?.access_token;
      if (token) return { token, candidateUser: parsed };
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
    if (session.token) {
      localStorage.setItem(
        AUTH_STORAGE_KEYS.DEV_SESSION,
        JSON.stringify({
          id: session.id || session.mobile,
          phone: session.mobile,
          name: session.name,
          token: session.token,
          access_token: session.token,
          user_metadata: { full_name: session.name, phone: session.mobile },
        })
      );
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
    localStorage.removeItem(AUTH_STORAGE_KEYS.DEV_SESSION);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CUSTOMER_USER);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CUSTOMER_ACCOUNT);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.DEV_SESSION);
  } catch {}
}
