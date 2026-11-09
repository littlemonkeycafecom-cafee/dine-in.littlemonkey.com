/**
 * Little Monkey Cafe Dining — Vercel Serverless Handler Wrapper
 * Universal request context, CORS, rate limiting, and structured error responses.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseJsonBody, sendJson, getClientIp } from '../../src/server/http.ts';

export interface VercelHandlerContext {
  parsedUrl: URL;
  body: any;
  clientIp: string;
}

export type VercelRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  context: VercelHandlerContext
) => Promise<any> | any;

export function sanitizeUrlForLogging(rawUrl: string | undefined): string {
  if (!rawUrl) return '/';
  try {
    const u = new URL(rawUrl, 'http://localhost');
    for (const key of ['cred', 'secret', 'token', 'pin', 'password', 'key']) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    return u.pathname + (u.search ? u.search : '');
  } catch {
    return rawUrl.replace(/(cred|secret|token|pin|password)=([^&]+)/gi, '$1=[REDACTED]');
  }
}

export function createApiHandler(handler: VercelRouteHandler) {
  return async function (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host || 'dine-in.littlemonkey.com';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const parsedUrl = new URL(req.url || '/', `${protocol}://${host}`);

    // CORS & Security headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Operational-PIN, X-Admin-PIN');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const body = req.method !== 'GET' && req.method !== 'HEAD' ? await parseJsonBody(req) : {};
      const clientIp = getClientIp(req);

      await handler(req, res, {
        parsedUrl,
        body,
        clientIp,
      });
    } catch (err: any) {
      console.error('[API_ERROR]', sanitizeUrlForLogging(req.url), err);
      sendJson(res, 500, {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred.',
      });
    }
  };
}
