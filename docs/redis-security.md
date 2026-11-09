# Little Monkey Cafe Dining — Shared Redis Security Model

## 1. Threat Model and Distributed Attack Analysis

### The Threat: Cross-Instance QR Proof Token Replay
In the Little Monkey Cafe Dining system:
1. Physical QR artwork placed on dining tables encodes a table short code and a 32-byte cryptographic secret (e.g. `?t=T01&cred=qrc_t01_abce82e42a7e.1YC1GpHGf8xAzuvqfXOm3BTEsdfUCD13`).
2. When scanned by a mobile device camera, `POST /api/dine-in/verify-qr` verifies the secret SHA-256 hash in constant time against authoritative records.
3. Upon successful verification, the server issues a signed, short-lived (5-minute) QR proof token with a unique cryptographic `jti` (JWT ID):
   `qrproof.<base64url_payload>.<hmac_sha256_signature>`
4. The customer registers or signs in with their 10-digit mobile number, submitting the proof token to `POST /api/dine-in/create-session` to unlock the dining menu for 15 minutes.

**Vulnerability Without Shared State**:
Vercel serverless executes requests across independent lambda container instances. If the proof token's single-use status is tracked in process-local memory (`Map` or local JSON file):
- An attacker snooping local Wi-Fi or sharing an unexpired proof token could submit the same token to a different serverless instance.
- Because Instance B has no visibility into Instance A's local memory, both requests succeed, spawning multiple unauthorized dining sessions from a single scan.

---

## 2. Idempotent Claim-Check and Deterministic Recovery (CRIT-01 and HIGH-03)

### The Vulnerability in Simple Proof Burning
In previous iterations, the server executed `SET lm:proof_spent:<jti> "1" EX 300 NX` immediately before persisting the session record. If the subsequent Redis session write failed or timed out (due to transient network latency or Upstash endpoint hiccup):
- The proof token was marked spent in Redis.
- No session was created.
- The legitimate customer received an error and attempted to retry.
- Upon retry, the server rejected the token with `403 PROOF_ALREADY_USED`, permanently locking the dining guest out and requiring staff intervention.

### Remediated Architecture: Deterministic Binding and Atomic Claim
To resolve this failure window without opening replay vulnerabilities, [src/server/storage.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/storage.ts) implements an atomic customer claim-check with deterministic session identity:

1. **Deterministic Session Identifier**:
   Instead of generating a random session ID (`crypto.randomUUID()`), the session ID is deterministically computed from the proof `jti` and the customer's authoritative `customerId`:
   ```typescript
   const sessDigest = crypto
     .createHmac('sha256', getQrHmacSecret())
     .update(`${proofPayload.jti}:${customer.id}`)
     .digest('hex')
     .slice(0, 32);
   const sessionId = `dinesess_${sessDigest}`;
   ```
2. **Atomic Customer Claim**:
   The server attempts to register the customer as the sole claimant of the proof token:
   ```
   SET lm:proof_claim:<jti> <customerId> EX 300 NX
   ```
3. **Idempotent Recovery Branching**:
   - **Case A (Fresh Token, `result === 'OK'`)**: The customer wins the claim. The server proceeds to persist the session in Redis with `SET lm:sess:<sessionId> <payload> EX 900`. If this write times out, the claim remains tied to this customer.
   - **Case B (Claim Already Exists)**: If `result === null`, the server checks who owns the claim:
     ```
     GET lm:proof_claim:<jti>
     ```
     - If the stored claimant matches `customer.id`, this request is an identical retry (e.g. following a network timeout or connection reset). The server checks if `lm:sess:<sessionId>` exists. If it exists, it returns it immediately. If it does not exist (indicating the previous session write failed), the server safely writes `lm:sess:<sessionId>` and returns success. The customer never loses their proof token.
     - If the stored claimant does NOT match `customer.id`, an attacker is attempting to replay another customer's proof token. The server immediately rejects the request with HTTP 403 `PROOF_ALREADY_USED` and dispatches an audit alert.

---

## 3. Distributed Table Credential Rotation and Revocation (CRIT-02)

