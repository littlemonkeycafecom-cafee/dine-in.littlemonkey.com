import { createApiHandler } from './_lib/handler.ts';
import { sendJson, checkRateLimit } from '../src/server/http.ts';
import { FIXED_SESSION_DURATION_MS, getSystemTime } from '../src/server/qrAuthStore.ts';
import { getStorageProvider } from '../src/server/storage.ts';
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

function saveLocalCustomers(rows: any[]) {
  try {
    fs.writeFileSync(LOCAL_SHEET_FILE, JSON.stringify(rows, null, 2), 'utf8');
  } catch {}
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
      message: `Too many attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
    });
  }

  // 2. Validate Physical Table QR Proof Token
  const qrProofToken = body?.qrProofToken;
  if (!qrProofToken) {
    return sendJson(res, 403, {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
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

  // 4. Verify Existing Customer Identity in Database
  const rows = loadLocalCustomers();
  const existing = rows.find((r) => r.mobile_number === rawMobile);
  if (!existing) {
    return sendJson(res, 404, {
      success: false,
      error: 'CUSTOMER_NOT_FOUND',
      message: 'No registered customer found for this mobile number. Please register as a new diner.',
    });
  }

  // Update timestamp of access
  const nowIso = new Date(getSystemTime()).toISOString();
  existing.updated_at = nowIso;
  saveLocalCustomers(rows);

  // 5. Consume QR proof token and issue strict 15-minute Dining Session
  const sessionResult = await getStorageProvider().createSession(
    qrProofToken,
    {
      id: existing.customer_id,
      phone: existing.mobile_number,
      name: existing.name,
      role: 'customer',
    },
    {
      ip: clientIp,
      userAgent: req.headers['user-agent'] as string,
    }
  );

  if (!sessionResult.success || !sessionResult.session) {
    return sendJson(res, 500, {
      success: false,
      error: sessionResult.error || 'SESSION_CREATION_FAILED',
      message: sessionResult.message || 'Failed to initialize dining session.',
    });
  }

  const maxAgeSec = Math.ceil(FIXED_SESSION_DURATION_MS / 1000);
  res.setHeader('Set-Cookie', [
    `lm_dining_session=${encodeURIComponent(sessionResult.session.sessionId)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly`,
  ]);

  return sendJson(res, 200, {
    success: true,
    status: 'EXISTING_CUSTOMER',
    customer: {
      customerId: existing.customer_id,
      name: existing.name,
      mobile: existing.mobile_number,
      role: 'customer',
    },
    sessionToken: sessionResult.session.sessionId,
    session: {
      sessionId: sessionResult.session.sessionId,
      tableNumber: sessionResult.session.tableNumber,
      credentialId: sessionResult.session.credentialId,
      createdAt: sessionResult.session.createdAt,
      expiresAt: sessionResult.session.expiresAt,
      timeRemainingMs: Math.max(0, sessionResult.session.expiresAt - getSystemTime()),
      durationMs: FIXED_SESSION_DURATION_MS,
      serverTime: getSystemTime(),
    },
    message: 'Welcome back! You can continue to the menu.',
  });
});
