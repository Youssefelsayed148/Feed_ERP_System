const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Ensure legal_documents table exists
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      id SERIAL PRIMARY KEY,
      folder VARCHAR(50),
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name VARCHAR(200),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(100),
      document_url TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      expiry_date DATE,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP,
      rejection_reason TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
ensureTable();

// GET /api/legal/documents - List all legal documents
router.get('/documents', authenticate, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let sql = `SELECT ld.*, u.name as verified_by_name FROM legal_documents ld LEFT JOIN users u ON ld.verified_by = u.id WHERE 1=1`;
    const params = [];
    if (client_id) { params.push(client_id); sql += ` AND ld.client_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND ld.status = $${params.length}`; }
    sql += ' ORDER BY ld.created_at DESC';
    const result = await query(sql, params);
    res.json({ documents: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legal/documents - Create legal document
router.post('/documents', authenticate, async (req, res) => {
  try {
    const { client_id, client_name, folder, title, description, type, document_url, notes, expiry_date } = req.body;
    const result = await query(
      `INSERT INTO legal_documents (client_id, client_name, folder, title, description, type, document_url, notes, expiry_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [client_id, client_name, folder, title, description, type, document_url, notes, expiry_date, req.user.id]
    );
    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/legal/documents/:id/verify - Verify/reject document
router.put('/documents/:id/verify', authenticate, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const result = await query(
      `UPDATE legal_documents SET status = $1, verified_by = $2, verified_at = NOW(), rejection_reason = $3 WHERE id = $4 RETURNING *`,
      [status, req.user.id, rejection_reason, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/clients - Get clients for onboarding
router.get('/clients', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.name_arabic, c.name_english, c.code, c.status, c.phone,
        COALESCE(json_agg(json_build_object(
          'id', ld.id, 'type', ld.type, 'title', ld.title,
          'status', ld.status, 'verified_at', ld.verified_at
        )) FILTER (WHERE ld.id IS NOT NULL), '[]') as documents
      FROM clients c
      LEFT JOIN legal_documents ld ON c.id = ld.client_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name_arabic, c.name_english, c.code, c.status, c.phone
      ORDER BY c.name_arabic
    `);
    res.json({ clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
