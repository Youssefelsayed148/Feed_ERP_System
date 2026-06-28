/**
 * Migration: create missing `documents` and `client_required_docs` tables
 *
 * Root cause: GET /api/clients/:id (clients-pg.js) and the order-creation
 * compliance check in sales.js both query these two tables, but neither
 * was ever created. This produced the 500 errors seen when opening a
 * client's detail view (visible in the Network tab as two failed
 * requests literally named after the client's numeric id).
 *
 * `documents` matches the exact shape already assumed by documents.js
 * (the real upload/download/list routes), so this just creates the
 * table those routes were always expecting to exist.
 *
 * `client_required_docs` is a small reference table: one row per
 * document type a client must provide before they can be considered
 * fully compliant (and, per sales.js, before they can place orders).
 * It's seeded here with sensible defaults for an Egyptian feed-factory
 * client relationship — edit/add/remove rows any time, the rest of the
 * system reads this table dynamically.
 *
 * Run on Windows: cd backend && node src/scripts/add-documents-tables.js
 */

require('dotenv').config();
const { query } = require('../config/database');

async function run() {
  console.log('Creating documents table...\n');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        doc_type VARCHAR(200),
        file_path TEXT NOT NULL,
        description VARCHAR(200),
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  OK  documents table ready');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_entity
      ON documents(entity_type, entity_id)
    `);
    console.log('  OK  index on documents(entity_type, entity_id) ready');
  } catch (error) {
    console.error('  FAILED  documents table:', error.message);
  }

  console.log('\nCreating client_required_docs table...\n');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS client_required_docs (
        id SERIAL PRIMARY KEY,
        doc_type VARCHAR(200) NOT NULL,
        label_arabic VARCHAR(200),
        label_english VARCHAR(200),
        is_required BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  OK  client_required_docs table ready');
  } catch (error) {
    console.error('  FAILED  client_required_docs table:', error.message);
  }

  console.log('\nSeeding default required document types...\n');

  const defaults = [
    { doc_type: 'commercial_register', label_arabic: 'سجل تجاري', label_english: 'Commercial Register', sort_order: 1 },
    { doc_type: 'tax_card', label_arabic: 'بطاقة ضريبية', label_english: 'Tax Card', sort_order: 2 },
    { doc_type: 'national_id', label_arabic: 'بطاقة الرقم القومي', label_english: 'National ID', sort_order: 3 },
    { doc_type: 'signed_contract', label_arabic: 'عقد موقع', label_english: 'Signed Contract', sort_order: 4 },
  ];

  for (const doc of defaults) {
    try {
      const existing = await query(
        `SELECT id FROM client_required_docs WHERE doc_type = $1`,
        [doc.doc_type]
      );
      if (existing.rows.length > 0) {
        console.log(`  SKIP  ${doc.doc_type} (already exists)`);
        continue;
      }
      await query(
        `INSERT INTO client_required_docs (doc_type, label_arabic, label_english, is_required, sort_order)
         VALUES ($1, $2, $3, true, $4)`,
        [doc.doc_type, doc.label_arabic, doc.label_english, doc.sort_order]
      );
      console.log(`  OK  ${doc.doc_type} (${doc.label_arabic})`);
    } catch (error) {
      console.error(`  FAILED  ${doc.doc_type}:`, error.message);
    }
  }

  console.log('\nDone. Verifying...\n');

  const docsCheck = await query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'documents' ORDER BY ordinal_position
  `);
  console.log('documents columns:');
  docsCheck.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

  const reqDocsCheck = await query(`SELECT doc_type, label_arabic, is_required FROM client_required_docs ORDER BY sort_order`);
  console.log('\nclient_required_docs rows:');
  reqDocsCheck.rows.forEach(r => console.log(`  ${r.doc_type} - ${r.label_arabic} (required: ${r.is_required})`));

  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});