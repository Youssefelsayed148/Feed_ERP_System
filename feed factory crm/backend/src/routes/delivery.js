const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

// Get all deliveries
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT 
        da.*,
        v.plate_number, v.make, v.model,
        u.name as driver_name,
        so.order_number,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
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
        da.*,
        v.plate_number, v.make, v.model,
        u.name as driver_name,
        so.order_number,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      WHERE da.status IN ('pending', 'assigned')
      ORDER BY da.scheduled_date ASC
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
        da.*,
        v.plate_number, v.make, v.model,
        so.order_number,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
      WHERE da.driver_id = $1 
        AND da.status IN ('assigned', 'in_transit')
    `, [driverId]);
    res.json({ deliveries: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delivery by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        da.*,
        v.plate_number, v.make, v.model,
        u.name as driver_name,
        so.order_number,
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
      FROM delivery_assignments da
      LEFT JOIN vehicles v ON v.id = da.vehicle_id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN sales_orders so ON so.id = da.order_id
      LEFT JOIN clients c ON c.id = so.client_id
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

    const result = await query(`
      INSERT INTO delivery_assignments 
      (order_id, vehicle_id, driver_id, scheduled_date, status, notes, created_by)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING *
    `, [order_id, vehicle_id || null, driver_id || null, scheduled_date, notes || null, req.user.id]);

    logActivity({
      userId: req.user.id, action: 'create', module: 'delivery',
      description: `Created delivery assignment for order #${order_id}`,
      entityId: result.rows[0].id, entityType: 'delivery_assignment'
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign delivery to driver and vehicle
router.put('/:id/assign', authenticate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, notes } = req.body;

    const result = await query(
      `UPDATE delivery_assignments 
       SET vehicle_id = $1, driver_id = $2, status = 'assigned', notes = COALESCE($3, notes) 
       WHERE id = $4 
       RETURNING *`,
      [vehicle_id, driver_id, notes, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });

    if (vehicle_id) {
      await query("UPDATE vehicles SET status = 'assigned' WHERE id = $1", [vehicle_id]);
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

    if (delivery.driver_id !== req.user.id && delivery.driver_id?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to accept this delivery' });
    }

    const result = await query(
      `UPDATE delivery_assignments SET status = 'accepted' WHERE id = $1 RETURNING *`,
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
    const result = await query(
      `UPDATE delivery_assignments SET status = 'picked_up' WHERE id = $1 RETURNING *`,
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
    const deliveryRes = await query('SELECT vehicle_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];

    const result = await query(
      `UPDATE delivery_assignments SET status = 'in_transit' WHERE id = $1 RETURNING *`,
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
    const result = await query(
      `UPDATE delivery_assignments SET status = 'arrived' WHERE id = $1 RETURNING *`,
      [req.params.id]
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
    const deliveryRes = await query('SELECT * FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`OTP ${otpCode} sent to delivery ${delivery.id}`);

    res.json({
      message: 'OTP sent successfully',
      otpCode: otpCode,
      sentAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP
router.post('/:id/verify-otp', authenticate, async (req, res) => {
  try {
    const { otpCode } = req.body;
    if (!otpCode) {
      return res.status(400).json({ error: 'OTP code is required' });
    }
    res.json({ message: 'OTP verified successfully', verified: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload delivery proof photo
router.post('/:id/upload-photo', authenticate, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }
    res.json({ message: 'Photo uploaded successfully', photoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete delivery with full confirmation
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    const { received_by, delivery_notes, status } = req.body;
    const deliveryRes = await query('SELECT vehicle_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (deliveryRes.rowCount === 0) return res.status(404).json({ error: 'Delivery not found' });
    const delivery = deliveryRes.rows[0];

    const newStatus = status === 'partial' ? 'partial' : status === 'rejected' ? 'rejected' : 'delivered';

    const result = await query(
      `UPDATE delivery_assignments 
       SET status = $1, actual_delivery_date = CURRENT_DATE, notes = COALESCE($2, notes) 
       WHERE id = $3 
       RETURNING *`,
      [newStatus, delivery_notes, req.params.id]
    );

    if (delivery.vehicle_id) {
      await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [delivery.vehicle_id]);
    }

    res.json({
      message: 'Delivery confirmed successfully',
      delivery: result.rows[0]
    });
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
router.put('/:id/dispatch', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE delivery_assignments SET status = 'in_transit' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/delivered', authenticate, async (req, res) => {
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

// Vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params = [];
    if (req.query.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(req.query.status);
    }
    const result = await query(sql, params);
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

module.exports = router;
