-- =====================================================================
-- Migration: Order tracking + real proof-of-delivery
-- =====================================================================
-- WHY: delivery_assignments had no timestamp tracking for when an order
-- was assigned or accepted, and no storage for the GPS/OTP/photo proof
-- that the frontend (Delivery.js) already captures and sends to
-- POST /:id/confirm — the backend was silently discarding all of it.
-- This migration adds the columns; the accompanying delivery.js changes
-- make the backend actually use them.
--
-- Run from Windows PowerShell against al_kheir_feed_factory.
-- =====================================================================

-- 1. Full lifecycle timestamps — lets you answer "when was this order
--    assigned, and how long did it sit before the driver accepted it"
--    without guessing from status alone.
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMP;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMP;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP;

-- 2. Real proof-of-delivery storage — the frontend already captures all
--    of this (navigator.geolocation, OTP, photos, signature) and sends
--    it to POST /:id/confirm. It was being received and discarded.
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS arrival_lat DECIMAL(10,7);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS arrival_lng DECIMAL(10,7);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS arrival_accuracy DECIMAL(10,2);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMP;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS photo_urls TEXT[]; -- up to 3, matches frontend's max-3-photos limit
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS signature_data TEXT; -- base64 signature already captured by frontend canvas
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS received_by_name VARCHAR(200);

-- 3. Client coordinates — needed to eventually compare arrival_lat/lng
--    against where the client actually is. Optional/nullable: existing
--    clients won't have this until someone fills it in (e.g. via Google
--    Maps picker on the client edit form, or a one-time geocode pass on
--    the existing `address` text field). Arrival GPS capture and storage
--    work immediately without this; the distance-check comparison is a
--    later step once coordinates are populated.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