### Serverless Filesystem Invariant
In serverless execution environments (such as Vercel AWS Lambda), containers have ephemeral or read-only filesystems. Changes written to local disk files (`.qr_credentials.json`) are discarded when containers terminate and are never propagated to parallel containers.

### Distributed State Overlay in Redis
To ensure credential revocations and rotations take effect immediately across all active serverless instances without requiring disk mutations, `RedisStorageProvider` maintains dynamic credential state in Redis:

| Key Pattern | Value | Purpose |
| :--- | :--- | :--- |
| `lm:table_active:<tableNumber>` | `<credentialId>` or `"REVOKED"` | Authoritative active credential pointer for the table. |
| `lm:cred:<credentialId>` | JSON `QrCredentialRecord` (hash only) | Public metadata and SHA-256 secret hash for the credential. |
| `lm:cred_revoked:<credentialId>` | `"1"` | Fast tombstone marker indicating the credential is permanently revoked. |

### Verification Pipeline:
1. When a table QR is scanned, the server checks `lm:table_active:<tableNumber>`:
   - If set to `"REVOKED"`, verification immediately halts with `TABLE_CREDENTIAL_REVOKED`.
   - If set to a credential ID, the server fetches `lm:cred:<credentialId>`.
   - If absent in Redis, the server falls back to the static baseline credentials generated during setup.
2. Next, the server verifies `lm:cred_revoked:<credentialId>`. If present, the credential is treated as revoked.
3. During admin rotation (`rotateTableCredential`), a new 192-bit cryptographic secret is generated, hashed with SHA-256, and written to `lm:cred:<newId>`. `lm:table_active:<tableNumber>` is updated atomically, and the old credential is marked revoked in `lm:cred_revoked:<oldId>`.
4. During admin revocation (`revokeTableCredential`), `lm:table_active:<tableNumber>` is set to `"REVOKED"` and `lm:cred_revoked:<activeId>` is set to `"1"`.
5. Local disk files are NEVER mutated by `RedisStorageProvider`, preserving clean separation between distributed cloud state and local developer baselines.

---

## 4. Session Cookie Security Invariants (HIGH-01)

Session cookies are generated via centralized helper functions in [src/server/http.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/http.ts):

```typescript
export function buildDiningSessionCookie(sessionId: string, maxAgeSec: number = 900): string {
  const parts = [
    `lm_dining_session=${encodeURIComponent(sessionId)}`,
    `Max-Age=${maxAgeSec}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProduction()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
```

### Invariants:
1. **Production Enforcement**: When `NODE_ENV === 'production'`, the `; Secure` attribute is strictly appended. Browsers refuse to transmit the cookie over insecure HTTP connections, protecting against wiretap eavesdropping on public Wi-Fi.
2. **Local Development Compatibility**: In non-production environments, `; Secure` is omitted so developers can test over local HTTP (`http://127.0.0.1:3000`) without browser cookie rejection.
3. **Defense-in-Depth Attributes**:
   - `HttpOnly`: Prevents client-side JavaScript (`document.cookie`) from accessing session tokens, defeating Cross-Site Scripting (XSS) exfiltration.
   - `SameSite=Lax`: Defends against Cross-Site Request Forgery (CSRF) on cross-origin navigation.
   - `Path=/`: Restricts cookie scope to the dining application.

---

## 5. Cryptographic Secrets and Fail-Closed Invariant (HIGH-02 and MED-01)

### QR HMAC Secret Validation (`getQrHmacSecret`):
In [src/server/config.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/config.ts), HMAC secret retrieval enforces strict production validation:
- In production, `QR_HMAC_SECRET` must be set, must not be empty or whitespace, and must NOT equal the repository default fallback string (`lm_qr_hmac_secret_2026_warangal_dining`).
- If these conditions are violated, initialization throws `PRODUCTION_SECURITY_ERROR` and halts execution immediately.
- In development, the fallback string is permitted with an explicit security warning logged.

