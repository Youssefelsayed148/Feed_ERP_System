const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ============================================================
// All routes require authentication
// ============================================================
router.use(authenticate);

// GET /api/feed-recipes/ - List recipes (root route)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT fr.*, ft.name_arabic as feed_type_name
      FROM feed_recipes fr
      LEFT JOIN feed_types ft ON fr.feed_type_id = ft.id
      WHERE fr.is_active = true
      ORDER BY fr.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all feed types with pricing
router.get('/feed-types', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ft.id, ft.code, ft.name_arabic, ft.name_english, 
        ft.protein_percentage, ft.category, ft.sub_category,
        ft.description, ft.is_active,
        json_build_object(
          '10kg', json_build_object('cost', fp10.cost_price, 'selling', fp10.selling_price_75),
          '25kg', json_build_object('cost', fp25.cost_price, 'selling', fp25.selling_price_75),
          '50kg', json_build_object('cost', fp50.cost_price, 'selling', fp50.selling_price_75)
        ) as pricing,
        fr.total_cost as recipe_total_cost,
        fr.total_quantity_kg as recipe_total_kg,
        fr.selling_price as recipe_selling_price
      FROM feed_types ft
      LEFT JOIN feed_pricing fp10 ON ft.id = fp10.feed_type_id AND fp10.package_size = 10 AND fp10.is_active = true
      LEFT JOIN feed_pricing fp25 ON ft.id = fp25.feed_type_id AND fp25.package_size = 25 AND fp25.is_active = true
      LEFT JOIN feed_pricing fp50 ON ft.id = fp50.feed_type_id AND fp50.package_size = 50 AND fp50.is_active = true
      LEFT JOIN feed_recipes fr ON fr.feed_type_id = ft.id AND fr.is_active = true
      WHERE ft.is_active = true
      ORDER BY ft.code
    `);
    
    // Transform: pricing is stored in piasters, convert to EGP for display
    const rows = result.rows.map(ft => {
      const p = ft.pricing || {};
      // Convert from piasters to EGP (piasters / 100 = EGP)
      const sell10 = p['10kg']?.selling ? parseFloat(p['10kg'].selling) / 100 : 0;
      const sell25 = p['25kg']?.selling ? parseFloat(p['25kg'].selling) / 100 : 0;
      const sell50 = p['50kg']?.selling ? parseFloat(p['50kg'].selling) / 100 : 0;
      const cost10 = p['10kg']?.cost ? parseFloat(p['10kg'].cost) / 100 : 0;
      const cost25 = p['25kg']?.cost ? parseFloat(p['25kg'].cost) / 100 : 0;
      const cost50 = p['50kg']?.cost ? parseFloat(p['50kg'].cost) / 100 : 0;
      // Calculate per-ton prices:
      // 10kg bag * 100 = 1000kg (1 ton); 25kg bag * 40 = 1000kg; 50kg bag * 20 = 1000kg
      const sellPerTon = (sell10 * 100 + sell25 * 40 + sell50 * 20) / 3;
      const costPerTon = (cost10 * 100 + cost25 * 40 + cost50 * 20) / 3;
      // Calculate recipe-based pricing (correct cost + 16.5% margin)
      const recipeCost = parseFloat(ft.recipe_total_cost) || 0;
      const recipeKg = parseFloat(ft.recipe_total_kg) || 1000;
      const recipeCostPerTon = recipeCost > 0 ? (recipeCost / recipeKg) * 1000 : 0;
      const PROFIT_MARGIN = 0.165;
      const recipeSellPrice = recipeCostPerTon > 0 ? recipeCostPerTon * (1 + PROFIT_MARGIN) : 0;
      return {
        ...ft,
        pricing: undefined,
        selling_price_10kg: sell10,
        selling_price_25kg: sell25,
        selling_price_50kg: sell50,
        cost_price: cost50,
        // Bag-based pricing (per ton from bag prices)
        prices: {
          small: sellPerTon,
          medium: sellPerTon,
          large: sellPerTon
        },
        costPrices: {
          small: costPerTon,
          medium: costPerTon,
          large: costPerTon
        },
        // Recipe-based pricing (from actual recipe cost + 16.5% margin)
        // These are the correct prices for order creation
        recipeCostPerTon: recipeCostPerTon > 0 ? recipeCostPerTon : null,
        recipeSellPerTon: recipeSellPrice > 0 ? recipeSellPrice : null
      };
    });
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching feed types:', error);
    res.status(500).json({ error: 'Failed to fetch feed types' });
  }
});

// GET feed type with full pricing details
router.get('/feed-types/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        ft.*,
        json_agg(
          json_build_object(
            'id', fp.id,
            'package_size', fp.package_size,
            'unit', fp.unit,
            'cost_price', fp.cost_price,
            'selling_price_7', fp.selling_price_7,
            'selling_price_75', fp.selling_price_75,
            'selling_price_8', fp.selling_price_8,
            'max_price', fp.max_price,
            'valid_from', fp.valid_from,
            'valid_until', fp.valid_until
          ) ORDER BY fp.package_size
        ) as package_sizes
      FROM feed_types ft
      LEFT JOIN feed_pricing fp ON ft.id = fp.feed_type_id AND fp.is_active = true
      WHERE ft.id = $1
      GROUP BY ft.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feed type not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching feed type pricing:', error);
    res.status(500).json({ error: 'Failed to fetch feed type pricing' });
  }
});

// GET all feed recipes with ingredients
router.get('/recipes', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        fr.id, fr.feed_type_id, fr.version, fr.name,
        fr.total_quantity_kg, fr.total_cost, fr.selling_price, fr.is_active,
        ft.code as feed_code, ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english, ft.protein_percentage,
        (SELECT COUNT(*) FROM feed_recipe_items WHERE recipe_id = fr.id) as ingredient_count
      FROM feed_recipes fr
      JOIN feed_types ft ON fr.feed_type_id = ft.id
      WHERE fr.is_active = true
      ORDER BY ft.code
    `);

    const rows = result.rows.map(r => {
      const totalCost = parseFloat(r.total_cost) || 0;
      const totalKg = parseFloat(r.total_quantity_kg) || 1000;
      const costPerTon = totalCost / (totalKg / 1000);
      const sellPriceVal = r.selling_price !== null && r.selling_price !== undefined ? parseFloat(r.selling_price) : 0;
      const PROFIT_MARGIN = 0.165; // 16.5% as defined in sales module
      const marginPrice = costPerTon * (1 + PROFIT_MARGIN);
      // Use stored selling_price if set, otherwise calculate from margin
      const sellPrice = sellPriceVal > 0 ? sellPriceVal : marginPrice;
      // Flag if current cost exceeds stored selling price (cost increased since price was set)
      const costExceedsPrice = sellPriceVal > 0 && costPerTon > sellPriceVal;
      return {
        ...r,
        pricing: {
          cost_per_ton: costPerTon.toFixed(2),
          sell_per_ton: sellPrice.toFixed(2)
        },
        costExceedsPrice,
        costPerTon,
        marginSellPrice: marginPrice.toFixed(2)
      };
    });
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// GET single recipe with all ingredients
router.get('/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recipeResult = await query(`
      SELECT 
        fr.*,
        ft.code as feed_code, ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english, ft.protein_percentage
      FROM feed_recipes fr
      JOIN feed_types ft ON fr.feed_type_id = ft.id
      WHERE fr.id = $1
    `, [id]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = recipeResult.rows[0];

    // Get recipe ingredients
    const itemsResult = await query(`
      SELECT 
        fri.id, fri.raw_material_id, fri.quantity_kg,
        fri.percentage, fri.unit_cost,
        rm.code as material_code, rm.name_arabic as material_name_arabic,
        rm.name_english as material_name_english, rm.unit,
        rm.unit_price as current_unit_price
      FROM feed_recipe_items fri
      JOIN raw_materials rm ON fri.raw_material_id = rm.id
      WHERE fri.recipe_id = $1
      ORDER BY fri.quantity_kg DESC
    `, [id]);

    recipe.ingredients = itemsResult.rows;

    const totalCost = parseFloat(recipe.total_cost) || 0;
    const totalKg = parseFloat(recipe.total_quantity_kg) || 1000;
    const costPerTon = totalCost / (totalKg / 1000);
    const sellPriceVal = recipe.selling_price !== null && recipe.selling_price !== undefined ? parseFloat(recipe.selling_price) : 0;
    const PROFIT_MARGIN = 0.165;
    const marginPrice = costPerTon * (1 + PROFIT_MARGIN);
    const sellPrice = sellPriceVal > 0 ? sellPriceVal : marginPrice;
    const costExceedsPrice = sellPriceVal > 0 && costPerTon > sellPriceVal;
    recipe.pricing = {
      cost_per_ton: costPerTon.toFixed(2),
      sell_per_ton: sellPrice.toFixed(2)
    };
    recipe.costExceedsPrice = costExceedsPrice;
    recipe.costPerTon = costPerTon;
    recipe.marginSellPrice = marginPrice.toFixed(2);

    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// GET recipe by feed type
router.get('/recipes/by-feed-type/:feedTypeId', async (req, res) => {
  try {
    const { feedTypeId } = req.params;

    const recipeResult = await query(`
      SELECT 
        fr.id, fr.feed_type_id, fr.version, fr.name,
        fr.total_quantity_kg, fr.total_cost
      FROM feed_recipes fr
      WHERE fr.feed_type_id = $1 AND fr.is_active = true
      ORDER BY fr.version DESC
      LIMIT 1
    `, [feedTypeId]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found for this feed type' });
    }

    const recipe = recipeResult.rows[0];

    const itemsResult = await query(`
      SELECT 
        fri.raw_material_id, fri.quantity_kg, fri.percentage, fri.unit_cost,
        rm.name_arabic as material_name_arabic, rm.name_english as material_name_english,
        rm.unit, rm.current_stock
      FROM feed_recipe_items fri
      JOIN raw_materials rm ON fri.raw_material_id = rm.id
      WHERE fri.recipe_id = $1
      ORDER BY fri.quantity_kg DESC
    `, [recipe.id]);

    recipe.ingredients = itemsResult.rows;
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe by feed type:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// GET pricing summary (for dashboard)
router.get('/pricing-summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ft.category,
        COUNT(DISTINCT ft.id) as feed_count,
        COUNT(fp.id) as pricing_count,
        AVG(fp.cost_price) as avg_cost_price,
        AVG(fp.selling_price_7) as avg_selling_price
      FROM feed_types ft
      LEFT JOIN feed_pricing fp ON ft.id = fp.feed_type_id AND fp.is_active = true
      WHERE ft.is_active = true
      GROUP BY ft.category
      ORDER BY ft.category
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pricing summary:', error);
    res.status(500).json({ error: 'Failed to fetch pricing summary' });
  }
});

// POST /recipes - Create a new recipe with ingredients
router.post('/recipes', async (req, res) => {
  try {
    const { name, feedTypeId, version, ingredients, sellingPrice } = req.body;

    if (!name || !feedTypeId) {
      return res.status(400).json({ error: 'Name and feedTypeId are required' });
    }

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({ error: 'At least one ingredient is required' });
    }

    const result = await transaction(async (client) => {
      // Calculate total cost from ingredients
      let totalCost = 0;
      const validIngredients = [];
      
      for (const ing of ingredients) {
        if (!ing.raw_material_id && !ing.materialId) continue;
        const rawMaterialId = ing.raw_material_id || ing.materialId;
        const quantityKg = parseFloat(ing.quantity_kg || ing.quantity || 0);
        const percentage = parseFloat(ing.percentage || 0);
        // Get current unit price from raw_materials
        const priceRes = await client.query(
          'SELECT unit_price FROM raw_materials WHERE id = $1',
          [rawMaterialId]
        );
        const unitPrice = priceRes.rows.length > 0 ? parseFloat(priceRes.rows[0].unit_price) : 0;
        const unitCost = parseFloat(ing.unit_cost || ing.costPerUnit || unitPrice || 0);
        const lineTotal = quantityKg * unitCost;
        totalCost += lineTotal;
        
        validIngredients.push({
          raw_material_id: rawMaterialId,
          quantity_kg: quantityKg,
          percentage: percentage,
          unit_cost: unitCost
        });
      }

      if (validIngredients.length === 0) {
        throw new Error('No valid ingredients provided');
      }

      // Always use DB-calculated next version to avoid unique constraint violations
      // (frontend always sends version=1 which conflicts with existing recipes)
      const versionRes = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_ver FROM feed_recipes WHERE feed_type_id = $1',
        [feedTypeId]
      );
      const nextVersion = versionRes.rows[0].next_ver;

      // Create recipe
      const recipeRes = await client.query(`
        INSERT INTO feed_recipes (feed_type_id, version, name, total_quantity_kg, total_cost, selling_price, is_active)
        VALUES ($1, $2, $3, 1000, $4, $5, true)
        RETURNING *
      `, [feedTypeId, nextVersion, name, totalCost, sellingPrice || null]);

      const recipe = recipeRes.rows[0];

      // Insert ingredients
      for (const ing of validIngredients) {
        await client.query(`
          INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost)
          VALUES ($1, $2, $3, $4, $5)
        `, [recipe.id, ing.raw_material_id, ing.quantity_kg, ing.percentage, ing.unit_cost]);
      }

      return recipe;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /recipes/:id - Update recipe and its ingredients
router.put('/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sellingPrice, status, ingredients, feedTypeId, version } = req.body;

    const result = await transaction(async (client) => {
      // Update recipe header fields
      const updates = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
      if (sellingPrice !== undefined) { updates.push(`selling_price = $${idx++}`); values.push(sellingPrice); }
      if (status !== undefined) { updates.push(`is_active = $${idx++}`); values.push(status === 'active' || status === true); }
      if (feedTypeId !== undefined) { updates.push(`feed_type_id = $${idx++}`); values.push(feedTypeId); }
      if (version !== undefined) { updates.push(`version = $${idx++}`); values.push(version); }

      if (updates.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE feed_recipes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
          values
        );
      }

      // If ingredients provided, replace them
      if (ingredients && ingredients.length > 0) {
        // Delete existing ingredients
        await client.query('DELETE FROM feed_recipe_items WHERE recipe_id = $1', [id]);

        // Recalculate total cost
        let totalCost = 0;

        for (const ing of ingredients) {
          if (!ing.raw_material_id && !ing.materialId) continue;
          const rawMaterialId = ing.raw_material_id || ing.materialId;
          const quantityKg = parseFloat(ing.quantity_kg || ing.quantity || 0);
          const percentage = parseFloat(ing.percentage || 0);
          
          // Get current unit price if unit_cost not provided
          let unitCost = parseFloat(ing.unit_cost || ing.costPerUnit || 0);
          if (unitCost === 0) {
            const priceRes = await client.query(
              'SELECT unit_price FROM raw_materials WHERE id = $1',
              [rawMaterialId]
            );
            unitCost = priceRes.rows.length > 0 ? parseFloat(priceRes.rows[0].unit_price) : 0;
          }
          
          const lineTotal = quantityKg * unitCost;
          totalCost += lineTotal;

          await client.query(`
            INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, rawMaterialId, quantityKg, percentage, unitCost]);
        }

        // Update total cost
        await client.query(
          'UPDATE feed_recipes SET total_cost = $1, updated_at = NOW() WHERE id = $2',
          [totalCost, id]
        );
      }

      // Return updated recipe
      const updated = await client.query(`
        SELECT fr.*, ft.code as feed_code, ft.name_arabic as feed_name_arabic,
               ft.name_english as feed_name_english, ft.protein_percentage
        FROM feed_recipes fr
        JOIN feed_types ft ON fr.feed_type_id = ft.id
        WHERE fr.id = $1
      `, [id]);

      return updated.rows[0];
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /recipes/:id/status - Toggle recipe active/inactive
router.patch('/recipes/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const isActive = status === 'active' || status === true;
    
    const result = await query(
      'UPDATE feed_recipes SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling recipe status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;