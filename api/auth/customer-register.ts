import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { getEnv, isProduction } from '../../src/server/config.ts';
import { getSystemTime } from '../../src/server/qrAuthStore.ts';

export default createApiHandler(async (req, res, { body }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const sharedBackendOrigin = getEnv('VITE_BACKEND_URL', 'http://localhost:5173');

  try {
    const remoteRes = await fetch(`${sharedBackendOrigin}/api/auth/customer-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    const data = await remoteRes.json().catch(() => ({}));
    return sendJson(res, remoteRes.status, data);
  } catch (err: any) {
    if (isProduction()) {
      return sendJson(res, 503, {
        error: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'Authentication service is temporarily unavailable.',
      });
    }

    const { phone, password, fullName } = body || {};
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      return sendJson(res, 400, { error: 'Enter your 10-digit mobile number.' });
    }
    if (!password || password.length < 4) {
      return sendJson(res, 400, { error: 'Password must be at least 4 characters.' });
    }

    const payload = {
      sub: `dev_user_${digits}`,
      phone: `+91${digits}`,
      name: fullName || `Diner ${digits.slice(-4)}`,
      role: 'authenticated',
      iat: Math.floor(getSystemTime() / 1000),
      exp: Math.floor(getSystemTime() / 1000) + 86400,
    };
    const token = `dev_token.${Buffer.from(JSON.stringify(payload)).toString('base64')}.lmc`;

    return sendJson(res, 200, {
      session: {
        access_token: token,
        user: {
          id: payload.sub,
          phone: payload.phone,
          user_metadata: { full_name: payload.name },
        },
      },
      user: {
        id: payload.sub,
        phone: payload.phone,
        user_metadata: { full_name: payload.name },
      },
    });
  }
});
