# Little Monkey Café Dining — Google Integration Security Review & Threat Model

> **Review Type:** Pre-Implementation Architectural & Security Design Review  
> **Status:** Phase B Design Review (Endpoint and Spreadsheet Not Yet Deployed)  
> **Scope:** Little Monkey Café Dining (`C:\Users\chava\.gemini\antigravity\scratch\dine-in`)

---

## 1. Executive Summary & Distinction of Findings

To ensure transparent security documentation, this review explicitly separates verified implementation facts from proposed designs:

- **Verified Implementation Findings:**
  - The dining application enforces physical table presence via server-side constant-time cryptographic QR verification (`verifyQrPayload` in `src/server/qrAuthStore.ts`).
  - No customer cart, checkout, payment, or order submission endpoints are active in the customer-facing interface.
  - The local Vite server (`src/server/dineInServerPlugin.ts`) enforces IP-based sliding window rate limits on all incoming `/api/*` routes.
  - Customer passwords, OTPs, or user accounts are completely omitted from the proposed Google Sheets design.
- **Proposed Security Controls:**
  - Mandatory fail-closed HMAC-SHA256 request signing using a high-entropy shared secret (`SHARED_API_KEY`) stored in Apps Script Script Properties.
  - ISO 8601 timestamp validation within a 5-minute (300,000 ms) window to prevent stale or delayed requests.
  - Nonce replay protection via Apps Script `CacheService` with a 10-minute cache TTL.
  - Pre-lock authentication and validation: rejection of unauthorized, replayed, or malformed requests occurs prior to acquiring `LockService.getScriptLock()`, preventing lock exhaustion attacks.
  - Constant-time signature verification (`constantTimeCompare`) preventing timing side-channel attacks.
  - Google Apps Script `LockService.getScriptLock()` for concurrency serialization.
  - Worksheet header verification (`customer_id, name, mobile_number, created_at, updated_at`) before processing.
  - Literal quote prefixing (`'`) to neutralize spreadsheet formula injection.
  - Minimal health-check (`doGet`) returning only service name and timestamp with zero configuration disclosure.
  - Backend relay proxy pattern to shield the Google Apps Script endpoint behind physical table QR verification.
- **Assumptions:**
  - The owner will create the Google Spreadsheet within a private Google account and maintain `Restricted` sharing permissions.
  - The Google Apps Script Web App will be executed under the owner's identity (`Execute as: Me`).
  - The owner will configure matching `SHARED_API_KEY` in Apps Script Script Properties and `GOOGLE_SHEETS_API_KEY` on the Dining server.
- **Unresolved Issues & Residual Risks:**
  - If the Web App URL is leaked to third parties, attackers cannot forge requests without the server-side `SHARED_API_KEY`. Replay attacks are also prevented by nonce caching and the 5-minute timestamp window.
  - Google Sheets API quotas (300 requests/min per project) could throttle peak café turnover during promotional surges.
- **Tests Actually Executed:**
  - Syntactic validation of formula escaping and regex normalization patterns in isolated Node.js test scripts.
  - Automated security verification suite (`scripts/verify_google_apps_script_security.mjs`) testing all 10 security scenarios.
  - Live external tests against Google Sheets have **not** been executed because the spreadsheet is not yet created.

---

## 2. Comprehensive Security Questions & Analysis

### Q1: Can an unauthenticated person create arbitrary customer records?
- **Analysis:**
  - Direct calls to the Google Apps Script Web App from unauthorized third parties are blocked by mandatory HMAC-SHA256 request signing.
  - **Fail-Closed Protection:** If `SHARED_API_KEY` is missing in Script Properties, `Code.gs` immediately rejects all requests with `SERVER_MISCONFIGURED`.
  - **Replay Protection:** Every request must include a fresh ISO 8601 timestamp within a 5-minute window and a unique nonce. Reused nonces are rejected with `DUPLICATE_NONCE`.
  - **Backend Relay Proxy:** Dining clients cannot call Apps Script directly. They submit customer data to `/api/dine-in/customer-record`, which requires physical table QR proof (`qrProofToken`). Only validated backend requests are signed and forwarded to Apps Script.

### Q2: Can someone retrieve existing customer records?
- **Analysis:**
  - **Verified Implementation:** The Google Apps Script `doGet()` endpoint implements a minimal health check only (`{ status: "ONLINE", timestamp: "..." }`) and contains zero lookup or row-reading logic.
  - In `doPost()`, lookup results are strictly restricted to the single matching record for the submitted mobile number. There is no query parameter, endpoint, or function that lists, dumps, or enumerates all spreadsheet rows.

### Q3: Can someone enumerate customer mobile numbers?
- **Analysis:**
  - If an attacker could freely query phone numbers, they could determine who visits the café.
  - **Proposed Defense:**
    1. Requests must pass table QR gating (`qrProofToken`).
    2. The backend enforces strict IP rate limiting (15 submissions/min per IP).
    3. The response returns identical minimal customer structures for both existing and new registrations, preventing information leakage.

