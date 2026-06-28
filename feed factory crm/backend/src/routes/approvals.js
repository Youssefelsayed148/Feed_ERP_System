const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

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

    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'request_approval', module_name, `Requested approval for ${request_type} #${request_id}`]
    );

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
      // Owner/admin see Stage 2: requests that passed manager approval
      result = await query(`
        SELECT ar.*, 
               u.name as requester_name, u.email as requester_email,
               m.name as manager_name
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        LEFT JOIN users m ON ar.manager_id = m.id
        WHERE ar.status = 'pending' AND ar.stage = 'owner_review'
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

// =====================
// PUT /api/approvals/:id/approve - Approve (stage-aware)
// =====================
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const { role, id: userId } = req.user;

    const pending = await query('SELECT * FROM approval_requests WHERE id = $1', [id]);
    if (pending.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    const ar = pending.rows[0];

    if (ar.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Request already processed' });
    }

    // Stage 1: manager approval
    if (ar.stage === 'manager_review') {
      const allowedRoles = MODULE_MANAGER_ROLES[ar.module_name] || [];
      if (role !== 'owner' && role !== 'admin' && !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'Not authorized to approve this module at manager stage' });
      }
      // Advance to owner_review
      const result = await query(
        `UPDATE approval_requests 
         SET stage = 'owner_review', manager_id = $1, manager_approved_at = NOW(), manager_notes = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [userId, notes || null, id]
      );
      await query(
        `INSERT INTO user_activity_log (user_id, action, module_name, details) VALUES ($1, $2, $3, $4)`,
        [userId, 'manager_approve', ar.module_name, `Manager approved ${ar.request_type} #${ar.request_id} — forwarded to owner`]
      );
      return res.json({ success: true, stage: 'forwarded_to_owner', request: result.rows[0] });
    }

    // Stage 2: owner/admin approval
    if (ar.stage === 'owner_review') {
      if (role !== 'owner' && role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only owner or admin can approve at this stage' });
      }
      const result = await query(
        `UPDATE approval_requests 
         SET status = 'approved', approver_id = $1, notes = COALESCE($2, notes), updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [userId, notes || null, id]
      );
      await query(
        `INSERT INTO user_activity_log (user_id, action, module_name, details) VALUES ($1, $2, $3, $4)`,
        [userId, 'owner_approve', ar.module_name, `Owner approved ${ar.request_type} #${ar.request_id}`]
      );
      // Trigger side effects
      await updateRecordStatus(ar);
      return res.json({ success: true, stage: 'fully_approved', request: result.rows[0] });
    }

    return res.status(400).json({ success: false, error: 'Unknown stage' });
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
    const { role, id: userId } = req.user;

    const pending = await query('SELECT * FROM approval_requests WHERE id = $1', [id]);
    if (pending.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    const ar = pending.rows[0];

    if (ar.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Request already processed' });
    }

    // Check authorization for current stage
    if (ar.stage === 'manager_review') {
      const allowedRoles = MODULE_MANAGER_ROLES[ar.module_name] || [];
      if (role !== 'owner' && role !== 'admin' && !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'Not authorized to reject this module at manager stage' });
      }
    } else if (ar.stage === 'owner_review') {
      if (role !== 'owner' && role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only owner or admin can reject at this stage' });
      }
    }

    const result = await query(
      `UPDATE approval_requests 
       SET status = 'rejected', approver_id = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [userId, notes || null, id]
    );

    // Update the underlying record status to rejected
    await rejectRecordStatus(ar);

    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) VALUES ($1, $2, $3, $4)`,
      [userId, 'reject_approval', ar.module_name,
       `Rejected ${ar.request_type} #${ar.request_id} at stage ${ar.stage}${notes ? ': ' + notes : ''}`]
    );

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint kept for backward compatibility
router.put('/:id/:action', authenticate, async (req, res) => {
  const { action } = req.params;
  if (action === 'approve') return router.handle(req, res);
  if (action === 'reject') return router.handle(req, res);
  return res.status(400).json({ success: false, error: 'Invalid action' });
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
      SELECT al.*, u.name as user_name, u.role as user_role
      FROM user_activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
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
        al.user_id, u.name as user_name, u.role as user_role,
        al.action, al.module_name, al.details, al.created_at as last_action_time
      FROM user_activity_log al
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
    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, action, module_name, details]
    );
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

// =====================
// Helper: update underlying record to approved
// =====================
async function updateRecordStatus(ar) {
  try {
    switch (ar.module_name) {
      case 'sales_orders':
        await query(`UPDATE sales_orders SET status = 'approved' WHERE id = $1`, [ar.request_id]);
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