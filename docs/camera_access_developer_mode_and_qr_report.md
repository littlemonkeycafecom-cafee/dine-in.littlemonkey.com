# Little Monkey Café Dining — Camera Access, Developer Mode & QR Recovery
## Comprehensive Investigation, Root Cause Analysis & Verification Report

**Date**: November 5, 2026  
**Workspace**: `C:\Users\chava\.gemini\antigravity\scratch\dine-in`  
**Target Application**: In-Café Digital Dining Application (Tables 01 – 10)  
**Status**: 100% Resolved & Verified  

---

## 1. Executive Summary

This investigation resolved two interconnected failure modes in the Little Monkey Café dining application:
1. **Developer Mode Failure**: Developer mode previously presented a UI table launcher (`DevTableLauncher`) whose 10 table buttons were completely disabled (`disabled={true}`). The underlying server endpoint `/api/dev/tables` required administrative staff authorization (`x-operational-pin: '9999'`), which the frontend component never transmitted. As a consequence, developers were locked out of direct table dining access and were forced towards the only other available action on the screen: "Open In-Built Camera Scanner".
2. **Camera Permission Failure**: When opening `/scanner`, the application requested camera access via `navigator.mediaDevices.getUserMedia()`. On developer workstations and desktop operating systems where OS-level privacy settings restrict camera access to desktop applications or where permissions are blocked, the browser caught `NotAllowedError`. Crucially, the component misdiagnosed all `NotAllowedError` instances as browser-level denials ("Camera Permission Denied") and instructed users to alter browser address bar settings, even when the browser was already set to "Allow" and the operating system was the true blocking agent. Furthermore, insecure HTTP contexts over LAN, timeouts, and device in-use errors lacked dedicated error states, clean retry mechanics, and track termination.
3. **QR Code Availability**: High-resolution print-ready vector SVGs, PNGs, and a consolidated printable A4 PDF for all 10 authoritative tables exist in protected server-side storage (`storage/qr-codes/`). They were generated via `scripts/generate_table_qr_artwork.mjs` and were withheld from the public web bundle for security isolation against unauthenticated scraping. Developer mode now surfaces clean client-rendered vector QR previews directly on screen so that QR codes can be visually inspected and scanned from secondary devices.

---

## 2. Phase One Investigation & Root Cause Analysis

### A. Root Cause: Developer Mode Failure
1. **The Disconnect Between Test and Live UI**:
   - In `scripts/test_developer_dining_access.mjs`, the automated test queried `GET /api/dev/tables` using an explicit Node.js fetch header:
     ```js
     const devTablesRes = await fetch(`${BASE_URL}/api/dev/tables`, {
       headers: { 'x-operational-pin': '9999' },
     });
     ```
   - The test extracted `t.entryUrl` from the JSON response and directly commanded Puppeteer to navigate to that URL (`page.goto(t01.entryUrl)`).
   - In the live application (`src/components/QrAccessGates.tsx`), `DevTableLauncher` called `fetch('/api/dev/tables')` without passing any headers, query parameters, or credentials.
2. **Server-Side Authorization Boundary**:
   - In `src/server/dineInServerPlugin.ts` (lines 1327–1342):
     ```ts
     const isStaffAuthorized = checkAdminAuthorization();
     ...
     const sanitizedTables = overview.map((t) => {
       let entryUrl: string | null = null;
       if (isStaffAuthorized && t.credentialId) {
         const rawSecret = getActiveRawSecretForTable(t.tableNumber);
         if (rawSecret) {
           entryUrl = `${devBase}/?t=${t.shortCode}&cred=${t.credentialId}.${rawSecret}`;
         }
       }
       return { ...t, entryUrl };
     });
     ```
   - Because `isStaffAuthorized` evaluated to `false`, the server sanitized every table entry, setting `entryUrl: null`.
3. **Disabled Buttons in UI**:
   - `DevTableLauncher` rendered:
     ```tsx
     <button onClick={() => handleLaunchTable(tbl.entryUrl)} disabled={!tbl.entryUrl}>
     ```
   - Because `entryUrl` was `null`, all 10 table buttons had `disabled={true}`. Clicking any table did nothing.
   - The developer was left with no functional development path and was forced into the camera scanner button.

### B. Root Cause: Camera Access Failure
1. **Coarse Error Handling in `InBuiltQrScanner.tsx`**:
   - Previously, any `NotAllowedError` or `PermissionDeniedError` triggered a single generic state:
     `setState('permission_denied')` with the message: `"Camera access was denied. Please allow camera permissions in your browser settings to scan."`
2. **Operating System Privacy Blocks**:
   - On Windows (and macOS), operating systems enforce system-level privacy boundaries (e.g. Windows Settings → Privacy & Security → Camera → "Let desktop apps access your camera").
   - When the OS blocks the camera, Chromium throws `NotAllowedError: Permission denied`.
   - The browser's internal permission state (`navigator.permissions.query({ name: 'camera' })`) actually reports `state: 'granted'`.
   - The user checked their browser lock/tune icon, saw Camera was already set to "Allow", clicked "Try Again", and encountered the exact same browser error in an endless loop.
