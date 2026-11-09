import fs from 'node:fs';
import path from 'node:path';
import { createApiHandler } from '../../_lib/handler.ts';
import { sendJson, checkRateLimit, checkAdminAuth } from '../../../src/server/http.ts';
import { isValidDiningTable } from '../../../src/server/dineInServerPlugin.ts';

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
      message: 'Administrator authorization required to download table QR artwork.',
    });
  }

  const tableParam = parsedUrl.searchParams.get('table');
  const formatParam = (parsedUrl.searchParams.get('format') || 'png').toLowerCase();
  const fileParam = parsedUrl.searchParams.get('file');

  const storageDir = path.resolve(process.cwd(), 'storage/qr-codes');

  if (fileParam === 'html' || formatParam === 'html') {
    const htmlPath = path.join(storageDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      return sendJson(res, 404, {
        error: 'ARTWORK_NOT_FOUND',
        message: 'The table QR design studio preview has not been generated yet.',
      });
    }
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(htmlContent);
    return;
  }

  if (fileParam === 'manifest' || fileParam === 'json' || formatParam === 'json') {
    const jsonPath = path.join(storageDir, 'index.json');
    if (!fs.existsSync(jsonPath)) {
      return sendJson(res, 404, {
        error: 'ARTWORK_NOT_FOUND',
        message: 'The table QR manifest has not been generated yet.',
      });
    }
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, no-cache');
    res.end(jsonContent);
    return;
  }

  if (fileParam === 'pdf' || formatParam === 'pdf' || tableParam === 'all') {
    const pdfPath = path.join(storageDir, 'little-monkey-table-qrs.pdf');
    if (!fs.existsSync(pdfPath)) {
      return sendJson(res, 404, {
        error: 'ARTWORK_NOT_FOUND',
        message: 'The requested PDF artwork file has not been generated yet.',
      });
    }
    const pdfBuffer = fs.readFileSync(pdfPath);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="little-monkey-table-qrs.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'private, no-store, no-cache');
    res.end(pdfBuffer);
    return;
  }

  if (!tableParam) {
    return sendJson(res, 400, {
      error: 'MISSING_TABLE_PARAMETER',
      message: 'table parameter is required (e.g., Table 01, T01, or file=pdf).',
    });
  }

  const { valid, normalized } = isValidDiningTable(tableParam);
  if (!valid || !normalized) {
    return sendJson(res, 400, {
      error: 'INVALID_TABLE',
      message: `Unknown or invalid dining table "${tableParam}".`,
    });
  }

  if (formatParam !== 'png' && formatParam !== 'svg') {
    return sendJson(res, 400, {
      error: 'INVALID_FORMAT',
      message: 'Format must be either "png" or "svg".',
    });
  }

  const shortCodeMatch = /0*([1-9]|10)$/.exec(normalized);
  const num = shortCodeMatch ? parseInt(shortCodeMatch[1], 10) : 1;
  const shortSlug = `t${String(num).padStart(2, '0')}`;
  const fileName = `table-${shortSlug}.${formatParam}`;
  const filePath = path.join(storageDir, fileName);

  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, {
      error: 'ARTWORK_NOT_FOUND',
      message: `Artwork file ${fileName} has not been generated yet.`,
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const contentType = formatParam === 'svg' ? 'image/svg+xml' : 'image/png';
  const isInline = parsedUrl.searchParams.get('inline') === '1' || parsedUrl.searchParams.get('inline') === 'true';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', isInline ? `inline; filename="${fileName}"` : `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', String(fileBuffer.length));
  res.setHeader('Cache-Control', isInline ? 'public, max-age=60' : 'private, no-store, no-cache');
  res.end(fileBuffer);
});
