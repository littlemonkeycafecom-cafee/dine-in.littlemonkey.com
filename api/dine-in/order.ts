import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractDiningSessionToken } from '../../src/server/http.ts';
import { getStorageProvider } from '../../src/server/storage.ts';
import { normalizeTableLabel } from '../../src/server/qrAuthStore.ts';

export default createApiHandler(async (req, res, { body }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const sessionToken = extractDiningSessionToken(req);
  const storage = getStorageProvider();
  const sessionCheck = await storage.validateSession(sessionToken);

  if (!sessionCheck.valid || !sessionCheck.session) {
    const statusCode = sessionCheck.error === 'CREDENTIAL_REVOKED' ? 403 : 401;
    return sendJson(res, statusCode, {
      error: 'UNAUTHORIZED_DINING_ACCESS',
      code: sessionCheck.error || 'INVALID_DINING_SESSION',
      message: sessionCheck.message || 'Access restricted: A valid, active table QR dining session is required.',
    });
  }

  const requestedTable = normalizeTableLabel(body.tableNumber || body.table_number);
  if (requestedTable && requestedTable.toLowerCase() !== sessionCheck.session.tableNumber.toLowerCase()) {
    return sendJson(res, 403, {
      error: 'TABLE_MISMATCH',
      message: `Session is authorized for ${sessionCheck.session.tableNumber}, but order was submitted for ${requestedTable}.`,
    });
  }

  return sendJson(res, 403, {
    error: 'READ_ONLY_MENU',
    message: 'Dining experience is read-only. Orders are placed with café service staff.',
  });
});
