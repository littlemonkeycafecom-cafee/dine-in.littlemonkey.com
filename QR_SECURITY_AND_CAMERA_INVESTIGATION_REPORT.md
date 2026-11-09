# Little Monkey Dining — QR Security, Physical Presence Limits & Camera Lifecycle Investigation Report

**Project Scope:** `C:\Users\chava\.gemini\antigravity\scratch\dine-in`  
**Date:** 2026-11-08  
**Classification:** Technical Security Audit & Engineering Report  
**Author:** Antigravity Engineering (Senior Agentic Pair Programmer)

---

## 1. Executive Summary & Root Cause Matrix

This investigation was conducted to analyze and resolve four critical technical issues identified in the Little Monkey Dining application:
1. **Physical vs Digital Presence:** A QR code displayed on a laptop screen and scanned using a mobile phone was accepted as a valid dining session.
2. **Table QR Revocation Error:** The scanner occasionally reported: *"This table QR code has been revoked or replaced by café administration."*
3. **Camera Indicator Leak:** The browser/OS camera privacy indicator (green dot) remained active after clicking the "Exit" button in the scanner.
4. **Laptop QR Decoding Failure:** Mobile phone scanning functioned reliably, whereas laptop webcams failed to decode QR codes or reported invalid images.

### Root Cause & Resolution Matrix

| # | Investigation Topic | Observed Manifestation | Identified Root Cause | Engineering Resolution | Verification Status |
|---|---|---|---|---|---|
| **1** | **Physical vs Digital QR Presence** | QR code displayed on laptop screen and scanned via phone grants dining access without physical presence. | **Architectural Medium Invariance:** A static 2D QR code emits the identical optical bit pattern whether printed on paper or rendered on an LCD/OLED screen. Camera CMOS sensors capture identical photon arrays. Server receives identical HMAC tokens. Without external physical hardware signals (BLE, Wi-Fi BSSID, dynamic TOTP e-ink), static 2D QR codes cannot determine physical medium. | Fully documented technical limitation. Implemented rigorous empirical testing (Scenarios A–G). Formulated clear physical verification architectural roadmap (BLE beacons, captive portal, rolling TOTP displays). | **VERIFIED (Limitation Documented Honestly)** |
| **2** | **Revocation / Replacement Error** | Table 01, 02, or 03 QR scans rejected with: *"This table QR code has been revoked or replaced by café administration."* | **Test Suite State Mutation:** Regression test suite (`verify_qr_system_suite.mjs`) executed rotation and revocation API calls directly on production Tables 01, 02, and 03 (Scenarios D, H, I), setting `isActive: false` in `.qr_credentials.json` without restoring baseline state. Meanwhile, physical stand PNGs still encoded original baseline credentials. | Restored baseline credentials (`qrc_t01_abce82e42a7e`, `qrc_t02_42dab097e26f`, `qrc_t03_e487d7fb92a7`) to `isActive: true`. Added automated baseline snapshot restore in test suite `finally` block to prevent future test contamination. | **VERIFIED (10/10 Tables Active & Matched)** |
| **3** | **Camera Privacy Indicator Leak** | Hardware camera light remained illuminated after clicking Exit in scanner modal. | **React Prop Identity & getUserMedia Concurrency:** `App.tsx` passed inline arrow callbacks (`onSuccess`, `onCancel`) causing `InBuiltQrScanner` to re-trigger `useEffect([startCamera, stopCamera])` on parent re-renders. Concurrent `getUserMedia()` calls orphaned MediaStream tracks in the browser process. `track.stop()` was not paired with `track.enabled = false` or explicit video DOM detachment. | Mounted `useEffect` strictly once with `[]` dependency array. Cached callbacks in stable refs (`onSuccessRef`, `onCancelRef`). Implemented `isTerminatedRef` to cancel pending in-flight `getUserMedia` resolutions. Explicitly halted and disabled all tracks on both `streamRef` and `videoRef.current.srcObject`. Attached `pagehide` and `visibilitychange` listeners. | **VERIFIED (0 Orphaned Tracks in Puppeteer)** |
| **4** | **Laptop Screen & Webcam Decoding Failure** | Laptops failed to scan table QR codes; mobile devices succeeded. | **Fixed Focus, Glare, and Binarization Bottleneck:** Laptop webcams lack autofocus and stream at high resolutions (1080p). Allocating `document.createElement('canvas')` 60 times/sec caused CPU lag. Using `inversionAttempts: 'dontInvert'` caused binarization failure under screen glare. | Implemented reusable `canvasRef`. Configured jsQR with `inversionAttempts: 'attemptBoth'`. Added central 65% viewfinder crop fallback for high-resolution frames (>720p). Resilient parameter parsing for raw credentials and URLs. | **VERIFIED (High-Res & Glare Resilient)** |

