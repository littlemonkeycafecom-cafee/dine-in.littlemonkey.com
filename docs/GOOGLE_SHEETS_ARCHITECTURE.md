# Little Monkey Café Dining — Architecture & Data Flow

## 1. System Architecture Overview

The Little Monkey Café Dining application uses a **Google Sheets-first architecture** for customer record registration and retrieval, coupled with **server-authoritative physical QR validation** and a **read-only digital menu**.

```mermaid
flowchart TD
    subgraph Diners["Café Diner"]
        Scan["1. Scans Table QR Code"]
        Form["3. Enters Name & 10-digit Mobile"]
        Menu["6. Explores Read-Only Digital Menu"]
    end

    subgraph Frontend["Dining Frontend (React / Vite)"]
        QRValidator["2. Validates Scanned QR via Backend"]
        ClientValidator["4. Form Validation & Normalization"]
        Gatekeeper["5. Grants Menu Access on Verified Record"]
    end

    subgraph BackendProxy["Server Security Layer (dine-in server)"]
        QRStore["Authoritative QR Verification Engine"]
        SheetsRelay["Google Sheets Integration Relay"]
    end

    subgraph GoogleCloud["Google Workspace Infrastructure"]
        AppsScript["Google Apps Script Web App (Code.gs)"]
        LockService["LockService (Atomic Concurrency)"]
        PrivateSheet[("Private Google Spreadsheet (Customers Sheet)")]
    end

    Scan --> QRValidator
    QRValidator <--> QRStore
    QRValidator --> Form
    Form --> ClientValidator
    ClientValidator --> SheetsRelay
    SheetsRelay <--> AppsScript
    AppsScript <--> LockService
    AppsScript <--> PrivateSheet
    SheetsRelay --> Gatekeeper
    Gatekeeper --> Menu
```

---

## 2. End-to-End Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Diner as Customer
    participant App as Dining Frontend
    participant Svr as Dining Server Plugin
    participant GAS as Google Apps Script
    participant Sheet as Google Sheets (Customers)

    Note over Diner,Svr: Step 1: Physical Table QR Access Gate
    Diner->>App: Opens http://127.0.0.1:3000/?table=01&cred=...
    App->>Svr: POST /api/dine-in/verify-qr { table, cred }
    Svr->>Svr: Constant-time hash check against authoritative secrets
    Svr-->>App: { valid: true, tableNumber: "Table 01", qrProofToken }
    App->>App: Sets isQrAuthorized = true

    Note over Diner,Sheet: Step 2: Customer Information Gate (No Passwords / No OTP)
    App->>Diner: Presents Customer Information Form
    Diner->>App: Submits Name ("Aarav") & Mobile ("9876543210")
    App->>App: Client-side validation: 10-digit Indian mobile format

    App->>Svr: POST /api/dine-in/customer-record { qrProofToken, name, mobile }
    Svr->>Svr: Verifies qrProofToken & applies rate limiting
    Svr->>GAS: POST /exec { name: "Aarav", mobile: "9876543210" }

    Note over GAS,Sheet: Step 3: Atomic Spreadsheet Processing
    GAS->>GAS: Acquire LockService.getScriptLock() (10s timeout)
    GAS->>Sheet: Query Column C (mobile_number)
    
    alt Existing Customer Match
        Sheet-->>GAS: Found matching row
        GAS->>GAS: Verify name consistency
        GAS-->>Svr: { success: true, status: "EXISTING_CUSTOMER", customer: { customerId, name, mobile } }
    else New Customer
        Sheet-->>GAS: No match found
        GAS->>GAS: Generate customer_id ("CUST-XXXXXXXX")
        GAS->>GAS: Escape formula characters (=, +, -, @)
        GAS->>Sheet: Append row [customer_id, safeName, 'mobile, now, now]
        GAS-->>Svr: { success: true, status: "NEW_CUSTOMER", customer: { customerId, name, mobile } }
    end
    GAS->>GAS: Release Lock

    Svr-->>App: { success: true, customer: { customerId, name, mobile, role: "customer" } }
    App->>App: Sets authenticated customer state
    App->>Diner: Unlocks Read-Only Digital Menu (Categories, Products, Add-on Calculator)
```

---

## 3. Component Responsibilities & Boundaries

### A. Dining Frontend (Vite / React)
- **Role:** Pure presentation and user interaction.
- **Responsibilities:**
  - Extracts and holds QR credentials from URL / physical scan.
  - Presents the mandatory customer entry form before menu discovery.
  - Client-side validation of name (1 to 60 chars) and mobile number (10 digits starting with 6, 7, 8, or 9).
  - Displays clear error banners if Google Sheets integration fails or times out.
  - Renders category-only landing page, category detail modal/sheet, and interactive product details.
  - Zero cart drawers, zero checkout buttons, and zero session countdown clocks.

### B. Dining Server Security Layer (`dineInServerPlugin.ts`)
- **Role:** Security boundary and trusted broker.
- **Responsibilities:**
  - Validates physical table QR cryptographic credentials.
  - Prevents public scrapers from spamming the Google Apps Script endpoint by requiring a verified `qrProofToken`.
  - Enforces IP sliding-window rate limiting (15 requests/min per IP).
  - Eliminates exposure of Google API secrets or credentials in frontend JavaScript.

### C. Google Apps Script Integration Layer (`Code.gs`)
- **Role:** Business logic and data mapper.
- **Responsibilities:**
  - Enforces `LockService` to guarantee atomic serial writes, preventing race-condition duplicate customer records.
  - Sanitizes user input against formula injection.
  - Normalizes 10-digit mobile numbers.
  - Performs deduplication lookup against column C.
  - Returns strictly the minimal necessary customer object (`customerId`, `name`, `mobile`).

### D. Private Google Spreadsheet (`Customers`)
- **Role:** Master record store.
- **Responsibilities:**
  - Secure, restricted storage of customer dining visits.
  - Access is restricted exclusively to the café Google account.
  - No public read or write permissions.
