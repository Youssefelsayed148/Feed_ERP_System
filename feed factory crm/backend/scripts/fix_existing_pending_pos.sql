-- Insert approval_requests for POs that are pending_approval but have no approval request yet
INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status)
SELECT 
  'purchase_orders',
  'purchase_order',
  po.id,
  po.created_by,
  'PO ' || po.po_number || ' - Total: ' || po.total_amount || ' EGP',
  'manager_review',
  'pending'
FROM purchase_orders po
WHERE po.status = 'pending_approval'
  AND NOT EXISTS (
    SELECT 1 FROM approval_requests ar 
    WHERE ar.module_name = 'purchase_orders' 
    AND ar.request_id = po.id 
    AND ar.status = 'pending'
  );