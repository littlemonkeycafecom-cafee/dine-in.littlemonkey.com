/**
 * redisClient.ts — Universal Serverless Redis Client for Little Monkey Cafe Dining
 *
 * Implements:
 * 1. Upstash Redis REST Client (stateless HTTP/REST via native fetch, zero connection overhead)
 * 2. In-Memory Mock Redis Client (deterministic testing, TTL eviction, atomic SET NX, pipeline)
 * 3. Connection timeout protection (AbortSignal.timeout(3000))
 * 4. Safe error handling (distinguishes ambiguous timeouts, fails closed, zero credential leakage)
 */
import { isProduction } from './config.ts';

export interface RedisCommandOptions {
  ex?: number; // Expiry in seconds
  nx?: boolean; // Set only if not exists
}

export interface RedisClientInterface {
  name: string;
  set(key: string, value: string, options?: RedisCommandOptions): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  lpush(key: string, ...values: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<'OK'>;
  pipeline(commands: (string | number)[][]): Promise<any[]>;
}

export class RedisError extends Error {
  readonly code: string;

  constructor(message: string, code: string = 'REDIS_ERROR') {
    super(message);
    this.name = 'RedisError';
    this.code = code;
  }
}

export class RedisUnavailableError extends RedisError {
  constructor(message = 'Shared Redis storage service is unavailable or unconfigured.', code = 'REDIS_UNAVAILABLE') {
    super(message, code);
    this.name = 'RedisUnavailableError';
  }
}

export class RedisTimeoutError extends RedisUnavailableError {
  readonly isAmbiguous: boolean;

  constructor(
    message = 'Redis request timed out after 3000ms. Command execution outcome may be ambiguous.',
    isAmbiguous = true
  ) {
    super(message, 'REDIS_TIMEOUT');
    this.name = 'RedisTimeoutError';
    this.isAmbiguous = isAmbiguous;
  }
}

export class RedisConnectionError extends RedisUnavailableError {
  constructor(message = 'Failed to establish connection to Redis storage service.') {
    super(message, 'REDIS_CONNECTION_FAILED');
    this.name = 'RedisConnectionError';
  }
}

/**
 * Upstash Redis REST Client
 * Communicates via standard HTTP POST without requiring TCP connection pools.
 * Ideal for Vercel Serverless and Edge runtimes.
 */
export class UpstashRedisClient implements RedisClientInterface {
  name = 'upstash-rest';
  private restUrl: string;
  private restToken: string;

  constructor(options?: { url?: string; token?: string; restUrl?: string; restToken?: string }) {
    const rawUrl = (options?.restUrl || options?.url || process.env.UPSTASH_REDIS_REST_URL || '').trim();
    const rawToken = (options?.restToken || options?.token || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

    if (!rawUrl || !rawToken) {
      throw new RedisUnavailableError('Missing Upstash Redis REST URL or authentication token.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new RedisUnavailableError(`Invalid Redis REST URL format: malformed URL string.`);
    }

    if (isProduction() && parsedUrl.protocol !== 'https:') {
      throw new RedisUnavailableError(
        `Production Redis REST endpoint must strictly use HTTPS. Insecure protocol rejected: '${parsedUrl.protocol}'.`
      );
    }

    if (/[\r\n\s]/.test(rawToken)) {
      throw new RedisUnavailableError('Invalid Redis authentication token: contains illegal whitespace or control characters.');
    }

    // Clean trailing slash
    this.restUrl = parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, '');
    this.restToken = rawToken;
  }

  private async executeCommand(commandArray: (string | number)[]): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(this.restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandArray),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new RedisError(
          `Redis upstream HTTP ${res.status}: ${res.statusText || 'Request failed'}`,
          'REDIS_HTTP_ERROR'
        );
      }

      const data = await res.json();
      if (data && typeof data === 'object' && 'error' in data) {
        throw new RedisError(String(data.error), 'REDIS_COMMAND_ERROR');
      }

      return data.result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new RedisTimeoutError('Redis command timed out after 3000ms. Mutation state may be ambiguous.', true);
      }
      if (err instanceof RedisError) {
        throw err;
      }
      throw new RedisConnectionError(err?.message || 'Failed to connect to Redis storage.');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async set(key: string, value: string, options?: RedisCommandOptions): Promise<'OK' | null> {
    const cmd: (string | number)[] = ['SET', key, value];
    if (options?.ex !== undefined && options.ex > 0) {
      cmd.push('EX', options.ex);
    }
    if (options?.nx) {
      cmd.push('NX');
    }

    const result = await this.executeCommand(cmd);
    return result === 'OK' ? 'OK' : null;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.executeCommand(['GET', key]);
    return result !== null && result !== undefined ? String(result) : null;
  }

  async del(key: string): Promise<number> {
    const result = await this.executeCommand(['DEL', key]);
    return Number(result || 0);
  }

  async ping(): Promise<string> {
    const result = await this.executeCommand(['PING']);
    return String(result || 'PONG');
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    const result = await this.executeCommand(['LPUSH', key, ...values]);
    return Number(result || 0);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const result = await this.executeCommand(['LTRIM', key, start, stop]);
    return result === 'OK' ? 'OK' : 'OK';
  }

