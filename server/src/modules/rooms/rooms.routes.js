const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');
const controller = require('./rooms.controller');

const router = express.Router();

// 1. Check student tenure eligibility (>= 7 months / 1 year)
router.get(
  '/eligibility',
  authenticate,
  requireRole('student'),
  controller.getEligibility
);

// 2. Student active group, pending invites, and room move history
router.get(
  '/my-status',
  authenticate,
  requireRole('student'),
  controller.getMyRoomStatus
);

// 3. Create a room allocation group
router.post(
  '/groups',
  authenticate,
  requireRole('student'),
  controller.createGroup
);

// 4. Invite peer member to group (same class and year)
router.post(
  '/groups/:groupId/invite',
  authenticate,
  requireRole('student'),
  controller.inviteMember
);

// 5. Respond to group invitation (Accept / Decline)
router.put(
  '/groups/:groupId/respond',
  authenticate,
  requireRole('student'),
  controller.respondInvite
);

// 6. Explore hostel rooms, capacity, and current occupants
router.get(
  '/explore',
  authenticate,
  controller.exploreRooms
);

// 7. Submit preferred room request (Group allocation or Waitlist)
router.post(
  '/requests',
  authenticate,
  requireRole('student'),
  controller.submitRoomRequest
);

// 8. Submit peer-to-peer room swap request
router.post(
  '/swap',
  authenticate,
  requireRole('student'),
  controller.submitSwapRequest
);

// 9. List room requests (Warden queue ordered by conflict rules: seniority + first-come)
router.get(
  '/requests',
  authenticate,
  scopeToBlock,
  controller.listRoomRequests
);

// 10. Warden executes transactional room allocation
router.post(
  '/requests/:requestId/allocate',
  authenticate,
  requireRole('warden', 'admin'),
  controller.allocateRoom
);

module.exports = router;
