/**
 * Little Monkey Cafe Dining — Pluggable State Storage Layer
 * Supports:
 * - Upstash Redis (Shared Stateless HTTP Storage for Vercel Serverless Production)
 * - File/Memory Storage (Local Dev & Unit Testing)
 * - Supabase PostgreSQL (Legacy/Alternative)
 */
import crypto from 'crypto';
import type {
  DiningSessionRecord,
  QrCredentialRecord,
} from './qrAuthStore.ts';
import {
  AUTHORITATIVE_TABLES,
  getCredentialById as fileGetCredentialById,
  getActiveCredentialForTable as fileGetActiveCredentialForTable,
  generateTableCredential as fileGenerateTableCredential,
  revokeTableCredential as fileRevokeTableCredential,
  createDiningSession as fileCreateDiningSession,
  validateDiningSession as fileValidateDiningSession,
  revokeDiningSession as fileRevokeDiningSession,
  getAdminTablesOverview as fileGetAdminTablesOverview,
  getActiveRawSecretForTable as fileGetActiveRawSecretForTable,
  verifyQrProofToken,
  normalizeTableLabel,
  FIXED_SESSION_DURATION_MS,
  getSystemTime,
} from './qrAuthStore.ts';
import { getEnv, isProduction, getRedisConfig, getQrHmacSecret } from './config.ts';
import type { RedisClientInterface } from './redisClient.ts';
import {
  UpstashRedisClient,
  RedisUnavailableError,
} from './redisClient.ts';

export interface ScanAuditRecord {
  tableNumber?: string;
  eventType: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface StorageProvider {
  name: string;
  // Session methods
  createSession(
    qrProofToken: string,
    customer: { id: string; name: string; phone: string; role?: string },
    clientMeta?: { ip?: string; userAgent?: string }
  ): Promise<{ success: boolean; session?: DiningSessionRecord; error?: string; message?: string }>;
  
  validateSession(
    sessionId: string | null | undefined
  ): Promise<{ valid: boolean; session?: DiningSessionRecord; timeRemainingMs?: number; error?: string; message?: string }>;
  
  revokeSession(sessionId: string): Promise<boolean>;

  // Table Credential methods
  getCredentialById(credentialId: string): Promise<QrCredentialRecord | null>;
  getActiveCredentialForTable(tableNumber: string): Promise<QrCredentialRecord | null>;
  rotateTableCredential(tableNumber: string, rotatedBy: string): Promise<{ record: QrCredentialRecord; rawSecret: string }>;
  revokeTableCredential(tableNumber: string, revokedBy: string): Promise<boolean>;
  getAdminTablesOverview(): Promise<Array<{
    tableNumber: string;
    shortCode: string;
    zone: string;
    capacity: number;
    credentialId: string | null;
    isActive: boolean;
    createdAt: string | null;
    rotatedAt: string | null;
    revokedAt: string | null;
    rotationCount: number;
    activeSessionsCount: number;
  }>>;
  getActiveRawSecretForTable(tableNumber: string): Promise<string | null>;

  // Audit Log
  logAuditEvent(event: ScanAuditRecord): Promise<void>;
}

/**
 * Shared Redis Storage Provider (Vercel Serverless Production)
 * Connects via stateless HTTPS REST API to Upstash Redis.
 * Enforces atomic single-use QR proof replay prevention and 15-minute fixed sessions.
 */
export class RedisStorageProvider implements StorageProvider {
  name = 'redis-upstash';
  private redis: RedisClientInterface;

  constructor(customClient?: RedisClientInterface) {
    if (customClient) {
      this.redis = customClient;
    } else {
      const config = getRedisConfig();
      if (!config.isConfigured) {
        throw new Error(
          '[RedisStorageProvider] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured.'
        );
      }
      this.redis = new UpstashRedisClient({
        url: config.url,
        token: config.token,
      });
    }
  }

