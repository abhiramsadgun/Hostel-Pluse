const db = require('../../db');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');
const { getRoomServices } = require('./services.service');

/**
 * 1. Schedule a Room Service (Warden / Maintenance Staff)
 * POST /api/v1/services
 */
async function scheduleService(req, res) {
  try {
    const {
      serviceType,
      blockId,
      roomIds, // array of room IDs or single roomId
      scheduledDate,
      scheduledTime,
      recurrence = 'one_time',
      assignedStaffId = null,
      notes = '',
    } = req.body;

    if (!serviceType || !blockId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Service type, block, date, and time window are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const roomsToSchedule = Array.isArray(roomIds) ? roomIds : [req.body.roomId].filter(Boolean);
    if (roomsToSchedule.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'At least one target room must be specified.', code: 'ROOM_REQUIRED' },
      });
    }

    const createdSchedules = [];

    for (const rId of roomsToSchedule) {
      const parsedRoomId = parseInt(rId, 10);
      const sql = `
        INSERT INTO service_schedules (
          service_type, block_id, room_id, scheduled_date, scheduled_time,
          recurrence, assigned_staff_id, status, student_acknowledgement,
          student_notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled', 'Pending', $8, $9)
        RETURNING *;
      `;
      const insertRes = await db.query(sql, [
        serviceType,
        parseInt(blockId, 10),
        parsedRoomId,
        scheduledDate,
        scheduledTime,
        recurrence,
        assignedStaffId ? parseInt(assignedStaffId, 10) : null,
        notes,
        req.user.id,
      ]);

      const schedule = insertRes.rows[0];
      createdSchedules.push(schedule);

      // Notify all students in this room
      const studentsRes = await db.query(
        `SELECT u.id as user_id, s.full_name, r.room_number, b.name as block_name
         FROM students s
         JOIN users u ON u.id = s.user_id
         JOIN rooms r ON r.id = s.room_id
         JOIN blocks b ON b.id = s.block_id
         WHERE s.room_id = $1 AND s.status = 'active'`,
        [parsedRoomId]
      );

      for (const st of studentsRes.rows) {
        await notify({
          userId: st.user_id,
          type: 'room_service_scheduled',
          title: `Room Service: ${serviceType.replace('_', ' ').toUpperCase()}`,
          message: `${serviceType.replace('_', ' ')} scheduled for Room ${st.room_number} on ${scheduledDate} (${scheduledTime}). Please confirm your presence.`,
          link: `/student/services`,
        });
      }
    }

    // Audit action
    await audit({
      actorId: req.user.id,
      action: 'SCHEDULE_ROOM_SERVICE',
      entity: 'service_schedules',
      entityId: createdSchedules[0]?.id,
      details: { serviceType, blockId, roomCount: roomsToSchedule.length, scheduledDate, scheduledTime },
    });

    return res.status(201).json({
      success: true,
      data: {
        schedules: createdSchedules,
        count: createdSchedules.length,
        message: `Scheduled ${serviceType.replace('_', ' ')} for ${createdSchedules.length} room(s).`,
      },
      error: null,
    });
  } catch (err) {
    console.error('[SCHEDULE-SERVICE-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 2. List Service Schedules with Role Scoping
 * GET /api/v1/services
 */
async function listServices(req, res) {
  try {
    const { blockId, roomId, serviceType, status, date } = req.query;

    const conditions = [];
    const params = [];

    // Role-based visibility
    if (req.user.role === 'student') {
      const studentRoomId = req.user.roomId || req.user.student?.room_id;
      if (!studentRoomId) {
        return res.status(200).json({ success: true, data: { schedules: [] }, error: null });
      }
      params.push(studentRoomId);
      conditions.push(`ss.room_id = $${params.length}`);
    } else if (req.user.role === 'warden') {
      const wardenBlockId = req.scope?.blockId || req.user.blockId;
      if (wardenBlockId) {
        params.push(wardenBlockId);
        conditions.push(`ss.block_id = $${params.length}`);
      }
    } else if (req.user.role === 'maintenance') {
      // If maintenance staff wants to view their own tasks
      if (req.query.assignedOnly === 'true') {
        const staffRes = await db.query('SELECT id FROM staff_profiles WHERE user_id = $1', [req.user.id]);
        if (staffRes.rows.length > 0) {
          params.push(staffRes.rows[0].id);
          conditions.push(`ss.assigned_staff_id = $${params.length}`);
        }
      }
    }

    if (blockId && req.user.role === 'admin') {
      params.push(parseInt(blockId, 10));
      conditions.push(`ss.block_id = $${params.length}`);
    }

    if (roomId) {
      params.push(parseInt(roomId, 10));
      conditions.push(`ss.room_id = $${params.length}`);
    }

    if (serviceType && serviceType !== 'all') {
      params.push(serviceType);
      conditions.push(`ss.service_type = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`ss.status = $${params.length}`);
    }

    if (date) {
      params.push(date);
      conditions.push(`ss.scheduled_date = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        ss.*,
        b.name as block_name,
        b.code as block_code,
        r.room_number,
        r.floor as room_floor,
        sp.full_name as assigned_staff_name,
        u_staff.phone as assigned_staff_phone,
        u.email as creator_email
      FROM service_schedules ss
      JOIN blocks b ON b.id = ss.block_id
      JOIN rooms r ON r.id = ss.room_id
      LEFT JOIN staff_profiles sp ON sp.id = ss.assigned_staff_id
      LEFT JOIN users u_staff ON u_staff.id = sp.user_id
      LEFT JOIN users u ON u.id = ss.created_by
      ${whereClause}
      ORDER BY ss.scheduled_date DESC, ss.scheduled_time ASC;
    `;

    const result = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      data: { schedules: result.rows },
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
 * 3. Exported Endpoint getRoomServices(roomId)
 * GET /api/v1/services/room/:roomId
 */
async function getRoomServicesHandler(req, res) {
  try {
    const { roomId } = req.params;
    const services = await getRoomServices(roomId);

    return res.status(200).json({
      success: true,
      data: { services },
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
 * 4. Student Acknowledge Service (Confirm Presence, Reschedule, or Away)
 * PUT /api/v1/services/:id/acknowledge
 */
async function acknowledgeService(req, res) {
  try {
    const { id } = req.params;
    const { acknowledgement, notes, preferredDate, preferredTime } = req.body;

    if (!['Confirmed', 'Rescheduled', 'Away'].includes(acknowledgement)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Acknowledgement must be Confirmed, Rescheduled, or Away.', code: 'INVALID_STATUS' },
      });
    }

    const scheduleRes = await db.query(
      `SELECT ss.*, r.room_number, b.name as block_name, sp.user_id as staff_user_id
       FROM service_schedules ss
       JOIN rooms r ON r.id = ss.room_id
       JOIN blocks b ON b.id = ss.block_id
       LEFT JOIN staff_profiles sp ON sp.id = ss.assigned_staff_id
       WHERE ss.id = $1`,
      [id]
    );

    if (scheduleRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Service schedule not found.', code: 'NOT_FOUND' },
      });
    }

    const schedule = scheduleRes.rows[0];

    // Update schedule
    const updateSql = `
      UPDATE service_schedules
      SET student_acknowledgement = $1,
          status = $1,
          student_notes = $2,
          reschedule_preferred_date = $3,
          reschedule_preferred_time = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;
    const updated = await db.query(updateSql, [
      acknowledgement,
      notes || null,
      preferredDate || null,
      preferredTime || null,
      id,
    ]);

    // If student marked Away or requested Reschedule, notify staff and wardens
    if (acknowledgement !== 'Confirmed') {
      if (schedule.staff_user_id) {
        await notify({
          userId: schedule.staff_user_id,
          type: 'service_reschedule_alert',
          title: `Service ${acknowledgement}: Room ${schedule.room_number}`,
          message: `Resident responded '${acknowledgement}'. ${notes ? 'Note: ' + notes : ''}`,
          link: `/staff/services`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        schedule: updated.rows[0],
        message: `Service marked as ${acknowledgement}.`,
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
 * 5. Staff Marks Completion or Updates Status
 * PUT /api/v1/services/:id/status
 */
async function updateServiceStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, completionNotes } = req.body;

    if (!['In Progress', 'Completed', 'Cancelled', 'Scheduled'].includes(status)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid service status.', code: 'INVALID_STATUS' },
      });
    }

    const scheduleRes = await db.query(
      `SELECT ss.*, r.room_number FROM service_schedules ss JOIN rooms r ON r.id = ss.room_id WHERE ss.id = $1`,
      [id]
    );
    if (scheduleRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Service schedule not found.', code: 'NOT_FOUND' },
      });
    }
    const schedule = scheduleRes.rows[0];

    const isComplete = status === 'Completed';

    const updateSql = `
      UPDATE service_schedules
      SET status = $1,
          completion_notes = $2,
          completed_at = CASE WHEN $3 = TRUE THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const updated = await db.query(updateSql, [
      status,
      completionNotes || null,
      isComplete,
      id,
    ]);

    // On completion, notify residents of the room
    if (isComplete) {
      const residents = await db.query(
        `SELECT u.id as user_id FROM students s JOIN users u ON u.id = s.user_id WHERE s.room_id = $1`,
        [schedule.room_id]
      );
      for (const r of residents.rows) {
        await notify({
          userId: r.user_id,
          type: 'service_completed',
          title: `Service Completed: ${schedule.service_type.replace('_', ' ').toUpperCase()}`,
          message: `Work finished for Room ${schedule.room_number}. Notes: ${completionNotes || 'Service executed successfully.'}`,
          link: `/student/services`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        schedule: updated.rows[0],
        message: `Service status updated to ${status}.`,
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
  scheduleService,
  listServices,
  getRoomServicesHandler,
  acknowledgeService,
  updateServiceStatus,
};
