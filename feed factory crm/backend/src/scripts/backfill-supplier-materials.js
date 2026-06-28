/**
 * Backfill: populate supplier_materials from existing materials_supplied
 *
 * Background: every supplier's linked materials have always been stored in
 * suppliers.materials_supplied (a plain integer array), while the separate
 * supplier_materials join table — which supports per-supplier pricing and
 * lead time — was never written to. This left supplier_materials empty for
 * every supplier, which silently broke the material dropdown on Purchase
 * Orders (GET /api/suppliers/:id/materials reads from supplier_materials).
 *
 * Going forward, backend/routes/suppliers.js create/update handlers keep
 * both columns in sync. This script backfills supplier_materials for
 * suppliers that already existed before that sync logic was added.
 *
 * Safe to re-run: uses ON CONFLICT DO NOTHING, so it will not duplicate
 * rows or overwrite any unit_price/lead_time_days you've since edited
 * directly in supplier_materials.
 *
 * Run on Windows: cd backend && node src/scripts/backfill-supplier-materials.js
 */

require('dotenv').config();
const { query } = require('../config/database');

async function run() {
  console.log('Backfilling supplier_materials from materials_supplied...\n');

  const suppliersResult = await query(`
    SELECT id, code, name, materials_supplied
    FROM suppliers
    WHERE materials_supplied IS NOT NULL AND array_length(materials_supplied, 1) > 0
  `);

  console.log(`Found ${suppliersResult.rows.length} suppliers with materials to backfill.\n`);

  let totalLinked = 0;
  let totalSkipped = 0;
  let totalUnresolved = 0;

  for (const supplier of suppliersResult.rows) {
    console.log(`${supplier.code} - ${supplier.name}:`);
    for (const materialCode of supplier.materials_supplied) {
      try {
        // materials_supplied stores raw_materials.code (e.g. "RM001"), not
        // the numeric id, so resolve it first.
        const materialLookup = await query(
          `SELECT id FROM raw_materials WHERE code = $1`,
          [materialCode]
        );
        if (materialLookup.rows.length === 0) {
          console.log(`  SKIP  ${materialCode} (no matching raw_materials.code found)`);
          totalUnresolved++;
          continue;
        }
        const materialId = materialLookup.rows[0].id;

        const result = await query(
          `INSERT INTO supplier_materials (supplier_id, raw_material_id, unit_price)
           VALUES ($1, $2, (SELECT unit_price FROM raw_materials WHERE id = $2))
           ON CONFLICT (supplier_id, raw_material_id) DO NOTHING
           RETURNING id`,
          [supplier.id, materialId]
        );
        if (result.rows.length > 0) {
          console.log(`  OK  linked ${materialCode} (raw_material_id ${materialId})`);
          totalLinked++;
        } else {
          console.log(`  SKIP  ${materialCode} (already linked)`);
          totalSkipped++;
        }
      } catch (error) {
        console.error(`  FAILED  ${materialCode}:`, error.message);
      }
    }
  }

  console.log(`\nDone. ${totalLinked} new links created, ${totalSkipped} already existed, ${totalUnresolved} codes could not be matched to a raw material.\n`);

  const verifyResult = await query(`
    SELECT s.code, s.name, COUNT(sm.id) as material_count
    FROM suppliers s
    LEFT JOIN supplier_materials sm ON sm.supplier_id = s.id
    GROUP BY s.id, s.code, s.name
    ORDER BY s.code
  `);
  console.log('Final supplier_materials counts per supplier:');
  for (const row of verifyResult.rows) {
    console.log(`  ${row.code} - ${row.name}: ${row.material_count} materials linked`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});