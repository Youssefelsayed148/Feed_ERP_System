// Set correct pricing: ~20,000 EGP/ton
// For FT#1 50kg: selling_price = 104,620 piasters (1,046.20 EGP)
// Scale factor from current: multiply by 10
const { query } = require('../src/config/database');

async function fix() {
  await query(`
    UPDATE feed_pricing SET
      cost_price = cost_price * 10,
      selling_price_7 = selling_price_7 * 10,
      selling_price_75 = selling_price_75 * 10,
      selling_price_8 = selling_price_8 * 10,
      max_price = max_price * 10
  `);
  
  const r = await query('SELECT id, feed_type_id, package_size, cost_price, selling_price_75 FROM feed_pricing ORDER BY feed_type_id, package_size LIMIT 6');
  for (const row of r.rows) {
    const perTon = (row.selling_price_75 / 100) * (1000 / row.package_size);
    console.log(`FT#${row.feed_type_id} ${row.package_size}kg: sell=${row.selling_price_75} piasters = ${(row.selling_price_75/100).toFixed(2)} EGP/bag = ${perTon.toFixed(0)} EGP/ton`);
  }
  process.exit(0);
}
fix();