  async pipeline(commands: (string | number)[][]): Promise<any[]> {
    if (commands.length === 0) return [];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${this.restUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new RedisError(
          `Redis upstream HTTP ${res.status}: ${res.statusText || 'Pipeline failed'}`,
          'REDIS_HTTP_ERROR'
        );
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new RedisError('Malformed pipeline response: expected array', 'REDIS_PROTOCOL_ERROR');
      }

      return data.map((item) => (item && typeof item === 'object' && 'result' in item ? item.result : item));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new RedisTimeoutError('Redis pipeline timed out after 3000ms. Mutation state may be ambiguous.', true);
      }
      if (err instanceof RedisError) {
        throw err;
      }
      throw new RedisConnectionError(err?.message || 'Failed to connect to Redis storage.');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * In-Memory Mock Redis Client
 * Provides full atomic simulation of SET NX, EX TTLs, pipeline, and cross-instance behavior.
 * Used for automated QA, local testing, and simulation of multi-instance race conditions.
 */
export class InMemoryRedisMock implements RedisClientInterface {
  name = 'in-memory-mock';
  private storage = new Map<string, { value: string; expiresAt?: number }>();
  private lists = new Map<string, string[]>();
  private simulatedFailure = false;
  private simulatedAmbiguousTimeout = false;

  get store(): Map<string, { value: string; expiresAt?: number }> {
    return this.storage;
  }

  setSimulateFailure(fail: boolean): void {
    this.simulatedFailure = fail;
  }

  setSimulateAmbiguousTimeout(enabled: boolean): void {
    this.simulatedAmbiguousTimeout = enabled;
  }

  private checkFailure(): void {
    if (this.simulatedFailure) {
      throw new RedisConnectionError('Simulated Redis network connection failure.');
    }
  }

  private isExpired(entry: { value: string; expiresAt?: number }): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() >= entry.expiresAt;
  }

  async set(key: string, value: string, options?: RedisCommandOptions): Promise<'OK' | null> {
    this.checkFailure();
    const existing = this.storage.get(key);

    if (options?.nx) {
      if (existing && !this.isExpired(existing)) {
        return null; // Key exists and has not expired
      }
    }

    const expiresAt = options?.ex !== undefined && options.ex > 0 ? Date.now() + options.ex * 1000 : undefined;
    this.storage.set(key, { value, expiresAt });

    if (this.simulatedAmbiguousTimeout) {
      throw new RedisTimeoutError('Simulated ambiguous timeout: command executed in storage but response timed out.', true);
    }

    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    this.checkFailure();
    const entry = this.storage.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.storage.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<number> {
    this.checkFailure();
    const had = this.storage.has(key) || this.lists.has(key);
    this.storage.delete(key);
    this.lists.delete(key);
    return had ? 1 : 0;
  }

  async ping(): Promise<string> {
    this.checkFailure();
    return 'PONG';
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    this.checkFailure();
    let list = this.lists.get(key) || [];
    for (const v of values) {
      list.unshift(v);
    }
    this.lists.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    this.checkFailure();
    let list = this.lists.get(key);
    if (list) {
      const trimmed = list.slice(start, stop + 1);
      this.lists.set(key, trimmed);
    }
    return 'OK';
  }

  async pipeline(commands: (string | number)[][]): Promise<any[]> {
    this.checkFailure();
    const results: any[] = [];
    for (const cmd of commands) {
      const op = String(cmd[0]).toUpperCase();
      if (op === 'SET') {
        const key = String(cmd[1]);
        const value = String(cmd[2]);
        let ex: number | undefined;
        let nx = false;
        for (let i = 3; i < cmd.length; i++) {
          if (String(cmd[i]).toUpperCase() === 'EX') ex = Number(cmd[i + 1]);
          if (String(cmd[i]).toUpperCase() === 'NX') nx = true;
        }
        results.push(await this.set(key, value, { ex, nx }));
      } else if (op === 'GET') {
        results.push(await this.get(String(cmd[1])));
      } else if (op === 'DEL') {
        results.push(await this.del(String(cmd[1])));
      } else if (op === 'LPUSH') {
        const key = String(cmd[1]);
        const vals = cmd.slice(2).map(String);
        results.push(await this.lpush(key, ...vals));
      } else if (op === 'LTRIM') {
        results.push(await this.ltrim(String(cmd[1]), Number(cmd[2]), Number(cmd[3])));
      } else if (op === 'PING') {
        results.push(await this.ping());
      } else {
        results.push('OK');
      }
    }
    return results;
  }

  // Testing helpers
  clear(): void {
    this.storage.clear();
    this.lists.clear();
  }

  advanceTime(ms: number): void {
    const now = Date.now() + ms;
    for (const [k, v] of this.storage.entries()) {
      if (v.expiresAt && now >= v.expiresAt) {
        this.storage.delete(k);
      }
    }
  }

  keyCount(): number {
    return this.storage.size + this.lists.size;
  }
}
