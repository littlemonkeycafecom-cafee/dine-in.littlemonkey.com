import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractDiningSessionToken } from '../../src/server/http.ts';
import { getStorageProvider } from '../../src/server/storage.ts';
import { getSystemTime } from '../../src/server/qrAuthStore.ts';

export default createApiHandler(async (req, res) => {
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

  return sendJson(res, 200, {
    authenticated: true,
    session: sessionCheck.session,
    timeRemainingMs: sessionCheck.timeRemainingMs,
    timestamp: new Date(getSystemTime()).toISOString(),
  });
});
