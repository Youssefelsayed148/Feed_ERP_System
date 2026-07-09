const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { journalInvoiceCreated, journalPaymentReceived } = require('../utils/journal');
const { logActivity } = require('../utils/activity');

// =====================
// TWO-STAGE APPROVAL SYSTEM
// =====================
// Stage 1 (manager_review): Manager for the module sees and acts on the request.
//   - Reject → status='rejected', done. Visible in owner audit log only.
//   - Approve → stage advances to 'owner_review', status stays 'pending'
// Stage 2 (owner_review): Owner/admin sees and acts.
//   - Reject → status='rejected'. Visible in audit log.
//   - Approve → status='approved', triggers side effects in the module.
//
// Delivery assignments are excluded — no approval chain.
//
// MODULE_MANAGER_ROLES: who handles Stage 1 for each module
const DIRECT_TO_OWNER_MODULES = ['purchase_orders', 'grn'];

const MODULE_MANAGER_ROLES = {
  sales_orders:   ['sales_manager'],
  clients:        ['sales_manager'],
  expenses:       ['finance_manager'],
  payroll:        ['finance_manager'],
  production:     ['production_mgr'],
  legal:          ['legal_mgr'],
  assets:         ['maintenance_mgr'],
  maintenance:    ['maintenance_mgr'],
};

