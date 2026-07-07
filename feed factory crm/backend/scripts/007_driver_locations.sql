-- 007_driver_locations.sql
-- Driver location tracking — scoped to drivers during active deliveries only.
-- Stores GPS pings for per-delivery audit trail and live map view.

CREATE TABLE IF NOT EXISTS driver_locations (
    id SERIAL PRIMARY KEY,
    driver_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id INTEGER REFERENCES delivery_assignments(id) ON DELETE SET NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    accuracy DECIMAL(10,2),
    context VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_user ON driver_locations(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_delivery ON driver_locations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_created ON driver_locations(created_at DESC);