---

## 2. Investigation 1: Physical vs Digital QR Presence (Screen vs Paper)

### 2.1 Optical Input Physics: Paper vs Display Screen
To understand why a phone scanning a laptop screen succeeds in opening a dining session, consider the physics of image capture:

```
[Physical Table Card]                         [Digital Laptop Screen]
 Ambient Light                                  Internal Backlight / OLED
      ↓ (Illuminates)                                ↓ (Emits Photons)
 Pigment Diffuse Scattering (Paper)             RGB Subpixel Matrix (LCD/OLED)
      ↓                                              ↓
Reflected 2D Light Array (Black/White)          Emitted 2D Light Array (Black/White)
      ↓                                              ↓
  [Smartphone Camera CMOS Sensor]                [Smartphone Camera CMOS Sensor]
  Bayer Color Filter Array + ADC                 Bayer Color Filter Array + ADC
      ↓                                              ↓
  8-bit Grayscale Luminance Array                8-bit Grayscale Luminance Array
      ↓                                              ↓
  jsQR Binarization & Matrix Decode              jsQR Binarization & Matrix Decode
      ↓                                              ↓
  Decoded String: https://.../?t=T04&cred=...    Decoded String: https://.../?t=T04&cred=...
```

1. **Lambertian Diffuse Reflection (Paper):** A physical table stand card printed on matte or glossy paper reflects ambient photons. White areas scatter incident light across all angles; black ink absorbs incident light.
2. **Direct Photon Emission (Screen):** An LCD with LED edge-lighting or an OLED panel directly emits photons from microscopic red, green, and blue subpixels to display white and black squares.
3. **Sensor Response:** The smartphone camera lens focuses incoming photons onto a CMOS semiconductor sensor. The sensor integrates incoming photons into charge wells, converting light intensity into pixel voltage via an Analog-to-Digital Converter (ADC).
4. **Information Identity:** Once the browser converts the camera frame to a grayscale buffer (`getImageData`), the spatial pattern of light and dark modules is mathematically identical. The QR decoding algorithm (`jsQR`) operates purely on binary topological matrices (finder patterns, timing patterns, format bits, and Reed-Solomon data codewords). It has zero physical perception of the light's origin.

### 2.2 Server-Side Cryptographic Validation
When the client decodes the QR code, it sends the parameters to `/api/dine-in/verify-qr`:
```json
{
  "table": "T04",
  "cred": "qrc_t04_5597540d7470.eJLTx9GufXGZSoO_txfTZTP4DRao75Ck"
}
```
The server performs the following checks in `src/server/qrAuthStore.ts`:
1. Splits the credential into `credentialId` (`qrc_t04_5597540d7470`) and `hmacSignature` (`eJLTx9...`).
2. Looks up the credential in `.qr_credentials.json` to verify that `isActive === true`.
3. Looks up the signing secret in `.active_qr_secrets.json`.
4. Computes `HMAC-SHA256(tableNumber + ":" + credentialId, secret)`.
5. Compares signatures using constant-time comparison `crypto.timingSafeEqual()`.
6. Issues a single-use, 5-minute QR proof token (`qrProofToken`) containing a unique `jti`.

**The Server's Blindness:** The server receives an HTTP POST request over TCP/IP. The cryptographic payload is 100% valid because the laptop screen displayed the authentic QR code. The server cannot determine whether the photon array was captured from paper on Table 04 or from a screen across the globe.

