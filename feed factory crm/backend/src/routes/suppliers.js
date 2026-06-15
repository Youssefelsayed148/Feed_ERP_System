const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/suppliers - List all suppliers
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    const conditions = [];
    const params = [];
    let paramIdx = 1;
    
    if (status) {
      conditions.push(`s.is_active = $${paramIdx++}`);
      params.push(status === 'active');
    }
    
    if (search) {
      conditions.push(`(s.name ILIKE $${paramIdx} OR s.code ILIKE $${paramIdx} OR s.contact_person ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const result = await query(
      `SELECT s.*, COALESCE(SUM(po.total_amount), 0) as total_spend
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status IN ('approved', 'received')
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.name ASC`,
      params
    );
    
    const suppliers = result.rows.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address,
      materialsSupplied: s.materials_supplied || [],
      paymentTerms: s.payment_terms,
      performanceRating: parseFloat(s.performance_rating),
      totalSpend: parseFloat(s.total_spend) || 0,
      is_active: s.is_active,
      status: s.is_active ? 'active' : 'inactive',
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));
    
    res.json({ success: true, count: suppliers.length, data: suppliers });
  } catch (error) {
    logger.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/suppliers/:id - Get single supplier
router.get('/:id', authenticate, async (req, res) => {
  try {
    const supplierResult = await query(
      `SELECT s.* FROM suppliers s WHERE s.id = $1`,
      [req.params.id]
    );
    
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    const s = supplierResult.rows[0];
    
    let materials = [];
    if (s.materials_supplied && s.materials_supplied.length > 0) {
      const materialsResult = await query(
        `SELECT id, code, name_arabic, name_english, category, unit, unit_price FROM raw_materials WHERE id = ANY($1)`,
        [s.materials_supplied]
      );
      materials = materialsResult.rows.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name_english || m.name_arabic,
        nameArabic: m.name_arabic,
        nameEnglish: m.name_english,
        unit: m.unit,
        unitPrice: parseFloat(m.unit_price),
        category: m.category
      }));
    }
    
    res.json({ 
      success: true, 
      data: {
        id: s.id,
        code: s.code,
        name: s.name,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: s.address,
        materialsSupplied: materials,
        paymentTerms: s.payment_terms,
        performanceRating: parseFloat(s.performance_rating),
        is_active: s.is_active,
        status: s.is_active ? 'active' : 'inactive',
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }
    });
  } catch (error) {
    logger.error('Error fetching supplier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/suppliers - Create supplier
router.post('/', authenticate, async (req, res) => {
  try {
    let { code, name, contactPerson, phone, email, address, materialsSupplied, paymentTerms, performanceRating } = req.body;
    
    // Auto-generate code if not provided
    if (!code) {
      const lastResult = await query("SELECT code FROM suppliers ORDER BY id DESC LIMIT 1");
      const lastCode = lastResult.rows[0]?.code || 'SUP-000';
      const num = parseInt(lastCode.replace(/\D/g, '')) + 1;
      code = `SUP-${String(num).padStart(3, '0')}`;
    }
    
    const existingResult = await query(
      `SELECT id FROM suppliers WHERE code = $1`,
      [code]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Supplier code already exists' });
    }
    
    const result = await query(
      `INSERT INTO suppliers (code, name, contact_person, phone, email, address, materials_supplied, payment_terms, performance_rating, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
       RETURNING *`,
      [code, name, contactPerson, phone, email, address, materialsSupplied || [], paymentTerms, performanceRating || 3]
    );
    
    const s = result.rows[0];
    logger.info(`Created supplier: ${s.name} (${s.code})`);
    
    res.status(201).json({ 
      success: true, 
      data: {
        id: s.id,
        code: s.code,
        name: s.name,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: s.address,
        materialsSupplied: s.materials_supplied || [],
        paymentTerms: s.payment_terms,
        performanceRating: parseFloat(s.performance_rating),
        is_active: s.is_active,
        status: 'active',
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }
    });
  } catch (error) {
    logger.error('Error creating supplier:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updateData = req.body;
    
    const supplierResult = await query(
      `SELECT * FROM suppliers WHERE id = $1`,
      [req.params.id]
    );
    
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (updateData.code && updateData.code !== supplierResult.rows[0].code) {
      const existingResult = await query(
        `SELECT id FROM suppliers WHERE code = $1 AND id != $2`,
        [updateData.code, req.params.id]
      );
      
      if (existingResult.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Supplier code already exists' });
      }
    }
    
    const allowedFields = {
      code: 'code',
      name: 'name',
      contactPerson: 'contact_person',
      phone: 'phone',
      email: 'email',
      address: 'address',
      materialsSupplied: 'materials_supplied',
      paymentTerms: 'payment_terms',
      performanceRating: 'performance_rating',
      is_active: 'is_active'
    };
    
    const setClauses = [];
    const params = [];
    let paramIdx = 1;
    
    Object.keys(allowedFields).forEach(key => {
      if (updateData[key] !== undefined) {
        setClauses.push(`${allowedFields[key]} = $${paramIdx++}`);
        params.push(updateData[key]);
      }
    });
    
    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);
    
    const result = await query(
      `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );
    
    const s = result.rows[0];
    logger.info(`Updated supplier: ${s.name} (${req.params.id})`);
    
    res.json({ 
      success: true, 
      data: {
        id: s.id,
        code: s.code,
        name: s.name,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: s.address,
        materialsSupplied: s.materials_supplied || [],
        paymentTerms: s.payment_terms,
        performanceRating: parseFloat(s.performance_rating),
        is_active: s.is_active,
        status: s.is_active ? 'active' : 'inactive',
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }
    });
  } catch (error) {
    logger.error('Error updating supplier:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM suppliers WHERE id = $1 RETURNING name, code`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    const s = result.rows[0];
    logger.info(`Deleted supplier: ${s.name} (${req.params.id})`);
    
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    logger.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/suppliers/:id/materials - Get materials supplied by supplier
router.get('/:id/materials', authenticate, async (req, res) => {
  try {
    const supplierResult = await query(
      `SELECT id, code, name FROM suppliers WHERE id = $1`,
      [req.params.id]
    );
    
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const materials = await query(`
      SELECT rm.id, rm.code, rm.name_arabic, rm.name_english, rm.category, rm.unit, rm.unit_price,
             rm.current_stock, rm.min_stock_level, rm.reorder_level, rm.is_active,
             sm.unit_price as supplier_price, sm.lead_time_days, sm.is_preferred
      FROM supplier_materials sm
      JOIN raw_materials rm ON sm.raw_material_id = rm.id
      WHERE sm.supplier_id = $1 AND rm.is_active = true
      ORDER BY rm.name_arabic
    `, [req.params.id]);

    return res.json({
      success: true,
      supplier: supplierResult.rows[0],
      materials: materials.rows,
      total: materials.rowCount
    });
  } catch (error) {
    logger.error('Error fetching supplier materials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/suppliers/stats/overview - Get supplier statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COALESCE(AVG(performance_rating), 0) as avg_performance
       FROM suppliers`
    );
    
    const row = result.rows[0];
    
    res.json({ 
      success: true, 
      data: {
        totalSuppliers: parseInt(row.total),
        activeSuppliers: parseInt(row.active),
        byCategory: {},
        avgPerformanceRating: parseFloat(row.avg_performance),
        avgOnTimeDelivery: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching supplier stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