3. **Missing Error Classifications**:
   - Insecure context (`window.isSecureContext === false`, e.g. opening via HTTP on mobile LAN `http://192.168.x.x:3000`) caused `navigator.mediaDevices` to be undefined without explaining the HTTPS requirement.
   - Hardware locks (`NotReadableError` / `TrackStartError`, e.g. Zoom/Teams locking the webcam) were grouped into generic "Unable to open device camera".
   - Device driver hangs had no timeout fallback.
   - Camera tracks were not completely unbound from `<video>` elements upon exit or unmount.

---

## 3. Files Modified & Technical Details

### 1. `src/components/InBuiltQrScanner.tsx`
- **Granular Error State Machine**: Expanded `ScannerState` to handle:
  - `permission_denied`: Browser-level address bar permission block.
  - `os_permission_denied`: Operating system privacy settings block (detected by evaluating `browserPermissionState === 'granted'` alongside `NotAllowedError` or system-specific error text).
  - `no_camera`: Missing camera hardware (`NotFoundError`, `DevicesNotFoundError`, `OverconstrainedError`).
  - `camera_in_use`: Hardware locked by another app (`NotReadableError`, `TrackStartError`, `AbortError`).
  - `insecure_context`: Non-localhost HTTP connection where browsers disable media capture.
  - `unsupported_browser`: Missing MediaDevices API support.
  - `timeout`: Hardware initialization taking longer than 12 seconds.
- **Genuine Retry Action**:
  - The "Try Again" action resets internal state, tears down existing streams cleanly, and invokes `startCamera()`.
- **Resource Management & Concurrency Guards**:
  - Attached `isMountedRef` and `isStartingRef` to prevent concurrent `getUserMedia()` calls and state updates post-unmount.
  - Cleaned up active media tracks (`track.stop()`), paused and unbound video `srcObject = null`, and cancelled animation frames (`cancelAnimationFrame`).
  - Added permissions change listener (`permissionStatus.onchange`) and track termination listener (`videoTrack.onended`) to handle runtime permission revocation.

### 2. `src/components/QrAccessGates.tsx` (`DevTableLauncher`)
- **Operational PIN Integration**:
  - `DevTableLauncher` now reads operational PIN from `sessionStorage.getItem('lm_dev_pin')`, query parameter `?pin=`, or defaults to `'9999'` in local development (`import.meta.env.DEV`).
  - Passes `headers: { 'x-operational-pin': pin }` to `/api/dev/tables`.
  - When authorized by the server, all 10 table buttons (`T01` to `T10`) receive genuine signed `entryUrl` links and are 100% enabled and clickable.
  - If unauthorized, displays an inline developer unlock form allowing immediate PIN entry.
- **On-Screen Vector QR Code Previews**:
  - Added an integrated "QR" button on each table card.
  - Clicking "QR" opens a modal displaying the genuine scannable QR code generated using `<QRCodeView value={selectedQrTable.entryUrl} size={200} />`.
  - Displays table number, zone, shortcode, entry URL, direct launch button, and link to download artwork.
- **Production Isolation**:
  - Strictly wrapped in `{import.meta.env.DEV && <DevTableLauncher />}`.
  - Vite strips the component entirely from production bundles (`dist/assets/*.js`).
  - The backend `/api/dev/tables` endpoint returns 403 `DEV_ENDPOINT_DISABLED_IN_PROD` in production environments.

---

## 4. QR Code Generation & Investigation Findings

| Question | Investigation Finding |
| :--- | :--- |
| **Are QR codes generated dynamically or static?** | **Both**. Cryptographic table credentials and secrets are stored in `.qr_credentials.json` and `.active_qr_secrets.json`. Vector QR matrices are dynamically rendered on the client via `src/lib/qrCode.ts` (`QRCodeView`), while print-ready vector SVGs, PNGs, and PDF files are generated server-side. |
| **Where are the static QR artwork files?** | Located in `storage/qr-codes/`: `table-t01.svg` to `table-t10.svg`, `table-t01.png` to `table-t10.png`, `little-monkey-table-qrs.pdf`, `index.json`, and `index.html`. |
| **Why were they not obvious in the project?** | They are stored in `storage/qr-codes/` (server-side private storage), which is excluded from the public web bundle (`public/` and `dist/`) to prevent unauthenticated harvesting of table credentials. |
| **How to generate table QR images safely?** | Execute: `node scripts/generate_table_qr_artwork.mjs`. This script reads existing active credentials from `.qr_credentials.json` without modifying or rotating them, verifies scannability with `jsQR`, and outputs print-ready assets into `storage/qr-codes/`. |
| **Can static QR codes prevent copying?** | **No**. A physical or static QR code printed on a table card can always be photographed or copied. The Little Monkey Café security model protects table access through server-side HMAC validation, 15-minute expiration boundaries, and single-use proof tokens, not through physical QR uncopyability. |

