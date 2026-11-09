import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractBearerToken } from '../../src/server/http.ts';
import { verifySessionToken } from '../../src/server/qrAuthStore.ts';

export default createApiHandler(async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const token = extractBearerToken(req);
  const verification = verifySessionToken(token);

  if (!verification.valid) {
    return sendJson(res, 401, {
      valid: false,
      error: verification.error,
      message: verification.message,
    });
  }

  return sendJson(res, 200, {
    valid: true,
    user: verification.user,
    token,
  });
});
