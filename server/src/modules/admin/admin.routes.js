const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// All Admin routes require 'admin' role
router.use(authenticate, requireRole('admin'));

router.get('/stats', adminController.getAdminStats);

// Blocks & Rooms
router.get('/blocks', adminController.getAllBlocks);
router.post('/blocks', adminController.createBlock);
router.get('/rooms', adminController.getAllRooms);
router.post('/rooms', adminController.createRoom);

// Wardens & Preload
router.get('/wardens', adminController.getAllWardens);
router.post('/wardens/preload', adminController.preloadWarden);

// Staff
router.get('/staff', adminController.getAllStaff);
router.post('/staff', adminController.createStaffAccount);
router.get('/maintenance/assignees', adminController.getMaintenanceAssignees);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
