-- Local/dev seed fixtures.
-- Apply after migrations on non-production environments only.

INSERT INTO organizers (id, display_name, contact_email, wallet_address, is_verified)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'RockFest Org', 'ops@rockfest.vn', '0xorgrock', TRUE),
  ('10000000-0000-0000-0000-000000000002', 'Jazz Night Org', 'ops@jazz.vn', '0xorgjazz', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO venues (id, name, city, address_line, capacity)
VALUES
  ('11000000-0000-0000-0000-000000000001', 'Riverside Arena', 'Ho Chi Minh', 'District 7', 5000),
  ('11000000-0000-0000-0000-000000000002', 'Opera Hall', 'Ha Noi', 'Trang Tien', 1200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, phone_e164, email, display_name, wallet_address, status, kyc_status)
VALUES
  ('12000000-0000-0000-0000-000000000001', '+84901111222', 'buyer1@example.com', 'Buyer 1', '0xuser1', 'active', 'approved'),
  ('12000000-0000-0000-0000-000000000002', '+84901111333', 'buyer2@example.com', 'Buyer 2', '0xuser2', 'active', 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, organizer_id, venue_id, title, city, venue_name, starts_at, ends_at, status)
VALUES
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Rock Fest 2026', 'Ho Chi Minh', 'Riverside Arena', '2026-05-10T19:00:00Z', '2026-05-10T23:00:00Z', 'published'),
  ('13000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Jazz Night 2026', 'Ha Noi', 'Opera Hall', '2026-06-01T12:30:00Z', '2026-06-01T16:00:00Z', 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_types (id, event_id, name, face_price, quantity, sold_count)
VALUES
  ('14000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'General Admission', 900000, 5000, 1250),
  ('14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', 'VIP', 2200000, 300, 120),
  ('14000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000002', 'Standard', 650000, 800, 180)
ON CONFLICT (id) DO NOTHING;
