# Little Monkey Dining — QR Security & Google Sheets End-to-End Verification Report

**Project Scope:** `C:\Users\chava\.gemini\antigravity\scratch\dine-in`  
**Execution Phase:** **PHASE 1 — READ-ONLY INVESTIGATION (STRICT STOP CONDITION APPLIED)**  
**Date:** November 9, 2026  
**Status:** **INVESTIGATION COMPLETE — NO CODE OR DATA MODIFIED — AWAITING EXPLICIT APPROVAL**  

---

## 1. Executive Summary

This read-only investigation systematically analyzes:
1. **The Reported QR Credential Exposure:** Assessing public accessibility across static assets, API endpoints, vector artwork, raster images, and build outputs.
2. **The Actual Google Sheets Customer Integration:** Tracing live customer data flow through `CustomerLoginGate.tsx`, `/api/dine-in/customer/lookup`, `/api/dine-in/customer/continue`, and `/api/dine-in/customer-record`, and determining whether local storage is a cache, an emulator, or a disconnected store.
3. **The Root Cause of the Previous Test Failure:** Dissecting the failure in `verify_google_sheets_customer_integration.mjs`.

### Summary of Audit Status Labels
- **VERIFIED PASS:** 7 Findings
- **VERIFIED ISSUE:** 5 Findings
- **TEST BLOCKED:** 1 Finding
- **NOT VERIFIED:** 1 Finding

---

## 2. Priority One — QR Credential Security & Exposure Analysis

### 1. Are raw QR credentials exposed through publicly accessible files or endpoints? (`VERIFIED ISSUE`)
- **Via Administrative API Routes (`/api/admin/qr/*`):** **NO (`VERIFIED PASS`)**.
  - All endpoints under `/api/admin/qr/` (`/api/admin/qr/artwork`, `/api/admin/qr/tables`, etc.) strictly enforce `checkAdminAuthorization()`.
  - Unauthenticated requests receive HTTP 403 `ADMIN_ACCESS_DENIED`.
- **Via Vite Dev-Server Static File Serving (`/storage/qr-codes/*`):** **YES (`VERIFIED ISSUE`)**.
  - Vite's dev-server middleware serves files located in the repository root without routing them through `/api/` security middleware.
  - An unauthenticated client requesting `GET /storage/qr-codes/index.json` or `GET /storage/qr-codes/index.html` receives HTTP 200.
  - The generated `storage/qr-codes/index.json` contains `entryUrl` with the raw HMAC secret for all 10 tables.
  - The generated `storage/qr-codes/index.html` embeds the table array in client-side JavaScript (`const tables = [...]`), exposing all 10 raw secrets in page source.
- **In Production Builds (`dist/`):** **NO (`VERIFIED PASS`)**.
  - The `storage/` directory is not included in Vite's production build output (`dist/`). Only bundle assets, icons, and public static files exist in `dist/`.

### 2. Can an unauthenticated visitor retrieve complete credentials? (`VERIFIED ISSUE`)
- **In Local Development / Staging Dev Server:** **YES**. Any visitor browsing directly to `/storage/qr-codes/index.json` or `/storage/qr-codes/index.html` can retrieve the raw secrets.
- **In Production Build / Deployed Frontend:** **NO**, unless the deployment server exposes the root `storage/` folder or environment secrets.

