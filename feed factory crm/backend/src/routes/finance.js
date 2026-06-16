const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { journalPaymentReceived } = require('../utils/journal');
const { logActivity } = require('../utils/activity');

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    // Get accounting data from journal entries
    const accountingRes = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN a.type='revenue' THEN jel.credit - jel.debit ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN a.type='asset' AND a.id=1 THEN jel.debit - jel.credit ELSE 0 END), 0) as cash_balance,
        COALESCE(SUM(CASE WHEN a.type='asset' AND a.id=2 THEN jel.debit - jel.credit ELSE 0 END), 0) as accounts_receivable,
        COALESCE(SUM(CASE WHEN a.type='asset' AND a.id=3 THEN jel.debit - jel.credit ELSE 0 END), 0) as inventory_value,
        COALESCE(SUM(CASE WHEN a.type='liability' AND a.id=4 THEN jel.credit - jel.debit ELSE 0 END), 0) as accounts_payable,
        COALESCE(SUM(CASE WHEN a.type='expense' THEN jel.debit - jel.credit ELSE 0 END), 0) as total_expenses,
        COUNT(DISTINCT je.id) as total_journal_entries
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
      LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
      WHERE a.is_active = true
    `);

    // Get invoice data — overdue calculated from due_date, not status
    const invRes = await query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(balance_due) FILTER (WHERE status IN ('pending', 'partial', 'overdue')), 0) as total_receivables,
        COALESCE(SUM(balance_due) FILTER (WHERE status != 'paid' AND due_date < CURRENT_DATE AND balance_due > 0), 0) as overdue_amount
      FROM invoices
    `);
    
    // Today's collections
    const payRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total_collected
      FROM client_payment_history WHERE date = CURRENT_DATE
    `);
    
    // Today's sales
    const todayInvRes = await query(`
      SELECT COALESCE(SUM(final_amount), 0) as total
      FROM sales_orders WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    // Today's expenses
    const todayExpRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE DATE(date) = CURRENT_DATE AND status = 'approved'
    `);
    
    // Expense summary by category
    const expByCatRes = await query(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE status IN ('approved','pending')
      GROUP BY category ORDER BY total DESC
    `);
    
    // Recent expenses
    const recentExpRes = await query(`
      SELECT id, category, description, amount, date, status
      FROM expenses WHERE status IN ('approved','pending')
      ORDER BY date DESC LIMIT 10
    `);
    
    // Payables — overdue based on due_date
    const supPayRes = await query(`
      SELECT
        COALESCE(SUM(balance), 0) as total_payables,
        COALESCE(SUM(balance) FILTER (WHERE status IN ('pending','partial') AND due_date < CURRENT_DATE AND balance > 0), 0) as overdue_payables,
        COUNT(*) as payable_count
      FROM supplier_payables
      WHERE status IN ('pending', 'partial', 'overdue')
    `);
    
    // Today journal entries count
    const todayJournalRes = await query(`
      SELECT COUNT(*) as count FROM journal_entries WHERE date = CURRENT_DATE
    `);
    
    const accRow = accountingRes.rows[0];
    const row = invRes.rows[0];
    const supRow = supPayRes.rows[0];
    
    res.json({
      // Accounting-driven data
      totalRevenue: parseFloat(accRow.total_revenue),
      cashBalance: parseFloat(accRow.cash_balance),
      accountsReceivable: parseFloat(accRow.accounts_receivable),
      inventoryValue: parseFloat(accRow.inventory_value),
      accountsPayable: parseFloat(accRow.accounts_payable),
      totalExpenses: parseFloat(accRow.total_expenses),
      totalJournalEntries: parseInt(accRow.total_journal_entries),
      todayJournalEntries: parseInt(todayJournalRes.rows[0].count),
      netPosition: parseFloat(accRow.accounts_receivable) - parseFloat(accRow.accounts_payable),
      
      // Transaction data
      todayIncome: parseFloat(todayInvRes.rows[0].total),
      todayExpenses: parseFloat(todayExpRes.rows[0].total),
      todayCollections: parseFloat(payRes.rows[0].total_collected),
      receivables: parseFloat(row.total_receivables),
      overdue: parseFloat(row.overdue_amount),
      totalReceivables: parseFloat(row.total_receivables),
      totalCollected: parseFloat(payRes.rows[0].total_collected),
      invoiceCount: parseInt(row.total),
      totalPayables: parseFloat(supRow.total_payables),
      overduePayables: parseFloat(supRow.overdue_payables),
      payableCount: parseInt(supRow.payable_count),
      
      // Expense data
      expensesByCategory: expByCatRes.rows.map(r => ({
        category: r.category,
        count: parseInt(r.count),
        total: parseFloat(r.total)
      })),
      recentExpenses: recentExpRes.rows.map(r => ({
        id: r.id,
        category: r.category,
        description: r.description,
        amount: parseFloat(r.amount),
        date: r.date,
        status: r.status
      }))
    });
  } catch (error) {
    console.error('Finance dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices', authenticate, async (req, res) => {
  try {
    let sql = `SELECT i.*, c.name_arabic as client_name, c.code as client_code FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE 1=1`;
    const params = [];
    if (req.query.status) {
      sql += ` AND i.status = $${params.length + 1}`;
      params.push(req.query.status);
    }
    if (req.query.client) {
      sql += ` AND i.client_id = $${params.length + 1}`;
      params.push(req.query.client);
    }
    sql += ' ORDER BY i.created_at DESC';
    const result = await query(sql, params);
    const invoices = result.rows.map(inv => ({
      _id: inv.id,
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      client: { id: inv.client_id, name: inv.client_name, code: inv.client_code },
      client_id: inv.client_id,
      amount: parseFloat(inv.amount) || 0,
      paidAmount: parseFloat(inv.paid_amount) || 0,
      remainingAmount: parseFloat(inv.balance_due) || 0,
      balance_due: parseFloat(inv.balance_due) || 0,
      status: inv.status,
      orderNumber: inv.order_id ? `SO-${String(inv.order_id).padStart(5, '0')}` : '',
      order_id: inv.order_id,
      dueDate: inv.due_date,
      due_date: inv.due_date,
      createdAt: inv.created_at
    }));
    res.json({ invoices, total: invoices.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/payments', authenticate, async (req, res) => {
  try {
    let sql = `SELECT cph.*, c.name_arabic as client_name FROM client_payment_history cph LEFT JOIN clients c ON cph.client_id = c.id WHERE 1=1`;
    const params = [];
    if (req.query.client_id) {
      sql += ` AND cph.client_id = $${params.length + 1}`;
      params.push(req.query.client_id);
    }
    sql += ' ORDER BY cph.date DESC';
    const result = await query(sql, params);
    const payments = result.rows.map((pay, idx) => ({
      _id: pay.id,
      id: pay.id,
      paymentNumber: `PAY-${String(pay.id).padStart(5, '0')}`,
      client: { id: pay.client_id, name: pay.client_name },
      client_id: pay.client_id,
      amount: parseFloat(pay.amount) || 0,
      paymentMethod: pay.method || 'cash',
      method: pay.method,
      reference: pay.description || '',
      paymentDate: pay.date,
      date: pay.date,
      status: 'completed',
      invoice_id: pay.invoice_id
    }));
    res.json({ payments, total: payments.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payments', authenticate, async (req, res) => {
  try {
    const { invoiceId, invoice_id, client_id, amount, paymentMethod, method, paymentDate, notes, reference, description } = req.body;
    const finalClientId = client_id || null;
    const finalInvoiceId = invoiceId || invoice_id || null;
    const finalMethod = paymentMethod || method || 'cash';
    const finalDesc = notes || reference || description || 'Payment recorded';
    const finalDate = paymentDate || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO client_payment_history (client_id, invoice_id, amount, date, description, method, collected_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [finalClientId, finalInvoiceId, amount, finalDate, finalDesc, finalMethod, req.user.id]
    );
    const payment = result.rows[0];

    if (finalInvoiceId) {
      const invRes = await query('SELECT * FROM invoices WHERE id = $1', [finalInvoiceId]);
      if (invRes.rows.length > 0) {
        const inv = invRes.rows[0];
        const paid = (parseFloat(inv.paid_amount) || 0) + parseFloat(amount);
        const bal = parseFloat(inv.amount) - paid;
        await query(
          `UPDATE invoices SET paid_amount = $1, balance_due = $2, status = $3 WHERE id = $4`,
          [paid, bal, bal <= 0 ? 'paid' : 'partial', inv.id]
        );
      }
    }

    // Auto-create journal entry for payment received
    try {
      const clientRes = await query('SELECT name_arabic FROM clients WHERE id = $1', [finalClientId]);
      const clientName = clientRes.rows[0]?.name_arabic || '';
      await journalPaymentReceived(payment, clientName);
    } catch (journalError) {
      console.error('[JOURNAL] Failed to create entry for payment:', journalError.message);
    }

    logActivity({
      userId: req.user.id, action: 'payment', module: 'finance',
      description: `Recorded payment ${finalMethod} for amount ${amount}`,
      entityId: payment.id, entityType: 'payment',
      amount: parseFloat(amount)
    });

    res.status(201).json({
      _id: payment.id,
      id: payment.id,
      paymentNumber: `PAY-${String(payment.id).padStart(5, '0')}`,
      client: { id: payment.client_id, name: '' },
      amount: parseFloat(payment.amount),
      paymentMethod: payment.method,
      paymentDate: payment.date,
      status: 'completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounts', authenticate, async (req, res) => {
  try {
    const result = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts'");
    if (result.rows.length === 0) {
      return res.json({ success: true, accounts: [], total: 0 });
    }
    const data = await query('SELECT * FROM accounts ORDER BY code');
    res.json({ success: true, accounts: data.rows, total: data.rowCount });
  } catch (error) {
    res.json({ success: true, accounts: [], total: 0 });
  }
});

router.get('/expenses', authenticate, async (req, res) => {
  try {
    const result = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='expenses'");
    if (result.rows.length === 0) {
      return res.json({ expenses: [], total: 0 });
    }
    const data = await query('SELECT * FROM expenses ORDER BY created_at DESC');
    res.json({ expenses: data.rows, total: data.rowCount });
  } catch (error) {
    res.json({ expenses: [], total: 0 });
  }
});

router.get('/receivables', authenticate, async (req, res) => {
  try {
    const agingResult = await query(`
      SELECT
        c.id,
        c.name_arabic,
        c.name_english,
        c.code,
        c.phone,
        c.current_balance,
        c.credit_limit,
        c.status,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.status IN ('pending', 'partial', 'overdue')), 0) as total_due,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.status = 'overdue'), 0) as overdue_due,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.due_date >= CURRENT_DATE OR i.due_date IS NULL), 0) as current,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - INTERVAL '30 days'), 0) as bucket_1_30,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.due_date < CURRENT_DATE - INTERVAL '30 days' AND i.due_date >= CURRENT_DATE - INTERVAL '60 days'), 0) as bucket_31_60,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.due_date < CURRENT_DATE - INTERVAL '60 days' AND i.due_date >= CURRENT_DATE - INTERVAL '90 days'), 0) as bucket_61_90,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.due_date < CURRENT_DATE - INTERVAL '90 days'), 0) as bucket_over_90
      FROM clients c
      LEFT JOIN invoices i ON c.id = i.client_id AND i.status IN ('pending', 'partial', 'overdue')
      WHERE c.is_active = true
      GROUP BY c.id, c.name_arabic, c.name_english, c.code, c.current_balance, c.credit_limit, c.status
      HAVING COALESCE(SUM(i.balance_due) FILTER (WHERE i.status IN ('pending', 'partial', 'overdue')), 0) > 0
      ORDER BY total_due DESC
    `);

    const totalsResult = await query(`
      SELECT
        COALESCE(SUM(balance_due) FILTER (WHERE due_date >= CURRENT_DATE OR due_date IS NULL), 0) as current,
        COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days'), 0) as "1-30",
        COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days'), 0) as "31-60",
        COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days'), 0) as "61-90",
        COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE - INTERVAL '90 days'), 0) as "over-90",
        COALESCE(SUM(balance_due), 0) as total
      FROM invoices
      WHERE status IN ('pending', 'partial', 'overdue')
    `);

    const totalsRow = totalsResult.rows[0];
    const aging = agingResult.rows.map(c => ({
      client: c.name_arabic || c.name_english,
      clientEnglish: c.name_english || c.name_arabic,
      code: c.code,
      phone: c.phone,
      clientId: c.id,
      creditLimit: parseFloat(c.credit_limit || 0),
      currentBalance: parseFloat(c.current_balance || 0),
      amount: parseFloat(c.total_due),
      total_due: parseFloat(c.total_due),
      overdue_due: parseFloat(c.overdue_due),
      days: parseFloat(c.bucket_over_90) > 0 ? 90 : parseFloat(c.bucket_61_90) > 0 ? 61 : parseFloat(c.bucket_31_60) > 0 ? 31 : parseFloat(c.bucket_1_30) > 0 ? 1 : 0,
      current: parseFloat(c.current),
      bucket_1_30: parseFloat(c.bucket_1_30),
      bucket_31_60: parseFloat(c.bucket_31_60),
      bucket_61_90: parseFloat(c.bucket_61_90),
      bucket_over_90: parseFloat(c.bucket_over_90)
    }));

    res.json({
      aging,
      totals: {
        current: parseFloat(totalsRow.current),
        '1-30': parseFloat(totalsRow['1-30']),
        '31-60': parseFloat(totalsRow['31-60']),
        '61-90': parseFloat(totalsRow['61-90']),
        'over-90': parseFloat(totalsRow['over-90']),
        total: parseFloat(totalsRow.total)
      }
    });
  } catch (error) {
    console.error('Error fetching receivables:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
