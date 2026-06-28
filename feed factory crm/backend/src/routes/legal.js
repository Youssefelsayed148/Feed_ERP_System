const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'legal');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientId = req.body.client_id || 'general';
    const clientDir = path.join(uploadsDir, String(clientId));
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    cb(null, clientDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, Word, Excel, text, CSV'), false);
    }
  }
});

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
  // Feature: add columns for additional documents/links
  await query(`ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS link_url TEXT`);
  await query(`ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(10) DEFAULT 'file'`);
  // Backfill: fix old documents where is_required should be true
  await query(`
    UPDATE legal_documents ld
    SET is_required = true
    WHERE EXISTS (
      SELECT 1 FROM client_required_docs crd
      WHERE crd.doc_type = ld.type AND crd.is_required = true
    )
    AND ld.is_required = false
    AND (ld.file_type IS NULL OR ld.file_type != 'link')
  `);
};
ensureTable();

// GET /api/legal/required-docs - Fetch required document types from DB
router.get('/required-docs', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT doc_type as id, label_arabic as name, is_required as required
      FROM client_required_docs
      ORDER BY sort_order
    `);
    res.json({ docs: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/documents - List all legal documents (with client name from DB)
router.get('/documents', authenticate, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let sql = `
      SELECT * FROM (
        SELECT DISTINCT ON (ld.id) ld.*,
          COALESCE(NULLIF(c.name_arabic,''), c.name_english) as client_name_from_db,
          u.name as verified_by_name
        FROM legal_documents ld
        LEFT JOIN clients c ON c.id = ld.client_id
        LEFT JOIN users u ON ld.verified_by = u.id
        WHERE 1=1
    `;
    const params = [];
    if (client_id) { params.push(client_id); sql += ` AND ld.client_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND ld.status = $${params.length}`; }
    sql += ` ORDER BY ld.id, ld.created_at DESC
      ) sub ORDER BY sub.created_at DESC`;
    const result = await query(sql, params);
    // Normalize client_name field for frontend compatibility
    const documents = result.rows.map(d => ({
      ...d,
      client_name: d.client_name || d.client_name_from_db || ''
    }));
    res.json({ documents, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legal/documents - Create legal document (metadata only)
router.post('/documents', authenticate, async (req, res) => {
  try {
    const { client_id, client_name, folder, title, description, type, document_url, link_url, notes, expiry_date, is_required, file_type } = req.body;
    const result = await query(
      `INSERT INTO legal_documents (client_id, client_name, folder, title, description, type, document_url, link_url, file_type, notes, expiry_date, is_required, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [client_id, client_name, folder, title, description, type, document_url, link_url, file_type || 'file', notes, expiry_date, is_required || false, req.user.id]
    );
    // Create approval request
    try {
      await query(
        `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status)
         VALUES ($1, $2, $3, $4, $5, 'manager_review', 'pending') ON CONFLICT DO NOTHING`,
        ['legal', 'legal_document', result.rows[0].id, req.user.id,
         `Legal document: ${result.rows[0].title || result.rows[0].type}`]
      );
    } catch (e) { console.error('Error creating legal approval request:', e.message); }

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legal/documents/upload - Upload file + create legal document record
router.post('/documents/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { client_id, type, title, notes, expiry_date, link_url } = req.body;
    if (!client_id || !title) {
      return res.status(400).json({ error: 'client_id and title are required' });
    }
    if (!req.file && !link_url) {
      return res.status(400).json({ error: 'Either a file or a link_url is required' });
    }

    // Fetch client info for folder naming
    const clientResult = await query(
      `SELECT code, COALESCE(NULLIF(name_arabic,''), name_english) as name FROM clients WHERE id = $1`,
      [client_id]
    );
    const client = clientResult.rows[0] || { code: 'UNKNOWN', name: '' };

    // Determine if type is required
    let isRequired = false;
    if (type) {
      const reqCheck = await query(
        `SELECT 1 FROM client_required_docs WHERE doc_type = $1 AND is_required = true LIMIT 1`,
        [type]
      );
      isRequired = reqCheck.rows.length > 0;
    }

    let relativePath = null;
    let fileType = 'link';
    let storedLinkUrl = link_url || null;

    if (req.file) {
      relativePath = path.join('uploads', 'legal', String(client_id), req.file.filename).replace(/\\/g, '/');
      fileType = 'file';
      storedLinkUrl = null;
    }

    const result = await query(
      `INSERT INTO legal_documents (
        client_id, client_name, folder, title, type,
        document_url, link_url, file_type, notes, expiry_date, status, is_required, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        client_id,
        client.name,
        'CLT-' + client.code,
        title,
        type || null,
        relativePath,
        storedLinkUrl,
        fileType,
        notes || null,
        expiry_date || null,
        'pending',
        isRequired,
        req.user.id
      ]
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error uploading legal document:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/legal/documents/:id/verify - Verify/reject document
router.put('/documents/:id/verify', authenticate, authorize('legal_mgr', 'admin', 'owner'), async (req, res) => {
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

// DELETE /api/legal/documents/:id - Delete single document (owner only)
router.delete('/documents/:id', authenticate, authorize('owner'), async (req, res) => {
  try {
    const docResult = await query('SELECT * FROM legal_documents WHERE id = $1', [req.params.id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docResult.rows[0];
    if (doc.file_type === 'file' && doc.document_url) {
      const filePath = path.join(__dirname, '..', '..', '..', doc.document_url);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error('Error deleting file:', e.message);
      }
    }
    await query('DELETE FROM legal_documents WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'تم حذف المستند بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/legal/clients/:clientId/all-documents - Delete all client documents (owner only)
router.delete('/clients/:clientId/all-documents', authenticate, authorize('owner'), async (req, res) => {
  try {
    const docsResult = await query('SELECT * FROM legal_documents WHERE client_id = $1', [req.params.clientId]);
    const docs = docsResult.rows;
    for (const doc of docs) {
      if (doc.file_type === 'file' && doc.document_url) {
        const filePath = path.join(__dirname, '..', '..', '..', doc.document_url);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.error('Error deleting file:', e.message);
        }
      }
    }
    const deleteResult = await query('DELETE FROM legal_documents WHERE client_id = $1', [req.params.clientId]);
    res.json({ success: true, deleted: deleteResult.rowCount, message: 'تم حذف جميع مستندات العميل' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/clients - Get clients with their legal documents
router.get('/clients', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.name_arabic, c.name_english, c.code, c.status, c.phone, c.address, c.contact_person,
        COALESCE(json_agg(json_build_object(
          'id', ld.id, 'type', ld.type, 'title', ld.title,
          'status', ld.status, 'verified_at', ld.verified_at,
          'is_required', ld.is_required, 'file_type', ld.file_type, 'link_url', ld.link_url
        )) FILTER (WHERE ld.id IS NOT NULL), '[]') as documents,
        COUNT(DISTINCT CASE WHEN ld.status = 'verified' AND ld.is_required = true THEN ld.id END) as verified_required_count
      FROM clients c
      LEFT JOIN legal_documents ld ON c.id = ld.client_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name_arabic, c.name_english, c.code, c.status, c.phone, c.address, c.contact_person
      ORDER BY c.name_arabic
    `);
    res.json({ clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/legal/clients/:clientId/company-links - Save company links
router.put('/clients/:clientId/company-links', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { website, facebook, whatsapp } = req.body;
    const linkTypes = [
      { key: 'website', label: 'الموقع الإلكتروني' },
      { key: 'facebook', label: 'صفحة فيسبوك' },
      { key: 'whatsapp', label: 'رقم واتساب' }
    ];
    for (const lt of linkTypes) {
      const url = req.body[lt.key];
      // Remove existing link of this type for this client
      await query(
        `DELETE FROM legal_documents WHERE client_id = $1 AND type = $2 AND file_type = 'link'`,
        [clientId, lt.key]
      );
      if (url && url.trim()) {
        await query(
          `INSERT INTO legal_documents (client_id, title, type, link_url, file_type, is_required, status, created_by)
           VALUES ($1, $2, $3, $4, 'link', false, 'verified', $5)`,
          [clientId, lt.label, lt.key, url.trim(), req.user.id]
        );
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/clients-progress - Get client onboarding progress
router.get('/clients-progress', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.code,
        COALESCE(NULLIF(c.name_arabic,''), c.name_english) as name,
        COUNT(DISTINCT ld.id) as total_docs,
        COUNT(DISTINCT CASE WHEN ld.status = 'verified' THEN ld.id END) as verified_docs,
        (SELECT COUNT(*) FROM client_required_docs WHERE is_required = true) as required_count,
        COUNT(DISTINCT CASE WHEN ld.status = 'verified'
          AND EXISTS (SELECT 1 FROM client_required_docs crd
            WHERE crd.doc_type = ld.type AND crd.is_required = true)
          THEN ld.id END) as verified_required_count
      FROM clients c
      LEFT JOIN legal_documents ld ON ld.client_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id, c.code, c.name_arabic, c.name_english
      ORDER BY c.name_arabic
    `);
    res.json({ clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
