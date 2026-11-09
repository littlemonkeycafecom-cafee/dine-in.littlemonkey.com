# Little Monkey Dining — QR Security Audit & Customer Entry Flow Investigation Report

**Project Scope:** `C:\Users\chava\.gemini\antigravity\scratch\dine-in`  
**Execution Phase:** **PHASE 1 — READ-ONLY INVESTIGATION (STRICT STOP CONDITION APPLIED)**  
**Date:** November 8, 2026  
**Status:** **AUDIT COMPLETE — AWAITING EXPLICIT APPROVAL BEFORE IMPLEMENTATION**  

---

## 1. Executive Summary

This comprehensive, read-only audit examines two core systems within Little Monkey Café Dining:
1. **The QR Cryptographic & Optical Security Architecture:** Verifying server-side token lifecycle, HMAC validation, single-use proof replay protection, 15-minute fixed sessions, quiet-zone geometry, and potential credential leakage across public assets.
2. **The Customer Entry Journey:** Verifying password-free customer identification via 10-digit Indian mobile number (`+91`), existing-customer lookup, new-customer registration, Google Sheets integration integrity, and UI/UX styling against the design references.

### Summary of Audit Status Labels
- **VERIFIED PASS:** 11 Findings
- **VERIFIED ISSUE (Action Required):** 6 Findings
- **NEEDS PHYSICAL TESTING:** 2 Findings
- **NOT VERIFIED (Environment-Dependent):** 1 Finding

---

## 2. Exact Server-Side File Changes from Artwork Task

During the physical table QR artwork redesign, changes were made to server files. The exact diff has been inspected:

1. **`src/server/qrAuthStore.ts`**:
   - **Call-to-Action Update:** Replaced `"SCAN TO EXPLORE DIGITAL MENU"` with `"SCAN TO EXPLORE OUR MENU"` in vector PDF export (`generateTablesPdf`).
   - **Active Credential Resolution:** Updated PDF export so each table uses `getActiveRawSecretForTable(table.tableNumber)` to ensure PDF vector QR matrices match physical baseline stands.
   - **Service Banner Refinement:** Removed the bulky 4-bullet IT "SECURITY & DINING SESSION PROTOCOL" box; replaced with a luxury café amenities ribbon (`TABLE SERVICE • ORDERING • COMPLIMENTARY WI-FI`) and roastery footer credit.
   - **Function Alias:** Added `export const generateSixTablesPdf = generateTablesPdf;` for backwards compatibility with legacy tests.
2. **`src/server/dineInServerPlugin.ts`**:
   - **Artwork Route Expansion:** Added handling for `format=html` and `file=html` on `/api/admin/qr/artwork` to serve `storage/qr-codes/index.html`.
3. **`scripts/generate_table_qr_artwork.mjs`**:
   - Overhauled vector SVG layout for all 10 tables, rendered print-ready PNGs via Puppeteer with font pre-caching, and generated `storage/qr-codes/index.html`.

---

## 3. Credential Identity & Payload Comparison (SHA-256 Fingerprints)

> [!IMPORTANT]
> In accordance with strict security rules, **zero raw HMAC secrets or complete entry URLs are exposed in this report**. All credentials and URLs are represented by their unique SHA-256 cryptographic digests and masked identifiers.

