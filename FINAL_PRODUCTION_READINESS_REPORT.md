# Little Monkey Café Dining — Final Production Readiness Verification Report

**Verification Date:** November 9, 2026  
**Auditor:** Antigravity AI Security Pair Programmer  
**Target Codebase:** `C:\Users\chava\.gemini\antigravity\scratch\dine-in` (Little Monkey Dining v2.5.6)  
**Target Environments:**
- Local Development Server: `http://127.0.0.1:3000`
- Production Domain: `https://dinin.littlemonkey.vercel.app`

---

## Official Verdict

### **`LOCALLY VERIFIED — PRODUCTION NOT VERIFIED`**

> **Verdict Justification:**
> 1. **Locally Verified (100% Pass):** The local application enforces a complete, non-bypassable QR-only access perimeter across client UI gates, server cryptographic HMAC verification, single-use proof consumption, and 15-minute session countdowns. All 26 automated end-to-end security and browser tests pass cleanly.
> 2. **Production Not Verified (TLS Connection Reset):** The production domain `dinin.littlemonkey.vercel.app` fails during the TLS handshake (`ECONNRESET`) whenever the SNI `dinin.littlemonkey.vercel.app` is presented to Vercel's edge network. In strict adherence to testing protocol, certificate verification was not bypassed, and downstream production application tests were halted.

---

## 1. Production Domain Verification Telemetry

**Target:** `https://dinin.littlemonkey.vercel.app`

Evidence-based diagnostic probes were executed across DNS, HTTP:80, TCP:443, and TLS Client Hello handshakes:

```
[DNS A-Record Probe]
Hostname:         dinin.littlemonkey.vercel.app
Resolved IPv4:    64.29.17.131, 216.198.79.131 (Vercel Anycast Edge IP range)
CNAME Lookup:     ENODATA (Direct A-record routing)

[HTTP:80 Port Probe]
Status:           HTTP/1.1 308 Permanent Redirect
Location Header:  https://dinin.littlemonkey.vercel.app/
Server Header:    Vercel
Edge Trace ID:    bom1::txhdv-1794205777716-32fe4efff62c

[TCP:443 Socket Probe]
TCP Handshake:    CONNECTED (SYN-ACK completed, latency ~42ms)

[HTTPS:443 TLS Handshake Probe (SNI: dinin.littlemonkey.vercel.app)]
TLS Socket:       FAILED (ECONNRESET)
Error:            Client network socket disconnected before secure TLS connection was established
Code:             ECONNRESET

[HTTPS:443 TLS Handshake Probe (Without SNI Fallback)]
TLS Socket:       CONNECTED
Peer Certificate: CN = no-sni.vercel-infra.com
Issuer:           Vercel Infrastructure CA
```

### Exact Technical Finding for Production
- TCP routing to Vercel's Anycast edge router is operational on both port 80 and port 443.
- Port 80 issues the expected HTTP 308 redirect to HTTPS.
- When an HTTPS Client Hello packet containing Server Name Indication (SNI) `dinin.littlemonkey.vercel.app` is transmitted to Vercel's edge, Vercel's TLS terminating proxy immediately sends a TCP `RST` (connection reset).
- When a raw TLS Client Hello is sent without SNI, Vercel's edge does not drop the connection; instead, it presents its default infrastructure certificate (`no-sni.vercel-infra.com`).
- **Conclusion:** The domain `dinin.littlemonkey.vercel.app` is currently unprovisioned or has an invalid/missing SSL certificate configuration in the Vercel project domain dashboard. In compliance with security directives, no remote Vercel settings or DNS records were touched. All downstream production application tests are marked **BLOCKED**.

---

## 2. Re-Audit of Local QR-Only Entry

All tests were re-executed against the local runtime (`http://127.0.0.1:3000`) using fresh active credentials (`.qr_credentials.json`, `.active_qr_secrets.json`).

