# Little Monkey Cafe Dining — Phase 1.4.3 Independent Post-Remediation Security Audit

## 1. Executive Summary & Audit Mandate

This independent security audit evaluates the post-remediation codebase of Little Monkey Cafe Dining following Phase 1.4.2.

- **Audit Date**: 2026-11-05
- **Scope**: Confined strictly to `C:\Users\chava\.gemini\antigravity\scratch\dine-in`.
- **Mode**: Read-only verification of actual source code, configuration, endpoints, build output, and test suites.
- **Primary Source Under Review**: [docs/redis-phase-1.4.2-remediation-report.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/redis-phase-1.4.2-remediation-report.md)
- **Baseline Audit Reference**: [docs/redis-phase-1.4.1-security-audit.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/redis-phase-1.4.1-security-audit.md)

### Audit Verdict

**NOT READY**

While critical improvements were made to deterministic session recovery and cryptographic configuration fail-closed checks, this audit identified three major architectural and security defects that prevent production readiness:
1. **Critical Architectural Disconnect in QR Verification**: [api/dine-in/verify-qr.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/verify-qr.ts#L3-L36) imports and executes `verifyQrPayload` directly from [src/server/qrAuthStore.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/qrAuthStore.ts#L484-L543), completely bypassing `RedisStorageProvider`. Rotated table QR credentials stored in Redis cannot be scanned or verified, and revoked credentials continue to be accepted for QR proof token generation.
2. **Insecure Cookie Transmission on Customer Registration**: [api/dine-in/customer-record.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/customer-record.ts#L110-L112) was not migrated to use `buildDiningSessionCookie(...)` and hardcodes a `Set-Cookie` string that omits the `; Secure` attribute in production.
3. **Bypassable In-Memory Rate Limiting and Missing Edge WAF**: The rate limiting tracker uses container-local `Map` instances that provide zero coordination across serverless lambdas. Key mutation endpoints (`create-session.ts`, `session-status.ts`) have zero rate limiting, and no Edge WAF configuration exists in [vercel.json](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/vercel.json).

---

## 2. Verification of Phase 1.4.2 Remediation Claims

| Finding ID | Severity | Phase 1.4.2 Claim | Actual Code Inspection | Audit Verification |
| :--- | :--- | :--- | :--- | :--- |
| **CRIT-01** | Critical | Idempotent session recovery via deterministic HMAC binding and atomic claim | Verified in [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L127-L215). `sessionId` derived from `HMAC(jti:customerId)`. `SET lm:proof_claim:<jti> <customerId> NX` prevents burning proof tokens | **VERIFIED FIX** |
| **CRIT-02** | Critical | Distributed table credential rotation and revocation synchronization in Redis | Incomplete: `RedisStorageProvider` maintains Redis keys, but [api/dine-in/verify-qr.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/verify-qr.ts#L35) does not query Redis. Rotated credentials fail verification; revoked credentials still issue proof tokens | **FAILED FIX** |
| **HIGH-01** | High | Centralized secure session cookie helpers enforcing `; Secure` in production | Incomplete: [src/server/http.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/http.ts#L295-L318) and [api/dine-in/create-session.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/create-session.ts#L48) updated, but [api/dine-in/customer-record.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/customer-record.ts#L110-L112) sets hardcoded cookie without `; Secure` | **FAILED FIX** |
| **HIGH-02** | High | Fail-closed validation for `QR_HMAC_SECRET` in production | Verified in [src/server/config.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/config.ts#L213-L228). Missing, short, or repository fallback secret throws `PRODUCTION_SECURITY_ERROR` | **VERIFIED FIX** |
| **HIGH-03** | High | Ambiguous Redis timeout handling and typed error classification | Verified in [src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts#L45-L56) and [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L163-L195). Timeout yields `STORAGE_UNAVAILABLE`, customer retries recover session | **VERIFIED FIX** |
| **MED-01** | Medium | Strict HTTPS protocol validation for production Redis REST endpoint | Verified in [src/server/config.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/config.ts#L187-L196) and [src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts#L90-L94) via `new URL()` | **VERIFIED FIX** |
| **MED-02** | Medium | Atomic pipeline command batching for audit log capping | Verified in [src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts#L186-L227) and [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L518-L522) via `/pipeline` | **VERIFIED FIX** |
| **MED-03** | Medium | PII minimization in Redis session payload (omitting IP and User-Agent) | Verified in [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L143-L154). `ipAddress` and `userAgent` stripped from session cache | **VERIFIED FIX** |
| **MED-04** | Medium | Rate limiting architecture documentation | Documented in Section 9 of [docs/redis-security.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/redis-security.md), but actual implementation lacks Edge WAF configuration | **PARTIALLY VERIFIED** |

---

## 3. In-Depth Technical Audits by Vulnerability Area

### 3.1 CRIT-01: Idempotent Session Recovery Implementation

#### Code Inspection:
File: [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L111-L247)

```typescript
// 2. Deterministic session identity and recovery binding
const secret = getQrHmacSecret();
const sessionDigest = crypto
  .createHmac('sha256', secret)
  .update(`${proof.jti}:${customer.id}`)
  .digest('hex');
const sessionId = `dinesess_${sessionDigest}`;

const proofKey = `lm:proof_claim:${proof.jti}`;
const sessionKey = `lm:sess:${sessionId}`;

// 4. Atomic single-use claim with recovery support (CRIT-01, HIGH-03)
const claimResult = await this.redis.set(proofKey, customer.id, {
  ex: 300,
  nx: true,
});

if (claimResult !== 'OK') {
  const existingOwner = await this.redis.get(proofKey);
  if (existingOwner === customer.id) {
    const existingSessionRaw = await this.redis.get(sessionKey);
    if (existingSessionRaw) {
      return { success: true, session: JSON.parse(existingSessionRaw) };
    }
    await this.redis.set(sessionKey, JSON.stringify(sessionRecord), {
      ex: Math.ceil(FIXED_SESSION_DURATION_MS / 1000),
    });
    return { success: true, session: sessionRecord };
  }
  return { success: false, error: 'PROOF_ALREADY_USED', ... };
}
```

#### Evaluation of Mandatory Scenarios:

1. **First Legitimate Request**:
   - `verifyQrProofToken` succeeds.
   - `SET lm:proof_claim:<jti> <customerId> NX EX 300` returns `'OK'`.
   - `SET lm:sess:<sessionId>` persists session record.
   - **Verdict**: Verified. Succeeds.

2. **Same Customer Retries Same Request**:
   - `SET ... NX` returns `null`.
   - `GET lm:proof_claim:<jti>` matches `customer.id`.
   - `GET lm:sess:<sessionId>` retrieves existing session record.
   - **Verdict**: Verified. Idempotent success without error.

3. **Different Customer Attempts Reuse**:
   - `SET ... NX` returns `null`.
   - `GET lm:proof_claim:<jti>` returns original customer ID (`existingOwner !== customer.id`).
   - Request immediately rejected with `403 PROOF_ALREADY_USED` and logged to audit trail.
   - **Verdict**: Verified. Replay blocked.

4. **Two Simultaneous Requests from Same Customer**:
   - Request 1 wins `SET ... NX` and writes session.
   - Request 2 receives `null`, confirms matching customer ID, retrieves session written by Request 1.
   - **Verdict**: Verified. Both return identical session token.

5. **Two Simultaneous Requests from Different Customers**:
   - Redis single-threaded execution core resolves the race.
   - Exactly one customer receives `'OK'` on `SET ... NX`.
   - The other customer receives `null`, fails ownership check, and is rejected with `PROOF_ALREADY_USED`.
   - **Verdict**: Verified. Exactly one session issued; second claimant blocked.

6. **Redis Accepts Command but HTTP Response is Lost**:
   - Customer socket times out, throwing `RedisTimeoutError`.
   - On retry, customer re-submits identical proof and customer identity.
   - `GET lm:proof_claim:<jti>` returns customer ID.
   - Session is recovered or written without token burn.
   - **Verdict**: Verified. Recovers cleanly.

7. **Redis Rejects Command Before Execution**:
   - `SET ... NX` never executes.
   - On retry, token is unclaimed; succeeds normally.
   - **Verdict**: Verified.

8. **Session Creation Fails After Proof Claim Succeeds**:
   - `lm:proof_claim:<jti>` exists, but `lm:sess:<sessionId>` does not exist.
   - Customer retries: `existingOwner === customer.id` matches.
   - Code executes line 180: writes `lm:sess:<sessionId>` and returns success.
   - **Verdict**: Verified. Self-healing session persistence.

9. **Attacker Attempts to Manipulate Customer ID or Idempotency Identity**:
   - If an attacker intercepts an unused proof and submits it under their own customer identity, they become the claim owner.
   - If an attacker attempts to use a token already claimed by a victim, the attacker's ID does not match `existingOwner`, causing immediate rejection.
   - **Vulnerability Note**: In [src/server/http.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/http.ts#L40-L89), `verifySessionToken` only base64-decodes JWT payloads without verifying the cryptographic signature on segment 2. Additionally, `dev_preview_token` is accepted in production without checking `isProduction()` (lines 137-154). An attacker who intercepts a live `qrProofToken` before the customer signs in could forge an arbitrary customer ID to claim the token.
   - **Verdict**: Proof ownership cannot be altered once claimed, but unverified JWT parsing in `http.ts` presents an upstream identity spoofing risk.

10. **Expired Proof Retried**:
    - `verifyQrProofToken` validates `payload.exp < nowSec`.
    - Returns `EXPIRED_PROOF` before any Redis command is dispatched.
    - **Verdict**: Verified. Fails closed before storage call.

#### Session Collision Analysis:
- The session ID is computed via `HMAC-SHA256(jti : customer.id)`.
- `jti` is a 128-bit cryptographically secure random value generated anew on every QR scan.
- Collision probability between two independent sessions is $2^{-128}$ on `jti` and $2^{-256}$ on the HMAC digest, rendering accidental session collisions mathematically negligible.
- Successive scans by the same diner at the same table receive fresh `jti` values, generating distinct session IDs and preventing cross-session overwrite.

---

### 3.2 CRIT-02: Table Credential Migration and the QR Verification Disconnect

#### The Architectural Defect:
In Phase 1.4.2, `RedisStorageProvider` implemented distributed table credential storage:
- `lm:table_active:<tableNumber>`
- `lm:cred:<credentialId>`
- `lm:cred_revoked:<credentialId>`

However, inspection of [api/dine-in/verify-qr.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/verify-qr.ts#L3) reveals:
```typescript
import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, checkRateLimit } from '../../src/server/http.ts';
import { verifyQrPayload } from '../../src/server/qrAuthStore.ts';
...
const result = verifyQrPayload(rawTable, rawCred);
```

`api/dine-in/verify-qr.ts` **does not use `getStorageProvider()`**. It executes `verifyQrPayload` from `src/server/qrAuthStore.ts`, which reads from container-local in-memory `_credentialsMap` populated from `.qr_credentials.json` on disk:

```typescript
// src/server/qrAuthStore.ts line 505
const cred = getCredentialById(credentialId);
```

#### Consequences in Serverless Production:

1. **Rotated Credentials Cannot Be Scanned**:
   - When an administrator rotates a table credential via `api/admin/qr/rotate.ts`, `RedisStorageProvider.rotateTableCredential` writes the new credential record to `lm:cred:<newId>` in Redis.
   - Because serverless containers have read-only/ephemeral filesystems, the local `.qr_credentials.json` file is NOT updated.
   - When a customer scans the newly printed QR code, `api/dine-in/verify-qr.ts` looks up `newId` in `qrAuthStore.ts`'s disk map.
   - The credential ID is not found on disk.
   - `verifyQrPayload` returns HTTP 400 `UNKNOWN_CREDENTIAL`.
   - **Impact**: All rotated table QR codes are unusable in serverless execution.

2. **Revoked Credentials Still Issue Proof Tokens**:
   - When an administrator revokes a table credential via `api/admin/qr/revoke.ts`, `lm:cred_revoked:<id>` is set in Redis.
   - When a customer scans the revoked physical QR code, `POST /api/dine-in/verify-qr` checks the local disk map, sees `isActive: true`, and returns HTTP 200 with a valid, signed `qrProofToken`.
   - The customer can then call `POST /api/dine-in/create-session`, which calls `verifyQrProofToken(..., { consume: false })`. Because `verifyQrProofToken` also calls `getCredentialById` from `qrAuthStore.ts` (not Redis), `createSession` succeeds and writes an active session to Redis!
   - The revocation is only detected when the customer attempts to make a subsequent request that invokes `validateSession` (which checks `this.getCredentialById` in Redis).
   - **Impact**: Revoked credentials are not rejected at the front gate.

3. **Admin Tables Overview Ignores Redis State**:
   - In [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L500-L502):
     ```typescript
     async getAdminTablesOverview() {
       return fileGetAdminTablesOverview();
     }
     ```
   - `RedisStorageProvider.getAdminTablesOverview()` delegates directly to the file system.
   - An administrator calling `GET /api/admin/qr/tables` receives the static baseline from `.qr_credentials.json`, completely unaware of dynamic rotations or revocations recorded in Redis.

#### Baseline Credential and Artwork Compatibility:
- All 10 original table credentials (`qrc_t01_abce82e42a7e` through `qrc_t10_aa84175f6246`) are present in `.qr_credentials.json` and marked `isActive: true`.
- All 10 PNG files in `storage/qr-codes/` decode correctly via `jsQR` and match baseline credentials.
- In their baseline state (unrotated and unrevoked), existing printed QR codes remain fully functional.

---

### 3.3 HIGH-01: Session Cookie Security Invariants

#### Defect in Customer Registration Route:
While [api/dine-in/create-session.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/create-session.ts#L48) and [api/dine-in/logout-session.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/logout-session.ts#L16) use `buildDiningSessionCookie(...)` and `buildClearDiningSessionCookie()`, [api/dine-in/customer-record.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/customer-record.ts#L110-L112) was missed:

```typescript
// api/dine-in/customer-record.ts lines 109-112:
const maxAgeSec = Math.ceil(FIXED_SESSION_DURATION_MS / 1000);
res.setHeader('Set-Cookie', [
  `lm_dining_session=${encodeURIComponent(sessionResult.session.sessionId)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly`,
]);
```

#### Risk Analysis:
- `api/dine-in/customer-record.ts` is the primary customer onboarding route (handling both new customer registration and existing customer authentication via mobile number and name).
- When a customer completes registration or login, their browser receives a session cookie without the `; Secure` attribute.
- If a customer connects over an unencrypted connection or visits `http://dine-in.littlemonkey.com`, the browser transmits the `lm_dining_session` cookie in plaintext, exposing active dining sessions to network eavesdropping on open café Wi-Fi.

---

### 3.4 HIGH-02: Cryptographic Secrets Configuration

#### Verification of `getQrHmacSecret`:
In [src/server/config.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/config.ts#L213-L228):
```typescript
export function getQrHmacSecret(): string {
  const secret = (getEnv('QR_HMAC_SECRET') || getEnv('SESSION_SECRET')).trim();
  const isProd = isProduction();

  if (isProd) {
    const isPlaceholder = !secret || secret.includes('your_') || secret.length < 16;
    const isKnownDefault = secret === 'lm_qr_hmac_secret_2026_warangal_dining';
    if (isPlaceholder || isKnownDefault) {
      throw new Error(
        '[PRODUCTION_SECURITY_ERROR] Production environment requires a secure, high-entropy QR_HMAC_SECRET configured in environment variables. The hardcoded development fallback or placeholder is strictly prohibited.'
      );
    }
  }

  return secret || 'lm_qr_hmac_secret_2026_warangal_dining';
}
```

#### Audit Findings:
- **No Production Fallback**: In production (`NODE_ENV === 'production'`), missing secret throws `PRODUCTION_SECURITY_ERROR`.
- **No Weak Default**: If `QR_HMAC_SECRET` equals the known repository default string, it is rejected with `PRODUCTION_SECURITY_ERROR`.
- **No Client Exposure**: Inspected `dist/assets/*.js`. The secret does not appear in client bundles. No `VITE_` prefix is used.
- **Physical QR Compatibility**: The physical table QR codes encode only `tableShortCode` and `credentialId.rawSecret`. The HMAC secret is used solely to sign intermediate 5-minute proof tokens and derive deterministic session IDs. Setting or changing `QR_HMAC_SECRET` in production does not invalidate physical QR codes.

---

### 3.5 HIGH-03: Ambiguous Redis Timeouts and Typed Errors

#### Verification of Error Flow:
- In [src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts#L135-L137), aborts triggered by the 3000ms timeout throw `new RedisTimeoutError('...', true)`.
- `RedisTimeoutError` extends `RedisUnavailableError`.
- In [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L234-L240), `instanceof RedisUnavailableError` maps to HTTP error code `STORAGE_UNAVAILABLE`.
- Because the atomic claim `lm:proof_claim:<jti>` is recorded with `NX: true` prior to session persistence, an ambiguous timeout on the session write leaves the claim bound to `customer.id`.
- When the customer retries, the server identifies the existing claim, detects the absent session, writes the session, and successfully returns the session token without burning the proof token.

---

### 3.6 Distributed Rate Limiting Assessment

#### Implementation Details:
The rate-limiting mechanism in [src/server/http.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/http.ts#L169-L215) relies on in-memory `Map` instances passed as arguments:
- [api/dine-in/verify-qr.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/verify-qr.ts#L5): `const qrRateLimits = new Map<string, { count: number; resetAt: number }>();`
- [api/dine-in/customer-record.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/customer-record.ts#L14): `const authRateLimits = new Map<string, { count: number; resetAt: number }>();`
- [api/admin/qr/rotate.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/admin/qr/rotate.ts#L6): `const adminRateLimits = new Map<string, { count: number; resetAt: number }>();`

#### Serverless Instance Distribution Flaw:
- In Vercel serverless execution, each incoming request may spin up a new container or route to an existing warm container.
- Each container has an independent heap. Module-scoped `Map` objects are not shared across containers.
- An attacker issuing concurrent requests across multiple instances or cycling connections experiences independent rate limit counters.
- Container recycling / cold restarts immediately reset counter maps to empty.

#### Endpoint Protection Audit:

| API Endpoint | Rate Limiter Present? | Storage Mechanism | Serverless Resilient? |
| :--- | :--- | :--- | :--- |
| `POST /api/dine-in/verify-qr` | Yes (15 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `POST /api/dine-in/customer-record` | Yes (20 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `POST /api/admin/qr/rotate` | Yes (30 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `POST /api/admin/qr/revoke` | Yes (30 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `GET /api/admin/qr/tables` | Yes (30 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `GET /api/admin/qr/artwork` | Yes (30 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `POST /api/admin/qr/export-pdf` | Yes (30 / min) | In-memory `Map` | **No** (Bypassable across instances) |
| `POST /api/dine-in/create-session` | **NONE** | None | **No** (Completely unprotected) |
| `POST /api/dine-in/order` | **NONE** | None | **No** (Completely unprotected) |
| `GET /api/dine-in/session-status` | **NONE** | None | **No** (Polling hits Redis without limits) |
| `GET /api/dine-in/session` | **NONE** | None | **No** (Completely unprotected) |
| `GET /api/dine-in/products` | **NONE** | None | **No** (Completely unprotected) |
| `GET /api/dine-in/table-status` | **NONE** | None | **No** (Completely unprotected) |

#### Edge WAF Inspection:
Inspection of [vercel.json](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/vercel.json) reveals standard security headers and URL rewrites only. There is **zero Edge WAF, Edge Middleware, or rate-limiting configuration** in the repository. Statements in documentation referring to Edge WAF represent external architecture recommendations, not landed project configurations.

---

## 4. Live Integration Readiness & Precise Test Plan

### Technical Readiness Assessment:
- `UpstashRedisClient` implements the necessary command subset (`SET`, `GET`, `DEL`, `PING`, `LPUSH`, `LTRIM`, `PIPELINE`).
- However, [scripts/test_redis_storage_suite.mjs](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/scripts/test_redis_storage_suite.mjs#L72) hardcodes `new InMemoryRedisMock()` across all test groups. It cannot test a live Upstash endpoint without code changes to dynamically instantiate `UpstashRedisClient` when environment variables are supplied.
- In `UpstashRedisClient.pipeline` ([src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts#L215)), individual item errors within a pipeline array are returned as `{ error: ... }` rather than throwing, which should be hardened before production.

### Precise Test Plan for Controlled Live Testing:

The following 10 tests must be executed against a provisioned Upstash Redis instance before staging deployment:

| Test ID | Objective | Procedure | Success Criteria |
| :--- | :--- | :--- | :--- |
| **LIVE-01** | Redis Connectivity | Call `PING` on `UpstashRedisClient` with valid credentials | Resolves `'PONG'` within < 50ms |
| **LIVE-02** | TLS Enforcement | Attempt connection to `http://` Upstash endpoint in production mode | Throws `RedisUnavailableError` / halts connection |
| **LIVE-03** | Authentication Failure | Call `PING` with an invalid bearer token | Returns HTTP 401; throws `RedisError` with `REDIS_HTTP_ERROR` |
| **LIVE-04** | Atomic SET NX | Send two concurrent `SET lm:test_lock "val" NX` requests | Exactly one request returns `'OK'`; second returns `null` |
| **LIVE-05** | Volatile TTL Expiry | `SET lm:test_exp "val" EX 2`; poll after 2500ms | Returns `null` after TTL expiration |
| **LIVE-06** | Pipeline Atomic Batch | Send `[['LPUSH', 'lm:test_log', 'item1'], ['LTRIM', 'lm:test_log', 0, 0]]` | Executes in single HTTP request; list length equals 1 |
| **LIVE-07** | Concurrent Proof Consumption | 5 concurrent clients submit the same proof token with distinct customer IDs | Exactly 1 client receives session; 4 receive `403 PROOF_ALREADY_USED` |
| **LIVE-08** | Cross-Instance Sessions | Write session via Client Instance 1; validate session via Client Instance 2 | Client Instance 2 reads valid session and accurate remaining time |
| **LIVE-09** | Dynamic Credential Revocation | Revoke table credential via Instance 1; verify table scan on Instance 2 | Instance 2 rejects verification with `CREDENTIAL_REVOKED` |
| **LIVE-10** | Simulated Network Timeout Recovery | Abort socket during session write; re-submit identical proof from same customer | Claim is recognized; session is recovered and persisted |

---

## 5. Identified Bugs and Required Remediation Steps

Before Little Monkey Cafe Dining can be approved for live staging or production review, the following four code changes are required:

### Fix 1: Connect `api/dine-in/verify-qr.ts` to `StorageProvider`
- **Location**: [api/dine-in/verify-qr.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/verify-qr.ts#L35)
- **Problem**: Calls `verifyQrPayload` in `qrAuthStore.ts` which checks local disk rather than shared Redis.
- **Required Fix**: Update `verifyQrPayload` (or `verify-qr.ts`) to consult `storage.getActiveCredentialForTable` and `storage.getCredentialById`, ensuring dynamic credentials and revocations stored in Redis take effect immediately.

### Fix 2: Secure Cookie Flag in `api/dine-in/customer-record.ts`
- **Location**: [api/dine-in/customer-record.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/customer-record.ts#L110-L112)
- **Problem**: Hardcoded `Set-Cookie` string omits `; Secure`.
- **Required Fix**: Replace lines 110-112 with:
  ```typescript
  res.setHeader('Set-Cookie', [buildDiningSessionCookie(sessionResult.session.sessionId, maxAgeSec)]);
  ```

### Fix 3: Connect `getAdminTablesOverview` to Redis Dynamic State
- **Location**: [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts#L500-L502)
- **Problem**: `RedisStorageProvider.getAdminTablesOverview` returns static file records.
- **Required Fix**: Iterate over authoritative tables, check `lm:table_active:<tableNumber>` and `lm:cred_revoked:<id>`, and overlay Redis status onto the overview.

### Fix 4: Add Rate Limiting to Unprotected Mutation Routes
- **Location**: [api/dine-in/create-session.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/create-session.ts) and [api/dine-in/session-status.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/api/dine-in/session-status.ts)
- **Problem**: Completely lack rate limiting, exposing Upstash command quota to rapid depletion.
- **Required Fix**: Apply `checkRateLimit` to `create-session.ts` (e.g. 15 req/min per IP) and `session-status.ts` (e.g. 60 req/min per IP).

---

## 6. Audit Conclusion & Sign-Off

The Phase 1.4.2 remediation successfully resolved single-use proof token burning (CRIT-01) and enforced cryptographic secret safety (HIGH-02). However, because `POST /api/dine-in/verify-qr` remains disconnected from Redis storage (CRIT-02), and because session cookies emitted by `customer-record.ts` lack the `; Secure` attribute in production (HIGH-01), the system cannot safely execute in a serverless production environment.

**Verdict**: **NOT READY**
Re-audit required after applying Fixes 1 through 4 above.
