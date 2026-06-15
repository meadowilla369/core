-- On-chain mapping, ticket inventory, and contract-sync persistence.

DO $$
BEGIN
  CREATE TYPE token_listing_status AS ENUM (
    'none',
    'active',
    'cancelled',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS onchain_event_id NUMERIC(78, 0);

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS onchain_ticket_type_id NUMERIC(78, 0),
  ADD COLUMN IF NOT EXISTS perks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_onchain_event_id
  ON events(onchain_event_id)
  WHERE onchain_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_types_onchain_ticket_type_id
  ON ticket_types(onchain_ticket_type_id)
  WHERE onchain_ticket_type_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_inventory (
  ticket_type_id TEXT PRIMARY KEY,
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  locked_count INTEGER NOT NULL DEFAULT 0 CHECK (locked_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_event_logs (
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

CREATE INDEX IF NOT EXISTS idx_chain_event_logs_block_number
  ON chain_event_logs(chain_id, contract_address, block_number, log_index);

CREATE INDEX IF NOT EXISTS idx_chain_event_logs_token_id
  ON chain_event_logs(chain_id, contract_address, token_id);

CREATE INDEX IF NOT EXISTS idx_chain_event_logs_onchain_event_id
  ON chain_event_logs(onchain_event_id);

CREATE TABLE IF NOT EXISTS token_ownerships (
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

CREATE INDEX IF NOT EXISTS idx_token_ownerships_owner_wallet
  ON token_ownerships(chain_id, contract_address, owner_wallet_address);

CREATE INDEX IF NOT EXISTS idx_token_ownerships_owner_user
  ON token_ownerships(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_token_ownerships_event
  ON token_ownerships(event_id);

CREATE INDEX IF NOT EXISTS idx_token_ownerships_ticket_type
  ON token_ownerships(ticket_type_id);

CREATE INDEX IF NOT EXISTS idx_token_ownerships_listing_status
  ON token_ownerships(listing_status);

CREATE INDEX IF NOT EXISTS idx_token_ownerships_updated_at
  ON token_ownerships(updated_at DESC);