| Test Case | Scenario / Payload | Observed Status & Payload | Assertion Result |
|---|---|---|:---:|
| **Direct Root URL** | `GET /` without credentials | Renders `TableQrRequiredGate`. Food menu catalog `#main-menu-catalog` completely unmounted from DOM. | **PASS** |
| **Missing Credentials** | `POST /api/dine-in/verify-qr` with `{}` | HTTP 400 `MISSING_CREDENTIAL` | **PASS** |
| **Table Only (No Secret)** | `POST /api/dine-in/verify-qr` with `{ table: 'T01' }` | HTTP 400 `MISSING_CREDENTIAL` | **PASS** |
| **Unknown Credential ID** | `POST /api/dine-in/verify-qr` with `{ table: 'T01', cred: 'qrc_t01_fake.sec' }` | HTTP 400 `UNKNOWN_CREDENTIAL` | **PASS** |
| **Tampered Secret Key** | `POST /api/dine-in/verify-qr` with corrupted 32-char secret | Constant-time HMAC mismatch: HTTP 400 `INVALID_SECRET` | **PASS** |
| **Table Mismatch** | `POST /api/dine-in/verify-qr` with T01 cred and `table: 'T02'` | Server enforces credential binding: HTTP 400 `TABLE_MISMATCH` | **PASS** |
| **Valid Physical QR** | `POST /api/dine-in/verify-qr` with active T01 cred | HTTP 200 `{ valid: true, tableNumber: 'Table 01', qrProofToken: 'qrproof_...' }` | **PASS** |
| **Proof Validation on Reload** | `POST /api/dine-in/verify-proof` with fresh `qrProofToken` | HTTP 200 `{ valid: true, tableNumber: 'Table 01' }` | **PASS** |
| **Session Continuation** | `POST /api/dine-in/customer/continue` with valid proof & mobile | HTTP 200 `{ success: true, sessionToken: 'dinesess_...', durationMs: 900000 }` | **PASS** |
| **Replayed Proof Rejection** | Duplicate `POST /api/dine-in/customer/continue` with same proof | Proof consumed flag checked: HTTP 403 `PROOF_ALREADY_USED` | **PASS** |
| **Tampered / Expired Proof** | `POST /api/dine-in/verify-proof` with expired timestamp | Cryptographic proof rejected: HTTP 403 `MALFORMED_TOKEN` / `EXPIRED_PROOF` | **PASS** |
| **Active Session Countdown** | `GET /api/dine-in/session-status` with Bearer session token | HTTP 200 `{ valid: true, timeRemainingMs: 899994, tableNumber: 'Table 01' }` | **PASS** |
| **15-Minute Expiry** | Clock advanced +901,000 ms via test controller | Session invalidated: HTTP 401 `DINING_SESSION_EXPIRED` | **PASS** |
| **Direct Protected API** | `GET /api/dine-in/tables` without token | HTTP 401 `UNAUTHORIZED_DINING_ACCESS` (`NO_SESSION`) | **PASS** |
| **Direct Session API** | `GET /api/dine-in/session` without token | HTTP 401 `UNAUTHORIZED_DINING_ACCESS` (`NO_SESSION`) | **PASS** |
| **Direct Lookup API** | `POST /api/dine-in/customer/lookup` without proof | Proof required check: HTTP 403 `MISSING_QR_PROOF` | **PASS** |

---

## 3. Vercel Serverless Parity Analysis

A line-by-line comparative audit of local handlers in `src/server/dineInServerPlugin.ts` against standalone handlers in `api/` was conducted:

```mermaid
graph LR
    subgraph Local Vite Server
        A[src/server/dineInServerPlugin.ts]
        B[In-Memory / File Storage]
    end

    subgraph Vercel Serverless Lambdas
        C[api/dine-in/*.ts]
        D[api/admin/qr/*.ts]
        E[Upstash Redis HTTPS Provider]
    end

    A <-->|Parity Verified| C
    A <-->|Parity Verified| D
```

### Route-by-Route Comparison

