import { createApiHandler } from '../../_lib/handler.ts';
import { sendJson, checkRateLimit, checkAdminAuth } from '../../../src/server/http.ts';
import { getStorageProvider } from '../../../src/server/storage.ts';

const adminRateLimits = new Map<string, { count: number; resetAt: number }>();

export default createApiHandler(async (req, res, { parsedUrl, body, clientIp }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const adminLimit = checkRateLimit(adminRateLimits, `admin:${clientIp}`, 30, 60000);
  if (!adminLimit.allowed) {
    return sendJson(res, 429, {
      error: 'TOO_MANY_REQUESTS',
      message: `Administrative rate limit exceeded. Please retry after ${adminLimit.retryAfterSec} seconds.`,
      retryAfter: adminLimit.retryAfterSec,
    });
  }

  if (!checkAdminAuth(req, body, parsedUrl.searchParams)) {
    return sendJson(res, 403, {
      error: 'ADMIN_ACCESS_DENIED',
      message: 'Administrator authorization required to manage dining table QR credentials.',
    });
  }

  const tableNumber = body.tableNumber;
  if (!tableNumber) {
    return sendJson(res, 400, { error: 'tableNumber is required' });
  }

  const storage = getStorageProvider();
  const revoked = await storage.revokeTableCredential(tableNumber, 'Administrator');
  return sendJson(res, 200, {
    success: revoked,
    tableNumber,
    message: revoked
      ? `Table ${tableNumber} QR credential revoked. All active sessions terminated.`
      : `No active credential found for ${tableNumber}.`,
  });
});