| Table | Zone | Capacity | Active Credential ID | Credential ID SHA-256 (16-char) | Raw Secret SHA-256 (16-char) | Full Scannable URL SHA-256 Digest | Status Label |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **T01** | Courtyard | 2 | `qrc_t01_abce82e42a7e` | `c38ffe0149a06f02` | `9578062ff2e9998f` | `b31a128bda1aa15b03a32cfccf889525cce98b2d5fd4ff656a46e68e02b232a9` | **VERIFIED PASS** |
| **T02** | Courtyard | 2 | `qrc_t02_42dab097e26f` | `dc5b391eeeb34b39` | `5f5465c56283d3c1` | `3a75574be146b08747bc0ea168e80403270136294c949af5b2919519f1f452b5` | **VERIFIED PASS** |
| **T03** | Indoor | 4 | `qrc_t03_e487d7fb92a7` | `7347302b265c1d5d` | `b0e7ccd784010ebd` | `a329864645dc67d87e64e984ed9122436a46e19b7319face0af8bfff45fbce2c` | **VERIFIED PASS** |
| **T04** | Indoor | 4 | `qrc_t04_5597540d7470` | `9ad217eec236bc28` | `380f3c19975376c9` | `d22530a0ec2b79526c36a5e80b07c53f8d5770bad5718d44068194dda9ea10a4` | **VERIFIED PASS** |
| **T05** | Indoor | 4 | `qrc_t05_c7af410358a1` | `0409ac6e3bbd5458` | `c491e91d55a5f2ee` | `1506682839e9b37b75b3ad268b938a4ac088fcf78f68e6518ba1f38d7415cd6e` | **VERIFIED PASS** |
| **T06** | Indoor | 6 | `qrc_t06_0c16a92cf12f` | `1d8fad616e8f1569` | `dfa62d822a8aeac1` | `39b6d5b6dae41e2d783891e455742898f6d69ea0a48591b2ad91afd5c494fa36` | **VERIFIED PASS** |
| **T07** | Balcony | 2 | `qrc_t07_b002b38e97d4` | `33ad46da335bfa17` | `d5de79c4a71e1037` | `e1dcb3ce29f27f363aaac3f115fc9889e43270cc1ada1b0398ee6de7b8b8cfb5` | **VERIFIED PASS** |
| **T08** | Balcony | 2 | `qrc_t08_80a6e5198331` | `21015dfec1280ba8` | `b7146452e94272ce` | `61dc1604aceb16b1656b7f996c0ecc43504cc9dac9e2181ff192ddd7b53f0b2b` | **VERIFIED PASS** |
| **T09** | Window | 2 | `qrc_t09_4998dd014f49` | `5bbecfa79e789d92` | `58a79ce528eec196` | `f08d647476d697cc14da3c19179ec5dbd02f5afb1ae9b61cccced1a18d748a05` | **VERIFIED PASS** |
| **T10** | Private Room | 8 | `qrc_t10_aa84175f6246` | `2c6d4ea0d0119945` | `0b71dcd770f1a4e7` | `acb394447f7ff659578ce7f72da4b6431c351d889778a8973b973c6f8873883d` | **VERIFIED PASS** |

- **Verification Result:** The SHA-256 fingerprints of the decoded PNG matrices match the authoritative server active secrets in `.active_qr_secrets.json` and `.qr_credentials.json` with 100% precision. Zero credentials were rotated, regenerated, or corrupted.

---

## 4. QR Security Architecture Verification (12-Point Analysis)

### 1. Original vs Generated QR Payloads (`VERIFIED PASS`)
- Base URL is strictly `https://dine-in.littlemonkey.com.vercel.app`.
- Scannable payload syntax: `?t=<tableShortCode>&cred=<credentialId>.<rawSecret>`.
- Verified that all 10 generated PNG and SVG assets contain byte-for-byte identical payloads to the authoritative physical table baseline.

### 2. Table-to-Credential Mapping T01–T10 (`VERIFIED PASS`)
- Verified in `src/server/qrAuthStore.ts` and `.qr_credentials.json`:
  - Each table $T_i$ ($i \in [1, 10]$) maps to exactly one active `credentialId` prefixed with `qrc_t0i_`.
  - No table is assigned another table's credential or secret.

### 3. Cryptographic HMAC Verification (`VERIFIED PASS`)
- When a customer scans a table QR, the raw secret is extracted on the server and verified via HMAC-SHA256:
  $$\text{hash} = \text{HMAC-SHA256}(\text{rawSecret}, \text{TABLE\_SIGNING\_KEY})$$
- The computed hash is compared against the server-stored `secretHash`.
- Tampered secrets or forged credential strings fail validation and are rejected with HTTP 403 `INVALID_SECRET`.

### 4. Timing-Safe Comparison (`VERIFIED PASS`)
- Implemented in `src/server/qrAuthStore.ts` using `crypto.timingSafeEqual`:
  ```ts
  const bufA = Buffer.from(computedHash, 'utf8');
  const bufB = Buffer.from(storedRecord.secretHash, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, error: 'INVALID_SECRET' };
  }
  ```
- Prevents side-channel timing attacks that could reveal secret characters based on response latency.

