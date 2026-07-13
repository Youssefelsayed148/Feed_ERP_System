const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { sendWhatsAppMessage, isWhatsAppConfigured } = require('./whatsapp');

const DELIVERY_PHOTOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'deliveries');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DELIVERY_PHOTOS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Security fix 2026-06-22: most of the driver-journey routes below
// (pickup, in-transit, arrived, send-otp, verify-otp, upload-photo,
// confirm) had `authenticate` but no further check at all — any logged-in
// user, any role, could act on ANY delivery by ID, not just their own
// assigned one. /:id/accept already had the right pattern (driver must
// own the delivery); this generalizes that same check for reuse, with
// admin/owner/logistics_coordinator allowed to act on any delivery.
const canActOnDelivery = (delivery, user) => {
  if (['admin', 'owner', 'logistics_coordinator'].includes(user.role)) return true;
  if (!delivery.driver_id) return false;
  return delivery.driver_id === user.id || delivery.driver_id?.toString() === user.id?.toString();
};

// Get all deliveries
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT
        da.id as _id,
        da.*,
        v.plate_number, v.make, v.model, v.capacity_kg, v.type as vehicle_type,
        u.name as driver_name, u.phone as driver_phone,
        so.order_number, so.final_amount, so.delivery_date, so.notes as order_notes,
        COALESCE(da.scheduled_date, so.delivery_date) as scheduled_date,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.phone as client_phone, c.address as client_address,
        COALESCE(items_agg.total_bags, 0)::int as total_bags,
        COALESCE(items_agg.total_weight_kg, 0)::numeric as total_weight_kg,
        COALESCE(items_agg.items_summary, '[]'::json) as items_summary
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(soi.quantity), 0) as total_bags,
          COALESCE(SUM(soi.quantity * soi.package_size), 0) as total_weight_kg,
          COALESCE(json_agg(json_build_object(
            '_id', soi.id,
            'feedType', json_build_object('name', COALESCE(ft.name_arabic, ft.name_english)),
            'quantity', soi.quantity,
            'packageSize', soi.package_size
          ) ORDER BY soi.id) FILTER (WHERE soi.id IS NOT NULL), '[]'::json) as items_summary
        FROM sales_order_items soi
        LEFT JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE soi.order_id = da.order_id
      ) items_agg ON true
      WHERE 1=1
    `;
    const params = [];
    if (req.query.status) {
      sql += ` AND da.status = $${params.length + 1}`;
      params.push(req.query.status);
    }
    if (req.query.driver) {
      sql += ` AND da.driver_id = $${params.length + 1}`;
      params.push(req.query.driver);
    }
    if (req.query.date) {
      sql += ` AND da.scheduled_date::date = $${params.length + 1}`;
      params.push(req.query.date);
    }
    sql += ` ORDER BY da.created_at DESC`;
    const result = await query(sql, params);
    res.json({ deliveries: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delivery statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered
      FROM delivery_assignments
    `);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      inTransit: parseInt(row.in_transit),
      delivered: parseInt(row.delivered)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending deliveries
router.get('/pending', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        da.id as _id,
        da.*,
        v.plate_number, v.make, v.model, v.capacity_kg, v.type as vehicle_type,
        u.name as driver_name, u.phone as driver_phone,
        so.order_number, so.final_amount, so.delivery_date, so.notes as order_notes,
        COALESCE(da.scheduled_date, so.delivery_date) as scheduled_date,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.phone as client_phone, c.address as client_address,
        COALESCE(items_agg.total_bags, 0)::int as total_bags,
        COALESCE(items_agg.total_weight_kg, 0)::numeric as total_weight_kg,
        COALESCE(items_agg.items_summary, '[]'::json) as items_summary
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(soi.quantity), 0) as total_bags,
          COALESCE(SUM(soi.quantity * soi.package_size), 0) as total_weight_kg,
          COALESCE(json_agg(json_build_object(
            '_id', soi.id,
            'feedType', json_build_object('name', COALESCE(ft.name_arabic, ft.name_english)),
            'quantity', soi.quantity,
            'packageSize', soi.package_size
          ) ORDER BY soi.id) FILTER (WHERE soi.id IS NOT NULL), '[]'::json) as items_summary
        FROM sales_order_items soi
        LEFT JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE soi.order_id = da.order_id
      ) items_agg ON true
      WHERE da.status IN ('pending', 'assigned')
      ORDER BY COALESCE(da.scheduled_date, so.delivery_date) ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver's active deliveries