  async createSession(
    qrProofToken: string,
    customer: { id: string; name: string; phone: string; role?: string },
    clientMeta?: { ip?: string; userAgent?: string }
  ): Promise<{ success: boolean; session?: DiningSessionRecord; error?: string; message?: string }> {
    try {
      // 1. Verify cryptographic signature, expiry, and table credential status without consuming locally
      const proof = verifyQrProofToken(qrProofToken, { consume: false });
      if (!proof.valid || !proof.tableNumber || !proof.credentialId || !proof.jti) {
        return {
          success: false,
          error: proof.error || 'INVALID_QR_PROOF',
          message: proof.message || 'Invalid, expired, or unverified table QR proof.',
        };
      }

      // 2. Deterministic session identity and recovery binding
      // Derived from HMAC-SHA256(jti : customer.id)
      const secret = getQrHmacSecret();
      const sessionDigest = crypto
        .createHmac('sha256', secret)
        .update(`${proof.jti}:${customer.id}`)
        .digest('hex');
      const sessionId = `dinesess_${sessionDigest}`;

      const proofKey = `lm:proof_claim:${proof.jti}`;
      const sessionKey = `lm:sess:${sessionId}`;

      // 3. Construct minimized 15-minute Dining Session record (MED-03: PII minimization, omitting IP/User-Agent from cache)
      const now = getSystemTime();
      const expiresAt = now + FIXED_SESSION_DURATION_MS;

      const sessionRecord: DiningSessionRecord = {
        sessionId,
        tableNumber: proof.tableNumber,
        credentialId: proof.credentialId,
        customerId: customer.id,
        customerPhone: customer.phone,
        customerName: customer.name,
        role: customer.role || 'customer',
        createdAt: now,
        expiresAt,
        isActive: true,
      };

      // 4. Atomic single-use claim with recovery support (CRIT-01, HIGH-03)
      // SET lm:proof_claim:<jti> <customerId> EX 300 NX
      const claimResult = await this.redis.set(proofKey, customer.id, {
        ex: 300,
        nx: true,
      });

      if (claimResult !== 'OK') {
        // Claim already exists. Inspect owner to distinguish legitimate retry from replay attempt
        const existingOwner = await this.redis.get(proofKey);

        if (existingOwner === customer.id) {
          // Idempotent retry by the SAME customer!
          // Check if session record already exists in Redis
          const existingSessionRaw = await this.redis.get(sessionKey);
          if (existingSessionRaw) {
            const existingSession: DiningSessionRecord = JSON.parse(existingSessionRaw);
            return {
              success: true,
              session: existingSession,
            };
          }

          // Session write previously timed out or failed; complete session write now!
          await this.redis.set(sessionKey, JSON.stringify(sessionRecord), {
            ex: Math.ceil(FIXED_SESSION_DURATION_MS / 1000),
          });

          await this.logAuditEvent({
            tableNumber: proof.tableNumber,
            eventType: 'SESSION_RECOVERED',
            status: 'SUCCESS',
            metadata: { sessionId, customerId: customer.id },
          });

          return {
            success: true,
            session: sessionRecord,
          };
        }

        // Replay attempt by a DIFFERENT customer or unauthenticated attacker
        await this.logAuditEvent({
          tableNumber: proof.tableNumber,
          eventType: 'PROOF_REPLAY_BLOCKED',
          status: 'BLOCKED',
          metadata: { jti: proof.jti, attemptedBy: customer.id, originalOwner: existingOwner },
        });

        return {
          success: false,
          error: 'PROOF_ALREADY_USED',
          message: 'This table QR verification proof has already been used. Please re-scan your table QR code.',
        };
      }

      // 5. First attempt: write session record to Redis with 900-second TTL
      await this.redis.set(sessionKey, JSON.stringify(sessionRecord), {
        ex: Math.ceil(FIXED_SESSION_DURATION_MS / 1000),
      });

      // 6. Record audit event
      await this.logAuditEvent({
        tableNumber: proof.tableNumber,
        eventType: 'SESSION_CREATED',
        status: 'SUCCESS',
        metadata: {
          sessionId,
          customerId: customer.id,
          tableNumber: proof.tableNumber,
        },
      });

      return {
        success: true,
        session: sessionRecord,
      };
    } catch (err: any) {
      if (err instanceof RedisUnavailableError) {
        return {
          success: false,
          error: 'STORAGE_UNAVAILABLE',
          message: 'Shared dining session storage is temporarily unavailable. Please try again.',
        };
      }
      return {
        success: false,
        error: 'SESSION_CREATION_FAILED',
        message: err?.message || 'Failed to create dining session.',
      };
    }
  }

