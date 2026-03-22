-- Wallet bootstrap prefund ledger and backend-issued payment hash evidence.

CREATE TABLE wallet_prefunds (
  wallet_address TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  prefund_tx_hash TEXT NOT NULL UNIQUE,
  amount_wei NUMERIC(78, 0) NOT NULL CHECK (amount_wei > 0),
  funded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  order_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  buyer_wallet_address TEXT NOT NULL,
  event_id BIGINT NOT NULL CHECK (event_id > 0),
  ticket_type_id BIGINT NOT NULL CHECK (ticket_type_id > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  ticket_ids JSONB NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  nonce BYTEA NOT NULL UNIQUE,
  payment_hash BYTEA NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  signer_address TEXT NOT NULL,
  chain_id BIGINT NOT NULL CHECK (chain_id > 0),
  verifying_contract TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id)
);
