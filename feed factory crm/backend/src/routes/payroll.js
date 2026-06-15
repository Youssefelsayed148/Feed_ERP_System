const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let sql = `
      SELECT pp.*,
        (SELECT COUNT(*) FROM payroll_records pr WHERE pr.period_id = pp.id) as employee_count,
        (SELECT COUNT(*) FROM payroll_records pr WHERE pr.period_id = pp.id AND pr.status = 'processed') as processed_count
      FROM payroll_periods pp
      WHERE 1=1`;
    const params = [];
    if (status) {
      sql += ` AND pp.status = $${params.length + 1}`;
      params.push(status);
    }
    sql += ` GROUP BY pp.id ORDER BY pp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await query(sql, params);

    const isPosted = (s) => ['posted', 'paid'].includes(s || '');
    const payrolls = result.rows.map(pp => ({
      _id: pp.id,
      id: pp.id,
      month: pp.period_name,
      year: pp.period_name ? pp.period_name.split('-')[0] : '',
      period_name: pp.period_name,
      status: pp.status || 'draft',
      dueDate: pp.due_date,
      totalBasicSalary: parseFloat(pp.total_basic_salary) || 0,
      totalAllowances: parseFloat(pp.total_bonus) || 0,
      totalDeductions: parseFloat(pp.total_deductions) || 0,
      totalNetSalary: parseFloat(pp.total_net_salary) || 0,
      employeeCount: parseInt(pp.employee_count) || 0,
      processedCount: parseInt(pp.processed_count) || 0,
      employeePayrolls: [],
      processedAt: null,
      approvedAt: null,
      approvedBy: null,
      postedAt: null,
      paidAt: null,
      postedToFinance: isPosted(pp.status),
      expenseId: null,
      payableId: null,
      createdAt: pp.created_at,
      updatedAt: pp.updated_at
    }));

    const countResult = await query('SELECT COUNT(*) as count FROM payroll_periods');
    res.json({
      success: true,
      payrolls,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const ppResult = await query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (ppResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll period not found' });
    }
    const pp = ppResult.rows[0];
    const records = await query(`
      SELECT pr.*,
             COALESCE(u.name, e.name) as employee_name,
             COALESCE(u.department, e.department) as department,
             COALESCE(u.role, e.position) as designation
      FROM payroll_records pr
      LEFT JOIN users u ON pr.user_id = u.id
      LEFT JOIN employees e ON pr.user_id = e.id
      WHERE pr.period_id = $1
      ORDER BY COALESCE(u.name, e.name)
    `, [id]);

    const isPosted = ['posted', 'paid'].includes(pp.status || '');
    res.json({
      success: true,
      payroll: {
        _id: pp.id,
        id: pp.id,
        month: pp.period_name,
        period_name: pp.period_name,
        status: pp.status || 'draft',
        dueDate: pp.due_date,
        totalBasicSalary: parseFloat(pp.total_basic_salary) || 0,
        totalAllowances: parseFloat(pp.total_bonus) || 0,
        totalDeductions: parseFloat(pp.total_deductions) || 0,
        totalNetSalary: parseFloat(pp.total_net_salary) || 0,
        processedAt: null,
        approvedAt: null,
        postedAt: null,
        paidAt: null,
        postedToFinance: isPosted,
        expenseId: null,
        payableId: null,
        employeePayrolls: records.rows.map(pr => ({
          _id: pr.id,
          id: pr.id,
          employeeId: pr.user_id,
          employeeName: pr.employee_name,
          employeeCode: '',
          department: pr.department,
          baseSalary: parseFloat(pr.basic_salary || 0),
          basicSalary: parseFloat(pr.basic_salary || 0),
          allowances: parseFloat(pr.additions || pr.allowances || 0),
          bonuses: parseFloat(pr.additions || 0),
          deductions: parseFloat(pr.deductions || 0),
          overtime: parseFloat(pr.overtime || 0),
          netSalary: parseFloat(pr.net_salary || 0),
          status: pr.status || 'pending',
          bankAccount: '',
          iban: ''
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching payroll period:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { month, year, periodName, period_name, employeePayrolls, dueDate, due_date } = req.body;
    let pn = periodName || period_name;
    if (!pn) {
      let m = parseInt(month) || (new Date().getMonth() + 1);
      let y = parseInt(year) || new Date().getFullYear();
      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        y = parseInt(parts[0]) || y;
        m = parseInt(parts[1]) || m;
      }
      pn = `${y}-${String(m).padStart(2, '0')}`;
    }
    const dd = dueDate || due_date || new Date().toISOString().split('T')[0];

    const existing = await query('SELECT id FROM payroll_periods WHERE period_name = $1', [pn]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Payroll period already exists' });
    }

    // Auto-load ALL active employees with actual salaries from employees table
    let employees = employeePayrolls;
    if (!employees || employees.length === 0) {
      const empRes = await query(`
        SELECT e.id, e.name, e.department, e.salary, e.position
        FROM employees e WHERE e.status = 'active' ORDER BY e.name
      `);
      employees = empRes.rows.map(e => ({
        employeeId: e.id,
        userId: e.id,
        employeeName: e.name,
        department: e.department,
        basicSalary: parseFloat(e.salary) || 0,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        netSalary: parseFloat(e.salary) || 0
      }));
      console.log('[PAYROLL] Auto-loaded ALL', employees.length, 'employees from employees table with salaries');
    }

    const totalBasic = employees.reduce((s, e) => s + parseFloat(e.basicSalary || e.basic_salary || 0), 0);
    const totalBonus = employees.reduce((s, e) => s + parseFloat(e.bonuses || e.allowances || 0), 0);
    const totalDed = employees.reduce((s, e) => s + parseFloat(e.deductions || 0), 0);
    const totalNet = employees.reduce((s, e) => s + parseFloat(e.netSalary || e.net_salary || 0), 0);

    const result = await transaction(async (client) => {
      const ppResult = await client.query(`
        INSERT INTO payroll_periods (period_name, due_date, total_basic_salary, total_bonus, total_deductions, total_net_salary, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7) RETURNING *
      `, [pn, dd, totalBasic, totalBonus, totalDed, totalNet, req.user.id]);

      const pp = ppResult.rows[0];

      for (const emp of employees) {
        const userId = emp.employeeId || emp.userId || emp.user_id;
        if (!userId) {
          console.warn('[PAYROLL] Skipping employee with no user_id:', emp.employeeName || 'unknown');
          continue;
        }
        await client.query(`
          INSERT INTO payroll_records (period_id, user_id, basic_salary, additions, deductions, net_salary, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        `, [
          pp.id,
          userId,
          parseFloat(emp.basicSalary || emp.basic_salary || 0),
          parseFloat(emp.allowances || emp.additions || 0) + parseFloat(emp.bonuses || 0),
          parseFloat(emp.deductions || 0),
          parseFloat(emp.netSalary || emp.net_salary || 0)
        ]);
      }
      return pp;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/process', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await transaction(async (client) => {
      const records = await client.query(
        `SELECT pr.id, pr.user_id, pr.basic_salary, pr.additions, pr.deductions
         FROM payroll_records pr WHERE pr.period_id = $1`,
        [id]
      );

      let totalBasic = 0, totalAdditions = 0, totalDeductions = 0, totalNet = 0;

      for (const rec of records.rows) {
        const basic = parseFloat(rec.basic_salary) || 0;
        const additions = parseFloat(rec.additions) || 0;
        const deductions = parseFloat(rec.deductions) || 0;
        const net = basic + additions - deductions;
        totalBasic += basic;
        totalAdditions += additions;
        totalDeductions += deductions;
        totalNet += net;

        await client.query(
          `UPDATE payroll_records SET net_salary = $1, status = 'processed' WHERE id = $2`,
          [net, rec.id]
        );
      }

      await client.query(`
        UPDATE payroll_periods
        SET status = 'processed',
            total_basic_salary = $1, total_bonus = $2, total_deductions = $3, total_net_salary = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [totalBasic, totalAdditions, totalDeductions, totalNet, id]);
    });

    const result = await query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payroll period not found' });
    res.json({ success: true, payroll: result.rows[0], message: `Payroll processed: ${result.rows[0].total_net_salary} EGP total` });
  } catch (error) {
    console.error('Error processing payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE payroll_periods SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processed' RETURNING *
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payroll period not found or not in processed status' });
    await query(`UPDATE payroll_records SET status = 'approved' WHERE period_id = $1`, [id]);
    res.json({ success: true, payroll: result.rows[0] });
  } catch (error) {
    console.error('Error approving payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// Owner/Admin can approve, process, and post to finance in one step
router.put('/:id/approve-all', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const ppResult = await query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (ppResult.rows.length === 0) return res.status(404).json({ error: 'Payroll period not found' });
    const pp = ppResult.rows[0];
    if (['paid', 'posted'].includes(pp.status)) {
      return res.status(400).json({ error: 'Payroll already finalized' });
    }

    const result = await transaction(async (client) => {
      // 1. Process if in draft (calculate net salaries)
      if (pp.status === 'draft') {
        const records = await client.query(
          `SELECT id, basic_salary, additions, deductions FROM payroll_records WHERE period_id = $1`,
          [id]
        );
        let totalBasic = 0, totalAdditions = 0, totalDeductions = 0, totalNet = 0;
        for (const rec of records.rows) {
          const basic = parseFloat(rec.basic_salary) || 0;
          const additions = parseFloat(rec.additions) || 0;
          const deductions = parseFloat(rec.deductions) || 0;
          const net = basic + additions - deductions;
          totalBasic += basic; totalAdditions += additions; totalDeductions += deductions; totalNet += net;
          await client.query(
            `UPDATE payroll_records SET net_salary = $1, status = 'processed' WHERE id = $2`,
            [net, rec.id]
          );
        }
        await client.query(`
          UPDATE payroll_periods
          SET status = 'processed', total_basic_salary = $1, total_bonus = $2, total_deductions = $3, total_net_salary = $4
          WHERE id = $5
        `, [totalBasic, totalAdditions, totalDeductions, totalNet, id]);
      }

      // 2. Approve
      await client.query(`
        UPDATE payroll_periods SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [id]);
      await client.query(`UPDATE payroll_records SET status = 'approved' WHERE period_id = $1`, [id]);

      // Fetch updated payroll data after processing/approval
      const updatedPP = await client.query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
      const ppData = updatedPP.rows[0];

      // 3. Post to finance (create expense + journal entry)
      const expenseResult = await client.query(`
        INSERT INTO expenses (description, amount, category, date, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [
        `Payroll for ${ppData.period_name}`,
        parseFloat(ppData.total_net_salary) || 0,
        'salary',
        new Date().toISOString().split('T')[0],
        'approved',
        req.user.id
      ]);

      const entryNumber = 'JE-PAY-' + String(ppData.id).padStart(5, '0');
      const jeResult = await client.query(`
        INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, total_amount, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [
        entryNumber,
        new Date().toISOString().split('T')[0],
        `Payroll posting for ${ppData.period_name}`,
        'payroll',
        ppData.id,
        parseFloat(ppData.total_net_salary) || 0,
        req.user.id
      ]);
      const jeId = jeResult.rows[0].id;
      await client.query(`
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
        VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)
      `, [
        jeId, 8, parseFloat(ppData.total_net_salary) || 0, 0, 'Salaries and Wages Expense', 1,
        jeId, 1, 0, parseFloat(ppData.total_net_salary) || 0, 'Cash paid for salaries', 2
      ]);

      return { payroll: ppData, expense: expenseResult.rows[0], journal: jeResult.rows[0] };
    });

    res.json({ success: true, payroll: result.payroll, message: 'Payroll fully approved, processed, and posted to finance' });
  } catch (error) {
    console.error('Error in full payroll approval:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/post', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const ppResult = await query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (ppResult.rows.length === 0) return res.status(404).json({ error: 'Payroll period not found' });
    const pp = ppResult.rows[0];

    const result = await transaction(async (client) => {
      await client.query(`
        UPDATE payroll_periods SET status = 'posted', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *
      `, [id]);
      await client.query(`UPDATE payroll_records SET status = 'paid' WHERE period_id = $1`, [id]);

      const expenseResult = await client.query(`
        INSERT INTO expenses (description, amount, category, date, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [
        `Payroll for ${pp.period_name}`,
        parseFloat(pp.total_net_salary) || 0,
        'salary',
        new Date().toISOString().split('T')[0],
        'approved',
        req.user.id
      ]);

      const entryNumber = 'JE-PAY-' + String(pp.id).padStart(5, '0');
      const jeResult = await client.query(`
        INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, total_amount, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [
        entryNumber,
        new Date().toISOString().split('T')[0],
        `Payroll posting for ${pp.period_name}`,
        'payroll',
        pp.id,
        parseFloat(pp.total_net_salary) || 0,
        req.user.id
      ]);
      const jeId = jeResult.rows[0].id;
      await client.query(`
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
        VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)
      `, [
        jeId, 8, parseFloat(pp.total_net_salary) || 0, 0, 'Salaries and Wages Expense', 1,
        jeId, 1, 0, parseFloat(pp.total_net_salary) || 0, 'Cash paid for salaries', 2
      ]);

      // expense_id column not available, skipping - expense created separately
      console.log('[PAYROLL] Expense created:', expenseResult.rows[0].id);

      return { expense: expenseResult.rows[0], journal: jeResult.rows[0] };
    });

    res.json({ success: true, message: 'Payroll posted to finance', data: result });
  } catch (error) {
    console.error('Error posting payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/mark-as-paid', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE payroll_periods SET status = 'paid', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payroll period not found' });
    await query(`UPDATE payroll_records SET status = 'paid' WHERE period_id = $1`, [id]);
    res.json({ success: true, payroll: result.rows[0] });
  } catch (error) {
    console.error('Error marking payroll as paid:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await transaction(async (client) => {
      await client.query('DELETE FROM payroll_records WHERE period_id = $1', [id]);
      await client.query('DELETE FROM payroll_periods WHERE id = $1', [id]);
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payroll/employee/:employeeId - Get payroll records for employee
router.get('/employee/:employeeId', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT pr.*, pp.period_name, pp.status as period_status
      FROM payroll_records pr
      JOIN payroll_periods pp ON pr.period_id = pp.id
      WHERE pr.user_id = $1
      ORDER BY pp.created_at DESC
    `, [req.params.employeeId]);
    res.json({ records: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payroll/:id/employees/:empId - Update individual employee payroll record
router.put('/:id/employees/:empId', authenticate, async (req, res) => {
  try {
    const { id, empId } = req.params;
    const { basicSalary, additions, deductions, allowances } = req.body;

    const basic = parseFloat(basicSalary) || 0;
    const adds = parseFloat(additions || allowances) || 0;
    const deds = parseFloat(deductions) || 0;
    const net = basic + adds - deds;

    await query(`
      UPDATE payroll_records
      SET basic_salary = $1, additions = $2, deductions = $3, net_salary = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND period_id = $6
    `, [basic, adds, deds, net, empId, id]);

    res.json({ success: true, message: 'Employee payroll updated', netSalary: net });
  } catch (error) {
    console.error('Error updating employee payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payroll/:id/recalculate - Recalculate period totals from individual records
router.put('/:id/recalculate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT COALESCE(SUM(basic_salary), 0) as total_basic,
             COALESCE(SUM(additions), 0) as total_additions,
             COALESCE(SUM(deductions), 0) as total_deductions,
             COALESCE(SUM(net_salary), 0) as total_net
      FROM payroll_records WHERE period_id = $1
    `, [id]);

    const t = result.rows[0];
    await query(`
      UPDATE payroll_periods
      SET total_basic_salary = $1, total_bonus = $2, total_deductions = $3, total_net_salary = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [t.total_basic, t.total_additions, t.total_deductions, t.total_net, id]);

    res.json({
      success: true,
      message: 'Payroll totals recalculated',
      totals: {
        totalBasicSalary: parseFloat(t.total_basic),
        totalAdditions: parseFloat(t.total_additions),
        totalDeductions: parseFloat(t.total_deductions),
        totalNetSalary: parseFloat(t.total_net)
      }
    });
  } catch (error) {
    console.error('Error recalculating payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payroll/:id/bulk-update - Apply increase to all employees
router.put('/:id/bulk-update', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { increaseType, increaseValue, field } = req.body;
    // increaseType: 'percentage' or 'fixed'
    // increaseValue: number
    // field: 'basic_salary', 'additions', or 'deductions'

    if (!increaseValue || !field) {
      return res.status(400).json({ error: 'increaseValue and field are required' });
    }

    const records = await query('SELECT id, basic_salary, additions, deductions FROM payroll_records WHERE period_id = $1', [id]);

    for (const rec of records.rows) {
      let currentVal = parseFloat(rec[field]) || 0;
      let newVal;
      if (increaseType === 'percentage') {
        newVal = currentVal + (currentVal * parseFloat(increaseValue) / 100);
      } else {
        newVal = currentVal + parseFloat(increaseValue);
      }
      const basic = parseFloat(rec.basic_salary) || 0;
      const adds = parseFloat(rec.additions) || 0;
      const deds = parseFloat(rec.deductions) || 0;
      const newField = field === 'basic_salary' ? newVal : basic;
      const newAdds = field === 'additions' ? newVal : adds;
      const newDeds = field === 'deductions' ? newVal : deds;
      const net = newField + newAdds - newDeds;

      await query(`
        UPDATE payroll_records
        SET basic_salary = $1, additions = $2, deductions = $3, net_salary = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [newField, newAdds, newDeds, net, rec.id]);
    }

    // Recalculate totals
    const totals = await query(`
      SELECT COALESCE(SUM(basic_salary),0) as tb, COALESCE(SUM(additions),0) as ta,
             COALESCE(SUM(deductions),0) as td, COALESCE(SUM(net_salary),0) as tn
      FROM payroll_records WHERE period_id = $1
    `, [id]);
    const t = totals.rows[0];
    await query(`
      UPDATE payroll_periods SET total_basic_salary=$1, total_bonus=$2, total_deductions=$3, total_net_salary=$4 WHERE id=$5
    `, [t.tb, t.ta, t.td, t.tn, id]);

    res.json({
      success: true,
      message: `Applied ${increaseType} increase of ${increaseValue} to ${field} for ${records.rows.length} employees`,
      totalNetSalary: parseFloat(t.tn)
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payroll/auto-create - Auto-create payroll for current month based on attendance
router.post('/auto-create', authenticate, authorize('owner', 'admin', 'hr_manager'), async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodName = `${year}-${String(month).padStart(2, '0')}`;
    
    // Check if period already exists
    const existing = await query('SELECT id FROM payroll_periods WHERE period_name = $1', [periodName]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Payroll for ${periodName} already exists`, periodId: existing.rows[0].id });
    }
    
    // Get all active employees with salary from existing payroll or users
    const employees = await query(`
      SELECT DISTINCT u.id, u.name, u.role, u.department,
        COALESCE(pr.basic_salary, 0) as salary
      FROM users u
      LEFT JOIN LATERAL (
        SELECT basic_salary FROM payroll_records
        WHERE user_id = u.id ORDER BY id DESC LIMIT 1
      ) pr ON true
      JOIN attendance_records ar ON ar.user_id = u.id
      WHERE u.id != 2 AND u.role != 'admin' -- skip system admin if needed
      ORDER BY u.name
    `);
    
    if (employees.rows.length === 0) {
      return res.status(400).json({ error: 'No active employees with attendance records found' });
    }
    
    // Calculate date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Create payroll period
    const period = await query(`
      INSERT INTO payroll_periods (period_name, start_date, end_date, status, created_by)
      VALUES ($1, $2, $3, 'processing', $4)
      RETURNING id
    `, [periodName, startDate, endDate, req.user.id]);
    const periodId = period.rows[0].id;
    
    let totalBasic = 0, totalNet = 0;
    
    // Create payroll records for each employee based on attendance
    for (const emp of employees.rows) {
      // Count working days in period
      const daysInMonth = new Date(year, month, 0).getDate();
      let workingDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month - 1, d);
        const dow = day.getDay();
        if (dow !== 5 && dow !== 6) workingDays++; // Skip Fri/Sat
      }
      
      // Get attendance for this employee in this period
      const attendance = await query(`
        SELECT COUNT(*) as present_days,
               COALESCE(EXTRACT(EPOCH FROM SUM(work_duration))/3600, 0) as total_hours
        FROM attendance_records
        WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status = 'present'
      `, [emp.id, startDate, endDate]);
      
      const att = attendance.rows[0];
      const presentDays = parseInt(att.present_days) || 0;
      const absentDays = Math.max(0, workingDays - presentDays);
      const totalHours = parseFloat(att.total_hours) || 0;
      
      // Calculate salary
      const monthlySalary = parseFloat(emp.salary) || 0;
      const dailyRate = workingDays > 0 ? monthlySalary / workingDays : 0;
      const deduction = absentDays * dailyRate * 0.5; // 50% deduction for absent days
      const netSalary = Math.max(0, monthlySalary - deduction);
      
      await query(`
        INSERT INTO payroll_records (user_id, period_id, period_start, period_end, basic_salary, deductions, net_salary, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'processed', $8)
      `, [emp.id, periodId, startDate, endDate, monthlySalary, deduction, netSalary, req.user.id]);
      
      totalBasic += monthlySalary;
      totalNet += netSalary;
    }
    
    // Update period totals
    await query(`
      UPDATE payroll_periods SET status='processed', total_basic_salary=$1, total_net_salary=$2,
        total_bonus=0, total_deductions=$3
      WHERE id=$4
    `, [totalBasic, totalNet, (totalBasic - totalNet), periodId]);
    
    res.json({
      success: true,
      message: `Payroll auto-created for ${periodName}: ${employees.rows.length} employees`,
      periodId,
      totalEmployees: employees.rows.length,
      totalBasic,
      totalNet
    });
  } catch (error) {
    console.error('Error auto-creating payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
