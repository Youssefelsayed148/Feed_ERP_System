const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'al_kheir_feed_factory',
  user: 'postgres',
  password: ''
});

async function query(text, params) {
  return await pool.query(text, params);
}

async function main() {
  // Fix original recipes 1 and 2 total_cost
  for (const recipeId of [1, 2]) {
    const items = await query('SELECT quantity_kg, unit_cost FROM feed_recipe_items WHERE recipe_id = $1', [recipeId]);
    let total = 0;
    for (const item of items.rows) {
      total += parseFloat(item.quantity_kg) * parseFloat(item.unit_cost);
    }
    const piasters = Math.round(total * 100);
    await query('UPDATE feed_recipes SET total_cost = $1 WHERE id = $2', [piasters, recipeId]);
    console.log('Recipe', recipeId, 'fixed:', total.toFixed(2), 'EGP (', piasters, 'piasters)');
  }

  // Verify all recipes are in correct range
  const all = await query('SELECT id, name, total_cost FROM feed_recipes ORDER BY id');
  console.log('\nAll recipe costs (EGP):');
  for (const r of all.rows) {
    const egp = parseFloat(r.total_cost) / 100;
    const ok = egp >= 13000 && egp <= 21000 ? 'OK' : 'OUT OF RANGE!';
    console.log(' ', r.id, '-', egp.toFixed(2), 'EGP', ok);
  }

  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end();
});