### 5. Single-Use Proof Tokens (`VERIFIED PASS`)
- On successful QR scan validation, the server generates a cryptographically signed, short-lived proof token:
  $$\text{qrproof}.\{\text{jti}, \text{credentialId}, \text{tableNumber}, \text{exp}\}.\text{HMAC}$$
- Has a strict 5-minute lifetime (`exp = now + 300,000 ms`).
- Includes a 128-bit cryptographically random `jti` (JWT ID / nonce).

### 6. Atomic Replay Protection (`VERIFIED PASS`)
- Implemented via `_spentProofTokens: Map<string, number>` in `qrAuthStore.ts` and backed by persistent `.spent_proof_tokens.json` (and Redis key `lm:proof_claim:<jti>` in multi-instance production).
- When a customer signs in or registers, the proof token is **consumed**.
- Attempting to replay the same proof token returns HTTP 403 / 500 with `PROOF_ALREADY_USED`.

### 7. QR Revocation Cascading (`VERIFIED PASS`)
- When staff or administration revokes a table QR in `src/server/qrAuthStore.ts` (`revokeTableCredential`):
  1. The credential's `isActive` flag is flipped to `false`.
  2. All active dining sessions tied to that `credentialId` are immediately revoked with reason `REVOKED`.
  3. Subsequent scans of that physical QR return HTTP 403 `REVOKED_CREDENTIAL`.

### 8. Fixed 15-Minute Session Duration (`VERIFIED PASS` with Minor Log Issue)
- **Production Server Logic:** Strictly enforces `export const FIXED_SESSION_DURATION_MS = 15 * 60 * 1000;` (900,000 ms) in `qrAuthStore.ts` and `storage.ts`.
- **Sliding Extensions:** Zero sliding extensions are permitted. After 15 minutes, access terminates deterministically.
- **Log Discrepancy (VERIFIED ISSUE):** Several legacy test script console messages (e.g. in `verify_qr_system_suite.mjs` and `verify_cinematic_coffee_and_menu.mjs`) log `"30-minute session started"`, left over from an early prototype before the 15-minute standard was locked in. The actual code, HTTP cookies, and UI countdown strictly enforce 15 minutes.

### 9. Server-Side Table Identity Validation (`VERIFIED PASS`)
- Client-supplied table query strings are never trusted. The server verifies that the table short code matches the authorized table bound inside the cryptographic credential record.

### 10. Credential Exposure in Public-Facing Assets (`VERIFIED ISSUE - CRITICAL`)
- **Audit Finding:**
  1. `storage/qr-codes/index.json` was generated with an `entryUrl` property that includes the raw secret in clear text for all 10 tables!
  2. `storage/qr-codes/index.html` embeds the entire table manifest directly into client-side JavaScript (`const tables = [...]`), exposing all 10 raw cryptographic secrets to any user viewing source or inspecting network traffic at `/api/admin/qr/artwork?file=html`!
- **Mitigation Needed in Phase 2:**
  - Sanitize `index.json` to omit `entryUrl` or mask the secret.
  - Remove raw credentials from `index.html`. Only provide download links (`/api/admin/qr/artwork?table=T01&format=png`), never embedding raw secrets in public client-side scripts.

### 11. QR Geometry, Contrast, Quiet Zone & Module Resolution (`VERIFIED PASS`)
- Analysis of generated vector SVGs:
  - Container size: $460 \times 460\text{px}$ crisp white card (`#FFFFFF`).
  - QR Version: Version 7 ($45 \times 45$ module grid, Error Correction Level M).
  - Module size: $8.62\text{px}$ per module.
  - Quiet zone width: $36.00\text{px}$ = **$4.18\text{ modules}$** on all 4 sides.
  - Exceeds the ISO/IEC 18004 requirement of $\ge 4.0$ modules.
  - Modules are rectilinear (`M...h...v...z`) with $+0.08\text{px}$ overlap to eliminate anti-aliasing gaps. Zero module rounding or distortion.

### 12. Automated Regression Test Genuineness (`VERIFIED PASS`)
- Tests in `verify_qr_system_suite.mjs` and `verify_password_free_auth.mjs` exercise the full end-to-end HTTP pipeline (network fetch, Puppeteer headless browser, live DOM mounting, and time-advance endpoints).

---

## 5. Physical Print Testing Limitations (`NEEDS PHYSICAL TESTING`)

