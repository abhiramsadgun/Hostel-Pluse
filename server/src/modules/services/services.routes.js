const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const controller = require('./services.controller');

const router = express.Router();

// 1. Schedule a room service (Warden, Maintenance, Admin)
router.post(
  '/',
  authenticate,
  requireRole('warden', 'admin', 'maintenance'),
  controller.scheduleService
);

// 2. List room service schedules (Scoped)
router.get(
  '/',
  authenticate,
  scopeToBlock,
  controller.listServices
);

// 3. Exported endpoint getRoomServices(roomId)
router.get(
  '/room/:roomId',
  authenticate,
  controller.getRoomServicesHandler
);

// 4. Student acknowledges presence, reschedules, or marks away
router.put(
  '/:id/acknowledge',
  authenticate,
  requireRole('student'),
  controller.acknowledgeService
);

// 5. Staff marks completion or updates status
router.put(
  '/:id/status',
  authenticate,
  requireRole('maintenance', 'warden', 'admin'),
  controller.updateServiceStatus
);

module.exports = router;
