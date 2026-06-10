const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { journalSupplierPayment, journalPayableCreated } = require('../utils/journal');
const { logActivity } = require('../utils/activity');

// GET /api/payables - List with aging buckets
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, supplier, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const conditions = [];
    const params = [];
    let paramIdx = 1;
    
    if (status) {
      conditions.push(`p.status = $${paramIdx++}`);
      params.push(status);
    }
    if (supplier) {
      conditions.push(`p.supplier_id = $${paramIdx++}`);
      params.push(supplier);
    }
    if (startDate && endDate) {
      conditions.push(`p.due_date BETWEEN $${paramIdx++} AND $${paramIdx++}`);
      params.push(startDate, endDate);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM supplier_payables p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    const queryParams = [...params, parseInt(limit), offset];
    
    const result = await query(
      `SELECT p.*, s.name as supplier_name, s.credit_days, s.payment_terms
       FROM supplier_payables p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${whereClause}
       ORDER BY p.due_date ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      queryParams
    );
    
    const agingResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN p.due_date >= CURRENT_DATE THEN p.balance ELSE 0 END), 0) as current,
        COALESCE(SUM(CASE WHEN p.due_date < CURRENT_DATE AND p.due_date >= CURRENT_DATE - INTERVAL '30 days' THEN p.balance ELSE 0 END), 0) as bucket_1_30,
        COALESCE(SUM(CASE WHEN p.due_date < CURRENT_DATE - INTERVAL '30 days' AND p.due_date >= CURRENT_DATE - INTERVAL '60 days' THEN p.balance ELSE 0 END), 0) as bucket_31_60,
        COALESCE(SUM(CASE WHEN p.due_date < CURRENT_DATE - INTERVAL '60 days' AND p.due_date >= CURRENT_DATE - INTERVAL '90 days' THEN p.balance ELSE 0 END), 0) as bucket_61_90,
        COALESCE(SUM(CASE WHEN p.due_date < CURRENT_DATE - INTERVAL '90 days' THEN p.balance ELSE 0 END), 0) as bucket_90
       FROM supplier_payables p
       WHERE p.status IN ('pending', 'partial', 'overdue')`
    );
    
    const agingRow = agingResult.rows[0];
    const agingBuckets = {
      current: parseFloat(agingRow.current) || 0,
      '1-30': parseFloat(agingRow.bucket_1_30) || 0,
      '31-60': parseFloat(agingRow.bucket_31_60) || 0,
      '61-90': parseFloat(agingRow.bucket_61_90) || 0,
      '90+': parseFloat(agingRow.bucket_90) || 0
    };
    
    const payables = result.rows.map(p => {
      const dueDate = new Date(p.due_date);
      const today = new Date();
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        id: p.id,
        supplier: p.supplier_id,
        supplierName: p.supplier_name,
        creditDays: p.credit_days || 30,
        paymentTerms: p.payment_terms || 'آجل',
        poId: p.po_id,
        grnId: p.grn_id,
        amount: parseFloat(p.amount),
        paidAmount: parseFloat(p.paid_amount),
        balance: parseFloat(p.balance),
        dueDate: p.due_date,
        daysRemaining: diffDays,
        status: p.status,
        notes: p.notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    });
    
    res.json({ 
      payables, 
      total, 
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      agingBuckets 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payables/dashboard - Dashboard stats
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const outstandingResult = await query(
      `SELECT COALESCE(SUM(balance), 0) as total, COUNT(*) as count
       FROM supplier_payables
       WHERE status IN ('pending', 'partial', 'overdue')`
    );
    
    const totalOutstanding = parseFloat(outstandingResult.rows[0].total);
    
    const overdueResult = await query(
      `SELECT COALESCE(SUM(balance), 0) as total, COUNT(*) as count
       FROM supplier_payables
       WHERE status = 'overdue'`
    );
    
    const overdueAmount = parseFloat(overdueResult.rows[0].total);
    const overdueCount = parseInt(overdueResult.rows[0].count);
    
    const upcomingResult = await query(
      `SELECT p.*, s.name as supplier_name
       FROM supplier_payables p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.status IN ('pending', 'partial', 'overdue')
         AND p.due_date >= CURRENT_DATE
         AND p.due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY p.due_date ASC
       LIMIT 10`
    );
    
    const upcomingDue = upcomingResult.rows.map(p => ({
      id: p.id,
      supplier: p.supplier_id,
      supplierName: p.supplier_name,
      amount: parseFloat(p.amount),
      balance: parseFloat(p.balance),
      dueDate: p.due_date,
      status: p.status
    }));
    
    res.json({
      totalOutstanding,
      overdueAmount,
      overdueCount,
      byType: {},
      upcomingDue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payables/reminders - Get all reminders (MUST come before /:id)
router.get('/reminders', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT pr.*, s.name as supplier_name, sp.balance, sp.due_date
      FROM payables_reminders pr
      JOIN supplier_payables sp ON pr.payable_id = sp.id
      JOIN suppliers s ON sp.supplier_id = s.id
      WHERE pr.reminder_date >= CURRENT_DATE
      ORDER BY pr.reminder_date ASC
    `);
    
    const reminders = result.rows.map(r => ({
      id: r.id,
      payableId: r.payable_id,
      supplierName: r.supplier_name,
      balance: parseFloat(r.balance),
      dueDate: r.due_date,
      reminderDate: r.reminder_date ? new Date(r.reminder_date).toISOString().split('T')[0] : null,
      reminderType: r.reminder_type,
      message: r.message,
      daysUntilDue: Math.ceil((new Date(r.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    }));
    
    res.json({ reminders, count: reminders.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payables/:id - Get single payable
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payableResult = await query(
      `SELECT p.*, s.name as supplier_name
       FROM supplier_payables p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    
    if (payableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    
    const p = payableResult.rows[0];
    
    const poResult = await query(
      `SELECT * FROM purchase_orders WHERE id = $1`,
      [p.po_id]
    );
    
    const paymentsResult = await query(
      `SELECT sp.*, u.name as created_by_name
       FROM supplier_payments sp
       LEFT JOIN users u ON sp.created_by = u.id
       WHERE sp.payable_id = $1
       ORDER BY sp.payment_date DESC`,
      [req.params.id]
    );
    
    const payments = paymentsResult.rows.map(pay => ({
      id: pay.id,
      amount: parseFloat(pay.amount),
      paymentDate: pay.payment_date,
      method: pay.method,
      reference: pay.reference,
      notes: pay.notes,
      createdBy: pay.created_by,
      createdByName: pay.created_by_name,
      createdAt: pay.created_at
    }));
    
    res.json({
      id: p.id,
      supplier: p.supplier_id,
      supplierName: p.supplier_name,
      poId: p.po_id,
      grnId: p.grn_id,
      amount: parseFloat(p.amount),
      paidAmount: parseFloat(p.paid_amount),
      balance: parseFloat(p.balance),
      dueDate: p.due_date,
      status: p.status,
      notes: p.notes,
      purchaseOrderInfo: poResult.rows[0] || null,
      grnInfo: null,
      payments,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payables/:id/pay - Record payment (matches frontend expectation)
router.put('/:id/pay', authenticate, async (req, res) => {
  try {
    const { amount, method, reference, notes, date } = req.body;
    
    await query('BEGIN');
    try {
      const payableResult = await query(
        `SELECT * FROM supplier_payables WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      
      if (payableResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Payable not found' });
      }
      
      const payable = payableResult.rows[0];
      const paymentAmount = parseFloat(amount);
      
      if (paymentAmount <= 0 || paymentAmount > parseFloat(payable.balance)) {
        await query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid payment amount' });
      }
      
      await query(
        `INSERT INTO supplier_payments (payable_id, amount, payment_date, method, reference, notes, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [req.params.id, paymentAmount, date || new Date().toISOString().split('T')[0], method, reference, notes, req.user.id]
      );
      
      const newPaidAmount = parseFloat(payable.paid_amount) + paymentAmount;
      const newBalance = parseFloat(payable.amount) - newPaidAmount;
      let newStatus = payable.status;
      
      if (newBalance <= 0) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }
      
      await query(
        `UPDATE supplier_payables 
         SET paid_amount = $1, balance = $2, status = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [newPaidAmount, newBalance, newStatus, req.params.id]
      );
      
      await query('COMMIT');
      
      res.json({ 
        message: 'Payment recorded successfully', 
        payable: {
          id: parseInt(req.params.id),
          amount: parseFloat(payable.amount),
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus
        }
      });
    } catch (innerErr) {
      await query('ROLLBACK').catch(() => {});
      throw innerErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payables/:id/payment - Record payment (legacy)
router.post('/:id/payment', authenticate, async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;
    
    await query('BEGIN');
    try {
      const payableResult = await query(
        `SELECT * FROM supplier_payables WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      
      if (payableResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Payable not found' });
      }
      
      const payable = payableResult.rows[0];
      
      if (amount <= 0 || amount > payable.balance) {
        await query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid payment amount' });
      }
      
      await query(
        `INSERT INTO supplier_payments (payable_id, amount, payment_date, method, reference, notes, created_by, created_at)
         VALUES ($1, $2, NOW(), $3, $4, $5, $6, NOW())`,
        [req.params.id, parseFloat(amount), method, reference, notes, req.user.id]
      );
      
      const newPaidAmount = parseFloat(payable.paid_amount) + parseFloat(amount);
      const newBalance = parseFloat(payable.amount) - newPaidAmount;
      let newStatus = payable.status;
      
      if (newBalance <= 0) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }
      
      await query(
        `UPDATE supplier_payables 
         SET paid_amount = $1, balance = $2, status = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [newPaidAmount, newBalance, newStatus, req.params.id]
      );
      
      await query('COMMIT');
      
      res.json({ 
        message: 'Payment recorded successfully', 
        payable: {
          id: parseInt(req.params.id),
          amount: parseFloat(payable.amount),
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus
        }
      });
    } catch (innerErr) {
      await query('ROLLBACK').catch(() => {});
      throw innerErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payables/supplier/:supplierId - Get supplier payables
router.get('/supplier/:supplierId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, po.po_number
       FROM supplier_payables p
       LEFT JOIN purchase_orders po ON p.po_id = po.id
       WHERE p.supplier_id = $1
         AND p.status IN ('pending', 'partial', 'overdue')
       ORDER BY p.due_date ASC`,
      [req.params.supplierId]
    );
    
    const payables = result.rows.map(p => ({
      id: p.id,
      supplier: p.supplier_id,
      poId: p.po_id,
      poNumber: p.po_number,
      grnId: p.grn_id,
      amount: parseFloat(p.amount),
      paidAmount: parseFloat(p.paid_amount),
      balance: parseFloat(p.balance),
      dueDate: p.due_date,
      status: p.status,
      notes: p.notes
    }));
    
    const totalOutstanding = payables.reduce((sum, p) => sum + p.balance, 0);
    
    res.json({ payables, totalOutstanding, count: payables.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payables/:id/reminders - Create reminder
router.post('/:id/reminders', authenticate, async (req, res) => {
  try {
    const { reminderDate, reminderType, message, daysBeforeDue, daysBefore } = req.body;
    const payableId = req.params.id;
    
    // Verify payable exists
    const payableResult = await query('SELECT * FROM supplier_payables WHERE id = $1', [payableId]);
    if (payableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    
    const payable = payableResult.rows[0];
    
    // Calculate reminder date if daysBeforeDue provided
    let finalReminderDate = reminderDate;
    const daysBeforeReminder = daysBeforeDue || daysBefore;
    if (daysBeforeReminder && payable.due_date) {
      const dueStr = typeof payable.due_date === 'string' ? payable.due_date : payable.due_date.toISOString().split('T')[0];
      const dueDate = new Date(dueStr + 'T12:00:00');
      const reminder = new Date(dueDate);
      reminder.setDate(reminder.getDate() - parseInt(daysBeforeReminder));
      finalReminderDate = reminder.toISOString().split('T')[0];
    }
    
    const result = await query(
      `INSERT INTO payables_reminders (payable_id, reminder_date, reminder_type, message, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [payableId, finalReminderDate, reminderType || 'dashboard', message || `Payment due for payable #${payableId}`, req.user.id]
    );
    
    // Also create WhatsApp-style notification
    try {
      const supplierRes = await query('SELECT name FROM suppliers WHERE id = $1', [payable.supplier_id]);
      const supName = supplierRes.rows[0]?.name || 'Supplier';
      const reminderMsg = message || `🔔 Reminder: Payment of EGP ${(parseFloat(payable.balance)/100).toFixed(2)} due for ${supName} on ${payable.due_date}`;
      await query(
        `INSERT INTO notifications (role, module, type, title, message, reference_id, reference_type, is_read, created_at)
         VALUES ('finance_manager', 'finance', 'payable_reminder', 'Payment Reminder', $1, $2, 'supplier_payable', false, NOW())`,
        [reminderMsg, payableId]
      );
    } catch (notifErr) {
      console.error('[REMINDER] Failed to create notification:', notifErr.message);
    }
    
    res.status(201).json({
      message: 'Reminder set successfully',
      reminder: {
        id: result.rows[0].id,
        payableId: result.rows[0].payable_id,
        reminderDate: result.rows[0].reminder_date ? new Date(result.rows[0].reminder_date).toISOString().split('T')[0] : null,
        reminderType: result.rows[0].reminder_type,
        message: result.rows[0].message,
        isSent: false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payables/aging-report - Aging report
router.get('/aging-report', authenticate, authorize('finance_manager', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, s.name as supplier_name,
        CASE 
          WHEN p.due_date >= CURRENT_DATE THEN 0
          ELSE CURRENT_DATE - p.due_date
        END as days_overdue
       FROM supplier_payables p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.status IN ('pending', 'partial', 'overdue')
       ORDER BY p.due_date ASC`
    );
    
    const agingReport = {
      current: { total: 0, count: 0, items: [] },
      '1-30': { total: 0, count: 0, items: [] },
      '31-60': { total: 0, count: 0, items: [] },
      '61-90': { total: 0, count: 0, items: [] },
      '90+': { total: 0, count: 0, items: [] }
    };
    
    result.rows.forEach(p => {
      const days = parseInt(p.days_overdue);
      const balance = parseFloat(p.balance);
      const item = {
        id: p.id,
        supplierName: p.supplier_name,
        amount: parseFloat(p.amount),
        balance,
        daysOutstanding: days,
        dueDate: p.due_date
      };
      
      if (days <= 0) {
        agingReport.current.total += balance;
        agingReport.current.count++;
        agingReport.current.items.push(item);
      } else if (days <= 30) {
        agingReport['1-30'].total += balance;
        agingReport['1-30'].count++;
        agingReport['1-30'].items.push(item);
      } else if (days <= 60) {
        agingReport['31-60'].total += balance;
        agingReport['31-60'].count++;
        agingReport['31-60'].items.push(item);
      } else if (days <= 90) {
        agingReport['61-90'].total += balance;
        agingReport['61-90'].count++;
        agingReport['61-90'].items.push(item);
      } else {
        agingReport['90+'].total += balance;
        agingReport['90+'].count++;
        agingReport['90+'].items.push(item);
      }
    });
    
    const grandTotal = Object.values(agingReport).reduce((sum, bucket) => sum + bucket.total, 0);
    const totalCount = Object.values(agingReport).reduce((sum, bucket) => sum + bucket.count, 0);
    
    res.json({
      agingReport,
      grandTotal,
      totalCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payables - Create payable
router.post('/', authenticate, authorize('finance_manager', 'admin'), async (req, res) => {
  try {
    const {
      supplier,
      poId,
      grnId,
      amount,
      dueDate,
      notes
    } = req.body;
    
    let status = 'pending';
    if (dueDate && new Date() > new Date(dueDate)) {
      status = 'overdue';
    }
    
    const result = await query(
      `INSERT INTO supplier_payables (supplier_id, po_id, grn_id, amount, paid_amount, balance, due_date, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [supplier, poId || null, grnId || null, parseFloat(amount), dueDate, status, notes]
    );
    
    const p = result.rows[0];
    res.status(201).json({
      message: 'Payable created successfully',
      payable: {
        id: p.id,
        supplier: p.supplier_id,
        poId: p.po_id,
        grnId: p.grn_id,
        amount: parseFloat(p.amount),
        paidAmount: parseFloat(p.paid_amount),
        balance: parseFloat(p.balance),
        dueDate: p.due_date,
        status: p.status,
        notes: p.notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
    });

    // Create journal entry
    try {
      const supRes = await query('SELECT name FROM suppliers WHERE id = $1', [supplier]);
      await journalPayableCreated(p, supRes.rows[0]?.name || '');
    } catch (e) { console.error('[JOURNAL] Failed to create entry for payable:', e.message); }

    logActivity({
      userId: req.user.id, action: 'create', module: 'purchase',
      description: `Created supplier payable for amount ${amount}`,
      entityId: p.id, entityType: 'supplier_payable',
      amount: parseFloat(amount)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
