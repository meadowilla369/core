-- Payments, refunds, and webhook evidence baseline.

CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'cancelled');
CREATE TYPE webhook_status AS ENUM ('processed', 'queued_retry', 'rejected');
CREATE TYPE refund_status AS ENUM ('requested', 'queued', 'processing', 'completed', 'failed', 'rejected');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  gateway TEXT NOT NULL,
  gateway_transaction_id TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payment_currency CHECK (currency IN ('VND')),
  CONSTRAINT chk_payment_gateway CHECK (gateway IN ('momo', 'vnpay')),
  UNIQUE (idempotency_key)
);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  payment_id UUID REFERENCES payments(id),
  payload_digest BYTEA NOT NULL,
  raw_payload JSONB NOT NULL,
  status webhook_status NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_webhook_gateway CHECK (gateway IN ('momo', 'vnpay'))
);

CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  event_id UUID NOT NULL REFERENCES events(id),
  original_purchase_price BIGINT NOT NULL CHECK (original_purchase_price > 0),
  refund_amount BIGINT NOT NULL CHECK (refund_amount >= 0),
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'requested',
  payout_reference TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);
