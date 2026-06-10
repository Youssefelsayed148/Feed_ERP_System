const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getRecentActivities } = require('../utils/activity');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM clients WHERE is_active=true) as total_clients,
        (SELECT COUNT(*) FROM suppliers WHERE is_active=true) as total_suppliers,
        (SELECT COUNT(*) FROM raw_materials WHERE is_active=true) as total_raw_materials,
        (SELECT COUNT(*) FROM sales_orders) as total_orders,
        (SELECT COALESCE(SUM(final_amount),0) FROM sales_orders WHERE status='delivered') as total_revenue,
        (SELECT COUNT(*) FROM sales_orders WHERE status='pending_approval') as pending_orders,
        (SELECT COUNT(*) FROM raw_materials WHERE current_stock <= min_stock_level AND is_active=true) as low_stock_count,
        (SELECT COUNT(*) FROM production_orders WHERE status NOT IN ('completed','cancelled')) as active_production,
        (SELECT COUNT(*) FROM invoices WHERE due_date < NOW() AND status != 'paid') as overdue_invoices,
        (SELECT COALESCE(SUM(balance),0) FROM supplier_payables WHERE status IN ('pending','partial','overdue')) as total_payables,
        (SELECT COALESCE(SUM(balance),0) FROM supplier_payables WHERE status='overdue') as overdue_payables,
        (SELECT COALESCE(SUM(balance_due),0) FROM invoices WHERE status IN ('pending','partial','overdue')) as total_receivables,
        (SELECT COUNT(*) FROM feed_recipes WHERE is_active=true) as total_recipes,
        (SELECT COUNT(*) FROM employees WHERE status='active') as total_employees,
         (SELECT COUNT(*) FROM purchase_orders WHERE status='draft') as pending_po_approvals,
         (SELECT COUNT(*) FROM goods_receipt_notes WHERE status IN ('pending','inspected')) as pending_grn,
         (SELECT COALESCE(SUM(quantity_kg),0) FROM finished_goods WHERE status='available') as finished_goods_kg,
         (SELECT COUNT(*) FROM finished_goods WHERE status='available') as finished_goods_batches,
        0 as expenses_this_month,
        0 as maintenance_overdue,
        0 as maintenance_due_this_week,
        0 as maintenance_upcoming
    `);

    const row = result.rows[0];

    // Get recent data
    const clientsRes = await query(`SELECT id, name_arabic as name, code, payment_terms, current_balance, credit_limit, status FROM clients WHERE is_active=true ORDER BY created_at DESC LIMIT 5`);
    const materialsRes = await query(`SELECT id, code, name_arabic as name, name_english, category, current_stock, unit_price, min_stock_level FROM raw_materials WHERE is_active=true ORDER BY current_stock ASC LIMIT 8`);
    const ordersRes = await query(`SELECT id, order_number, client_id, final_amount, status, created_at FROM sales_orders ORDER BY created_at DESC LIMIT 5`);
    const productionRes = await query(`SELECT id, order_number, feed_type_id, status, quantity_kg, created_at FROM production_orders ORDER BY created_at DESC LIMIT 5`);
    const invoicesRes = await query(`SELECT id, invoice_number, client_id, amount, paid_amount, balance_due, status, due_date FROM invoices ORDER BY created_at DESC LIMIT 5`);
    const payablesRes = await query(`SELECT p.id, p.amount, p.balance, p.status, p.due_date, s.name as supplier_name FROM supplier_payables p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.status IN ('pending','partial','overdue') ORDER BY p.due_date ASC LIMIT 5`);
    const recipesRes = await query(`SELECT id, name, total_cost FROM feed_recipes WHERE is_active=true ORDER BY id LIMIT 5`);

    const productionWithSalesRes = await query(`
      SELECT po.*, ft.name_arabic as feed_name,
             (SELECT order_number FROM sales_orders so WHERE so.id = (
               SELECT order_id FROM sales_order_items WHERE feed_type_id = po.feed_type_id LIMIT 1
             )) as related_sale
      FROM production_orders po
      LEFT JOIN feed_types ft ON po.feed_type_id = ft.id
      ORDER BY po.created_at DESC LIMIT 5
    `);

    const poWithGrnRes = await query(`
      SELECT po.*, s.name as supplier_name,
             grn.grn_number, grn.received_date, grn.status as grn_status
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN goods_receipt_notes grn ON grn.purchase_order_id = po.id
      ORDER BY po.created_at DESC LIMIT 5
    `);

    // Activity feed
    const activityRes = await query(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20
    `);

    res.json({
      total_clients: parseInt(row.total_clients),
      total_suppliers: parseInt(row.total_suppliers),
      total_raw_materials: parseInt(row.total_raw_materials),
      total_orders: parseInt(row.total_orders),
      total_revenue: parseFloat(row.total_revenue),
      pending_orders: parseInt(row.pending_orders),
      low_stock_count: parseInt(row.low_stock_count),
      active_production: parseInt(row.active_production),
      overdue_invoices: parseInt(row.overdue_invoices),
      total_payables: parseFloat(row.total_payables),
      overdue_payables: parseFloat(row.overdue_payables),
      total_receivables: parseFloat(row.total_receivables),
      total_recipes: parseInt(row.total_recipes),
      total_employees: parseInt(row.total_employees),
      pending_po_approvals: parseInt(row.pending_po_approvals),
      pending_grn: parseInt(row.pending_grn),
      finished_goods_kg: parseFloat(row.finished_goods_kg),
      finished_goods_tons: parseFloat(row.finished_goods_kg) / 1000,
      finished_goods_batches: parseInt(row.finished_goods_batches),
      expenses_this_month: parseFloat(row.expenses_this_month),
      maintenance_overdue: parseInt(row.maintenance_overdue),
      maintenance_due_this_week: parseInt(row.maintenance_due_this_week),
      maintenance_upcoming: parseInt(row.maintenance_upcoming),
      clients: clientsRes.rows,
      materials: materialsRes.rows,
      orders: ordersRes.rows,
      production: productionRes.rows,
      invoices: invoicesRes.rows,
      payables: payablesRes.rows,
      recipes: recipesRes.rows,
      activity: activityRes.rows.map(a => ({
        id: a.id,
        userId: a.user_id,
        userName: a.user_name,
        userRole: a.user_role,
        action: a.action,
        module: a.module,
        description: a.description,
        entityId: a.entity_id,
        entityType: a.entity_type,
        amount: parseFloat(a.amount) || 0,
        oldStatus: a.old_status,
        newStatus: a.new_status,
        createdAt: a.created_at
      })),
      productionWithSales: productionWithSalesRes.rows,
      purchaseOrdersWithGRN: poWithGrnRes.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/charts - Aggregated data for charts
router.get('/charts', authenticate, async (req, res) => {
  try {
    // Revenue by month (from journal entries)
    const revenueByMonth = await query(`
      SELECT TO_CHAR(je.date, 'YYYY-MM') as month, SUM(jel.credit) as revenue
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      JOIN accounts a ON jel.account_id = a.id
      WHERE a.type = 'revenue'
      GROUP BY month ORDER BY month
    `);

    // Expenses by category (from journal entries)
    const expensesByCategory = await query(`
      SELECT a.name as category, SUM(jel.debit) as amount
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      JOIN accounts a ON jel.account_id = a.id
      WHERE a.type = 'expense'
      GROUP BY a.name ORDER BY amount DESC
    `);

    // Production output by feed type
    const productionByType = await query(`
      SELECT ft.name_arabic, SUM(fg.quantity_kg) as total_kg
      FROM finished_goods fg
      JOIN feed_types ft ON fg.feed_type_id = ft.id
      WHERE fg.status = 'available'
      GROUP BY ft.name_arabic ORDER BY total_kg DESC
    `);

    // Monthly sales orders count
    const salesByMonth = await query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COALESCE(SUM(final_amount),0) as total
      FROM sales_orders GROUP BY month ORDER BY month
    `);

    // Top clients by revenue
    const topClients = await query(`
      SELECT c.name_arabic, COALESCE(SUM(so.final_amount),0) as total
      FROM sales_orders so JOIN clients c ON so.client_id = c.id
      WHERE so.status NOT IN ('cancelled','rejected')
      GROUP BY c.name_arabic ORDER BY total DESC LIMIT 5
    `);

    // Payables aging distribution
    const agingDist = await query(`
      SELECT
        COUNT(*) FILTER (WHERE due_date >= CURRENT_DATE) as current,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30) as late_30,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE - 30) as overdue
      FROM supplier_payables WHERE status IN ('pending','partial','overdue')
    `);

    // Inventory value by category
    const inventoryByCategory = await query(`
      SELECT rm.category, COUNT(*) as items, COALESCE(SUM(rm.current_stock * rm.unit_price),0) as value
      FROM raw_materials rm WHERE rm.is_active = true
      GROUP BY rm.category ORDER BY value DESC
    `);

    res.json({
      revenueByMonth: revenueByMonth.rows,
      expensesByCategory: expensesByCategory.rows,
      productionByType: productionByType.rows,
      salesByMonth: salesByMonth.rows,
      topClients: topClients.rows,
      agingDist: agingDist.rows[0],
      inventoryByCategory: inventoryByCategory.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
