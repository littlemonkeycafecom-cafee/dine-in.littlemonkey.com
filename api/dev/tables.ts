import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, checkAdminAuth } from '../../src/server/http.ts';
import { getAdminTablesOverview, getActiveRawSecretForTable } from '../../src/server/qrAuthStore.ts';
import { isProduction } from '../../src/server/config.ts';

export default createApiHandler(async (req, res, { parsedUrl, body }) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (isProduction()) {
    return sendJson(res, 403, {
      error: 'DEV_ENDPOINT_DISABLED_IN_PROD',
      message: 'Developer table endpoint is strictly disabled in production.',
    });
  }

  const isStaffAuthorized = checkAdminAuth(req, body, parsedUrl.searchParams);
  const overview = getAdminTablesOverview();

  const host = req.headers.host || '127.0.0.1:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const devBase = `${protocol}://${host}`;

  const sanitizedTables = overview.map((t) => {
    // Never expose standalone rawSecret in HTTP responses under any circumstance
    let entryUrl: string | null = null;
    if (isStaffAuthorized && t.credentialId) {
      const rawSecret = getActiveRawSecretForTable(t.tableNumber);
      if (rawSecret) {
        entryUrl = `${devBase}/?t=${t.shortCode}&cred=${t.credentialId}.${rawSecret}`;
      }
    }

    return {
      tableNumber: t.tableNumber,
      shortCode: t.shortCode,
      zone: t.zone,
      capacity: t.capacity,
      credentialId: t.credentialId,
      isActive: t.isActive,
      entryUrl,
    };
  });

  return sendJson(res, 200, {
    success: true,
    tables: sanitizedTables,
    isStaffAuthorized,
  });
});