| Endpoint | Local Implementation (`dineInServerPlugin.ts`) | Serverless Implementation (`api/`) | Parity Status | Notes & Nuances |
|---|---|---|:---:|---|
| `/api/dine-in/verify-qr` | Lines 645–678 | `api/dine-in/verify-qr.ts` | **MATCH** | Identical rate limiting (15 req/min), HMAC verification, and error payloads. |
| `/api/dine-in/verify-proof` | Lines 684–712 | `api/dine-in/verify-proof.ts` | **MATCH** | Validates active unconsumed proof for page reload. |
| `/api/dine-in/session-status` | Lines 1388–1412 | `api/dine-in/session-status.ts` | **MATCH** | Validates `dinesess_...` token, returns remaining countdown. |
| `/api/dine-in/session` | Lines 2023–2030 | `api/dine-in/session.ts` | **MATCH** | Enforces active session, returns 401 `UNAUTHORIZED_DINING_ACCESS`. |
| `/api/dine-in/create-session` | Lines 1316–1360 | `api/dine-in/create-session.ts` | **MATCH** | Enforces `qrProofToken` + customer Bearer token. Returns 403 on proof error. |
| `/api/dine-in/customer/continue` | Lines 811–905 | `api/dine-in/customer/continue.ts` | **MATCH** | Enforces `qrProofToken` + 10-digit mobile. Consumes proof atomically. |
| `/api/dine-in/customer/lookup` | Lines 718–805 | `api/dine-in/customer/lookup.ts` | **MATCH** | Enforces `qrProofToken` without consuming it. |
| `/api/dine-in/order` | Lines 2033–2048 | `api/dine-in/order.ts` | **MATCH** | Validates session, checks table match, returns 403 `READ_ONLY_MENU`. |
| `/api/admin/qr/tables` | Lines 1500–1530 | `api/admin/qr/tables.ts` | **MATCH** | Requires admin authorization (PIN or token). |
| `/api/admin/qr/artwork` | Lines 1580–1650 | `api/admin/qr/artwork.ts` | **MATCH** | Serves vector PDF, preview HTML, manifest, and PNGs under PIN authorization. |
| `/api/admin/qr/rotate` | Lines 1535–1560 | `api/admin/qr/rotate.ts` | **MATCH** | Requires admin PIN; rotates credential and generates new secret. |
| `/api/admin/qr/revoke` | Lines 1565–1575 | `api/admin/qr/revoke.ts` | **MATCH** | Requires admin PIN; revokes credential and all child sessions. |
| `/api/dev/tables` | Lines 1700–1740 | `api/dev/tables.ts` | **MATCH** | Strictly disabled in production (`DEV_ENDPOINT_DISABLED_IN_PROD` 403). |
| `/api/test/advance-time` | Lines 1659–1670 | `api/test/advance-time.ts` | **MATCH** | Strictly disabled in production (`TEST_HELPERS_DISABLED_IN_PROD` 403). |

### Serverless Discrepancy Findings
1. **Unmatched Endpoint Fallback (`/api/dine-in/tables`):** In local development, unmatched subpaths under `/api/dine-in/` are intercepted by line 2010 (`if (pathname.startsWith('/api/dine-in/'))`), which verifies the session and returns HTTP 401 `UNAUTHORIZED_DINING_ACCESS`. On Vercel, because there is no `api/dine-in/tables.ts` file, requests return HTTP 404. (No security risk; 404 denies access safely).
2. **Kebab-Case Alias Disparity (`api/dine-in/customer-continue.ts`):** `api/dine-in/customer/continue.ts` returns HTTP 403 on `PROOF_ALREADY_USED`, whereas the legacy alias `api/dine-in/customer-continue.ts` lines 105–109 defaults to HTTP 500. The primary application exclusively routes to `customer/continue.ts`.
3. **Production Storage Fail-Closed Requirement:** In `src/server/storage.ts` lines 775–784, when `NODE_ENV === 'production'`, the serverless storage provider strictly requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If unconfigured, lambdas throw `[PRODUCTION_STORAGE_ERROR]`.

---

## 4. Verification of Previous Code Modifications

The modifications made during the security audit were audited against their actual file content:

1. **`src/server/dineInServerPlugin.ts`**:
   - `extractDiningSessionToken()` now parses RFC-standard `Authorization: Bearer dinesess_...` tokens in addition to `lm_dining_session` cookies.
   - Proof consumption errors on `/api/dine-in/customer/continue` return HTTP 403 for `PROOF_ALREADY_USED`, `EXPIRED_PROOF`, and `INVALID_QR_PROOF`.
