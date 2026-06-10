const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/journal-entries', authenticate, async (req, res) => {
  try {
    const entries = await query(`
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      ORDER BY je.date DESC, je.id DESC
      LIMIT 100
    `);
    for (const entry of entries.rows) {
      const lines = await query(
        'SELECT jel.*, a.name as account_name, a.type as account_type FROM journal_entry_lines jel LEFT JOIN accounts a ON jel.account_id = a.id WHERE jel.journal_entry_id = $1 ORDER BY jel.id',
        [entry.id]
      );
      entry.entries = lines.rows.map(l => ({
        id: l.id,
        account: l.account_id || '',
        accountName: l.account_name || '',
        accountType: l.account_type || '',
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || ''
      }));
      entry.total = entry.entries.reduce((s, e) => s + e.debit, 0);
    }
    res.json({ success: true, entries: entries.rows });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/journal-entries', authenticate, async (req, res) => {
  try {
    const { date, description, reference, entries: inputEntries, lines: inputLines } = req.body;
    const lines = inputLines || inputEntries || [];
    if (!date || !description || lines.length === 0) {
      return res.status(400).json({ error: 'Date, description, and at least one line are required' });
    }
    if (lines.length !== 2) {
      return res.status(400).json({ error: 'Journal entry must have exactly 2 lines (debit and credit)' });
    }
    const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || l.debit_amount || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || l.credit_amount || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      return res.status(400).json({ error: `Debit (${totalDebit}) and credit (${totalCredit}) must balance` });
    }

    const result = await transaction(async (client) => {
      const jeResult = await client.query(
        `INSERT INTO journal_entries (entry_number, date, description, total_amount, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [`JE-NEW-${Date.now()}`, date, description, totalDebit, req.user.id]
      );
      const je = jeResult.rows[0];
      for (const line of lines) {
        const accountId = line.account_id || line.accountId || null;
        const accountName = line.accountName || line.account_name || '';
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);

        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [je.id, accountId, accountName, debit, credit, line.description || '']
        );
      }
      return je;
    });

    res.status(201).json({ success: true, entry: result });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounts', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.*, p.name as parent_name
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_id = p.id
      ORDER BY a.id
    `);
    res.json({ success: true, accounts: result.rows, total: result.rowCount });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finance/account-balances - Calculate real balances from journal entries
router.get('/account-balances', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        a.id,
        a.name,
        a.type,
        COALESCE(SUM(jel.debit), 0) as total_debit,
        COALESCE(SUM(jel.credit), 0) as total_credit,
        CASE
          WHEN a.type IN ('asset', 'expense') THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
          WHEN a.type IN ('liability', 'equity', 'revenue') THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
          ELSE 0
        END as balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
      LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.type
      ORDER BY a.id
    `);
    
    // Calculate totals
    const totalAssets = result.rows.filter(r => r.type === 'asset').reduce((s, r) => s + parseFloat(r.balance), 0);
    const totalLiabilities = result.rows.filter(r => r.type === 'liability').reduce((s, r) => s + parseFloat(r.balance), 0);
    const totalEquity = result.rows.filter(r => r.type === 'equity').reduce((s, r) => s + parseFloat(r.balance), 0);
    const totalRevenue = result.rows.filter(r => r.type === 'revenue').reduce((s, r) => s + parseFloat(r.balance), 0);
    const totalExpenses = result.rows.filter(r => r.type === 'expense').reduce((s, r) => s + parseFloat(r.balance), 0);
    
    res.json({
      success: true,
      accounts: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        totalDebit: parseFloat(r.total_debit),
        totalCredit: parseFloat(r.total_credit),
        balance: parseFloat(r.balance)
      })),
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        accountingEquation: totalAssets === (totalLiabilities + totalEquity + (totalRevenue - totalExpenses))
      }
    });
  } catch (error) {
    console.error('Error fetching account balances:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finance/trial-balance
router.get('/trial-balance', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        a.id,
        a.name,
        a.type,
        COALESCE(SUM(jel.debit), 0) as debit,
        COALESCE(SUM(jel.credit), 0) as credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.type
      HAVING COALESCE(SUM(jel.debit), 0) > 0 OR COALESCE(SUM(jel.credit), 0) > 0
      ORDER BY a.id
    `);
    
    const totalDebit = result.rows.reduce((s, r) => s + parseFloat(r.debit), 0);
    const totalCredit = result.rows.reduce((s, r) => s + parseFloat(r.credit), 0);
    
    res.json({
      success: true,
      lines: result.rows,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
