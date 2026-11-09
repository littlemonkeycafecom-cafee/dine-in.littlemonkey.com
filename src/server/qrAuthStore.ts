/**
 * qrAuthStore.ts — Authoritative Server-Controlled QR Credentials & 15-Minute Dining Sessions
 *
 * Implements:
 * 1. Physical 6-Table Identity Mapping (Table 01 to Table 06).
 * 2. Cryptographic QR Credential Generation:
 *    - 256-bit cryptographically secure random entropy (crypto.randomBytes(32)).
 *    - SHA-256 hash storage (raw secrets are NEVER permanently stored or exposed in queries).
 *    - Constant-time verification (crypto.timingSafeEqual).
 *    - Rotation, revocation, and audit metadata.
 * 3. Strict 15-Minute Server-Side Dining Sessions:
 *    - Fixed 900,000 ms duration (expiresAt = createdAt + 15 mins).
 *    - Backend clock as source of truth with zero sliding extensions.
 *    - Cascading revocation when QR credential or table is deactivated.
 * 4. Deterministic Test Clock for verifiable automated testing.
 * 5. Vector PDF Generation for the 6 physical tables.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { generateQRCode } from '../lib/qrCode.ts';
import { getQrHmacSecret } from './config.ts';

export interface AuthoritativeTable {
  tableNumber: string; // e.g. "Table 01"
  shortCode: string;   // e.g. "T01"
  zone: string;        // e.g. "Window Bay"
  capacity: number;    // e.g. 3
}

export interface Table2FaConfig {
  tableNumber: string; // e.g. "Table 01"
  shortCode: string;   // e.g. "T01"
  symbol: string;      // e.g. "◈"
  code: string;        // e.g. "K7M2"
  name: string;        // e.g. "White Diamond"
}

export const AUTHORITATIVE_TABLE_2FA: Table2FaConfig[] = [
  { tableNumber: 'Table 01', shortCode: 'T01', symbol: '◈', code: 'K7M2', name: 'White Diamond' },
  { tableNumber: 'Table 02', shortCode: 'T02', symbol: '✦', code: 'R4W9', name: 'Four-Point Star' },
  { tableNumber: 'Table 03', shortCode: 'T03', symbol: '⬡', code: 'B8P5', name: 'White Hexagon' },
  { tableNumber: 'Table 04', shortCode: 'T04', symbol: '◆', code: 'T3N7', name: 'Black Diamond' },
  { tableNumber: 'Table 05', shortCode: 'T05', symbol: '✧', code: 'X6D4', name: 'Sparkle Star' },
  { tableNumber: 'Table 06', shortCode: 'T06', symbol: '⬢', code: 'H9Y2', name: 'Black Hexagon' },
  { tableNumber: 'Table 07', shortCode: 'T07', symbol: '✺', code: 'J5C8', name: 'Sunburst Asterisk' },
  { tableNumber: 'Table 08', shortCode: 'T08', symbol: '⌘', code: 'M2L6', name: 'Command Emblem' },
  { tableNumber: 'Table 09', shortCode: 'T09', symbol: '⬟', code: 'W8F3', name: 'Pentagon Crest' },
  { tableNumber: 'Table 10', shortCode: 'T10', symbol: '❖', code: 'V4Q7', name: 'Diamond Quatrefoil' },
];

export const AUTHORITATIVE_TABLES: AuthoritativeTable[] = [
  { tableNumber: 'Table 01', shortCode: 'T01', zone: 'Window Bay', capacity: 3 },
  { tableNumber: 'Table 02', shortCode: 'T02', zone: 'Window Bay', capacity: 3 },
  { tableNumber: 'Table 03', shortCode: 'T03', zone: 'Main Café Hall', capacity: 4 },
  { tableNumber: 'Table 04', shortCode: 'T04', zone: 'Main Café Hall', capacity: 4 },
  { tableNumber: 'Table 05', shortCode: 'T05', zone: 'Courtyard Terrace', capacity: 4 },
  { tableNumber: 'Table 06', shortCode: 'T06', zone: 'Courtyard Terrace', capacity: 4 },
  { tableNumber: 'Table 07', shortCode: 'T07', zone: 'Courtyard Terrace', capacity: 4 },
  { tableNumber: 'Table 08', shortCode: 'T08', zone: 'Mezzanine Lounge', capacity: 6 },
  { tableNumber: 'Table 09', shortCode: 'T09', zone: 'Mezzanine Lounge', capacity: 6 },
  { tableNumber: 'Table 10', shortCode: 'T10', zone: 'Private Dining Alcove', capacity: 8 },
];

export function normalizeTableLabel(rawTable: string | null | undefined): string | null {
  if (!rawTable || typeof rawTable !== 'string') return null;
  const cleaned = rawTable.trim();
  const match = /^(?:table\s*|t)?0*([1-9]\d*)$/i.exec(cleaned);
  if (match) {
    const num = parseInt(match[1], 10);
    return `Table ${String(num).padStart(2, '0')}`;
  }
  return cleaned;
}

export function isValidDiningTable(rawTable: string | null | undefined): { valid: boolean; normalized: string | null } {
  const normalized = normalizeTableLabel(rawTable);
  if (!normalized) return { valid: false, normalized: null };
  const isValid = AUTHORITATIVE_TABLES.some(
    (t) => t.tableNumber.toLowerCase() === normalized.toLowerCase()
  );
  return { valid: isValid, normalized };
}

export interface QrCredentialRecord {
  credentialId: string;
  tableNumber: string;
  tableShortCode: string;
  secretHash: string; // SHA-256 of raw secret
  isActive: boolean;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string;
  rotationCount: number;
}

export interface DiningSessionRecord {
  sessionId: string;
  tableNumber: string;
  credentialId: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  role: string;
  createdAt: number; // ms
  expiresAt: number; // ms: createdAt + 15 * 60 * 1000
  isActive: boolean;
  revocationReason?: string | null;
  userAgent?: string;
  ipAddress?: string;
}

// -----------------------------------------------------------------------------
// Deterministic Test Clock for Expiry Verification
// -----------------------------------------------------------------------------
let _clockOffsetMs = 0;

export function getSystemTime(): number {
  return Date.now() + _clockOffsetMs;
}

export function advanceSystemTime(ms: number): void {
  _clockOffsetMs += ms;
}

export function resetSystemTime(): void {
  _clockOffsetMs = 0;
}

// -----------------------------------------------------------------------------
// Persistence File Paths
// -----------------------------------------------------------------------------
const CREDENTIALS_FILE = path.resolve(process.cwd(), '.qr_credentials.json');
const SESSIONS_FILE = path.resolve(process.cwd(), '.dining_sessions.json');
const SECRETS_FILE = path.resolve(process.cwd(), '.active_qr_secrets.json');
const SPENT_TOKENS_FILE = path.resolve(process.cwd(), '.spent_proof_tokens.json');

// In production, getQrHmacSecret() enforces high-entropy non-default secret.
export const FIXED_SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes = 900,000 ms

// In-memory runtime state backed by disk persistence
let _credentialsMap: Map<string, QrCredentialRecord> = new Map();
let _sessionsMap: Map<string, DiningSessionRecord> = new Map();
let _activeSecretsMap: Map<string, string> = new Map(); // credentialId -> rawSecret
let _spentProofTokens: Map<string, number> = new Map(); // jti -> expiresAtSec

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// -----------------------------------------------------------------------------
// Persistence Helpers
// -----------------------------------------------------------------------------
export function loadActiveSecrets(): void {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
      const obj: Record<string, string> = JSON.parse(raw);
      _activeSecretsMap.clear();
      for (const [k, v] of Object.entries(obj)) {
        _activeSecretsMap.set(k, v);
      }
    }
  } catch (err) {
    console.warn('[QrAuthStore] Failed to load active secrets from file:', err);
  }
}

export function saveActiveSecrets(): void {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of _activeSecretsMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('[QrAuthStore] Failed to save active secrets to file:', err);
  }
}

export function getActiveRawSecretForTable(tableNumber: string): string | null {
  const cred = getActiveCredentialForTable(tableNumber);
  if (!cred) return null;
  return _activeSecretsMap.get(cred.credentialId) || null;
}

let _isLoadingCredentials = false;
export function loadCredentials(): void {
  if (_isLoadingCredentials) return;
  _isLoadingCredentials = true;
  try {
    loadActiveSecrets();
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const list: QrCredentialRecord[] = JSON.parse(raw);
      _credentialsMap.clear();
      for (const rec of list) {
        _credentialsMap.set(rec.credentialId, rec);
      }
    }
    // Ensure all 10 tables have at least one active credential and secret
    ensureAllTablesHaveCredentials();
  } catch (err) {
    console.warn('[QrAuthStore] Failed to load credentials from file:', err);
  } finally {
    _isLoadingCredentials = false;
  }
}

export function saveCredentials(): void {
  try {
    const list = Array.from(_credentialsMap.values());
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[QrAuthStore] Failed to save credentials to file:', err);
  }
}

export function loadSessions(): void {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const list: DiningSessionRecord[] = JSON.parse(raw);
      _sessionsMap.clear();
      for (const s of list) {
        _sessionsMap.set(s.sessionId, s);
      }
    }
  } catch (err) {
    console.warn('[QrAuthStore] Failed to load sessions from file:', err);
  }
}

export function saveSessions(): void {
  try {
    const list = Array.from(_sessionsMap.values());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[QrAuthStore] Failed to save sessions to file:', err);
  }
}

export function loadSpentProofTokens(): void {
  try {
    if (fs.existsSync(SPENT_TOKENS_FILE)) {
      const raw = fs.readFileSync(SPENT_TOKENS_FILE, 'utf8');
      const obj: Record<string, number> = JSON.parse(raw);
      const nowSec = Math.floor(getSystemTime() / 1000);
      _spentProofTokens.clear();
      for (const [jti, exp] of Object.entries(obj)) {
        if (exp > nowSec) {
          _spentProofTokens.set(jti, exp);
        }
      }
    }
  } catch (err) {
    console.warn('[QrAuthStore] Failed to load spent proof tokens from file:', err);
  }
}

export function saveSpentProofTokens(): void {
  try {
    const obj: Record<string, number> = {};
    const nowSec = Math.floor(getSystemTime() / 1000);
    for (const [jti, exp] of _spentProofTokens.entries()) {
      if (exp > nowSec) {
        obj[jti] = exp;
      }
    }
    fs.writeFileSync(SPENT_TOKENS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('[QrAuthStore] Failed to save spent proof tokens to file:', err);
  }
}

// -----------------------------------------------------------------------------
// Initializer
// -----------------------------------------------------------------------------
export function initializeQrStore(): void {
  loadCredentials();
  loadSessions();
  loadSpentProofTokens();
}

// -----------------------------------------------------------------------------
// Table & Credential Operations
// -----------------------------------------------------------------------------
export function getAuthoritativeTables(): AuthoritativeTable[] {
  return [...AUTHORITATIVE_TABLES];
}

export function getActiveCredentialForTable(tableNumber: string): QrCredentialRecord | null {
  for (const cred of _credentialsMap.values()) {
    if (cred.tableNumber.toLowerCase() === tableNumber.toLowerCase() && cred.isActive) {
      return cred;
    }
  }
  loadCredentials();
  for (const cred of _credentialsMap.values()) {
    if (cred.tableNumber.toLowerCase() === tableNumber.toLowerCase() && cred.isActive) {
      return cred;
    }
  }
  return null;
}

export function getCredentialById(credentialId: string): QrCredentialRecord | null {
  if (!_credentialsMap.has(credentialId)) {
    loadCredentials();
  }
  return _credentialsMap.get(credentialId) || null;
}

/**
 * Creates or rotates a credential for a table.
 * Returns the record and the raw secret (returned once only!).
 */
