# Little Monkey Café Dining — Google Spreadsheet Schema

## 1. Worksheet Specification

- **Worksheet Name:** `Customers`
- **Spreadsheet Title:** `Little Monkey Café — Dining Customers`
- **Access Level:** Strictly Private (Restricted to Little Monkey Café Google Account; no public link sharing).
- **Format:** Google Sheets tabular data starting at Row 1 (Header row).
- **Template File:** [src/data/google_sheets_customers_template.csv](file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/src/data/google_sheets_customers_template.csv)

---

## 2. Column Definitions

| Column | Header | Type | Format / Constraints | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `customer_id` | String | Format: `CUST-<8-HEX>` (e.g., `CUST-8F3A2E10`) | Stable, non-sensitive unique internal record identifier. Generated automatically upon record creation. |
| **B** | `name` | String | Length: 1 to 60 characters. Plain text, trimmed. Formula-sanitized (escapes leading `=`, `+`, `-`, `@`). | Customer's full name submitted during dining table registration. |
| **C** | `mobile_number` | String | Exactly 10 numeric digits starting with 6, 7, 8, or 9 (Regex: `^[6-9]\d{9}$`). | Normalized 10-digit Indian mobile number. Stored as plain text with leading quote (`'`) to prevent numerical truncation or scientific notation. |
| **D** | `created_at` | String | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`). | Initial registration timestamp when the record was created. |
| **E** | `updated_at` | String | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`). | Last approved update timestamp (e.g. verified return dining access). |

---

## 3. Data Integrity & Validation Rules

1. **One Customer Per Mobile Number:**
   - `mobile_number` serves as the primary unique business lookup key.
   - No two rows may contain the exact same `mobile_number`.
   - The integration layer enforces atomicity via `LockService` prior to appending new rows.

2. **Customer ID Generation:**
   - High-entropy pseudo-random hexadecimal string prefixed with `CUST-` (e.g., `CUST-A14E8B2C`).
   - Non-sequential to avoid enumeration vulnerabilities.

3. **Strict Column & Privacy Boundary:**
   - No additional personal information (email, physical address, location telemetry, device identifiers, or biometric data) is collected or stored.
   - Order histories, cart selections, and payment details are strictly prohibited from this sheet, in accordance with the read-only menu architecture.
   - Do not mix customer records with the separate `Order History` spreadsheet.

4. **Name Conflict Protection:**
   - Never silently overwrite an existing customer's name when the same mobile number is submitted with a differing name.
   - The system returns an explicit status `EXISTING_CUSTOMER_NAME_MISMATCH` requiring customer confirmation to proceed under the existing verified name.

5. **Formula Injection Sanitization:**
   - Any string input beginning with formula indicator characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote (`'`) to ensure Google Sheets renders it strictly as literal text, preventing spreadsheet calculation execution.

---

## 4. Example Synthetic Records

```tsv
customer_id	name	mobile_number	created_at	updated_at
CUST-8F3A2E10	Aarav Sharma	9876543210	2026-11-04T00:15:00.000Z	2026-11-04T00:15:00.000Z
CUST-1B4D9E2F	Priya Patel	9123456780	2026-11-04T00:20:15.000Z	2026-11-04T00:20:15.000Z
CUST-6C7A8E3D	Vikram Rao	9988776655	2026-11-04T00:25:40.000Z	2026-11-04T00:25:40.000Z
```
