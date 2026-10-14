const db = require('../../db');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');
const { generateUniqueOutpassNumber } = require('../../services/outpassId');
const { generateQrDataUrl } = require('../../services/qr');

/**
 * 1. Request an Outpass (Student)
 * POST /api/v1/outpass
 */
async function requestOutpass(req, res) {
  try {
    const student = req.user.student;
    let studentId = student?.id || req.user.studentId;
    let studentDetails = student;

    if (!studentDetails) {
      const stRes = await db.query('SELECT * FROM students WHERE user_id = $1', [req.user.id]);
      if (stRes.rows.length > 0) {
        studentDetails = stRes.rows[0];
        studentId = studentDetails.id;
      }
    }

    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only registered students can apply for an outpass.', code: 'FORBIDDEN' },
      });
    }

    const { type, reason, destination, outTime, expectedReturnTime } = req.body;

    if (!type || !reason || !destination || !outTime || !expectedReturnTime) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Type, reason, destination, out time, and expected return time are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const outDate = new Date(outTime);
    const returnDate = new Date(expectedReturnTime);

    if (returnDate <= outDate) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Expected return time must be strictly after out time.', code: 'INVALID_DATES' },
      });
    }

    // Curfew check for day pass: Must return by 21:30 (9:30 PM) on the same day
    if (type === 'day') {
      const returnHour = returnDate.getHours();
      const returnMin = returnDate.getMinutes();
      if (returnHour > 21 || (returnHour === 21 && returnMin > 30)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { message: 'Day outpasses must return before campus curfew of 9:30 PM. Please apply for a night or home pass.', code: 'CURFEW_BREACH' },
        });
      }
    }

    // Monthly Quota Check: Max 4 regular passes per calendar month (emergency is exempted)
    if (type !== 'emergency') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const countRes = await db.query(
        `SELECT COUNT(*) as month_count
         FROM outpasses
         WHERE student_id = $1
           AND type != 'emergency'
           AND status NOT IN ('Rejected', 'Cancelled')
           AND created_at >= $2`,
        [studentId, monthStart]
      );
      const monthCount = parseInt(countRes.rows[0].month_count, 10);
      const MAX_MONTHLY_PASSES = 4;

      if (monthCount >= MAX_MONTHLY_PASSES) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: `Monthly outpass quota exceeded (${monthCount}/${MAX_MONTHLY_PASSES} used this month). Only emergency outpasses may be granted.`,
            code: 'QUOTA_EXCEEDED',
          },
        });
      }
    }

    const initialNumber = `REQ-${Date.now().toString().slice(-6)}`;
    const blockId = studentDetails.block_id || req.user.blockId;
    const roomId = studentDetails.room_id || req.user.roomId;
    const parentConsentStatus = type === 'emergency' ? 'emergency_waived' : 'Pending';

    const insertSql = `
      INSERT INTO outpasses (
        outpass_number, student_id, block_id, room_id, type, reason, destination,
        out_time, expected_return_time, status, parent_name, parent_phone,
        parent_consent_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Requested', $10, $11, $12)
      RETURNING *;
    `;

    const insertRes = await db.query(insertSql, [
      initialNumber,
      studentId,
      blockId,
      roomId,
      type,
      reason,
      destination,
      outDate,
      returnDate,
      studentDetails.parent_name,
      studentDetails.parent_phone,
      parentConsentStatus,
    ]);

    const outpass = insertRes.rows[0];

    // Notify block wardens
    const wardensRes = await db.query(
      `SELECT u.id as user_id FROM wardens w JOIN users u ON u.id = w.user_id WHERE w.block_id = $1`,
      [blockId]
    );

    for (const w of wardensRes.rows) {
      await notify({
        userId: w.user_id,
        type: type === 'emergency' ? 'emergency_outpass_alert' : 'outpass_requested',
        title: `${type === 'emergency' ? '🚨 EMERGENCY' : 'New'} Outpass Request: ${studentDetails.full_name}`,
        message: `${studentDetails.full_name} (${type.toUpperCase()}) to ${destination}. Out: ${outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Parent: ${studentDetails.parent_name} (${studentDetails.parent_phone}).`,
        link: `/warden/outpass/${outpass.id}`,
      });
    }

    await audit({
      actorId: req.user.id,
      action: 'REQUEST_OUTPASS',
      entity: 'outpasses',
      entityId: outpass.id,
      details: { type, destination, outTime, expectedReturnTime },
    });

    return res.status(201).json({
      success: true,
      data: {
        outpass,
        message: type === 'emergency'
          ? 'Emergency outpass submitted. Dispatched to Warden with priority override.'
          : 'Outpass request lodged. Warden will call your registered parent contact for verification.',
      },
      error: null,
    });
  } catch (err) {
    console.error('[REQUEST-OUTPASS-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to request outpass.', code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 2. Log Parent Call by Warden (Prerequisite for Approval)
 * POST /api/v1/outpass/:id/call-log
 */
async function logParentCall(req, res) {
  try {
    const { id } = req.params;
    const { contactPerson, phoneDialed, responseStatus, notes } = req.body;

    if (!contactPerson || !phoneDialed || !responseStatus) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Contact person, phone dialed, and call response status are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const opRes = await db.query(`SELECT * FROM outpasses WHERE id = $1`, [id]);
    if (opRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Outpass not found.', code: 'NOT_FOUND' },
      });
    }
    const outpass = opRes.rows[0];

    // Insert call log
    const callLogSql = `
      INSERT INTO outpass_call_logs (outpass_id, warden_id, contact_person, phone_dialed, response_status, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const callRes = await db.query(callLogSql, [
      outpass.id,
      req.user.id,
      contactPerson,
      phoneDialed,
      responseStatus,
      notes || null,
    ]);

    // Update outpass status
    await db.query(
      `UPDATE outpasses
       SET parent_consent_status = $1,
           status = CASE WHEN status = 'Requested' THEN 'Parent Contacted' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [responseStatus, outpass.id]
    );

    await audit({
      actorId: req.user.id,
      action: 'LOG_PARENT_CALL',
      entity: 'outpasses',
      entityId: outpass.id,
      details: { contactPerson, phoneDialed, responseStatus, notes },
    });

    return res.status(200).json({
      success: true,
      data: {
        callLog: callRes.rows[0],
        message: 'Parent call logged successfully. You may now approve or decline this outpass.',
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
 * 3. Warden Decision (Approve or Reject Outpass)
 * POST /api/v1/outpass/:id/decision
 */
async function approveOrRejectOutpass(req, res) {
  try {
    const { id } = req.params;
    const { action, rejectionReason, wardenNotes } = req.body; // 'Approved' | 'Rejected'

    if (!['Approved', 'Rejected'].includes(action)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Action must be Approved or Rejected.', code: 'INVALID_ACTION' },
      });
    }

    const opRes = await db.query(
      `SELECT o.*, s.user_id as student_user_id, s.full_name as student_name
       FROM outpasses o
       JOIN students s ON s.id = o.student_id
       WHERE o.id = $1`,
      [id]
    );
    if (opRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Outpass not found.', code: 'NOT_FOUND' },
      });
    }
    const outpass = opRes.rows[0];

    // Enforce Rule: Parental verification call mandatory for approval unless Emergency
    if (action === 'Approved' && outpass.type !== 'emergency') {
      const callCheck = await db.query(
        `SELECT COUNT(*) as call_count FROM outpass_call_logs WHERE outpass_id = $1`,
        [id]
      );
      const callCount = parseInt(callCheck.rows[0].call_count, 10);
      if (callCount === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Parental verification call must be logged before approving regular outpass. Record the parent conversation first.',
            code: 'PARENT_CALL_REQUIRED',
          },
        });
      }
    }

    if (action === 'Approved') {
      // Generate formal readable outpass number: OUT-2026-000101
      const outpassNumber = await generateUniqueOutpassNumber();

      // Payload for digital QR pass
      const qrPayload = JSON.stringify({
        outpassNumber,
        studentName: outpass.student_name,
        type: outpass.type,
        destination: outpass.destination,
        validUntil: outpass.expected_return_time,
        timestamp: Date.now(),
      });
      const qrCodeData = generateQrDataUrl(qrPayload, 220);

      await db.query(
        `UPDATE outpasses
         SET status = 'Approved',
             outpass_number = $1,
             qr_code_data = $2,
             approved_by = $3,
             approved_at = CURRENT_TIMESTAMP,
             warden_notes = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [outpassNumber, qrCodeData, req.user.id, wardenNotes || null, id]
      );

      // Notify student with QR code ready alert
      await notify({
        userId: outpass.student_user_id,
        type: 'outpass_approved',
        title: `Outpass Approved: ${outpassNumber}`,
        message: `Your ${outpass.type} pass to ${outpass.destination} has been approved by Warden. Digital Gate QR pass is ready for check-out.`,
        link: `/student/outpass`,
      });

      await audit({
        actorId: req.user.id,
        action: 'APPROVE_OUTPASS',
        entity: 'outpasses',
        entityId: outpass.id,
        details: { outpassNumber, type: outpass.type },
      });

      return res.status(200).json({
        success: true,
        data: {
          outpassNumber,
          status: 'Approved',
          qrCodeData,
          message: `Outpass ${outpassNumber} approved and gate QR code generated.`,
        },
        error: null,
      });
    } else {
      // Rejection
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { message: 'Rejection reason is required.', code: 'REASON_REQUIRED' },
        });
      }

      await db.query(
        `UPDATE outpasses
         SET status = 'Rejected',
             rejection_reason = $1,
             warden_notes = $2,
             approved_by = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [rejectionReason, wardenNotes || null, req.user.id, id]
      );

      await notify({
        userId: outpass.student_user_id,
        type: 'outpass_rejected',
        title: `Outpass Request Declined`,
        message: `Your outpass request to ${outpass.destination} was declined. Reason: ${rejectionReason}`,
        link: `/student/outpass`,
      });

      await audit({
        actorId: req.user.id,
        action: 'REJECT_OUTPASS',
        entity: 'outpasses',
        entityId: outpass.id,
        details: { rejectionReason },
      });

      return res.status(200).json({
        success: true,
        data: {
          status: 'Rejected',
          message: 'Outpass request declined.',
        },
        error: null,
      });
    }
  } catch (err) {
    console.error('[OUTPASS-DECISION-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 4. Security Guard Gate Screen: Check-Out and Check-In
 * POST /api/v1/outpass/gate-check
 */
async function gateCheck(req, res) {
  try {
    const { outpassNumber, action, remarks } = req.body; // action: 'CHECK_OUT' | 'CHECK_IN'

    if (!outpassNumber || !action) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Outpass number and gate action (CHECK_OUT / CHECK_IN) are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const opRes = await db.query(
      `SELECT o.*, s.full_name as student_name, s.user_id as student_user_id,
              s.laminated_id_number, r.room_number, b.name as block_name
       FROM outpasses o
       JOIN students s ON s.id = o.student_id
       JOIN blocks b ON b.id = o.block_id
       LEFT JOIN rooms r ON r.id = o.room_id
       WHERE o.outpass_number = $1`,
      [outpassNumber.trim()]
    );

    if (opRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: `No outpass record found for number: ${outpassNumber}`, code: 'NOT_FOUND' },
      });
    }

    const outpass = opRes.rows[0];
    const now = new Date();

    if (action === 'CHECK_OUT') {
      if (outpass.status !== 'Approved') {
        return res.status(400).json({
          success: false,
          data: null,
          error: { message: `Cannot check out. Outpass status is currently '${outpass.status}'. Must be 'Approved'.`, code: 'INVALID_STATUS' },
        });
      }

      await db.query(
        `UPDATE outpasses
         SET status = 'Out', actual_out_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [outpass.id]
      );

      await db.query(
        `INSERT INTO gate_logs (outpass_id, security_guard_id, action, timestamp, remarks)
         VALUES ($1, $2, 'CHECK_OUT', CURRENT_TIMESTAMP, $3)`,
        [outpass.id, req.user.id, remarks || 'Student exited main campus gate.']
      );

      await notify({
        userId: outpass.student_user_id,
        type: 'gate_exit',
        title: `Gate Exit Recorded`,
        message: `You exited the campus gate at ${now.toLocaleTimeString()}. Permitted return deadline: ${new Date(outpass.expected_return_time).toLocaleString()}.`,
        link: `/student/outpass`,
      });

      return res.status(200).json({
        success: true,
        data: {
          outpassId: outpass.id,
          outpassNumber: outpass.outpass_number,
          studentName: outpass.student_name,
          action: 'CHECK_OUT',
          status: 'Out',
          timestamp: now,
          message: `Check-out recorded for ${outpass.student_name}. Status changed to 'Out'.`,
        },
        error: null,
      });
    } else if (action === 'CHECK_IN') {
      if (!['Out', 'Overdue'].includes(outpass.status)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { message: `Cannot check in. Student has not checked out yet (current status: ${outpass.status}).`, code: 'INVALID_STATUS' },
        });
      }

      const expectedReturn = new Date(outpass.expected_return_time);
      const isLate = now > expectedReturn;

      await db.query(
        `UPDATE outpasses
         SET status = 'Returned',
             actual_return_time = CURRENT_TIMESTAMP,
             is_late_return = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [isLate, outpass.id]
      );

      await db.query(
        `INSERT INTO gate_logs (outpass_id, security_guard_id, action, timestamp, remarks, is_late)
         VALUES ($1, $2, 'CHECK_IN', CURRENT_TIMESTAMP, $3, $4)`,
        [outpass.id, req.user.id, remarks || (isLate ? 'Late return recorded at gate.' : 'Returned on time.'), isLate]
      );

      // Notify student
      await notify({
        userId: outpass.student_user_id,
        type: 'gate_entry',
        title: `Campus Return Confirmed`,
        message: `Welcome back. Campus check-in logged at ${now.toLocaleTimeString()}.${isLate ? ' (Late return flagged).' : ''}`,
        link: `/student/outpass`,
      });

      return res.status(200).json({
        success: true,
        data: {
          outpassId: outpass.id,
          outpassNumber: outpass.outpass_number,
          studentName: outpass.student_name,
          action: 'CHECK_IN',
          status: 'Returned',
          isLate,
          timestamp: now,
          message: `Check-in recorded for ${outpass.student_name}. Status marked 'Returned'.${isLate ? ' (Late return recorded).' : ''}`,
        },
        error: null,
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 5. List Outpasses with Role Scoping
 * GET /api/v1/outpass
 */
async function listOutpasses(req, res) {
  try {
    const { status, type, blockId, isLate } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'student') {
      const studentId = req.user.student?.id || req.user.studentId;
      params.push(studentId);
      conditions.push(`o.student_id = $${params.length}`);
    } else if (req.user.role === 'warden') {
      const wardenBlockId = req.scope?.blockId || req.user.blockId;
      if (wardenBlockId) {
        params.push(wardenBlockId);
        conditions.push(`o.block_id = $${params.length}`);
      }
    } else if (req.user.role === 'security') {
      // Security guard sees active outpasses ready for gate check
      if (req.query.gateMode === 'active') {
        conditions.push(`o.status IN ('Approved', 'Out', 'Overdue')`);
      }
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (type && type !== 'all') {
      params.push(type);
      conditions.push(`o.type = $${params.length}`);
    }

    if (blockId && req.user.role === 'admin') {
      params.push(parseInt(blockId, 10));
      conditions.push(`o.block_id = $${params.length}`);
    }

    if (isLate === 'true') {
      conditions.push(`(o.is_late_return = TRUE OR o.status = 'Overdue')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        o.*,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.laminated_id_number as student_lam_id,
        u_student.phone as student_phone,
        b.name as block_name,
        b.code as block_code,
        r.room_number,
        w_app.full_name as approved_by_name
      FROM outpasses o
      JOIN students s ON s.id = o.student_id
      JOIN users u_student ON u_student.id = s.user_id
      JOIN blocks b ON b.id = o.block_id
      LEFT JOIN rooms r ON r.id = o.room_id
      LEFT JOIN wardens w_app ON w_app.user_id = o.approved_by
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT 100;
    `;

    const result = await db.query(sql, params);

    const callCountsRes = await db.query(
      `SELECT outpass_id, COUNT(*) as cnt FROM outpass_call_logs GROUP BY outpass_id;`
    );
    const countMap = {};
    for (const r of callCountsRes.rows) {
      countMap[r.outpass_id] = parseInt(r.cnt, 10);
    }
    const outpassesWithCounts = result.rows.map(o => ({
      ...o,
      call_log_count: countMap[o.id] || 0,
    }));

    return res.status(200).json({
      success: true,
      data: { outpasses: outpassesWithCounts },
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
 * 6. Get Outpass Details with Call Logs & Gate Logs
 * GET /api/v1/outpass/:id
 */
async function getOutpassDetails(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        o.*,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.laminated_id_number as student_lam_id,
        u_student.phone as student_phone,
        b.name as block_name,
        r.room_number,
        w_app.full_name as approved_by_name
      FROM outpasses o
      JOIN students s ON s.id = o.student_id
      JOIN users u_student ON u_student.id = s.user_id
      JOIN blocks b ON b.id = o.block_id
      LEFT JOIN rooms r ON r.id = o.room_id
      LEFT JOIN wardens w_app ON w_app.user_id = o.approved_by
      WHERE o.id = $1;
    `;
    const opRes = await db.query(sql, [id]);
    if (opRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Outpass not found.', code: 'NOT_FOUND' },
      });
    }
    const outpass = opRes.rows[0];

    // Call logs
    const callLogs = await db.query(
      `SELECT cl.*, w.full_name as warden_name FROM outpass_call_logs cl LEFT JOIN wardens w ON w.user_id = cl.warden_id WHERE cl.outpass_id = $1 ORDER BY cl.call_time DESC`,
      [id]
    );

    // Gate logs
    const gateLogs = await db.query(
      `SELECT gl.*, sp.full_name as guard_name FROM gate_logs gl LEFT JOIN staff_profiles sp ON sp.user_id = gl.security_guard_id WHERE gl.outpass_id = $1 ORDER BY gl.timestamp ASC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        outpass,
        callLogs: callLogs.rows,
        gateLogs: gateLogs.rows,
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
 * 7. Get Students Out on Pass (For Kitchen / Food module)
 * GET /api/v1/outpass/students-out?date=YYYY-MM-DD&mealTime=lunch
 */
async function getStudentsOutHandler(req, res) {
  try {
    const { getStudentsOut } = require('./outpass.service');
    const { date, mealTime } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const studentIds = await getStudentsOut(targetDate, mealTime || 'lunch');

    return res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        mealTime: mealTime || 'lunch',
        count: studentIds.length,
        studentIds,
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

module.exports = {
  requestOutpass,
  logParentCall,
  approveOrRejectOutpass,
  gateCheck,
  listOutpasses,
  getOutpassDetails,
  getStudentsOutHandler,
};