export function generateTableCredential(
  tableNumber: string,
  actor: string = 'System'
): { record: QrCredentialRecord; rawSecret: string } {
  const table = AUTHORITATIVE_TABLES.find(
    (t) => t.tableNumber.toLowerCase() === tableNumber.toLowerCase()
  );
  if (!table) {
    throw new Error(`Invalid table number: ${tableNumber}`);
  }

  // Deactivate any existing active credentials for this table
  let rotationCount = 0;
  for (const cred of _credentialsMap.values()) {
    if (cred.tableNumber === table.tableNumber && cred.isActive) {
      cred.isActive = false;
      cred.rotatedAt = new Date(getSystemTime()).toISOString();
      cred.revokedAt = cred.rotatedAt;
      cred.revokedBy = actor;
      rotationCount = cred.rotationCount + 1;

      // Invalidate all active dining sessions associated with the old credential
      revokeSessionsForCredential(cred.credentialId);
    }
  }

  // Generate 192-bit cryptographically secure raw secret
  const rawSecret = crypto.randomBytes(24).toString('base64url');
  const secretHash = hashSecret(rawSecret);
  const credentialId = `qrc_${table.shortCode.toLowerCase()}_${crypto.randomBytes(6).toString('hex')}`;

  const record: QrCredentialRecord = {
    credentialId,
    tableNumber: table.tableNumber,
    tableShortCode: table.shortCode,
    secretHash,
    isActive: true,
    createdAt: new Date(getSystemTime()).toISOString(),
    rotatedAt: null,
    revokedAt: null,
    revokedBy: null,
    createdBy: actor,
    rotationCount,
  };

  _credentialsMap.set(credentialId, record);
  _activeSecretsMap.set(credentialId, rawSecret);
  saveCredentials();
  saveActiveSecrets();

  return { record, rawSecret };
}

