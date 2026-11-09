import { createApiHandler } from '../../_lib/handler.ts';
import { sendJson, checkRateLimit, checkAdminAuth } from '../../../src/server/http.ts';
import { getStorageProvider } from '../../../src/server/storage.ts';
import { getProductionDomain } from '../../../src/server/config.ts';

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

  try {
    const storage = getStorageProvider();
    const { record, rawSecret } = await storage.rotateTableCredential(tableNumber, 'Administrator');
    const domain = getProductionDomain();
    const entryUrl = `${domain}/?t=${record.tableShortCode}&cred=${record.credentialId}.${rawSecret}`;

    return sendJson(res, 200, {
      success: true,
      tableNumber: record.tableNumber,
      credentialId: record.credentialId,
      rawSecret,
      entryUrl,
      rotationCount: record.rotationCount,
      message: `Table ${record.tableNumber} QR credential rotated successfully. Old credentials revoked.`,
    });
  } catch (err: any) {
    return sendJson(res, 400, { error: err?.message || 'Failed to rotate credential' });
  }
});
