const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const managerRoles = ['owner', 'admin', 'sales_manager', 'finance_manager'];

// GET /api/purchase-requisitions
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isManager = managerRoles.includes(userRole);

    let result;
    if (isManager) {
      result = await query(
        'SELECT * FROM purchase_requisitions ORDER BY created_at DESC'
      );
    } else {
      result = await query(
        'SELECT * FROM purchase_requisitions WHERE requested_by = $1 ORDER BY created_at DESC',
        [userId]
      );
    }
    res.json({ requisitions: result.rows });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// POST /api/purchase-requisitions
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { department, items, notes } = req.body;
    const requisitionNumber = 'REQ-' + Date.now();

    const result = await query(
      `INSERT INTO purchase_requisitions
       (requisition_number, requested_by, department, status, items, notes, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
       RETURNING *`,
      [requisitionNumber, userId, department || null, JSON.stringify(items || []), notes || null]
    );
    res.status(201).json({ success: true, requisition: result.rows[0] });
  } catch (error) {
    console.error('Error creating requisition:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// GET /api/purchase-requisitions/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT status, COUNT(*) as count FROM purchase_requisitions GROUP BY status'
    );
    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching requisition stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/purchase-requisitions/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM purchase_requisitions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    res.json({ requisition: result.rows[0] });
  } catch (error) {
    console.error('Error fetching requisition:', error);
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
});

// PUT /api/purchase-requisitions/:id/approve
router.put('/:id/approve', authenticate, authorize(...managerRoles), async (req, res) => {
  try {
    const result = await query(
      `UPDATE purchase_requisitions
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    res.json({ success: true, requisition: result.rows[0] });
  } catch (error) {
    console.error('Error approving requisition:', error);
    res.status(500).json({ error: 'Failed to approve requisition' });
  }
});

// PUT /api/purchase-requisitions/:id/reject
router.put('/:id/reject', authenticate, authorize(...managerRoles), async (req, res) => {
  try {
    const result = await query(
      `UPDATE purchase_requisitions
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    res.json({ success: true, requisition: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting requisition:', error);
    res.status(500).json({ error: 'Failed to reject requisition' });
  }
});

module.exports = router;
