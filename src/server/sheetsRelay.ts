/**
 * Little Monkey Cafe Dining — Google Sheets Customer Integration Relay
 * Cryptographic HMAC-SHA256 request signing, replay defense, and status mapping.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getGoogleSheetsConfig, isProduction } from './config.ts';

export interface CustomerRegistrationPayload {
  name: string;
  mobile: string;
  confirmedExistingName?: boolean;
}

export interface CustomerRegistrationResult {
  success: boolean;
  status?: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER' | 'EXISTING_CUSTOMER_NAME_MISMATCH';
  customer?: {
    customerId: string;
    name: string;
    submittedName?: string;
    mobile: string;
    role?: string;
  };
  error?: string;
  message?: string;
  httpStatus: number;
}

export interface CustomerLookupResult {
  success: boolean;
  exists: boolean;
  customer?: {
    customerId: string;
    name: string;
    mobile: string;
    role?: string;
  };
  mobile?: string;
  error?: string;
  message?: string;
  httpStatus: number;
}

export interface CustomerContinueResult {
  success: boolean;
  status?: 'EXISTING_CUSTOMER' | 'CUSTOMER_NOT_FOUND';
  customer?: {
    customerId: string;
    name: string;
    mobile: string;
    role?: string;
  };
  error?: string;
  message?: string;
  httpStatus: number;
}

export interface CustomerRelayOptions {
  forceEmulator?: boolean;
  customWebhookUrl?: string;
  customApiKey?: string;
}

const LOCAL_SHEET_FILE = path.resolve(process.cwd(), 'src', 'data', 'local-customers-sheet.json');
const SEQUENCE_FILE = path.resolve(process.cwd(), 'src', 'data', 'customer-sequence.json');

class RegistrationMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async lock(): Promise<() => void> {
    return new Promise((resolve) => {
      const enter = () => {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          const next = this.queue.shift();
          if (next) next();
        });
      };
      if (!this.locked) {
        enter();
      } else {
        this.queue.push(enter);
      }
    });
  }
}

export const registrationMutex = new RegistrationMutex();

/**
 * Returns the next available sequential numeric customer ID without modifying existing records.
 * Uses persistent sequence high-water mark and scans existing numeric IDs to prevent reuse.
 * Atomic and thread-safe under registrationMutex.
 */
export function getNextSequentialCustomerId(sheetData: Array<{ customer_id: string }>): string {
  let maxNumericId = 0;
  for (const row of sheetData) {
    const val = String(row.customer_id || '').trim();
    if (/^\d+$/.test(val)) {
      const num = parseInt(val, 10);
      if (num > maxNumericId) {
        maxNumericId = num;
      }
    }
  }

  let persistedHighWaterMark = 0;
  try {
    if (fs.existsSync(SEQUENCE_FILE)) {
      const seqData = JSON.parse(fs.readFileSync(SEQUENCE_FILE, 'utf8'));
      if (typeof seqData.lastCustomerId === 'number') {
        persistedHighWaterMark = seqData.lastCustomerId;
      } else if (typeof seqData.lastCustomerId === 'string' && /^\d+$/.test(seqData.lastCustomerId)) {
        persistedHighWaterMark = parseInt(seqData.lastCustomerId, 10);
      }
    }
  } catch (err) {
    console.warn('[SheetsRelay] Warning reading customer-sequence.json:', err);
  }

  const nextId = Math.max(maxNumericId, persistedHighWaterMark) + 1;
  return String(nextId);
}

/**
 * Commits the allocated customer ID to the persistent sequence file.
 * Only called after a customer record has been successfully created.
 */
