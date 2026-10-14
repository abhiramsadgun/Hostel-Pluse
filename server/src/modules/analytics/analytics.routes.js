const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const controller = require('./analytics.controller');

const router = express.Router();

router.get(
  '/dashboard',
  authenticate,
  requireRole('warden', 'admin'),
  scopeToBlock,
  controller.getDashboardAnalytics
);

router.get(
  '/staff-performance',
  authenticate,
  requireRole('warden', 'admin'),
  controller.getStaffPerformance
);

module.exports = router;
