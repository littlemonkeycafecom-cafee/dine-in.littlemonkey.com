# Little Monkey Café Dining — Google Sheets Integration Implementation Plan & Status

## 1. Project Phasing & Status Matrix

| Phase | Description | Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1: Project Inspection** | Inspect existing entry flow, QR access, customer state, backend endpoints, and Google credentials. | Document existing components, missing external credentials, and reusable code. | **COMPLETED** |
| **Phase 2: Spreadsheet Structure** | Define `Customers` worksheet schema: `customer_id`, `name`, `mobile_number`, `created_at`, `updated_at`. | [docs/GOOGLE_SHEETS_SCHEMA.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/GOOGLE_SHEETS_SCHEMA.md) & [src/data/google_sheets_customers_template.csv](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/data/google_sheets_customers_template.csv). | **COMPLETED** |
| **Phase 3: Customer Registration Form** | Passwordless 2-field form (Full Name + 10-digit Indian Mobile), conflict resolution, loading state, Little Monkey Café styling. | [src/components/CustomerLoginGate.tsx](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/components/CustomerLoginGate.tsx) & [src/components/CustomerAuthModal.tsx](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/components/CustomerAuthModal.tsx). | **COMPLETED** |
| **Phase 4: Integration Logic** | Server-side relay with rate limiting, QR token check, new registration, returning lookup, name conflict handling, formula escaping. | [src/server/dineInServerPlugin.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts) (`POST /api/dine-in/customer-record`). | **COMPLETED** |
| **Phase 5: Security Architecture** | Keep Google credentials strictly server-side, require physical QR proof, protect against formula injection, ensure private spreadsheet. | [docs/SECURITY_REVIEW.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/SECURITY_REVIEW.md) & [docs/GOOGLE_SHEETS_ARCHITECTURE.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/GOOGLE_SHEETS_ARCHITECTURE.md). | **COMPLETED** |
| **Phase 6: Integration Testing** | Automated end-to-end tests: missing QR token rejection, invalid mobile rejection, new registration, returning lookup, name conflict, formula escaping, browser flow. | [scripts/verify_google_sheets_customer_integration.mjs](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/scripts/verify_google_sheets_customer_integration.mjs) (100% Pass). | **COMPLETED** |
| **Phase 7: Documentation & Owner Setup** | Step-by-step setup guide, Apps Script code, integration contract, security threat model, and owner deployment instructions. | Complete documentation suite in `docs/`. | **COMPLETED** |
| **External Deployment Gate** | Owner creates private Google Spreadsheet, deploys Google Apps Script Web App, and adds `GOOGLE_SHEETS_WEBHOOK_URL` to `.env`. | Live Google Apps Script deployment URL. | **PENDING OWNER SETUP** |

---

## 2. Completed Implementation Summary

1. **Frontend Customer Entry Experience:**
   - Replaced legacy email/password sign-in and sign-up with a streamlined, passwordless 2-field form requesting ONLY Full Name and 10-digit Indian Mobile Number.
   - Built an interactive Name Conflict resolution dialog: if a returning customer enters an existing phone number with a differing name, the system prevents silent overwriting, displays the registered name on file, and allows the customer to continue under their verified name or edit their input.
   - Preserved Little Monkey Café black and gold visual branding, ambient logo aura, verified table badge, and disabled submit states during requests to eliminate accidental double clicks.

2. **Server-Side Integration Gateway:**
   - Implemented `POST /api/dine-in/customer-record` in [src/server/dineInServerPlugin.ts](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/server/dineInServerPlugin.ts).
   - Validates that requests possess an authentic, non-expired `qrProofToken` before processing, guaranteeing physical table presence.
   - Enforces sliding-window rate limiting (20 requests/min per IP).
   - Relays requests to the external Google Apps Script Web App when `GOOGLE_SHEETS_WEBHOOK_URL` is configured in `.env`.
   - In local development or before owner deployment, operates a robust file-backed customer registry adhering to the exact Google Sheets schema, column layout, deduplication rules, and formula sanitization.
   - Automatically issues a 15-minute Dining Session upon confirmed validation, granting access to the read-only digital menu.

3. **Automated Verification Suite:**
   - Created [scripts/verify_google_sheets_customer_integration.mjs](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/scripts/verify_google_sheets_customer_integration.mjs).
   - Executed 14 distinct assertion steps across direct API calls and headless Chrome browser automation.
   - All tests passed with 100% success (exit code 0).

---

## 3. Pending Owner Actions for Live Production Integration

To link the dining application to a live Google Spreadsheet:

1. **Create the Spreadsheet:** Follow [docs/GOOGLE_SHEETS_SETUP_GUIDE.md](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/docs/GOOGLE_SHEETS_SETUP_GUIDE.md) Step 1-3 to create a private spreadsheet named `Little Monkey Café — Dining Customers` with a worksheet named `Customers`.
2. **Deploy the Script:** Follow Step 5-6 to paste the provided `Code.gs` script into Google Apps Script and deploy it as a Web App (`Execute as: Me`, `Who has access: Anyone`).
3. **Configure the Server:** Add the resulting deployment URL to `.env`:
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
   ```
4. **Restart Server:** Restart the Vite development/production server to start recording live customer visits directly to Google Sheets.
