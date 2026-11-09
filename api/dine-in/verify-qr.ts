import { createApiHandler } from '../_lib/handler.ts';
import { sendJson, checkRateLimit } from '../../src/server/http.ts';
import { verifyDualFactor } from '../../src/server/qrAuthStore.ts';

const qrRateLimits = new Map<string, { count: number; resetAt: number }>();

export default createApiHandler(async (req, res, { parsedUrl, body, clientIp }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const qrLimit = checkRateLimit(qrRateLimits, `qr:${clientIp}`, 15, 60000);
  res.setHeader('X-RateLimit-Limit', '15');
  res.setHeader('X-RateLimit-Remaining', String(qrLimit.remaining));
  if (!qrLimit.allowed) {
    res.setHeader('Retry-After', String(qrLimit.retryAfterSec));
    return sendJson(res, 429, {
      error: 'TOO_MANY_REQUESTS',
      message: `QR code verification rate limit exceeded. Please retry after ${qrLimit.retryAfterSec} seconds.`,
      retryAfter: qrLimit.retryAfterSec,
    });
  }

  const rawTable = body.table || parsedUrl.searchParams.get('table') || parsedUrl.searchParams.get('t');
  const rawCred = body.cred || parsedUrl.searchParams.get('cred') || body.credential;
  const rawSymbol = body.symbol;
  const rawCode = body.code;
  const rawChallengeToken = body.challengeToken;

  if (!rawCred && !rawChallengeToken) {
    return sendJson(res, 400, {
      valid: false,
      error: 'MISSING_CREDENTIAL',
      message: 'No QR credential detected. Please scan the QR code located on your table.',
    });
  }

  const result = verifyDualFactor({
    table: rawTable,
    cred: rawCred,
    challengeToken: rawChallengeToken,
    symbol: rawSymbol,
    code: rawCode,
  });

  if (result.requires2fa) {
    return sendJson(res, 200, {
      valid: false,
      requires2fa: true,
      tableNumber: result.tableNumber,
      shortCode: result.shortCode,
      challengeToken: result.challengeToken,
      message: result.message || 'Physical table symbol or code verification required.',
    });
  }

  if (!result.valid) {
    const statusCode = result.error === 'REVOKED_CREDENTIAL' ? 403 : 400;
    return sendJson(res, statusCode, {
      valid: false,
      error: result.error || 'VERIFICATION_FAILED',
      message: result.message || 'QR credential verification failed.',
    });
  }

  return sendJson(res, 200, {
    valid: true,
    tableNumber: result.tableNumber,
    shortCode: result.shortCode,
    credentialId: result.credentialId,
    qrProofToken: result.qrProofToken,
    message: `Table ${result.tableNumber} QR verified. Please authenticate to begin dining.`,
  });
});