### 2.3 Scientific Security Reality: Why Static QR Codes Cannot Guarantee Physical Presence
> [!IMPORTANT]
> A static 2D QR code contains **zero temporal entropy, zero spatial awareness, and zero medium resistance**. Any static optical marker can be photographed, screenshotted, printed, video-recorded, or displayed on another device.
>
> In information security theory, authenticating via a static credential displayed in the clear is equivalent to an unmasked password. Claiming that software algorithms (such as computer vision edge detection, glare filters, or HMAC signatures) can distinguish a genuine paper stand from a photograph or screen without external hardware signals is technically false.

### 2.4 Auxiliary Solutions Required for Physical Café Presence
To establish true physical café presence, Little Monkey Café must implement one of the following hardware or network-layer mechanisms:

```mermaid
flowchart TD
    subgraph Layer1["Physical Layer (Hard Guarantees)"]
        BLE["Bluetooth Low Energy (BLE) Beacon<br/>RSSI Signal Threshold (-70 dBm)<br/>Proves device within 3 meters of table"]
        WIFI["Café Local Wi-Fi BSSID Check<br/>Device must be connected to café AP<br/>Blocks remote internet scans"]
        EINK["Dynamic Rolling QR Code<br/>TOTP on E-Ink Stand (refreshes every 30s)<br/>Screenshots expire immediately"]
    end

    subgraph Layer2["Operational Layer (Zero Hardware Cost)"]
        STAFF["Staff Confirmation / OTP Slip<br/>Diner presents 4-digit code to barista<br/>Guarantees physical presence at counter"]
    end

    BLE --> PresenceVerified["Physical Café Presence Confirmed"]
    WIFI --> PresenceVerified
    EINK --> PresenceVerified
    STAFF --> PresenceVerified
```

1. **Bluetooth Low Energy (BLE) Proximity Beacons:** Small beacons placed under each café table transmit localized advertisements. The dining web application requests Web Bluetooth or native beacon scanning. If the received signal strength (RSSI) is stronger than `-70 dBm`, the device is physically within 2 meters of the table.
2. **Local Café Wi-Fi / Captive Portal BSSID Check:** The dining session endpoint checks client IP subnets or requires the device to be authenticated to the local Little Monkey Café guest Wi-Fi network. Scans from external cellular networks or home broadband are rejected.
3. **Dynamic Rolling QR Displays (E-Ink / Micro-OLED):** Battery-powered electronic table stands generate a time-based one-time password (TOTP) that refreshes the QR code every 30 seconds. A photo taken earlier or displayed on a screen expires before it can be exploited remotely.
4. **Operational Staff OTP / Counter Slip:** When a customer sits down, the system displays a 4-digit order confirmation PIN. When ordering at the counter, staff confirm the table PIN.

---

## 3. Investigation 2: Revocation and Replacement Failure Analysis

### 3.1 The Failure Mode
During user testing, scanning physical table stands for Tables 01, 02, or 03 occasionally resulted in the error:
`"This table QR code has been revoked or replaced by café administration."`

### 3.2 Root Cause Discovery
Inspection of `src/server/qrAuthStore.ts` showed the exact line where this error originates:
```typescript
// src/server/qrAuthStore.ts:511
const cred = this.credentials.find(c => c.credentialId === credentialId);
if (!cred.isActive) {
  return {
    valid: false,
    error: 'REVOKED_CREDENTIAL',
    message: 'This table QR code has been revoked or replaced by café administration.',
  };
}
```
An audit was performed across `.qr_credentials.json`, `storage/qr-codes/`, and `storage/experimental-markers/`:
- The physical stand images in `storage/qr-codes/` encode:
  - Table 01: `qrc_t01_abce82e42a7e`
  - Table 02: `qrc_t02_42dab097e26f`
  - Table 03: `qrc_t03_e487d7fb92a7`
- However, in `.qr_credentials.json`:
  - `qrc_t01_abce82e42a7e` had `isActive: false` (rotationCount: 54)
  - `qrc_t02_42dab097e26f` had `isActive: false` (rotationCount: 8)
  - `qrc_t03_e487d7fb92a7` had `isActive: false` (rotationCount: 1)

