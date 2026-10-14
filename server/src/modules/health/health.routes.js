const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const controller = require('./health.controller');

const router = express.Router();

// 1. Student raises a health ticket or triggers Code Red SOS
router.post(
  '/',
  authenticate,
  requireRole('student'),
  controller.raiseHealthTicket
);

// 2. List health tickets (privacy-scoped for student, warden, health_assistant, admin)
router.get(
  '/',
  authenticate,
  scopeToBlock,
  controller.listHealthTickets
);

// 3. Medicine inventory with low-stock alerts
router.get(
  '/inventory',
  authenticate,
  requireRole('health_assistant', 'warden', 'admin'),
  controller.getInventory
);

// 4. Get specific health ticket with audit access check
router.get(
  '/:id',
  authenticate,
  controller.getHealthTicketDetails
);

// 5. Update health ticket status (health_assistant, warden, admin)
router.put(
  '/:id/status',
  authenticate,
  requireRole('health_assistant', 'warden', 'admin'),
  controller.updateTicketStatus
);

// 6. Administer / log medicine with student allergy check
router.post(
  '/:id/medicine',
  authenticate,
  requireRole('health_assistant', 'warden', 'admin'),
  controller.logMedicine
);

// 7. Request emergency medical van / hospital transfer
router.post(
  '/:id/vehicle',
  authenticate,
  requireRole('health_assistant', 'warden', 'admin'),
  controller.requestMedicalVehicle
);

// 8. Update vehicle transit status
router.put(
  '/:id/vehicle/:vehicleId/status',
  authenticate,
  requireRole('health_assistant', 'warden', 'admin'),
  controller.updateVehicleStatus
);

module.exports = router;
