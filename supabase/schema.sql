-- ============================================================================
-- Little Monkey Cafe Dining — Supabase PostgreSQL Schema (Phase 1 Proposed DDL)
-- Target Database: Supabase PostgreSQL (Postgres 15+)
-- Notice: Do not execute in production until explicit owner approval is granted.
-- ============================================================================

-- Enable pgcrypto extension for UUIDs and cryptographic hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Table Credentials (Authoritative physical table QR state)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS table_credentials (
  credential_id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL,
  table_short_code TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  created_by TEXT NOT NULL DEFAULT 'Administrator',
  rotation_count INTEGER NOT NULL DEFAULT 1,
  nfc_uid TEXT,
  nfc_counter INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_table_credentials_table_active
  ON table_credentials (table_number, is_active);

-- ----------------------------------------------------------------------------
-- 2. Dining Sessions (15-Minute Ephemeral In-Cafe Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dining_sessions (
  session_id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL,
  credential_id TEXT NOT NULL REFERENCES table_credentials(credential_id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revocation_reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  logged_out_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dining_sessions_expires_active
  ON dining_sessions (expires_at, is_active);

CREATE INDEX IF NOT EXISTS idx_dining_sessions_table
  ON dining_sessions (table_number, is_active);

-- ----------------------------------------------------------------------------
-- 3. Scan & Authentication Audit Log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_number TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_audit_log_created
  ON scan_audit_log (created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Atomic Stored Procedures & Concurrency Control
-- ----------------------------------------------------------------------------

-- Atomically rotate a table credential, revoking all existing credentials and active sessions
CREATE OR REPLACE FUNCTION rotate_table_credential(
  p_table_number TEXT,
  p_short_code TEXT,
  p_new_credential_id TEXT,
  p_new_secret_hash TEXT,
  p_rotated_by TEXT
) RETURNS VOID AS $$
DECLARE
  v_old_cred RECORD;
BEGIN
  -- 1. Deactivate existing active credentials for this table
  FOR v_old_cred IN
    SELECT credential_id FROM table_credentials
    WHERE table_number = p_table_number AND is_active = TRUE
  LOOP
    UPDATE table_credentials
    SET is_active = FALSE,
        revoked_at = NOW(),
        revoked_by = p_rotated_by
    WHERE credential_id = v_old_cred.credential_id;

    -- Deactivate all active sessions bound to the old credential
    UPDATE dining_sessions
    SET is_active = FALSE,
        revocation_reason = 'CREDENTIAL_ROTATED'
    WHERE credential_id = v_old_cred.credential_id AND is_active = TRUE;
  END LOOP;

  -- 2. Insert the new active credential
  INSERT INTO table_credentials (
    credential_id,
    table_number,
    table_short_code,
    secret_hash,
    is_active,
    created_at,
    created_by,
    rotation_count
  ) VALUES (
    p_new_credential_id,
    p_table_number,
    p_short_code,
    p_new_secret_hash,
    TRUE,
    NOW(),
    p_rotated_by,
    COALESCE((SELECT MAX(rotation_count) + 1 FROM table_credentials WHERE table_number = p_table_number), 1)
  );

  -- 3. Log audit event
  INSERT INTO scan_audit_log (table_number, event_type, status, metadata)
  VALUES (p_table_number, 'CREDENTIAL_ROTATED', 'SUCCESS', jsonb_build_object('credential_id', p_new_credential_id, 'rotated_by', p_rotated_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically revoke all credentials and sessions for a table
CREATE OR REPLACE FUNCTION revoke_table_credential(
  p_table_number TEXT,
  p_revoked_by TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE table_credentials
  SET is_active = FALSE,
      revoked_at = NOW(),
      revoked_by = p_revoked_by
  WHERE table_number = p_table_number AND is_active = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE dining_sessions
  SET is_active = FALSE,
      revocation_reason = 'ADMIN_REVOKED'
  WHERE table_number = p_table_number AND is_active = TRUE;

  INSERT INTO scan_audit_log (table_number, event_type, status, metadata)
  VALUES (p_table_number, 'CREDENTIAL_REVOKED', 'SUCCESS', jsonb_build_object('revoked_by', p_revoked_by));

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- Enforces zero direct public access; only authenticated service role can read/write
-- ----------------------------------------------------------------------------
ALTER TABLE table_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on table_credentials"
  ON table_credentials FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on dining_sessions"
  ON dining_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on scan_audit_log"
  ON scan_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