router.get('/driver/active', authenticate, async (req, res) => {
  try {
    const driverId = req.user.id;
    const result = await query(`
      SELECT
        da.id as _id,
        da.*,
        v.plate_number, v.make, v.model, v.capacity_kg, v.type as vehicle_type,
        u.name as driver_name, u.phone as driver_phone,
        so.order_number, so.final_amount, so.delivery_date, so.notes as order_notes,
        COALESCE(da.scheduled_date, so.delivery_date) as scheduled_date,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.phone as client_phone, c.address as client_address,
        COALESCE(items_agg.total_bags, 0)::int as total_bags,
        COALESCE(items_agg.total_weight_kg, 0)::numeric as total_weight_kg,
        COALESCE(items_agg.items_summary, '[]'::json) as items_summary
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(soi.quantity), 0) as total_bags,
          COALESCE(SUM(soi.quantity * soi.package_size), 0) as total_weight_kg,
          COALESCE(json_agg(json_build_object(
            '_id', soi.id,
            'feedType', json_build_object('name', COALESCE(ft.name_arabic, ft.name_english)),
            'quantity', soi.quantity,
            'packageSize', soi.package_size
          ) ORDER BY soi.id) FILTER (WHERE soi.id IS NOT NULL), '[]'::json) as items_summary
        FROM sales_order_items soi
        LEFT JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE soi.order_id = da.order_id
      ) items_agg ON true
      WHERE da.driver_id = $1
        AND da.status IN ('assigned', 'in_transit')
    `, [driverId]);
    res.json({ deliveries: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/delivery/drivers/available - Get users with role=driver
router.get('/drivers/available', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT id as _id, name, email, role
      FROM users
      WHERE role = 'driver'
      ORDER BY name
    `);
    res.json({ drivers: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT id as _id, code, plate_number, type, capacity_kg, status, make, model
      FROM vehicles
      WHERE is_active = true AND status = 'available'
      ORDER BY plate_number
    `);
    res.json({ vehicles: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehicles/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'on_delivery') as on_delivery,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
      FROM vehicles
    `);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      available: parseInt(row.available),
      onDelivery: parseInt(row.on_delivery),
      maintenance: parseInt(row.maintenance)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/delivery/vehicles/:id/availability - Check if a vehicle is free
// to assign right now. Frontend was already calling this on every assign
// attempt as a double-booking guard, but the route didn't exist — every
// call 404'd and silently fell back to a less reliable client-side check.
router.get('/vehicles/:id/availability', authenticate, async (req, res) => {
  try {
    const vehicleRes = await query('SELECT id, status, plate_number FROM vehicles WHERE id = $1', [req.params.id]);
    if (vehicleRes.rowCount === 0) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = vehicleRes.rows[0];

    const activeDelivery = await query(
      `SELECT id FROM delivery_assignments WHERE vehicle_id = $1 AND status IN ('assigned','accepted','picked_up','in_transit','arrived')`,
      [req.params.id]
    );

    const available = vehicle.status === 'available' && activeDelivery.rows.length === 0;
    res.json({ available, status: vehicle.status, plateNumber: vehicle.plate_number, activeDeliveryId: activeDelivery.rows[0]?.id || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delivery by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        da.id as _id,
        da.*,
        v.plate_number, v.make, v.model, v.capacity_kg, v.type as vehicle_type,
        u.name as driver_name, u.phone as driver_phone,
        so.order_number, so.final_amount, so.delivery_date, so.notes as order_notes,
        COALESCE(da.scheduled_date, so.delivery_date) as scheduled_date,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.phone as client_phone, c.address as client_address,
        COALESCE(items_agg.total_bags, 0)::int as total_bags,
        COALESCE(items_agg.total_weight_kg, 0)::numeric as total_weight_kg,
        COALESCE(items_agg.items_summary, '[]'::json) as items_summary
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(soi.quantity), 0) as total_bags,
          COALESCE(SUM(soi.quantity * soi.package_size), 0) as total_weight_kg,
          COALESCE(json_agg(json_build_object(
            '_id', soi.id,
            'feedType', json_build_object('name', COALESCE(ft.name_arabic, ft.name_english)),
            'quantity', soi.quantity,
            'packageSize', soi.package_size
          ) ORDER BY soi.id) FILTER (WHERE soi.id IS NOT NULL), '[]'::json) as items_summary
        FROM sales_order_items soi
        LEFT JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE soi.order_id = da.order_id
      ) items_agg ON true
      WHERE da.id = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new delivery
router.post('/', authenticate, async (req, res) => {
  try {
    const { order_id, vehicle_id, driver_id, scheduled_date, notes } = req.body;

    let finalScheduledDate = scheduled_date;
    if (order_id && !finalScheduledDate) {
      const orderRes = await query('SELECT delivery_date FROM sales_orders WHERE id = $1', [order_id]);
      if (orderRes.rowCount > 0 && orderRes.rows[0].delivery_date) {
        finalScheduledDate = orderRes.rows[0].delivery_date;
      }
    }

    const result = await query(`
      INSERT INTO delivery_assignments
      (order_id, vehicle_id, driver_id, scheduled_date, status, notes, created_by)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING *
    `, [order_id, vehicle_id || null, driver_id || null, finalScheduledDate, notes || null, req.user.id]);

    logActivity({
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'create', module: 'delivery',
      description: `تم إنشاء مهمة توصيل للطلب #${order_id}`,
      entityId: result.rows[0].id, entityType: 'delivery_assignment'
    });

    // Return the created delivery with full metadata
    const fullRes = await query(`
      SELECT
        da.id as _id,
        da.*,
        v.plate_number, v.make, v.model, v.capacity_kg, v.type as vehicle_type,
        u.name as driver_name, u.phone as driver_phone,
        so.order_number, so.final_amount, so.delivery_date, so.notes as order_notes,
        COALESCE(da.scheduled_date, so.delivery_date) as scheduled_date,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.phone as client_phone, c.address as client_address,
        COALESCE(items_agg.total_bags, 0)::int as total_bags,
        COALESCE(items_agg.total_weight_kg, 0)::numeric as total_weight_kg,
        COALESCE(items_agg.items_summary, '[]'::json) as items_summary
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(soi.quantity), 0) as total_bags,
          COALESCE(SUM(soi.quantity * soi.package_size), 0) as total_weight_kg,
          COALESCE(json_agg(json_build_object(
            '_id', soi.id,
            'feedType', json_build_object('name', COALESCE(ft.name_arabic, ft.name_english)),
            'quantity', soi.quantity,
            'packageSize', soi.package_size
          ) ORDER BY soi.id) FILTER (WHERE soi.id IS NOT NULL), '[]'::json) as items_summary
        FROM sales_order_items soi
        LEFT JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE soi.order_id = da.order_id
      ) items_agg ON true
      WHERE da.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(fullRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign delivery to driver and vehicle.
// Per access doc: this IS the approval step for deliveries — the Foreman
// (logistics_coordinator) reviews pending deliveries and assigns them.
// Previously any authenticated user could call this with no role check.
router.put('/:id/assign', authenticate, authorize('logistics_coordinator', 'admin', 'owner'), async (req, res) => {
  try {
    const { vehicle_id, driver_id, vehicle, driver, notes } = req.body;
    const vId = vehicle_id || vehicle;
    const dId = driver_id || driver;

    const result = await query(
      `UPDATE delivery_assignments
       SET vehicle_id = $1, driver_id = $2, status = 'assigned', notes = COALESCE($3, notes),
           assigned_at = NOW(), assigned_by = $4
       WHERE id = $5
       RETURNING *`,
      [vId, dId, notes, req.user.id, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });

    if (vId) {
      await query("UPDATE vehicles SET status = 'assigned' WHERE id = $1", [vId]);
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver accepts assignment
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT * FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];

    if (!canActOnDelivery(delivery, req.user)) {
      return res.status(403).json({ error: 'Not authorized to accept this delivery' });
    }

    const result = await query(
      `UPDATE delivery_assignments SET status = 'accepted', accepted_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver marks as picked up
router.post('/:id/pickup', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }

    const result = await query(
      `UPDATE delivery_assignments SET status = 'picked_up', pickup_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver marks as in transit
router.post('/:id/in-transit', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT vehicle_id, driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];
    if (!canActOnDelivery(delivery, req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }

    const result = await query(
      `UPDATE delivery_assignments SET status = 'in_transit', in_transit_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (delivery.vehicle_id) {
      await query("UPDATE vehicles SET status = 'on_delivery' WHERE id = $1", [delivery.vehicle_id]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver marks as arrived
router.post('/:id/arrived', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }

    const { latitude, longitude, accuracy } = req.body || {};
    const result = await query(
      `UPDATE delivery_assignments
       SET status = 'arrived', arrived_at = NOW(),
           arrival_lat = COALESCE($1, arrival_lat),
           arrival_lng = COALESCE($2, arrival_lng),
           arrival_accuracy = COALESCE($3, arrival_accuracy)
       WHERE id = $4 RETURNING *`,
      [latitude || null, longitude || null, accuracy || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send OTP to client
router.post('/:id/send-otp', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query(`
      SELECT da.*, c.phone AS client_phone, c.name AS client_name
      FROM delivery_assignments da
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      WHERE da.id = $1
    `, [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];
    if (!canActOnDelivery(delivery, req.user)) {
      return res.status(403).json({ error: 'Not authorized to act on this delivery' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await query(
      `UPDATE delivery_assignments SET otp_code = $1, otp_sent_at = NOW(), otp_verified = false, otp_attempts = 0 WHERE id = $2`,
      [otpCode, req.params.id]
    );

    let sentViaWhatsApp = false;
    let sendError = null;

    if (isWhatsAppConfigured() && delivery.client_phone) {
      const result = await sendWhatsAppMessage(
        delivery.client_phone,
        `Al-Kheir Feed Factory: Your delivery verification code is ${otpCode}. Share this with the driver only when your order arrives.`
      );
      sentViaWhatsApp = result.ok;
      if (!result.ok) sendError = result.error;
    }

    res.json({
      message: sentViaWhatsApp ? 'OTP sent to client via WhatsApp' : 'OTP generated (WhatsApp not configured)',
      sentViaWhatsApp,
      sendError: sentViaWhatsApp ? null : sendError,
      sentAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP — now actually checks against the stored code + a 10 minute expiry,
// instead of accepting any value submitted.
router.post('/:id/verify-otp', authenticate, async (req, res) => {
  try {
    const { otpCode } = req.body;
    if (!otpCode) {
      return res.status(400).json({ error: 'OTP code is required' });
    }

    const deliveryRes = await query(
      `SELECT otp_code, otp_sent_at, otp_attempts, driver_id FROM delivery_assignments WHERE id = $1`,
      [req.params.id]
    );
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to act on this delivery' });
    }
    const { otp_code, otp_sent_at, otp_attempts } = deliveryRes.rows[0];

    if (!otp_code) {
      return res.status(400).json({ error: 'No OTP was sent for this delivery' });
    }
    if (otp_attempts >= 5) {
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    const expired = otp_sent_at && (Date.now() - new Date(otp_sent_at).getTime()) > 10 * 60 * 1000;
    if (expired) {
      return res.status(400).json({ error: 'OTP has expired, please request a new one' });
    }
    if (String(otpCode).trim() !== String(otp_code).trim()) {
      await query(
        `UPDATE delivery_assignments SET otp_attempts = otp_attempts + 1 WHERE id = $1`,
        [req.params.id]
      );
      const remaining = 5 - (otp_attempts + 1);
      return res.status(400).json({ error: `Invalid OTP code. ${remaining} attempt(s) remaining.` });
    }

    await query(`UPDATE delivery_assignments SET otp_verified = true, otp_attempts = 0 WHERE id = $1`, [req.params.id]);
    res.json({ message: 'OTP verified successfully', verified: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload delivery proof photo — accepts multipart file uploads.
// Returns the persisted relative URL which can be stored and used for display.
router.post('/:id/upload-photo', authenticate, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    const relativePath = `/uploads/deliveries/${req.params.id}/${req.file.filename}`;
    await query(
      `UPDATE delivery_assignments SET photo_urls = array_append(COALESCE(photo_urls, '{}'), $1) WHERE id = $2`,
      [relativePath, req.params.id]
    );
    res.json({ message: 'Photo uploaded successfully', photoUrl: relativePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete delivery with full confirmation
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    // Frontend sends camelCase (receivedBy, deliveryNotes, deliveryProof) —
    // previously this destructured snake_case names that never matched,
    // so received_by/delivery_notes were always undefined and the entire
    // deliveryProof bundle (GPS location, signature, photos) the frontend
    // already captures was received and silently discarded.
    const { receivedBy, deliveryNotes, status, deliveryProof, deliveredItems } = req.body;
    const receivedByName = receivedBy?.name || null;
    const otpVerifiedFlag = receivedBy?.otpVerified || false;
    const gps = deliveryProof?.gpsLocation || null;
    const photos = Array.isArray(deliveryProof?.photos) ? deliveryProof.photos : null;
    const signature = deliveryProof?.signature || null;

    const deliveryRes = await query('SELECT vehicle_id, order_id, driver_id, otp_verified FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];
    if (!canActOnDelivery(delivery, req.user)) {
      return res.status(403).json({ error: 'Not authorized to confirm this delivery' });
    }

    // STAGE 2: OTP enforcement disabled — re-enable when OTP is reintroduced
    // if (!delivery.otp_verified) {
    //   return res.status(400).json({ error: 'OTP must be verified before confirming delivery' });
    // }

    const newStatus = status === 'partial' ? 'partial' : status === 'rejected' ? 'rejected' : 'delivered';

    const result = await query(
      `UPDATE delivery_assignments 
       SET status = $1, actual_delivery_date = CURRENT_DATE, notes = COALESCE($2, notes),
           received_by_name = COALESCE($3, received_by_name),
           otp_verified = COALESCE($4, otp_verified),
           arrival_lat = COALESCE($5, arrival_lat),
           arrival_lng = COALESCE($6, arrival_lng),
           arrival_accuracy = COALESCE($7, arrival_accuracy),
           photo_urls = COALESCE($8, photo_urls),
           signature_data = COALESCE($9, signature_data)
       WHERE id = $10 
       RETURNING *`,
      [
        newStatus, deliveryNotes, receivedByName, otpVerifiedFlag,
        gps?.latitude || null, gps?.longitude || null, gps?.accuracy || null,
        photos, signature, req.params.id
      ]
    );

    if (delivery.vehicle_id) {
      await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [delivery.vehicle_id]);
    }

    if (Array.isArray(deliveredItems) && deliveredItems.length > 0) {
      for (const item of deliveredItems) {
        await query(
          `INSERT INTO delivery_item_confirmations (delivery_assignment_id, item_name, ordered_qty, delivered_qty, rejected_qty, rejection_reason, condition)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.params.id,
            item.itemName || item.feedType?.name || null,
            parseFloat(item.orderedQty) || 0,
            parseFloat(item.deliveredQty) || 0,
            parseFloat(item.rejectedQty) || 0,
            item.rejectionReason || null,
            item.condition || null
          ]
        );
      }
    }

    // This is the proof-backed delivery confirmation (GPS, OTP, photo,
    // signature) — it's the one path that should mark the linked sales
    // order as delivered, not the legacy /:id/delivered shortcut.
    if (newStatus === 'delivered' && delivery.order_id) {
      await query(
        `UPDATE sales_orders SET status = 'delivered', delivery_date = COALESCE(delivery_date, CURRENT_DATE), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('delivered','cancelled')`,
        [delivery.order_id]
      );
    }

    res.json({
      message: 'Delivery confirmed successfully',
      delivery: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark delivery as partial (some items rejected/damaged)
router.post('/:id/partial', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id, vehicle_id, order_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }
    const result = await query(
      `UPDATE delivery_assignments SET status = 'partial', actual_delivery_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (deliveryRes.rows[0].vehicle_id) {
      await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [deliveryRes.rows[0].vehicle_id]);
    }
    res.json({ success: true, delivery: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel delivery
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id, vehicle_id, order_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to cancel this delivery' });
    }
    const result = await query(
      `UPDATE delivery_assignments SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (deliveryRes.rows[0].vehicle_id) {
      await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [deliveryRes.rows[0].vehicle_id]);
    }
    res.json({ success: true, delivery: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver journey history
router.get('/:id/journey', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT id, status FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json({
      deliveryId: req.params.id,
      journey: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy endpoints for backward compatibility
// Note: appears superseded by /:id/in-transit (same effect, plus proper
// vehicle-status handling) — no frontend page calls this route. Left in
// place rather than removed in case something external depends on it,
// but closed the same way as the rest of this file.
router.put('/:id/dispatch', authenticate, async (req, res) => {
  try {
    const deliveryRes = await query('SELECT driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    if (!canActOnDelivery(deliveryRes.rows[0], req.user)) {
      return res.status(403).json({ error: 'Not authorized to update this delivery' });
    }

    const result = await query(
      `UPDATE delivery_assignments SET status = 'in_transit' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy no-proof delivery completion (status flip only, no GPS/OTP/photo).
// Kept for edge cases (e.g. phone-in confirmation) but restricted — this
// is the one remaining bypass around the real proof-of-delivery flow in
// /:id/confirm, so it should not be open to any authenticated user.
router.put('/:id/delivered', authenticate, authorize('logistics_coordinator', 'admin', 'owner'), async (req, res) => {
  try {
    const { received_by, notes } = req.body;

    const result = await transaction(async (client) => {
      const delRes = await client.query('SELECT * FROM delivery_assignments WHERE id = $1', [req.params.id]);
      const delivery = delRes.rows[0];
      if (!delivery) throw new Error('Delivery not found');

      await client.query(
        `UPDATE delivery_assignments SET status = 'delivered', actual_delivery_date = CURRENT_DATE, notes = COALESCE($1, notes) WHERE id = $2 RETURNING *`,
        [notes, req.params.id]
      );

      if (delivery.vehicle_id) {
        await client.query("UPDATE vehicles SET status = 'available' WHERE id = $1", [delivery.vehicle_id]);
      }

      // Auto-update sales order to delivered
      if (delivery.order_id) {
        const soRes = await client.query(
          `UPDATE sales_orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('delivered','cancelled') RETURNING order_number`,
          [delivery.order_id]
        );
        if (soRes.rows.length > 0) {
          console.log(`[SALES] Order ${soRes.rows[0].order_number} auto-updated to delivered via delivery #${req.params.id}`);
        }
      }

      return { delivery_id: delivery.id, order_id: delivery.order_id };
    });

    res.json({ success: true, message: 'Delivery completed. Sales order updated.', data: result });
  } catch (error) {
    console.error('Error completing delivery:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;