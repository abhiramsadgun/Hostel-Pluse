const express = require('express');
const router = express.Router();
const notifController = require('./notification.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', notifController.getUserNotifications);
router.put('/:id/read', notifController.markAsRead);
router.put('/read-all', notifController.markAllAsRead);

module.exports = router;