- **Automated Validation:** All 10 table cards were decoded via `jsQR` from 1x and 2x rasterized PNG images.
- **Physical Reality:** Automated software decoding over ideal PNG buffers does not capture physical printing variables:
  - Ink bleed on uncoated paper or cardstock that might erode the quiet zone.
  - Glare, reflection, and specular highlights on acrylic stands or glossy lamination under café spotlights.
  - Camera optical distortion at steep table angles or low-light evening café ambience.
- **Recommendation:** Physical paper and acrylic stand samples must be printed and tested under actual ambient café lighting using iPhone and Android native camera lenses before mass printing.

---

## 6. Customer Entry Flow & Spreadsheet Integration Audit

### Current Architecture Diagram

```
[ Customer Scans Table QR ]
             │
             ▼
[ POST /api/dine-in/verify-qr ] ────► Returns short-lived qrProofToken (5 min)
             │
             ▼
[ CustomerLoginGate.tsx ]
             │
   ┌─────────┴─────────┐
   │ Step A: Enter     │
   │ Mobile Number     │
   │ (+91, 10 digits)  │
   └─────────┬─────────┘
             │
             ▼
[ POST /api/dine-in/customer/lookup ]
             │
     ┌───────┴───────┐
     │ Found?        │
     ├───────────────┼──────────────┐
     │ YES           │ NO           │
     ▼               ▼              ▼
[ Step B:            [ Step C:      [ Error: RETRY ]
  Existing Customer    New Customer   (Network/Service Down)
  - Name Authoritative - Enter Name   - Does NOT default
  - Immutable          - Register &     to New Customer!
  - Continue Button ]    Continue ]
```

### Existing Customer Lookup Implementation (`VERIFIED ISSUE`)
- **Current Behavior in `src/server/dineInServerPlugin.ts` (lines 684–706):**
  `/api/dine-in/customer/lookup` reads exclusively from local JSON storage:
  ```ts
  const rows = loadLocalCustomers();
  const existing = rows.find((r) => r.mobile_number === rawMobile);
  ```
- **The Gap:** It does **not** query the live Google Sheet Webhook or Google Apps Script. If an existing diner was registered through Google Sheets on another instance or directly in the sheet, the local lookup reports `exists: false`!
- **Consequence:** The returning diner is asked for their name in Step C. When they submit, `/api/dine-in/customer-record` calls Google Apps Script, which detects the duplicate and returns `EXISTING_CUSTOMER`, but the first-step UX failed to recognize them upfront.

### Customer Registration Implementation (`VERIFIED PASS` with Synchronization Gap)
- Implemented in `/api/dine-in/customer-record`:
  - Enforces mandatory `qrProofToken`.
  - Normalizes 10-digit Indian mobile numbers (`/^[6-9]\d{9}$/`).
  - Enforces customer name length (1 to 60 characters).
  - Sanitizes against spreadsheet formula injection by prepending `'` to leading `=`, `+`, `-`, `@`.
  - In production, relays cryptographically to Google Apps Script Web App with HMAC-SHA256 signature, ISO 8601 timestamp (5-minute tolerance), and unique nonce.
- **Synchronization Gap (VERIFIED ISSUE):** When Google Apps Script responds successfully with a new customer record, `dineInServerPlugin.ts` does not write the newly registered customer back to `local-customers-sheet.json`. Subsequent lookups on that instance will not find them locally until a full sync occurs.

### Google Sheets Worksheet Schema (`VERIFIED PASS`)
- Verified against `src/google-apps-script/Code.gs` and `src/data/google_sheets_customers_template.csv`:
  - Worksheet name: `Customers`
  - Required Row 1 Headers: `customer_id`, `name`, `mobile_number`, `created_at`, `updated_at`
  - LockService concurrency lock (10-second timeout) prevents race conditions during parallel diner registrations.
  - Mobile numbers are stored as plain text strings (`'9876543210`) to prevent spreadsheet numeric truncation.

---

## 7. UI/UX Analysis Against Reference Screenshots