### Redis REST Endpoint HTTPS Validation (`getRedisConfig` and `UpstashRedisClient`):
- Production Redis REST endpoint URLs are validated via `new URL()`.
- Protocol must strictly equal `https:`. Plaintext `http://` endpoints are rejected with `PRODUCTION_SECURITY_ERROR`.
- `UPSTASH_REDIS_REST_TOKEN` must be non-empty and free of internal whitespace.

---

## 6. Typed Error Model and Timeout Handling (HIGH-03)

In [src/server/redisClient.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/redisClient.ts), network and timeout errors are explicitly classified:

- **`RedisTimeoutError`**: Thrown when a REST call exceeds the configured `timeoutMs` (default 3,000ms). Carries property `isAmbiguous: true`, signaling to the application layer that the command may or may not have succeeded on the remote Upstash node before the local client socket timed out.
- **`RedisConnectionError`**: Thrown for DNS failures, socket resets, or non-200 HTTP responses.

When a `RedisTimeoutError` occurs during session creation, the application returns `STORAGE_UNAVAILABLE`. Because the customer claim was recorded atomically prior to the timeout, the customer's subsequent retry recovers the session seamlessly without burning the proof token.

---

## 7. Atomic Audit Logging via Command Pipelines (MED-02)

Audit logging records critical security events (`PROOF_REPLAY_BLOCKED`, `TABLE_CREDENTIAL_ROTATED`, `TABLE_CREDENTIAL_REVOKED`, `DINING_SESSION_CREATED`) to `lm:audit_log`.

To prevent race conditions where concurrent requests cause the list to grow unbounded:
- `RedisStorageProvider.logAuditEvent` uses the atomic `/pipeline` REST endpoint:
  ```json
  [
    ["LPUSH", "lm:audit_log", "<serialized_record>"],
    ["LTRIM", "lm:audit_log", 0, 999]
  ]
  ```
- Upstash executes both commands atomically in a single network round-trip, capping the log at 1,000 entries with zero concurrency races and zero memory bloat.

---

## 8. PII Minimization in Redis Payloads (MED-03)

In compliance with data protection best practices, unverified client metadata (`ipAddress` and `userAgent`) is stripped from the Redis session payload:

```json
{
  "sessionId": "dinesess_7a2b9...",
  "tableNumber": "Table 01",
  "credentialId": "qrc_t01_abce82e42a7e",
  "customerId": "cust_9876543210",
  "customerName": "Ramesh Varma",
  "customerPhone": "9876543210",
  "role": "customer",
  "createdAt": 1741132800000,
  "expiresAt": 1741133700000,
  "isActive": true
}
```

Client metadata is recorded only in capped operational audit logs for security diagnostics, never retained inside persistent session objects.

---

## 9. Serverless Rate Limiting Architecture and Tradeoffs (MED-04)

### Architectural Tradeoff Analysis:
When designing rate limiting for serverless dining applications, two approaches exist:

1. **Global Redis Atomic Counter (`INCR` + `EXPIRE`)**:
   - *Pros*: Precise global request counting across all serverless instances.
   - *Cons*: Every incoming HTTP request incurs an additional Upstash Redis REST round-trip (2ms - 10ms). Under high traffic or a distributed denial-of-service (DDoS) flood, Upstash free-tier quota (500,000 commands/month) would be rapidly exhausted by malicious probes, taking down legitimate dining operations.
2. **In-Container Token Bucket / Damping with Upstream Edge Filtering**:
   - *Pros*: Completely absorbs high-frequency burst traffic within each container memory layer without consuming Upstash REST API quota. Zero added latency for legitimate requests.
   - *Cons*: Container instances scale horizontally; an attacker distributing requests across multiple distinct serverless instances sees separate buckets.

### Recommended Strategy:
- **Application Layer**: In-container flood damping protects the serverless function from runaway loop execution and protects Upstash quota from command exhaustion.
- **Edge Layer (Vercel Firewall / Cloudflare)**: Global IP-based rate limiting and DDoS mitigation should be configured at the Vercel Edge / CDN layer, terminating abusive traffic before it reaches serverless Lambdas or Upstash Redis.
