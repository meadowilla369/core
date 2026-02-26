-- User and identity domain baseline.

CREATE TYPE user_status AS ENUM ('active', 'frozen', 'disabled');
CREATE TYPE kyc_status AS ENUM ('not_started', 'pending', 'approved', 'rejected');
CREATE TYPE recovery_status AS ENUM ('initiated', 'awaiting_verification', 'hold', 'completed', 'cancelled', 'expired');
CREATE TYPE verification_channel AS ENUM ('sms', 'email', 'device_proof', 'support');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  wallet_address TEXT UNIQUE,
  status user_status NOT NULL DEFAULT 'active',
  kyc_status kyc_status NOT NULL DEFAULT 'not_started',
  -- PII columns stored encrypted at application level with pgcrypto helpers.
  legal_name_enc BYTEA,
  national_id_enc BYTEA,
  date_of_birth_enc BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_users_phone CHECK (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  device_name TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE user_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status kyc_status NOT NULL,
  document_front_key TEXT,
  document_back_key TEXT,
  selfie_key TEXT,
  score NUMERIC(5,4),
  failure_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status recovery_status NOT NULL DEFAULT 'initiated',
  hold_expires_at TIMESTAMPTZ,
  new_device_fingerprint TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recovery_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_request_id UUID NOT NULL REFERENCES recovery_requests(id) ON DELETE CASCADE,
  channel verification_channel NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recovery_request_id, channel)
);