// =====================
// POST /api/approvals/request - Create approval request (always starts at manager_review)
// =====================
router.post('/request', authenticate, async (req, res) => {
  try {
    const { module_name, request_type, request_id, notes } = req.body;

    const existing = await query(
      `SELECT * FROM approval_requests 
       WHERE module_name = $1 AND request_id = $2 AND request_type = $3 AND status = 'pending'`,
      [module_name, request_id, request_type]
    );
    if (existing.rows.length > 0) {
      return res.json({ success: true, requires_approval: true, request: existing.rows[0], message: 'Approval request already exists' });
    }

    const result = await query(
      `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, status, stage)
       VALUES ($1, $2, $3, $4, $5, 'pending', CASE WHEN $1 = ANY(ARRAY['purchase_orders','grn']) THEN 'owner_review' ELSE 'manager_review' END) RETURNING *`,
      [module_name, request_type, request_id, req.user.id, notes]
    );

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'request_approval',
      module: module_name,
      description: `Requested approval for ${request_type} #${request_id}`,
      entityId: result.rows[0].id,
      entityType: 'approval_request'
    });

    res.json({ success: true, requires_approval: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error creating approval request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/pending - Get pending approvals for current user's stage
// =====================
router.get('/pending', authenticate, authorize(
  'owner', 'admin',
  'sales_manager', 'finance_manager', 'purchasing_mgr',
  'production_mgr', 'legal_mgr', 'maintenance_mgr'
), async (req, res) => {
  try {
    const { role } = req.user;
    let result;

    if (role === 'owner' || role === 'admin') {
      // Owner/admin see both stages: manager_review (can act directly — owner/admin
      // bypass the manager-role check in /:id/approve and /:id/reject) and owner_review
      // (requests a manager already forwarded).
      result = await query(`
        SELECT ar.*,
               u.name as requester_name, u.email as requester_email,
               m.name as manager_name
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        LEFT JOIN users m ON ar.manager_id = m.id
        WHERE ar.status = 'pending' AND ar.stage IN ('manager_review', 'owner_review')
        ORDER BY ar.updated_at DESC
      `);
    } else {
      // Managers see Stage 1: requests for their module (actionable)
      // Plus read-only view of their direct-to-owner requests (informational)
      const modulesForRole = Object.entries(MODULE_MANAGER_ROLES)
        .filter(([, roles]) => roles.includes(role))
        .map(([mod]) => mod);

      // Direct-to-owner modules this role created (read-only, informational)
      const directModulesForRole = DIRECT_TO_OWNER_MODULES.filter(mod => {
        if (role === 'purchasing_mgr') return ['purchase_orders', 'grn'].includes(mod);
        return false;
      });

      const actionableResult = modulesForRole.length > 0 ? await query(`
        SELECT ar.*, u.name as requester_name, u.email as requester_email,
               false as read_only
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending' 
          AND ar.stage = 'manager_review'
          AND ar.module_name = ANY($1)
        ORDER BY ar.created_at DESC
      `, [modulesForRole]) : { rows: [] };

      const informationalResult = directModulesForRole.length > 0 ? await query(`
        SELECT ar.*, u.name as requester_name, u.email as requester_email,
               true as read_only
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending'
          AND ar.stage = 'owner_review'
          AND ar.module_name = ANY($1)
          AND ar.requester_id = $2
        ORDER BY ar.created_at DESC
      `, [directModulesForRole, req.user.id]) : { rows: [] };

      result = { rows: [...actionableResult.rows, ...informationalResult.rows] };
    }

    res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shared stage-transition logic — used by this file's own routes below, and by
// other modules (orders.js) that need to drive the same workflow without
// duplicating its side effects or its self-approval guard.
async function advanceApproval({ approvalId, userId, userName, role, notes, action }) {
  const pending = await query('SELECT * FROM approval_requests WHERE id = $1', [approvalId]);
  if (pending.rows.length === 0) {
    return { statusCode: 404, body: { success: false, error: 'Request not found' } };
  }
  const ar = pending.rows[0];

  if (ar.status !== 'pending') {
    return { statusCode: 400, body: { success: false, error: 'Request already processed' } };
  }

  if (ar.requester_id === userId) {
    return { statusCode: 403, body: { success: false, error: 'You cannot approve or reject your own request' } };
  }

  if (action === 'approve') {
    if (ar.stage === 'manager_review') {
      const allowedRoles = MODULE_MANAGER_ROLES[ar.module_name] || [];
      if (role !== 'owner' && role !== 'admin' && !allowedRoles.includes(role)) {
        return { statusCode: 403, body: { success: false, error: 'Not authorized to approve this module at manager stage' } };
      }
      const result = await query(
        `UPDATE approval_requests
         SET stage = 'owner_review', manager_id = $1, manager_approved_at = NOW(), manager_notes = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [userId, notes || null, approvalId]
      );
      await logActivity({
        userId,
        userName,
        userRole: role,
        action: 'approve',
        module: ar.module_name,
        description: `Manager approved ${ar.request_type} #${ar.request_id} — forwarded to owner`,
        entityId: approvalId,
        entityType: 'approval_request'
      });
      return { statusCode: 200, body: { success: true, stage: 'forwarded_to_owner', request: result.rows[0] } };
    }

    if (ar.stage === 'owner_review') {
      if (role !== 'owner' && role !== 'admin') {
        return { statusCode: 403, body: { success: false, error: 'Only owner or admin can approve at this stage' } };
      }
      const result = await query(
        `UPDATE approval_requests
         SET status = 'approved', approver_id = $1, notes = COALESCE($2, notes), updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [userId, notes || null, approvalId]
      );
      await logActivity({
        userId,
        userName,
        userRole: role,
        action: 'approve',
        module: ar.module_name,
        description: `Owner approved ${ar.request_type} #${ar.request_id}`,
        entityId: approvalId,
        entityType: 'approval_request'
      });
      await updateRecordStatus(result.rows[0]);
      return { statusCode: 200, body: { success: true, stage: 'fully_approved', request: result.rows[0] } };
    }

    return { statusCode: 400, body: { success: false, error: 'Unknown stage' } };
  }

  // action === 'reject'
  if (ar.stage === 'manager_review') {
    const allowedRoles = MODULE_MANAGER_ROLES[ar.module_name] || [];
    if (role !== 'owner' && role !== 'admin' && !allowedRoles.includes(role)) {
      return { statusCode: 403, body: { success: false, error: 'Not authorized to reject this module at manager stage' } };
    }
  } else if (ar.stage === 'owner_review') {
    if (role !== 'owner' && role !== 'admin') {
      return { statusCode: 403, body: { success: false, error: 'Only owner or admin can reject at this stage' } };
    }
  }

  const result = await query(
    `UPDATE approval_requests
     SET status = 'rejected', approver_id = $1, notes = COALESCE($2, notes), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [userId, notes || null, approvalId]
  );

  await rejectRecordStatus(ar);

  await logActivity({
    userId,
    userName,
    userRole: role,
    action: 'reject',
    module: ar.module_name,
    description: `Rejected ${ar.request_type} #${ar.request_id} at stage ${ar.stage}${notes ? ': ' + notes : ''}`,
    entityId: approvalId,
    entityType: 'approval_request'
  });

  return { statusCode: 200, body: { success: true, request: result.rows[0] } };
}

// =====================
// PUT /api/approvals/:id/approve - Approve (stage-aware)
// =====================
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const { role, id: userId, name: userName } = req.user;
    const result = await advanceApproval({ approvalId: id, userId, userName, role, notes, action: 'approve' });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Error approving:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// PUT /api/approvals/:id/reject - Reject at any stage
// =====================
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const { role, id: userId, name: userName } = req.user;
    const result = await advanceApproval({ approvalId: id, userId, userName, role, notes, action: 'reject' });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/my-requests - All requests submitted by current user (all roles)
// =====================
router.get('/my-requests', authenticate, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const result = await query(`
      SELECT 
        ar.*,
        approver.name as approver_name,
        approver.role as approver_role,
        manager.name as manager_name,
        manager.role as manager_role
      FROM approval_requests ar
      LEFT JOIN users approver ON ar.approver_id = approver.id
      LEFT JOIN users manager ON ar.manager_id = manager.id
      WHERE ar.requester_id = $1
      ORDER BY ar.created_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

    res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('Error fetching my requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/team-requests - Requests from team (for managers to see their module decisions)
// =====================
router.get('/team-requests', authenticate, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { limit = 100 } = req.query;

    // Owner/admin see everything via audit endpoint
    if (role === 'owner' || role === 'admin') {
      return res.json({ success: true, count: 0, requests: [], message: 'Use /audit endpoint' });
    }

    // Managers see all requests for their modules (not just their own)
    const modulesForRole = Object.entries(MODULE_MANAGER_ROLES)
      .filter(([, roles]) => roles.includes(role))
      .map(([mod]) => mod);

    // Also include direct-to-owner modules if purchasing_mgr
    if (role === 'purchasing_mgr') {
      DIRECT_TO_OWNER_MODULES.forEach(m => {
        if (!modulesForRole.includes(m)) modulesForRole.push(m);
      });
    }

    if (modulesForRole.length === 0) {
      // Regular staff — only see their own requests (handled by my-requests)
      return res.json({ success: true, count: 0, requests: [] });
    }

    const result = await query(`
      SELECT 
        ar.*,
        requester.name as requester_name,
        requester.role as requester_role,
        approver.name as approver_name,
        approver.role as approver_role,
        manager.name as manager_name,
        manager.role as manager_role
      FROM approval_requests ar
      LEFT JOIN users requester ON ar.requester_id = requester.id
      LEFT JOIN users approver ON ar.approver_id = approver.id
      LEFT JOIN users manager ON ar.manager_id = manager.id
      WHERE ar.module_name = ANY($1)
      ORDER BY ar.created_at DESC
      LIMIT $2
    `, [modulesForRole, limit]);

    res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('Error fetching team requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/audit - Full audit log (owner/admin only)
// =====================
router.get('/audit', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { limit = 100, module_name, status } = req.query;

    let conditions = ['ar.status != \'pending\''];
    const params = [];
    let idx = 1;

    if (module_name && module_name !== 'all') {
      conditions.push(`ar.module_name = $${idx++}`);
      params.push(module_name);
    }
    if (status && status !== 'all') {
      conditions.push(`ar.status = $${idx++}`);
      params.push(status);
    }

    params.push(limit);
    const result = await query(`
      SELECT 
        ar.*,
        requester.name as requester_name,
        requester.email as requester_email,
        requester.role as requester_role,
        approver.name as approver_name,
        approver.role as approver_role,
        manager.name as manager_name,
        manager.role as manager_role
      FROM approval_requests ar
      LEFT JOIN users requester ON ar.requester_id = requester.id
      LEFT JOIN users approver ON ar.approver_id = approver.id
      LEFT JOIN users manager ON ar.manager_id = manager.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ar.updated_at DESC
      LIMIT $${idx}
    `, params);

    res.json({ success: true, count: result.rows.length, records: result.rows });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/activity - Recent user activity (owner/admin)
// =====================
router.get('/activity', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await query(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1
    `, [limit]);
    res.json({ success: true, activities: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/activity/summary
// =====================
router.get('/activity/summary', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT ON (al.user_id)
        al.user_id, al.user_name, al.user_role,
        al.action, al.module AS module_name, al.description AS details, al.created_at AS last_action_time
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE u.is_active = true
      ORDER BY al.user_id, al.created_at DESC
    `);
    res.json({ success: true, users: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// POST /api/approvals/log
// =====================
router.post('/log', authenticate, async (req, res) => {
  try {
    const { action, module_name, details } = req.body;
    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action,
      module: module_name,
      description: details
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// GET /api/approvals/check/:module/:requestId
// =====================
router.get('/check/:module/:requestId', authenticate, async (req, res) => {
  try {
    const { module, requestId } = req.params;
    const approval = await query(
      `SELECT * FROM approval_requests 
       WHERE module_name = $1 AND request_id = $2::integer 
       ORDER BY created_at DESC LIMIT 1`,
      [module, requestId]
    );
    if (approval.rows.length > 0 && approval.rows[0].status === 'approved') {
      return res.json({ requires_approval: false, approved: true });
    }
    res.json({ requires_approval: true, pending: approval.rows[0]?.status === 'pending' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE $1`,
    [`INV-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `INV-${year}-${String(count).padStart(4, '0')}`;
}

// Ported from sales.js's old PUT /orders/:id/approve and orders.js's old
// approval-tier branch — now the single place this runs, firing only once
// owner_review is actually reached, not on manager approval alone.
async function finalizeSalesOrderApproval(ar) {
  const orderId = ar.request_id;
  const result = await transaction(async (client) => {
    const orderResult = await client.query(
      `UPDATE sales_orders SET status = 'processing', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status IN ('pending_approval', 'approved', 'confirmed') RETURNING *`,
      [ar.approver_id, orderId]
    );
    if (orderResult.rows.length === 0) return null; // already processed / unexpected state
    const order = orderResult.rows[0];

    const existingInvoice = await client.query('SELECT id FROM invoices WHERE order_id = $1', [orderId]);
    let invoice = null;
    let cashPayment = null;
    if (existingInvoice.rows.length === 0) {
      const paymentMethod = order.payment_method || 'credit';
      let creditDays = 0;
      if (paymentMethod === 'credit') {
        const clientRes = await client.query('SELECT payment_terms FROM clients WHERE id = $1', [order.client_id]);
        const paymentTerms = clientRes.rows[0]?.payment_terms || '';
        const daysMatch = paymentTerms.match(/(\d+)/);
        creditDays = daysMatch ? parseInt(daysMatch[1]) : 0;
      }
      const invoiceNumber = await generateInvoiceNumber();
      const invResult = await client.query(
        `INSERT INTO invoices (invoice_number, order_id, client_id, amount, balance_due, due_date, notes, created_by, created_at)
         VALUES ($1, $2, $3, $4, $4, CURRENT_DATE + INTERVAL '${creditDays} days', $5, $6, CURRENT_DATE) RETURNING *`,
        [invoiceNumber, orderId, order.client_id, order.final_amount, `Auto-generated from ${order.order_number}`, ar.approver_id]
      );
      invoice = invResult.rows[0];

      const invItemsResult = await client.query(
        `SELECT soi.*, ft.name_arabic as feed_name
         FROM sales_order_items soi JOIN feed_types ft ON soi.feed_type_id = ft.id
         WHERE soi.order_id = $1`,
        [orderId]
      );
      for (const item of invItemsResult.rows) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)`,
          [invoice.id, `${item.feed_name} (${item.package_size}kg)`, item.quantity, item.unit_price, item.total_price]
        );
      }

      await client.query(
        `UPDATE clients SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2`,
        [parseFloat(order.final_amount), order.client_id]
      );
      await client.query(
        `INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status)
         VALUES ($1, $2, CURRENT_DATE + INTERVAL '${creditDays} days', $3, 'expected')`,
        [order.client_id, order.final_amount, `Invoice ${invoiceNumber}`]
      );

      if (paymentMethod === 'cash') {
        const paymentResult = await client.query(
          `INSERT INTO client_payment_history (client_id, invoice_id, amount, date, description, method, collected_by)
           VALUES ($1, $2, $3, CURRENT_DATE, $4, 'cash', $5) RETURNING *`,
          [order.client_id, invoice.id, order.final_amount, `Cash payment for invoice ${invoiceNumber}`, ar.approver_id]
        );
        cashPayment = paymentResult.rows[0];
        await client.query(
          `UPDATE invoices SET status = 'paid', balance_due = 0, paid_amount = $1, updated_at = NOW() WHERE id = $2`,
          [order.final_amount, invoice.id]
        );
        await client.query(
          `UPDATE clients SET current_balance = GREATEST(current_balance - $1, 0), updated_at = NOW() WHERE id = $2`,
          [parseFloat(order.final_amount), order.client_id]
        );
        await client.query(
          `UPDATE client_expected_payments SET status = 'paid', updated_at = NOW() WHERE client_id = $1 AND description = $2`,
          [order.client_id, `Invoice ${invoiceNumber}`]
        );
      }
    }
    return { order, invoice, cashPayment };
  });

  if (!result) return;
  const { order, invoice, cashPayment } = result;

  try {
    const items = await query('SELECT * FROM sales_order_items WHERE order_id = $1', [order.id]);
    for (const item of items.rows) {
      const quantityKg = parseFloat(item.quantity) * 1000;
      const numberOfBags = item.package_size > 0 ? Math.ceil(quantityKg / item.package_size) : 0;
      const orderNumber = `PRD-${Date.now()}-${item.id}`;
      await query(
        `INSERT INTO production_orders
         (order_number, feed_type_id, quantity_kg, status, production_date, sales_order_id, package_size, number_of_bags, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', CURRENT_DATE, $4, $5, $6, $7, NOW(), NOW())`,
        [orderNumber, item.feed_type_id, quantityKg, order.id, item.package_size, numberOfBags, ar.approver_id]
      );
    }
  } catch (prodErr) {
    console.error('[APPROVALS] Failed to auto-create production orders for order', order.id, prodErr.message);
  }

  let clientNameForJournal = '';
  if (invoice) {
    try {
      const clientRes = await query('SELECT name_arabic FROM clients WHERE id = $1', [order.client_id]);
      clientNameForJournal = clientRes.rows[0]?.name_arabic || '';
      await journalInvoiceCreated({ ...invoice, client_name: clientNameForJournal });
    } catch (e) { console.error('[JOURNAL] Failed to create entry for invoice:', e.message); }
  }
  if (cashPayment) {
    try {
      await journalPaymentReceived(cashPayment, clientNameForJournal);
    } catch (e) { console.error('[JOURNAL] Failed to create entry for cash auto-settlement:', e.message); }
  }
}

// =====================
// Helper: update underlying record to approved
// =====================
async function updateRecordStatus(ar) {
  try {
    switch (ar.module_name) {
      case 'sales_orders':
        await finalizeSalesOrderApproval(ar);
        break;
      case 'purchase_orders':
        await query(`UPDATE purchase_orders SET status = 'approved' WHERE id = $1`, [ar.request_id]);
        break;
      case 'grn':
        await query(`UPDATE goods_receipt_notes SET status = 'approved' WHERE id = $1`, [ar.request_id]);
        break;
      case 'payroll':
        await query(`UPDATE payroll_periods SET status = 'approved' WHERE id = $1`, [ar.request_id]);
        break;
      case 'expenses':
        await query(`UPDATE expenses SET status = 'approved' WHERE id = $1`, [ar.request_id]);
        break;
      case 'production':
        await query(`UPDATE production_orders SET status = 'approved' WHERE id = $1`, [ar.request_id]);
        break;
      case 'legal':
        await query(`UPDATE legal_documents SET status = 'verified' WHERE id = $1`, [ar.request_id]);
        break;
    }
  } catch (error) {
    console.error('Error updating record status after approval:', error);
  }
}

// =====================
// Helper: update underlying record to rejected
// =====================
async function rejectRecordStatus(ar) {
  try {
    switch (ar.module_name) {
      case 'sales_orders':
        await query(`UPDATE sales_orders SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'purchase_orders':
        await query(`UPDATE purchase_orders SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'grn':
        await query(`UPDATE goods_receipt_notes SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'payroll':
        await query(`UPDATE payroll_periods SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'expenses':
        await query(`UPDATE expenses SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'production':
        await query(`UPDATE production_orders SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
      case 'legal':
        await query(`UPDATE legal_documents SET status = 'rejected' WHERE id = $1`, [ar.request_id]);
        break;
    }
  } catch (error) {
    console.error('Error updating record status after rejection:', error);
  }
}

module.exports = router;
module.exports.advanceApproval = advanceApproval;