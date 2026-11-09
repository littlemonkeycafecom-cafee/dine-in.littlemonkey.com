/**
 * Little Monkey Cafe Dining — Universal HTTP Helpers
 * Dual-compatible with Node.js http.IncomingMessage / ServerResponse and Vercel Serverless Functions.
 */
import { getAdminPin, isProduction } from './config.ts';
import { getSystemTime } from './qrAuthStore.ts';

export interface TokenValidationResult {
  valid: boolean;
  user?: {
    id: string;
    phone: string;
    name: string;
    role: string;
  };
  error?: string;
  message?: string;
}

export function verifySessionToken(token: string | null | undefined): TokenValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'NO_TOKEN',
      message: 'No authorization token provided. Please sign in to access Dine-In.',
    };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    return {
      valid: false,
      error: 'EMPTY_TOKEN',
      message: 'Empty authorization token. Please sign in to access Dine-In.',
    };
  }

  // 1. Check for standard Supabase JWT (3 base64url segments)
  if (cleanToken.includes('.') && cleanToken.split('.').length === 3) {
    try {
      const parts = cleanToken.split('.');
      const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadStr);

      const nowSec = Math.floor(getSystemTime() / 1000);
      if (payload.exp && payload.exp < nowSec) {
        return {
          valid: false,
          error: 'EXPIRED_SESSION',
          message: 'Your customer session has expired. Please sign in again.',
        };
      }

      if (!payload.sub) {
        return {
          valid: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid session token: missing subject identity.',
        };
      }

      const phone =
        payload.user_metadata?.phone ||
        payload.phone ||
        payload.phone_number ||
        '';

      const name =
        payload.user_metadata?.full_name ||
        payload.user_metadata?.name ||
        payload.name ||
        (phone ? `Diner ${String(phone).slice(-4)}` : 'Customer');

      return {
        valid: true,
        user: {
          id: payload.sub,
          phone: String(phone),
          name: String(name),
          role: payload.role || 'authenticated',
        },
      };
    } catch {
      return {
        valid: false,
        error: 'INVALID_TOKEN',
        message: 'Malformed session token signature or payload.',
      };
    }
  }

  // 2. Check for Structured Dev Session Token (e.g. dev_token.<base64>.lmc)
  if (cleanToken.startsWith('dev_token.') || cleanToken.startsWith('dev_session.')) {
    try {
      const parts = cleanToken.split('.');
      if (parts.length >= 2) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);

        const nowSec = Math.floor(getSystemTime() / 1000);
        if (payload.exp && payload.exp < nowSec) {
          return {
            valid: false,
            error: 'EXPIRED_SESSION',
            message: 'Your developer session has expired. Please sign in again.',
          };
        }

        if (!payload.sub) {
          return {
            valid: false,
            error: 'INVALID_TOKEN',
            message: 'Invalid token payload: missing subject id.',
          };
        }

        return {
          valid: true,
          user: {
            id: payload.sub,
            phone: payload.phone || '+919876543210',
            name: payload.name || 'Diner',
            role: payload.role || 'authenticated',
          },
        };
      }
    } catch {
      return {
        valid: false,
        error: 'INVALID_TOKEN',
        message: 'Malformed dev session token payload.',
      };
    }
  }

  // 3. Fallback dev preview token
  if (cleanToken === 'dev_preview_token' || cleanToken.startsWith('dev_token_')) {
    if (cleanToken.includes('expired')) {
      return {
        valid: false,
        error: 'EXPIRED_SESSION',
        message: 'Session has expired.',
      };
    }
    return {
      valid: true,
      user: {
        id: 'dev_user_preview',
        phone: '+919999999999',
        name: 'Preview Diner',
        role: 'authenticated',
      },
    };
  }

  return {
    valid: false,
    error: 'INVALID_TOKEN',
    message: 'Invalid authorization token format.',
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterSec: 0 };
}

export async function parseJsonBody<T = any>(req: any): Promise<T> {
  // 1. If Vercel already parsed the body, return it directly
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }

  // 2. If body is a string (e.g. from some proxies), parse it
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {} as T;
    }
  }

  // 3. Otherwise read from incoming stream (Vite / raw Node)
  return new Promise<T>((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer | string) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        // Guard against unbounded memory allocation (1MB payload limit)
        resolve({} as T);
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({} as T);
      }
    });
    req.on('error', () => resolve({} as T));
  });
}

export function sendJson(
  res: any,
  statusCode: number,
  data: any,
  headers?: Record<string, string | string[]>
): void {
  // Apply custom headers
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (Array.isArray(v)) {
        res.setHeader(k, v);
      } else {
        res.setHeader(k, String(v));
      }
    }
  }

  res.setHeader('Referrer-Policy', 'no-referrer');

  // If Vercel enhanced response is present
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }

  // Raw Node / Vite Connect middleware fallback
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

export function extractBearerToken(req: any): string | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export function extractDiningSessionToken(req: any): string | null {
  const bearer = extractBearerToken(req);
  if (bearer) return bearer;

  const cookieHeader = req.headers['cookie'];
  if (typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === 'lm_dining_session' && val) {
        return decodeURIComponent(val);
      }
    }
  }

  return null;
}

export function checkAdminAuth(req: any, body?: any, query?: URLSearchParams): boolean {
  const token = extractBearerToken(req);
  if (token) {
    const verification = verifySessionToken(token);
    if (verification.valid && verification.user?.role === 'admin') {
      return true;
    }
  }

  const expectedPin = getAdminPin();
  const pinHeader = req.headers['x-operational-pin'] || req.headers['x-admin-pin'];
  if (pinHeader && typeof pinHeader === 'string' && pinHeader.trim() === expectedPin) {
    return true;
  }

  if (body?.adminPin && String(body.adminPin).trim() === expectedPin) {
    return true;
  }

  if (query && query.get('pin')?.trim() === expectedPin) {
    return true;
  }

  return false;
}

export function buildDiningSessionCookie(sessionId: string, maxAgeSec: number): string {
  const isProd = isProduction();
  const secureFlag = isProd ? '; Secure' : '';
  return `lm_dining_session=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly${secureFlag}`;
}

export function buildClearDiningSessionCookie(): string {
  const isProd = isProduction();
  const secureFlag = isProd ? '; Secure' : '';
  return `lm_dining_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secureFlag}`;
}

