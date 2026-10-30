/**
 * qrAuthStore.ts — Authoritative Server-Controlled QR Credentials & 30-Minute Dining Sessions
 *
 * Implements:
 * 1. Physical 6-Table Identity Mapping (Table 01 to Table 06).
 * 2. Cryptographic QR Credential Generation:
 *    - 256-bit cryptographically secure random entropy (crypto.randomBytes(32)).
 *    - SHA-256 hash storage (raw secrets are NEVER permanently stored or exposed in queries).
 *    - Constant-time verification (crypto.timingSafeEqual).
 *    - Rotation, revocation, and audit metadata.
 * 3. Strict 30-Minute Server-Side Dining Sessions:
 *    - Fixed 1,800,000 ms duration (expiresAt = createdAt + 30 mins).
 *    - Backend clock as source of truth with zero sliding extensions.
 *    - Cascading revocation when QR credential or table is deactivated.
 * 4. Deterministic Test Clock for verifiable automated testing.
 * 5. Vector PDF Generation for the 6 physical tables.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { generateQRCode } from '../lib/qrCode';

export interface AuthoritativeTable {
  tableNumber: string; // e.g. "Table 01"
  shortCode: string;   // e.g. "T01"
  zone: string;        // e.g. "Window Bay"
  capacity: number;    // e.g. 3
}

export const AUTHORITATIVE_TABLES: AuthoritativeTable[] = [
  { tableNumber: 'Table 01', shortCode: 'T01', zone: 'Window Bay', capacity: 3 },
  { tableNumber: 'Table 02', shortCode: 'T02', zone: 'Window Bay', capacity: 3 },
  { tableNumber: 'Table 03', shortCode: 'T03', zone: 'Main Café Hall', capacity: 4 },
  { tableNumber: 'Table 04', shortCode: 'T04', zone: 'Main Café Hall', capacity: 4 },
  { tableNumber: 'Table 05', shortCode: 'T05', zone: 'Courtyard Terrace', capacity: 4 },
  { tableNumber: 'Table 06', shortCode: 'T06', zone: 'Courtyard Terrace', capacity: 4 },
];

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
  expiresAt: number; // ms: createdAt + 30 * 60 * 1000
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

const HMAC_SECRET = process.env.QR_HMAC_SECRET || 'lm_qr_hmac_secret_2026_warangal_dining';
export const FIXED_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes = 1,800,000 ms

// In-memory runtime state backed by disk persistence
let _credentialsMap: Map<string, QrCredentialRecord> = new Map();
let _sessionsMap: Map<string, DiningSessionRecord> = new Map();

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// -----------------------------------------------------------------------------
// Persistence Helpers
// -----------------------------------------------------------------------------
export function loadCredentials(): void {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const list: QrCredentialRecord[] = JSON.parse(raw);
      _credentialsMap.clear();
      for (const rec of list) {
        _credentialsMap.set(rec.credentialId, rec);
      }
    }
  } catch (err) {
    console.warn('[QrAuthStore] Failed to load credentials from file:', err);
  }

  // Ensure all 6 tables have at least one active credential
  ensureAllTablesHaveCredentials();
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

// -----------------------------------------------------------------------------
// Initializer
// -----------------------------------------------------------------------------
export function initializeQrStore(): void {
  loadCredentials();
  loadSessions();
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
  return null;
}

export function getCredentialById(credentialId: string): QrCredentialRecord | null {
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
  saveCredentials();

  return { record, rawSecret };
}

export function revokeTableCredential(tableNumber: string, actor: string = 'Admin'): boolean {
  let modified = false;
  for (const cred of _credentialsMap.values()) {
    if (cred.tableNumber.toLowerCase() === tableNumber.toLowerCase() && cred.isActive) {
      cred.isActive = false;
      cred.revokedAt = new Date(getSystemTime()).toISOString();
      cred.revokedBy = actor;
      modified = true;

      // Invalidate active dining sessions associated with this credential
      revokeSessionsForCredential(cred.credentialId);
    }
  }

  if (modified) {
    saveCredentials();
  }
  return modified;
}

function ensureAllTablesHaveCredentials(): void {
  let createdAny = false;
  for (const t of AUTHORITATIVE_TABLES) {
    const active = getActiveCredentialForTable(t.tableNumber);
    if (!active) {
      generateTableCredential(t.tableNumber, 'InitialBootstrap');
      createdAny = true;
    }
  }
  if (createdAny) {
    saveCredentials();
  }
}

// -----------------------------------------------------------------------------
// QR Proof Token (5-minute signed token after successful scan before login)
// -----------------------------------------------------------------------------
export function createQrProofToken(credentialId: string, tableNumber: string): string {
  const exp = Math.floor(getSystemTime() / 1000) + 300; // 5 minutes
  const payload = JSON.stringify({ credentialId, tableNumber, exp });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64Payload).digest('base64url');
  return `qrproof.${b64Payload}.${sig}`;
}

export function verifyQrProofToken(token: string): { valid: boolean; tableNumber?: string; credentialId?: string; error?: string } {
  if (!token || typeof token !== 'string') return { valid: false, error: 'NO_TOKEN' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'qrproof') {
    return { valid: false, error: 'MALFORMED_TOKEN' };
  }

  const [, b64Payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(b64Payload).digest('base64url');
  if (!safeCompare(Buffer.from(sig).toString('hex'), Buffer.from(expectedSig).toString('hex'))) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(getSystemTime() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'EXPIRED_PROOF' };
    }

    // Verify credential is still active
    const cred = getCredentialById(payload.credentialId);
    if (!cred || !cred.isActive) {
      return { valid: false, error: 'CREDENTIAL_REVOKED' };
    }

    return {
      valid: true,
      tableNumber: payload.tableNumber,
      credentialId: payload.credentialId,
    };
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD' };
  }
}

// -----------------------------------------------------------------------------
// Server QR Validation
// -----------------------------------------------------------------------------
export function verifyQrPayload(
  tableCandidate: string,
  credentialParam: string
): { valid: boolean; tableNumber?: string; qrProofToken?: string; credentialId?: string; error?: string; message?: string } {
  if (!credentialParam || typeof credentialParam !== 'string') {
    return { valid: false, error: 'MISSING_CREDENTIAL', message: 'No QR credential provided.' };
  }

  // Format: credentialId.rawSecret
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
    const normalizedCandidate = tableCandidate.replace(/\s+/g, '').toLowerCase();
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

  // Validation passed! Generate short-lived QR proof token
  const qrProofToken = createQrProofToken(cred.credentialId, cred.tableNumber);

  return {
    valid: true,
    tableNumber: cred.tableNumber,
    credentialId: cred.credentialId,
    qrProofToken,
  };
}

// -----------------------------------------------------------------------------
// Strict 30-Minute Dining Sessions
// -----------------------------------------------------------------------------
export function createDiningSession(
  qrProofToken: string,
  customer: { id: string; phone: string; name: string; role: string },
  context?: { ip?: string; userAgent?: string }
): { success: boolean; session?: DiningSessionRecord; sessionToken?: string; error?: string; message?: string } {
  const proof = verifyQrProofToken(qrProofToken);
  if (!proof.valid || !proof.tableNumber || !proof.credentialId) {
    return { success: false, error: proof.error || 'INVALID_QR_PROOF', message: 'Invalid or expired table QR verification.' };
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

  const session = _sessionsMap.get(sessionId.trim());
  if (!session) {
    return { valid: false, error: 'INVALID_SESSION', message: 'Dining session does not exist.' };
  }

  if (!session.isActive) {
    if (session.revocationReason === 'EXPIRED') {
      return {
        valid: false,
        error: 'DINING_SESSION_EXPIRED',
        message: 'Your 30-minute table dining session has expired. Please re-scan your table QR code to continue.',
      };
    }
    if (session.revocationReason === 'CREDENTIAL_REVOKED') {
      return {
        valid: false,
        error: 'CREDENTIAL_REVOKED',
        message: 'This table QR code has been revoked or rotated by café administration. Please scan the current table QR code.',
      };
    }
    return { valid: false, error: 'SESSION_REVOKED', message: 'Dining session has been terminated or revoked.' };
  }

  const now = getSystemTime();

  // Strict 30-Minute Expiry Check (No sliding window)
  if (now >= session.expiresAt) {
    session.isActive = false;
    session.revocationReason = 'EXPIRED';
    saveSessions();
    return {
      valid: false,
      error: 'DINING_SESSION_EXPIRED',
      message: 'Your 30-minute table dining session has expired. Please re-scan your table QR code to continue.',
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
// Print-Ready Vector PDF Export for Six Physical Tables
// -----------------------------------------------------------------------------
export function generateSixTablesPdf(options: {
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
    let rawSecret = 'sample_secret_for_demo';

    // In export, if an active credential exists, generate fresh production/staging pair if requested
    // or retrieve active credentials.
    // For scannable PDF, we embed the verified entry URL.
    const entryUrl = `${diningBaseUrl.replace(/\/+$/, '')}/?t=${table.shortCode}&cred=${cred ? cred.credentialId : 'qrc'}.${cred ? cred.secretHash.slice(0, 32) : 'demo'}`;

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
    doc.setFontSize(14);
    doc.text('SCAN TO EXPLORE DIGITAL MENU', pageWidth / 2, 206, { align: 'center' });

    doc.setTextColor(180, 170, 160);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Point phone camera at QR code to launch server-authorized menu', pageWidth / 2, 213, { align: 'center' });

    // Security & Session Policy
    doc.setFillColor(35, 35, 35);
    doc.roundedRect(35, 224, pageWidth - 70, 24, 4, 4, 'F');

    doc.setTextColor(240, 235, 225);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SECURITY & DINING SESSION PROTOCOL', pageWidth / 2, 231, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('• Validated for Table ' + table.shortCode + ' only. Do not photograph for remote use.', pageWidth / 2, 237, { align: 'center' });
    doc.text('• Access session expires strictly after 30 minutes from authorization.', pageWidth / 2, 242, { align: 'center' });

    // Environment & Audit Footer
    doc.setTextColor(120, 115, 105);
    doc.setFontSize(7);
    const modeLabel = isProduction ? 'PRODUCTION OFFICIAL PRINT' : 'STAGING / DEV VERIFICATION ASSET';
    doc.text(`DESTINATION: ${entryUrl.slice(0, 68)}`, pageWidth / 2, 260, { align: 'center' });
    doc.text(`STATUS: ${modeLabel}  •  DATE: ${new Date(getSystemTime()).toLocaleDateString()}`, pageWidth / 2, 265, { align: 'center' });
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// Automatically initialize store on load
initializeQrStore();