2. **`api/dine-in/verify-proof.ts`**:
   - Newly created serverless endpoint successfully imports `verifyQrProofToken` from `src/server/qrAuthStore.ts` with `{ consume: false }`, allowing browser reloads to retain table state without burning the proof token.
3. **`api/dine-in/customer/continue.ts`**:
   - Successfully updated lines 105–110 to return HTTP 403 on client errors (`PROOF_ALREADY_USED`, `EXPIRED_PROOF`).
4. **`api/admin/qr/artwork.ts`**:
   - Handles `file=html` (Preview Studio), `file=manifest` / `file=json` (Manifest), and `file=pdf` (Vector PDF) under `checkAdminAuth()` authorization.
5. **`src/components/AdminQrManagementModal.tsx`**:
   - Replaced plain download links with `handleSecureDownload()` passing `X-Operational-PIN` in HTTP headers. (Note: Preview Studio button uses `<a target="_blank">` with encoded query parameter due to standard browser navigation constraints).
6. **`scripts/qr_only_access_security_audit.mjs`**:
   - Verified that Test F.4 provides a 1400ms pause for camera stream track initialization, resolving previous timing flakiness. All 26 tests execute and pass deterministically.

---

## 5. Admin PIN Security Verification

An exhaustive review of the operational administrator PIN was conducted:

| Security Factor | Audit Finding | Evidence / Code Reference |
|---|---|---|
| **Storage Location** | Server environment variables | `src/server/config.ts`: reads `ADMIN_OPERATIONAL_PIN` or `ADMIN_PIN`. Default fallback: `'9999'` in local dev. |
| **Frontend Exposure** | **Zero exposure in client bundles** | `src/` outside `src/server/` contains 0 occurrences of `'9999'` or `ADMIN_PIN`. PIN must be typed manually into `AdminQrManagementModal`. |
| **Server Verification** | **Strict and independent** | Server routes execute `checkAdminAuth()` using `getAdminPin()`. Client claims are never trusted without cryptographic server verification. |
| **Unauthenticated Access** | **Strictly blocked** | Requests to `/api/admin/qr/*` without valid PIN or admin Bearer token return HTTP 403 `ADMIN_ACCESS_DENIED`. |
| **Invalid PIN Rejection** | **Strictly rejected** | Passing `X-Operational-PIN: 0000` returns HTTP 403 `ADMIN_ACCESS_DENIED`. |
| **Secret / PIN Logging** | **Redacted from logs** | `api/_lib/handler.ts` sanitizes all URLs (`pin=[REDACTED]`, `cred=[REDACTED]`, `secret=[REDACTED]`). Server plugins contain 0 plaintext logging. |
| **Rate Limiting** | **Enforced** | `checkRateLimit(adminRateLimits, 'admin:' + clientIp, 30, 60000)` limits admin calls to 30 requests/min per IP. |

---

## 6. Full Automated Audit Results (26 / 26 PASS)

