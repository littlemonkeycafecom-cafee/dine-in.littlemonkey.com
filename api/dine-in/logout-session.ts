import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractDiningSessionToken, buildClearDiningSessionCookie } from '../../src/server/http.ts';
import { getStorageProvider } from '../../src/server/storage.ts';

export default createApiHandler(async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const sessionToken = extractDiningSessionToken(req);
  if (sessionToken) {
    const storage = getStorageProvider();
    await storage.revokeSession(sessionToken);
  }

  res.setHeader('Set-Cookie', [buildClearDiningSessionCookie()]);

  return sendJson(res, 200, { success: true, message: 'Dining session terminated.' });
});
