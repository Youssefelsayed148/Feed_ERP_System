-- =====================================================================
-- Migration: Split "processing" into two distinct steps
-- =====================================================================
-- WHY: a single 'processing' status was doing two different jobs at
-- once — "this order has been processed/fulfilled internally" AND
-- "send this order to Logistics for delivery assignment" — with one
-- click. That's ambiguous and skips a real decision point: an order
-- can be ready (picked/packed) without yet being handed off to
-- delivery (e.g. waiting for a few more orders to batch into one
-- truck run, or waiting on a client to confirm a delivery window).
--
-- This adds 'ready_for_delivery' as its own status, sitting between
-- 'processing' and 'in_transit'. Two distinct actions/buttons now
-- exist server-side:
--   1. processing -> ready_for_delivery   (marks order processed/ready)
--   2. ready_for_delivery -> [creates delivery_assignments row]
--      (the actual "send to delivery" handoff to Logistics)
--
-- Run from Windows PowerShell against al_kheir_feed_factory.
-- =====================================================================

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;

ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check CHECK (
    status IN (
        'pending_approval', 'approved', 'confirmed', 'processing',
        'ready_for_delivery', 'in_transit', 'delivered', 'rejected', 'cancelled'
    )
);

-- Track who/when marked an order ready and who/when sent it to delivery —
-- same audit-trail pattern as assigned_at/assigned_by added for deliveries.
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS ready_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS sent_to_delivery_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS sent_to_delivery_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
