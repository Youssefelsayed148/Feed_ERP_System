const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/leads - List leads (inactive clients)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search, source, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        c.*
      FROM clients c
      WHERE c.status = 'inactive'
    `;
    const params = [];
    let idx = 0;

    if (search) {
      idx++;
      sql += ` AND (c.name_arabic ILIKE $${idx} OR c.code ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.email ILIKE $${idx})`;
      params.push(`%${search}%`);
    }

    if (source) {
      idx++;
      sql += ` AND c.category = $${idx}`;
      params.push(source);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM clients c WHERE c.status = 'inactive'`;
    const countParams = [];
    let cidx = 0;
    if (search) {
      cidx++;
      countSql += ` AND (c.name_arabic ILIKE $${cidx} OR c.code ILIKE $${cidx} OR c.phone ILIKE $${cidx} OR c.email ILIKE $${cidx})`;
      countParams.push(`%${search}%`);
    }
    if (source) {
      cidx++;
      countSql += ` AND c.category = $${cidx}`;
      countParams.push(source);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      leads: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/stats - Lead stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'wholesale') as wholesale,
        COUNT(*) FILTER (WHERE status = 'retail') as retail,
        COUNT(*) FILTER (WHERE status = 'farm') as farm,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
      FROM clients
      WHERE status = 'inactive'
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

// GET /api/leads/sources - Lead sources (categories)
router.get('/sources', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT status as source
      FROM clients
      WHERE status = 'inactive' AND status IS NOT NULL
      ORDER BY status
    `);

    res.json(result.rows.map(r => r.source));
  } catch (error) {
    console.error('Error fetching lead sources:', error);
    res.status(500).json({ error: 'Failed to fetch lead sources' });
  }
});

// POST /api/leads/sources - Create source (map to a default category or return success)
router.post('/sources', authenticate, authorize('owner', 'admin', 'sales_manager'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Source name is required' });
    }

    // Since there's no dedicated lead_sources table, we return success
    // In a real implementation, this might create a lookup entry
    res.status(201).json({ success: true, source: name });
  } catch (error) {
    console.error('Error creating lead source:', error);
    res.status(500).json({ error: 'Failed to create lead source' });
  }
});

// GET /api/leads/:id - Get single lead
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT * FROM clients WHERE id = $1 AND status = 'inactive'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads - Create lead (create inactive client)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, category, contact_person, phone, email, address, notes } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const result = await query(`
      INSERT INTO clients (name_arabic, code, category, contact_person, phone, email, address, status, credit_limit, current_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'inactive', 0, 0) RETURNING *
    `, [name, code, category || null, contact_person || null, phone || null, email || null, address || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['name_arabic', 'code', 'category', 'contact_person', 'phone', 'email', 'address', 'status', 'notes'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const result = await query(`
      UPDATE clients SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// POST /api/leads/:id/activities - Add activity (append to notes)
router.post('/:id/activities', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { activity } = req.body;
    if (!activity) {
      return res.status(400).json({ error: 'Activity text is required' });
    }

    const result = await query(`
      UPDATE clients 
      SET notes = COALESCE(notes, '') || E'\n' || $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'inactive'
      RETURNING *
    `, [`[${new Date().toISOString()}] ${activity}`, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error adding lead activity:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// POST /api/leads/assign - Assign leads
router.post('/assign', authenticate, authorize('owner', 'admin', 'sales_manager'), async (req, res) => {
  try {
    const { lead_ids, assigned_to } = req.body;
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0 || !assigned_to) {
      return res.status(400).json({ error: 'lead_ids array and assigned_to are required' });
    }

    // Since clients table may not have assigned_to, update notes as a workaround
    const result = await query(`
      UPDATE clients 
      SET notes = COALESCE(notes, '') || E'\nAssigned to user ' || $1 || ' at ' || CURRENT_TIMESTAMP::text,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::int[]) AND status = 'inactive'
      RETURNING id
    `, [assigned_to, lead_ids]);

    res.json({ 
      success: true, 
      assigned: result.rows.length,
      lead_ids: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error assigning leads:', error);
    res.status(500).json({ error: 'Failed to assign leads' });
  }
});

module.exports = router;