  async validateSession(
    sessionId: string | null | undefined
  ): Promise<{ valid: boolean; session?: DiningSessionRecord; timeRemainingMs?: number; error?: string; message?: string }> {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        valid: false,
        error: 'NO_SESSION',
        message: 'No dining session identifier provided.',
      };
    }

    try {
      const sessionKey = `lm:sess:${sessionId.trim()}`;
      const rawSession = await this.redis.get(sessionKey);

      if (!rawSession) {
        return {
          valid: false,
          error: 'DINING_SESSION_EXPIRED',
          message: 'Your 15-minute table dining session has expired or does not exist. Please re-scan your table QR code to continue.',
        };
      }

      const session: DiningSessionRecord = JSON.parse(rawSession);

      if (!session.isActive) {
        return {
          valid: false,
          session,
          error: 'SESSION_REVOKED',
          message: 'Your dining session was concluded or revoked.',
        };
      }

      const now = getSystemTime();
      if (now >= session.expiresAt) {
        return {
          valid: false,
          session,
          error: 'DINING_SESSION_EXPIRED',
          message: 'Your 15-minute table dining session has concluded. Please re-scan your table QR code.',
        };
      }

      // Verify table credential is still active
      const cred = await this.getCredentialById(session.credentialId);
      if (cred && !cred.isActive) {
        return {
          valid: false,
          session,
          error: 'CREDENTIAL_REVOKED',
          message: 'This table QR code has been revoked or replaced by cafe administration.',
        };
      }

      return {
        valid: true,
        session,
        timeRemainingMs: Math.max(0, session.expiresAt - now),
      };
    } catch (err: any) {
      if (err instanceof RedisUnavailableError) {
        return {
          valid: false,
          error: 'STORAGE_UNAVAILABLE',
          message: 'Shared dining session storage is temporarily unavailable.',
        };
      }
      return {
        valid: false,
        error: 'VALIDATION_FAILED',
        message: err?.message || 'Failed to validate dining session.',
      };
    }
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    if (!sessionId || typeof sessionId !== 'string') return false;
    try {
      const sessionKey = `lm:sess:${sessionId.trim()}`;
      const rawSession = await this.redis.get(sessionKey);
      if (rawSession) {
        const session: DiningSessionRecord = JSON.parse(rawSession);
        session.isActive = false;
        session.revocationReason = 'USER_LOGOUT';
        // Keep revoked marker for 60 seconds to prevent replay before automatic purge
        await this.redis.set(sessionKey, JSON.stringify(session), { ex: 60 });
      }
      return true;
    } catch {
      return false;
    }
  }

  async getActiveCredentialForTable(tableNumber: string): Promise<QrCredentialRecord | null> {
    const normalized = normalizeTableLabel(tableNumber);
    const tblKey = (normalized || tableNumber).trim().toLowerCase();

    // 1. Check shared Redis for dynamic active pointer or revocation tombstone (CRIT-02)
    try {
      const activeCredId = await this.redis.get(`lm:table_active:${tblKey}`);
      if (activeCredId === 'REVOKED') {
        return null; // Table credential was explicitly revoked across all serverless instances
      }
      if (activeCredId) {
        const credRaw = await this.redis.get(`lm:cred:${activeCredId}`);
        if (credRaw) {
          const cred: QrCredentialRecord = JSON.parse(credRaw);
          return cred.isActive ? cred : null;
        }
      }
    } catch (err: any) {
      if (isProduction()) {
        throw new RedisUnavailableError(`Failed to fetch distributed table credential for ${tableNumber}: ${err?.message}`);
      }
    }

    // 2. Baseline fallback: check authoritative table definitions (preserves existing printed QR codes)
    const baseCred = fileGetActiveCredentialForTable(tableNumber);
    if (!baseCred) return null;

    // 3. Check if baseline credential was marked revoked in Redis
    try {
      const isRevoked = await this.redis.get(`lm:cred_revoked:${baseCred.credentialId}`);
      if (isRevoked) {
        return null;
      }
    } catch {}

    return baseCred;
  }

  async getCredentialById(credentialId: string): Promise<QrCredentialRecord | null> {
    if (!credentialId || typeof credentialId !== 'string') return null;

    // 1. Check shared Redis for rotated or dynamic credentials
    try {
      const credRaw = await this.redis.get(`lm:cred:${credentialId.trim()}`);
      if (credRaw) {
        return JSON.parse(credRaw);
      }
    } catch (err: any) {
      if (isProduction()) {
        throw new RedisUnavailableError(`Failed to fetch distributed credential ${credentialId}: ${err?.message}`);
      }
    }

    // 2. Check baseline local credentials
    const baseCred = fileGetCredentialById(credentialId.trim());
    if (!baseCred) return null;

    // 3. Check if marked revoked in Redis
    try {
      const isRevoked = await this.redis.get(`lm:cred_revoked:${credentialId.trim()}`);
      if (isRevoked) {
        return {
          ...baseCred,
          isActive: false,
          revokedAt: 'REVOKED_DISTRIBUTED',
        };
      }
    } catch {}

    return baseCred;
  }

  async revokeTableCredential(tableNumber: string, revokedBy: string): Promise<boolean> {
    const normalized = normalizeTableLabel(tableNumber);
    const tblKey = (normalized || tableNumber).trim().toLowerCase();
    const nowStr = new Date(getSystemTime()).toISOString();

    const activeCred = await this.getActiveCredentialForTable(tableNumber);

    // Update shared Redis state across all serverless instances
    await this.redis.set(`lm:table_active:${tblKey}`, 'REVOKED');
    if (activeCred) {
      await this.redis.set(`lm:cred_revoked:${activeCred.credentialId}`, '1');
      const updatedCred: QrCredentialRecord = {
        ...activeCred,
        isActive: false,
        revokedAt: nowStr,
        revokedBy,
      };
      await this.redis.set(`lm:cred:${activeCred.credentialId}`, JSON.stringify(updatedCred));
    }

    // Distributed state is updated in Redis above. In serverless execution, the local
    // file system is ephemeral or read-only; we do not mutate local disk files.

    await this.logAuditEvent({
      tableNumber,
      eventType: 'TABLE_CREDENTIAL_REVOKED',
      status: 'SUCCESS',
      metadata: { revokedBy, credentialId: activeCred?.credentialId },
    });

    return true;
  }

  async rotateTableCredential(tableNumber: string, rotatedBy: string): Promise<{ record: QrCredentialRecord; rawSecret: string }> {
    const table = AUTHORITATIVE_TABLES.find(
      (t) => t.tableNumber.toLowerCase() === tableNumber.toLowerCase() || t.shortCode.toLowerCase() === tableNumber.toLowerCase()
    );
    if (!table) {
      throw new Error(`Invalid table number: ${tableNumber}`);
    }

    const tblKey = table.tableNumber.toLowerCase();
    const oldCred = await this.getActiveCredentialForTable(table.tableNumber);
    const rotationCount = oldCred ? oldCred.rotationCount + 1 : 1;

    // Generate 192-bit cryptographically secure raw secret
    const rawSecret = crypto.randomBytes(24).toString('base64url');
    const secretHash = crypto.createHash('sha256').update(rawSecret, 'utf8').digest('hex');
    const credentialId = `qrc_${table.shortCode.toLowerCase()}_${crypto.randomBytes(6).toString('hex')}`;
    const nowStr = new Date(getSystemTime()).toISOString();

    const record: QrCredentialRecord = {
      credentialId,
      tableNumber: table.tableNumber,
      tableShortCode: table.shortCode,
      secretHash,
      isActive: true,
      createdAt: nowStr,
      rotatedAt: null,
      revokedAt: null,
      revokedBy: null,
      createdBy: rotatedBy,
      rotationCount,
    };

    // Store in shared Redis: active pointer and credential record (hash only, zero raw secrets)
    await this.redis.set(`lm:cred:${credentialId}`, JSON.stringify(record));
    await this.redis.set(`lm:table_active:${tblKey}`, credentialId);
    if (oldCred) {
      await this.redis.set(`lm:cred_revoked:${oldCred.credentialId}`, '1');
    }

    // Distributed state is updated in Redis above. In serverless execution, the local
    // file system is ephemeral or read-only; we do not mutate local disk files.

    await this.logAuditEvent({
      tableNumber: table.tableNumber,
      eventType: 'TABLE_CREDENTIAL_ROTATED',
      status: 'SUCCESS',
      metadata: { credentialId, rotationCount, rotatedBy },
    });

    return { record, rawSecret };
  }

  async getAdminTablesOverview() {
    return fileGetAdminTablesOverview();
  }

  async getActiveRawSecretForTable(tableNumber: string): Promise<string | null> {
    return fileGetActiveRawSecretForTable(tableNumber);
  }

  async logAuditEvent(event: ScanAuditRecord): Promise<void> {
    try {
      const record = {
        ...event,
        createdAt: event.createdAt || new Date(getSystemTime()).toISOString(),
      };
      // Atomic pipeline: LPUSH and LTRIM in a single request batch (MED-02)
      await this.redis.pipeline([
        ['LPUSH', 'lm:audit_log', JSON.stringify(record)],
        ['LTRIM', 'lm:audit_log', 0, 999],
      ]);
    } catch (err: any) {
      console.error(`[AUDIT_LOG_ERROR] Failed to dispatch audit event '${event.eventType}':`, err?.message);
    }
  }
}