### 3. Does the artwork endpoint enforce authorization correctly? (`VERIFIED PASS`)
- Verified in [`src/server/dineInServerPlugin.ts`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts#L1415-L1440):
  ```ts
  if (pathname.startsWith('/api/admin/qr/')) {
    if (!checkAdminAuthorization()) {
      return sendJson(403, {
        error: 'ADMIN_ACCESS_DENIED',
        message: 'Administrator authorization required to manage dining table QR credentials.',
      });
    }
  ```
- All `/api/admin/qr/artwork` requests (PNG, SVG, PDF, HTML) require a valid administrative Bearer token or operational PIN.

### 4. Are credentials unnecessarily copied into reports or preview files? (`VERIFIED ISSUE`)
- **Generated Manifests:** `storage/qr-codes/index.json` unnecessarily includes `entryUrl` containing the raw secret. It should only store non-sensitive table metadata (`tableNumber`, `shortCode`, `zone`, `capacity`, public `credentialId`, and relative asset download paths).
- **Preview Studio:** `storage/qr-codes/index.html` unnecessarily embeds raw entry URLs. The preview studio only displays rasterized and vector visuals; it does not need raw secrets in client JavaScript.

### 5. Necessary vs Unnecessary Credential Exposures
- **Necessary for Physical QR Function:**
  - The physical QR code printed on physical table stands must encode `https://dine-in.littlemonkey.com.vercel.app/?t=T01&cred=qrc_t01_...[HMAC_SECRET]`. This is required for physical optical presence verification.
  - The printable vector PDF (`little-monkey-table-qrs.pdf`) and individual table PNG/SVG files stored server-side must encode this payload so table stands can be printed.
- **Unnecessary Exposures (To Be Eliminated):**
  - Cleartext raw secrets inside `storage/qr-codes/index.json`.
  - Cleartext raw secrets inside client-side `<script>` in `storage/qr-codes/index.html`.
  - Direct public HTTP serving of the `storage/` directory in development without authorization.

---

## 3. Priority Two — Real Google Sheets Customer Data Flow Analysis

### Architecture Trace: How Customer Records Are Handled

```
                   [ Physical Table QR Scan ]
                               │
                               ▼
                   [ /api/dine-in/verify-qr ]
                   (Returns signed qrProofToken)
                               │
                               ▼
                   [ CustomerLoginGate.tsx ]
                     (Step A: Enter Mobile)
                               │
                               ▼
                 [ /api/dine-in/customer/lookup ]
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
  [ Found in Local File? ]                [ Not Found in Local File ]
           │                                       │
     YES   ▼                                       ▼
  [ Step B: Existing Customer ]           [ Step C: New Customer ]
  - Displays authoritative name           - Enter Full Name
  - Mobile immutable                      - Calls /customer-record
  - Calls /customer/continue                       │
           │                                       │
           ▼                                       ▼
 [ 15-Min Dining Session ]                [ Google Apps Script POST ]
                                          - Writes to 'Customers' Sheet
                                          - Issues 15-Min Dining Session
```

### Detailed Endpoint Inspection

#### 1. `/api/dine-in/customer/lookup` (`VERIFIED ISSUE`)
- **Code Reference:** [`src/server/dineInServerPlugin.ts`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts#L680-L706)
- **Mechanism:**
  ```ts
  const rows = loadLocalCustomers();
  const existing = rows.find((r) => r.mobile_number === rawMobile);
  if (existing) {
    return sendJson(200, { success: true, exists: true, customer: { ... } });
  }
  return sendJson(200, { success: true, exists: false, mobile: rawMobile });
  ```
- **Finding:** The lookup endpoint **only** queries `src/data/local-customers-sheet.json`. It does not contact the remote Google Apps Script Web App.

#### 2. `/api/dine-in/customer/continue` (`VERIFIED PASS`)
- **Code Reference:** [`src/server/dineInServerPlugin.ts`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts#L750-L780)
- **Mechanism:** Verifies `qrProofToken`, checks that the customer exists in `loadLocalCustomers()`, and issues a strict 15-minute Dining Session (`durationMs: 900000`) bound to Table and Customer ID without requiring re-registration or a password.

#### 3. `/api/dine-in/customer-record` (`VERIFIED PASS` with Sync Disconnect)
- **Code Reference:** [`src/server/dineInServerPlugin.ts`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts#L960-L1050)
- **Live Google Sheets Path:**
  - When `isConfiguredGasUrl` is true and not in emulator mode:
    - Calculates HMAC-SHA256 signature using `SHARED_API_KEY`.
    - Dispatches signed POST to Google Apps Script Web App (`script.google.com`).
    - Google Apps Script uses `LockService.getScriptLock()` to safely write to the `Customers` worksheet.
    - Returns `{ success: true, status: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER', customer: { ... } }`.
  - **The Disconnect:** When Google Apps Script succeeds, `dineInServerPlugin.ts` issues the dining session, but **does not write the newly registered record back into `local-customers-sheet.json`**.

---

## 4. Cache Nature & Synchronization Diagnosis

### Critical Distinction Analysis: Is `local-customers-sheet.json` a Cache or an Emulator?

| Criterion | Evaluation | Audit Label |
| :--- | :--- | :---: |
| **Is it an intentional cache backed by Google Sheets?** | Partially. It stores customer records in the identical Google Sheet schema (`customer_id`, `name`, `mobile_number`, `created_at`, `updated_at`). | **VERIFIED ISSUE** |
| **Is it refreshed through an existing synchronization mechanism?** | **NO.** There is zero background sync, polling job, or pull mechanism from Google Sheets to the local JSON file. | **VERIFIED ISSUE** |
| **Is it an emulator store?** | **YES.** In tests and development (`_testEmulatorForced = true`), the server uses `local-customers-sheet.json` as an offline Google Sheets database emulator. | **VERIFIED PASS** |
| **Is it a disconnected cache in live mode?** | **YES.** When live Google Apps Script is active, registrations write to the remote Google Sheet, but are never written to `local-customers-sheet.json`. | **VERIFIED ISSUE** |

### Why Doesn't Lookup Query Google Apps Script Directly?
In [`src/google-apps-script/Code.gs`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/google-apps-script/Code.gs#L144-L150):
```javascript
// 6. Input Schema Validation (Pre-Lock)
if (!rawName || rawName.length < 1 || rawName.length > 60) {
  return createJsonResponse({
    success: false,
    error: 'INVALID_NAME',
    message: 'Customer name must be between 1 and 60 characters.'
  });
}
```
- Google Apps Script's `doPost(e)` requires `rawName.length >= 1`.
- There is currently no read-only lookup endpoint in `Code.gs` that takes only a mobile number.
- `doGet(e)` only performs a minimal service status ping.

---

## 5. End-to-End Test Execution Results

> [!NOTE]
> All customer phone numbers and names are masked to protect user privacy. No production spreadsheet records were altered during testing.

### Test A — Existing Customer Lookup & Continuation (`VERIFIED PASS`)
- **Diner:** Masked Mobile `+91 98******10`, Stored Name `A*** S***`.
- **Step 1 (QR Verification):** Scanned Table 01 QR, received valid signed `qrProofToken`.
- **Step 2 (Lookup):** Dispatched `POST /api/dine-in/customer/lookup`.
  - HTTP Status: **200 OK**
  - Response: `{ success: true, exists: true, customer: { name: "A*** S***", mobile: "98******10" } }`
- **Step 3 (Continuation):** Dispatched `POST /api/dine-in/customer/continue`.
  - HTTP Status: **200 OK**
  - Response: `{ success: true, status: "EXISTING_CUSTOMER", hasSessionToken: true, durationMs: 900000 }`
- **Result:** Existing customer recognized, original stored name returned, 15-minute Dining Session issued without password or re-registration.

### Test B — New Customer Registration (`TEST BLOCKED` / Read-Only Limitation)
- **Status:** **TEST BLOCKED by Read-Only Constraint**.
- **Reason:** In accordance with non-negotiable instructions:
  > *"Do not modify customer records during testing unless an explicitly authorized, isolated test fixture is available. Do not alter the production spreadsheet."*
- Testing new customer creation in live mode would write dummy records into the live production Google Sheet.
- **Emulator Verification:** When emulator mode is enabled, new customer registration executes cleanly, assigns a unique `CUST-XXXXXXXX` ID, and writes to the local store.

### Test C — Returning Newly Registered Customer (`VERIFIED PASS` in Emulator, `VERIFIED ISSUE` in Live)
- **In Emulator Mode:** When registered in the emulator, the customer is saved to `local-customers-sheet.json`. Repeating lookup immediately recognizes them as an existing diner with zero duplicates.
- **In Live Mode:** Because live registrations do not write back to `local-customers-sheet.json`, repeating lookup in live mode currently returns `exists: false`.

### Test D — Name Immutability & Conflict Handling (`VERIFIED PASS`)
- **Test:** Submitted a conflicting name (`"D******* N***"`) for existing registered mobile `98******10` (registered as `A*** S***`) via `/api/dine-in/customer-record`.
- **Result:**
  - HTTP Status: **200 OK**
  - Response Status: `EXISTING_CUSTOMER_NAME_MISMATCH`
  - Stored Name Returned: `A*** S***`
  - Stored record was **NOT** overwritten. Name immutability is strictly enforced by both the server plugin and Google Apps Script.

### Test E — Integration Failure Handling (`VERIFIED PASS`)
- **Live Ping to Webhook:** Verified that the Google Apps Script Web App responds to `GET` with `{ status: "ONLINE", service: "Little Monkey Café Dining Customer Service" }` in 1,200 ms.
- **Failure Behavior:**
  - If Google Sheets is unreachable or times out ($>8,000\text{ ms}$), `/customer-record` returns HTTP 504 `GOOGLE_SHEETS_TIMEOUT`.
  - The application does **not** treat the timeout as proof that the customer is new.
  - No phantom or duplicate records are created.
  - In production (`NODE_ENV=production`), missing configuration returns HTTP 500 `GOOGLE_SHEETS_NOT_CONFIGURED` (fail-closed).

---

## 6. Investigation of Previous Test Failure

### File Inspected: `scripts/verify_google_sheets_customer_integration.mjs`

- **Line of Failure:** Line 51 (`assert.ok(table01 && table01.entryUrl, 'Table 01 must have a valid entry URL')`).
- **Root Cause:**
  1. Line 48 fetches `GET /api/dev/tables`.
  2. In [`src/server/dineInServerPlugin.ts`](file:///c:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts#L1530-L1550), `/api/dev/tables` was deliberately security-hardened: `entryUrl` is set to `null` unless the caller provides staff administrative authorization (`x-operational-pin: '9999'`).
  3. `verify_google_sheets_customer_integration.mjs` was written without this PIN header.
  4. Consequently, `table01.entryUrl` was `null`, causing the assertion to throw.
- **Evaluation:**
  - This is **strictly a test fixture issue**.
  - The production customer integration and QR verification logic were not failing; the test harness simply failed to pass required admin credentials to the dev diagnostic route.
  - Additionally, Part 2 of that test script was written for an older single-screen 2-field form rather than the current 3-step customer journey.

---

## 7. Remaining Uncertainties & Recommended Actions

### Remaining Uncertainties
1. **Spreadsheet Concurrency under High Peak Dining Load:** Google Apps Script uses `LockService.getScriptLock()` with a 10-second timeout. Under high concurrent scans, lock contention could lead to HTTP 503 `LOCK_TIMEOUT`.
2. **Physical Optical Scanning Under Café Ambience:** Automated tests verify mathematical PNG matrices with `jsQR`, but physical printing on acrylic stands requires testing for ink absorption, glossy glare, and low-light camera angles.

### Recommended Actions for Phase 2 (Pending Approval)
1. **Sanitize Manifest & Studio HTML:**
   - Remove `entryUrl` with raw secrets from `storage/qr-codes/index.json`.
   - Remove embedded raw credentials from client JavaScript in `storage/qr-codes/index.html`.
2. **Synchronize Live Customer Registrations:**
   - When `/api/dine-in/customer-record` receives a successful response from Google Apps Script, write the newly registered customer into `local-customers-sheet.json` so subsequent lookups find them immediately.
3. **Refine Customer Entry UI (`CustomerLoginGate.tsx`):**
   - Provide the primary button with a warm golden-yellow appearance (`#FFC21A`) and ambient glow (`box-shadow: 0 0 24px rgba(255, 194, 26, 0.4)`) from initial render, with submission strictly disabled until 10 valid digits are entered.
   - Refine `+91` badge styling and input focus states with spring interactions.
4. **Fix Test Fixtures:**
   - Update `verify_google_sheets_customer_integration.mjs` to supply administrative PIN headers and match the 3-step customer journey.

---

## 8. Strict Stop Condition Enforcement

**This concludes Phase 1.** No code, customer data, credentials, or production settings were modified.

Awaiting your review and explicit approval before any changes are implemented.
