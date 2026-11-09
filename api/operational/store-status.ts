import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { getEnv } from '../../src/server/config.ts';

export default createApiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const sharedBackendOrigin = getEnv('VITE_BACKEND_URL', 'http://localhost:5173');

  try {
    const remoteRes = await fetch(`${sharedBackendOrigin}/api/operational/store-status`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (remoteRes.ok) {
      const data = await remoteRes.json();
      return sendJson(res, 200, data);
    }
  } catch {}

  // Local fallback
  return sendJson(res, 200, {
    isOpen: true,
    dineInEnabled: true,
    tables: [],
    discounts: {},
  });
});
