import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { isValidDiningTable } from '../../src/server/qrAuthStore.ts';
import { getStorageProvider } from '../../src/server/storage.ts';

export default createApiHandler(async (req, res, { parsedUrl }) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const rawTable = parsedUrl.searchParams.get('table');
  const tableCheck = isValidDiningTable(rawTable || '');
  if (!tableCheck.valid || !tableCheck.normalized) {
    return sendJson(res, 400, {
      valid: false,
      error: 'INVALID_TABLE',
      message: `Table "${rawTable || 'Unknown'}" is not a recognized dining table.`,
    });
  }

  const storage = getStorageProvider();
  const cred = await storage.getActiveCredentialForTable(tableCheck.normalized);
  const isActive = Boolean(cred && cred.isActive);

  if (!isActive) {
    return sendJson(res, 403, {
      valid: true,
      normalized: tableCheck.normalized,
      isActive: false,
      error: 'REVOKED_TABLE',
      message: `This table's QR credential (${tableCheck.normalized}) has been revoked or deactivated by café administration. Please contact café staff.`,
    });
  }

  return sendJson(res, 200, {
    valid: true,
    normalized: tableCheck.normalized,
    isActive: true,
    message: `Table ${tableCheck.normalized} is active.`,
  });
});
