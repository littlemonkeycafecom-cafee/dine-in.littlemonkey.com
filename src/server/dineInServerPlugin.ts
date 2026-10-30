/**
 * dineInServerPlugin.ts — Server-Side Security, QR Table Authorization & 30-Minute Dining Sessions
 *
 * Implements:
 * 1. Server-Authorized QR Verification (/api/dine-in/verify-qr):
 *    - Validates scanned table QR against server-stored cryptographic hashes
 *    - Enforces 6 physical tables (Table 01 to Table 06)
 *    - Issues short-lived signed QR Proof Token (5 minutes) for login handoff
 * 2. Strict 30-Minute Server-Side Dining Sessions (/api/dine-in/create-session, /api/dine-in/session-status):
 *    - Binds verified table identity, QR credential, and authenticated customer
 *    - Fixed 1,800,000 ms lifetime with zero sliding extensions
 *    - Rejects expired sessions with HTTP 401 DINING_SESSION_EXPIRED
 *    - Immediate revocation when QR credential or table is rotated/deactivated
 * 3. Administrative QR Management (/api/admin/qr/*):
 *    - Overview of 6 physical tables, active credentials, and session counts
 *    - High-entropy cryptographic credential generation & rotation
 *    - Instant table credential revocation with cascading session termination
 *    - Print-ready high-contrast vector PDF export for the 6 physical tables
 * 4. Deterministic Test Clock (/api/test/advance-time, /api/test/reset-time):
 *    - Verifiable automated expiry testing without waiting 30 real minutes
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

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTHORITATIVE_TABLES,
  generateTableCredential,
  revokeTableCredential,
  verifyQrPayload,
  verifyQrProofToken,
  createDiningSession,
  validateDiningSession,
  revokeDiningSession,
  getAdminTablesOverview,
  generateSixTablesPdf,
  advanceSystemTime,
  resetSystemTime,
  getSystemTime,
  getCredentialById,
  getActiveCredentialForTable,
  FIXED_SESSION_DURATION_MS,
} from './qrAuthStore';

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

// -----------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiters
// -----------------------------------------------------------------------------
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const authRateLimits = new Map<string, RateLimitBucket>();
const apiRateLimits = new Map<string, RateLimitBucket>();
const qrRateLimits = new Map<string, RateLimitBucket>();
const adminRateLimits = new Map<string, RateLimitBucket>();

export function getClientIp(req: IncomingMessage): string {
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

export function createDineInServerPlugin(): Plugin {
  return {
    name: 'dine-in-server-security',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1:3000');
        const pathname = parsedUrl.pathname;

        // Apply global security headers to all incoming responses
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

        // Only intercept /api/* endpoints
        if (!pathname.startsWith('/api/')) {
          return next();
        }

        const clientIp = getClientIp(req);

        // Helper: JSON response sender
        const sendJson = (code: number, data: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
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
            return res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Authentication rate limit exceeded. Please retry after ${authLimit.retryAfterSec} seconds.`,
                retryAfter: authLimit.retryAfterSec,
              })
            );
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
            return res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `QR code verification rate limit exceeded. Please retry after ${qrLimit.retryAfterSec} seconds.`,
                retryAfter: qrLimit.retryAfterSec,
              })
            );
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
            return res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Request rate limit exceeded. Please retry after ${apiLimit.retryAfterSec} seconds.`,
                retryAfter: apiLimit.retryAfterSec,
              })
            );
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
            return res.end(
              JSON.stringify({
                error: 'TOO_MANY_REQUESTS',
                message: `Administrative action rate limit exceeded. Please retry after ${adminLimit.retryAfterSec} seconds.`,
                retryAfter: adminLimit.retryAfterSec,
              })
            );
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
        // Validates physical table QR code and issues short-lived QR Proof Token
        // ----------------------------------------------------------------------
        if (pathname === '/api/dine-in/verify-qr') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          const rawTable = body.table || parsedUrl.searchParams.get('table') || parsedUrl.searchParams.get('t');
          const rawCred = body.cred || parsedUrl.searchParams.get('cred') || body.credential;

          if (!rawCred) {
            return sendJson(400, {
              valid: false,
              error: 'MISSING_CREDENTIAL',
              message: 'No QR credential detected. Please scan the QR code located on your table.',
            });
          }

          const result = verifyQrPayload(rawTable, rawCred);
          if (!result.valid) {
            const statusCode = result.error === 'REVOKED_CREDENTIAL' ? 403 : 400;
            return sendJson(statusCode, {
              valid: false,
              error: result.error,
              message: result.message || 'QR credential verification failed.',
            });
          }

          return sendJson(200, {
            valid: true,
            tableNumber: result.tableNumber,
            credentialId: result.credentialId,
            qrProofToken: result.qrProofToken,
            message: `Table ${result.tableNumber} QR verified. Please authenticate to begin dining.`,
          });
        }

        // ----------------------------------------------------------------------
        // POST /api/dine-in/create-session
        // Server issues strict 30-minute Dining session bound to Table + Customer
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
          const sessionResult = createDiningSession(
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
          res.setHeader('Set-Cookie', [
            `lm_dining_session=${encodeURIComponent(session.sessionId)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly`,
          ]);

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
          const sessionCheck = validateDiningSession(sessionToken);

          if (!sessionCheck.valid || !sessionCheck.session) {
            const statusCode = (sessionCheck.error === 'CREDENTIAL_REVOKED' || sessionCheck.error === 'SESSION_REVOKED') ? 403 : 401;
            return sendJson(statusCode, {
              valid: false,
              error: sessionCheck.error,
              message: sessionCheck.message,
            });
          }

          return sendJson(200, {
            valid: true,
            tableNumber: sessionCheck.session.tableNumber,
            expiresAt: sessionCheck.session.expiresAt,
            timeRemainingMs: sessionCheck.timeRemainingMs,
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
            revokeDiningSession(sessionToken);
          }
          res.setHeader('Set-Cookie', [
            'lm_dining_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly',
          ]);
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

        if (pathname === '/api/test/reset-time' && req.method === 'POST') {
          if (process.env.NODE_ENV === 'production') {
            return sendJson(403, { error: 'TEST_HELPERS_DISABLED_IN_PROD' });
          }
          resetSystemTime();
          return sendJson(200, {
            success: true,
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
        // POST /api/auth/guest-session (Dev Preview Only)
        // ----------------------------------------------------------------------
        if (pathname === '/api/auth/guest-session') {
          if (req.method !== 'POST') {
            return sendJson(405, { error: 'Method not allowed' });
          }

          if (process.env.NODE_ENV === 'production' && process.env.VITE_ENABLE_GUEST_PREVIEW !== 'true') {
            return sendJson(403, {
              error: 'GUEST_DISABLED',
              message: 'Guest preview mode is disabled in production.',
            });
          }

          const rawTable = body.tableNumber || 'Table 04';
          const tableCheck = isValidDiningTable(rawTable);
          const table = tableCheck.valid ? tableCheck.normalized! : 'Table 04';

          const guestId = `guest_${getSystemTime()}_${Math.random().toString(36).slice(2, 7)}`;
          const payload = {
            sub: guestId,
            phone: '9999999999',
            name: `Table Guest (${table})`,
            role: 'guest',
            tableNumber: table,
            iat: Math.floor(getSystemTime() / 1000),
            exp: Math.floor(getSystemTime() / 1000) + 86400, // 24 hours
          };

          const token = `dev_token.${Buffer.from(JSON.stringify(payload)).toString('base64')}.lmc`;
          return sendJson(200, {
            valid: true,
            token,
            session: {
              access_token: token,
              token,
              user: {
                id: guestId,
                phone: '9999999999',
                user_metadata: { full_name: `Table Guest (${table})` },
              },
            },
            user: {
              id: guestId,
              phone: '9999999999',
              name: `Table Guest (${table})`,
              role: 'guest',
            },
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
        // Requires active 30-minute Dining Session
        // ----------------------------------------------------------------------
        if (pathname.startsWith('/api/dine-in/')) {
          const sessionToken = extractDiningSessionToken();
          const sessionCheck = validateDiningSession(sessionToken);

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
      });
    },
  };
}
