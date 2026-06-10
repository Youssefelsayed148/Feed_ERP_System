const { query } = require('../config/database');

// Calculate production cost based on recipe and batch size
const calculateProductionCost = async (recipeId, batchSizeKg) => {
  // Get recipe with ingredients
  const recipeResult = await query(`
    SELECT fr.*, ft.name_arabic as feed_name
    FROM feed_recipes fr
    JOIN feed_types ft ON fr.feed_type_id = ft.id
    WHERE fr.id = $1
  `, [recipeId]);

  if (recipeResult.rows.length === 0) throw new Error('Recipe not found');
  const recipe = recipeResult.rows[0];

  // Get ingredients with current raw material prices
  const ingredientsResult = await query(`
    SELECT 
      fri.raw_material_id,
      fri.quantity_kg,
      fri.percentage,
      fri.unit_cost,
      rm.code,
      rm.name_arabic,
      rm.unit_price,
      rm.current_stock
    FROM feed_recipe_items fri
    JOIN raw_materials rm ON fri.raw_material_id = rm.id
    WHERE fri.recipe_id = $1
  `, [recipeId]);

  const materialsNeeded = ingredientsResult.rows.map(ing => {
    const quantity = (ing.percentage / 100) * batchSizeKg;
    const unitCost = ing.unit_price || ing.unit_cost || 0;
    return {
      material: ing.raw_material_id,
      name: ing.name_arabic,
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      available: (ing.current_stock || 0) >= quantity
    };
  });

  const totalMaterialCost = materialsNeeded.reduce((sum, m) => sum + m.totalCost, 0);

  return {
    batchSize: batchSizeKg,
    materials: materialsNeeded,
    totalMaterialCost,
    costPerKg: batchSizeKg > 0 ? totalMaterialCost / batchSizeKg : 0,
    canProduce: materialsNeeded.every(m => m.available)
  };
};

module.exports = { calculateProductionCost };
