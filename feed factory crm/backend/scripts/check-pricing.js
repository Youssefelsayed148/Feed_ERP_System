const { query } = require('../src/config/database');

async function check() {
  const r = await query('SELECT id, feed_type_id, package_size, cost_price, selling_price_75 FROM feed_pricing ORDER BY feed_type_id, package_size LIMIT 10');
  for (const row of r.rows) {
    console.log(`FT#${row.feed_type_id} ${row.package_size}kg: cost=${row.cost_price} sell_75=${row.selling_price_75} = ${(row.selling_price_75/100).toFixed(2)} EGP`);
  }
  process.exit(0);
}
check();
