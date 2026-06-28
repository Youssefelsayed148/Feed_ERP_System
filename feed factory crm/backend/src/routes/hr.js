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

const upload = multer({ storage });

router.get('/employees', authenticate, async (req, res) => {
  try {
    const { department, status } = req.query;
    let sql = `
      SELECT
        u.id, u.name, u.email, u.role, u.phone, u.department,
        u.module_permissions, u.is_active,
        e.id as employee_id, e.salary, e.title, e.position,
        e.status, e.hire_date as "joinDate", e.notes, e.documents,
        NULL::text AS "bankName",
        NULL::text AS "bankAccount",
        NULL::text AS iban,
        NULL::text AS avatar
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (department) {
      params.push(department);
      sql += ` AND u.department = $${params.length}`;
    }
    if (status === 'inactive') {
      sql += ` AND u.is_active = false`;
    } else {
      sql += ` AND u.is_active = true`;
    }
    sql += ` ORDER BY u.name`;

    const result = await query(sql, params);
    res.json({ employees: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/employees/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.*,
        e.id as employee_id, e.salary, e.title, e.position,
        e.status as emp_status, e.hire_date as "joinDate", e.notes, e.documents
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.id = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


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


router.put('/employees/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // id is users.id — lookup the employees row by user_id
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [id]);
    if (empResult.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    const employeeId = empResult.rows[0].id;

    // Build users table updates
    const usersAllowed = ['name', 'email', 'phone', 'department'];
    const usersUpdates = {};
    Object.keys(req.body).forEach(k => { if (usersAllowed.includes(k)) usersUpdates[k] = req.body[k]; });

    // Build employees table updates
    const empAllowed = ['salary', 'department', 'status', 'notes'];
    const empUpdates = {};
    Object.keys(req.body).forEach(k => { if (empAllowed.includes(k)) empUpdates[k] = req.body[k]; });
    if (req.body.designation !== undefined) {
      empUpdates.title = req.body.designation;
      empUpdates.position = req.body.designation;
    }
    if (req.body.position !== undefined) empUpdates.position = req.body.position;
    if (req.body.title !== undefined) empUpdates.title = req.body.title;
    if (req.body.joinDate !== undefined) empUpdates.hire_date = req.body.joinDate;

    // Update users table (id is users.id)
    const userCols = Object.keys(usersUpdates);
    if (userCols.length > 0) {
      const userSet = userCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const userVals = userCols.map(k => usersUpdates[k]);
      await query(`UPDATE users SET ${userSet} WHERE id = $${userCols.length + 1}`, [...userVals, id]);
    }

    // Update employees table (use employeeId from lookup)
    const empCols = Object.keys(empUpdates);
    if (empCols.length > 0) {
      const empSet = empCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const empVals = empCols.map(k => empUpdates[k]);
      await query(`UPDATE employees SET ${empSet}, updated_at = NOW() WHERE id = $${empCols.length + 1}`, [...empVals, employeeId]);
    }

    // Return updated data
    const updatedUser = await query('SELECT * FROM users WHERE id = $1', [id]);
    const updatedEmp = await query('SELECT * FROM employees WHERE id = $1', [employeeId]);
    res.json({ success: true, user: updatedUser.rows[0] || null, employee: updatedEmp.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


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


// Simple /attendance removed — full-featured handler below handles all attendance queries


router.get('/leaves', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT lr.*, u.name as user_name
      FROM leave_requests lr
      LEFT JOIN users u ON lr.user_id = u.id
      ORDER BY lr.created_at DESC
    `);
    const leaves = result.rows.map(r => {
      const nameParts = (r.user_name || '').split(' ');
      return {
        ...r,
        _id: r.id,
        leaveType: r.type,
        startDate: r.start_date,
        endDate: r.end_date,
        employee: {
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }
      };
    });
    res.json({ leaves });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /leaves - Create leave request
router.post('/leaves', authenticate, async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const result = await query(
      `INSERT INTO leave_requests (user_id, type, start_date, end_date, days_count, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW()) RETURNING *`,
      [employeeId || req.user.id, leaveType || 'annual', startDate, endDate, daysCount, reason || null]
    );
    res.status(201).json({ success: true, leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /leaves/:id/approve - Approve leave request
router.put('/leaves/:id/approve', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Leave request not found' });
    res.json({ success: true, leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /leaves/:id/reject - Reject leave request
router.put('/leaves/:id/reject', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Leave request not found' });
    res.json({ success: true, leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/payroll', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM payroll_records');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/performance', authenticate, async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================================================
// ATTENDANCE & CHECK-IN/OUT
// ============================================================

// POST /attendance - Record employee check-in
router.post('/attendance', authenticate, async (req, res) => {
  try {
    const { notes } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const existing = await query(
      `SELECT id, check_in, check_out FROM attendance_records WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );
    if (existing.rows.length > 0) {
      const rec = existing.rows[0];
      if (rec.check_in && !rec.check_out) {
        return res.json({ success: true, attendance: rec, message: 'Already checked in today' });
      }
      const result = await query(`
        UPDATE attendance_records SET check_in = NOW(), check_out = NULL,
          status = 'present', notes = $1
        WHERE id = $2 RETURNING *
      `, [notes || null, rec.id]);
      return res.json({ success: true, attendance: result.rows[0], message: 'Check-in recorded (new shift)' });
    }
    const result = await query(`
      INSERT INTO attendance_records (user_id, date, check_in, status, notes)
      VALUES ($1, $2, NOW(), 'present', $3) RETURNING *
    `, [userId, today, notes || null]);
    res.status(201).json({ success: true, attendance: result.rows[0], message: 'Check-in recorded' });
  } catch (error) {
    console.error('Error recording check-in:', error);
    return res.status(500).json({ error: error.message });
  }
});


// POST /attendance/check-out - Record employee check-out
router.post('/attendance/check-out', authenticate, async (req, res) => {
  try {
    const { notes } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const existing = await query(
      `SELECT id, check_in FROM attendance_records WHERE user_id = $1 AND date = $2 AND check_out IS NULL`,
      [userId, today]
    );
    if (existing.rows.length === 0) {
      return res.status(400).json({ error: 'No active check-in found for today. Check in first.' });
    }
    const rec = existing.rows[0];
    const result = await query(`
      UPDATE attendance_records SET check_out = NOW(), notes = $1
      WHERE id = $2 RETURNING *
    `, [notes || rec.notes, rec.id]);
    const att = result.rows[0];
    let hoursWorked = '0h 0m';
    if (att.check_in && att.check_out) {
      const ms = new Date(att.check_out) - new Date(att.check_in);
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      hoursWorked = `${hrs}h ${mins}m`;
    }
    res.json({ success: true, attendance: result.rows[0], hoursWorked, message: 'Check-out recorded' });
  } catch (error) {
    console.error('Error recording check-out:', error);
    return res.status(500).json({ error: error.message });
  }
});


// GET /attendance/today - Get today's attendance (with locations)
router.get('/attendance/today', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(`
      SELECT ar.*, u.name as user_name, u.department, u.role,
        CASE WHEN ar.check_out IS NOT NULL THEN EXTRACT(EPOCH FROM (ar.check_out - ar.check_in))/3600 ELSE 0 END AS hours_worked
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


// GET /attendance - List all attendance records
router.get('/attendance', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, userId, status, page = 1, limit = 50 } = req.query;
    let sql = `
      SELECT ar.*, u.name as user_name, u.department, u.role,
        CASE WHEN ar.check_out IS NOT NULL THEN EXTRACT(EPOCH FROM (ar.check_out - ar.check_in))/3600 ELSE 0 END AS hours_worked
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

// Startup migration: translate English department names to Arabic
(async function migrateDepartments() {
  try {
    const { query } = require('../config/database');
    const deptMappings = [
      { ar: 'الإدارة العامة', en: ['General Management', 'Management'] },
      { ar: 'المالية', en: ['Finance', 'Finance/HR'] },
      { ar: 'المبيعات', en: ['Sales'] },
      { ar: 'الإنتاج', en: ['Production'] },
      { ar: 'اللوجستيات', en: ['Logistics'] },
      { ar: 'الصيانة', en: ['Maintenance'] },
      { ar: 'القسم القانوني', en: ['Legal'] },
      { ar: 'المشتريات', en: ['Purchasing', 'Procurement'] },
      { ar: 'تقنية المعلومات', en: ['Information Technology', 'IT'] },
      { ar: 'الموارد البشرية', en: ['HR', 'Human Resources'] }
    ];
    for (const mapping of deptMappings) {
      for (const enVal of mapping.en) {
        await query(`UPDATE employees SET department = $1 WHERE department = $2 AND department <> $1`, [mapping.ar, enVal]);
        await query(`UPDATE users SET department = $1 WHERE department = $2 AND department <> $1`, [mapping.ar, enVal]);
      }
    }
    console.log('[HR] Department name migration completed');
  } catch (err) {
    console.error('[HR] Department migration error:', err.message);
  }
})();

module.exports = router;