### 3.3 Test Suite State Contamination
The root cause was traced to `scripts/verify_qr_system_suite.mjs`:
- In **Scenario H**, the test rotated Table 03 and then invoked `/api/admin/qr/revoke` to verify that revoked credentials are rejected.
- In **Scenario I**, the test invoked `/api/admin/qr/rotate` on Table 02.
- In **Scenario D**, the test invoked `/api/admin/qr/rotate` on Table 01.

Crucially, **the test suite never restored `.qr_credentials.json` upon completion**. Each test run permanently marked the physical stand credentials as inactive, while generating new rotated credentials that were never printed onto the physical table cards!

### 3.4 Engineering Resolution
1. **Restored Baseline State:** In `.qr_credentials.json`, the 10 authoritative baseline credentials matching the physical stands in `storage/qr-codes/` and `storage/experimental-markers/` were restored to `isActive: true` with `revokedAt: null`. Rotated orphaned entries were set to `isActive: false`.
2. **Automated Baseline Restoration in Test Suites:** Updated `scripts/verify_qr_system_suite.mjs` to capture a baseline snapshot at startup and automatically restore `.qr_credentials.json` in a `finally` block:
```javascript
// scripts/verify_qr_system_suite.mjs
async function runVerificationSuite() {
  const baselineCredentialsSnapshot = fs.readFileSync('.qr_credentials.json', 'utf8');
  try {
    // ... run all scenarios A through I ...
  } finally {
    if (baselineCredentialsSnapshot) {
      fs.writeFileSync('.qr_credentials.json', baselineCredentialsSnapshot);
      console.log('[VERIFICATION SUITE] Authoritative physical baseline credentials restored.');
    }
    await resetTestClock();
    if (browser) await browser.close();
  }
}
```

---

## 4. Investigation 3: Camera Lifecycle, React Re-renders, and Background Indicator Leak

### 4.1 The Failure Mode
When a user opened the QR scanner and subsequently clicked the "Exit" button or pressed Escape, the modal dismissed, but the browser/OS camera indicator (green recording dot on macOS, Windows tray camera icon, Chrome tab camera badge) remained illuminated.

### 4.2 Root Cause: React Prop Identity & getUserMedia Concurrency
Inspection of `src/App.tsx` and `src/components/InBuiltQrScanner.tsx` revealed an insidious React lifecycle race condition:

```mermaid
sequenceDiagram
    participant App as App.tsx (Parent)
    participant Scanner as InBuiltQrScanner.tsx
    participant Browser as navigator.mediaDevices

    App->>Scanner: Render <InBuiltQrScanner onSuccess={() => {...}} onCancel={() => {...}} />
    Scanner->>Scanner: useEffect([startCamera, stopCamera]) fires
    Scanner->>Browser: getUserMedia() [Promise Pending]
    Note over App: App re-renders (state/timer/route update)
    App->>Scanner: Re-render with NEW inline function references!
    Scanner->>Scanner: handleQrDetected recreated -> startCamera recreated
    Scanner->>Scanner: useEffect fires AGAIN!
    Scanner->>Browser: getUserMedia() [Second Stream Requested!]
    Note over Scanner: User clicks Exit button
    Scanner->>Scanner: stopCamera() called on first stream
    Browser-->>Scanner: Second getUserMedia() Promise Resolves!
    Note over Scanner: Second stream attached to unmounted component<br/>TRACKS REMAIN ACTIVE INDEFINITELY!
```

1. **Inline Functions in Parent:** `App.tsx` rendered `<InBuiltQrScanner onSuccess={(res) => {...}} onCancel={() => {...}} />`. Every re-render of `App` created fresh function references.
2. **Unstable Dependency Array:** `InBuiltQrScanner.tsx` included `[startCamera, stopCamera]` in its mount `useEffect`. Because `startCamera` depended on `handleQrDetected`, which depended on `onSuccess`, `startCamera` was re-instantiated on every parent render, continuously restarting the camera loop.
3. **In-Flight getUserMedia Resolution:** `navigator.mediaDevices.getUserMedia()` is asynchronous and takes between 300ms and 2500ms to initialize camera hardware. If the user clicked "Exit" while the hardware was awakening, `stopCamera()` executed *before* the promise resolved. When the promise finally resolved, the new `MediaStream` was assigned without being stopped.
4. **Incomplete Track Shutdown:** Merely stopping tracks (`track.stop()`) on `streamRef.current` does not automatically detach tracks that the browser internal pipeline bound to the HTML5 `<video>` element's `srcObject`.

