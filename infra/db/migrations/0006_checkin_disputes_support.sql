-- Check-in, disputes, and support domain baseline.

CREATE TYPE dispute_status AS ENUM ('open', 'in_review', 'escalated', 'resolved', 'closed');
CREATE TYPE dispute_tier AS ENUM ('tier1', 'tier2', 'tier3');
CREATE TYPE message_sender_type AS ENUM ('user', 'support', 'system');

CREATE TABLE gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id BIGINT NOT NULL,
  ticket_id UUID REFERENCES tickets(id),
  event_id UUID NOT NULL REFERENCES events(id),
  gate_id UUID REFERENCES gates(id),
  staff_device_id TEXT,
  qr_nonce TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, token_id)
);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filed_by_user_id UUID NOT NULL REFERENCES users(id),
  ticket_id UUID REFERENCES tickets(id),
  event_id UUID REFERENCES events(id),
  category TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  current_tier dispute_tier NOT NULL DEFAULT 'tier1',
  resolution_note TEXT,
  resolution_amount BIGINT,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_type message_sender_type NOT NULL,
  sender_user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispute_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goodwill_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  dispute_id UUID REFERENCES disputes(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
