const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const controller = require('./reports.controller');

const router = express.Router();

router.get(
  '/summary',
  authenticate,
  requireRole('warden', 'admin'),
  controller.getReportSummary
);

router.get(
  '/export-csv',
  authenticate,
  requireRole('warden', 'admin'),
  controller.exportComplaintsCsv
);

module.exports = router;