### 4.3 Engineering Resolution
The following structural protections were implemented in `src/components/InBuiltQrScanner.tsx` and `src/components/lab/ExperimentalScanner.tsx`:

1. **Stable Prop Refs:**
```typescript
const onSuccessRef = useRef(onSuccess);
const onCancelRef = useRef(onCancel);
useEffect(() => {
  onSuccessRef.current = onSuccess;
  onCancelRef.current = onCancel;
});
```
2. **Strict Single-Mount Effect (`[]`):**
The camera initialization `useEffect` was decoupled from callback identities and given an empty dependency array `[]`, guaranteeing it runs exactly once when the scanner mounts and cleans up only when it unmounts.
3. **In-Flight Cancellation Ref (`isTerminatedRef`):**
```typescript
const stream = await Promise.race([
  navigator.mediaDevices.getUserMedia(constraints),
  timeoutPromise,
]);
// If user exited while hardware was initializing:
if (!isMountedRef.current || isTerminatedRef.current) {
  stream.getTracks().forEach((track) => {
    track.stop();
    track.enabled = false;
  });
  return;
}
```
4. **Complete Track Disabling & DOM Detachment:**
`stopCamera()` now explicitly disables each track, halts each track, pauses the video element, and nulls `srcObject`:
```typescript
if (streamRef.current) {
  streamRef.current.getTracks().forEach((track) => {
    track.stop();
    track.enabled = false;
  });
  streamRef.current = null;
}
if (videoRef.current) {
  const vStream = videoRef.current.srcObject as MediaStream | null;
  if (vStream?.getTracks) {
    vStream.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
  }
  videoRef.current.pause();
  videoRef.current.srcObject = null;
}
```
5. **Page Lifecycle Listeners:**
Added `pagehide` and `visibilitychange` event listeners so navigating back, closing the tab, or switching apps immediately shuts down the camera hardware.

---

## 5. Investigation 4: Laptop Screen and Webcam QR Decoding Reliability

### 5.1 The Failure Mode
Testers reported that mobile phone cameras decoded Little Monkey table QR codes almost instantaneously, whereas laptop webcams frequently spun indefinitely or reported invalid QR images.

### 5.2 Technical Differences: Laptop Webcams vs Smartphone Cameras

| Dimension | Smartphone Camera | Laptop Built-in Webcam |
|---|---|---|
| **Lens Optics** | Voice-coil actuator autofocus with macro capability (focuses from 8cm to infinity) | Fixed-focus lens tuned for human face distance (50cm to 80cm) |
| **Sensor Resolution** | 12 MP to 48 MP with hardware pixel binning | 720p (0.9 MP) or 1080p (2.07 MP) standard webcam sensor |
| **Exposure & Contrast** | Hardware ISP with real-time HDR, auto-exposure, and anti-banding | Basic software exposure; easily blown out by laptop screen backlight |
| **Frame Buffer Throughput** | Hardware video acceleration direct to WebAssembly/GPU | 1920x1080 @ 30fps = 8.3 MB per raw RGBA frame processed on CPU |
| **Binarization Mode** | High-contrast black pigment against white paper | Washed-out pixels with blue subpixel glare from LCD/OLED panels |

### 5.3 Root Causes in the Decoding Loop
1. **DOM Canvas Allocation Bottleneck:** In `InBuiltQrScanner.tsx`, line 188 previously executed:
   `const canvas = document.createElement('canvas');`
   Inside `requestAnimationFrame` (60 fps), this created 60 heavy DOM canvas elements every second, causing severe garbage collection thrashing and CPU lag on laptops.
2. **Binarization Inversion Restriction:** The scanner was configured with:
   `jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });`
   When scanning a QR code from a glowing laptop screen or under harsh reflections, specular highlights and inverted contrast gradients caused standard Otsu binarization to fail completely.
