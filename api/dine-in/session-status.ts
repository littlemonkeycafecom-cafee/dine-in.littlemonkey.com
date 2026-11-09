import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractDiningSessionToken } from '../../src/server/http.ts';
import { FIXED_SESSION_DURATION_MS, getSystemTime } from '../../src/server/qrAuthStore.ts';
import { getStorageProvider } from '../../src/server/storage.ts';

export default createApiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const sessionToken = extractDiningSessionToken(req);
  const storage = getStorageProvider();
  const sessionCheck = await storage.validateSession(sessionToken);

  if (!sessionCheck.valid || !sessionCheck.session) {
    const statusCode =
      sessionCheck.error === 'CREDENTIAL_REVOKED' || sessionCheck.error === 'SESSION_REVOKED'
        ? 403
        : 401;
    return sendJson(res, statusCode, {
      valid: false,
      tableNumber: sessionCheck.session?.tableNumber,
      error: sessionCheck.error,
      message: sessionCheck.message,
    });
  }

  const now = getSystemTime();
  return sendJson(res, 200, {
    valid: true,
    tableNumber: sessionCheck.session.tableNumber,
    expiresAt: sessionCheck.session.expiresAt,
    timeRemainingMs: sessionCheck.timeRemainingMs,
    durationMs: FIXED_SESSION_DURATION_MS,
    serverTime: now,
    customer: {
      id: sessionCheck.session.customerId,
      name: sessionCheck.session.customerName,
      phone: sessionCheck.session.customerPhone,
    },
  });
});