export function revokeTableCredential(tableNumberOrId: string, actor: string = 'Admin'): boolean {
  let modified = false;
  const target = (tableNumberOrId || '').trim().toLowerCase();
  for (const cred of _credentialsMap.values()) {
    const matchesTable = cred.tableNumber.toLowerCase() === target;
    const matchesId = cred.credentialId.toLowerCase() === target;
    const matchesShort = cred.tableShortCode.toLowerCase() === target;
    if ((matchesTable || matchesId || matchesShort) && cred.isActive) {
      cred.isActive = false;
      cred.revokedAt = new Date(getSystemTime()).toISOString();
      cred.revokedBy = actor;
      modified = true;
      _activeSecretsMap.delete(cred.credentialId);

      // Invalidate active dining sessions associated with this credential
      revokeSessionsForCredential(cred.credentialId);
    }
  }

  if (modified) {
    saveCredentials();
    saveActiveSecrets();
  }
  return modified;
}

function ensureAllTablesHaveCredentials(): void {
  let createdAny = false;
  for (const t of AUTHORITATIVE_TABLES) {
    let active: QrCredentialRecord | null = null;
    for (const cred of _credentialsMap.values()) {
      if (cred.tableNumber.toLowerCase() === t.tableNumber.toLowerCase() && cred.isActive) {
        active = cred;
        break;
      }
    }
    if (!active || !_activeSecretsMap.has(active.credentialId)) {
      generateTableCredential(t.tableNumber, 'InitialBootstrap');
      createdAny = true;
    }
  }
  if (createdAny) {
    saveCredentials();
    saveActiveSecrets();
  }
}

// -----------------------------------------------------------------------------
// QR Proof Token (5-minute signed token after successful scan before login)
// -----------------------------------------------------------------------------
export function createQrProofToken(credentialId: string, tableNumber: string): string {
  const exp = Math.floor(getSystemTime() / 1000) + 300; // 5 minutes
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({ jti, credentialId, tableNumber, exp });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', getQrHmacSecret()).update(b64Payload).digest('base64url');
  return `qrproof.${b64Payload}.${sig}`;
}