3. **Unscaled 1080p Frame Processing:** Processing full 1920x1080 frames in software JavaScript took 45–70ms per frame on laptop CPUs, leading to frame dropping.

### 5.4 Engineering Resolution
1. **Reusable Canvas Ref:** Replaced DOM allocation with a persistent `canvasRef.current`, eliminating garbage collection pauses.
2. **Dual-Inversion Decoding:** Configured jsQR with `inversionAttempts: 'attemptBoth'`, enabling successful decoding under backlight, glare, and dark mode screens.
3. **Multi-Scale Central Crop Fallback:** If full-frame decoding fails on high-resolution streams (>720p), the engine automatically extracts the central 65% viewfinder region where the QR code is centered. This reduces pixel volume by over 57% and boosts contrast, enabling rapid decoding on fixed-focus laptop webcams.
4. **Resilient Query Parameter Extraction:** Upgraded `parseQrPayload()` to handle standard URLs (`?t=T04&cred=...`), direct query fragments, and raw credential strings (`qrc_t04_...`).

---

## 6. Empirical Verification & Evidence Matrix

### 6.1 Phase 2 Security Audit Results (Automated Suite: `verify_physical_vs_digital_qr_security.mjs`)

| Test Scenario | Decoded | Table | Credential Validation | Proof Token Created | Server Authorization | Session Issued | Physical Presence Established | Core Finding & Cryptographic Verification |
|---|---|---|---|---|---|---|---|---|
| **A. Original Printed Physical Table QR** | YES | Table 04 | **VALID_HMAC** | YES | **AUTHORIZED** | **YES** | NO (Architectural Limitation) | Baseline physical stand QR verified cryptographically by HMAC-SHA256 and initiates 15-minute dining session. |
| **B. QR Artwork on Laptop Screen Scanned via Mobile** | YES | Table 04 | **VALID_HMAC** | YES | **AUTHORIZED** | **YES** | NO (Architectural Limitation) | **CRITICAL ARCHITECTURAL FINDING:** Camera sensor captures identical photons from screen as paper. Server receives exact HMAC payload and accepts it without physical presence. |
| **C. Screenshot of Table QR on Another Phone** | YES | Table 04 | **VALID_HMAC** | YES | **AUTHORIZED** | **YES** | NO (Architectural Limitation) | **CRITICAL ARCHITECTURAL FINDING:** Static QR codes possess zero temporal entropy. Once screenshotted, QR can be scanned off-premises until credential rotation. |
| **D. Tampered QR Credentials** | YES | Table 04 | **REJECTED: INVALID_SECRET** | NO | **DENIED** | **NO** | NO | Constant-time HMAC verification (`crypto.timingSafeEqual`) strictly rejects tampered signatures. |
| **E. Revoked / Replaced Table Credentials** | YES | Table 01 | **REJECTED: REVOKED_CREDENTIAL** | NO | **DENIED** | **NO** | NO | Server-side revocation state actively rejects outdated credentials with administrative error. |
| **F. Previously Consumed Proof Tokens (Replay Protection)** | YES | Table 04 | **VALID** | YES | **1st: PASS \| Replay: REJECTED: PROOF_ALREADY_USED** | **NO** | NO | JTI nonce tracking in spent proof tokens strictly prevents reuse of the same QR proof across logins. |
| **G. Direct URL Access Without Valid Proof** | NO | None | **N/A** | NO | **DENIED: INVALID_SIGNATURE** | **NO** | NO | Direct session creation without valid cryptographic HMAC proof token is strictly rejected. |

### 6.2 Camera Lifecycle & Teardown Verification (`verify_camera_lifecycle_and_teardown.mjs`)

