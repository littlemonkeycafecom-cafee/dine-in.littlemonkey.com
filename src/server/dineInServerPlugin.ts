/**
 * dineInServerPlugin.ts — Server-Side Security, QR Table Authorization & 15-Minute Dining Sessions
 *
 * Implements:
 * 1. Server-Authorized QR Verification (/api/dine-in/verify-qr):
 *    - Validates scanned table QR against server-stored cryptographic hashes
 *    - Enforces 6 physical tables (Table 01 to Table 06)
 *    - Issues short-lived signed QR Proof Token (5 minutes) for login handoff
 * 2. Strict 15-Minute Server-Side Dining Sessions (/api/dine-in/create-session, /api/dine-in/session-status):
 *    - Binds verified table identity, QR credential, and authenticated customer
 *    - Fixed 900,000 ms lifetime with zero sliding extensions
 *    - Rejects expired sessions with HTTP 401 DINING_SESSION_EXPIRED
 *    - Immediate revocation when QR credential or table is rotated/deactivated
 * 3. Administrative QR Management (/api/admin/qr/*):
 *    - Overview of 6 physical tables, active credentials, and session counts
 *    - High-entropy cryptographic credential generation & rotation
 *    - Instant table credential revocation with cascading session termination
 *    - Print-ready high-contrast vector PDF export for the 6 physical tables
 * 4. Deterministic Test Clock (/api/test/advance-time, /api/test/reset-time):
 *    - Verifiable automated expiry testing without waiting 15 real minutes
 * 5. Multi-Layer Sliding Window Rate Limiting:
 *    - QR Verification: 15 req/min per IP
 *    - Customer Auth: 20 req/min per IP
 *    - Admin QR Operations: 30 req/min per IP
 *    - General Dining APIs: 240 req/min per IP
 * 6. Shared Authoritative Backend & Database Integrations:
 *    - Preserves existing customer mobile & password authentication
 *    - In-memory 5s cached menu_items availability query to protect Supabase
 *    - Read-only dining protection
 */

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {}
import {
  AUTHORITATIVE_TABLES,
  generateTableCredential,
  revokeTableCredential,
  verifyQrPayload,
  verifyDualFactor,
  verifyQrProofToken,
  createDiningSession,
  validateDiningSession,
  revokeDiningSession,
  getAdminTablesOverview,
  generateSixTablesPdf,
  advanceSystemTime,
  resetSystemTime,
  initializeQrStore,
  getSystemTime,
  getCredentialById,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  FIXED_SESSION_DURATION_MS,
} from './qrAuthStore.ts';
import { getStorageProvider } from './storage.ts';
import { buildDiningSessionCookie, buildClearDiningSessionCookie } from './http.ts';
import {
  relayCustomerLookup,
  relayCustomerContinue,
  cacheCustomerRecord,
  cleanMobileNumber,
  getNextSequentialCustomerId,
  commitSequentialCustomerId,
  registrationMutex,
} from './sheetsRelay.ts';

const SHARED_BACKEND_ORIGIN = process.env.VITE_BACKEND_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tdhpatamtqgrvrnfmscj.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PBDOJAlQHqHqQyAo2OiFkw_kQTIDDJT';
const ADMIN_OPERATIONAL_PIN = process.env.ADMIN_PIN || '9999';

export const VALID_CAFÉ_TABLES = AUTHORITATIVE_TABLES.map((t) => t.tableNumber);

export function normalizeTableLabel(rawTable: string | null | undefined): string | null {
  if (!rawTable || typeof rawTable !== 'string') return null;
  const cleaned = rawTable.trim();
  const match = /^(?:table\s*|t)?0*([1-9]\d*)$/i.exec(cleaned);
  if (match) {
    const num = parseInt(match[1], 10);
    return `Table ${String(num).padStart(2, '0')}`;
  }
  return cleaned;
}

export function isValidDiningTable(rawTable: string | null | undefined): { valid: boolean; normalized: string | null } {
  const normalized = normalizeTableLabel(rawTable);
  if (!normalized) return { valid: false, normalized: null };
  const isValid = VALID_CAFÉ_TABLES.some(
    (t) => t.toLowerCase() === normalized.toLowerCase()
  );
  return { valid: isValid, normalized };
}

let _cachedTables: Record<string, boolean> = {};
let _lastTableFetch = 0;
let _cachedAvailability: Record<string, boolean> = {};
let _cachedImages: Record<string, string> = {};
let _lastAvailabilityFetch = 0;

export async function getLiveTableStatus(rawTable: string | null | undefined): Promise<{
  valid: boolean;
  normalized: string | null;
  isActive: boolean;
}> {
  const check = isValidDiningTable(rawTable);
  if (!check.valid || !check.normalized) {
    return { valid: false, normalized: null, isActive: false };
  }

  // First check local server QR store for revocation
  const activeCred = getActiveCredentialForTable(check.normalized);
  if (!activeCred || !activeCred.isActive) {
    return { valid: true, normalized: check.normalized, isActive: false };
  }

  // Cross-check with shared store status
  const now = getSystemTime();
  if (now - _lastTableFetch > 1000 || Object.keys(_cachedTables).length === 0) {
    try {
      const res = await fetch(`${SHARED_BACKEND_ORIGIN}/api/operational/store-status`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tables)) {
          _cachedTables = {};
          for (const t of data.tables) {
            _cachedTables[t.table_label.toLowerCase()] = Boolean(t.is_active);
          }
          _lastTableFetch = now;
        }
      }
    } catch {}
  }

  const isActive = _cachedTables[check.normalized.toLowerCase()] !== false;
  return { valid: true, normalized: check.normalized, isActive };
}

interface TokenValidationResult {
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

  // 3. Check for Dev Preview Token / Guest tokens
  if (cleanToken === 'dev_preview_token' || cleanToken.startsWith('dev_token_')) {
    if (cleanToken.includes('expired')) {
      return {
        valid: false,
        error: 'EXPIRED_SESSION',
        message: 'Session has expired.',
      };
    }

    const isGuest = cleanToken.includes('guest');
    return {
      valid: true,
      user: {
        id: cleanToken,
        phone: isGuest ? '9999999999' : '+919876543210',
        name: isGuest ? 'Table Guest' : 'Bhuvan Teja',
        role: isGuest ? 'guest' : 'authenticated',
      },
    };
  }

  return {
    valid: false,
    error: 'UNRECOGNIZED_TOKEN',
    message: 'Session token could not be verified by the authentication service.',
  };
}

// Helper to read environment variables dynamically with fallback to local .env file
function getEnvConfig(key: string): string {
  if (process.env[key] !== undefined) return process.env[key]!;
  try {
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
          return trimmed.slice(key.length + 1).trim();
        }
      }
    }
  } catch {}
  return '';
}

// -----------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiters
// -----------------------------------------------------------------------------
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

let _testEmulatorForced = false;
const authRateLimits = new Map<string, RateLimitBucket>();
const apiRateLimits = new Map<string, RateLimitBucket>();
const qrRateLimits = new Map<string, RateLimitBucket>();
const twoFaRateLimits = new Map<string, RateLimitBucket>();
const adminRateLimits = new Map<string, RateLimitBucket>();