export function commitSequentialCustomerId(allocatedId: string) {
  if (!/^\d+$/.test(allocatedId)) return;
  const numId = parseInt(allocatedId, 10);
  try {
    let persisted = 0;
    if (fs.existsSync(SEQUENCE_FILE)) {
      try {
        const seqData = JSON.parse(fs.readFileSync(SEQUENCE_FILE, 'utf8'));
        persisted = Number(seqData.lastCustomerId) || 0;
      } catch {}
    }
    const newHighWater = Math.max(persisted, numId);
    fs.writeFileSync(
      SEQUENCE_FILE,
      JSON.stringify({ lastCustomerId: newHighWater, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[SheetsRelay] Failed to commit sequential customer ID:', err);
  }
}

export function cleanMobileNumber(raw: string): string {
  let cleaned = String(raw || '').replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

export function mapGasErrorToStatus(errorCode: string): number {
  if (errorCode === 'INVALID_SIGNATURE' || errorCode === 'MISSING_SIGNATURE') return 401;
  if (
    errorCode === 'REQUEST_EXPIRED' ||
    errorCode === 'DUPLICATE_NONCE' ||
    errorCode === 'INVALID_NONCE' ||
    errorCode === 'MISSING_TIMESTAMP' ||
    errorCode === 'INVALID_TIMESTAMP'
  ) return 403;
  if (errorCode === 'INVALID_NAME' || errorCode === 'INVALID_MOBILE') return 422;
  if (errorCode === 'EMPTY_REQUEST' || errorCode === 'INVALID_JSON') return 400;
  if (errorCode === 'LOCK_TIMEOUT') return 503;
  if (
    errorCode === 'SERVER_MISCONFIGURED' ||
    errorCode === 'WORKSHEET_MISSING' ||
    errorCode === 'INVALID_HEADERS' ||
    errorCode === 'SPREADSHEET_NOT_FOUND' ||
    errorCode === 'SERVER_ERROR'
  ) return 500;
  return 502;
}

export function cacheCustomerRecord(customer: {
  customerId: string;
  name: string;
  mobile: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  try {
    let sheetData: Array<{
      customer_id: string;
      name: string;
      mobile_number: string;
      created_at: string;
      updated_at: string;
    }> = [];

    if (fs.existsSync(LOCAL_SHEET_FILE)) {
      sheetData = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
    }

    const cleanMob = cleanMobileNumber(customer.mobile);
    const existingIndex = sheetData.findIndex((r) => r.mobile_number === cleanMob);
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      sheetData[existingIndex].name = customer.name;
      sheetData[existingIndex].updated_at = customer.updatedAt || nowIso;
      if (customer.customerId) {
        sheetData[existingIndex].customer_id = customer.customerId;
        commitSequentialCustomerId(customer.customerId);
      }
    } else {
      const allocatedId = customer.customerId || getNextSequentialCustomerId(sheetData);
      commitSequentialCustomerId(allocatedId);
      sheetData.push({
        customer_id: allocatedId,
        name: customer.name,
        mobile_number: cleanMob,
        created_at: customer.createdAt || nowIso,
        updated_at: customer.updatedAt || nowIso,
      });
    }

    fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(sheetData, null, 2), 'utf8');
  } catch (err) {
    console.warn('[SheetsRelay] Failed to update local customer cache:', err);
  }
}

/**
 * Read-only lookup to check if a mobile number exists in Google Sheets.
 * If live Google Sheets is configured, queries Google Apps Script.
 * Outages/timeouts return HTTP 504/503 and never turn an existing customer into a new customer.
 */
export async function relayCustomerLookup(
  rawMobileInput: string,
  clientOptions: CustomerRelayOptions = {}
): Promise<CustomerLookupResult> {
  const isProd = isProduction();
  const rawMobile = cleanMobileNumber(rawMobileInput);

  if (!/^[6-9]\d{9}$/.test(rawMobile)) {
    return {
      success: false,
      exists: false,
      error: 'INVALID_MOBILE',
      message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      httpStatus: 422,
    };
  }

  const config = getGoogleSheetsConfig();
  const webhookUrl = isProd
    ? config.webhookUrl
    : (clientOptions.customWebhookUrl || config.webhookUrl);
  const apiKey = isProd
    ? config.apiKey
    : (clientOptions.customApiKey || config.apiKey);

  if (isProd && (!config.isConfigured || config.error)) {
    return {
      success: false,
      exists: false,
      error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
      message: config.error || 'Google Sheets customer integration is not properly configured in production.',
      httpStatus: 500,
    };
  }

  const isConfiguredGasUrl =
    !clientOptions.forceEmulator &&
    Boolean(webhookUrl) &&
    !webhookUrl.includes('AKfycb...') &&
    !webhookUrl.includes('your_deployment_id');

  if (isConfiguredGasUrl) {
    try {
      // 1. Try modern signed action: 'lookup'
      const timestamp = new Date().toISOString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const canonicalString = [timestamp, nonce, 'lookup', rawMobile].join(':');
      const signature = apiKey
        ? crypto.createHmac('sha256', apiKey).update(canonicalString).digest('hex').toLowerCase()
        : '';

      const gasResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          timestamp,
          nonce,
          action: 'lookup',
          mobile: rawMobile,
          signature,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const gasData = (await gasResponse.json().catch(() => ({}))) as any;

      if (gasResponse.ok && gasData.success) {
        if (gasData.exists && gasData.customer) {
          cacheCustomerRecord({
            customerId: gasData.customer.customerId,
            name: gasData.customer.name,
            mobile: gasData.customer.mobile,
            createdAt: gasData.customer.createdAt,
            updatedAt: gasData.customer.updatedAt,
          });

          return {
            success: true,
            exists: true,
            customer: {
              customerId: gasData.customer.customerId,
              name: gasData.customer.name,
              mobile: gasData.customer.mobile,
              role: 'customer',
            },
            message: gasData.message || 'Existing customer record found.',
            httpStatus: 200,
          };
        }

        return {
          success: true,
          exists: false,
          mobile: rawMobile,
          message: gasData.message || 'No registered customer found for this mobile number.',
          httpStatus: 200,
        };
      }

      // If the deployed Google Apps Script returned INVALID_SIGNATURE,
      // it is running the legacy script that requires the 5-field signature.
      if (gasData.error === 'INVALID_SIGNATURE') {
        const timestamp2 = new Date().toISOString();
        const nonce2 = crypto.randomBytes(16).toString('hex');
        const probeName = 'CUSTOMER_LOOKUP_PROBE';
        const canonicalString2 = [
          timestamp2,
          nonce2,
          probeName,
          rawMobile,
          'false',
        ].join(':');
        const signature2 = apiKey
          ? crypto.createHmac('sha256', apiKey).update(canonicalString2).digest('hex').toLowerCase()
          : '';

        const gasResponse2 = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            timestamp: timestamp2,
            nonce: nonce2,
            name: probeName,
            mobile: rawMobile,
            confirmedExistingName: false,
            signature: signature2,
          }),
          signal: AbortSignal.timeout(8000),
        });

        const gasData2 = (await gasResponse2.json().catch(() => ({}))) as any;

        // On legacy script:
        // If customer exists, it returns EXISTING_CUSTOMER_NAME_MISMATCH or EXISTING_CUSTOMER
        // with the stored name in gasData2.customer.name, without modifying the row.
        if (
          gasData2.status === 'EXISTING_CUSTOMER_NAME_MISMATCH' ||
          gasData2.status === 'EXISTING_CUSTOMER'
        ) {
          if (gasData2.customer) {
            cacheCustomerRecord({
              customerId: gasData2.customer.customerId,
              name: gasData2.customer.name,
              mobile: gasData2.customer.mobile,
            });

            return {
              success: true,
              exists: true,
              customer: {
                customerId: gasData2.customer.customerId,
                name: gasData2.customer.name,
                mobile: gasData2.customer.mobile,
                role: 'customer',
              },
              message: 'Existing customer record found in Google Sheets.',
              httpStatus: 200,
            };
          }
        }
      }

      // If we reach here and it was an error from Sheets
      if (!gasResponse.ok || (gasData.error && gasData.error !== 'INVALID_SIGNATURE')) {
        // Check local cache
        let cachedCustomer: any = null;
        try {
          if (fs.existsSync(LOCAL_SHEET_FILE)) {
            const list = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
            cachedCustomer = list.find((r: any) => r.mobile_number === rawMobile);
          }
        } catch {}

        if (cachedCustomer) {
          return {
            success: true,
            exists: true,
            customer: {
              customerId: cachedCustomer.customer_id,
              name: cachedCustomer.name,
              mobile: cachedCustomer.mobile_number,
              role: 'customer',
            },
            message: 'Existing customer record retrieved from cache.',
            httpStatus: 200,
          };
        }

        // FAIL-SAFE: Do NOT silently turn an existing customer into new!
        return {
          success: false,
          exists: false,
          error: gasData.error || 'GOOGLE_SHEETS_ERROR',
          message: gasData.message || 'Unable to complete customer lookup via Google Sheets.',
          httpStatus: mapGasErrorToStatus(gasData.error || 'SHEETS_RELAY_ERROR'),
        };
      }
    } catch (err: any) {
      // Outage / Timeout: Consult cache, else fail safe!
      let cachedCustomer: any = null;
      try {
        if (fs.existsSync(LOCAL_SHEET_FILE)) {
          const list = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
          cachedCustomer = list.find((r: any) => r.mobile_number === rawMobile);
        }
      } catch {}

      if (cachedCustomer) {
        return {
          success: true,
          exists: true,
          customer: {
            customerId: cachedCustomer.customer_id,
            name: cachedCustomer.name,
            mobile: cachedCustomer.mobile_number,
            role: 'customer',
          },
          message: 'Existing customer recognized from offline cache.',
          httpStatus: 200,
        };
      }

      // STRICT RULE: Outage must never silently turn an existing customer into a new customer!
      return {
        success: false,
        exists: false,
        error: 'GOOGLE_SHEETS_TIMEOUT',
        message: 'Unable to reach Google Sheets customer service. Please try again.',
        httpStatus: 504,
      };
    }
  }

  // Local Emulator Path (Only if emulator explicitly forced or in dev without Sheets config)
  if (isProd) {
    return {
      success: false,
      exists: false,
      error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
      message: 'Emulator fallback is strictly disabled in production.',
      httpStatus: 500,
    };
  }

  let sheetData: Array<{
    customer_id: string;
    name: string;
    mobile_number: string;
    created_at: string;
    updated_at: string;
  }> = [];

  try {
    if (fs.existsSync(LOCAL_SHEET_FILE)) {
      sheetData = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
    }
  } catch {}

  const existing = sheetData.find((r) => r.mobile_number === rawMobile);
  if (existing) {
    return {
      success: true,
      exists: true,
      customer: {
        customerId: existing.customer_id,
        name: existing.name,
        mobile: existing.mobile_number,
        role: 'customer',
      },
      message: 'Existing customer record found.',
      httpStatus: 200,
    };
  }

  return {
    success: true,
    exists: false,
    mobile: rawMobile,
    message: 'No registered customer found for this mobile number.',
    httpStatus: 200,
  };
}

