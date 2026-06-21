-- Canonical local development schema.
-- Reset with scripts/reset-db.sh. Keep this file as the single local schema source of truth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE token_listing_status AS ENUM ('none', 'active', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  freeze_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_devices_user_id ON user_devices (user_id);

CREATE TABLE user_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_audit_logs_user_id ON user_audit_logs (user_id, created_at DESC);

CREATE TABLE auth_otp_requests (
  key TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  request_id TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_rate_attempts (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_rate_attempts_phone ON auth_rate_attempts (phone, attempted_at);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_refresh_token TEXT NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id);

CREATE TABLE auth_refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  session_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_handoff_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  source_session_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Temporarily skipped with kyc-service in localchain/localchain-ios startup.
-- CREATE TABLE kyc_records (
--   id TEXT PRIMARY KEY,
--   user_id TEXT NOT NULL UNIQUE,
--   provider TEXT NOT NULL,
--   status TEXT NOT NULL CHECK (status IN ('pending', 'document_uploaded', 'in_review', 'approved', 'rejected')),
--   cccd_number TEXT,
--   front_image_ref TEXT,
--   back_image_ref TEXT,
--   selfie_image_ref TEXT,
--   liveness_score NUMERIC,
--   face_match_score NUMERIC,
--   rejection_reason TEXT,
--   document_archive_object_key TEXT,
--   face_match_archive_object_key TEXT,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE TABLE kyc_provider_status (
--   provider TEXT PRIMARY KEY,
--   status TEXT NOT NULL CHECK (status IN ('up', 'down')),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  onchain_event_id NUMERIC(78, 0) UNIQUE,
  organizer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'active', 'cancelled')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_types (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  onchain_ticket_type_id NUMERIC(78, 0) UNIQUE,
  name TEXT NOT NULL,
  unit_price BIGINT NOT NULL,
  quantity INTEGER NOT NULL,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE gates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_inventory (
  ticket_type_id TEXT PRIMARY KEY REFERENCES ticket_types(id) ON DELETE CASCADE,
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  locked_count INTEGER NOT NULL DEFAULT 0 CHECK (locked_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL
);


CREATE TABLE check_ins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  gate_id TEXT REFERENCES gates(id),
  qr_nonce TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, token_id),
  UNIQUE (event_id, qr_nonce)
);

CREATE INDEX idx_check_ins_event_scan ON check_ins(event_id, scanned_at DESC);
CREATE INDEX idx_check_ins_gate_scan ON check_ins(gate_id, scanned_at DESC);

CREATE TABLE scan_rejections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  gate_id TEXT,
  reason TEXT NOT NULL,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_rejections_event ON scan_rejections(event_id, rejected_at DESC);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL UNIQUE REFERENCES reservations(id),
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  buyer_wallet_address TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_intents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('momo', 'vnpay')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  gateway_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_webhook_events (
  id TEXT PRIMARY KEY,
  gateway TEXT NOT NULL CHECK (gateway IN ('momo', 'vnpay')),
  event_key TEXT NOT NULL UNIQUE,
  payment_reference TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processed', 'queued_retry', 'rejected')),
  attempt_count INTEGER NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payment_retry_jobs (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE REFERENCES payment_webhook_events(event_key) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  last_error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_idempotency (
  scope TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_wallet_prefunds (
  wallet_address TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  prefund_tx_hash TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  funded_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payment_hashes (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  nonce TEXT NOT NULL,
  payment_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  signer_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('issued', 'used', 'expired')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  chain_id INTEGER NOT NULL,
  verifying_contract TEXT NOT NULL,
  typed_data JSONB NOT NULL
);


CREATE TABLE marketplace_listings (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  seller_user_id TEXT NOT NULL,
  seller_wallet_address TEXT NOT NULL,
  original_price INTEGER NOT NULL,
  ask_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_marketplace_listings_token_id ON marketplace_listings (token_id);

CREATE TABLE marketplace_buy_hashes (
  order_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_user_id TEXT NOT NULL,
  buyer_wallet_address TEXT NOT NULL,
  amount INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  payment_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  signer_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('issued', 'expired', 'used')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  chain_id INTEGER NOT NULL,
  verifying_contract TEXT NOT NULL,
  typed_data JSONB NOT NULL
);

CREATE INDEX idx_marketplace_buy_hashes_listing_user
  ON marketplace_buy_hashes (listing_id, buyer_user_id, issued_at DESC);

CREATE TABLE marketplace_idempotency (
  scope TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chain_event_logs (
  chain_id INTEGER NOT NULL CHECK (chain_id > 0),
  contract_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL CHECK (log_index >= 0),
  block_number BIGINT NOT NULL CHECK (block_number >= 0),
  block_hash TEXT,
  event_name TEXT NOT NULL,
  token_id NUMERIC(78, 0),
  onchain_event_id NUMERIC(78, 0),
  onchain_ticket_type_id NUMERIC(78, 0),
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address, tx_hash, log_index)
);

CREATE TABLE token_ownerships (
  chain_id INTEGER NOT NULL CHECK (chain_id > 0),
  contract_address TEXT NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  event_id TEXT,
  ticket_type_id TEXT,
  onchain_event_id NUMERIC(78, 0),
  onchain_ticket_type_id NUMERIC(78, 0),
  owner_wallet_address TEXT NOT NULL,
  owner_user_id TEXT,
  listing_status token_listing_status NOT NULL DEFAULT 'none',
  source_listing_id TEXT,
  last_sale_price BIGINT CHECK (last_sale_price >= 0),
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
  refunded_at TIMESTAMPTZ,
  last_event_name TEXT NOT NULL,
  last_tx_hash TEXT NOT NULL,
  last_log_index INTEGER NOT NULL CHECK (last_log_index >= 0),
  last_synced_block BIGINT NOT NULL CHECK (last_synced_block >= 0),
  occurred_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address, token_id)
);
