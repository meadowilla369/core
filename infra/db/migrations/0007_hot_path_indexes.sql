-- Hot-path indexes and constraints for throughput-critical queries.

CREATE INDEX idx_reservations_active
  ON reservations(ticket_type_id, status, expires_at)
  WHERE status IN ('pending', 'payment_pending');

CREATE INDEX idx_reservations_user_status
  ON reservations(user_id, status, created_at DESC);

CREATE INDEX idx_check_ins_event_scan
  ON check_ins(event_id, scanned_at DESC);

CREATE INDEX idx_check_ins_gate_scan
  ON check_ins(gate_id, scanned_at DESC);

CREATE INDEX idx_listings_event_status
  ON listings(event_id, status, created_at DESC);

CREATE INDEX idx_listings_seller_status
  ON listings(seller_user_id, status, created_at DESC);

CREATE INDEX idx_webhook_events_status
  ON webhook_events(gateway, status, updated_at DESC);

CREATE INDEX idx_webhook_events_payment
  ON webhook_events(payment_id, created_at DESC);

CREATE INDEX idx_escrow_transfers_status
  ON escrow_transfers(status, created_at DESC);