### Reference Design Language
1. **Palette:** Pure dark espresso canvas (`#080808`), warm chocolate card (`#12100E`), golden-yellow accents (`#FFC21A` / `#FBC324`).
2. **Primary Yellow Action Button:**
   - Bright, warm golden-yellow rounded button (`#FFC21A`).
   - Elegant ambient golden aura / glow (`0 0 24px rgba(255, 194, 26, 0.45)`).
   - Polished visual appeal even prior to text entry, but with strict submission disabling until 10 valid digits are present.
   - Subtle spring interaction on hover and click (`transform: scale(0.98)`).
3. **Clean Input Surfaces:** Crisp rounded pill container with country prefix `+91` visually distinct, bold 14px typography, and gold border highlight on active focus.

### Current Implementation vs Reference UI Gaps (`VERIFIED ISSUE`)
1. **Disabled Button Appearance:** In `CustomerLoginGate.tsx`, when the mobile input has $<10$ digits, the primary button currently turns a muddy olive-brown (`#786016`) with muted styling. The brief specifies that the button should maintain a **premium golden-yellow visual appearance with an elegant ambient glow** even before 10 digits are typed, while remaining disabled from submission.
2. **Glow Styling:** Current box shadow is a basic offset shadow (`0 4px 16px rgba(251, 195, 36, 0.25)`). It lacks the rich dual-layer ambient aura featured in the dock reference screenshot (`0 0 28px rgba(255, 194, 26, 0.45), 0 8px 24px rgba(0, 0, 0, 0.6)`).
3. **Typography & Hierarchy:** Step A headline `"Welcome to Little Monkey Café"` and Step B `"Your mobile number is already registered."` can be refined to be cleaner and more conversational: e.g. `"Welcome to Table 01"` and `"Welcome Back, Aarav!"`.

---

## 8. Error Handling & Reliability Evaluation

| Scenario | Handled? | Current Behavior | Audit Evaluation |
| :--- | :---: | :--- | :--- |
| **Invalid Mobile Number** ($<10$ digits, starts with 0–5) | YES | Client blocks button; server returns HTTP 422 `INVALID_MOBILE`. | **VERIFIED PASS** |
| **Customer Not Found** | YES | Transitions cleanly to Step C (`new_customer`) with pre-populated mobile. | **VERIFIED PASS** |
| **Existing Customer Found** | YES | Transitions to Step B (`existing_customer`), displays registered name, offers "Continue to Menu". | **VERIFIED PASS** |
| **Existing Name Immutability** | YES | Server rejects client-side attempts to overwrite existing customer names. Stored name remains authoritative. | **VERIFIED PASS** |
| **Duplicate Registration Attempt** | YES | LockService in Google Apps Script and unique phone check in server prevent duplicate entries. | **VERIFIED PASS** |
| **Google Sheets Down / Timeout** | PARTIAL | Server returns HTTP 504 `GOOGLE_SHEETS_TIMEOUT`. Client shows error banner. Does **not** fall back to creating a phantom new customer. | **VERIFIED PASS** (Fail-closed is preserved) |
| **Expired QR Proof Token** ($>5$ min) | YES | Server rejects with HTTP 403 `EXPIRED_PROOF`. Asks diner to re-scan table QR. | **VERIFIED PASS** |
| **Replayed QR Proof Token** | YES | Server rejects with HTTP 403 `PROOF_ALREADY_USED`. | **VERIFIED PASS** |
| **Expired 15-Minute Dining Session** | YES | Server returns HTTP 401 `DINING_SESSION_EXPIRED`. Client mounts `DiningSessionExpiredGate`. | **VERIFIED PASS** |
| **Network Disconnection** | YES | Client catch block catches `TypeError: Failed to fetch` and shows "Please check your network connection". | **VERIFIED PASS** |

---

## 9. Test Suite Verification & Failure Analysis

### Automated Test Runs Executed During Audit
1. `node scripts/verify_password_free_auth.mjs`:
   - **Result:** **100% PASSED** (Tests 1–4 passed: existing customer flow, new customer registration, name immutability, and single-use token replay rejection).
2. `node scripts/verify_qr_system_suite.mjs`:
   - **Result:** **100% PASSED** (Scenarios A through I passed).
3. `node scripts/verify_physical_vs_digital_qr_security.mjs`:
   - **Result:** **100% PASSED** (Tests A through G passed).
4. `node scripts/verify_premium_table_qr_design.mjs`:
   - **Result:** **100% PASSED** (All 10 table cards verified scannable with 100% payload match).
