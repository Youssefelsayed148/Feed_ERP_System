// Fix feed_pricing: divide all values by 10
// Current: selling_price_75 for 50kg = 1,038,450 (10,384 EGP/bag = 207,690 EGP/ton)
// Target: ~20,000 EGP/ton → ~1,000 EGP/bag → ~100,000 piasters/bag
// So divide current values by 10

const { query } = require('../src/config/database');

async function fix() {
  try {
    const result = await query(`
      UPDATE feed_pricing SET
        cost_price = cost_price / 10,
        selling_price_7 = selling_price_7 / 10,
        selling_price_75 = selling_price_75 / 10,
        selling_price_8 = selling_price_8 / 10,
        max_price = max_price / 10
    `);
    console.log(`✓ Updated ${result.rowCount} pricing records`);
    
    // Verify
    const verify = await query('SELECT feed_type_id, package_size, selling_price_75 FROM feed_pricing LIMIT 5');
    for (const row of verify.rows) {
      console.log(`  FT#${row.feed_type_id} ${row.package_size}kg: ${row.selling_price_75} piasters = ${(row.selling_price_75 / 100).toFixed(2)} EGP`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
}

fix();
