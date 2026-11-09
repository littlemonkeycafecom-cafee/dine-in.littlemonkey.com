import { createApiHandler } from '../../_lib/handler.ts';
import { sendJson, checkRateLimit, checkAdminAuth } from '../../../src/server/http.ts';
import { generateTablesPdf } from '../../../src/server/qrAuthStore.ts';
import { getProductionDomain, getStagingDomain } from '../../../src/server/config.ts';

const adminRateLimits = new Map<string, { count: number; resetAt: number }>();

export default createApiHandler(async (req, res, { parsedUrl, body, clientIp }) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const adminLimit = checkRateLimit(adminRateLimits, `admin:${clientIp}`, 30, 60000);
  if (!adminLimit.allowed) {
    return sendJson(res, 429, {
      error: 'TOO_MANY_REQUESTS',
      message: `Administrative rate limit exceeded. Please retry after ${adminLimit.retryAfterSec} seconds.`,
      retryAfter: adminLimit.retryAfterSec,
    });
  }

  if (!checkAdminAuth(req, body, parsedUrl.searchParams)) {
    return sendJson(res, 403, {
      error: 'ADMIN_ACCESS_DENIED',
      message: 'Administrator authorization required to manage dining table QR credentials.',
    });
  }

  const mode = parsedUrl.searchParams.get('mode') || 'staging';
  const isProd = mode === 'production';
  const diningBaseUrl = isProd ? getProductionDomain() : getStagingDomain();

  try {
    const pdfBytes = generateTablesPdf({
      isProduction: isProd,
      diningBaseUrl,
      format: 'a4',
      brandingHeader: 'Little Monkey Café — Dining Table QR Codes',
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="little-monkey-dining-qrs-${mode}.pdf"`
    );
    res.setHeader('Content-Length', String(pdfBytes.length));
    res.end(Buffer.from(pdfBytes));
  } catch (err: any) {
    return sendJson(res, 500, {
      error: 'PDF_GENERATION_FAILED',
      message: err?.message || 'Failed to generate table tents PDF.',
    });
  }
});
