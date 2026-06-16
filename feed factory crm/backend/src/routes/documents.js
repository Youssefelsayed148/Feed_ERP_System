const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = req.params.entityType || 'general';
    const entityDir = path.join(uploadsDir, entityType);
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }
    cb(null, entityDir);
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

// ============================================
// UPLOAD DOCUMENT
// ============================================
router.post('/upload/:entityType/:entityId', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { entityType, entityId } = req.params;
    const { description } = req.body;
    const uploadedBy = req.user.id;

    const relativePath = path.join('uploads', entityType, req.file.filename);

    const result = await query(
      `INSERT INTO documents (entity_type, entity_id, doc_type, file_path, description, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [entityType, entityId, req.file.originalname, relativePath, description || null, uploadedBy]
    );

    res.status(201).json({ success: true, document: result.rows[0], message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOWNLOAD DOCUMENT (must be before /:entityType/:entityId)
// ============================================
router.get('/download/:id', authenticate, async (req, res) => {
  const documentId = req.params.id;

  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [documentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = result.rows[0];
    const filePath = path.join(__dirname, '..', '..', doc.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', 'attachment; filename="' + (doc.doc_type || 'document') + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET DOCUMENTS BY ENTITY
// ============================================
router.get('/:entityType/:entityId', authenticate, async (req, res) => {
  const { entityType, entityId } = req.params;

  try {
    const result = await query(
      `SELECT d.*, u.name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.entity_type = $1 AND d.entity_id = $2
       ORDER BY d.created_at DESC`,
      [entityType, entityId]
    );

    res.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DELETE DOCUMENT
// ============================================
router.delete('/:id', authenticate, async (req, res) => {
  const documentId = req.params.id;

  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [documentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = result.rows[0];
    const filePath = path.join(__dirname, '..', '..', doc.file_path);

    // Delete file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await query('DELETE FROM documents WHERE id = $1', [documentId]);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
