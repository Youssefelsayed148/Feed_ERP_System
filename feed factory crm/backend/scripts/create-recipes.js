const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'al_kheir_feed_factory',
  user: 'postgres',
  password: ''
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function main() {
  // Get all feed types
  const feedTypesRes = await query('SELECT * FROM feed_types ORDER BY id');
  const feedTypes = feedTypesRes.rows;

  // Get existing recipes
  const recipesRes = await query('SELECT feed_type_id FROM feed_recipes');
  const existingFeedTypeIds = new Set(recipesRes.rows.map(r => r.feed_type_id));

  // Get raw materials
  const materialsRes = await query('SELECT * FROM raw_materials ORDER BY id');
  const materials = materialsRes.rows;
  const matByCode = {};
  materials.forEach(m => matByCode[m.code] = m);

  const makeIngredients = (proteinPct) => {
    const p = parseInt(proteinPct);
    const cornPct = Math.max(45, 65 - (p - 18) * 2.5);
    const soyPct = Math.min(32, 15 + (p - 18) * 1.5);
    const glutenPct = p >= 21 ? Math.min(10, (p - 20) * 2) : 0;
    const branPct = Math.max(3, 8 - (p - 18) * 0.3);
    const riceBranPct = Math.max(2, 5 - (p - 18) * 0.2);
    const limestonePct = 1.5;
    const saltPct = 0.35;
    const monoCalcPct = 1.2;
    const premixPct = 0.5;
    const lysinePct = p >= 20 ? 0.25 : 0.15;
    const methioninePct = p >= 20 ? 0.2 : 0.1;
    const enzymePct = 0.15;
    const cholinePct = 0.1;
    const sackPct = 1.0;

    const ings = [
      { code: 'RM002', qty: Math.round(cornPct * 10) / 10 },
      { code: 'RM006', qty: Math.round(soyPct * 10) / 10 },
    ];
    if (glutenPct > 0) {
      ings.push({ code: 'RM001', qty: Math.round(glutenPct * 10) / 10 });
    }
    ings.push(
      { code: 'RM004', qty: Math.round(branPct * 10) / 10 },
      { code: 'RM003', qty: Math.round(riceBranPct * 10) / 10 },
      { code: 'RM017', qty: Math.round(limestonePct * 10) / 10 },
      { code: 'RM021', qty: Math.round(saltPct * 100) / 100 },
      { code: 'RM022', qty: Math.round(monoCalcPct * 10) / 10 },
      { code: 'RM011', qty: Math.round(premixPct * 10) / 10 },
      { code: 'RM020', qty: Math.round(lysinePct * 100) / 100 },
      { code: 'RM023', qty: Math.round(methioninePct * 100) / 100 },
      { code: 'RM024', qty: Math.round(enzymePct * 100) / 100 },
      { code: 'RM019', qty: Math.round(cholinePct * 100) / 100 },
      { code: 'RM025', qty: Math.round(sackPct * 10) / 10 },
    );

    const totalQty = ings.reduce((s, i) => s + i.qty, 0);
    const scale = 1000 / totalQty;
    ings.forEach(i => i.qty = Math.round(i.qty * scale * 10) / 10);
    const finalTotal = ings.reduce((s, i) => s + i.qty, 0);
    const diff = 1000 - finalTotal;
    const cornIng = ings.find(i => i.code === 'RM002');
    if (cornIng) cornIng.qty = Math.round((cornIng.qty + diff) * 10) / 10;
    return ings;
  };

  let created = 0;

  for (const ft of feedTypes) {
    if (existingFeedTypeIds.has(ft.id)) {
      console.log(`Skipping feed type ${ft.id} - recipe already exists`);
      continue;
    }

    const proteinPct = parseInt(ft.protein_percentage);
    const ingredients = makeIngredients(proteinPct);

    let totalCost = 0;
    let totalQty = 0;
    for (const ing of ingredients) {
      const mat = matByCode[ing.code];
      if (!mat) {
        console.log(`  Warning: material ${ing.code} not found`);
        continue;
      }
      const unitCost = parseFloat(mat.unit_price);
      totalCost += ing.qty * unitCost;
      totalQty += ing.qty;
    }

    const recipeName = `وصفة ${ft.name_arabic}`;
    const recipeRes = await query(
      `INSERT INTO feed_recipes (feed_type_id, version, name, total_quantity_kg, total_cost, is_active)
       VALUES ($1, 1, $2, $3, $4, true) RETURNING id`,
      [ft.id, recipeName, totalQty, Math.round(totalCost * 100)]
    );
    const recipeId = recipeRes.rows[0].id;

    for (const ing of ingredients) {
      const mat = matByCode[ing.code];
      if (!mat) continue;
      const unitCost = parseFloat(mat.unit_price);
      const percentage = (ing.qty / totalQty) * 100;
      await query(
        `INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, mat.id, ing.qty, percentage.toFixed(2), unitCost]
      );
    }

    console.log(`Created recipe ${recipeId} for ${ft.name_arabic} (${ft.protein_percentage}) - ${ingredients.length} ingredients, total cost: ${Math.round(totalCost)} EGP`);
    created++;
  }

  console.log(`\nCreated ${created} new recipes. Total recipes: ${existingFeedTypeIds.size + created}`);
  await pool.end();
}

main().catch(e => {
  console.error('Error:', e);
  pool.end();
  process.exit(1);
});
