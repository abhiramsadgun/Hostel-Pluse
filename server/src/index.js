const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
// Server entrypoint - HostelPulse Foundation API (Reloaded)

const path = require('path');
const { initDb } = require('./db');
const authRoutes = require('./modules/auth/auth.routes');
const foodRoutes = require('./modules/food/food.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const complaintRoutes = require('./modules/complaints/complaints.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const servicesRoutes = require('./modules/services/services.routes');
const outpassRoutes = require('./modules/outpass/outpass.routes');
const healthRoutes = require('./modules/health/health.routes');
const roomsRoutes = require('./modules/rooms/rooms.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for photos (IDs and complaint evidence)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check & Root
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'HostelPulse Core Foundation API',
      version: '1.0.0',
    },
    error: null,
  });
});

// Mount Routes with /api/v1 prefix
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/food', foodRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/outpass', outpassRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/rooms', roomsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
      code: 'ROUTE_NOT_FOUND',
    },
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED-SERVER-ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    data: null,
    error: {
      message: err.message || 'An unexpected internal server error occurred.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
});

const { initFoodReminderCron } = require('./modules/food/reminder.cron');
const { initEscalationCron } = require('./modules/complaints/escalation.cron');
const { initOutpassWatchdogCron } = require('./modules/outpass/outpass.cron');

// Boot Server
async function startServer() {
  try {
    await initDb();
    initFoodReminderCron();
    initEscalationCron();
    initOutpassWatchdogCron();
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(` HostelPulse Foundation API is running on port ${PORT}`);
      console.log(` API Base: http://localhost:${PORT}/api/v1`);
      console.log(` Health:   http://localhost:${PORT}/health`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error('[SERVER-BOOT-FAIL] Could not start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
