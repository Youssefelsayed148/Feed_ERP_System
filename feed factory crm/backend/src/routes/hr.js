const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const EMPLOYEE_DOCS_DIR = path.join(__dirname, '..', '..', 'uploads', 'employees');

function parseDocuments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch (e) { return []; }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const empDir = path.join(EMPLOYEE_DOCS_DIR, String(req.params.id));
    fs.mkdirSync(empDir, { recursive: true });
    cb(null, empDir);
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, name);
  }
});

module.exports = router;
const upload = multer({ storage });

router.get('/employees', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.name as user_name, u.role as user_role
      FROM employees e
      LEFT JOIN users u ON e.id = u.id OR e.email = u.email
      WHERE e.status = 'active'
      ORDER BY e.name
    `);
    res.json({ employees: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/employees/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.post('/employees', authenticate, async (req, res) => {
  try {
    const columns = Object.keys(req.body).filter(k => k !== 'id');
    const values = columns.map(k => req.body[k]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `INSERT INTO users (${columns.join(', ')}, is_active) VALUES (${placeholders}, true) RETURNING *`,
      [...values]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.put('/employees/:id', authenticate, async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'department', 'designation', 'salary', 'joinDate', 'bankName', 'bankAccount', 'iban', 'emergencyContact'];
    const updates = {};
    Object.keys(req.body).forEach(k => { if (allowed.includes(k)) updates[k] = req.body[k]; });

    const columns = Object.keys(updates);
    if (columns.length === 0) {
      const existing = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(existing.rows[0]);
    }

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const values = columns.map(k => updates[k]);
    const result = await query(
      `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// Upload document file for an employee (multipart)
router.post('/employees/:id/documents/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { name, type, expiryDate, notes } = req.body;
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });

    const doc = {
      _id: 'doc_' + Date.now(),
      name: name || req.file.originalname,
      type: type || 'other',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileUrl: `/uploads/employees/${req.params.id}/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      expiryDate,
      notes,
      uploadedAt: new Date().toISOString(),
      status: 'pending',
      uploadedBy: req.user.id
    };
    const docs = parseDocuments(empRes.rows[0].documents);
    docs.push(doc);

    await query('UPDATE users SET documents = $1 WHERE id = $2', [JSON.stringify(docs), req.params.id]);
    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    console.error('Error uploading employee document:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// Create document metadata (JSON-based, for manual entries)
router.post('/employees/:id/documents', authenticate, async (req, res) => {
  try {
    const { name, type, fileName, fileUrl, expiryDate, notes } = req.body;
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });

    const doc = { _id: 'doc_' + Date.now(), name, type: type || 'other', fileName, fileUrl, expiryDate, notes, uploadedAt: new Date().toISOString(), status: 'pending', uploadedBy: req.user.id };
    const docs = parseDocuments(empRes.rows[0].documents);
    docs.push(doc);

    await query('UPDATE users SET documents = $1 WHERE id = $2', [JSON.stringify(docs), req.params.id]);
    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/employees/:id/documents', authenticate, async (req, res) => {
  try {
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    const docs = parseDocuments(empRes.rows[0].documents).map(d => ({
      ...d,
      canDownload: !!(d.fileUrl && d.fileUrl.startsWith('/uploads/employees/'))
    }));
    res.json({ documents: docs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// Download employee document file
router.get('/employees/:id/documents/:docId/download', authenticate, async (req, res) => {
  try {
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    const docs = parseDocuments(empRes.rows[0].documents);
    const doc = docs.find(d => d._id === req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.fileUrl) return res.status(404).json({ error: 'No file for this document' });

    const filePath = path.join(path.dirname(require.main.filename), '..', doc.fileUrl);
    if (fs.existsSync(filePath)) {
      res.download(filePath, doc.originalName || doc.fileName);
    } else {
      res.status(404).json({ error: 'File not found on disk' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.delete('/employees/:id/documents/:docId', authenticate, async (req, res) => {
  try {
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    const docs = parseDocuments(empRes.rows[0].documents).filter(d => d._id !== req.params.docId);
    await query('UPDATE users SET documents = $1 WHERE id = $2', [JSON.stringify(docs), req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.put('/employees/:id/documents/:docId/verify', authenticate, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const empRes = await query('SELECT documents FROM users WHERE id = $1', [req.params.id]);
    if (empRes.rowCount === 0) return res.status(404).json({ error: 'Not found' });

    const docs = parseDocuments(empRes.rows[0].documents).map(d => {
      if (d._id === req.params.docId) { d.status = status || 'verified'; if (notes) d.notes = notes; }
      return d;
    });

    await query('UPDATE users SET documents = $1 WHERE id = $2', [JSON.stringify(docs), req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/attendance', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM attendance_records');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/leaves', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM leave_requests');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/payroll', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM payroll_records');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get('/performance', authenticate, async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// ============================================================
// ATTENDANCE & CHECK-IN/OUT
// ============================================================

// POST /attendance/check-in - Record employee check-in with location
router.post('/attendance/check-in', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, locationName, notes } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const existing = await query(
      `SELECT id, check_in, check_out FROM attendance_records WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );
    if (existing.rows.length > 0) {
      const rec = existing.rows[0];
      if (rec.check_in && !rec.check_out) {
        return res.status(400).json({ error: 'Already checked in today. Check out first.' });
      }
      const location = (latitude && longitude) ? `(${latitude},${longitude})` : null;
      const result = await query(`
        UPDATE attendance_records SET check_in = NOW(), check_out = NULL,
          check_in_location = $1, check_in_location_name = $2, notes = $3,
          status = 'present', work_duration = NULL, updated_at = NOW()
        WHERE id = $4 RETURNING *
      `, [location, locationName || null, notes || null, rec.id]);
      return res.json({ success: true, attendance: result.rows[0], message: 'Check-in recorded (new shift)' });
    }
    const location = (latitude && longitude) ? `(${latitude},${longitude})` : null;
    const result = await query(`
      INSERT INTO attendance_records (user_id, date, check_in, check_in_location, check_in_location_name, status, notes)
      VALUES ($1, $2, NOW(), $3, $4, 'present', $5) RETURNING *
    `, [userId, today, location, locationName || null, notes || null]);
    res.status(201).json({ success: true, attendance: result.rows[0], message: 'Check-in recorded' });
  } catch (error) {
    console.error('Error recording check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// POST /attendance/check-out - Record employee check-out with location
router.post('/attendance/check-out', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, locationName, notes } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const existing = await query(
      `SELECT id, check_in FROM attendance_records WHERE user_id = $1 AND date = $2 AND check_out IS NULL`,
      [userId, today]
    );
    if (existing.rows.length === 0) {
      return res.status(400).json({ error: 'No active check-in found for today. Check in first.' });
    }
    const location = (latitude && longitude) ? `(${latitude},${longitude})` : null;
    const rec = existing.rows[0];
    const result = await query(`
      UPDATE attendance_records SET check_out = NOW(),
        check_out_location = $1, check_out_location_name = $2,
        work_duration = NOW() - check_in,
        notes = CASE WHEN $3 IS NOT NULL THEN COALESCE(notes, '') || ' | ' || $3 ELSE notes END,
        updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [location, locationName || null, notes || null, rec.id]);
    const att = result.rows[0];
    let hoursWorked = '0h 0m';
    if (att.work_duration) {
      const parts = String(att.work_duration).split(':');
      if (parts.length >= 2) hoursWorked = `${parseInt(parts[0])}h ${parseInt(parts[1])}m`;
    }
    res.json({ success: true, attendance: result.rows[0], hoursWorked, message: 'Check-out recorded' });
  } catch (error) {
    console.error('Error recording check-out:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// GET /attendance/today - Get today's attendance (with locations)
router.get('/attendance/today', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(`
      SELECT ar.*, u.name as user_name, u.department, u.role,
        EXTRACT(EPOCH FROM ar.work_duration)/3600 as hours_worked
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.date = $1
      ORDER BY ar.check_in DESC
    `, [today]);
    res.json({ success: true, attendance: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// GET /attendance - List all attendance records
router.get('/attendance', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, userId, status, page = 1, limit = 50 } = req.query;
    let sql = `
      SELECT ar.*, u.name as user_name, u.department, u.role,
        EXTRACT(EPOCH FROM ar.work_duration)/3600 as hours_worked
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (startDate) { params.push(startDate); sql += ` AND ar.date >= $${params.length}`; }
    if (endDate) { params.push(endDate); sql += ` AND ar.date <= $${params.length}`; }
    if (userId) { params.push(userId); sql += ` AND ar.user_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND ar.status = $${params.length}`; }
    sql += ` ORDER BY ar.date DESC, ar.check_in DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);
    const result = await query(sql, params);
    const countResult = await query('SELECT COUNT(*) FROM attendance_records');
    res.json({ attendance: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