/**
 * File & In-Memory Storage Provider (Default for Dev and Automated Testing)
 */
export class FileStorageProvider implements StorageProvider {
  name = 'file-memory';

  async createSession(
    qrProofToken: string,
    customer: { id: string; name: string; phone: string; role?: string },
    clientMeta?: { ip?: string; userAgent?: string }
  ) {
    return fileCreateDiningSession(
      qrProofToken,
      {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        role: customer.role || 'customer',
      },
      clientMeta || {}
    );
  }

  async validateSession(sessionId: string | null | undefined) {
    return fileValidateDiningSession(sessionId);
  }

  async revokeSession(sessionId: string) {
    return fileRevokeDiningSession(sessionId);
  }

  async getCredentialById(credentialId: string) {
    return fileGetCredentialById(credentialId);
  }

  async getActiveCredentialForTable(tableNumber: string) {
    return fileGetActiveCredentialForTable(tableNumber);
  }

  async rotateTableCredential(tableNumber: string, rotatedBy: string) {
    return fileGenerateTableCredential(tableNumber, rotatedBy);
  }

  async revokeTableCredential(tableNumber: string, revokedBy: string) {
    return fileRevokeTableCredential(tableNumber, revokedBy);
  }

  async getAdminTablesOverview() {
    return fileGetAdminTablesOverview();
  }