5. `node scripts/verify_google_sheets_customer_integration.mjs`:
   - **Result:** **FAILED on line 51** (`AssertionError: Table 01 must have a valid entry URL`).
   - **Root Cause Analysis (VERIFIED ISSUE):**
     - Line 48 fetches `/api/dev/tables`.
     - In `dineInServerPlugin.ts`, `/api/dev/tables` only returns `entryUrl` when administrative authorization is present (`x-operational-pin: '1974'`).
     - `verify_google_sheets_customer_integration.mjs` calls `/api/dev/tables` without the PIN header, causing `entryUrl` to be `null` and tripping the assertion.
     - The test failure is in test fixture setup, not in the production security logic.

---

## 10. Summary of Confirmed Issues & Action Plan for Phase 2

### Confirmed Issues
1. **Credential Secret Exposure in `index.json` and `index.html`:**
   `storage/qr-codes/index.json` and `storage/qr-codes/index.html` expose raw cryptographic secrets in clear text.
2. **Customer Lookup Data Synchronization:**
   `/api/dine-in/customer/lookup` and `/api/dine-in/customer/continue` only check `local-customers-sheet.json`, creating a disconnect when records are added via remote Google Sheets.
3. **Primary Button Disabled Visual Styling:**
   When empty or $<10$ digits, the primary button turns an uninviting dull olive-brown instead of maintaining an elegant golden-yellow appearance with subtle ambient glow.
4. **Primary Button Glow Effect:**
   Lacks the dual-layer warm golden ambient glow inspired by the reference screenshots.
5. **Test Fixture Header Omission in `verify_google_sheets_customer_integration.mjs`:**
   Missing `x-operational-pin` header causes test line 51 failure.

### Unverified Assumptions
- **Live Google Apps Script Web App Access:** In this local development sandbox, actual live Google Apps Script calls depend on external network reachability and configured secrets in production `.env`. Fail-closed behavior has been verified, but live Google Sheets latency under café load remains unverified in production.
- **Physical Optical Scanning:** Software decoding via `jsQR` confirms mathematical matrix correctness, but physical glare on printed acrylic stands requires real-world phone camera testing.

---

## 11. Recommended Phase 2 Implementation Plan

Upon receiving explicit user approval, Phase 2 will execute the following surgical refinements:

1. **Security Hardening (Sanitize Public Assets):**
   - Update `scripts/generate_table_qr_artwork.mjs` to strip `entryUrl` with raw secrets from `storage/qr-codes/index.json`.
   - Update `storage/qr-codes/index.html` to remove embedded secrets from client-side scripts.
2. **UI/UX Customer Entry Refinement (`CustomerLoginGate.tsx`):**
   - **Primary Yellow Button:** Restructure styling so the button maintains its rich golden-yellow (`#FFC21A`) aesthetic with a refined ambient glow (`box-shadow: 0 0 24px rgba(255, 194, 26, 0.4), 0 4px 16px rgba(0,0,0,0.4)`), while using `pointer-events: none` / `cursor: not-allowed` and reduced opacity (e.g. `0.65`) until 10 valid digits are entered.
   - **Country Prefix:** Enhance the `+91` badge with polished typography and seamless border integration.
   - **Input Focus State:** Add a subtle golden border transition and warm glow on focus.
   - **Spring Interaction:** Add spring active state (`transform: scale(0.98)`).
   - **Refined Copy:** Ensure clear returning diner greeting in Step B and clear full-name prompt in Step C.
3. **Customer Synchronization Hardening:**
   - Ensure `/api/dine-in/customer-record` writes back newly registered diners into the local customer store so subsequent lookups succeed immediately.
4. **Test Fixture Correction:**
   - Supply `x-operational-pin` in `scripts/verify_google_sheets_customer_integration.mjs` so the full suite runs 100% green.
5. **Full Regression Validation:**
   - Run complete suite: `verify_qr_system_suite.mjs`, `verify_password_free_auth.mjs`, `verify_physical_vs_digital_qr_security.mjs`, `verify_premium_table_qr_design.mjs`.

---

## 12. Strict Stop Condition Enforcement

**This concludes Phase 1 (Read-Only Investigation).**  
No code, credentials, customer data, or configuration files were modified during this audit.

Awaiting your review and explicit approval to proceed with Phase 2 implementation.
