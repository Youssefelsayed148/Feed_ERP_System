const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Helper to convert rows to CSV
const toCSV = (rows, headers) => {
  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => `"${(row[h.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
};

// GET /api/export/sales - Export sales orders as CSV
router.get('/sales', authenticate, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    let sql = `SELECT so.order_number, so.status, so.final_amount, so.created_at, c.name_arabic as client
               FROM sales_orders so JOIN clients c ON so.client_id = c.id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND so.status = $${params.length}`; }
    if (startDate) { params.push(startDate); sql += ` AND so.created_at >= $${params.length}`; }
    if (endDate) { params.push(endDate); sql += ` AND so.created_at <= $${params.length}`; }
    sql += ` ORDER BY so.created_at DESC`;
    const result = await query(sql, params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'order_number', label: 'Order Number' },
      { key: 'client', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'final_amount', label: 'Amount' },
      { key: 'created_at', label: 'Date' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /api/export/purchases - Export purchase orders as CSV
router.get('/purchases', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT po.po_number, po.status, po.total_amount, po.created_at, s.name as supplier
      FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.created_at DESC`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=purchases_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'po_number', label: 'PO Number' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'status', label: 'Status' },
      { key: 'total_amount', label: 'Amount' },
      { key: 'created_at', label: 'Date' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /api/export/inventory - Export inventory as CSV
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT rm.code, rm.name_arabic, rm.category, rm.current_stock, rm.unit_price,
             (rm.current_stock * rm.unit_price) as total_value, rm.reorder_level
      FROM raw_materials rm WHERE rm.is_active = true ORDER BY rm.code`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'code', label: 'Code' },
      { key: 'name_arabic', label: 'Material' },
      { key: 'category', label: 'Category' },
      { key: 'current_stock', label: 'Stock' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'total_value', label: 'Total Value' },
      { key: 'reorder_level', label: 'Reorder Level' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /api/export/payables - Export payables as CSV
router.get('/payables', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT sp.id, sp.amount, sp.balance, sp.due_date, sp.status, s.name as supplier
      FROM supplier_payables sp JOIN suppliers s ON sp.supplier_id = s.id
      WHERE sp.status IN ('pending','partial','overdue') ORDER BY sp.due_date`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payables_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'id', label: 'ID' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'amount', label: 'Amount' },
      { key: 'balance', label: 'Balance' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'status', label: 'Status' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /api/export/journal - Export journal entries as CSV
router.get('/journal', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT je.entry_number, je.date, je.description, je.reference_type, je.total_amount
      FROM journal_entries je ORDER BY je.date DESC, je.id DESC`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=journal_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'entry_number', label: 'Entry' },
      { key: 'date', label: 'Date' },
      { key: 'description', label: 'Description' },
      { key: 'reference_type', label: 'Type' },
      { key: 'total_amount', label: 'Amount' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /api/export/employees - Export employees as CSV
router.get('/employees', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT name, department, position, salary, status FROM employees WHERE status = \'active\' ORDER BY department');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=employees_export.csv');
    res.send(toCSV(result.rows, [
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'position', label: 'Position' },
      { key: 'salary', label: 'Salary' },
      { key: 'status', label: 'Status' }
    ]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