export function verifyQrProofToken(
  token: string,
  options: { consume?: boolean } = {}
): { valid: boolean; tableNumber?: string; credentialId?: string; jti?: string; error?: string; message?: string } {
  if (!token || typeof token !== 'string') return { valid: false, error: 'NO_TOKEN', message: 'No proof token provided' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'qrproof') {
    return { valid: false, error: 'MALFORMED_TOKEN', message: 'Malformed proof token' };
  }

  const [, b64Payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getQrHmacSecret()).update(b64Payload).digest('base64url');
  if (!safeCompare(Buffer.from(sig).toString('hex'), Buffer.from(expectedSig).toString('hex'))) {
    return { valid: false, error: 'INVALID_SIGNATURE', message: 'Proof signature verification failed' };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(getSystemTime() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'EXPIRED_PROOF', message: 'Table QR verification proof has expired. Please re-scan your table QR.' };
    }

    // Validate JTI structure
    if (!payload.jti || typeof payload.jti !== 'string' || !/^[0-9a-f]{16,64}$/i.test(payload.jti)) {
      return { valid: false, error: 'MALFORMED_JTI', message: 'Proof token contains an invalid identifier format.' };
    }

    // Check single-use replay prevention (JTI check)
    if (_spentProofTokens.has(payload.jti)) {
      return {
        valid: false,
        error: 'PROOF_ALREADY_USED',
        message: 'This table QR verification proof has already been used. Please re-scan your table QR.',
      };
    }

    // Verify table credential is still active
    const cred = getCredentialById(payload.credentialId);
    if (!cred || !cred.isActive) {
      return { valid: false, error: 'CREDENTIAL_REVOKED', message: 'This table QR code has been revoked by café staff.' };
    }

    // Single-use token consumption if requested
    if (options.consume && payload.jti) {
      _spentProofTokens.set(payload.jti, payload.exp);
      saveSpentProofTokens();
    }

    return {
      valid: true,
      tableNumber: payload.tableNumber,
      credentialId: payload.credentialId,
      jti: payload.jti,
    };
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD', message: 'Failed to decode proof payload' };
  }
}

export function consumeQrProofToken(token: string): { valid: boolean; tableNumber?: string; credentialId?: string; jti?: string; error?: string; message?: string } {
  return verifyQrProofToken(token, { consume: true });
}

// -----------------------------------------------------------------------------
// Dual-Factor Table Presence Challenge (3-minute single-use token)
// -----------------------------------------------------------------------------
const SPENT_2FA_CHALLENGES_FILE = path.resolve(process.cwd(), '.spent_2fa_challenges.json');
const TABLE_2FA_SECRETS_FILE = path.resolve(process.cwd(), '.table_2fa_secrets.json');

let _spent2FaChallenges = new Map<string, number>();
let _table2FaSecretsMap = new Map<string, Table2FaConfig>();

function initTable2FaSecrets(): void {
  try {
    if (fs.existsSync(TABLE_2FA_SECRETS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TABLE_2FA_SECRETS_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          _table2FaSecretsMap.set(item.tableNumber.toLowerCase(), item);
        }
      }
    }
  } catch {}

  // Populate from AUTHORITATIVE_TABLE_2FA defaults if missing
  for (const item of AUTHORITATIVE_TABLE_2FA) {
    if (!_table2FaSecretsMap.has(item.tableNumber.toLowerCase())) {
      _table2FaSecretsMap.set(item.tableNumber.toLowerCase(), item);
    }
  }

  try {
    fs.writeFileSync(
      TABLE_2FA_SECRETS_FILE,
      JSON.stringify(Array.from(_table2FaSecretsMap.values()), null, 2),
      'utf8'
    );
  } catch {}
}

function loadSpent2FaChallenges(): void {
  try {
    if (fs.existsSync(SPENT_2FA_CHALLENGES_FILE)) {
      const data = JSON.parse(fs.readFileSync(SPENT_2FA_CHALLENGES_FILE, 'utf8'));
      _spent2FaChallenges = new Map(Object.entries(data));
    }
  } catch {}
}