  async getActiveRawSecretForTable(tableNumber: string) {
    return fileGetActiveRawSecretForTable(tableNumber);
  }

  async logAuditEvent(event: ScanAuditRecord): Promise<void> {
    if (process.env.DEBUG_AUDIT === 'true') {
      console.log(`[AUDIT] [${event.eventType}] [${event.status}] Table: ${event.tableNumber || 'N/A'}`);
    }
  }
}

/**
 * Supabase PostgreSQL Storage Provider (Legacy/Alternative)
 */
export class SupabaseStorageProvider implements StorageProvider {
  name = 'supabase-postgres';
  private supabaseUrl: string;
  private serviceRoleKey: string;

  constructor() {
    this.supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
    this.serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!this.supabaseUrl || !this.serviceRoleKey) {
      console.warn('[Storage] Supabase credentials missing.');
    }
  }

  private getHeaders() {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    };
  }

  async createSession(
    qrProofToken: string,
    customer: { id: string; name: string; phone: string; role?: string },
    clientMeta?: { ip?: string; userAgent?: string }
  ) {
    const fallback = new FileStorageProvider();
    const result = await fallback.createSession(qrProofToken, customer, clientMeta);
    if (!result.success || !result.session) return result;

    try {
      await fetch(`${this.supabaseUrl}/rest/v1/dining_sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          session_id: result.session.sessionId,
          table_number: result.session.tableNumber,
          credential_id: result.session.credentialId,
          customer_id: result.session.customerId,
          customer_name: result.session.customerName,
          customer_phone: result.session.customerPhone,
          role: result.session.role,
          created_at: result.session.createdAt,
          expires_at: result.session.expiresAt,
          is_active: result.session.isActive,
          user_agent: clientMeta?.userAgent,
          ip_address: clientMeta?.ip,
        }),
      });
    } catch (err: any) {
      console.warn('[Storage:Supabase] Error writing session to Supabase:', err?.message);
    }

    return result;
  }

  async validateSession(sessionId: string | null | undefined) {
    if (!sessionId) {
      return { valid: false, error: 'MISSING_SESSION', message: 'No dining session token provided.' };
    }

    try {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/dining_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const rows: any[] = await res.json();
        if (rows && rows.length > 0) {
          const row = rows[0];
          const now = Date.now();
          if (!row.is_active || row.revocation_reason) {
            return {
              valid: false,
              error: 'SESSION_REVOKED',
              message: 'Your dining session was concluded or revoked.',
            };
          }
          if (now >= row.expires_at) {
            return {
              valid: false,
              error: 'SESSION_EXPIRED',
              message: 'Your 15-minute dining session has concluded.',
            };
          }
          return {
            valid: true,
            session: {
              sessionId: row.session_id,
              tableNumber: row.table_number,
              credentialId: row.credential_id,
              customerId: row.customer_id,
              customerName: row.customer_name,
              customerPhone: row.customer_phone,
              role: row.role,
              createdAt: row.created_at,
              expiresAt: row.expires_at,
              isActive: row.is_active,
            },
            timeRemainingMs: Math.max(0, row.expires_at - now),
          };
        }
      }
    } catch {}

    const fallback = new FileStorageProvider();
    return fallback.validateSession(sessionId);
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      await fetch(
        `${this.supabaseUrl}/rest/v1/dining_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ is_active: false, revocation_reason: 'USER_LOGOUT' }),
        }
      );
    } catch {}
    const fallback = new FileStorageProvider();
    return fallback.revokeSession(sessionId);
  }

  async getCredentialById(credentialId: string) {
    const fallback = new FileStorageProvider();
    return fallback.getCredentialById(credentialId);
  }

  async getActiveCredentialForTable(tableNumber: string) {
    const fallback = new FileStorageProvider();
    return fallback.getActiveCredentialForTable(tableNumber);
  }

  async rotateTableCredential(tableNumber: string, rotatedBy: string) {
    const fallback = new FileStorageProvider();
    return fallback.rotateTableCredential(tableNumber, rotatedBy);
  }

  async revokeTableCredential(tableNumber: string, revokedBy: string) {
    const fallback = new FileStorageProvider();
    return fallback.revokeTableCredential(tableNumber, revokedBy);
  }

  async getAdminTablesOverview() {
    const fallback = new FileStorageProvider();
    return fallback.getAdminTablesOverview();
  }

  async getActiveRawSecretForTable(tableNumber: string) {
    const fallback = new FileStorageProvider();
    return fallback.getActiveRawSecretForTable(tableNumber);
  }

  async logAuditEvent(event: ScanAuditRecord): Promise<void> {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/scan_audit_log`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          table_number: event.tableNumber,
          event_type: event.eventType,
          status: event.status,
          ip_hash: event.ipHash,
          user_agent: event.userAgent,
          metadata: event.metadata || {},
        }),
      });
    } catch {}
  }
}

let _activeStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_activeStorageProvider !== null) {
    return _activeStorageProvider;
  }

  const requestedProvider = getEnv('STORAGE_PROVIDER', 'auto');
  const redisConfig = getRedisConfig();
  const hasSupabaseServiceRole = Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY'));

  // Strict fail-closed policy in production
  if (isProduction()) {
    if (!redisConfig.isConfigured) {
      throw new Error(
        '[PRODUCTION_STORAGE_ERROR] Production serverless environment requires shared Redis storage for distributed session state and single-use QR proof replay prevention. Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured. Silent fallback to local file or memory storage is strictly prohibited to prevent cross-instance session loss.'
      );
    }
    _activeStorageProvider = new RedisStorageProvider();
    return _activeStorageProvider;
  }

  // Development / Automated Testing behavior
  if (requestedProvider === 'redis' || (requestedProvider === 'auto' && redisConfig.isConfigured)) {
    try {
      _activeStorageProvider = new RedisStorageProvider();
      return _activeStorageProvider;
    } catch (err: any) {
      console.warn('[Storage] Failed to initialize Redis provider in development, falling back to file/memory storage:', err?.message);
    }
  }

  if (requestedProvider === 'supabase' && hasSupabaseServiceRole) {
    _activeStorageProvider = new SupabaseStorageProvider();
    return _activeStorageProvider;
  }

  _activeStorageProvider = new FileStorageProvider();
  return _activeStorageProvider;
}

export function setStorageProvider(provider: StorageProvider | null): void {
  _activeStorageProvider = provider;
}

