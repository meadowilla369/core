-- Check-in gates, scan records, and ticket used-state.

CREATE TABLE gates (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id   TEXT NOT NULL REFERENCES events(id),
  name       TEXT NOT NULL,
  location   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE check_ins (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_id        TEXT NOT NULL,
  event_id        TEXT NOT NULL REFERENCES events(id),
  gate_id         TEXT REFERENCES gates(id),
  qr_nonce        TEXT NOT NULL,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, token_id),
  UNIQUE (event_id, qr_nonce)
);

CREATE INDEX idx_check_ins_event_scan ON check_ins(event_id, scanned_at DESC);
CREATE INDEX idx_check_ins_gate_scan  ON check_ins(gate_id,  scanned_at DESC);

ALTER TABLE tickets
  ADD COLUMN is_used BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN used_at TIMESTAMPTZ;