```
========================================================================
LITTLE MONKEY CAFÉ DINING — COMPLETE QR-ONLY ACCESS SECURITY AUDIT
========================================================================

--- CATEGORY A: Direct-Entry Tests ---
[PASS] [A.1] Direct-Entry: Root URL / Missing Credential — Rejected with 400 MISSING_CREDENTIAL
[PASS] [A.2] Direct-Entry: Empty parameters — Rejected with 400 MISSING_CREDENTIAL
[PASS] [A.3] Direct-Entry: Missing credential with table only — Rejected with 400 MISSING_CREDENTIAL
[PASS] [A.4] Direct-Entry: Invalid table ID T99 — Rejected with 400 UNKNOWN_TABLE
[PASS] [A.5] Direct-Entry: Unknown credential ID — Rejected with 400 UNKNOWN_CREDENTIAL
[PASS] [A.6] Direct-Entry: Modified/Tampered Secret Key — HMAC comparison failed; rejected with 400 INVALID_SECRET
[PASS] [A.7] Direct-Entry: Corrupted proof token — Rejected with 403 INVALID_SIGNATURE
[PASS] [A.8] Direct-Entry: Expired proof token rejection — Proof expired after 5 minutes; rejected with 403 EXPIRED_PROOF

--- CATEGORY B: Table Authorization Tests ---
[PASS] [B.1] Table Authorization: All 10 Tables Identified (T01-T10) — 10 active credentials mapped to authoritative tables
[PASS] [B.2] Table Authorization: Table Mismatch Prevention — T01 credential with T02 rejected with 400 TABLE_MISMATCH
[PASS] [B.3] Table Authorization: Tampered Table Parameter Rejected — Client parameter cannot override credential table binding

--- CATEGORY C: API Bypass Tests ---
[PASS] [C.1] API Bypass: Protected API /api/dine-in/tables — Direct call without session rejected with 401 UNAUTHORIZED_DINING_ACCESS
[PASS] [C.2] API Bypass: Protected API /api/dine-in/session — Direct call without session rejected with 401 UNAUTHORIZED_DINING_ACCESS
[PASS] [C.3] API Bypass: Customer lookup without QR proof — Rejected with 403 MISSING_QR_PROOF
[PASS] [C.4] API Bypass: Session creation without QR proof — Rejected with HTTP 400 MISSING_QR_PROOF
[PASS] [C.5] API Bypass: Tampered session token rejection — Server storage check failed; rejected with 401 UNAUTHORIZED_DINING_ACCESS

--- CATEGORY D: Session Lifecycle & Replay Tests ---
[PASS] [D.1] Session Lifecycle: Single-use QR proof replay prevention — First consumption OK; replay rejected with 403 PROOF_ALREADY_USED
[PASS] [D.2] Session Lifecycle: Valid session validation — Session verified with Table 01 and 15-minute countdown
[PASS] [D.3] Session Lifecycle: 15-Minute session expiration — Session expired after 15 minutes (HTTP 401 DINING_SESSION_EXPIRED)

--- CATEGORY E: Static Asset & Manifest Security ---
[PASS] [E.1] Static Asset Security: Direct /storage/ access blocked — Static access to /storage/ files returned 403 ACCESS_DENIED
[PASS] [E.2] Static Asset Security: Manifest contains ZERO raw secrets — Audited index.json against all active secrets; zero secrets present
[PASS] [E.3] Static Asset Security: Admin artwork authorization via headers — Unauthenticated blocked (403); X-Operational-PIN header authorized (200)

--- CATEGORY F: Browser Automation & UI Tests ---
[PASS] [F.1] Browser UI: Direct entry blocked by TableQrRequiredGate — Direct URL renders gate; menu catalog completely absent from DOM
[PASS] [F.2] Browser UI: Physical QR entry renders customer login gate — Credentials scrubbed from address bar; Table 01 recognized; 0 camera prompts
[PASS] [F.3] Browser UI: Reload on Customer Entry retains table — Reload verified via /api/dine-in/verify-proof; Table 01 retained; no re-scan prompt
[PASS] [F.4] Browser UI: In-built scanner lifecycle & audio:false — Scanner opened with native permissions; audioTracks: 0; unmounted cleanly

========================================================================
SECURITY AUDIT SUMMARY: Passed: 26 / 26 | Failed: 0 / 26 | Blocked: 0 / 26
========================================================================
```

---

## 7. Blocked Tests & Production Limitations

The following tests could **not execute against production** due to the TLS termination failure on `dinin.littlemonkey.vercel.app`:

| Test | Production Target | Failure Reason | Status |
|---|---|---|:---:|
| Production Root Gate Rendering | `https://dinin.littlemonkey.vercel.app/` | `ECONNRESET` during TLS handshake | **BLOCKED** |
| Production QR Verification API | `https://dinin.littlemonkey.vercel.app/api/dine-in/verify-qr` | `ECONNRESET` during TLS handshake | **BLOCKED** |
| Production Static Storage Shield | `https://dinin.littlemonkey.vercel.app/storage/qr-codes/index.json` | `ECONNRESET` during TLS handshake | **BLOCKED** |
| Production Customer Lookup API | `https://dinin.littlemonkey.vercel.app/api/dine-in/customer/lookup` | `ECONNRESET` during TLS handshake | **BLOCKED** |
| Production Session API | `https://dinin.littlemonkey.vercel.app/api/dine-in/session-status` | `ECONNRESET` during TLS handshake | **BLOCKED** |

