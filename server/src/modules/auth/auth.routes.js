const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const { uploadIdCard, computeFileHash } = require('../../middleware/upload');
const { loginLimiter, otpLimiter } = require('../../middleware/rateLimiter');

// Public Registration & Session
router.get('/blocks', authController.getBlocks);
router.post(
  '/register/student',
  uploadIdCard.single('idCardPhoto'),
  computeFileHash,
  authController.registerStudent
);
router.post('/register/warden', authController.registerWarden);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refreshAccessToken);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Authenticated User Context
router.get('/me', authenticate, authController.getCurrentUser);
router.get('/profile', authenticate, authController.getCurrentUser);
router.put('/profile', authenticate, authController.updateProfile);

// Secure File Server (Laminated ID Photos)
router.get('/files/:filename', authenticate, authController.serveSecureIdCard);

// Warden / Admin Approval Flow
router.get(
  '/pending-students',
  authenticate,
  requireRole('warden', 'admin'),
  scopeToBlock,
  authController.getPendingStudents
);

router.post(
  '/students/:id/approve',
  authenticate,
  requireRole('warden', 'admin'),
  (req, res, next) => {
    req.body.action = 'approve';
    next();
  },
  authController.processStudentApproval
);

router.post(
  '/students/:id/reject',
  authenticate,
  requireRole('warden', 'admin'),
  (req, res, next) => {
    req.body.action = 'reject';
    next();
  },
  authController.processStudentApproval
);

module.exports = router;
