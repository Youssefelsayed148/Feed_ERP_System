const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const adminOnly = authorize('owner', 'admin');

router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT ft.*,
        fr.total_cost as recipe_cost, fr.id as recipe_id, fr.selling_price,
        COALESCE(
          (SELECT json_agg(
             json_build_object('package_size', fp.package_size, 'price_per_ton', fp.selling_price_75)
             ORDER BY fp.package_size
           )
           FROM feed_pricing fp
           WHERE fp.feed_type_id = ft.id AND fp.is_active = true
          ),
          '[]'
        ) as pricing
      FROM feed_types ft
      LEFT JOIN feed_recipes fr ON ft.id = fr.feed_type_id AND fr.is_active = true
      WHERE ft.is_active = true
    `;
    const params = [];
    if (category) {
      sql += ` AND ft.category = $1`;
      params.push(category);
    }
    sql += ` ORDER BY ft.code`;
    const result = await query(sql, params);

    const rows = result.rows.map(ft => {
      const pricing = (ft.pricing || []).map(p => ({
        package_size: parseInt(p.package_size),
        price_per_ton: parseFloat(p.price_per_ton) || 0
      }));

      return {
        id: ft.id,
        _id: String(ft.id),
        code: ft.code,
        name_arabic: ft.name_arabic,
        name_english: ft.name_english,
        name: ft.name_arabic || ft.name_english,
        protein_percentage: ft.protein_percentage,
        category: ft.category,
        sub_category: ft.sub_category,
        description: ft.description,
        is_active: ft.is_active,
        created_at: ft.created_at,
        updated_at: ft.updated_at,
        pricing
      };
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT COUNT(*) as total FROM feed_types WHERE is_active = true`);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM feed_types WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { code, name_arabic, name_english, protein_percentage, category, sub_category, description } = req.body;
    const result = await query(
      `INSERT INTO feed_types (code, name_arabic, name_english, protein_percentage, category, sub_category, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [code, name_arabic, name_english, protein_percentage, category, sub_category, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['code','name_arabic','name_english','protein_percentage','category','sub_category','description','is_active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(req.params.id);
    const result = await query(
      `UPDATE feed_types SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM feed_types WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;