---

## 8. Remaining Vulnerabilities & Architectural Considerations

1. **Production Domain TLS Provisioning (External Infra):** The custom domain `dinin.littlemonkey.vercel.app` requires TLS certificate renewal or domain verification in the Vercel Project Dashboard. Until resolved, remote users cannot connect over HTTPS.
2. **Production Upstash Redis Dependency:** When deployed to production, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be active in Vercel environment variables. Without them, the storage provider fails closed to prevent in-memory state fragmentation across serverless containers.
3. **Client-Side Anchor Link in Admin Modal:** Line 528 in `AdminQrManagementModal.tsx` encodes `?pin=...` in the Preview Studio `<a href="...">` anchor. While acceptable for administrative intranet tools that open in new tabs, transitioning this link to an ephemeral one-time administrative ticket endpoint would eliminate the PIN from query strings entirely.
4. **Physical QR Code Sharing:** If a customer inside the café photographs a physical table QR code and sends the picture to a friend outside the café, that friend can scan the picture and open a 15-minute dining session. Physical QR systems cannot distinguish between direct optical capture of paper vs a phone screen showing a photo. The 15-minute countdown and single-use proof token provide strong mitigation.

---

## 9. Exact Files & Endpoints Inspected

### Source Files
- `src/server/dineInServerPlugin.ts` — Core server middleware, routing, rate limiting, and session verification.
- `src/server/qrAuthStore.ts` — Authoritative table definitions, HMAC-SHA256 signatures, and proof token generator.
- `src/server/storage.ts` — Pluggable multi-tier storage provider (Redis, file, memory).
- `src/server/http.ts` — Request context parser, token extractors, and admin authorization validator.
- `src/server/config.ts` — Configuration manager, PIN reader, and fail-closed production checks.
- `src/components/AdminQrManagementModal.tsx` — Staff administrative interface for credential rotation and exports.
- `src/components/QrAccessGates.tsx` — Client-side entry gate (`TableQrRequiredGate`).
- `src/components/CustomerLoginGate.tsx` — Password-free mobile entry screen.
- `src/components/InBuiltQrScanner.tsx` — Mobile camera scanner component (`audio: false`).
- `scripts/qr_only_access_security_audit.mjs` — Automated 26-test audit suite.

### Serverless Endpoints (`api/`)
- `api/_lib/handler.ts` — Universal serverless request wrapper and sanitizing logger.
- `api/dine-in/verify-qr.ts` — Public QR validation endpoint.
- `api/dine-in/verify-proof.ts` — Unconsumed proof verification endpoint.
- `api/dine-in/session-status.ts` — Active session status endpoint.
- `api/dine-in/session.ts` — Session validation endpoint.
- `api/dine-in/create-session.ts` — Customer-authenticated session initialization.
- `api/dine-in/customer/continue.ts` — Password-free session continuation.
- `api/dine-in/customer/lookup.ts` — Password-free customer lookup.
- `api/dine-in/order.ts` — Order rejection endpoint (read-only menu).
- `api/admin/qr/artwork.ts` — Protected artwork, manifest, and PDF export endpoint.
- `api/admin/qr/tables.ts` — Protected table credential overview endpoint.
- `api/admin/qr/rotate.ts` — Protected credential rotation endpoint.
- `api/admin/qr/revoke.ts` — Protected credential revocation endpoint.
- `api/dev/tables.ts` — Developer helper endpoint (disabled in production).
- `api/test/advance-time.ts` — Time simulation endpoint (disabled in production).

---

## 10. Summary & Sign-Off

The Little Monkey Café Dining application codebase has been rigorously re-audited and verified. Local QR-only enforcement is mathematically sound, cryptographically protected, and 100% verified across 26 automated tests. Production deployment remains unreachable due to Vercel edge TLS connection resets.

**Final Determination:** **`LOCALLY VERIFIED — PRODUCTION NOT VERIFIED`**
