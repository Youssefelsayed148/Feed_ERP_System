const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT ft.*,
        fr.total_cost as recipe_cost, fr.id as recipe_id, fr.selling_price,
        json_build_object(
          '10kg', json_build_object('cost', fp10.cost_price, 'selling', fp10.selling_price_75),
          '25kg', json_build_object('cost', fp25.cost_price, 'selling', fp25.selling_price_75),
          '50kg', json_build_object('cost', fp50.cost_price, 'selling', fp50.selling_price_75)
        ) as pricing
      FROM feed_types ft
      LEFT JOIN feed_recipes fr ON ft.id = fr.feed_type_id AND fr.is_active = true
      LEFT JOIN feed_pricing fp10 ON ft.id = fp10.feed_type_id AND fp10.package_size = 10 AND fp10.is_active = true
      LEFT JOIN feed_pricing fp25 ON ft.id = fp25.feed_type_id AND fp25.package_size = 25 AND fp25.is_active = true
      LEFT JOIN feed_pricing fp50 ON ft.id = fp50.feed_type_id AND fp50.package_size = 50 AND fp50.is_active = true
      WHERE ft.is_active = true
    `;
    const params = [];
    if (category) {
      sql += ` AND ft.category = $1`;
      params.push(category);
    }
    sql += ` ORDER BY ft.code`;
    const result = await query(sql, params);
    const recipeQtys = await query(`
      SELECT recipe_id, SUM(quantity_kg) as total_kg
      FROM feed_recipe_items GROUP BY recipe_id
    `);
    const qtyMap = {};
    for (const r of recipeQtys.rows) qtyMap[r.recipe_id] = parseFloat(r.total_kg) || 1000;

    const rows = result.rows.map(ft => {
      const recipeId = ft.recipe_id;
      const recipeCost = parseFloat(ft.recipe_cost || 0);
      const totalKg = qtyMap[recipeId] || 1000;
      const costPerTon = recipeCost / (totalKg / 1000);
      // Use recipe selling_price if set, otherwise default to 15% markup
      const sellPriceVal = ft.selling_price !== null && ft.selling_price !== undefined ? parseFloat(ft.selling_price) : 0;
      const sellPerTon = sellPriceVal > 0 ? sellPriceVal : (costPerTon * 1.15);
      const p = ft.pricing || {};
      return {
        ...ft,
        pricing: undefined,
        cost_per_ton: costPerTon,
        sell_per_ton: sellPerTon,
        prices: {
          small: sellPerTon,
          medium: sellPerTon,
          large: sellPerTon
        },
        costPrices: {
          small: costPerTon,
          medium: costPerTon,
          large: costPerTon
        }
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

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query(`DELETE FROM feed_types WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
