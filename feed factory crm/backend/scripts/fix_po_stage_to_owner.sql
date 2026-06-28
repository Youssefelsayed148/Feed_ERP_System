-- Fix existing purchase_order approval requests to go direct to owner
-- POs skip manager stage — purchasing_mgr cannot approve their own POs
UPDATE approval_requests 
SET stage = 'owner_review', updated_at = NOW()
WHERE module_name IN ('purchase_orders', 'grn') 
  AND status = 'pending' 
  AND stage = 'manager_review';