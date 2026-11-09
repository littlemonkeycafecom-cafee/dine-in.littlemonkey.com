import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, extractBearerToken, verifySessionToken, buildDiningSessionCookie } from '../../src/server/http.ts';
import { FIXED_SESSION_DURATION_MS, getSystemTime } from '../../src/server/qrAuthStore.ts';
import { getStorageProvider } from '../../src/server/storage.ts';

export default createApiHandler(async (req, res, { body, clientIp }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const qrProofToken = body.qrProofToken;
  if (!qrProofToken) {
    return sendJson(res, 400, {
      success: false,
      error: 'MISSING_QR_PROOF',
      message: 'Table QR verification proof is required. Please scan a valid table QR code first.',
    });
  }

  const customerToken = extractBearerToken(req);
  const verification = verifySessionToken(customerToken);

  if (!verification.valid || !verification.user) {
    return sendJson(res, 401, {
      success: false,
      error: 'CUSTOMER_AUTH_REQUIRED',
      message: 'Customer authentication required. Please sign in with your 10-digit mobile number and password.',
    });
  }

  const storage = getStorageProvider();
  const sessionResult = await storage.createSession(
    qrProofToken,
    verification.user,
    { ip: clientIp, userAgent: req.headers['user-agent'] as string }
  );

  if (!sessionResult.success || !sessionResult.session) {
    return sendJson(res, 403, {
      success: false,
      error: sessionResult.error,
      message: sessionResult.message || 'Failed to initiate table dining session.',
    });
  }

  const session = sessionResult.session;
  const maxAgeSec = Math.floor(FIXED_SESSION_DURATION_MS / 1000);
  res.setHeader('Set-Cookie', [buildDiningSessionCookie(session.sessionId, maxAgeSec)]);

  return sendJson(res, 200, {
    success: true,
    sessionToken: session.sessionId,
    session: {
      sessionId: session.sessionId,
      tableNumber: session.tableNumber,
      credentialId: session.credentialId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      timeRemainingMs: Math.max(0, session.expiresAt - getSystemTime()),
      durationMs: FIXED_SESSION_DURATION_MS,
    },
    message: `Table ${session.tableNumber} dining session active for 15 minutes.`,
  });
});
