import { createApiHandler } from './_lib/handler.ts';
import { sendJson, checkRateLimit } from '../src/server/http.ts';
import { verifyQrProofToken } from '../src/server/qrAuthStore.ts';
import fs from 'node:fs';
import path from 'node:path';

const authRateLimits = new Map<string, { count: number; resetAt: number }>();
const LOCAL_SHEET_FILE = path.resolve(process.cwd(), 'src', 'data', 'local-customers-sheet.json');

function loadLocalCustomers(): Array<{
  customer_id: string;
  name: string;
  mobile_number: string;
  created_at: string;
  updated_at: string;
}> {
  try {
    if (fs.existsSync(LOCAL_SHEET_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_SHEET_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

export default createApiHandler(async (req, res, { body, clientIp }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // 1. Sliding Window Rate Limiting (20 req/min per IP)
  const limitCheck = checkRateLimit(authRateLimits, clientIp, 20, 60000);
  if (!limitCheck.allowed) {
    return sendJson(res, 429, {
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: `Too many lookup attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
    });
  }

  // 2. Validate Physical Table QR Proof Token (do NOT consume)
  const qrProofToken = body?.qrProofToken;
  if (!qrProofToken) {
    return sendJson(res, 403, {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
    });
  }

  const qrProof = verifyQrProofToken(qrProofToken, { consume: false });
  if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
    return sendJson(res, 403, {
      success: false,
      error: qrProof.error || 'INVALID_QR_PROOF',
      message: (qrProof as any).message || 'Table QR verification is expired or invalid. Please re-scan your table QR.',
    });
  }

  // 3. Normalize & Validate 10-digit Indian Mobile Number
  let rawMobile = String(body?.mobile || body?.mobile_number || body?.phone || '').replace(/\D/g, '');
  if (rawMobile.length === 12 && rawMobile.startsWith('91')) {
    rawMobile = rawMobile.slice(2);
  } else if (rawMobile.length === 11 && rawMobile.startsWith('0')) {
    rawMobile = rawMobile.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(rawMobile)) {
    return sendJson(res, 422, {
      success: false,
      error: 'INVALID_MOBILE',
      message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    });
  }

  // 4. Check Customer Identity in Database (read-only lookup)
  const rows = loadLocalCustomers();
  const existing = rows.find((r) => r.mobile_number === rawMobile);

  if (existing) {
    return sendJson(res, 200, {
      success: true,
      exists: true,
      customer: {
        customerId: existing.customer_id,
        name: existing.name,
        mobile: existing.mobile_number,
      },
      message: 'Your mobile number is already registered.',
    });
  }

  return sendJson(res, 200, {
    success: true,
    exists: false,
    mobile: rawMobile,
    message: "Welcome! Let's get you started.",
  });
});
