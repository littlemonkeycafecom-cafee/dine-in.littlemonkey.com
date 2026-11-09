import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, checkRateLimit } from '../../src/server/http.ts';
import { verifyQrProofToken, FIXED_SESSION_DURATION_MS, getSystemTime } from '../../src/server/qrAuthStore.ts';
import { relayCustomerRegistration } from '../../src/server/sheetsRelay.ts';
import { getStorageProvider } from '../../src/server/storage.ts';
import { isProduction } from '../../src/server/config.ts';

const authRateLimits = new Map<string, { count: number; resetAt: number }>();

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
      message: `Too many registration attempts. Please wait ${limitCheck.retryAfterSec} seconds.`,
    });
  }

  // 2. Validate Physical Table QR Proof Token
  const qrProofToken = body.qrProofToken;
  if (!qrProofToken) {
    return sendJson(res, 403, {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
    });
  }

  const qrProof = verifyQrProofToken(qrProofToken);
  if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
    return sendJson(res, 403, {
      success: false,
      error: qrProof.error || 'INVALID_QR_PROOF',
      message: qrProof.message || 'Table QR verification is expired or invalid. Please re-scan your table QR.',
    });
  }

  const isProd = isProduction();

  // 3. Reject developer header overrides in production
  if (isProd) {
    if (
      req.headers['x-dev-sheets-emulator'] !== undefined ||
      req.headers['x-dev-sheets-webhook-url'] !== undefined ||
      req.headers['x-dev-sheets-api-key'] !== undefined
    ) {
      return sendJson(res, 403, {
        success: false,
        error: 'DEV_HEADERS_DISABLED_IN_PROD',
        message: 'Developer header overrides are disabled in production.',
      });
    }
  }

  // 4. Relay to Google Apps Script or Emulator
  const integrationResult = await relayCustomerRegistration(
    {
      name: body.name,
      mobile: body.mobile || body.mobile_number,
      confirmedExistingName: Boolean(body.confirmedExistingName),
    },
    {
      forceEmulator: isProd ? false : req.headers['x-dev-sheets-emulator'] === 'true',
      customWebhookUrl: isProd ? undefined : (req.headers['x-dev-sheets-webhook-url'] as string),
      customApiKey: isProd ? undefined : (req.headers['x-dev-sheets-api-key'] as string),
    }
  );

  if (!integrationResult.success || !integrationResult.customer) {
    return sendJson(res, integrationResult.httpStatus || 500, {
      success: false,
      status: integrationResult.status,
      customer: integrationResult.customer,
      error: integrationResult.error,
      message: integrationResult.message,
    });
  }

  // 5. Initialize Server-Authoritative 15-Minute Dining Session
  const storage = getStorageProvider();
  const sessionResult = await storage.createSession(
    qrProofToken,
    {
      id: integrationResult.customer.customerId,
      name: integrationResult.customer.name,
      phone: integrationResult.customer.mobile,
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

  return sendJson(res, integrationResult.status === 'NEW_CUSTOMER' ? 201 : 200, {
    success: true,
    status: integrationResult.status,
    customer: {
      ...integrationResult.customer,
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
    message: integrationResult.message,
  });
});
