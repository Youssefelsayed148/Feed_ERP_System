require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');
const { healthCheck } = require('./src/config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// PostgreSQL database health check on startup
(async () => {
  try {
    const health = await healthCheck();
    if (health.status === 'healthy') {
      console.log('✅ PostgreSQL database connection verified');
    } else {
      console.error('❌ PostgreSQL database connection failed:', health.message);
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error);
  }
})();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: 'Feed Factory OS - Al Kheir',
    version: '2.0.0',
    status: 'running',
    database: 'PostgreSQL (Unified)',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// CORE API ROUTES
// ============================================

// Authentication & Users
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/organization', require('./src/routes/organization'));

// PostgreSQL-based Core Routes
app.use('/api/clients', require('./src/routes/clients-pg'));
app.use('/api/inventory', require('./src/routes/inventory-pg'));
app.use('/api/feed-recipes', require('./src/routes/feed-recipes-pg'));
app.use('/api/production', require('./src/routes/production-pg'));
app.use('/api/sales', require('./src/routes/sales'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/location', require('./src/routes/location'));
app.use('/api/reminders', require('./src/routes/reminders'));
app.use('/api/purchase-requisitions', require('./src/routes/purchase-requisitions'));
app.use('/api/maintenance-reminders', require('./src/routes/maintenance-reminders'));

// Business Routes - All PostgreSQL
app.use('/api/leads', require('./src/routes/leads'));
app.use('/api/reservations', require('./src/routes/reservations'));
app.use('/api/contracts', require('./src/routes/contracts'));
app.use('/api/installments', require('./src/routes/installments'));
app.use('/api/partners', require('./src/routes/partners'));
app.use('/api/whatsapp', require('./src/routes/whatsapp'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/activity', require('./src/routes/activity'));
app.use('/api/hr', require('./src/routes/hr'));
app.use('/api/documents', require('./src/routes/documents'));
app.use('/api/requisitions', require('./src/routes/requisitions'));
app.use('/api/employees', require('./src/routes/employees'));
app.use('/api/employee-ratings', require('./src/routes/employee-ratings'));
app.use('/api/finance', require('./src/routes/finance'));
app.use('/api/finance', require('./src/routes/finance-journal'));

// Feed Factory Routes - Finance
app.use('/api/payables', require('./src/routes/payables'));
app.use('/api/expenses', require('./src/routes/expenses'));
app.use('/api/payroll', require('./src/routes/payroll'));

// Feed Factory Routes - Procurement
app.use('/api/suppliers', require('./src/routes/suppliers'));
app.use('/api/purchase-orders', require('./src/routes/purchase-orders'));
app.use('/api/grn', require('./src/routes/grn'));

// Feed Factory Routes
app.use('/api/feed-types', require('./src/routes/feed-types'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/legal', require('./src/routes/legal'));
app.use('/api/delivery', require('./src/routes/delivery'));
app.use('/api/export', require('./src/routes/export'));
app.use('/api/assets', require('./src/routes/assets'));

// Approval System Routes
app.use('/api/approvals', require('./src/routes/approvals'));

// Error handling
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Socket.io connection
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Feed Factory OS Server running on port ${PORT}`);
  logger.info(`Database mode: PostgreSQL (Unified)`);
  logger.info(`Connected to: ${process.env.DB_NAME || 'al_kheir_feed_factory'}`);
});

module.exports = { app, io };
