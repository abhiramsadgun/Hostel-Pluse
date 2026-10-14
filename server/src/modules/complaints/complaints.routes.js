const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const { uploadComplaintPhotos, uploadAfterPhoto } = require('../../middleware/complaintUpload');
const controller = require('./complaints.controller');

const router = express.Router();

// 1. Submit Complaint (Student only, Multer up to 4 photos)
router.post(
  '/',
  authenticate,
  requireRole('student'),
  uploadComplaintPhotos,
  controller.submitComplaint
);

// 2. Real-time AI preview for category & predicted turnaround
router.post(
  '/classify-ai',
  authenticate,
  controller.classifyAiPreview
);

// 3. List Categories
router.get(
  '/categories',
  authenticate,
  controller.getCategories
);

// 4. Admin: Add/Update Category
router.post(
  '/categories',
  authenticate,
  requireRole('admin'),
  controller.addCategory
);

// 5. Staff Auto-Suggestion ranked by specialisation & open tasks (Warden/Admin)
router.get(
  '/staff-suggestions',
  authenticate,
  requireRole('warden', 'admin'),
  controller.getStaffSuggestions
);

// 6. Recurring Hotspots List (Warden/Admin)
router.get(
  '/hotspots',
  authenticate,
  scopeToBlock,
  controller.getRecurringHotspots
);

// 7. Student Personal Complaints History
router.get(
  '/my',
  authenticate,
  requireRole('student'),
  controller.getMyComplaints
);

// 8. Complaints by Room (Exported getComplaintsByRoom helper endpoint)
router.get(
  '/room/:roomId',
  authenticate,
  controller.getComplaintsByRoomHandler
);

// 9. List Complaints with Role Scoping (Warden block scope, Student block visibility)
router.get(
  '/',
  authenticate,
  scopeToBlock,
  controller.listComplaints
);

// 10. Single Complaint Details with Timeline, Images & Merge Suggestion
router.get(
  '/:id',
  authenticate,
  controller.getComplaintDetails
);

// 11. "I'm Also Affected" Upvote Toggle (Student)
router.post(
  '/:id/vote',
  authenticate,
  requireRole('student'),
  controller.toggleComplaintVote
);

// 12. Update Status (Warden, Staff, Admin)
router.post(
  '/:id/status',
  authenticate,
  requireRole('warden', 'admin', 'maintenance', 'security', 'mess'),
  controller.updateComplaintStatus
);

// 13. Assign to Staff with Note (Warden, Admin)
router.post(
  '/:id/assign',
  authenticate,
  requireRole('warden', 'admin'),
  controller.assignStaff
);

// 14. Maintenance Staff: Resolve with Completion Note and After-Photo
router.post(
  '/:id/resolve',
  authenticate,
  requireRole('maintenance', 'warden', 'admin'),
  uploadAfterPhoto,
  controller.resolveComplaint
);

// 15. Student Feedback (Rating & Comments)
router.post(
  '/:id/feedback',
  authenticate,
  requireRole('student'),
  controller.submitComplaintFeedback
);

// 16. Merge into Parent Complaint (Warden, Admin)
router.post(
  '/:id/merge',
  authenticate,
  requireRole('warden', 'admin'),
  controller.mergeComplaints
);

module.exports = router;
