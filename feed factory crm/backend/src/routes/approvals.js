const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================
// APPROVAL SETTINGS
// =====================

// GET /api/approvals/settings - Get all approval settings (owner only)
router.get('/settings', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM approval_settings ORDER BY module_name');
    res.json({ success: true, settings: result.rows });
  } catch (error) {
    console.error('Error fetching approval settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/approvals/settings/:module - Toggle approval requirement (owner only)
router.put('/settings/:module', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { module } = req.params;
    const { requires_approval } = req.body;
    
    const result = await query(
      `UPDATE approval_settings SET requires_approval = $1, updated_by = $2, updated_at = NOW() 
       WHERE module_name = $3 RETURNING *`,
      [requires_approval, req.user.id, module]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }
    
    // Log activity
    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'toggle_approval', module, 
       `Set ${module} approval to ${requires_approval ? 'ON' : 'OFF'}`]
    );
    
    res.json({ success: true, setting: result.rows[0] });
  } catch (error) {
    console.error('Error updating approval setting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// APPROVAL REQUESTS
// =====================

// POST /api/approvals/request - Create approval request
router.post('/request', authenticate, async (req, res) => {
  try {
    const { module_name, request_type, request_id, notes } = req.body;
    
    // Check if approval is required for this module
    const setting = await query(
      'SELECT requires_approval FROM approval_settings WHERE module_name = $1',
      [module_name]
    );
    
    if (setting.rows.length === 0 || !setting.rows[0].requires_approval) {
      return res.json({ 
        success: true, 
        requires_approval: false,
        message: 'No approval required for this module' 
      });
    }
    
    // Check if already has pending request
    const existing = await query(
      `SELECT * FROM approval_requests 
       WHERE module_name = $1 AND request_id = $2 AND request_type = $3 AND status = 'pending'`,
      [module_name, request_id, request_type]
    );
    
    if (existing.rows.length > 0) {
      return res.json({ 
        success: true, 
        requires_approval: true,
        request: existing.rows[0],
        message: 'Approval request already exists' 
      });
    }
    
    const result = await query(
      `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [module_name, request_type, request_id, req.user.id, notes]
    );
    
    // Log activity
    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'request_approval', module_name, 
       `Requested approval for ${request_type} #${request_id}`]
    );
    
    res.json({ success: true, requires_approval: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error creating approval request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/approvals/pending - Get all pending approvals (owner/admin)
router.get('/pending', authenticate, authorize('owner', 'admin', 'sales_manager', 'finance_manager', 'hr_manager'), async (req, res) => {
  try {
    let result;
    const user = req.user;
    
    // Different users see different pending approvals
    if (user.role === 'owner' || user.role === 'admin') {
      result = await query(`
        SELECT ar.*, u.name as requester_name, u.email as requester_email
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending'
        ORDER BY ar.created_at DESC
      `);
    } else if (user.role === 'sales_manager') {
      result = await query(`
        SELECT ar.*, u.name as requester_name, u.email as requester_email
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending' AND ar.module_name = 'sales_orders'
        ORDER BY ar.created_at DESC
      `);
    } else if (user.role === 'finance_manager') {
      result = await query(`
        SELECT ar.*, u.name as requester_name
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending' AND ar.module_name IN ('expenses', 'payroll')
        ORDER BY ar.created_at DESC
      `);
    } else if (user.role === 'hr_manager') {
      result = await query(`
        SELECT ar.*, u.name as requester_name
        FROM approval_requests ar
        LEFT JOIN users u ON ar.requester_id = u.id
        WHERE ar.status = 'pending' AND ar.module_name = 'payroll'
        ORDER BY ar.created_at DESC
      `);
    } else {
      result = { rows: [] };
    }
    
    res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/approvals/:id/:action - Approve or reject (owner/admin/managers)
router.put('/:id/:action', authenticate, async (req, res) => {
  try {
    const { id, action } = req.params;
    const { notes } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    const result = await query(
      `UPDATE approval_requests 
       SET status = $1, approver_id = $2, notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = $4 AND status = 'pending' RETURNING *`,
      [status, req.user.id, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found or already processed' });
    }
    
    const req_data = result.rows[0];
    
    // Log activity
    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, `${action}_approval`, req_data.module_name,
       `${action === 'approve' ? 'Approved' : 'Rejected'} ${req_data.request_type} #${req_data.request_id}`]
    );
    
    // If approved, update the underlying record status
    if (action === 'approve') {
      await updateRecordStatus(req_data);
    }
    
    res.json({ success: true, request: req_data });
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: update status of the approved record
async function updateRecordStatus(req_data) {
  try {
    const { module_name, request_id } = req_data;
    
    switch (module_name) {
      case 'sales_orders':
        await query('UPDATE sales_orders SET status = $1 WHERE id = $2', ['approved', request_id]);
        break;
      case 'purchase_orders':
        await query('UPDATE purchase_orders SET status = $1 WHERE id = $2', ['approved', request_id]);
        break;
      case 'payroll':
        await query('UPDATE payroll_periods SET status = $1 WHERE id = $2', ['approved', request_id]);
        break;
      case 'expenses':
        await query('UPDATE expenses SET status = $1 WHERE id = $2', ['approved', request_id]);
        break;
      case 'clients':
        try {
          const meta = req_data.metadata || null;
          if (meta && typeof meta === 'string') {
            const parsed = JSON.parse(meta);
            if (parsed && parsed.new_limit) {
              await query('UPDATE clients SET credit_limit = $1 WHERE id = $2', [parsed.new_limit, parsed.client_id || request_id]);
            }
          }
        } catch(e) { console.error('Failed to apply credit limit:', e.message); }
        break;
    }
  } catch (error) {
    console.error('Error updating record status:', error);
  }
}

// =====================
// ACTIVITY LOG
// =====================

// GET /api/approvals/activity - Get recent user activity (owner/admin)
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
    console.error('Error fetching activity log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/approvals/activity/summary - Summary of last action per user
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
    console.error('Error fetching activity summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/approvals/log - Log user activity (called from frontend)
router.post('/log', authenticate, async (req, res) => {
  try {
    const { action, module_name, details } = req.body;
    
    await query(
      `INSERT INTO user_activity_log (user_id, action, module_name, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, action, module_name, details]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/approvals/check/:module/:requestId - Check if needs approval
router.get('/check/:module/:requestId', authenticate, async (req, res) => {
  try {
    const { module, requestId } = req.params;
    
    // Check setting
    const setting = await query(
      'SELECT requires_approval FROM approval_settings WHERE module_name = $1',
      [module]
    );
    
    if (setting.rows.length === 0 || !setting.rows[0].requires_approval) {
      return res.json({ requires_approval: false });
    }
    
    // Check if already approved
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

module.exports = router;
