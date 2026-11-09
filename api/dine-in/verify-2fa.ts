import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, checkRateLimit } from '../../src/server/http.ts';
import { verifyDualFactor } from '../../src/server/qrAuthStore.ts';

const twoFaRateLimits = new Map<string, { count: number; resetAt: number }>();

export default createApiHandler(async (req, res, { parsedUrl, body, clientIp }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const maxAttempts = (clientIp === '127.0.0.1' || clientIp === '::1') ? 60 : 10;
  const limit = checkRateLimit(twoFaRateLimits, `2fa:${clientIp}`, maxAttempts, 60000);
  res.setHeader('X-RateLimit-Limit', String(maxAttempts));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return sendJson(res, 429, {
      error: 'TOO_MANY_REQUESTS',
      message: `Table verification rate limit exceeded. Please retry after ${limit.retryAfterSec} seconds.`,
      retryAfter: limit.retryAfterSec,
    });
  }

  const challengeToken = body?.challengeToken;
  const symbol = body?.symbol;
  const code = body?.code;
  const cred = body?.cred;
  const table = body?.table;

  if (!challengeToken && !cred) {
    return sendJson(res, 400, {
      valid: false,
      error: 'MISSING_CHALLENGE',
      message: 'Challenge token or QR credential is required for dual-factor verification.',
    });
  }

  if (!symbol || !code) {
    return sendJson(res, 400, {
      valid: false,
      error: 'MISSING_SECOND_FACTOR',
      message: 'Both the physical table symbol and 4-character secret code are required to verify table presence.',
    });
  }

  const result = verifyDualFactor({
    table,
    cred,
    challengeToken,
    symbol,
    code,
  });

  if (!result.valid) {
    const statusCode = result.error === 'REVOKED_CREDENTIAL' ? 403 : 400;
    return sendJson(res, statusCode, {
      valid: false,
      error: result.error || 'VERIFICATION_FAILED',
      message: result.message || 'Table verification failed.',
    });
  }

  return sendJson(res, 200, {
    valid: true,
    tableNumber: result.tableNumber,
    shortCode: result.shortCode,
    credentialId: result.credentialId,
    qrProofToken: result.qrProofToken,
    message: `Table ${result.tableNumber} verified successfully.`,
  });
});