export function getClientIp(req: IncomingMessage): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(
  map: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = getSystemTime();
  const bucket = map.get(key);

  if (!bucket || now >= bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

// -----------------------------------------------------------------------------
// Google Sheets Customer Record Database (Local Sheet Emulator & File Persistence)
// -----------------------------------------------------------------------------
const LOCAL_CUSTOMERS_FILE = path.resolve(process.cwd(), 'src/data/local-customers-sheet.json');

export interface CustomerSheetRow {
  customer_id: string;
  name: string;
  mobile_number: string;
  created_at: string;
  updated_at: string;
}

export function loadLocalCustomers(): CustomerSheetRow[] {
  try {
    if (fs.existsSync(LOCAL_CUSTOMERS_FILE)) {
      const data = fs.readFileSync(LOCAL_CUSTOMERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[DineInServer] Error loading local customers sheet:', err);
  }
  return [];
}

export function saveLocalCustomers(rows: CustomerSheetRow[]): void {
  try {
    const dir = path.dirname(LOCAL_CUSTOMERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_CUSTOMERS_FILE, JSON.stringify(rows, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DineInServer] Error saving local customers sheet:', err);
  }
}

export function sanitizeFormula(val: string): string {
  if (typeof val !== 'string') return val;
  if (/^[\=\+\-\@\t\r]/.test(val)) {
    return "'" + val;
  }
  return val;
}

export async function handleDineInMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void = () => {}
): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1:3000');
  const pathname = parsedUrl.pathname;

        // Protect /storage/* from unauthenticated public direct access
        if (pathname.startsWith('/storage/')) {
          let isAuthorized = false;
          const authHeader = req.headers.authorization || req.headers.Authorization;
          if (authHeader && typeof authHeader === 'string') {
            const match = /^Bearer\s+(.+)$/i.exec(authHeader);
            if (match) {
              const verification = verifySessionToken(match[1].trim());
              if (verification.valid && verification.user?.role === 'admin') {
                isAuthorized = true;
              }
            }
          }
          const pinHeader = req.headers['x-operational-pin'] || req.headers['x-admin-pin'];
          if (pinHeader && typeof pinHeader === 'string' && pinHeader.trim() === ADMIN_OPERATIONAL_PIN) {
            isAuthorized = true;
          }
          const queryPin = parsedUrl.searchParams.get('pin');
          if (queryPin && queryPin.trim() === ADMIN_OPERATIONAL_PIN) {
            isAuthorized = true;
          }

          if (!isAuthorized) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.end(JSON.stringify({
              error: 'ADMIN_ACCESS_DENIED',
              message: 'Direct access to /storage/ is restricted to authenticated café administrators.'
            }));
            return;
          }
          return next();
        }

        // Only intercept /api/* endpoints — do not mutate Vite frontend HTML/asset headers
        if (!pathname.startsWith('/api/')) {
          return next();
        }

        // Apply security headers to API responses only
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

        const clientIp = getClientIp(req);

        // Helper: JSON response sender
        const sendJson = (code: number, data: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Referrer-Policy', 'no-referrer');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(JSON.stringify(data));
        };

        // Parse JSON body if present
        let body: any = {};
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          try {
            let raw = '';
            for await (const chunk of req) {
              raw += chunk;
              if (raw.length > 65536) {
                return sendJson(413, { error: 'Payload too large' });
              }
            }
            body = raw ? JSON.parse(raw) : {};
          } catch {
            return sendJson(400, { error: 'Invalid JSON request payload' });
          }
        }

        // Helper to extract Bearer token from header or body
        const extractBearerToken = (): string | null => {
          const authHeader = req.headers.authorization || req.headers.Authorization;
          if (authHeader && typeof authHeader === 'string') {
            const match = /^Bearer\s+(.+)$/i.exec(authHeader);
            if (match) return match[1].trim();
          }
          if (body?.token && typeof body.token === 'string') {
            return body.token.trim();
          }
          const queryToken = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('auth_token');
          if (queryToken) return queryToken.trim();
          return null;
        };

        // Helper to extract Dining Session token from header, body, or cookie
        const extractDiningSessionToken = (): string | null => {
          const bearer = extractBearerToken();
          if (bearer && (bearer.startsWith('dinesess_') || bearer.startsWith('lm_sess_'))) return bearer;
          const headerSess = req.headers['x-dining-session'];
          if (headerSess && typeof headerSess === 'string') return headerSess.trim();
          if (body?.sessionToken && typeof body.sessionToken === 'string') return body.sessionToken.trim();
          if (body?.sessionId && typeof body.sessionId === 'string') return body.sessionId.trim();
          const querySess = parsedUrl.searchParams.get('dining_session') || parsedUrl.searchParams.get('session_id');
          if (querySess) return querySess.trim();

          // Also check Cookie header
          const cookieHeader = req.headers.cookie;
          if (cookieHeader && typeof cookieHeader === 'string') {
            const match = /lm_dining_session=([^;]+)/.exec(cookieHeader);
            if (match) return decodeURIComponent(match[1].trim());
          }
          return null;
        };

        // Layer 1: Strict Rate Limiting on Auth Endpoints (20 requests / min per IP)
        if (pathname.startsWith('/api/auth/')) {
          const authLimit = checkRateLimit(authRateLimits, `auth:${clientIp}`, 20, 60000);
          res.setHeader('X-RateLimit-Limit', '20');
          res.setHeader('X-RateLimit-Remaining', String(authLimit.remaining));
          if (!authLimit.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', String(authLimit.retryAfterSec));
            res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Authentication rate limit exceeded. Please retry after ${authLimit.retryAfterSec} seconds.`,
                retryAfter: authLimit.retryAfterSec,
              })
            );
            return;
          }
        }

        // Layer 2: Strict Rate Limiting on QR Verification (15 requests / min per IP)
        if (pathname === '/api/dine-in/verify-qr') {
          const qrLimit = checkRateLimit(qrRateLimits, `qr:${clientIp}`, 15, 60000);
          res.setHeader('X-RateLimit-Limit', '15');
          res.setHeader('X-RateLimit-Remaining', String(qrLimit.remaining));
          if (!qrLimit.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', String(qrLimit.retryAfterSec));
            res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `QR code verification rate limit exceeded. Please retry after ${qrLimit.retryAfterSec} seconds.`,
                retryAfter: qrLimit.retryAfterSec,
              })
            );
            return;
          }
        }

        // Layer 2b: Strict Rate Limiting on Table 2FA Verification (10 requests/min remote, 60/min local)
        if (pathname === '/api/dine-in/verify-2fa') {
          const maxAttempts = (clientIp === '127.0.0.1' || clientIp === '::1') ? 60 : 10;
          const twoFaLimit = checkRateLimit(twoFaRateLimits, `2fa:${clientIp}`, maxAttempts, 60000);
          res.setHeader('X-RateLimit-Limit', String(maxAttempts));
          res.setHeader('X-RateLimit-Remaining', String(twoFaLimit.remaining));
          if (!twoFaLimit.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', String(twoFaLimit.retryAfterSec));
            res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Table verification rate limit exceeded. Please retry after ${twoFaLimit.retryAfterSec} seconds.`,
                retryAfter: twoFaLimit.retryAfterSec,
              })
            );
            return;
          }
        }

        // Layer 3: Moderate Rate Limiting on General Dine-In API (240 requests / min per IP)
        if (pathname.startsWith('/api/dine-in/')) {
          const apiLimit = checkRateLimit(apiRateLimits, `api:${clientIp}`, 240, 60000);
          res.setHeader('X-RateLimit-Limit', '240');
          res.setHeader('X-RateLimit-Remaining', String(apiLimit.remaining));
          if (!apiLimit.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', String(apiLimit.retryAfterSec));
            res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Request rate limit exceeded. Please retry after ${apiLimit.retryAfterSec} seconds.`,
                retryAfter: apiLimit.retryAfterSec,
              })
            );
            return;
          }
        }

        // Layer 4: Strict Rate Limiting on Admin QR Operations (30 requests / min per IP)
        if (pathname.startsWith('/api/admin/qr/')) {
          const adminLimit = checkRateLimit(adminRateLimits, `admin:${clientIp}`, 30, 60000);
          res.setHeader('X-RateLimit-Limit', '30');
          res.setHeader('X-RateLimit-Remaining', String(adminLimit.remaining));
          if (!adminLimit.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', String(adminLimit.retryAfterSec));
            res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Administrative action rate limit exceeded. Please retry after ${adminLimit.retryAfterSec} seconds.`,
                retryAfter: adminLimit.retryAfterSec,
              })
            );
            return;
          }
        }

        // ----------------------------------------------------------------------
        // Static Image Proxy: Fallback to Shared Backend for uploaded images
        // ----------------------------------------------------------------------
        if (pathname.startsWith('/images/products/') && req.method === 'GET') {
          const localPath = path.resolve(process.cwd(), 'public', pathname.replace(/^\//, ''));
          if (!fs.existsSync(localPath)) {
            try {
              const remoteRes = await fetch(`${SHARED_BACKEND_ORIGIN}${pathname}`);
              if (remoteRes.ok) {
                const buffer = Buffer.from(await remoteRes.arrayBuffer());
                const contentType = remoteRes.headers.get('content-type') || 'image/jpeg';
                res.writeHead(200, {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600',
                });
                res.end(buffer);
                return;
              }
            } catch {}
          }
        }

        // ======================================================================
        // A. QR TABLE VERIFICATION & ACCESS CONTROL
        // ======================================================================

        // ----------------------------------------------------------------------
        // POST /api/dine-in/verify-qr
        // Validates physical table QR code and initiates or completes dual-factor
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/verify-qr') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const rawTable = body.table || parsedUrl.searchParams.get('table') || parsedUrl.searchParams.get('t');
          const rawCred = body.cred || parsedUrl.searchParams.get('cred') || body.credential;
          const rawSymbol = body.symbol;
          const rawCode = body.code;
          const rawChallengeToken = body.challengeToken;

          if (!rawCred && !rawChallengeToken) {
            return sendJson(400, {
              valid: false,
              error: 'MISSING_CREDENTIAL',
              message: 'No QR credential detected. Please scan the QR code located on your table.',
            });
          }

          const result = verifyDualFactor({
            table: rawTable,
            cred: rawCred,
            challengeToken: rawChallengeToken,
            symbol: rawSymbol,
            code: rawCode,
          });

          if (result.requires2fa) {
            return sendJson(200, {
              valid: false,
              requires2fa: true,
              tableNumber: result.tableNumber,
              shortCode: result.shortCode,
              challengeToken: result.challengeToken,
              message: result.message || 'Physical table symbol or code verification required.',
            });
          }

          if (!result.valid) {
            const statusCode = result.error === 'REVOKED_CREDENTIAL' ? 403 : 400;
            return sendJson(statusCode, {
              valid: false,
              error: result.error || 'VERIFICATION_FAILED',
              message: result.message || 'QR credential verification failed.',
            });
          }

          return sendJson(200, {
            valid: true,
            tableNumber: result.tableNumber,
            shortCode: result.shortCode,
            credentialId: result.credentialId,
            qrProofToken: result.qrProofToken,
            message: `Table ${result.tableNumber} dual-factor verified. Please authenticate to begin dining.`,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/verify-2fa
        // Validates physical table presence symbol/code against challenge token
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/verify-2fa') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const challengeToken = body.challengeToken;
          const symbol = body.symbol;
          const code = body.code;
          const cred = body.cred;
          const table = body.table;

          if (!challengeToken && !cred) {
            return sendJson(400, {
              valid: false,
              error: 'MISSING_CHALLENGE',
              message: 'Challenge token or QR credential is required for dual-factor verification.',
            });
          }

          if (!symbol || !code) {
            return sendJson(400, {
              valid: false,
              error: 'MISSING_SECOND_FACTOR',
              message: 'Both the physical table symbol and 4-character secret code are required to verify table presence.',
            });
          }

          const result = verifyDualFactor({
            table,
            cred,
            challengeToken,
            symbol,
            code,
          });

          if (!result.valid) {
            const statusCode = result.error === 'REVOKED_CREDENTIAL' ? 403 : 400;
            return sendJson(statusCode, {
              valid: false,
              error: result.error || 'VERIFICATION_FAILED',
              message: result.message || 'Table verification failed.',
            });
          }

          return sendJson(200, {
            valid: true,
            tableNumber: result.tableNumber,
            shortCode: result.shortCode,
            credentialId: result.credentialId,
            qrProofToken: result.qrProofToken,
            message: `Table ${result.tableNumber} verified successfully.`,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/verify-proof
        // Validates an active QR Proof Token without consuming it (for page refresh/navigation)
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/verify-proof') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const qrProofToken = body?.qrProofToken;
          if (!qrProofToken || typeof qrProofToken !== 'string') {
            return sendJson(400, {
              valid: false,
              error: 'MISSING_QR_PROOF',
              message: 'No QR proof token provided.',
            });
          }

          const qrProof = verifyQrProofToken(qrProofToken, { consume: false });
          if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
            return sendJson(403, {
              valid: false,
              error: qrProof.error || 'INVALID_QR_PROOF',
              message: (qrProof as any).message || 'Table QR proof is invalid, expired, or already used.',
            });
          }

          return sendJson(200, {
            valid: true,
            tableNumber: qrProof.tableNumber,
            credentialId: qrProof.credentialId,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/customer/lookup (also /api/dine-in/customer-lookup)
        // Password-free lookup by 10-digit Indian mobile with unconsumed QR proof check
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/customer/lookup' || pathname === '/api/dine-in/customer-lookup') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          // 1. Sliding Window Rate Limiting (20 req/min per IP)
          const limitCheck = checkRateLimit(authRateLimits, clientIp, 20, 60000);
          if (!limitCheck.allowed) {
            return sendJson(429, {
              success: false,
              error: 'TOO_MANY_REQUESTS',
              message: `Too many lookup attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
            });
          }

          // 2. Validate Physical Table QR Proof Token (do NOT consume here, so it remains valid for session generation)
          const qrProofToken = body?.qrProofToken;
          if (!qrProofToken) {
            return sendJson(403, {
              success: false,
              error: 'MISSING_QR_PROOF',
              message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
            });
          }

          const qrProof = verifyQrProofToken(qrProofToken, { consume: false });
          if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
            return sendJson(403, {
              success: false,
              error: qrProof.error || 'INVALID_QR_PROOF',
              message: (qrProof as any).message || 'Table QR verification is expired or invalid. Please re-scan your table QR.',
            });
          }

          // 3. Normalize & Validate 10-digit Indian Mobile Number
          let rawMobile = String(body?.mobile || body?.mobile_number || body?.phone || '').replace(/\D/g, '');
          if (rawMobile.length === 12 && rawMobile.startsWith('91')) {
            rawMobile = rawMobile.slice(2);
          } else if (rawMobile.length === 11 && rawMobile.startsWith('0')) {
            rawMobile = rawMobile.slice(1);
          }

          if (!/^[6-9]\d{9}$/.test(rawMobile)) {
            return sendJson(422, {
              success: false,
              error: 'INVALID_MOBILE',
              message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
            });
          }

          // 4. Check Customer Identity in Google Sheets (authoritative source of truth)
          const isProd = process.env.NODE_ENV === 'production';
          const forceEmulator = isProd
            ? false
            : (_testEmulatorForced ||
               process.env.TEST_EMULATOR_MODE === 'true' ||
               req.headers['x-dev-sheets-emulator'] === 'true');

          const lookupResult = await relayCustomerLookup(rawMobile, {
            forceEmulator,
            customWebhookUrl: isProd ? undefined : (req.headers['x-dev-sheets-webhook-url'] as string),
            customApiKey: isProd ? undefined : (req.headers['x-dev-sheets-api-key'] as string),
          });

          if (!lookupResult.success) {
            return sendJson(lookupResult.httpStatus || 500, {
              success: false,
              error: lookupResult.error || 'LOOKUP_FAILED',
              message: lookupResult.message || 'Unable to complete customer lookup.',
            });
          }

          if (lookupResult.exists && lookupResult.customer) {
            return sendJson(200, {
              success: true,
              exists: true,
              customer: lookupResult.customer,
              message: `Welcome back, ${lookupResult.customer.name}!`,
            });
          }

          return sendJson(200, {
            success: true,
            exists: false,
            mobile: rawMobile,
            message: "Welcome! Let's get you started.",
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/customer/continue (also /api/dine-in/customer-continue)
        // Password-free session continuation for existing registered customer
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/customer/continue' || pathname === '/api/dine-in/customer-continue') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          // 1. Sliding Window Rate Limiting (20 req/min per IP)
          const limitCheck = checkRateLimit(authRateLimits, clientIp, 20, 60000);
          if (!limitCheck.allowed) {
            return sendJson(429, {
              success: false,
              error: 'TOO_MANY_REQUESTS',
              message: `Too many attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
            });
          }

          // 2. Validate Physical Table QR Proof Token
          const qrProofToken = body?.qrProofToken;
          if (!qrProofToken) {
            return sendJson(403, {
              success: false,
              error: 'MISSING_QR_PROOF',
              message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
            });
          }

          // 3. Normalize & Validate 10-digit Indian Mobile Number
          let rawMobile = String(body?.mobile || body?.mobile_number || body?.phone || '').replace(/\D/g, '');
          if (rawMobile.length === 12 && rawMobile.startsWith('91')) {
            rawMobile = rawMobile.slice(2);
          } else if (rawMobile.length === 11 && rawMobile.startsWith('0')) {
            rawMobile = rawMobile.slice(1);
          }

          if (!/^[6-9]\d{9}$/.test(rawMobile)) {
            return sendJson(422, {
              success: false,
              error: 'INVALID_MOBILE',
              message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
            });
          }

          // 4. Verify Existing Customer Identity in Google Sheets
          const isProd = process.env.NODE_ENV === 'production';
          const forceEmulator = isProd
            ? false
            : (_testEmulatorForced ||
               process.env.TEST_EMULATOR_MODE === 'true' ||
               req.headers['x-dev-sheets-emulator'] === 'true');

          const continueResult = await relayCustomerContinue(rawMobile, {
            forceEmulator,
            customWebhookUrl: isProd ? undefined : (req.headers['x-dev-sheets-webhook-url'] as string),
            customApiKey: isProd ? undefined : (req.headers['x-dev-sheets-api-key'] as string),
          });

          if (!continueResult.success || !continueResult.customer) {
            return sendJson(continueResult.httpStatus || 404, {
              success: false,
              error: continueResult.error || 'CUSTOMER_NOT_FOUND',
              message: continueResult.message || 'No registered customer found for this mobile number. Please register as a new diner.',
            });
          }

          const existingCustomer = continueResult.customer;

          // 5. Consume QR proof token and issue strict 15-minute Dining Session
          const sessionResult = await getStorageProvider().createSession(
            qrProofToken,
            {
              id: existingCustomer.customerId,
              phone: existingCustomer.mobile,
              name: existingCustomer.name,
              role: 'customer',
            },
            {
              ip: clientIp,
              userAgent: req.headers['user-agent'] as string,
            }
          );

          if (!sessionResult.success || !sessionResult.session) {
            const statusCode =
              sessionResult.error === 'PROOF_ALREADY_USED' ||
              sessionResult.error === 'EXPIRED_PROOF' ||
              sessionResult.error === 'INVALID_QR_PROOF'
                ? 403
                : 500;
            return sendJson(statusCode, {
              success: false,
              error: sessionResult.error || 'SESSION_CREATION_FAILED',
              message: sessionResult.message || 'Failed to initialize dining session.',
            });
          }

          const maxAgeSec = Math.ceil(FIXED_SESSION_DURATION_MS / 1000);
          res.setHeader('Set-Cookie', [buildDiningSessionCookie(sessionResult.session.sessionId, maxAgeSec)]);

          return sendJson(200, {
            success: true,
            status: 'EXISTING_CUSTOMER',
            customer: {
              customerId: existingCustomer.customerId,
              name: existingCustomer.name,
              mobile: existingCustomer.mobile,
              role: 'customer',
            },
            sessionToken: sessionResult.session.sessionId,
            session: {
              sessionId: sessionResult.session.sessionId,
              tableNumber: sessionResult.session.tableNumber,
              credentialId: sessionResult.session.credentialId,
              createdAt: sessionResult.session.createdAt,
              expiresAt: sessionResult.session.expiresAt,
              timeRemainingMs: Math.max(0, sessionResult.session.expiresAt - getSystemTime()),
              durationMs: FIXED_SESSION_DURATION_MS,
              serverTime: getSystemTime(),
            },
            message: `Welcome back, ${existingCustomer.name}! You can continue to the menu.`,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/customer-record
        // Google Sheets Integration Gateway (Registration & Returning Lookup)
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/customer-record') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          // 1. Sliding Window Rate Limiting (20 req/min per IP)
          const limitCheck = checkRateLimit(authRateLimits, clientIp, 20, 60000);
          if (!limitCheck.allowed) {
            return sendJson(429, {
              success: false,
              error: 'TOO_MANY_REQUESTS',
              message: `Too many registration attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
            });
          }

          // 2. Validate Physical Table QR Proof Token
          const qrProofToken = body.qrProofToken;
          if (!qrProofToken) {
            return sendJson(403, {
              success: false,
              error: 'MISSING_QR_PROOF',
              message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
            });
          }

          const qrProof = verifyQrProofToken(qrProofToken);
          if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
            return sendJson(403, {
              success: false,
              error: qrProof.error || 'INVALID_QR_PROOF',
              message: (qrProof as any).message || 'Table QR verification is expired or invalid. Please re-scan your table QR.',
            });
          }

          // 3. Input Extraction & Validation
          const rawName = String(body.name || '').trim();
          let rawMobile = String(body.mobile || body.mobile_number || '').replace(/\D/g, '');
          if (rawMobile.length === 12 && rawMobile.startsWith('91')) {
            rawMobile = rawMobile.slice(2);
          } else if (rawMobile.length === 11 && rawMobile.startsWith('0')) {
            rawMobile = rawMobile.slice(1);
          }

          const rows = loadLocalCustomers();
          const existing = rows.find((r) => r.mobile_number === rawMobile);

          // For new customers, name is strictly required (1 to 60 characters)
          if (!existing && (!rawName || rawName.length < 1 || rawName.length > 60)) {
            return sendJson(422, {
              success: false,
              error: 'INVALID_NAME',
              message: 'Customer name must be between 1 and 60 characters.',
            });
          }

          if (!/^[6-9]\d{9}$/.test(rawMobile)) {
            return sendJson(422, {
              success: false,
              error: 'INVALID_MOBILE',
              message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
            });
          }

          const confirmedExistingName = Boolean(body.confirmedExistingName || body.continueExisting || !rawName);

          let integrationResult: {
            success: boolean;
            status: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER' | 'EXISTING_CUSTOMER_NAME_MISMATCH';
            customer: {
              customerId: string;
              name: string;
              submittedName?: string;
              mobile: string;
            };
            message: string;
          };

          // 4. Relay to live Google Apps Script Web App if configured in environment
          const isProd = process.env.NODE_ENV === 'production';

          // Security Rule Fix 2: Reject developer header overrides in production
          if (isProd) {
            if (
              req.headers['x-dev-sheets-emulator'] !== undefined ||
              req.headers['x-dev-sheets-webhook-url'] !== undefined ||
              req.headers['x-dev-sheets-api-key'] !== undefined
            ) {
              return sendJson(403, {
                success: false,
                error: 'DEV_HEADERS_DISABLED_IN_PROD',
                message: 'Developer header overrides are disabled in production.',
              });
            }
          }

          const forceEmulator = isProd
            ? false
            : (_testEmulatorForced ||
               process.env.TEST_EMULATOR_MODE === 'true' ||
               req.headers['x-dev-sheets-emulator'] === 'true');

          const googleWebhookUrl = forceEmulator
            ? ''
            : (isProd
                ? getEnvConfig('GOOGLE_SHEETS_WEBHOOK_URL')
                : ((req.headers['x-dev-sheets-webhook-url'] as string) ||
                   getEnvConfig('GOOGLE_SHEETS_WEBHOOK_URL')));

          const apiKey = isProd
            ? (getEnvConfig('GOOGLE_SHEETS_API_KEY') || getEnvConfig('SHARED_API_KEY'))
            : ((req.headers['x-dev-sheets-api-key'] as string) ||
               getEnvConfig('GOOGLE_SHEETS_API_KEY') ||
               getEnvConfig('SHARED_API_KEY'));

          // Security Rule Fix 1: Fail closed in production if Google Sheets configuration is missing or invalid
          if (isProd) {
            const trimmedUrl = String(googleWebhookUrl || '').trim();
            const isUrlPlaceholder =
              trimmedUrl.includes('AKfycb...') ||
              trimmedUrl.includes('your_deployment_id') ||
              trimmedUrl.includes('...');
            let isValidUrl = false;
            try {
              const parsed = new URL(trimmedUrl);
              isValidUrl = parsed.protocol === 'https:';
            } catch {}

            if (!trimmedUrl || isUrlPlaceholder || !isValidUrl) {
              return sendJson(500, {
                success: false,
                error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
                message: 'Google Sheets customer integration webhook URL is not properly configured in production.',
              });
            }

            const trimmedKey = String(apiKey || '').trim();
            const isKeyPlaceholder =
              trimmedKey.includes('your_') ||
              trimmedKey.includes('...');
            if (!trimmedKey || isKeyPlaceholder || trimmedKey.length < 16) {
              return sendJson(500, {
                success: false,
                error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
                message: 'Google Sheets customer integration authentication secret is not properly configured in production.',
              });
            }
          }

          const isConfiguredGasUrl =
            Boolean(googleWebhookUrl) &&
            !googleWebhookUrl.includes('AKfycb...') &&
            !googleWebhookUrl.includes('your_deployment_id');

          if (isConfiguredGasUrl) {
            try {
              const timestamp = new Date().toISOString();
              const nonce = crypto.randomBytes(16).toString('hex');
              const canonicalString = [
                timestamp,
                nonce,
                rawName,
                rawMobile,
                confirmedExistingName ? 'true' : 'false',
              ].join(':');

              const signature = apiKey
                ? crypto.createHmac('sha256', apiKey).update(canonicalString).digest('hex').toLowerCase()
                : '';

              const gasResponse = await fetch(googleWebhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                body: JSON.stringify({
                  timestamp,
                  nonce,
                  name: rawName,
                  mobile: rawMobile,
                  confirmedExistingName,
                  signature,
                }),
                signal: AbortSignal.timeout(8000),
              });

              const gasData = (await gasResponse.json().catch(() => ({}))) as any;
              if (!gasResponse.ok || !gasData.success) {
                // Map Google Apps Script application-level error codes to proper HTTP statuses
                // (Note: GAS ContentService always returns HTTP 200, so we inspect gasData.error)
                let mappedStatus = 502;
                const errorCode = gasData.error || 'SHEETS_RELAY_ERROR';
                if (errorCode === 'INVALID_SIGNATURE' || errorCode === 'MISSING_SIGNATURE') {
                  mappedStatus = 401;
                } else if (
                  errorCode === 'REQUEST_EXPIRED' ||
                  errorCode === 'DUPLICATE_NONCE' ||
                  errorCode === 'INVALID_NONCE' ||
                  errorCode === 'MISSING_TIMESTAMP' ||
                  errorCode === 'INVALID_TIMESTAMP'
                ) {
                  mappedStatus = 403;
                } else if (errorCode === 'INVALID_NAME' || errorCode === 'INVALID_MOBILE') {
                  mappedStatus = 422;
                } else if (errorCode === 'EMPTY_REQUEST' || errorCode === 'INVALID_JSON') {
                  mappedStatus = 400;
                } else if (errorCode === 'LOCK_TIMEOUT') {
                  mappedStatus = 503;
                } else if (
                  errorCode === 'SERVER_MISCONFIGURED' ||
                  errorCode === 'WORKSHEET_MISSING' ||
                  errorCode === 'INVALID_HEADERS' ||
                  errorCode === 'SPREADSHEET_NOT_FOUND' ||
                  errorCode === 'SERVER_ERROR'
                ) {
                  mappedStatus = 500;
                } else if (gasResponse.status >= 400) {
                  mappedStatus = gasResponse.status;
                }

                return sendJson(mappedStatus, {
                  success: false,
                  error: errorCode,
                  message: gasData.message || 'Unable to complete customer record registration via Google Sheets.',
                });
              }

              integrationResult = gasData;
              if (gasData.customer) {
                cacheCustomerRecord({
                  customerId: gasData.customer.customerId,
                  name: gasData.customer.name,
                  mobile: gasData.customer.mobile,
                  createdAt: gasData.customer.createdAt,
                  updatedAt: gasData.customer.updatedAt,
                });
              }
            } catch (err: any) {
              console.warn('[DineInServer] Google Sheets relay error:', err?.message);
              return sendJson(504, {
                success: false,
                error: 'GOOGLE_SHEETS_TIMEOUT',
                message: 'Unable to reach Google Sheets customer service. Please try again.',
              });
            }
          } else {
            // Local Sheet Database Emulator (Mirrors exact Google Apps Script schema & logic)
            if (isProd) {
              return sendJson(500, {
                success: false,
                error: 'EMULATOR_DISABLED_IN_PROD',
                message: 'Local customer database emulator is disabled in production.',
              });
            }

            const rows = loadLocalCustomers();
            const existing = rows.find((r) => r.mobile_number === rawMobile);
            const nowIso = new Date(getSystemTime()).toISOString();

            if (existing) {
              const isSameName = existing.name.trim().toLowerCase() === rawName.toLowerCase();
              if (!isSameName && !confirmedExistingName) {
                // Name mismatch without explicit user confirmation: do NOT silently overwrite
                return sendJson(200, {
                  success: true,
                  status: 'EXISTING_CUSTOMER_NAME_MISMATCH',
                  customer: {
                    customerId: existing.customer_id,
                    name: existing.name,
                    submittedName: rawName,
                    mobile: existing.mobile_number,
                  },
                  message: 'Existing customer record found with a different name. Existing name preserved.',
                });
              }

              // Update timestamp of approved record access
              existing.updated_at = nowIso;
              saveLocalCustomers(rows);

              integrationResult = {
                success: true,
                status: 'EXISTING_CUSTOMER',
                customer: {
                  customerId: existing.customer_id,
                  name: existing.name,
                  mobile: existing.mobile_number,
                },
                message: 'Welcome back! Customer record verified.',
              };
            } else {
              // New Customer Registration (Sequential Numeric Allocation)
              const newCustomerId = getNextSequentialCustomerId(rows);
              const newRow: CustomerSheetRow = {
                customer_id: newCustomerId,
                name: sanitizeFormula(rawName),
                mobile_number: rawMobile,
                created_at: nowIso,
                updated_at: nowIso,
              };
              rows.push(newRow);
              saveLocalCustomers(rows);
              commitSequentialCustomerId(newCustomerId);

              integrationResult = {
                success: true,
                status: 'NEW_CUSTOMER',
                customer: {
                  customerId: newCustomerId,
                  name: rawName,
                  mobile: rawMobile,
                },
                message: 'Customer record registered successfully.',
              };
            }
          }

          // If the customer record resulted in a name mismatch requiring resolution, return it now
          if (integrationResult.status === 'EXISTING_CUSTOMER_NAME_MISMATCH') {
            return sendJson(200, integrationResult);
          }

          // 5. On approved validation, issue strict 15-minute Dining Session
          const sessionResult = await getStorageProvider().createSession(
            qrProofToken,
            {
              id: integrationResult.customer.customerId,
              phone: integrationResult.customer.mobile,
              name: integrationResult.customer.name,
              role: 'customer',
            },
            {
              ip: clientIp,
              userAgent: req.headers['user-agent'] as string,
            }
          );

          if (!sessionResult.success || !sessionResult.session) {
            const statusCode =
              sessionResult.error === 'PROOF_ALREADY_USED' ||
              sessionResult.error === 'EXPIRED_PROOF' ||
              sessionResult.error === 'INVALID_QR_PROOF'
                ? 403
                : 500;
            return sendJson(statusCode, {
              success: false,
              error: sessionResult.error || 'SESSION_CREATION_FAILED',
              message: sessionResult.message || 'Failed to initialize dining session.',
            });
          }

          const maxAgeSec = Math.ceil(FIXED_SESSION_DURATION_MS / 1000);
          res.setHeader('Set-Cookie', [buildDiningSessionCookie(sessionResult.session.sessionId, maxAgeSec)]);

          return sendJson(integrationResult.status === 'NEW_CUSTOMER' ? 201 : 200, {
            success: true,
            status: integrationResult.status,
            customer: {
              ...integrationResult.customer,
              role: 'customer',
            },
            sessionToken: sessionResult.session.sessionId,
            session: {
              sessionId: sessionResult.session.sessionId,
              tableNumber: sessionResult.session.tableNumber,
              credentialId: sessionResult.session.credentialId,
              createdAt: sessionResult.session.createdAt,
              expiresAt: sessionResult.session.expiresAt,
              timeRemainingMs: Math.max(0, sessionResult.session.expiresAt - getSystemTime()),
              durationMs: FIXED_SESSION_DURATION_MS,
              serverTime: getSystemTime(),
            },
            message: integrationResult.message,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/create-session
        // Server issues strict 15-minute Dining session bound to Table + Customer
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/create-session') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const qrProofToken = body.qrProofToken;
          if (!qrProofToken) {
            return sendJson(400, {
              success: false,
              error: 'MISSING_QR_PROOF',
              message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
            });
          }

          // Verify customer authentication
          const customerToken = extractBearerToken();
          const verification = verifySessionToken(customerToken);

          if (!verification.valid || !verification.user) {
            return sendJson(401, {
              success: false,
              error: 'CUSTOMER_AUTH_REQUIRED',
              message: 'Customer authentication required. Please sign in with your 10-digit mobile number and password.',
            });
          }

          // Create server-issued dining session
          const sessionResult = await getStorageProvider().createSession(
            qrProofToken,
            verification.user,
            { ip: clientIp, userAgent: req.headers['user-agent'] as string }
          );

          if (!sessionResult.success || !sessionResult.session) {
            return sendJson(403, {
              success: false,
              error: sessionResult.error,
              message: sessionResult.message || 'Failed to initiate table dining session.',
            });
          }

          // Set secure session cookie
          const session = sessionResult.session;
          const maxAgeSec = Math.floor(FIXED_SESSION_DURATION_MS / 1000);
          res.setHeader('Set-Cookie', [buildDiningSessionCookie(session.sessionId, maxAgeSec)]);

          return sendJson(200, {
            success: true,
            sessionToken: session.sessionId,
            session: {
              sessionId: session.sessionId,
              tableNumber: session.tableNumber,
              credentialId: session.credentialId,
              createdAt: session.createdAt,
              expiresAt: session.expiresAt,
              timeRemainingMs: Math.max(0, session.expiresAt - getSystemTime()),
              durationMs: FIXED_SESSION_DURATION_MS,
              serverTime: getSystemTime(),
              customer: {
                id: session.customerId,
                name: session.customerName,
                phone: session.customerPhone,
                role: session.role,
              },
            },
          });
        }

        // ----------------------------------------------------------------------
        // GET /api/dine-in/session-status
        // Validates active Dining session and returns exact remaining time
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/session-status' && req.method === 'GET') {
          const sessionToken = extractDiningSessionToken();
          const sessionCheck = await getStorageProvider().validateSession(sessionToken);

          if (!sessionCheck.valid || !sessionCheck.session) {
            const statusCode = (sessionCheck.error === 'CREDENTIAL_REVOKED' || sessionCheck.error === 'SESSION_REVOKED') ? 403 : 401;
            return sendJson(statusCode, {
              valid: false,
              tableNumber: sessionCheck.session?.tableNumber,
              error: sessionCheck.error,
              message: sessionCheck.message,
            });
          }

          const now = getSystemTime();
          return sendJson(200, {
            valid: true,
            tableNumber: sessionCheck.session.tableNumber,
            expiresAt: sessionCheck.session.expiresAt,
            timeRemainingMs: sessionCheck.timeRemainingMs,
            durationMs: FIXED_SESSION_DURATION_MS,
            serverTime: now,
            customer: {
              id: sessionCheck.session.customerId,
              name: sessionCheck.session.customerName,
              phone: sessionCheck.session.customerPhone,
            },
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/logout-session
        // Server-side revocation of current dining session
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/logout-session' && req.method === 'POST') {
          const sessionToken = extractDiningSessionToken();
          if (sessionToken) {
            await getStorageProvider().revokeSession(sessionToken);
          }
          res.setHeader('Set-Cookie', [buildClearDiningSessionCookie()]);
          return sendJson(200, { success: true, message: 'Dining session terminated.' });
        }

        // ======================================================================
        // B. ADMINISTRATIVE QR CREDENTIAL MANAGEMENT
        // ======================================================================

        // Helper: Check Admin Authorization (via Bearer token with admin role OR operational PIN)
        const checkAdminAuthorization = (): boolean => {
          const token = extractBearerToken();
          if (token) {
            const verification = verifySessionToken(token);
            if (verification.valid && verification.user?.role === 'admin') {
              return true;
            }
          }

          const pinHeader = req.headers['x-operational-pin'] || req.headers['x-admin-pin'];
          if (pinHeader && typeof pinHeader === 'string' && pinHeader.trim() === ADMIN_OPERATIONAL_PIN) {
            return true;
          }

          if (body?.adminPin && String(body.adminPin).trim() === ADMIN_OPERATIONAL_PIN) {
            return true;
          }

          const queryPin = parsedUrl.searchParams.get('pin');
          if (queryPin && queryPin.trim() === ADMIN_OPERATIONAL_PIN) {
            return true;
          }

          return false;
        };

        if (pathname.startsWith('/api/admin/qr/')) {
          if (!checkAdminAuthorization()) {
            return sendJson(403, {
              error: 'ADMIN_ACCESS_DENIED',
              message: 'Administrator authorization required to manage dining table QR credentials.',
            });
          }

          // 1. GET /api/admin/qr/tables
          if (pathname === '/api/admin/qr/tables' && req.method === 'GET') {
            const overview = getAdminTablesOverview();
            return sendJson(200, {
              success: true,
              tables: overview,
              serverTime: new Date(getSystemTime()).toISOString(),
            });
          }

          // 2. POST /api/admin/qr/rotate
          if (pathname === '/api/admin/qr/rotate' && req.method === 'POST') {
            const tableNumber = body.tableNumber;
            if (!tableNumber) {
              return sendJson(400, { error: 'tableNumber is required' });
            }

            try {
              const { record, rawSecret } = generateTableCredential(tableNumber, 'Administrator');
              const domain = process.env.DINING_PRODUCTION_URL || 'https://dine.littlemonkeycafe.com';
              const entryUrl = `${domain}/?t=${record.tableShortCode}&cred=${record.credentialId}.${rawSecret}`;

              return sendJson(200, {
                success: true,
                tableNumber: record.tableNumber,
                credentialId: record.credentialId,
                rawSecret,
                entryUrl,
                rotationCount: record.rotationCount,
                message: `Table ${record.tableNumber} QR credential rotated successfully. Old credentials revoked.`,
              });
            } catch (err: any) {
              return sendJson(400, { error: err?.message || 'Failed to rotate credential' });
            }
          }

          // 3. POST /api/admin/qr/revoke
          if (pathname === '/api/admin/qr/revoke' && req.method === 'POST') {
            const tableNumber = body.tableNumber;
            if (!tableNumber) {
              return sendJson(400, { error: 'tableNumber is required' });
            }

            const revoked = revokeTableCredential(tableNumber, 'Administrator');
            return sendJson(200, {
              success: revoked,
              tableNumber,
              message: revoked
                ? `Table ${tableNumber} QR credential revoked. All active sessions terminated.`
                : `No active credential found for ${tableNumber}.`,
            });
          }

          // 4. GET /api/admin/qr/export-pdf
          if (pathname === '/api/admin/qr/export-pdf' && req.method === 'GET') {
            const mode = parsedUrl.searchParams.get('mode') || 'staging';
            const isProduction = mode === 'production';
            const diningBaseUrl = isProduction
              ? (process.env.DINING_PRODUCTION_URL || 'https://dine.littlemonkeycafe.com')
              : (process.env.DINING_STAGING_URL || 'http://127.0.0.1:3000');

            const pdfBuffer = generateSixTablesPdf({
              diningBaseUrl,
              isProduction,
            });

            res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="little-monkey-tables-qr-${mode}.pdf"`,
              'Content-Length': String(pdfBuffer.length),
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            });
            res.end(pdfBuffer);
            return;
          }

          // 5. GET /api/admin/qr/artwork
          if (pathname === '/api/admin/qr/artwork' && req.method === 'GET') {
            const tableParam = parsedUrl.searchParams.get('table');
            const formatParam = (parsedUrl.searchParams.get('format') || 'png').toLowerCase();
            const fileParam = parsedUrl.searchParams.get('file');

            const storageDir = path.resolve(process.cwd(), 'storage/qr-codes');

            if (fileParam === 'html' || formatParam === 'html') {
              const htmlPath = path.join(storageDir, 'index.html');
              if (!fs.existsSync(htmlPath)) {
                return sendJson(404, {
                  error: 'ARTWORK_NOT_FOUND',
                  message: 'The table QR design studio preview has not been generated yet.',
                });
              }
              const htmlContent = fs.readFileSync(htmlPath, 'utf8');
              res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
              });
              res.end(htmlContent);
              return;
            }

            if (fileParam === 'manifest' || fileParam === 'json' || formatParam === 'json') {
              const jsonPath = path.join(storageDir, 'index.json');
              if (!fs.existsSync(jsonPath)) {
                return sendJson(404, {
                  error: 'ARTWORK_NOT_FOUND',
                  message: 'The table QR manifest has not been generated yet.',
                });
              }
              const jsonContent = fs.readFileSync(jsonPath, 'utf8');
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, no-store, no-cache',
              });
              res.end(jsonContent);
              return;
            }

            if (fileParam === 'pdf' || formatParam === 'pdf' || tableParam === 'all') {
              const pdfPath = path.join(storageDir, 'little-monkey-table-qrs.pdf');
              if (!fs.existsSync(pdfPath)) {
                return sendJson(404, {
                  error: 'ARTWORK_NOT_FOUND',
                  message: 'The requested PDF artwork file has not been generated yet.',
                });
              }
              const pdfBuffer = fs.readFileSync(pdfPath);
              res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="little-monkey-table-qrs.pdf"',
                'Content-Length': String(pdfBuffer.length),
                'Cache-Control': 'private, no-store, no-cache',
              });
              res.end(pdfBuffer);
              return;
            }

            if (!tableParam) {
              return sendJson(400, {
                error: 'MISSING_TABLE_PARAMETER',
                message: 'table parameter is required (e.g., Table 01, T01, or file=pdf).',
              });
            }

            const { valid, normalized } = isValidDiningTable(tableParam);
            if (!valid || !normalized) {
              return sendJson(400, {
                error: 'INVALID_TABLE',
                message: `Unknown or invalid dining table "${tableParam}".`,
              });
            }

            if (formatParam !== 'png' && formatParam !== 'svg') {
              return sendJson(400, {
                error: 'INVALID_FORMAT',
                message: 'Format must be either "png" or "svg".',
              });
            }

            const shortCodeMatch = /0*([1-9]|10)$/.exec(normalized);
            const num = shortCodeMatch ? parseInt(shortCodeMatch[1], 10) : 1;
            const shortSlug = `t${String(num).padStart(2, '0')}`;
            const fileName = `table-${shortSlug}.${formatParam}`;
            const filePath = path.join(storageDir, fileName);

            if (!fs.existsSync(filePath)) {
              return sendJson(404, {
                error: 'ARTWORK_NOT_FOUND',
                message: `Artwork file ${fileName} has not been generated yet.`,
              });
            }

            const fileBuffer = fs.readFileSync(filePath);
            const contentType = formatParam === 'svg' ? 'image/svg+xml' : 'image/png';
            const isInline = parsedUrl.searchParams.get('inline') === '1' || parsedUrl.searchParams.get('inline') === 'true';

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Disposition': isInline ? `inline; filename="${fileName}"` : `attachment; filename="${fileName}"`,
              'Content-Length': String(fileBuffer.length),
              'Cache-Control': isInline ? 'public, max-age=60' : 'private, no-store, no-cache',
            });
            res.end(fileBuffer);
            return;
          }
        }

        // ======================================================================
        // C. DETERMINISTIC TEST CLOCK (Development & Automated QA Only)
        // ======================================================================
        if (pathname === '/api/test/advance-time' && req.method === 'POST') {
          if (process.env.NODE_ENV === 'production') {
            return sendJson(403, { error: 'TEST_HELPERS_DISABLED_IN_PROD' });
          }
          const ms = Number(body.ms || 0);
          advanceSystemTime(ms);
          return sendJson(200, {
            success: true,
            advancedMs: ms,
            newServerTime: new Date(getSystemTime()).toISOString(),
            timestampMs: getSystemTime(),
          });
        }

        // ----------------------------------------------------------------------
        // GET /api/dev/tables (Development & QA Testing Only)
        // ----------------------------------------------------------------------
        if (pathname === '/api/dev/tables' && req.method === 'GET') {
          if (process.env.NODE_ENV === 'production') {
            return sendJson(403, {
              error: 'DEV_ENDPOINT_DISABLED_IN_PROD',
              message: 'Developer table endpoint is strictly disabled in production.',
            });
          }

          const isStaffAuthorized = checkAdminAuthorization();
          const overview = getAdminTablesOverview();

          const host = req.headers.host || '127.0.0.1:3000';
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const devBase = `${protocol}://${host}`;

          const sanitizedTables = overview.map((t) => {
            // Never expose standalone rawSecret in HTTP responses
            let entryUrl: string | null = null;
            if (isStaffAuthorized && t.credentialId) {
              const rawSecret = getActiveRawSecretForTable(t.tableNumber);
              if (rawSecret) {
                entryUrl = `${devBase}/?t=${t.shortCode}&cred=${t.credentialId}.${rawSecret}`;
              }
            }

            return {
              tableNumber: t.tableNumber,
              shortCode: t.shortCode,
              zone: t.zone,
              capacity: t.capacity,
              credentialId: t.credentialId,
              isActive: t.isActive,
              entryUrl,
            };
          });

          return sendJson(200, {
            success: true,
            tables: sanitizedTables,
            isStaffAuthorized,
          });
        }

        if (pathname === '/api/test/reset-time' && req.method === 'POST') {
          if (process.env.NODE_ENV === 'production') {
            return sendJson(403, { error: 'TEST_HELPERS_DISABLED_IN_PROD' });
          }
          if (body?.emulator !== undefined) {
            _testEmulatorForced = Boolean(body.emulator);
          } else if (parsedUrl.searchParams.has('emulator')) {
            _testEmulatorForced = parsedUrl.searchParams.get('emulator') === 'true';
          } else {
            _testEmulatorForced = false;
          }
          resetSystemTime();
          initializeQrStore();
          authRateLimits.clear();
          apiRateLimits.clear();
          qrRateLimits.clear();
          adminRateLimits.clear();
          return sendJson(200, {
            success: true,
            emulatorForced: _testEmulatorForced,
            newServerTime: new Date(getSystemTime()).toISOString(),
            timestampMs: getSystemTime(),
          });
        }

        // ======================================================================
        // D. SHARED AUTHENTICATION PROXY & LEGACY ENDPOINTS
        // ======================================================================

        // ----------------------------------------------------------------------
        // POST /api/auth/validate-session
        // ----------------------------------------------------------------------
        if (pathname === '/api/auth/validate-session') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const token = extractBearerToken();
          const verification = verifySessionToken(token);

          if (!verification.valid) {
            return sendJson(401, {
              valid: false,
              error: verification.error,
              message: verification.message,
            });
          }

          return sendJson(200, {
            valid: true,
            user: verification.user,
            token,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/auth/guest-session (Decommissioned - Mandatory Customer Auth)
        // ----------------------------------------------------------------------
        if (pathname === '/api/auth/guest-session') {
          return sendJson(403, {
            error: 'GUEST_DISABLED',
            message: 'Guest preview mode has been decommissioned. Mandatory customer registration or sign-in is required.',
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/auth/customer-login & /api/auth/customer-register
        // Forward to Shared Authoritative Backend
        // ----------------------------------------------------------------------
        if (pathname === '/api/auth/customer-login' || pathname === '/api/auth/customer-register') {
          try {
            const remoteUrl = `${SHARED_BACKEND_ORIGIN}${pathname}`;
            const response = await fetch(remoteUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(3000),
            });

            const data = await response.json().catch(() => ({}));
            return sendJson(response.status, data);
          } catch (err: any) {
            console.warn('[DineInServer] Shared backend proxy error:', err?.message);
            // Fallback for resilient local development
            if (pathname === '/api/auth/customer-register') {
              const { phone, password, fullName } = body || {};
              const digits = String(phone || '').replace(/\D/g, '');
              if (digits.length !== 10) {
                return sendJson(400, { error: 'Enter your 10-digit mobile number.' });
              }
              if (!password || password.length < 4) {
                return sendJson(400, { error: 'Password must be at least 4 characters.' });
              }

              const payload = {
                sub: `dev_user_${digits}`,
                phone: `+91${digits}`,
                name: fullName || `Diner ${digits.slice(-4)}`,
                role: 'authenticated',
                iat: Math.floor(getSystemTime() / 1000),
                exp: Math.floor(getSystemTime() / 1000) + 86400,
              };
              const token = `dev_token.${Buffer.from(JSON.stringify(payload)).toString('base64')}.lmc`;

              return sendJson(200, {
                session: {
                  access_token: token,
                  user: {
                    id: payload.sub,
                    phone: payload.phone,
                    user_metadata: { full_name: payload.name },
                  },
                },
                user: {
                  id: payload.sub,
                  phone: payload.phone,
                  user_metadata: { full_name: payload.name },
                },
              });
            }

            if (pathname === '/api/auth/customer-login') {
              const { phone, password } = body || {};
              const digits = String(phone || '').replace(/\D/g, '');
              if (digits.length !== 10) {
                return sendJson(400, { error: 'Enter your 10-digit mobile number.' });
              }
              if (!password || password.length < 4) {
                return sendJson(400, { error: 'Password must be at least 4 characters.' });
              }

              const payload = {
                sub: `dev_user_${digits}`,
                phone: `+91${digits}`,
                name: `Diner ${digits.slice(-4)}`,
                role: 'authenticated',
                iat: Math.floor(getSystemTime() / 1000),
                exp: Math.floor(getSystemTime() / 1000) + 86400,
              };
              const token = `dev_token.${Buffer.from(JSON.stringify(payload)).toString('base64')}.lmc`;

              return sendJson(200, {
                session: {
                  access_token: token,
                  user: {
                    id: payload.sub,
                    phone: payload.phone,
                    user_metadata: { full_name: payload.name },
                  },
                },
                user: {
                  id: payload.sub,
                  phone: payload.phone,
                  user_metadata: { full_name: payload.name },
                },
              });
            }

            return sendJson(503, {
              error: 'AUTH_SERVICE_UNAVAILABLE',
              message: 'Authentication service is temporarily unavailable.',
            });
          }
        }

        // ----------------------------------------------------------------------
        // Strict Operational Enforcement
        // ----------------------------------------------------------------------
        if (pathname.startsWith('/api/operational/')) {
          const isSafePublicOperational = pathname === '/api/operational/store-status' && req.method === 'GET';
          if (!isSafePublicOperational) {
            const token = extractBearerToken();
            const verification = verifySessionToken(token);
            if (!token || !verification.valid || verification.user?.role !== 'admin') {
              return sendJson(403, {
                error: 'ACCESS_DENIED',
                message: 'Administrator authorization required.',
              });
            }
          }
        }

        // ----------------------------------------------------------------------
        // GET /api/dine-in/products
        // Authoritative live product catalog with live stock & discounts
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/products' && req.method === 'GET') {
          try {
            let discounts: Record<string, number> = {};
            let isStoreOpen = true;
            let isDineInOpen = true;
            let liveTables: any[] = [];

            try {
              const statusRes = await fetch(`${SHARED_BACKEND_ORIGIN}/api/operational/store-status`, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(2000),
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                discounts = statusData.discounts || {};
                isStoreOpen = statusData.isOpen !== false;
                isDineInOpen = statusData.dineInEnabled !== false;
                liveTables = Array.isArray(statusData.tables) ? statusData.tables : [];
              }
            } catch {}

            // In-memory cache for 5s to protect Supabase
            const now = getSystemTime();
            let liveAvailability: Record<string, boolean> = { ..._cachedAvailability };
            let liveImages: Record<string, string> = { ..._cachedImages };

            if (now - _lastAvailabilityFetch > 5000 || Object.keys(_cachedAvailability).length === 0) {
              try {
                const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=id,name,slug,is_available`, {
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    Accept: 'application/json',
                  },
                  signal: AbortSignal.timeout(3000),
                });
                if (itemsRes.ok) {
                  const itemsData: Array<{ slug: string; id: string; name?: string; is_available: boolean }> = await itemsRes.json();
                  const freshAvail: Record<string, boolean> = {};
                  for (const it of itemsData) {
                    const available = it.is_available !== false;
                    if (it.slug) freshAvail[it.slug] = available;
                    if (it.id) freshAvail[it.id] = available;
                    if (it.name) freshAvail[it.name.toLowerCase().trim()] = available;
                  }
                  _cachedAvailability = freshAvail;
                  _lastAvailabilityFetch = now;
                  liveAvailability = freshAvail;
                }
              } catch (err: any) {
                console.warn('[DineInServer] Error querying Supabase menu_items:', err?.message);
              }
            }

            return sendJson(200, {
              success: true,
              isStoreOpen,
              isDineInOpen,
              discounts,
              liveAvailability,
              liveImages,
              tables: liveTables,
            });
          } catch (err: any) {
            return sendJson(500, { error: 'Failed to fetch catalog status', message: err?.message });
          }
        }

        // ----------------------------------------------------------------------
        // GET /api/dine-in/table-status
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/table-status' && req.method === 'GET') {
          const rawTable = parsedUrl.searchParams.get('table');
          const status = await getLiveTableStatus(rawTable);
          if (!status.valid) {
            return sendJson(400, {
              valid: false,
              error: 'INVALID_TABLE',
              message: `Table "${rawTable || 'Unknown'}" is not a recognized dining table.`,
            });
          }
          if (!status.isActive) {
            return sendJson(403, {
              valid: true,
              normalized: status.normalized,
              isActive: false,
              error: 'REVOKED_TABLE',
              message: `This table's QR credential (${status.normalized}) has been revoked or deactivated by café administration. Please contact café staff.`,
            });
          }
          return sendJson(200, {
            valid: true,
            normalized: status.normalized,
            isActive: true,
            message: `Table ${status.normalized} is active.`,
          });
        }

        // ----------------------------------------------------------------------
        // Protected Dining APIs (/api/dine-in/order, /api/dine-in/session)
        // Requires active 15-minute Dining Session
        // ----------------------------------------------------------------------
        if (pathname.startsWith('/api/dine-in/')) {
          const sessionToken = extractDiningSessionToken();
          const sessionCheck = await getStorageProvider().validateSession(sessionToken);

          if (!sessionCheck.valid || !sessionCheck.session) {
            const statusCode = sessionCheck.error === 'CREDENTIAL_REVOKED' ? 403 : 401;
            return sendJson(statusCode, {
              error: 'UNAUTHORIZED_DINING_ACCESS',
              code: sessionCheck.error || 'INVALID_DINING_SESSION',
              message: sessionCheck.message || 'Access restricted: A valid, active table QR dining session is required.',
            });
          }

          if (pathname === '/api/dine-in/session') {
            return sendJson(200, {
              authenticated: true,
              session: sessionCheck.session,
              timeRemainingMs: sessionCheck.timeRemainingMs,
              timestamp: new Date(getSystemTime()).toISOString(),
            });
          }

          // Order submission (kept for backwards compatibility; dining is read-only)
          if (pathname === '/api/dine-in/order' && req.method === 'POST') {
            // Strictly enforce table match between session and order
            const requestedTable = normalizeTableLabel(body.tableNumber || body.table_number);
            if (requestedTable && requestedTable.toLowerCase() !== sessionCheck.session.tableNumber.toLowerCase()) {
              return sendJson(403, {
                error: 'TABLE_MISMATCH',
                message: `Session is authorized for ${sessionCheck.session.tableNumber}, but order was submitted for ${requestedTable}.`,
              });
            }

            return sendJson(403, {
              error: 'READ_ONLY_MENU',
              message: 'Dining experience is read-only. Orders are placed with café service staff.',
            });
          }

          return sendJson(200, {
            status: 'ok',
            session: sessionCheck.session,
          });
        }

        // ----------------------------------------------------------------------
        // Proxy all remaining /api/* routes to Shared Backend
        // ----------------------------------------------------------------------
        try {
          const remoteUrl = `${SHARED_BACKEND_ORIGIN}${pathname}${parsedUrl.search}`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (req.headers.authorization) {
            headers.Authorization = req.headers.authorization;
          }

          const fetchOptions: RequestInit = {
            method: req.method,
            headers,
          };
          if (req.method !== 'GET' && req.method !== 'HEAD' && body) {
            fetchOptions.body = JSON.stringify(body);
          }

          const remoteRes = await fetch(remoteUrl, fetchOptions);
          const data = await remoteRes.json().catch(() => ({}));
          return sendJson(remoteRes.status, data);
        } catch {
          return sendJson(404, { error: 'Endpoint not found' });
        }
}

export function createDineInServerPlugin(): Plugin {
  return {
    name: 'dine-in-server-security',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handleDineInMiddleware);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handleDineInMiddleware);
    },
  };
}
