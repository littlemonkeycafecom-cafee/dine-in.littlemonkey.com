import { createApiHandler } from '../../_lib/handler.ts';
import { sendJson, checkRateLimit, checkAdminAuth } from '../../../src/server/http.ts';
import { getStorageProvider } from '../../../src/server/storage.ts';
import { getSystemTime } from '../../../src/server/qrAuthStore.ts';

const adminRateLimits = new Map<string, { count: number; resetAt: number }>();

export default createApiHandler(async (req, res, { parsedUrl, body, clientIp }) => {
  if (req.method !== 'GET') {
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

  const storage = getStorageProvider();
  const overview = await storage.getAdminTablesOverview();

  return sendJson(res, 200, {
    success: true,
    tables: overview,
    serverTime: new Date(getSystemTime()).toISOString(),
  });
});
