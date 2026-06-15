const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { journalExpenseCreated } = require('../utils/journal');

// GET /api/expenses - List with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      category, 
      status,
      startDate, 
      endDate, 
      minAmount,
      maxAmount,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const conditions = [];
    const params = [];
    let paramIdx = 1;
    
    if (category) {
      conditions.push(`e.category = $${paramIdx++}`);
      params.push(category);
    }
    if (status) {
      conditions.push(`e.status = $${paramIdx++}`);
      params.push(status);
    }
    if (startDate && endDate) {
      conditions.push(`e.date BETWEEN $${paramIdx++} AND $${paramIdx++}`);
      params.push(startDate, endDate);
    }
    if (minAmount) {
      conditions.push(`e.amount >= $${paramIdx++}`);
      params.push(parseFloat(minAmount));
    }
    if (maxAmount) {
      conditions.push(`e.amount <= $${paramIdx++}`);
      params.push(parseFloat(maxAmount));
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM expenses e ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    const queryParams = [...params, parseInt(limit), offset];
    
    const result = await query(
      `SELECT e.*, 
        creator.name as created_by_name, 
        approver.name as approved_by_name
      FROM expenses e
      LEFT JOIN users creator ON e.created_by = creator.id
      LEFT JOIN users approver ON e.approved_by = approver.id
      ${whereClause}
      ORDER BY e.date DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      queryParams
    );
    
    const expenses = result.rows.map(e => ({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount),
      date: e.date,
      reference: e.reference,
      status: e.status,
      approvedBy: e.approved_by,
      approvedByName: e.approved_by_name,
      is_active: e.is_active,
      createdBy: e.created_by,
      createdByName: e.created_by_name,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    }));
    
    const totalAmountResult = await query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`);
    const totalAmount = parseFloat(totalAmountResult.rows[0].total);
    
    res.json({ 
      expenses, 
      total, 
      totalAmount,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/expenses - Create expense
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      category, 
      description, 
      amount, 
      date, 
      reference,
      notes
    } = req.body;
    
    const result = await query(
      `INSERT INTO expenses (category, description, amount, date, reference, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [category, description, parseFloat(amount), date || new Date().toISOString().split('T')[0], reference || notes, 'pending', req.user.id]
    );
    
    const e = result.rows[0];
    const expense = {
      id: e.id,
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount),
      date: e.date,
      reference: e.reference,
      status: e.status,
      approvedBy: e.approved_by,
      is_active: e.is_active,
      createdBy: e.created_by,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    };
    
    logActivity({
      userId: req.user.id, action: 'create', module: 'finance',
      description: `Created ${category} expense: ${description}`,
      entityId: expense.id, entityType: 'expense',
      amount: parseFloat(amount)
    });

    journalExpenseCreated({ ...e, category }).catch(e => console.error('[JOURNAL] expense:', e.message));

    // Approval check
    try {
      const appRes = await query("SELECT requires_approval FROM approval_settings WHERE module = 'expenses'");
      if (appRes.rows.length > 0 && appRes.rows[0].requires_approval) {
        await query(
          `INSERT INTO approval_requests (module, reference_type, reference_id, requested_by, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          ['expenses', 'expense', expense.id, req.user.id, 'pending', `Expense: ${category} - ${parseFloat(amount).toFixed(2)} EGP`]
        );
      }
    } catch(e) { console.error('Approval check failed:', e.message); }

    res.status(201).json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/expenses/:id/approve - Approve expense
router.put('/:id/approve', authenticate, authorize('finance_manager', 'admin'), async (req, res) => {
  try {
    const checkResult = await query(
      `SELECT * FROM expenses WHERE id = $1`,
      [req.params.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expense = checkResult.rows[0];
    
    if (expense.approved_by) {
      return res.status(400).json({ error: 'Expense already approved' });
    }
    
    const updateResult = await query(
      `UPDATE expenses 
       SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    
    const e = updateResult.rows[0];
    
    // Create supplier payable from approved expense
    try {
      const defaultSupplierId = 5; // المورد العام (General Supplier)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await query(
        `INSERT INTO supplier_payables (supplier_id, amount, paid_amount, balance, due_date, status, notes, created_at)
         VALUES ($1, $2, 0, $2, $3, 'pending', $4, NOW())`,
        [defaultSupplierId, parseFloat(e.amount), dueDate.toISOString().split('T')[0], `Expense: ${e.category} - ${e.description}`]
      );
    } catch (payErr) {
      console.error('[PAYABLE] Failed to create from expense:', payErr.message);
    }

    // Create journal entry for expense
    try {
      await journalExpenseCreated(e);
    } catch (jErr) {
      console.error('[JOURNAL] Failed to create expense entry:', jErr.message);
    }

    res.json({ 
      message: 'Expense approved successfully', 
      expense: {
        id: e.id,
        category: e.category,
        description: e.description,
        amount: parseFloat(e.amount),
        date: e.date,
        reference: e.reference,
        status: e.status,
        approvedBy: e.approved_by,
        is_active: e.is_active,
        createdBy: e.created_by,
        createdAt: e.created_at,
        updatedAt: e.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/stats - Statistics by category
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE date BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }
    
    const categoryResult = await query(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses ${dateFilter}
       GROUP BY category`,
      params
    );
    
    const monthlyResult = await query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as period, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses ${dateFilter}
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY period DESC`,
      params
    );
    
    const grandTotalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses ${dateFilter}`,
      params
    );
    
    const grandTotal = parseFloat(grandTotalResult.rows[0].total);
    const totalCount = parseInt(grandTotalResult.rows[0].count);
    
    const byCategory = categoryResult.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total),
      count: parseInt(row.count),
      average: parseInt(row.count) > 0 ? Math.round((parseFloat(row.total) / parseInt(row.count)) * 100) / 100 : 0,
      percentage: grandTotal > 0 ? Math.round((parseFloat(row.total) / grandTotal) * 10000) / 100 : 0
    })).sort((a, b) => b.total - a.total);
    
    const monthlyStats = monthlyResult.rows.map(row => ({
      period: row.period,
      total: parseFloat(row.total),
      count: parseInt(row.count)
    }));
    
    res.json({
      byCategory,
      monthlyStats,
      byPaymentMethod: [],
      grandTotal,
      totalCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/by-category - Category breakdown
router.get('/by-category', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE date BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }
    
    const result = await query(
      `SELECT category, 
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as count,
        json_agg(json_build_object(
          'id', id,
          'description', description,
          'amount', amount,
          'date', date,
          'reference', reference
        ) ORDER BY date DESC) as items
       FROM expenses
       ${dateFilter}
       GROUP BY category
       ORDER BY total_amount DESC`,
      params
    );
    
    const grandTotalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${dateFilter}`,
      params
    );
    
    const grandTotal = parseFloat(grandTotalResult.rows[0].total);
    const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    const categories = result.rows.map(row => ({
      category: row.category,
      totalAmount: parseFloat(row.total_amount),
      count: parseInt(row.count),
      percentage: grandTotal > 0 ? Math.round((parseFloat(row.total_amount) / grandTotal) * 10000) / 100 : 0,
      expenses: row.items
    }));
    
    res.json({
      categories,
      grandTotal,
      totalCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, 
        creator.name as created_by_name, 
        approver.name as approved_by_name
      FROM expenses e
      LEFT JOIN users creator ON e.created_by = creator.id
      LEFT JOIN users approver ON e.approved_by = approver.id
      WHERE e.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const e = result.rows[0];
    res.json({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount),
      date: e.date,
      reference: e.reference,
      status: e.status,
      approvedBy: e.approved_by,
      approvedByName: e.approved_by_name,
      is_active: e.is_active,
      createdBy: e.created_by,
      createdByName: e.created_by_name,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', authenticate, async (req, res) => {
  try {
    const checkResult = await query(
      `SELECT * FROM expenses WHERE id = $1`,
      [req.params.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expense = checkResult.rows[0];
    
    if (expense.approved_by && req.user.role !== 'admin' && req.user.role !== 'finance_manager') {
      return res.status(400).json({ error: 'Cannot edit approved expense' });
    }
    
    const updates = req.body;
    const allowedFields = ['category', 'description', 'amount', 'date', 'reference', 'status', 'is_active'];
    const setClauses = [];
    const params = [];
    let paramIdx = 1;
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx++}`);
        params.push(updates[field]);
      }
    });
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);
    
    const result = await query(
      `UPDATE expenses SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );
    
    const e = result.rows[0];
    res.json({ 
      message: 'Expense updated successfully', 
      expense: {
        id: e.id,
        category: e.category,
        description: e.description,
        amount: parseFloat(e.amount),
        date: e.date,
        reference: e.reference,
        status: e.status,
        approvedBy: e.approved_by,
        is_active: e.is_active,
        createdBy: e.created_by,
        createdAt: e.created_at,
        updatedAt: e.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', authenticate, authorize('finance_manager', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM expenses WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