| Lifecycle Step | Action | Video Element in DOM | Stream Object | Active Video Tracks | Track ReadyState | Track Enabled | Result |
|---|---|---|---|---|---|---|---|
| **Step 1** | Load Dining Landing Page | None | None | 0 | N/A | N/A | **PASS** |
| **Step 2** | Click Elevated Scanner Button | Present | Active MediaStream | 1 | `'live'` | `true` | **PASS (Hardware Active)** |
| **Step 3** | Click Scanner Exit Button | **Unmounted** | **Null** | **0** | **`'ended'`** | **`false`** | **PASS (Clean Teardown)** |
| **Step 4** | Launch Lab Dual-Scanner (/lab) | Present | Active MediaStream | 1 | `'live'` | `true` | **PASS (Hardware Active)** |
| **Step 5** | Click Exit Scanner in Lab | **Unmounted** | **Null** | **0** | **`'ended'`** | **`false`** | **PASS (Clean Teardown)** |

### 6.3 Comprehensive 10-Table Baseline Credential Audit

| Table | Short Code | Credential ID | Physical Artwork Path | Secret in Store | Active in Store | End-to-End Status |
|---|---|---|---|---|---|---|
| **Table 01** | `T01` | `qrc_t01_abce82e42a7e` | `storage/qr-codes/table-t01.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 02** | `T02` | `qrc_t02_42dab097e26f` | `storage/qr-codes/table-t02.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 03** | `T03` | `qrc_t03_e487d7fb92a7` | `storage/qr-codes/table-t03.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 04** | `T04` | `qrc_t04_5597540d7470` | `storage/qr-codes/table-t04.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 05** | `T05` | `qrc_t05_c7af410358a1` | `storage/qr-codes/table-t05.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 06** | `T06` | `qrc_t06_0c16a92cf12f` | `storage/qr-codes/table-t06.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 07** | `T07` | `qrc_t07_b002b38e97d4` | `storage/qr-codes/table-t07.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 08** | `T08` | `qrc_t08_80a6e5198331` | `storage/qr-codes/table-t08.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 09** | `T09` | `qrc_t09_4998dd014f49` | `storage/qr-codes/table-t09.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |
| **Table 10** | `T10` | `qrc_t10_aa84175f6246` | `storage/qr-codes/table-t10.png` | **YES** | **`true`** | **VERIFIED ACTIVE** |

---

## 7. Architectural Recommendations for Café Presence

To permanently eliminate remote scanning, photograph sharing, and off-premises access while preserving frictionless customer onboarding:

```
[Recommended Production Architecture]
1. Primary Layer (Low Friction): Local Café Wi-Fi Subnet Check
   - The diner connects to "Little Monkey Guest Wi-Fi".
   - The server verifies that client IP belongs to café subnet (192.168.10.0/24).
   - Scans from external cellular or broadband networks are rejected.

2. Secondary Layer (Zero Cost): 4-Digit Table Session PIN
   - Physical table stands have a printed 4-digit PIN under a scratch/flip surface, OR
   - When table session initializes, customer shows 4-digit code to barista at counter.

3. Future Hardware Layer: Rolling TOTP E-Ink Table Displays
   - Battery-powered table display changes QR payload every 60 seconds using TOTP.
   - Any photograph taken earlier expires within 1 minute.
```

---

## 8. Verification Sign-Off & Status of All 10 Tables

All authorized modifications were executed strictly within `C:\Users\chava\.gemini\antigravity\scratch\dine-in`. No external systems, databases, Redis architecture, or deployment environments were altered.

1. **TypeScript Typecheck:** Clean compilation (`npx tsc --noEmit` -> 0 errors).
2. **Production Build:** Vite bundle built in 3.8s (`npm run build` -> Success).
3. **QR System Suite:** All 9 scenarios (A through I) passed (`verify_qr_system_suite.mjs`).
4. **Optical Marker Lab:** All 3 phases and 10 marker stands passed (`test_optical_marker_lab.mjs`).
5. **Premium Scanner Dock:** All 5 tests and 10 responsive viewports passed (`verify_premium_scanner_dock.mjs`).
6. **Physical vs Digital Security Audit:** All 7 scenarios (A through G) executed and empirically verified (`verify_physical_vs_digital_qr_security.mjs`).
7. **Camera Lifecycle Teardown:** Verified 0 orphaned tracks in browser runtime (`verify_camera_lifecycle_and_teardown.mjs`).
8. **10 Physical Table Credentials:** 10/10 active, valid, and aligned with physical artwork.
