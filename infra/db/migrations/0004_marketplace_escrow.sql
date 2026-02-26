-- Marketplace and escrow domain baseline.

CREATE TYPE listing_status AS ENUM ('active', 'cancelled', 'completed', 'expired');
CREATE TYPE purchase_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'completed');
CREATE TYPE escrow_transfer_status AS ENUM ('initiated', 'pending_submit', 'submitted', 'confirmed', 'failed', 'reversed');

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  seller_user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ask_price BIGINT NOT NULL CHECK (ask_price > 0),
  original_price BIGINT NOT NULL CHECK (original_price > 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  status listing_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_listing_currency CHECK (currency IN ('VND')),
  CONSTRAINT chk_listing_markup CHECK (ask_price <= (original_price * 120 / 100))
);

CREATE UNIQUE INDEX idx_listings_ticket_active
  ON listings(ticket_id)
  WHERE status = 'active';

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_user_id UUID NOT NULL REFERENCES users(id),
  payment_id UUID,
  status purchase_status NOT NULL DEFAULT 'pending',
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Escrow transfer ledger in PostgreSQL.
CREATE TABLE escrow_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  purchase_id UUID REFERENCES purchases(id),
  seller_user_id UUID NOT NULL REFERENCES users(id),
  buyer_user_id UUID NOT NULL REFERENCES users(id),
  total_amount BIGINT NOT NULL CHECK (total_amount > 0),
  seller_amount BIGINT NOT NULL CHECK (seller_amount >= 0),
  platform_fee BIGINT NOT NULL CHECK (platform_fee >= 0),
  organizer_royalty BIGINT NOT NULL CHECK (organizer_royalty >= 0),
  status escrow_transfer_status NOT NULL DEFAULT 'initiated',
  escrow_data BYTEA NOT NULL,
  escrow_data_hash BYTEA NOT NULL UNIQUE,
  escrow_data_version SMALLINT NOT NULL DEFAULT 1,
  tx_hash TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_escrow_split_sum CHECK (seller_amount + platform_fee + organizer_royalty = total_amount)
);