/**
 * Verifies and continues an existing customer into dining.
 * Searches Google Sheets for the customer's authoritative record and touches updated_at.
 */
export async function relayCustomerContinue(
  rawMobileInput: string,
  clientOptions: CustomerRelayOptions = {}
): Promise<CustomerContinueResult> {
  const isProd = isProduction();
  const rawMobile = cleanMobileNumber(rawMobileInput);

  if (!/^[6-9]\d{9}$/.test(rawMobile)) {
    return {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Mobile number must be a valid 10-digit Indian mobile number.',
      httpStatus: 422,
    };
  }

  // Lookup the authoritative customer record
  const lookupRes = await relayCustomerLookup(rawMobile, clientOptions);
  if (!lookupRes.success || !lookupRes.exists || !lookupRes.customer) {
    return {
      success: false,
      error: lookupRes.error || 'CUSTOMER_NOT_FOUND',
      message: lookupRes.message || 'Customer record not found.',
      httpStatus: lookupRes.httpStatus === 504 || lookupRes.httpStatus === 503 ? lookupRes.httpStatus : 404,
    };
  }

  const customer = lookupRes.customer;
  const config = getGoogleSheetsConfig();
  const webhookUrl = isProd
    ? config.webhookUrl
    : (clientOptions.customWebhookUrl || config.webhookUrl);
  const apiKey = isProd
    ? config.apiKey
    : (clientOptions.customApiKey || config.apiKey);

  const isConfiguredGasUrl =
    !clientOptions.forceEmulator &&
    Boolean(webhookUrl) &&
    !webhookUrl.includes('AKfycb...') &&
    !webhookUrl.includes('your_deployment_id');

  if (isConfiguredGasUrl) {
    try {
      // 1. Try modern continue
      const timestamp = new Date().toISOString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const canonicalString = [timestamp, nonce, 'continue', rawMobile].join(':');
      const signature = apiKey
        ? crypto.createHmac('sha256', apiKey).update(canonicalString).digest('hex').toLowerCase()
        : '';

      const gasResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          timestamp,
          nonce,
          action: 'continue',
          mobile: rawMobile,
          signature,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const gasData = (await gasResponse.json().catch(() => ({}))) as any;

      // If legacy script, send legacy continue with confirmedExistingName: true
      if (gasData.error === 'INVALID_SIGNATURE') {
        const timestamp2 = new Date().toISOString();
        const nonce2 = crypto.randomBytes(16).toString('hex');
        const canonicalString2 = [
          timestamp2,
          nonce2,
          customer.name,
          rawMobile,
          'true',
        ].join(':');
        const signature2 = apiKey
          ? crypto.createHmac('sha256', apiKey).update(canonicalString2).digest('hex').toLowerCase()
          : '';

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            timestamp: timestamp2,
            nonce: nonce2,
            name: customer.name,
            mobile: rawMobile,
            confirmedExistingName: true,
            signature: signature2,
          }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[SheetsRelay] Non-fatal continue timestamp update error:', err);
    }
  }

  // Update local cache timestamp
  cacheCustomerRecord({
    customerId: customer.customerId,
    name: customer.name,
    mobile: customer.mobile,
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    status: 'EXISTING_CUSTOMER',
    customer,
    message: `Welcome back, ${customer.name}! Customer record verified.`,
    httpStatus: 200,
  };
}

export async function relayCustomerRegistration(
  payload: CustomerRegistrationPayload,
  clientOptions: CustomerRelayOptions = {}
): Promise<CustomerRegistrationResult> {
  const isProd = isProduction();
  const rawName = String(payload.name || '').trim();
  const rawMobile = cleanMobileNumber(payload.mobile);

  // 1. Validate Input Boundaries
  if (!rawName || rawName.length < 1 || rawName.length > 60) {
    return {
      success: false,
      error: 'INVALID_NAME',
      message: 'Customer name must be between 1 and 60 characters.',
      httpStatus: 422,
    };
  }

  if (!/^[6-9]\d{9}$/.test(rawMobile)) {
    return {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      httpStatus: 422,
    };
  }

  const confirmedExistingName = Boolean(payload.confirmedExistingName);

  // 2. Resolve Environment & Credentials
  const config = getGoogleSheetsConfig();
  const webhookUrl = isProd
    ? config.webhookUrl
    : (clientOptions.customWebhookUrl || config.webhookUrl);
  const apiKey = isProd
    ? config.apiKey
    : (clientOptions.customApiKey || config.apiKey);

  // 3. Fail-closed check in production
  if (isProd && (!config.isConfigured || config.error)) {
    return {
      success: false,
      error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
      message: config.error || 'Google Sheets customer integration is not properly configured in production.',
      httpStatus: 500,
    };
  }

  const isConfiguredGasUrl =
    !clientOptions.forceEmulator &&
    Boolean(webhookUrl) &&
    !webhookUrl.includes('AKfycb...') &&
    !webhookUrl.includes('your_deployment_id');

  // 4. Live Google Apps Script Relay Path
  if (isConfiguredGasUrl) {
    try {
      const timestamp = new Date().toISOString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const canonicalString = [
        timestamp,
        nonce,
        rawName,
        rawMobile,
        confirmedExistingName ? 'true' : 'false',
      ].join(':');

      const signature = apiKey
        ? crypto.createHmac('sha256', apiKey).update(canonicalString).digest('hex').toLowerCase()
        : '';

      const gasResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          timestamp,
          nonce,
          action: 'register',
          name: rawName,
          mobile: rawMobile,
          confirmedExistingName,
          signature,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const gasData = (await gasResponse.json().catch(() => ({}))) as any;
      if (!gasResponse.ok || !gasData.success) {
        const errorCode = gasData.error || 'SHEETS_RELAY_ERROR';
        const mappedStatus = mapGasErrorToStatus(errorCode);

        return {
          success: false,
          error: errorCode,
          message: gasData.message || 'Unable to complete customer record registration via Google Sheets.',
          httpStatus: mappedStatus,
        };
      }

      // Cache authoritative record locally
      if (gasData.customer) {
        cacheCustomerRecord({
          customerId: gasData.customer.customerId,
          name: gasData.customer.name,
          mobile: gasData.customer.mobile,
          createdAt: gasData.customer.createdAt,
          updatedAt: gasData.customer.updatedAt,
        });
      }

      return {
        success: true,
        status: gasData.status,
        customer: gasData.customer,
        message: gasData.message || 'Customer registered successfully.',
        httpStatus: gasData.status === 'NEW_CUSTOMER' ? 201 : 200,
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'GOOGLE_SHEETS_TIMEOUT',
        message: 'Unable to reach Google Sheets customer service. Please try again.',
        httpStatus: 504,
      };
    }
  }

  // 5. Local Emulator Path (Development and Isolated Testing Only)
  if (isProd) {
    return {
      success: false,
      error: 'GOOGLE_SHEETS_NOT_CONFIGURED',
      message: 'Emulator fallback is strictly disabled in production.',
      httpStatus: 500,
    };
  }

  const releaseLock = await registrationMutex.lock();
  try {
    let sheetData: Array<{
      customer_id: string;
      name: string;
      mobile_number: string;
      created_at: string;
      updated_at: string;
    }> = [];

    try {
      if (fs.existsSync(LOCAL_SHEET_FILE)) {
        sheetData = JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
      }
    } catch {}

    const existing = sheetData.find((r) => r.mobile_number === rawMobile);
    if (existing) {
      if (existing.name.toLowerCase() !== rawName.toLowerCase() && !confirmedExistingName) {
        return {
          success: false,
          status: 'EXISTING_CUSTOMER_NAME_MISMATCH',
          customer: {
            customerId: existing.customer_id,
            name: existing.name,
            submittedName: rawName,
            mobile: existing.mobile_number,
          },
          error: 'EXISTING_CUSTOMER_NAME_MISMATCH',
          message: `Welcome back! This mobile number is already registered under "${existing.name}". Would you like to continue as ${existing.name}?`,
          httpStatus: 409,
        };
      }

      const now = new Date().toISOString();
      existing.updated_at = now;
      try {
        fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(sheetData, null, 2), 'utf8');
      } catch {}

      return {
        success: true,
        status: 'EXISTING_CUSTOMER',
        customer: {
          customerId: existing.customer_id,
          name: existing.name,
          mobile: existing.mobile_number,
        },
        message: `Welcome back, ${existing.name}! Your dining session is ready.`,
        httpStatus: 200,
      };
    }

    // Allocate sequential numeric customer ID (Never reuses deleted IDs or row counts)
    const customerId = getNextSequentialCustomerId(sheetData);
    const now = new Date().toISOString();
    sheetData.push({
      customer_id: customerId,
      name: rawName,
      mobile_number: rawMobile,
      created_at: now,
      updated_at: now,
    });

    try {
      fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(sheetData, null, 2), 'utf8');
      commitSequentialCustomerId(customerId);
    } catch (writeErr) {
      console.error('[SheetsRelay] Failed to write local customer sheet:', writeErr);
    }

    return {
      success: true,
      status: 'NEW_CUSTOMER',
      customer: {
        customerId,
        name: rawName,
        mobile: rawMobile,
      },
      message: `Welcome to Little Monkey Café, ${rawName}! Your digital dining session is active.`,
      httpStatus: 201,
    };
  } finally {
    releaseLock();
  }
}
