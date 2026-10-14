const db = require('../../db');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');

const ELIGIBILITY_MONTHS_REQUIRED = 7; // Configurable: 7 months or 12 months

/**
 * Helper: Check student residency eligibility
 */
function evaluateEligibility(joinedOnDate) {
  if (!joinedOnDate) return { isEligible: true, monthsStayed: 8, threshold: ELIGIBILITY_MONTHS_REQUIRED };

  const joined = new Date(joinedOnDate);
  const now = new Date();
  const diffTime = Math.abs(now - joined);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthsStayed = Number((diffDays / 30.44).toFixed(1));

  return {
    isEligible: monthsStayed >= ELIGIBILITY_MONTHS_REQUIRED,
    monthsStayed,
    threshold: ELIGIBILITY_MONTHS_REQUIRED,
    joinedOn: joinedOnDate,
    remainingMonths: Math.max(0, Number((ELIGIBILITY_MONTHS_REQUIRED - monthsStayed).toFixed(1))),
  };
}

/**
 * 1. Check Student Eligibility
 * GET /api/v1/rooms/eligibility
 */
async function getEligibility(req, res) {
  try {
    const student = req.user.student;
    let studentDetails = student;

    if (!studentDetails) {
      const stRes = await db.query('SELECT * FROM students WHERE user_id = $1', [req.user.id]);
      if (stRes.rows.length > 0) studentDetails = stRes.rows[0];
    }

    if (!studentDetails) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Student profile not found.', code: 'NOT_FOUND' } });
    }

    const evaluation = evaluateEligibility(studentDetails.joined_on);

    return res.status(200).json({
      success: true,
      data: {
        studentId: studentDetails.id,
        fullName: studentDetails.full_name,
        joinedOn: studentDetails.joined_on,
        class: studentDetails.class,
        year: studentDetails.year,
        ...evaluation,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 2. Create a Room Group (Peer formation)
 * POST /api/v1/rooms/groups
 */
async function createGroup(req, res) {
  try {
    const student = req.user.student;
    let studentId = student?.id;
    let studentData = student;

    if (!studentData) {
      const stRes = await db.query('SELECT * FROM students WHERE user_id = $1', [req.user.id]);
      if (stRes.rows.length > 0) {
        studentData = stRes.rows[0];
        studentId = studentData.id;
      }
    }

    if (!studentId) {
      return res.status(403).json({ success: false, data: null, error: { message: 'Student profile required.', code: 'FORBIDDEN' } });
    }

    // Eligibility check
    const evalResult = evaluateEligibility(studentData.joined_on);
    if (!evalResult.isEligible) {
      return res.status(400).json({
        success: false,
        data: evalResult,
        error: {
          message: `Ineligible: Room reallocation requires at least ${ELIGIBILITY_MONTHS_REQUIRED} months of campus stay. You have completed ${evalResult.monthsStayed} months.`,
          code: 'INSUFFICIENT_TENURE',
        },
      });
    }

    const { groupName } = req.body;
    if (!groupName) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Group name is required.', code: 'VALIDATION_ERROR' } });
    }

    // Check if student already in an active group
    const activeMemberRes = await db.query(
      `SELECT rgm.* FROM room_group_members rgm
       JOIN room_groups rg ON rg.id = rgm.group_id
       WHERE rgm.student_id = $1 AND rg.status IN ('Forming', 'Ready', 'Submitted')`,
      [studentId]
    );
    if (activeMemberRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'You are already part of an active room allocation group.', code: 'ALREADY_IN_GROUP' },
      });
    }

    // Create group
    const groupRes = await db.query(
      `INSERT INTO room_groups (leader_id, group_name, target_class, target_year, target_gender, status)
       VALUES ($1, $2, $3, $4, $5, 'Forming')
       RETURNING *;`,
      [studentId, groupName, studentData.class_name || studentData.class || 'B.Tech CSE', studentData.academic_year || studentData.year || 2, studentData.gender || 'male']
    );

    const group = groupRes.rows[0];

    // Add leader as accepted member
    await db.query(
      `INSERT INTO room_group_members (group_id, student_id, invite_status)
       VALUES ($1, $2, 'Leader')`,
      [group.id, studentId]
    );

    await audit({
      actorId: req.user.id,
      action: 'ROOM_GROUP_CREATED',
      entity: 'room_group',
      entityId: group.id,
      details: { groupName, targetClass: group.target_class, targetYear: group.target_year },
    });

    return res.status(201).json({
      success: true,
      data: { group },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 3. Invite Member to Group (Must match class, year, and gender)
 * POST /api/v1/rooms/groups/:groupId/invite
 */
async function inviteMember(req, res) {
  try {
    const { groupId } = req.params;
    const { studentRollNumber } = req.body;

    if (!studentRollNumber) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Student roll number is required.', code: 'VALIDATION_ERROR' } });
    }

    // Verify group
    const gRes = await db.query('SELECT * FROM room_groups WHERE id = $1', [groupId]);
    if (gRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Group not found.', code: 'NOT_FOUND' } });
    }
    const group = gRes.rows[0];

    // Find invited student
    const sRes = await db.query('SELECT * FROM students WHERE LOWER(roll_number) = LOWER($1)', [studentRollNumber.trim()]);
    if (sRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: `Student with roll number "${studentRollNumber}" not found.`, code: 'STUDENT_NOT_FOUND' } });
    }
    const targetStudent = sRes.rows[0];
    const candidateClass = targetStudent.class_name || targetStudent.class;
    const candidateYear = targetStudent.academic_year || targetStudent.year;

    // Check same class and year rule
    if (candidateClass !== group.target_class || candidateYear !== group.target_year) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Group constraint violation: All room group members must belong to the same class (${group.target_class}) and year (${group.target_year}). Candidate is ${candidateClass} Year ${candidateYear}.`,
          code: 'CLASS_YEAR_MISMATCH',
        },
      });
    }

    // Check gender match
    if (targetStudent.gender !== group.target_gender) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Gender mismatch with group quota block.', code: 'GENDER_MISMATCH' },
      });
    }

    // Add invite
    await db.query(
      `INSERT INTO room_group_members (group_id, student_id, invite_status)
       VALUES ($1, $2, 'Invited')
       ON CONFLICT (group_id, student_id) DO UPDATE SET invite_status = 'Invited';`,
      [groupId, targetStudent.id]
    );

    // Notify candidate
    await notify({
      userId: targetStudent.user_id,
      type: 'room_group_invite',
      title: `Room Allocation Invite: ${group.group_name}`,
      message: `You were invited by ${req.user.fullName} to join room allocation group "${group.group_name}".`,
      link: `/student/rooms`,
    });

    return res.status(200).json({
      success: true,
      data: { message: `Invitation sent to ${targetStudent.full_name} (${targetStudent.roll_number}).` },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 4. Respond to Group Invite (Accept / Decline)
 * PUT /api/v1/rooms/groups/:groupId/respond
 */
async function respondInvite(req, res) {
  try {
    const { groupId } = req.params;
    const { response } = req.body; // 'Accepted' | 'Declined'

    const studentId = req.user.student?.id || req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ success: false, data: null, error: { message: 'Student only.', code: 'FORBIDDEN' } });
    }

    if (!['Accepted', 'Declined'].includes(response)) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Response must be Accepted or Declined.', code: 'VALIDATION_ERROR' } });
    }

    await db.query(
      `UPDATE room_group_members
       SET invite_status = $1, joined_at = CURRENT_TIMESTAMP
       WHERE group_id = $2 AND student_id = $3`,
      [response, groupId, studentId]
    );

    // Check if all members accepted
    const pendingRes = await db.query(
      `SELECT COUNT(*) as pending_count FROM room_group_members WHERE group_id = $1 AND invite_status = 'Invited'`,
      [groupId]
    );
    if (parseInt(pendingRes.rows[0].pending_count, 10) === 0) {
      await db.query(`UPDATE room_groups SET status = 'Ready' WHERE id = $1`, [groupId]);
    }

    return res.status(200).json({
      success: true,
      data: { message: `You have ${response.toLowerCase()} the room group invitation.` },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 5. Explore Rooms with Occupancy & Vacancy
 * GET /api/v1/rooms/explore?blockId=X&gender=Y
 */
async function exploreRooms(req, res) {
  try {
    const { blockId, gender } = req.query;
    const params = [];
    const conditions = [];

    if (blockId) {
      params.push(parseInt(blockId, 10));
      conditions.push(`r.block_id = $${params.length}`);
    }

    if (gender) {
      params.push(gender);
      conditions.push(`b.gender = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        r.id,
        r.room_number,
        r.floor,
        r.capacity,
        r.current_occupants,
        (r.capacity - r.current_occupants) as vacancies,
        b.id as block_id,
        b.name as block_name,
        b.gender as block_gender
      FROM rooms r
      JOIN blocks b ON b.id = r.block_id
      ${whereClause}
      ORDER BY b.name ASC, r.floor ASC, r.room_number ASC;
    `;

    const result = await db.query(sql, params);

    const residentsRes = await db.query(
      `SELECT s.id, s.room_id, s.full_name as name, s.roll_number as roll, s.academic_year as year, s.class_name as class
       FROM students s
       WHERE s.room_id IS NOT NULL;`
    );
    const residentsMap = {};
    for (const res of residentsRes.rows) {
      if (!residentsMap[res.room_id]) residentsMap[res.room_id] = [];
      residentsMap[res.room_id].push(res);
    }

    const roomsWithResidents = result.rows.map(r => ({
      ...r,
      current_resident_details: residentsMap[r.id] || [],
    }));

    return res.status(200).json({
      success: true,
      data: { rooms: roomsWithResidents },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 6. Submit Room Request (Group Allocation or Waitlist)
 * POST /api/v1/rooms/requests
 */
async function submitRoomRequest(req, res) {
  try {
    const { groupId, preferredRoomId, reason } = req.body;

    if (!groupId || !preferredRoomId || !reason) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Group, preferred room, and reason are required.', code: 'VALIDATION_ERROR' },
      });
    }

    // Verify group members all accepted
    const membersRes = await db.query(
      `SELECT rgm.*, s.joined_on, s.academic_year as year, s.class_name as class
       FROM room_group_members rgm
       JOIN students s ON s.id = rgm.student_id
       WHERE rgm.group_id = $1`,
      [groupId]
    );

    const members = membersRes.rows;
    const hasUnaccepted = members.some(m => m.invite_status === 'Invited');
    if (hasUnaccepted) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'All invited members must accept before submitting the room request.', code: 'PENDING_INVITATIONS' },
      });
    }

    const groupSize = members.filter(m => ['Accepted', 'Leader'].includes(m.invite_status)).length;

    // Check room details
    const rRes = await db.query('SELECT r.*, b.gender as block_gender FROM rooms r JOIN blocks b ON b.id = r.block_id WHERE r.id = $1', [preferredRoomId]);
    if (rRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Room not found.', code: 'NOT_FOUND' } });
    }
    const room = rRes.rows[0];

    if (groupSize > room.capacity) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: `Group size (${groupSize}) exceeds room capacity (${room.capacity}).`, code: 'CAPACITY_EXCEEDED' },
      });
    }

    const availableSlots = room.capacity - room.current_occupants;
    const willBeWaitlisted = availableSlots < groupSize;

    // Compute Seniority Score: Average study year * 100 + days of stay
    let totalScore = 0;
    for (const m of members) {
      const stayDays = Math.ceil((new Date() - new Date(m.joined_on || new Date())) / (1000 * 60 * 60 * 24));
      totalScore += (m.year || 1) * 100 + Math.min(365, stayDays);
    }
    const avgSeniorityScore = Math.round(totalScore / groupSize);

    // Get current queue count for this room to determine queue position
    const qCountRes = await db.query(
      `SELECT COUNT(*) as count FROM room_requests WHERE preferred_room_id = $1 AND status IN ('Pending', 'Waitlisted')`,
      [preferredRoomId]
    );
    const queuePosition = parseInt(qCountRes.rows[0].count, 10) + 1;

    const initialStatus = willBeWaitlisted ? 'Waitlisted' : 'Pending';

    const insertSql = `
      INSERT INTO room_requests (
        request_type, group_id, student_id, block_id, preferred_room_id, reason,
        status, queue_position, seniority_score
      ) VALUES ('GroupAllocation', $1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const reqRes = await db.query(insertSql, [
      groupId,
      req.user.student?.id || members[0].student_id,
      room.block_id,
      preferredRoomId,
      reason,
      initialStatus,
      queuePosition,
      avgSeniorityScore,
    ]);

    await db.query(`UPDATE room_groups SET status = 'Submitted' WHERE id = $1`, [groupId]);

    await audit({
      actorId: req.user.id,
      action: 'ROOM_REQUEST_SUBMITTED',
      entity: 'room_request',
      entityId: reqRes.rows[0].id,
      details: { groupId, preferredRoomId, status: initialStatus, queuePosition, seniorityScore: avgSeniorityScore },
    });

    return res.status(201).json({
      success: true,
      data: {
        request: reqRes.rows[0],
        message: willBeWaitlisted
          ? `Room ${room.room_number} is currently occupied (${availableSlots} slots free for group of ${groupSize}). You are Queued at Position #${queuePosition} on the Waitlist.`
          : `Room request submitted successfully. Warden will review and assign.`,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 7. List Room Requests (Warden Desk with Conflict Resolution Order)
 * GET /api/v1/rooms/requests
 * Conflict rule: First-come (earliest created_at), then Seniority (higher seniority_score)
 */
async function listRoomRequests(req, res) {
  try {
    const { status, blockId } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'warden') {
      const wBlock = req.scope?.blockId || req.user.blockId;
      if (wBlock) {
        params.push(wBlock);
        conditions.push(`rr.block_id = $${params.length}`);
      }
    } else if (req.user.role === 'student') {
      const studentId = req.user.student?.id || req.user.studentId;
      params.push(studentId);
      conditions.push(`(rr.student_id = $${params.length} OR rg.leader_id = $${params.length})`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`rr.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        rr.*,
        rg.group_name,
        rg.target_class,
        rg.target_year,
        b.name as block_name,
        r.room_number,
        r.capacity,
        r.current_occupants,
        (r.capacity - r.current_occupants) as available_vacancies,
        s.full_name as applicant_name,
        s.roll_number as applicant_roll
      FROM room_requests rr
      LEFT JOIN room_groups rg ON rg.id = rr.group_id
      JOIN blocks b ON b.id = rr.block_id
      LEFT JOIN rooms r ON r.id = rr.preferred_room_id
      JOIN students s ON s.id = rr.student_id
      ${whereClause}
      ORDER BY 
        CASE WHEN rr.status IN ('Pending', 'Waitlisted') THEN 1 ELSE 2 END,
        rr.seniority_score DESC,
        rr.created_at ASC;
    `;

    const result = await db.query(sql, params);

    const membersRes = await db.query(
      `SELECT rgm.group_id, st.id as "studentId", st.full_name as name, st.roll_number as roll,
              st.academic_year as year, st.class_name as class, cur_r.room_number as "currentRoom", rgm.invite_status as status
       FROM room_group_members rgm
       JOIN students st ON st.id = rgm.student_id
       LEFT JOIN rooms cur_r ON cur_r.id = st.room_id;`
    );
    const groupMembersMap = {};
    for (const m of membersRes.rows) {
      if (!groupMembersMap[m.group_id]) groupMembersMap[m.group_id] = [];
      groupMembersMap[m.group_id].push(m);
    }

    const requestsWithMembers = result.rows.map(rr => ({
      ...rr,
      member_details: groupMembersMap[rr.group_id] || [],
    }));

    return res.status(200).json({
      success: true,
      data: { requests: requestsWithMembers },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 8. Allocate Room (DATABASE TRANSACTION)
 * POST /api/v1/rooms/requests/:requestId/allocate
 * Safe atomic execution updating rooms, students, and room_history!
 */
async function allocateRoom(req, res) {
  const { requestId } = req.params;
  const { wardenNotes } = req.body;

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Fetch request with lock
    const reqRes = await client.query('SELECT * FROM room_requests WHERE id = $1 FOR UPDATE', [requestId]);
    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, data: null, error: { message: 'Request not found.', code: 'NOT_FOUND' } });
    }
    const request = reqRes.rows[0];

    const targetRoomId = request.preferred_room_id;
    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [targetRoomId]);
    if (roomRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, data: null, error: { message: 'Target room not found.', code: 'NOT_FOUND' } });
    }
    const targetRoom = roomRes.rows[0];

    // Get group members
    const membersRes = await client.query(
      `SELECT rgm.*, s.room_id as old_room_id, s.full_name as student_name, s.user_id as student_user_id
       FROM room_group_members rgm
       JOIN students s ON s.id = rgm.student_id
       WHERE rgm.group_id = $1 AND rgm.invite_status IN ('Accepted', 'Leader')`,
      [request.group_id]
    );
    const members = membersRes.rows;

    if (members.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, data: null, error: { message: 'No accepted group members to allocate.', code: 'NO_MEMBERS' } });
    }

    const availableSlots = targetRoom.capacity - targetRoom.current_occupants;
    if (members.length > availableSlots) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Insufficient vacancies in Room ${targetRoom.room_number}. Needed: ${members.length}, Available: ${availableSlots}.`,
          code: 'INSUFFICIENT_CAPACITY',
        },
      });
    }

    // Move each student safely
    for (const m of members) {
      // 1. Decrement old room occupant count if they were in a room
      if (m.old_room_id) {
        await client.query(
          `UPDATE rooms SET current_occupants = GREATEST(0, current_occupants - 1) WHERE id = $1`,
          [m.old_room_id]
        );
      }

      // 2. Update student table with new room & block
      await client.query(
        `UPDATE students SET room_id = $1, block_id = $2 WHERE id = $3`,
        [targetRoomId, targetRoom.block_id, m.student_id]
      );

      // 3. Write room_history audit log
      await client.query(
        `INSERT INTO room_history (student_id, from_room_id, to_room_id, move_type, authorized_by, notes)
         VALUES ($1, $2, $3, 'GroupAllocation', $4, $5)`,
        [m.student_id, m.old_room_id, targetRoomId, req.user.id, wardenNotes || 'Official group allocation approved by warden.']
      );

      // Notify student
      await notify({
        userId: m.student_user_id,
        type: 'room_allocated',
        title: `Room Allocation Approved: Room ${targetRoom.room_number}`,
        message: `Congratulations! Your group has been allocated Room ${targetRoom.room_number}. You can now collect keys from the warden office.`,
        link: `/student/rooms`,
      });
    }

    // 4. Increment target room occupant count
    await client.query(
      `UPDATE rooms SET current_occupants = current_occupants + $1 WHERE id = $2`,
      [members.length, targetRoomId]
    );

    // 5. Update request status to 'Allocated'
    await client.query(
      `UPDATE room_requests
       SET status = 'Allocated', warden_notes = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [wardenNotes || 'Allocated', req.user.id, requestId]
    );

    // 6. Update group status
    await client.query(`UPDATE room_groups SET status = 'Allocated' WHERE id = $1`, [request.group_id]);

    await client.query('COMMIT');

    await audit({
      actorId: req.user.id,
      action: 'TRANSACTIONAL_ROOM_ALLOCATED',
      entity: 'room_request',
      entityId: requestId,
      details: { roomId: targetRoomId, allocatedStudents: members.length },
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully allocated Room ${targetRoom.room_number} to group (${members.length} residents moved).`,
        roomId: targetRoomId,
        roomNumber: targetRoom.room_number,
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ROOM-ALLOCATION-TRANSACTION-FAIL]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: `Transaction failed: ${err.message}`, code: 'TRANSACTION_ERROR' },
    });
  } finally {
    client.release();
  }
}

/**
 * 9. Submit Peer Swap or Transfer Request
 * POST /api/v1/rooms/swap
 */
async function submitSwapRequest(req, res) {
  try {
    const student = req.user.student;
    const studentId = student?.id || req.user.studentId;
    const { swapWithRollNumber, reason } = req.body;

    if (!swapWithRollNumber || !reason) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Peer roll number and reason are required.', code: 'VALIDATION_ERROR' } });
    }

    const peerRes = await db.query('SELECT * FROM students WHERE LOWER(roll_number) = LOWER($1)', [swapWithRollNumber.trim()]);
    if (peerRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Peer student not found.', code: 'NOT_FOUND' } });
    }
    const peer = peerRes.rows[0];

    if (!peer.room_id) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Peer student does not have an active room assignment to swap.', code: 'PEER_HAS_NO_ROOM' } });
    }

    const insertSql = `
      INSERT INTO room_requests (
        request_type, student_id, block_id, preferred_room_id, swap_with_student_id, reason, status
      ) VALUES ('PeerSwap', $1, $2, $3, $4, $5, 'Pending')
      RETURNING *;
    `;

    const insRes = await db.query(insertSql, [
      studentId,
      peer.block_id,
      peer.room_id,
      peer.id,
      reason,
    ]);

    // Notify Peer & Warden
    await notify({
      userId: peer.user_id,
      type: 'room_swap_proposal',
      title: 'Peer Room Swap Proposal',
      message: `${req.user.fullName} proposed a room swap with your room. Warden review pending.`,
      link: `/student/rooms`,
    });

    return res.status(201).json({
      success: true,
      data: { request: insRes.rows[0], message: 'Peer room swap submitted for warden review.' },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 10. Student Active Group and Move History
 * GET /api/v1/rooms/my-status
 */
async function getMyRoomStatus(req, res) {
  try {
    const studentId = req.user.student?.id || req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ success: false, data: null, error: { message: 'Student only.', code: 'FORBIDDEN' } });
    }

    // Active group
    const grpRes = await db.query(
      `SELECT rg.*, rgm.invite_status as my_invite_status
       FROM room_groups rg
       JOIN room_group_members rgm ON rgm.group_id = rg.id
       WHERE rgm.student_id = $1 AND rg.status IN ('Forming', 'Ready', 'Submitted')
       ORDER BY rg.created_at DESC LIMIT 1;`,
      [studentId]
    );

    let activeGroup = grpRes.rows[0] || null;
    let members = [];
    if (activeGroup) {
      const mRes = await db.query(
        `SELECT rgm.*, s.full_name, s.roll_number, s.academic_year as year, s.class_name as class
         FROM room_group_members rgm
         JOIN students s ON s.id = rgm.student_id
         WHERE rgm.group_id = $1`,
        [activeGroup.id]
      );
      members = mRes.rows;
    }

    // Pending invites from other groups
    const invitesRes = await db.query(
      `SELECT rg.*, s_lead.full_name as leader_name, rgm.joined_at as invited_at
       FROM room_group_members rgm
       JOIN room_groups rg ON rg.id = rgm.group_id
       JOIN students s_lead ON s_lead.id = rg.leader_id
       WHERE rgm.student_id = $1 AND rgm.invite_status = 'Invited' AND rg.status = 'Forming'`,
      [studentId]
    );

    // Room move history
    const histRes = await db.query(
      `SELECT rh.*, r_from.room_number as from_room_num, r_to.room_number as to_room_num, w.full_name as authorizer_name
       FROM room_history rh
       LEFT JOIN rooms r_from ON r_from.id = rh.from_room_id
       LEFT JOIN rooms r_to ON r_to.id = rh.to_room_id
       LEFT JOIN wardens w ON w.user_id = rh.authorized_by
       WHERE rh.student_id = $1
       ORDER BY rh.moved_at DESC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      data: {
        activeGroup,
        members,
        pendingInvites: invitesRes.rows,
        history: histRes.rows,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

module.exports = {
  getEligibility,
  createGroup,
  inviteMember,
  respondInvite,
  exploreRooms,
  submitRoomRequest,
  listRoomRequests,
  allocateRoom,
  submitSwapRequest,
  getMyRoomStatus,
};