### Q4: Can someone repeatedly submit requests to create excessive records?
- **Analysis:**
  - **Proposed Defense:**
    1. The deduplication logic in `Code.gs` searches column C before appending. If the mobile number already exists, it updates `updated_at` (or preserves the record) without creating an additional row.
    2. Rapid repeated clicks from the same device are mitigated by disabling the submit button during in-flight requests and backend sliding-window rate limiters.

### Q5: Can an attacker exploit formula injection?
- **Analysis:**
  - If a diner enters `=IMPORTXML(...)`, `=HYPERLINK(...)`, or `+cmd|' /C ...'!A0` in the name field, spreadsheet software might execute formulas upon opening.
  - **Proposed Defense:**
    `Code.gs` inspects all string inputs. Any string beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically prefixed with a single quote (`'`):
    ```javascript
    function sanitizeFormula(val) {
      if (typeof val !== 'string') return val;
      if (/^[\=\+\-\@\t\r]/.test(val)) {
        return "'" + val;
      }
      return val;
    }
    ```
    This forces Google Sheets to store and display the value strictly as literal text.

### Q6: Can concurrent requests create duplicate records?
- **Analysis:**
  - If two requests for the same mobile number execute simultaneously, both could read the sheet before either appends a row.
  - **Proposed Defense:**
    `Code.gs` uses `LockService.getScriptLock()`:
    ```javascript
    var lock = LockService.getScriptLock();
    lock.waitLock(10000); // 10-second timeout
    try {
      // Atomic read, deduplication check, and appendRow
    } finally {
      lock.releaseLock();
    }
    ```
    This guarantees strictly serialized access to the `Customers` worksheet.

### Q7: Can request parameters or error messages reveal customer information?
- **Analysis:**
  - **Proposed Defense:**
    - Error responses return standardized error codes (`INVALID_NAME`, `INVALID_MOBILE`, `EMPTY_REQUEST`, `SERVER_ERROR`) without reflecting back sensitive data or internal system paths.
    - Stack traces and raw Google Apps Script error dumps are caught and mapped to a generic `SERVER_ERROR`.

### Q8: Are privileged credentials exposed in frontend code?
- **Analysis:**
  - **Verified Implementation:** Zero Google service account credentials, OAuth tokens, or administrative private keys exist in the frontend code, browser bundles, or client-side `.env` files.
  - The client only communicates with the local dining proxy.

### Q9: Can unauthorized clients bypass required validation?
- **Analysis:**
  - **Proposed Defense:**
    - Validation is executed in depth:
      1. Client-side validation in React (immediate user feedback).
      2. Server-side validation in the dining backend proxy.
      3. Authoritative validation in `Code.gs` (verifies mobile format `^[6-9]\d{9}$` and name length 1–60 chars before any sheet interaction).
    - Even if a client bypasses the frontend, the Apps Script layer rejects invalid payloads with HTTP 422.

### Q10: What protects the endpoint against automated abuse?
- **Analysis:**
  - **Proposed Defense:**
    - Physical QR presence verification (requires `qrProofToken` signed by server secret).
    - Sliding window rate limiting on `/api/dine-in/*` routes.
    - Lock timeouts that drop unresolvable traffic bursts after 10 seconds.

### Q11: How are errors handled without leaking sensitive data?
- **Analysis:**
  - Errors are trapped inside try/catch blocks in both the backend proxy and `Code.gs`.
  - Returned error payloads contain only non-sensitive error identifiers.
  - Server-side console logs mask telephone numbers (e.g., `+91 ******3210`).

### Q12: What happens if the Google integration is unavailable?
- **Analysis:**
  - If Google Apps Script times out, throws a 500 error, or exceeds Google quota limits:
    - The application does **not** fail open. The menu remains inaccessible until a valid customer record is established.
    - The customer sees an accessible, informative retry banner: *"We could not connect to the café customer registry. Please check your network or notify café staff to assist you."*
    - The application does **not** write data to any unauthorized fallback database or bypass the registration step.

---

## 3. Evaluation of Deployment Approaches

| Deployment Approach | Security Rating | Operational Complexity | Recommendation |
| :--- | :--- | :--- | :--- |
| **Option 1: Direct Client -> Public Apps Script** (`Who has access: Anyone`) | **Low / Vulnerable** | Minimal | **Not Recommended.** Exposes the Apps Script URL in browser bundles; permits unauthenticated public writes and phone number enumeration. |
| **Option 2: Backend Relay Proxy with Table QR Gating** (Recommended) | **High / Secure** | Moderate | **Recommended.** The frontend calls local `/api/dine-in/customer-record`, which validates physical table QR tokens and rate-limits requests before proxying to Apps Script with an internal secret. |
| **Option 3: Google Service Account with Google Sheets REST API** | **Enterprise / Highest** | High | Alternative for production scale. Requires Google Cloud Console project, GCP service account key generation, and service account sharing. Defer until café requires high-throughput cloud clustering. |

---

## 4. Deployment Approval Gate

Before any live customer data is written:
1. The project owner must confirm manual creation of the private spreadsheet.
2. The owner must review this security analysis and approve **Option 2 (Backend Relay Proxy)**.
3. No credentials or live endpoints will be activated prior to explicit owner authorization.
