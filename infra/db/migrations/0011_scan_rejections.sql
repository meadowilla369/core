-- Track rejected scans (duplicate, expired, invalid) for gate metrics.

CREATE TABLE scan_rejections (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id    TEXT NOT NULL,
  gate_id     TEXT,
  reason      TEXT NOT NULL,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_rejections_event ON scan_rejections(event_id, rejected_at DESC);
CREATE INDEX idx_scan_rejections_gate  ON scan_rejections(gate_id, rejected_at DESC);
