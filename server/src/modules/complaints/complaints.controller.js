const path = require('path');
const db = require('../../db');
const { generateUniqueComplaintId } = require('../../services/complaintId');
const { calculatePriorityScore, CATEGORY_SEVERITY_WEIGHTS, CATEGORY_SLA_HOURS } = require('../../services/priority');
const { classifyComplaintText } = require('../../services/aiClassifier');
const { predictResolutionHours } = require('../../services/resolutionPredictor');
const { findSimilarComplaints } = require('../../services/similarity');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');
const {
  submitComplaintSchema,
  updateStatusSchema,
  assignStaffSchema,
  resolveComplaintSchema,
  feedbackSchema,
  categorySchema,
} = require('./complaints.validation');

/**
 * Helper to fetch category by key or id
 */
async function getCategoryByKey(key) {
  const res = await db.query(
    `SELECT * FROM complaint_categories WHERE key = $1 OR name ILIKE $1 LIMIT 1`,
    [key]
  );
  return res.rows[0] || null;
}

/**
 * 1. Submit Complaint (Student)
 * POST /api/v1/complaints
 */
async function submitComplaint(req, res) {
  try {
    const student = req.user.student;
    if (!student && req.user.role === 'student') {
      // Fetch student record if not attached
      const stRes = await db.query('SELECT * FROM students WHERE user_id = $1', [req.user.id]);
      if (stRes.rows.length > 0) req.user.student = stRes.rows[0];
    }
    const studentId = req.user.student?.id || req.user.studentId;
    const blockId = req.user.blockId || req.user.student?.block_id;
    const roomId = req.user.roomId || req.user.student?.room_id;

    if (!studentId || !blockId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only active students with block assignments can submit complaints.', code: 'FORBIDDEN' },
      });
    }

    const parseResult = submitComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: parseResult.error.errors[0].message, code: 'VALIDATION_ERROR' },
      });
    }

    const { title, description } = parseResult.data;
    let { categoryKey, isAnonymous } = parseResult.data;
    const isAnon = isAnonymous === true || isAnonymous === 'true';

    // AI Classification if categoryKey is omitted or marked auto
    let aiSuggestedCat = null;
    let aiConfidence = 0;
    if (!categoryKey || categoryKey === 'auto') {
      const aiResult = classifyComplaintText(title, description);
      categoryKey = aiResult.categoryKey;
      aiSuggestedCat = aiResult.categoryKey;
      aiConfidence = aiResult.confidence;
    } else {
      // Still compute AI score for meta telemetry
      const aiMeta = classifyComplaintText(title, description);
      aiSuggestedCat = aiMeta.categoryKey;
      aiConfidence = aiMeta.confidence;
    }

    // Fetch category configuration
    const catRow = await getCategoryByKey(categoryKey);
    const resolvedCatId = catRow ? catRow.id : null;
    const resolvedCatKey = catRow ? catRow.key : (categoryKey || 'other');
    const slaHours = catRow ? catRow.sla_hours : (CATEGORY_SLA_HOURS[resolvedCatKey] || 24);

    // Concurrency-safe unique readable ID: HCM-YYYY-XXXXXX
    const complaintId = await generateUniqueComplaintId();

    // AI Resolution Turnaround Predictor (hours and expected completion target)
    const prediction = await predictResolutionHours(resolvedCatKey);
    const predictedHours = prediction.predictedHours;
    const predictedResolutionAt = new Date(Date.now() + predictedHours * 3600 * 1000);

    // Calculate initial dynamic priority score
    const priorityScore = calculatePriorityScore({
      categoryKey: resolvedCatKey,
      createdAt: new Date(),
      affectedCount: 1,
      slaHours,
    });

    // Insert complaint
    const insertSql = `
      INSERT INTO complaints (
        complaint_id, title, description, category_id, category_key,
        student_id, block_id, room_id, is_anonymous, status,
        priority_score, predicted_hours, predicted_resolution_at, sla_hours,
        affected_count, ai_confidence, ai_suggested_category
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Submitted', $10, $11, $12, $13, 1, $14, $15)
      RETURNING *;
    `;
    const insertRes = await db.query(insertSql, [
      complaintId,
      title,
      description,
      resolvedCatId,
      resolvedCatKey,
      studentId,
      blockId,
      roomId,
      isAnon,
      priorityScore,
      predictedHours,
      predictedResolutionAt,
      slaHours,
      aiConfidence,
      aiSuggestedCat,
    ]);
    const complaint = insertRes.rows[0];

    // Handle uploaded photos (up to 4)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.query(
          `INSERT INTO complaint_images (complaint_id, image_url, image_type, caption)
           VALUES ($1, $2, 'before', $3)`,
          [complaint.id, file.filename, file.originalname]
        );
      }
    }

    // Initial Status Log
    await db.query(
      `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
       VALUES ($1, NULL, 'Submitted', $2, $3, $4, $5)`,
      [complaint.id, req.user.id, req.user.role, req.user.fullName || 'Student', 'Complaint lodged successfully.']
    );

    // Notify Wardens of this block
    const wardensRes = await db.query(
      `SELECT u.id as user_id FROM wardens w JOIN users u ON u.id = w.user_id WHERE w.block_id = $1`,
      [blockId]
    );
    for (const w of wardensRes.rows) {
      await notify({
        userId: w.user_id,
        type: 'complaint_submitted',
        title: `New Ticket: ${complaint.complaint_id}`,
        message: `${title} (${resolvedCatKey}) lodged in Block. Priority: ${priorityScore}`,
        link: `/warden/complaints/${complaint.id}`,
      });
    }

    // Audit log
    await audit({
      actorId: req.user.id,
      action: 'SUBMIT_COMPLAINT',
      entity: 'complaints',
      entityId: complaint.id,
      details: { complaintId: complaint.complaint_id, category: resolvedCatKey, isAnonymous: isAnon },
    });

    return res.status(201).json({
      success: true,
      data: {
        complaint,
        prediction,
        message: `Complaint ${complaint.complaint_id} lodged successfully. Expected turnaround: ~${predictedHours}h.`,
      },
      error: null,
    });
  } catch (err) {
    console.error('[SUBMIT-COMPLAINT-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to submit complaint.', code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 2. List Complaints with Role Scoping & Dynamic Sorting
 * GET /api/v1/complaints
 */
async function listComplaints(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      blockId,
      roomId,
      isOverdue,
      isRecurring,
      search,
      sortBy = 'priority', // 'priority' | 'newest' | 'waiting'
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const conditions = [];
    const params = [];

    // Role-based scoping:
    // Students only see their block's open complaints (for upvoting) or their own
    if (req.user.role === 'student') {
      const studentBlockId = req.user.blockId || req.user.student?.block_id;
      const studentId = req.user.student?.id || req.user.studentId;

      params.push(studentBlockId);
      const bIdx = params.length;
      params.push(studentId);
      const sIdx = params.length;

      // Allow seeing own complaints, or public open complaints in same block
      conditions.push(`(c.student_id = $${sIdx} OR (c.block_id = $${bIdx} AND c.is_anonymous = FALSE))`);
    } else if (req.user.role === 'warden') {
      // Scoped to warden block if specified in req.scope or req.user.blockId
      const wardenBlockId = req.scope?.blockId || req.user.blockId;
      if (wardenBlockId) {
        params.push(wardenBlockId);
        conditions.push(`c.block_id = $${params.length}`);
      }
    } else if (req.user.role === 'maintenance') {
      // Maintenance technician can see all or assigned tasks
      if (req.query.assignedOnly === 'true') {
        const staffRes = await db.query('SELECT id FROM staff_profiles WHERE user_id = $1', [req.user.id]);
        if (staffRes.rows.length > 0) {
          params.push(staffRes.rows[0].id);
          conditions.push(`c.assigned_staff_id = $${params.length}`);
        }
      }
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`c.category_key = $${params.length}`);
    }

    if (blockId && req.user.role === 'admin') {
      params.push(parseInt(blockId, 10));
      conditions.push(`c.block_id = $${params.length}`);
    }

    if (roomId) {
      params.push(parseInt(roomId, 10));
      conditions.push(`c.room_id = $${params.length}`);
    }

    if (isOverdue === 'true') {
      conditions.push(`(c.is_overdue = TRUE OR (c.status NOT IN ('Resolved', 'Closed') AND CURRENT_TIMESTAMP > c.predicted_resolution_at))`);
    }

    if (isRecurring === 'true') {
      conditions.push(`c.is_recurring = TRUE`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const sIdx = params.length;
      conditions.push(`(c.title ILIKE $${sIdx} OR c.description ILIKE $${sIdx} OR c.complaint_id ILIKE $${sIdx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderByClause = 'ORDER BY c.priority_score DESC, c.created_at ASC';
    if (sortBy === 'newest') orderByClause = 'ORDER BY c.created_at DESC';
    if (sortBy === 'waiting') orderByClause = 'ORDER BY c.created_at ASC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM complaints c ${whereClause}`;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Query records
    const querySql = `
      SELECT 
        c.*,
        b.name as block_name,
        b.code as block_code,
        r.room_number,
        r.floor as room_floor,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.laminated_id_number as student_lam_id,
        s.diet_preference as student_diet_preference,
        s.allergies as student_allergies,
        st.full_name as assigned_staff_name,
        st.department as assigned_staff_dept,
        COALESCE(v.vote_count, 0) as vote_count,
        COALESCE(img.image_count, 0) as image_count
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      JOIN students s ON s.id = c.student_id
      LEFT JOIN staff_profiles st ON st.id = c.assigned_staff_id
      LEFT JOIN (SELECT complaint_id, COUNT(*) as vote_count FROM complaint_votes GROUP BY complaint_id) v ON v.complaint_id = c.id
      LEFT JOIN (SELECT complaint_id, COUNT(*) as image_count FROM complaint_images GROUP BY complaint_id) img ON img.complaint_id = c.id
      ${whereClause}
      ${orderByClause}
      LIMIT ${Math.min(100, parseInt(limit, 10))} OFFSET ${offset};
    `;

    const resData = await db.query(querySql, params);

    // Sanitize anonymous complaints for general students
    const sanitized = resData.rows.map(row => {
      // Recompute real-time priority score dynamically
      const dynamicScore = calculatePriorityScore({
        categoryKey: row.category_key,
        createdAt: row.created_at,
        affectedCount: row.affected_count,
        slaHours: row.sla_hours,
      });

      const isRequesterWardenOrAdmin = ['warden', 'admin'].includes(req.user.role);
      const isOwner = req.user.student && req.user.student.id === row.student_id;

      if (row.is_anonymous && !isRequesterWardenOrAdmin && !isOwner) {
        return {
          ...row,
          priority_score: dynamicScore,
          student_name: 'Anonymous Resident',
          student_roll: 'REDACTED',
          student_lam_id: 'REDACTED',
          room_number: 'Confidential',
        };
      }

      return {
        ...row,
        priority_score: dynamicScore,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        complaints: sanitized,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      error: null,
    });
  } catch (err) {
    console.error('[LIST-COMPLAINTS-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to list complaints.', code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 3. Student Personal Complaints History
 * GET /api/v1/complaints/my
 */
async function getMyComplaints(req, res) {
  try {
    let studentId = req.user.student?.id;
    if (!studentId) {
      const stRes = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (stRes.rows.length > 0) studentId = stRes.rows[0].id;
    }

    if (!studentId) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Student profile not found.', code: 'STUDENT_NOT_FOUND' },
      });
    }

    const querySql = `
      SELECT c.*, b.name as block_name, r.room_number,
             cf.rating as feedback_rating, cf.comments as feedback_comments
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = c.id
      WHERE c.student_id = $1
      ORDER BY c.created_at DESC;
    `;
    const resData = await db.query(querySql, [studentId]);

    return res.status(200).json({
      success: true,
      data: { complaints: resData.rows },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 4. Export getComplaintsByRoom(roomId)
 * GET /api/v1/complaints/room/:roomId
 */
async function getComplaintsByRoomHandler(req, res) {
  try {
    const { roomId } = req.params;
    const complaints = await getComplaintsByRoom(roomId);
    return res.status(200).json({
      success: true,
      data: { complaints },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

async function getComplaintsByRoom(roomId) {
  const parsedRoomId = parseInt(roomId, 10);
  if (!parsedRoomId) return [];

  const sql = `
    SELECT c.id, c.complaint_id, c.title, c.category_key, c.status,
           c.priority_score, c.predicted_hours, c.created_at,
           s.full_name as student_name
    FROM complaints c
    JOIN students s ON s.id = c.student_id
    WHERE c.room_id = $1
      AND c.status NOT IN ('Closed')
    ORDER BY c.created_at DESC;
  `;
  const res = await db.query(sql, [parsedRoomId]);
  return res.rows;
}

/**
 * 5. Single Complaint Details with Timeline Tracker, Images & Similar Suggestions
 * GET /api/v1/complaints/:id
 */
async function getComplaintDetails(req, res) {
  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(id);
    const whereField = isNumeric ? 'c.id' : 'c.complaint_id';

    const sql = `
      SELECT 
        c.*,
        b.name as block_name,
        r.room_number,
        r.floor as room_floor,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.laminated_id_number as student_lam_id,
        s.diet_preference as student_diet_preference,
        s.allergies as student_allergies,
        s.phone as student_phone,
        u.email as student_email,
        st.id as staff_profile_id,
        st.full_name as staff_name,
        st.department as staff_dept,
        st.designation as staff_designation,
        st.phone as staff_phone,
        cf.rating as feedback_rating,
        cf.comments as feedback_comments,
        cf.created_at as feedback_created_at
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      JOIN students s ON s.id = c.student_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN staff_profiles st ON st.id = c.assigned_staff_id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = c.id
      WHERE ${whereField} = $1;
    `;
    const complaintRes = await db.query(sql, [isNumeric ? parseInt(id, 10) : id]);
    if (complaintRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Complaint not found.', code: 'NOT_FOUND' },
      });
    }

    const complaint = complaintRes.rows[0];

    // Images
    const imgRes = await db.query(
      `SELECT * FROM complaint_images WHERE complaint_id = $1 ORDER BY created_at ASC`,
      [complaint.id]
    );

    // Status Timeline Logs
    const logRes = await db.query(
      `SELECT * FROM status_logs WHERE complaint_id = $1 ORDER BY created_at ASC`,
      [complaint.id]
    );

    // Check if current user has upvoted
    let hasVoted = false;
    if (req.user.role === 'student') {
      const studentId = req.user.student?.id || req.user.studentId;
      if (studentId) {
        const vRes = await db.query(
          `SELECT 1 FROM complaint_votes WHERE complaint_id = $1 AND student_id = $2`,
          [complaint.id, studentId]
        );
        hasVoted = vRes.rows.length > 0;
      }
    }

    // Similar complaints suggestion (for merge detection)
    const similarComplaints = await findSimilarComplaints({
      blockId: complaint.block_id,
      categoryKey: complaint.category_key,
      title: complaint.title,
      description: complaint.description,
      excludeId: complaint.id,
      windowDays: 7,
    });

    // Anonymity filter
    const isWardenOrAdmin = ['warden', 'admin'].includes(req.user.role);
    const isOwner = req.user.student && req.user.student.id === complaint.student_id;

    if (complaint.is_anonymous && !isWardenOrAdmin && !isOwner) {
      complaint.student_name = 'Anonymous Student';
      complaint.student_roll = 'HIDDEN';
      complaint.student_lam_id = 'HIDDEN';
      complaint.student_phone = 'HIDDEN';
      complaint.student_email = 'HIDDEN';
    }

    return res.status(200).json({
      success: true,
      data: {
        complaint,
        images: imgRes.rows,
        timeline: logRes.rows,
        hasVoted,
        similarComplaints,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET-COMPLAINT-DETAILS-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 6. "I'm Also Affected" Upvote Toggle
 * POST /api/v1/complaints/:id/vote
 */
async function toggleComplaintVote(req, res) {
  try {
    const { id } = req.params;
    let studentId = req.user.student?.id;
    if (!studentId) {
      const st = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (st.rows.length > 0) studentId = st.rows[0].id;
    }

    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only students can upvote complaints.', code: 'FORBIDDEN' },
      });
    }

    // Check existing vote
    const checkSql = `SELECT id FROM complaint_votes WHERE complaint_id = $1 AND student_id = $2`;
    const checkRes = await db.query(checkSql, [id, studentId]);

    let voted = false;
    if (checkRes.rows.length > 0) {
      // Unvote
      await db.query(`DELETE FROM complaint_votes WHERE id = $1`, [checkRes.rows[0].id]);
      await db.query(`UPDATE complaints SET affected_count = GREATEST(1, affected_count - 1) WHERE id = $1`, [id]);
      voted = false;
    } else {
      // Upvote
      await db.query(
        `INSERT INTO complaint_votes (complaint_id, student_id) VALUES ($1, $2)`,
        [id, studentId]
      );
      await db.query(`UPDATE complaints SET affected_count = affected_count + 1 WHERE id = $1`, [id]);
      voted = true;
    }

    // Recalculate dynamic priority score
    const compRes = await db.query(`SELECT * FROM complaints WHERE id = $1`, [id]);
    const complaint = compRes.rows[0];
    const newScore = calculatePriorityScore({
      categoryKey: complaint.category_key,
      createdAt: complaint.created_at,
      affectedCount: complaint.affected_count,
      slaHours: complaint.sla_hours,
    });
    await db.query(`UPDATE complaints SET priority_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newScore, id]);

    return res.status(200).json({
      success: true,
      data: {
        voted,
        affectedCount: complaint.affected_count,
        priorityScore: newScore,
        message: voted ? 'Upvoted: You added your voice to this issue.' : 'Upvote removed.',
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 7. Update Status (Submitted -> Assigned -> In Progress -> Resolved -> Closed -> Reopened)
 * POST /api/v1/complaints/:id/status
 */
async function updateComplaintStatus(req, res) {
  try {
    const { id } = req.params;
    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: parse.error.errors[0].message, code: 'VALIDATION_ERROR' },
      });
    }

    const { status, notes } = parse.data;

    const compRes = await db.query(
      `SELECT c.*, s.user_id as student_user_id, s.full_name as student_name
       FROM complaints c
       JOIN students s ON s.id = c.student_id
       WHERE c.id = $1`,
      [id]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Complaint not found.', code: 'NOT_FOUND' },
      });
    }

    const complaint = compRes.rows[0];
    const fromStatus = complaint.status;

    let updateExtra = '';
    const updateParams = [status, id];

    if (status === 'Resolved') {
      updateExtra = ', resolved_at = CURRENT_TIMESTAMP';
    } else if (status === 'Closed') {
      updateExtra = ', closed_at = CURRENT_TIMESTAMP';
    }

    await db.query(
      `UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP ${updateExtra} WHERE id = $2`,
      updateParams
    );

    // Status Log Entry
    await db.query(
      `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [complaint.id, fromStatus, status, req.user.id, req.user.role, req.user.fullName, notes || `Status changed to ${status}`]
    );

    // Notify Student
    await notify({
      userId: complaint.student_user_id,
      type: 'complaint_status_change',
      title: `Status: ${complaint.complaint_id} is now ${status}`,
      message: notes || `Your complaint status has moved from ${fromStatus} to ${status}.`,
      link: `/student/complaints/${complaint.id}`,
    });

    // Special event: On resolution, trigger feedback request
    if (status === 'Resolved') {
      await notify({
        userId: complaint.student_user_id,
        type: 'feedback_request',
        title: `Resolution Rating: ${complaint.complaint_id}`,
        message: 'Your maintenance issue has been resolved. Please rate the service quality and leave comments.',
        link: `/student/complaints/${complaint.id}?feedback=true`,
      });
    }

    await audit({
      actorId: req.user.id,
      action: 'UPDATE_COMPLAINT_STATUS',
      entity: 'complaints',
      entityId: complaint.id,
      details: { fromStatus, toStatus: status, notes },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: complaint.id,
        complaintId: complaint.complaint_id,
        fromStatus,
        toStatus: status,
        message: `Status successfully updated to ${status}.`,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 8. Assign Complaint to Staff with Note
 * POST /api/v1/complaints/:id/assign
 */
async function assignStaff(req, res) {
  try {
    const { id } = req.params;
    const parse = assignStaffSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: parse.error.errors[0].message, code: 'VALIDATION_ERROR' },
      });
    }

    const { staffId, note } = parse.data;

    // Verify staff exists and is active
    const staffRes = await db.query(
      `SELECT sp.*, u.id as user_id, u.email FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1`,
      [staffId]
    );
    if (staffRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Staff personnel profile not found.', code: 'STAFF_NOT_FOUND' },
      });
    }
    const staff = staffRes.rows[0];

    const compRes = await db.query(
      `SELECT c.*, s.user_id as student_user_id FROM complaints c JOIN students s ON s.id = c.student_id WHERE c.id = $1`,
      [id]
    );
    if (compRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Complaint not found.', code: 'NOT_FOUND' },
      });
    }
    const complaint = compRes.rows[0];

    // Assign and transition status to 'Assigned'
    await db.query(
      `UPDATE complaints
       SET assigned_staff_id = $1,
           assigned_note = $2,
           assigned_at = CURRENT_TIMESTAMP,
           status = CASE WHEN status = 'Submitted' THEN 'Assigned' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [staffId, note || null, id]
    );

    // Status log
    await db.query(
      `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
       VALUES ($1, $2, 'Assigned', $3, $4, $5, $6)`,
      [
        complaint.id,
        complaint.status,
        req.user.id,
        req.user.role,
        req.user.fullName,
        `Assigned to ${staff.full_name} (${staff.designation || staff.department}). Note: ${note || 'None'}`,
      ]
    );

    // Notify assigned staff
    await notify({
      userId: staff.user_id,
      type: 'task_assigned',
      title: `Task Assigned: ${complaint.complaint_id}`,
      message: `You have been assigned to: ${complaint.title}. Priority: ${complaint.priority_score}.`,
      link: `/staff/tasks/${complaint.id}`,
    });

    // Notify student
    await notify({
      userId: complaint.student_user_id,
      type: 'complaint_assigned',
      title: `Staff Assigned: ${complaint.complaint_id}`,
      message: `Technician ${staff.full_name} has been assigned to resolve your issue.`,
      link: `/student/complaints/${complaint.id}`,
    });

    await audit({
      actorId: req.user.id,
      action: 'ASSIGN_COMPLAINT_STAFF',
      entity: 'complaints',
      entityId: complaint.id,
      details: { staffId, staffName: staff.full_name, note },
    });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaint_id,
        assignedStaff: staff.full_name,
        message: `Assigned to ${staff.full_name} successfully.`,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 9. Maintenance Staff View: Resolve Task with After-Photo & Note
 * POST /api/v1/complaints/:id/resolve
 */
async function resolveComplaint(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    if (!notes || notes.trim().length < 3) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Completion / resolution notes are mandatory.', code: 'VALIDATION_ERROR' },
      });
    }

    const compRes = await db.query(
      `SELECT c.*, s.user_id as student_user_id FROM complaints c JOIN students s ON s.id = c.student_id WHERE c.id = $1`,
      [id]
    );
    if (compRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Complaint not found.', code: 'NOT_FOUND' },
      });
    }
    const complaint = compRes.rows[0];

    const afterPhotoUrl = req.file ? req.file.filename : null;

    // Save after-photo attachment if uploaded
    if (afterPhotoUrl) {
      await db.query(
        `INSERT INTO complaint_images (complaint_id, image_url, image_type, caption)
         VALUES ($1, $2, 'after', 'Work Completion Evidence Photo')`,
        [complaint.id, afterPhotoUrl]
      );
    }

    // Calculate empirical resolution hours from submission to resolution
    const createdTime = new Date(complaint.created_at).getTime();
    const resolvedTime = Date.now();
    const resolutionHours = Number(Math.max(0.2, (resolvedTime - createdTime) / (3600 * 1000)).toFixed(2));

    // Update complaint status to Resolved
    await db.query(
      `UPDATE complaints
       SET status = 'Resolved',
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Save to resolution_history (feeds the AI historical average predictor!)
    await db.query(
      `INSERT INTO resolution_history (complaint_id, category_key, assigned_staff_id, resolution_hours, resolution_notes, after_photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [complaint.id, complaint.category_key, complaint.assigned_staff_id, resolutionHours, notes, afterPhotoUrl]
    );

    // Status log
    await db.query(
      `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
       VALUES ($1, $2, 'Resolved', $3, $4, $5, $6)`,
      [complaint.id, complaint.status, req.user.id, req.user.role, req.user.fullName, `Resolution Notes: ${notes}`]
    );

    // Notify Student to rate resolution
    await notify({
      userId: complaint.student_user_id,
      type: 'feedback_request',
      title: `Issue Resolved: ${complaint.complaint_id}`,
      message: `Your complaint was completed in ${resolutionHours}h. Tap here to rate the repair work.`,
      link: `/student/complaints/${complaint.id}?feedback=true`,
    });

    await audit({
      actorId: req.user.id,
      action: 'RESOLVE_COMPLAINT',
      entity: 'complaints',
      entityId: complaint.id,
      details: { resolutionHours, notes, afterPhoto: !!afterPhotoUrl },
    });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaint_id,
        resolutionHours,
        status: 'Resolved',
        message: 'Complaint resolved and completion record logged.',
      },
      error: null,
    });
  } catch (err) {
    console.error('[RESOLVE-COMPLAINT-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 10. Student Feedback (Star Rating & Comments)
 * POST /api/v1/complaints/:id/feedback
 */
async function submitComplaintFeedback(req, res) {
  try {
    const { id } = req.params;
    let studentId = req.user.student?.id;
    if (!studentId) {
      const st = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (st.rows.length > 0) studentId = st.rows[0].id;
    }

    const parse = feedbackSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: parse.error.errors[0].message, code: 'VALIDATION_ERROR' },
      });
    }

    const { rating, comments } = parse.data;

    // Verify complaint ownership
    const compRes = await db.query(`SELECT * FROM complaints WHERE id = $1`, [id]);
    if (compRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Complaint not found.', code: 'NOT_FOUND' },
      });
    }

    const complaint = compRes.rows[0];
    if (complaint.student_id !== studentId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'You can only leave feedback on your own complaints.', code: 'FORBIDDEN' },
      });
    }

    // Upsert feedback
    await db.query(
      `INSERT INTO complaint_feedback (complaint_id, student_id, rating, comments)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (complaint_id)
       DO UPDATE SET rating = EXCLUDED.rating, comments = EXCLUDED.comments`,
      [complaint.id, studentId, rating, comments || '']
    );

    // Auto-close ticket once feedback is given if currently Resolved
    if (complaint.status === 'Resolved') {
      await db.query(
        `UPDATE complaints SET status = 'Closed', closed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [complaint.id]
      );
      await db.query(
        `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
         VALUES ($1, 'Resolved', 'Closed', $2, 'student', $3, 'Student feedback submitted; ticket closed.')`,
        [complaint.id, req.user.id, req.user.fullName]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaint_id,
        rating,
        message: 'Thank you! Your feedback helps us improve campus hostel operations.',
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 11. Live AI Preview Category & Predicted Turnaround
 * POST /api/v1/complaints/classify-ai
 */
async function classifyAiPreview(req, res) {
  try {
    const { title = '', description = '' } = req.body;
    const aiResult = classifyComplaintText(title, description);
    const prediction = await predictResolutionHours(aiResult.categoryKey);
    const catRow = await getCategoryByKey(aiResult.categoryKey);

    return res.status(200).json({
      success: true,
      data: {
        categoryKey: aiResult.categoryKey,
        categoryName: catRow ? catRow.name : aiResult.categoryKey,
        confidence: aiResult.confidence,
        matchedKeywords: aiResult.matchedKeywords,
        isFallback: aiResult.isFallback,
        predictedHours: prediction.predictedHours,
        slaHours: catRow ? catRow.sla_hours : (CATEGORY_SLA_HOURS[aiResult.categoryKey] || 24),
        predictionSource: prediction.source,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 12. Staff Auto-Suggestion Ranked by Specialisation & Lowest Open Tasks
 * GET /api/v1/complaints/staff-suggestions
 */
async function getStaffSuggestions(req, res) {
  try {
    const { category } = req.query;
    const targetCat = (category || '').toLowerCase();

    // Query active maintenance staff
    const staffRes = await db.query(
      `SELECT sp.*, u.email, u.phone as contact_phone
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.is_active = TRUE AND u.status = 'active'
       ORDER BY sp.full_name ASC`
    );

    // Query open task count for each staff
    const tasksRes = await db.query(
      `SELECT assigned_staff_id, COUNT(*) as open_tasks
       FROM complaints
       WHERE status IN ('Assigned', 'In Progress')
         AND assigned_staff_id IS NOT NULL
       GROUP BY assigned_staff_id`
    );
    const taskCountMap = {};
    for (const r of tasksRes.rows) {
      taskCountMap[r.assigned_staff_id] = parseInt(r.open_tasks, 10);
    }

    // Rank staff:
    // 1. Exact match on specialisation
    // 2. Open task load ascending
    const ranked = staffRes.rows.map(st => {
      const specs = typeof st.specialisations === 'string'
        ? JSON.parse(st.specialisations || '[]')
        : (st.specialisations || []);
      
      const openTasks = taskCountMap[st.id] || 0;
      
      // Match keywords in specialisation with category
      let isSpecialist = false;
      const lowerSpecs = specs.map(s => s.toLowerCase()).join(' ');
      if (
        (targetCat === 'plumbing' && lowerSpecs.includes('plumb')) ||
        (targetCat === 'electrical' && (lowerSpecs.includes('electric') || lowerSpecs.includes('power'))) ||
        (targetCat === 'furniture' && (lowerSpecs.includes('carpenter') || lowerSpecs.includes('furniture'))) ||
        (targetCat === 'internet' && (lowerSpecs.includes('wi-fi') || lowerSpecs.includes('lan') || lowerSpecs.includes('network'))) ||
        (targetCat === 'cleanliness' && (lowerSpecs.includes('hygiene') || lowerSpecs.includes('clean'))) ||
        (targetCat === 'mess' && (st.department?.toLowerCase().includes('mess') || st.department?.toLowerCase().includes('dining'))) ||
        (targetCat === 'security' && (st.department?.toLowerCase().includes('security')))
      ) {
        isSpecialist = true;
      }

      return {
        id: st.id,
        userId: st.user_id,
        fullName: st.full_name,
        department: st.department,
        designation: st.designation,
        email: st.email,
        phone: st.contact_phone,
        specialisations: specs,
        isSpecialist,
        openTasks,
      };
    });

    ranked.sort((a, b) => {
      if (a.isSpecialist && !b.isSpecialist) return -1;
      if (!a.isSpecialist && b.isSpecialist) return 1;
      return a.openTasks - b.openTasks;
    });

    return res.status(200).json({
      success: true,
      data: { suggestions: ranked },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 13. Recurring Hotspots List
 * GET /api/v1/complaints/hotspots
 */
async function getRecurringHotspots(req, res) {
  try {
    const wardenBlockId = req.scope?.blockId || req.user.blockId;
    let whereClause = 'WHERE rf.is_active = TRUE';
    const params = [];

    if (wardenBlockId && req.user.role === 'warden') {
      params.push(wardenBlockId);
      whereClause += ` AND rf.block_id = $${params.length}`;
    }

    const sql = `
      SELECT rf.*, b.name as block_name, b.code as block_code, r.room_number
      FROM recurring_issue_flags rf
      JOIN blocks b ON b.id = rf.block_id
      LEFT JOIN rooms r ON r.id = rf.room_id
      ${whereClause}
      ORDER BY rf.occurrence_count DESC, rf.flagged_at DESC
      LIMIT 20;
    `;
    const result = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      data: { hotspots: result.rows },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 14. Merge Similar Complaints into Parent
 * POST /api/v1/complaints/:id/merge
 */
async function mergeComplaints(req, res) {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    if (!parentId || parentId == id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Valid distinct parent complaint ID required for merging.', code: 'INVALID_PARENT' },
      });
    }

    const parentRes = await db.query('SELECT * FROM complaints WHERE id = $1', [parentId]);
    if (parentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Parent complaint not found.', code: 'PARENT_NOT_FOUND' },
      });
    }
    const parent = parentRes.rows[0];

    // Mark current as merged into parent
    await db.query(
      `UPDATE complaints
       SET parent_complaint_id = $1,
           status = 'Closed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [parentId, id]
    );

    // Bump affected count on parent
    await db.query(
      `UPDATE complaints
       SET affected_count = affected_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [parentId]
    );

    // Recalculate parent priority score
    const newScore = calculatePriorityScore({
      categoryKey: parent.category_key,
      createdAt: parent.created_at,
      affectedCount: parent.affected_count + 1,
      slaHours: parent.sla_hours,
    });
    await db.query(`UPDATE complaints SET priority_score = $1 WHERE id = $2`, [newScore, parentId]);

    // Status log on child
    await db.query(
      `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_id, actor_role, actor_name, notes)
       VALUES ($1, 'Submitted', 'Closed', $2, $3, $4, $5)`,
      [id, req.user.id, req.user.role, req.user.fullName, `Merged into parent ticket #${parent.complaint_id}`]
    );

    return res.status(200).json({
      success: true,
      data: {
        mergedId: id,
        parentId,
        parentComplaintId: parent.complaint_id,
        newPriorityScore: newScore,
        message: `Complaint successfully merged into #${parent.complaint_id}.`,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 15. Categories Management (Admin / Global)
 * GET /api/v1/complaints/categories
 */
async function getCategories(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM complaint_categories ORDER BY severity_weight DESC, name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { categories: result.rows },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * Admin: Add Category
 * POST /api/v1/complaints/categories
 */
async function addCategory(req, res) {
  try {
    const parse = categorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: parse.error.errors[0].message, code: 'VALIDATION_ERROR' },
      });
    }

    const { name, key, department, severityWeight, slaHours, description } = parse.data;

    const insertSql = `
      INSERT INTO complaint_categories (name, key, department, severity_weight, sla_hours, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (name) DO UPDATE SET 
        key = EXCLUDED.key,
        department = EXCLUDED.department,
        severity_weight = EXCLUDED.severity_weight,
        sla_hours = EXCLUDED.sla_hours,
        description = EXCLUDED.description
      RETURNING *;
    `;
    const result = await db.query(insertSql, [name, key, department, severityWeight, slaHours, description || '']);

    return res.status(201).json({
      success: true,
      data: { category: result.rows[0], message: `Category ${name} configured.` },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

module.exports = {
  submitComplaint,
  listComplaints,
  getMyComplaints,
  getComplaintsByRoomHandler,
  getComplaintsByRoom,
  getComplaintDetails,
  toggleComplaintVote,
  updateComplaintStatus,
  assignStaff,
  resolveComplaint,
  submitComplaintFeedback,
  classifyAiPreview,
  getStaffSuggestions,
  getRecurringHotspots,
  mergeComplaints,
  getCategories,
  addCategory,
};