---

## 5. Test Execution & Verified Results

A comprehensive verification suite (`scripts/verify_camera_developer_mode_and_qr.mjs`) was authored and executed covering all 8 specification areas:

| Area | Test Description | Execution Method | Result |
| :--- | :--- | :--- | :--- |
| **A** | **Developer Mode Access Without Camera** | Opened `/`, confirmed `DevTableLauncher` unlocked with 10/10 active buttons. Launched Table 01 directly, reached `CustomerLoginGate`, signed in as guest, and loaded the full dining menu with zero camera interaction. | **PASSED** |
| **A2** | **QR Preview Modal** | Opened Table 02 QR inspection modal, confirmed vector `<svg>` QR rendering with table metadata. | **PASSED** |
| **C** | **Camera Permission Denial & Guidance** | Navigated to `/scanner` with permissions revoked. Verified distinct "Browser Camera Permission Denied" / "System Camera Access Blocked" message with step-by-step guidance. | **PASSED** |
| **C2** | **Genuine Camera Retry** | Granted camera permission and tapped "Try Again". Confirmed scanner transitioned cleanly to live scanning viewfinder with active `<video>` stream. | **PASSED** |
| **B** | **Customer QR Scanning & Authentication** | Navigated with genuine server-authorized QR URL (`/?t=T01&cred=...`). Confirmed server HMAC signature verification, single-use proof token generation, and physical table binding. | **PASSED** |
| **D** | **Tampered QR Rejection** | Tested `/?t=T01&cred=qrc_t01_xxx.TAMPERED_KEY`. Verified cryptographic rejection and gate display. | **PASSED** |
| **E** | **15-Minute Expiration Boundary** | Advanced test clock by 16 minutes (`/api/test/advance-time`). Confirmed session rejected by server and `DiningSessionExpiredGate` rendered. | **PASSED** |
| **F** | **Session Restoration on Bare Reload** | Started valid dining session, reloaded bare root `/`. Confirmed session preserved and menu active without re-authenticating. | **PASSED** |
| **G** | **Production Bundle Isolation** | Inspected `dist/assets/*.js`. Confirmed `DevTableLauncher` and developer shortcuts are 100% stripped from production build. | **PASSED** |
| **H** | **Zero Customer Ordering Controls** | Verified 0 "Add to Cart" buttons, 0 cart trays, 0 cart drawers, 0 checkout controls across all views. | **PASSED** |

### Regression Suite Results
1. `node scripts/test_developer_dining_access.mjs`: **ALL 7 TESTS PASSED** (Valid Table 01, Table 07/10 multi-table access, tampered QR rejection, 15m expiration, reload restoration, direct access blocking, production bundle check).
2. `npx tsc --noEmit`: **0 ERRORS**.
3. `npm run build`: **SUCCESSFUL BUILD** in 3.70s.

---

## 6. Generated Verification Artifacts

The following screenshot artifacts were generated and saved in `C:\Users\chava\.gemini\antigravity\brain\1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/`:
- `test_a1_developer_launcher_unlocked.png`: Developer launcher with all 10 table buttons enabled and unlocked.
- `test_a2_table_02_qr_preview_modal.png`: Scannable vector QR code preview for Table 02.
- `test_a3_developer_table_01_menu_active.png`: Dining menu active for Table 01 launched via developer mode.
- `test_c1_camera_permission_denied_screen.png`: Accurate actionable camera permission guidance screen.
- `test_c2_camera_scanning_viewfinder_active.png`: Live camera scanning viewfinder with scanning beam after retry.
- `test_b_scanned_qr_verified_customer_gate.png`: Customer registration gate reached after scanning genuine table QR.
- `test_d_tampered_qr_rejected.png`: Tampered QR credential rejection screen.
- `test_e_session_expired_screen.png`: 15-Minute session expiration boundary screen.
- `test_f_session_restored_reload.png`: Session preserved on bare page reload.

---

## 7. Remaining Limitations & Operating Guidance

1. **Hardware / OS Camera Consent**: On Windows, desktop apps (including Chromium/Puppeteer in headless mode) must have camera access enabled in Windows Settings (`Settings > Privacy & security > Camera > Let desktop apps access your camera`). When blocked at the OS level, the application now correctly guides the user to Windows settings rather than misdirecting them to browser permissions.
2. **Local Network HTTP vs HTTPS**: When testing on physical mobile phones over LAN (e.g. `http://192.168.1.x:3000`), mobile browsers strictly disable `navigator.mediaDevices`. The scanner now detects insecure contexts and advises using `http://localhost:3000` on the host machine or HTTPS when testing over LAN.
3. **Physical Table QR Printing**: The print-ready assets are available in `storage/qr-codes/little-monkey-table-qrs.pdf` and can be downloaded by café staff via `AdminQrManagementModal` (`?admin=true` with PIN `9999`) or `/api/admin/qr/export-pdf`.