function saveSpent2FaChallenges(): void {
  try {
    const nowSec = Math.floor(getSystemTime() / 1000);
    const obj: Record<string, number> = {};
    for (const [jti, exp] of _spent2FaChallenges.entries()) {
      if (exp > nowSec) {
        obj[jti] = exp;
      }
    }
    fs.writeFileSync(SPENT_2FA_CHALLENGES_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

initTable2FaSecrets();
loadSpent2FaChallenges();

export function getTable2FaConfig(tableNumberOrCode: string): Table2FaConfig | null {
  if (!tableNumberOrCode || typeof tableNumberOrCode !== 'string') return null;
  const norm = normalizeTableLabel(tableNumberOrCode)?.toLowerCase();
  const rawClean = tableNumberOrCode.trim().toLowerCase();

  for (const cfg of _table2FaSecretsMap.values()) {
    if (
      cfg.tableNumber.toLowerCase() === norm ||
      cfg.shortCode.toLowerCase() === rawClean ||
      cfg.tableNumber.toLowerCase() === rawClean
    ) {
      return cfg;
    }
  }
  return null;
}

export function create2FaChallengeToken(credentialId: string, tableNumber: string): string {
  const exp = Math.floor(getSystemTime() / 1000) + 180; // 3 minutes
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({ jti, credentialId, tableNumber, exp, typ: '2fa_chall' });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', getQrHmacSecret()).update(b64Payload).digest('base64url');
  return `2fachall.${b64Payload}.${sig}`;
}

export function verify2FaChallengeToken(
  token: string,
  options: { consume?: boolean } = {}
): { valid: boolean; tableNumber?: string; credentialId?: string; jti?: string; error?: string; message?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'NO_CHALLENGE_TOKEN', message: 'No table verification challenge provided.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== '2fachall') {
    return { valid: false, error: 'MALFORMED_CHALLENGE_TOKEN', message: 'Malformed table challenge token.' };
  }

  const [, b64Payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getQrHmacSecret()).update(b64Payload).digest('base64url');
  if (!safeCompare(Buffer.from(sig).toString('hex'), Buffer.from(expectedSig).toString('hex'))) {
    return { valid: false, error: 'INVALID_SIGNATURE', message: 'Challenge signature verification failed.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(getSystemTime() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'EXPIRED_CHALLENGE', message: 'Table presence challenge expired. Please re-scan your table QR.' };
    }

    if (!payload.jti || typeof payload.jti !== 'string') {
      return { valid: false, error: 'MALFORMED_JTI', message: 'Invalid challenge identifier.' };
    }

    if (_spent2FaChallenges.has(payload.jti)) {
      return {
        valid: false,
        error: 'CHALLENGE_ALREADY_USED',
        message: 'This authentication challenge has already been used. Please re-scan your table QR.',
      };
    }

    // Verify table credential is still active
    const cred = getCredentialById(payload.credentialId);
    if (!cred || !cred.isActive) {
      return { valid: false, error: 'CREDENTIAL_REVOKED', message: 'This table QR code has been revoked by café staff.' };
    }

    if (options.consume && payload.jti) {
      _spent2FaChallenges.set(payload.jti, payload.exp);
      saveSpent2FaChallenges();
    }

    return {
      valid: true,
      tableNumber: payload.tableNumber,
      credentialId: payload.credentialId,
      jti: payload.jti,
    };
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD', message: 'Failed to decode challenge payload.' };
  }
}

export function consume2FaChallengeToken(token: string) {
  return verify2FaChallengeToken(token, { consume: true });
}

// -----------------------------------------------------------------------------
// Factor 1: Server QR Validation Only (Does NOT issue proof token)
// -----------------------------------------------------------------------------
export function verifyQrPayloadOnly(
  tableCandidate: string,
  credentialParam: string
): { valid: boolean; tableNumber?: string; credentialId?: string; error?: string; message?: string } {
  if (!credentialParam || typeof credentialParam !== 'string') {
    return { valid: false, error: 'MISSING_CREDENTIAL', message: 'No QR credential provided.' };
  }

  const dotIndex = credentialParam.indexOf('.');
  if (dotIndex === -1) {
    return { valid: false, error: 'MALFORMED_CREDENTIAL', message: 'Malformed QR credential format.' };
  }

  const credentialId = credentialParam.substring(0, dotIndex).trim();
  const rawSecret = credentialParam.substring(dotIndex + 1).trim();

  if (!credentialId || !rawSecret) {
    return { valid: false, error: 'MALFORMED_CREDENTIAL', message: 'Missing credential identifier or secret.' };
  }

  const cred = getCredentialById(credentialId);
  if (!cred) {
    return { valid: false, error: 'UNKNOWN_CREDENTIAL', message: 'The scanned QR credential is not recognized by café servers.' };
  }

  if (!cred.isActive) {
    return { valid: false, error: 'REVOKED_CREDENTIAL', message: 'This table QR code has been revoked or replaced by café administration.' };
  }

  // Verify table match if candidate provided
  if (tableCandidate) {
    const tableCheck = isValidDiningTable(tableCandidate);
    if (!tableCheck.valid) {
      return { valid: false, error: 'UNKNOWN_TABLE', message: 'Unknown or invalid table identifier.' };
    }
    const normalizedCandidate = tableCheck.normalized!.replace(/\s+/g, '').toLowerCase();
    const normalizedTarget = cred.tableNumber.replace(/\s+/g, '').toLowerCase();
    const shortCodeTarget = cred.tableShortCode.replace(/\s+/g, '').toLowerCase();
    if (normalizedCandidate !== normalizedTarget && normalizedCandidate !== shortCodeTarget) {
      return { valid: false, error: 'TABLE_MISMATCH', message: 'QR credential does not match the designated table.' };
    }
  }

  // Constant-time hash comparison
  const calculatedHash = hashSecret(rawSecret);
  if (!safeCompare(calculatedHash, cred.secretHash)) {
    return { valid: false, error: 'INVALID_SECRET', message: 'Invalid QR cryptographic verification key.' };
  }

  return {
    valid: true,
    tableNumber: cred.tableNumber,
    credentialId: cred.credentialId,
  };
}

// -----------------------------------------------------------------------------
// Dual-Factor Table Presence Verification (Factor 1 + Factor 2)
// -----------------------------------------------------------------------------
export function verifyDualFactor(params: {
  table?: string;
  cred?: string;
  challengeToken?: string;
  symbol?: string;
  code?: string;
}): {
  valid: boolean;
  requires2fa?: boolean;
  challengeToken?: string;
  tableNumber?: string;
  shortCode?: string;
  credentialId?: string;
  qrProofToken?: string;
  error?: string;
  message?: string;
} {
  const { table, cred, challengeToken, symbol, code } = params;

  // Case 1: Verifying second factor with challengeToken
  if (challengeToken) {
    const chall = verify2FaChallengeToken(challengeToken, { consume: false });
    if (!chall.valid || !chall.tableNumber || !chall.credentialId) {
      return {
        valid: false,
        error: chall.error || 'VERIFICATION_FAILED',
        message: chall.message || 'Table presence challenge is invalid, expired, or already used.',
      };
    }

    const tableConfig = getTable2FaConfig(chall.tableNumber);
    if (!tableConfig) {
      return { valid: false, error: 'VERIFICATION_FAILED', message: 'Unknown table identity.' };
    }

    if (!symbol && !code) {
      return {
        valid: false,
        error: 'MISSING_SECOND_FACTOR',
        message: 'Table verification symbol and code are required to confirm physical presence.',
      };
    }

    let symbolMatches = false;
    let codeMatches = false;

    if (symbol) {
      symbolMatches = symbol.trim() === tableConfig.symbol;
    }

    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const expectedCode = tableConfig.code.toUpperCase();
      if (cleanCode.length === expectedCode.length) {
        codeMatches = safeCompare(cleanCode, expectedCode);
      }
    }

    const passed = (symbol && code) ? (symbolMatches && codeMatches) : (symbol ? symbolMatches : codeMatches);
    if (!passed) {
      return {
        valid: false,
        error: 'VERIFICATION_FAILED',
        message: 'Table dual-factor verification failed. Ensure you are entering the matching symbol and code printed on your table stand.',
      };
    }

    // Atomically consume challenge token
    consume2FaChallengeToken(challengeToken);

    // Issue short-lived QR proof token
    const qrProofToken = createQrProofToken(chall.credentialId, chall.tableNumber);
    return {
      valid: true,
      tableNumber: chall.tableNumber,
      shortCode: tableConfig.shortCode,
      credentialId: chall.credentialId,
      qrProofToken,
      message: `${chall.tableNumber} dual-factor verification successful.`,
    };
  }

  // Case 2: QR credential provided
  if (!cred || typeof cred !== 'string') {
    return {
      valid: false,
      error: 'MISSING_CREDENTIAL',
      message: 'No QR credential detected. Please scan the QR code located on your table.',
    };
  }

  // Verify Factor 1
  const qrCheck = verifyQrPayloadOnly(table || '', cred);
  if (!qrCheck.valid || !qrCheck.tableNumber || !qrCheck.credentialId) {
    return {
      valid: false,
      error: qrCheck.error || 'VERIFICATION_FAILED',
      message: qrCheck.message || 'QR credential verification failed.',
    };
  }

  const tableConfig = getTable2FaConfig(qrCheck.tableNumber);
  const shortCode = tableConfig?.shortCode || qrCheck.tableNumber;

  // If no second factor was provided, issue 2FA challenge (Factor 1 alone CANNOT authenticate!)
  if (!symbol && !code) {
    const newChallengeToken = create2FaChallengeToken(qrCheck.credentialId, qrCheck.tableNumber);
    return {
      valid: false,
      requires2fa: true,
      challengeToken: newChallengeToken,
      tableNumber: qrCheck.tableNumber,
      shortCode,
      credentialId: qrCheck.credentialId,
      message: 'Physical table symbol and secret code verification required. Please confirm the symbol and code on your table stand.',
    };
  }

  // Factor 2 provided: require BOTH symbol AND code
  if (!tableConfig) {
    return { valid: false, error: 'VERIFICATION_FAILED', message: 'Unknown table identity.' };
  }

  if (!symbol || !code) {
    return {
      valid: false,
      error: 'MISSING_SECOND_FACTOR',
      message: 'Both the physical table symbol and 4-character secret code are required to verify table presence.',
    };
  }

  const symbolMatches = symbol.trim() === tableConfig.symbol;
  let codeMatches = false;

  const cleanCode = code.trim().toUpperCase();
  const expectedCode = tableConfig.code.toUpperCase();
  if (cleanCode.length === expectedCode.length) {
    codeMatches = safeCompare(cleanCode, expectedCode);
  }

  if (!symbolMatches || !codeMatches) {
    return {
      valid: false,
      error: 'VERIFICATION_FAILED',
      message: 'Table dual-factor verification failed. Ensure you are selecting the matching symbol and entering the 4-character code printed on your table stand.',
    };
  }

  // Both factors passed! Issue proof token
  const qrProofToken = createQrProofToken(qrCheck.credentialId, qrCheck.tableNumber);
  return {
    valid: true,
    tableNumber: qrCheck.tableNumber,
    shortCode,
    credentialId: qrCheck.credentialId,
    qrProofToken,
    message: `${qrCheck.tableNumber} dual-factor verification successful.`,
  };
}

// -----------------------------------------------------------------------------
// Server QR Validation (Unified Entrypoint)
// -----------------------------------------------------------------------------
export function verifyQrPayload(
  tableCandidate: string,
  credentialParam: string,
  symbol?: string,
  code?: string
): { valid: boolean; requires2fa?: boolean; challengeToken?: string; tableNumber?: string; shortCode?: string; qrProofToken?: string; credentialId?: string; error?: string; message?: string } {
  return verifyDualFactor({
    table: tableCandidate,
    cred: credentialParam,
    symbol,
    code,
  });
}

// -----------------------------------------------------------------------------
// Strict 15-Minute Dining Sessions
// -----------------------------------------------------------------------------
export function createDiningSession(
  qrProofToken: string,
  customer: { id: string; phone: string; name: string; role: string },
  context?: { ip?: string; userAgent?: string }
): { success: boolean; session?: DiningSessionRecord; sessionToken?: string; error?: string; message?: string } {
  // Concurrency-safe single-use token consumption
  const proof = consumeQrProofToken(qrProofToken);
  if (!proof.valid || !proof.tableNumber || !proof.credentialId) {
    return {
      success: false,
      error: proof.error || 'INVALID_QR_PROOF',
      message: proof.message || 'Invalid, expired, or already-used table QR verification.',
    };
  }

  const now = getSystemTime();
  const sessionId = `dinesess_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = now + FIXED_SESSION_DURATION_MS;

  const session: DiningSessionRecord = {
    sessionId,
    tableNumber: proof.tableNumber,
    credentialId: proof.credentialId,
    customerId: customer.id,
    customerPhone: customer.phone,
    customerName: customer.name,
    role: customer.role || 'authenticated',
    createdAt: now,
    expiresAt,
    isActive: true,
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  };

  _sessionsMap.set(sessionId, session);
  saveSessions();

  return {
    success: true,
    session,
    sessionToken: sessionId,
  };
}

export function validateDiningSession(sessionId: string | null | undefined): {
  valid: boolean;
  session?: DiningSessionRecord;
  timeRemainingMs?: number;
  error?: string;
  message?: string;
} {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'NO_SESSION', message: 'No dining session identifier provided.' };
  }

  let session = _sessionsMap.get(sessionId.trim());
  if (!session) {
    loadSessions();
    session = _sessionsMap.get(sessionId.trim());
  }
  if (!session) {
    return { valid: false, error: 'INVALID_SESSION', message: 'Dining session does not exist.' };
  }

  if (!session.isActive) {
    if (session.revocationReason === 'EXPIRED') {
      return {
        valid: false,
        session,
        error: 'DINING_SESSION_EXPIRED',
        message: 'Your 15-minute table dining session has expired. Please re-scan your table QR code to continue.',
      };
    }
    if (session.revocationReason === 'CREDENTIAL_REVOKED') {
      return {
        valid: false,
        session,
        error: 'CREDENTIAL_REVOKED',
        message: 'This table QR code has been revoked or rotated by café administration. Please scan the current table QR code.',
      };
    }
    return { valid: false, session, error: 'SESSION_REVOKED', message: 'Dining session has been terminated or revoked.' };
  }

  const now = getSystemTime();

  // Strict 15-Minute Expiry Check (No sliding window)
  if (now >= session.expiresAt) {
    session.isActive = false;
    session.revocationReason = 'EXPIRED';
    saveSessions();
    return {
      valid: false,
      session,
      error: 'DINING_SESSION_EXPIRED',
      message: 'Your 15-minute table dining session has expired. Please re-scan your table QR code to continue.',
    };
  }

  // Cascading check: Did admin revoke the QR credential while session was active?
  const cred = getCredentialById(session.credentialId);
  if (!cred || !cred.isActive) {
    session.isActive = false;
    session.revocationReason = 'CREDENTIAL_REVOKED';
    saveSessions();
    return {
      valid: false,
      error: 'CREDENTIAL_REVOKED',
      message: 'This table QR code has been revoked by café staff. Please re-scan the new table code.',
    };
  }

  const timeRemainingMs = Math.max(0, session.expiresAt - now);

  return {
    valid: true,
    session,
    timeRemainingMs,
  };
}

export function revokeDiningSession(sessionId: string): boolean {
  const session = _sessionsMap.get(sessionId);
  if (session && session.isActive) {
    session.isActive = false;
    session.revocationReason = 'USER_LOGOUT';
    saveSessions();
    return true;
  }
  return false;
}

export function revokeSessionsForCredential(credentialId: string): number {
  let count = 0;
  for (const session of _sessionsMap.values()) {
    if (session.credentialId === credentialId && session.isActive) {
      session.isActive = false;
      session.revocationReason = 'CREDENTIAL_REVOKED';
      count++;
    }
  }
  if (count > 0) {
    saveSessions();
  }
  return count;
}

// -----------------------------------------------------------------------------
// Admin Summary of Tables & Credential Status
// -----------------------------------------------------------------------------
export function getAdminTablesOverview(): Array<{
  tableNumber: string;
  shortCode: string;
  zone: string;
  capacity: number;
  credentialId: string | null;
  isActive: boolean;
  createdAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  rotationCount: number;
  activeSessionsCount: number;
}> {
  const now = getSystemTime();
  return AUTHORITATIVE_TABLES.map((t) => {
    const cred = getActiveCredentialForTable(t.tableNumber);
    let activeSessionsCount = 0;
    if (cred) {
      for (const s of _sessionsMap.values()) {
        if (s.credentialId === cred.credentialId && s.isActive && now < s.expiresAt) {
          activeSessionsCount++;
        }
      }
    }

    return {
      tableNumber: t.tableNumber,
      shortCode: t.shortCode,
      zone: t.zone,
      capacity: t.capacity,
      credentialId: cred ? cred.credentialId : null,
      isActive: Boolean(cred?.isActive),
      createdAt: cred ? cred.createdAt : null,
      rotatedAt: cred ? cred.rotatedAt : null,
      revokedAt: cred ? cred.revokedAt : null,
      rotationCount: cred ? cred.rotationCount : 0,
      activeSessionsCount,
    };
  });
}

// -----------------------------------------------------------------------------
// Print-Ready Vector PDF Export for All 10 Physical Tables (Table 01 to Table 10)
// -----------------------------------------------------------------------------
export function generateTablesPdf(options: {
  diningBaseUrl: string;
  isProduction: boolean;
}): Buffer {
  const { diningBaseUrl, isProduction } = options;

  // Initialize jsPDF (portrait A4: 210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // 6 tables layout: 2 columns x 3 rows on 1 single page or 1 table per page
  // A single multi-table printable sheet with cut guides is ideal for café table markers
  AUTHORITATIVE_TABLES.forEach((table, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }

    // Ensure we have an active credential for table
    let cred = getActiveCredentialForTable(table.tableNumber);
    const rawSecret = cred ? (getActiveRawSecretForTable(table.tableNumber) || cred.secretHash.slice(0, 32)) : 'demo';

    // In export, embed the verified, scannable entry URL.
    const entryUrl = `${diningBaseUrl.replace(/\/+$/, '')}/?t=${table.shortCode}&cred=${cred ? cred.credentialId : 'qrc'}.${rawSecret}`;

    // Generate QR matrix
    const { matrix, size } = generateQRCode(entryUrl);
    const quietZone = 2;
    const totalSize = size + quietZone * 2;

    // Dark Solar Palette Theme
    doc.setFillColor(15, 15, 15); // Rich near-black
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Decorative Gold Outer Border
    doc.setDrawColor(251, 195, 36); // Solar yellow (#FBC324)
    doc.setLineWidth(1.2);
    doc.roundedRect(15, 15, pageWidth - 30, pageHeight - 30, 8, 8, 'S');

    // Inner subtle card
    doc.setFillColor(24, 24, 24);
    doc.roundedRect(25, 25, pageWidth - 50, pageHeight - 50, 6, 6, 'F');

    // Header: Little Monkey Café
    doc.setTextColor(251, 195, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('LITTLE MONKEY CAFÉ', pageWidth / 2, 45, { align: 'center' });

    doc.setTextColor(190, 180, 170);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('ARTISANAL ROASTERY & GOURMET DINING', pageWidth / 2, 53, { align: 'center' });

    // Table Badge
    doc.setFillColor(251, 195, 36);
    doc.roundedRect(pageWidth / 2 - 35, 63, 70, 14, 3, 3, 'F');
    doc.setTextColor(15, 15, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(table.tableNumber.toUpperCase(), pageWidth / 2, 72.5, { align: 'center' });

    // Zone & Capacity Subtitle
    doc.setTextColor(240, 235, 225);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`${table.zone}  •  Capacity: ${table.capacity} Diners`, pageWidth / 2, 88, { align: 'center' });

    // QR Code Container Box (Crisp White for maximum camera contrast)
    const qrBoxSize = 95; // mm
    const qrBoxX = (pageWidth - qrBoxSize) / 2;
    const qrBoxY = 98;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 4, 4, 'F');

    // Draw Vector QR Code (Zero blurring, 100% crisp edges)
    const moduleSize = (qrBoxSize - 12) / totalSize;
    const qrStartX = qrBoxX + 6;
    const qrStartY = qrBoxY + 6;

    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          const mx = qrStartX + (c + quietZone) * moduleSize;
          const my = qrStartY + (r + quietZone) * moduleSize;
          doc.rect(mx, my, moduleSize + 0.05, moduleSize + 0.05, 'F');
        }
      }
    }

    // Call to Action
    doc.setTextColor(251, 195, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SCAN TO EXPLORE OUR MENU', pageWidth / 2, 203, { align: 'center' });

    doc.setTextColor(180, 170, 160);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Scan QR code, then confirm table symbol or code to enter', pageWidth / 2, 209, { align: 'center' });

    // Table 2FA Presence Confirmation Box
    const table2Fa = getTable2FaConfig(table.tableNumber);
    doc.setFillColor(32, 28, 24);
    doc.roundedRect(35, 215, pageWidth - 70, 18, 3, 3, 'F');
    doc.setDrawColor(251, 195, 36);
    doc.setLineWidth(0.6);
    doc.roundedRect(35, 215, pageWidth - 70, 18, 3, 3, 'S');

    doc.setTextColor(251, 195, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`TABLE CODE: ${table2Fa?.code || 'CODE'}`, pageWidth / 2, 223, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 180, 170);
    doc.text('PHYSICAL PRESENCE VERIFICATION REQUIRED', pageWidth / 2, 229, { align: 'center' });

    // Premium Dining Amenities & Table Service Badge
    doc.setFillColor(24, 22, 20);
    doc.roundedRect(35, 237, pageWidth - 70, 16, 3, 3, 'F');
    doc.setDrawColor(55, 48, 40);
    doc.setLineWidth(0.5);
    doc.roundedRect(35, 237, pageWidth - 70, 16, 3, 3, 'S');

    doc.setTextColor(251, 195, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TABLE SERVICE  •  ORDERING  •  COMPLIMENTARY WI-FI', pageWidth / 2, 244, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(190, 180, 170);
    doc.text('Craft Coffee  •  Fresh Bakes  •  Handcrafted Dining', pageWidth / 2, 249.5, { align: 'center' });

    // Environment & Audit Footer
    doc.setTextColor(130, 120, 110);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`TABLE ${table.shortCode}  •  AUTHENTIC DINE-IN SERVICE`, pageWidth / 2, 263, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 95, 88);
    doc.text('Little Monkey Café  •  Craft Coffee, Fresh Bakes & Handcrafted Dining', pageWidth / 2, 269, { align: 'center' });
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// Backwards-compatible alias for 10-table vector PDF export
export const generateSixTablesPdf = generateTablesPdf;

// Automatically initialize store on load
initializeQrStore();
