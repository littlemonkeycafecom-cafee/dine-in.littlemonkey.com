import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { advanceSystemTime, getSystemTime } from '../../src/server/qrAuthStore.ts';
import { isProduction } from '../../src/server/config.ts';

export default createApiHandler(async (req, res, { body }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (isProduction()) {
    return sendJson(res, 403, { error: 'TEST_HELPERS_DISABLED_IN_PROD' });
  }

  const ms = Number(body.ms || 0);
  advanceSystemTime(ms);
  return sendJson(res, 200, {
    success: true,
    advancedMs: ms,
    newServerTime: new Date(getSystemTime()).toISOString(),
    timestampMs: getSystemTime(),
  });
});
