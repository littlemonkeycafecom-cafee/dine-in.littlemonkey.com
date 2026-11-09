/**
 * Little Monkey Cafe Dining — Server Environment & Security Configuration
 * Standardized configuration module with fail-closed security invariants.
 */
import fs from 'node:fs';
import path from 'node:path';

let _cachedEnv: Record<string, string> | null = null;

function loadLocalEnvFile(): Record<string, string> {
  if (_cachedEnv !== null) return _cachedEnv;
  const env: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
    }
  } catch {}
  _cachedEnv = env;
  return env;
}

export function getEnv(key: string, defaultValue = ''): string {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key] as string;
  }
  const localEnv = loadLocalEnvFile();
  return localEnv[key] || defaultValue;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Standardized Google Sheets Integration Configuration
 * Unifies SHARED_API_KEY with backwards-compatible GOOGLE_SHEETS_API_KEY fallback.
 */
export function getGoogleSheetsConfig(): {
  webhookUrl: string;
  apiKey: string;
  isConfigured: boolean;
  error?: string;
} {
  const webhookUrl = getEnv('GOOGLE_SHEETS_WEBHOOK_URL').trim();
  const apiKey = (getEnv('SHARED_API_KEY') || getEnv('GOOGLE_SHEETS_API_KEY')).trim();
  const isProd = isProduction();

  if (isProd) {
    const isUrlPlaceholder =
      webhookUrl.includes('AKfycb...') ||
      webhookUrl.includes('your_deployment_id') ||
      webhookUrl.includes('...');
    let isValidUrl = false;
    try {
      const parsed = new URL(webhookUrl);
      isValidUrl = parsed.protocol === 'https:';
    } catch {}

    if (!webhookUrl || isUrlPlaceholder || !isValidUrl) {
      return {
        webhookUrl: '',
        apiKey: '',
        isConfigured: false,
        error: 'GOOGLE_SHEETS_NOT_CONFIGURED: Missing or invalid HTTPS webhook URL in production.',
      };
    }

    const isKeyPlaceholder =
      apiKey.includes('your_') ||
      apiKey.includes('...');
    if (!apiKey || isKeyPlaceholder || apiKey.length < 16) {
      return {
        webhookUrl,
        apiKey: '',
        isConfigured: false,
        error: 'GOOGLE_SHEETS_NOT_CONFIGURED: Authentication secret (SHARED_API_KEY) is invalid or too short in production.',
      };
    }
  }

  const isConfigured =
    Boolean(webhookUrl) &&
    !webhookUrl.includes('AKfycb...') &&
    !webhookUrl.includes('your_deployment_id');

  return { webhookUrl, apiKey, isConfigured };
}

export function getAdminPin(): string {
  return getEnv('ADMIN_OPERATIONAL_PIN') || getEnv('ADMIN_PIN', '9999');
}

/**
 * Standardized Shared Redis Configuration
 * Supports UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN for serverless.
 */
export function getRedisConfig(): {
  restUrl: string;
  restToken: string;
  url: string;
  token: string;
  isConfigured: boolean;
  error?: string;
} {
  const restUrl = (getEnv('UPSTASH_REDIS_REST_URL') || getEnv('REDIS_REST_URL')).trim();
  const restToken = (getEnv('UPSTASH_REDIS_REST_TOKEN') || getEnv('REDIS_REST_TOKEN')).trim();
  const isProd = isProduction();

  if (isProd) {
    if (!restUrl) {
      return {
        restUrl: '',
        restToken: '',
        url: '',
        token: '',
        isConfigured: false,
        error: 'UPSTASH_REDIS_NOT_CONFIGURED: Missing UPSTASH_REDIS_REST_URL in production environment.',
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(restUrl);
    } catch {
      return {
        restUrl: '',
        restToken: '',
        url: '',
        token: '',
        isConfigured: false,
        error: 'UPSTASH_REDIS_NOT_CONFIGURED: Malformed UPSTASH_REDIS_REST_URL format.',
      };
    }

    if (parsed.protocol !== 'https:') {
      return {
        restUrl: '',
        restToken: '',
        url: '',
        token: '',
        isConfigured: false,
        error: `UPSTASH_REDIS_NOT_CONFIGURED: Insecure protocol '${parsed.protocol}'. Production requires HTTPS for Upstash Redis.`,
      };
    }

    if (restUrl.includes('your_') || restUrl.includes('...')) {
      return {
        restUrl: '',
        restToken: '',
        url: '',
        token: '',
        isConfigured: false,
        error: 'UPSTASH_REDIS_NOT_CONFIGURED: Placeholder UPSTASH_REDIS_REST_URL detected in production.',
      };
    }

    if (!restToken || restToken.includes('your_') || restToken.length < 16) {
      return {
        restUrl,
        restToken: '',
        url: restUrl,
        token: '',
        isConfigured: false,
        error: 'UPSTASH_REDIS_NOT_CONFIGURED: Missing or invalid Upstash Redis REST token in production.',
      };
    }
  }

  let isValidUrl = false;
  if (restUrl) {
    try {
      const u = new URL(restUrl);
      isValidUrl = isProd ? u.protocol === 'https:' : (u.protocol === 'https:' || u.protocol === 'http:');
    } catch {
      isValidUrl = false;
    }
  }

  const isConfigured = Boolean(
    restUrl &&
    restToken &&
    isValidUrl &&
    !restUrl.includes('your_') &&
    !restToken.includes('your_')
  );

  return {
    restUrl,
    restToken,
    url: restUrl,
    token: restToken,
    isConfigured,
  };
}

export function getQrHmacSecret(): string {
  const secret = (getEnv('QR_HMAC_SECRET') || getEnv('SESSION_SECRET')).trim();
  const isProd = isProduction();

  if (isProd) {
    const isPlaceholder = !secret || secret.includes('your_') || secret.length < 16;
    const isKnownDefault = secret === 'lm_qr_hmac_secret_2026_warangal_dining';
    if (isPlaceholder || isKnownDefault) {
      throw new Error(
        '[PRODUCTION_SECURITY_ERROR] Production environment requires a secure, high-entropy QR_HMAC_SECRET configured in environment variables. The hardcoded development fallback or placeholder is strictly prohibited.'
      );
    }
  }

  return secret || 'lm_qr_hmac_secret_2026_warangal_dining';
}

export function getQrSecret(): string {
  return getQrHmacSecret();
}

export function getProductionDomain(): string {
  return getEnv('DINING_PRODUCTION_URL', 'https://dine-in.littlemonkey.com');
}

export function getStagingDomain(): string {
  return getEnv('DINING_STAGING_URL', 'http://127.0.0.1:3000');
}
