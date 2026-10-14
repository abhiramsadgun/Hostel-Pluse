const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const controller = require('./outpass.controller');

const router = express.Router();

// 1. Student requests outpass
router.post(
  '/',
  authenticate,
  requireRole('student'),
  controller.requestOutpass
);

// 2. List outpasses (role-scoped for student, warden, security guard, admin)
router.get(
  '/',
  authenticate,
  scopeToBlock,
  controller.listOutpasses
);

// 3. Exported/shared endpoint: get students out for meal planning
router.get(
  '/students-out',
  authenticate,
  controller.getStudentsOutHandler
);

// 4. Security gate check (Scan QR or enter number for Check-Out / Check-In)
router.post(
  '/gate-check',
  authenticate,
  requireRole('security', 'warden', 'admin'),
  controller.gateCheck
);

// 5. Outpass details with call logs & gate logs
router.get(
  '/:id',
  authenticate,
  controller.getOutpassDetails
);

// 6. Warden logs parental verification call
router.post(
  '/:id/call-log',
  authenticate,
  requireRole('warden', 'admin'),
  controller.logParentCall
);

// 7. Warden approves or rejects outpass
router.put(
  '/:id/decision',
  authenticate,
  requireRole('warden', 'admin'),
  controller.approveOrRejectOutpass
);

module.exports = router;
