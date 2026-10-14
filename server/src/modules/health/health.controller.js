const db = require('../../db');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');

const HOSPITALS = [
  { id: 'campus_clinic', name: 'Campus University Health Centre (On-Campus)', distance: '0.2 km', contact: '+91 800-011-2233' },
  { id: 'city_apollo', name: 'Apollo City Hospital & Trauma Centre', distance: '3.4 km', contact: '+91 800-106-9900' },
  { id: 'st_mary', name: 'St. Mary Multispeciality Hospital', distance: '4.8 km', contact: '+91 800-445-5667' },
  { id: 'lifecare_icu', name: 'LifeCare Emergency Care & ICU', distance: '6.1 km', contact: '+91 800-999-1080' },
];

/**
 * 1. Raise a Health Assistance Ticket / Emergency SOS (Student)
 * POST /api/v1/health
 */
async function raiseHealthTicket(req, res) {
  try {
    let studentId = req.user.student?.id || req.user.studentId;
    let studentDetails = req.user.student;

    if (!studentDetails) {
      const stRes = await db.query(
        `SELECT s.*, s.full_name as student_name, u.phone as student_phone, b.name as block_name, r.room_number
         FROM students s
         JOIN users u ON u.id = s.user_id
         JOIN blocks b ON b.id = s.block_id
         LEFT JOIN rooms r ON r.id = s.room_id
         WHERE s.user_id = $1`,
        [req.user.id]
      );
      if (stRes.rows.length > 0) {
        studentDetails = stRes.rows[0];
        studentId = studentDetails.id;
      }
    }

    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only registered hostel residents can raise health assistance tickets.', code: 'FORBIDDEN' },
      });
    }

    const { symptoms, severity = 'mild', photoUrl, isSos = false } = req.body;

    if (!symptoms && !isSos) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Please provide a description of symptoms or emergency need.', code: 'VALIDATION_ERROR' },
      });
    }

    const finalSeverity = isSos ? 'emergency' : (['mild', 'moderate', 'emergency'].includes(severity) ? severity : 'mild');
    const finalSymptoms = isSos ? `🚨 EMERGENCY RED SOS ACTIVATED: ${symptoms || 'Immediate medical rescue requested at room.'}` : symptoms;
    const blockId = studentDetails.block_id || req.user.blockId;
    const roomId = studentDetails.room_id || req.user.roomId;

    const insertSql = `
      INSERT INTO health_tickets (
        student_id, block_id, room_id, symptoms, severity, photo_url, is_sos, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
      RETURNING *;
    `;

    const ticketRes = await db.query(insertSql, [
      studentId,
      blockId,
      roomId,
      finalSymptoms,
      finalSeverity,
      photoUrl || null,
      Boolean(isSos),
    ]);

    const ticket = ticketRes.rows[0];

    // Audit creation
    await audit({
      actorId: req.user.id,
      action: isSos ? 'EMERGENCY_HEALTH_SOS_TRIGGERED' : 'HEALTH_TICKET_RAISED',
      entity: 'health_ticket',
      entityId: ticket.id,
      details: { severity: finalSeverity, isSos: Boolean(isSos), roomId, blockId },
    });

    // Notify Health Assistants
    const haUsers = await db.query(
      `SELECT u.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.role = 'health_assistant'`
    );
    for (const ha of haUsers.rows) {
      await notify({
        userId: ha.id,
        type: isSos ? 'health_emergency_sos' : 'health_ticket_new',
        title: isSos ? `🚨 CODE RED SOS: Room ${studentDetails.room_number || 'N/A'}` : `New Health Request: ${studentDetails.student_name || req.user.fullName}`,
        message: `${finalSeverity.toUpperCase()}: ${finalSymptoms.slice(0, 100)} (${studentDetails.block_name || 'Block'}, Room ${studentDetails.room_number || 'N/A'})`,
        link: `/health/tickets/${ticket.id}`,
      });
    }

    // Notify Block Wardens
    const wardenUsers = await db.query(
      `SELECT u.id FROM wardens w JOIN users u ON u.id = w.user_id WHERE w.block_id = $1`,
      [blockId]
    );
    for (const w of wardenUsers.rows) {
      await notify({
        userId: w.id,
        type: isSos ? 'health_emergency_sos' : 'health_ticket_new',
        title: isSos ? `🚨 EMERGENCY MEDICAL SOS: ${studentDetails.student_name || req.user.fullName}` : `Resident Health Ticket (${finalSeverity})`,
        message: `Student in Room ${studentDetails.room_number || 'N/A'}. Parent: ${studentDetails.parent_name || 'Recorded'} (${studentDetails.parent_phone || 'Recorded'}).`,
        link: `/warden/health/${ticket.id}`,
      });
    }

    // If SOS, also notify parent (simulated SMS / notification log)
    if (isSos) {
      console.log(`[EMERGENCY-SMS-DISPATCH] Sent high-priority SMS to parent ${studentDetails.parent_phone || 'Emergency Contact'}: Medical emergency triggered for ${studentDetails.student_name}. Campus medic on the way.`);
    }

    return res.status(201).json({
      success: true,
      data: {
        ticket,
        message: isSos
          ? 'Emergency SOS triggered! First responders and block warden have been dispatched to your room.'
          : 'Health ticket submitted. Medical staff will review shortly.',
      },
      error: null,
    });
  } catch (err) {
    console.error('[RAISE-HEALTH-TICKET-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 2. List Health Tickets (Privacy Scoped)
 * GET /api/v1/health
 * Visible only to: student (their own), health_assistant (all), warden (their block), admin
 */
async function listHealthTickets(req, res) {
  try {
    const { status, severity } = req.query;
    const conditions = [];
    const params = [];

    // Privacy access check
    if (req.user.role === 'student') {
      let studentId = req.user.student?.id || req.user.studentId;
      if (!studentId) {
        const stLookup = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (stLookup.rows.length > 0) studentId = stLookup.rows[0].id;
      }
      if (studentId) {
        params.push(studentId);
        conditions.push(`ht.student_id = $${params.length}`);
      }
    } else if (req.user.role === 'warden') {
      const blockId = req.scope?.blockId || req.user.blockId;
      if (blockId) {
        params.push(blockId);
        conditions.push(`ht.block_id = $${params.length}`);
      }
    } else if (!['health_assistant', 'admin', 'warden'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Health assistance records are restricted to medical personnel, block wardens, and the student.', code: 'RESTRICTED_ACCESS' },
      });
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`ht.status = $${params.length}`);
    }

    if (severity && severity !== 'all') {
      params.push(severity);
      conditions.push(`ht.severity = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        ht.*,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.allergies as student_allergies,
        s.parent_name,
        s.parent_phone,
        s.emergency_contact,
        b.name as block_name,
        r.room_number,
        sp_ha.full_name as assistant_name
      FROM health_tickets ht
      JOIN students s ON s.id = ht.student_id
      JOIN blocks b ON b.id = ht.block_id
      LEFT JOIN rooms r ON r.id = ht.room_id
      LEFT JOIN staff_profiles sp_ha ON sp_ha.user_id = ht.health_assistant_id
      ${whereClause}
      ORDER BY 
        CASE WHEN ht.severity = 'emergency' AND ht.status != 'Resolved' THEN 1
             WHEN ht.status = 'Open' THEN 2
             WHEN ht.status = 'On The Way' THEN 3
             ELSE 4 END,
        ht.created_at DESC
      LIMIT 100;
    `;

    const result = await db.query(sql, params);

    const medCounts = await db.query(`SELECT health_ticket_id, COUNT(*) as cnt FROM medicine_logs GROUP BY health_ticket_id;`);
    const medMap = {};
    for (const r of medCounts.rows) medMap[r.health_ticket_id] = parseInt(r.cnt, 10);

    const vehReqs = await db.query(`SELECT health_ticket_id, status FROM vehicle_requests ORDER BY id DESC;`);
    const vehMap = {};
    for (const r of vehReqs.rows) {
      if (!vehMap[r.health_ticket_id]) vehMap[r.health_ticket_id] = r.status;
    }

    const ticketsWithMeta = result.rows.map(t => ({
      ...t,
      medicines_given_count: medMap[t.id] || 0,
      vehicle_status: vehMap[t.id] || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tickets: ticketsWithMeta,
        hospitals: HOSPITALS,
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
 * 3. Get Health Ticket Details with Medicine Logs and Audit
 * GET /api/v1/health/:id
 */
async function getHealthTicketDetails(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        ht.*,
        s.full_name as student_name,
        s.roll_number as student_roll,
        s.allergies as student_allergies,
        s.parent_name,
        s.parent_phone,
        s.emergency_contact,
        b.name as block_name,
        r.room_number,
        sp_ha.full_name as assistant_name
      FROM health_tickets ht
      JOIN students s ON s.id = ht.student_id
      JOIN blocks b ON b.id = ht.block_id
      LEFT JOIN rooms r ON r.id = ht.room_id
      LEFT JOIN staff_profiles sp_ha ON sp_ha.user_id = ht.health_assistant_id
      WHERE ht.id = $1;
    `;

    const resTicket = await db.query(sql, [id]);
    if (resTicket.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Health ticket not found.', code: 'NOT_FOUND' },
      });
    }

    const ticket = resTicket.rows[0];

    // Privacy enforce: Student must own ticket, warden must match block, or role is health_assistant/admin
    if (req.user.role === 'student' && ticket.student_id !== (req.user.student?.id || req.user.studentId)) {
      return res.status(403).json({ success: false, data: null, error: { message: 'Unauthorized.', code: 'FORBIDDEN' } });
    }
    if (req.user.role === 'warden' && req.user.blockId && ticket.block_id !== req.user.blockId) {
      return res.status(403).json({ success: false, data: null, error: { message: 'Unauthorized block access.', code: 'FORBIDDEN' } });
    }

    // Audit every access to medicine logs as required by spec
    await audit({
      actorId: req.user.id,
      action: 'ACCESS_MEDICINE_LOGS',
      entity: 'health_ticket',
      entityId: ticket.id,
      details: { role: req.user.role, viewerName: req.user.fullName },
    });

    const medicineLogs = await db.query(
      `SELECT ml.*, sp.full_name as administered_by_name
       FROM medicine_logs ml
       LEFT JOIN staff_profiles sp ON sp.user_id = ml.administered_by
       WHERE ml.health_ticket_id = $1
       ORDER BY ml.administered_at ASC`,
      [id]
    );

    const vehicleRequests = await db.query(
      `SELECT vr.*, COALESCE(sp.full_name, w.full_name, s.full_name, 'Campus Dispatch') as requested_by_name
       FROM vehicle_requests vr
       LEFT JOIN staff_profiles sp ON sp.user_id = vr.requested_by
       LEFT JOIN wardens w ON w.user_id = vr.requested_by
       LEFT JOIN students s ON s.user_id = vr.requested_by
       WHERE vr.health_ticket_id = $1
       ORDER BY vr.created_at ASC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ticket,
        medicines: medicineLogs.rows,
        vehicleRequests: vehicleRequests.rows,
        hospitals: HOSPITALS,
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
 * 4. Update Ticket Status (Health Assistant marks 'On The Way', 'Under Care', 'Resolved')
 * PUT /api/v1/health/:id/status
 */
async function updateTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, observations, resolutionNotes } = req.body;

    const validStatuses = ['Open', 'On The Way', 'Under Care', 'Hospital Referred', 'Resolved', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'INVALID_STATUS' },
      });
    }

    const tRes = await db.query(
      `SELECT ht.*, s.user_id as student_user_id, s.full_name as student_name
       FROM health_tickets ht
       JOIN students s ON s.id = ht.student_id
       WHERE ht.id = $1`,
      [id]
    );
    if (tRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Ticket not found.', code: 'NOT_FOUND' } });
    }
    const ticket = tRes.rows[0];

    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];

    if (req.user.role === 'health_assistant') {
      updates.push(`health_assistant_id = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (observations !== undefined) {
      updates.push(`observations = $${params.length + 1}`);
      params.push(observations);
    }

    if (resolutionNotes !== undefined) {
      updates.push(`resolution_notes = $${params.length + 1}`);
      params.push(resolutionNotes);
    }

    if (status === 'Resolved') {
      updates.push(`resolved_at = CURRENT_TIMESTAMP`);
    }

    params.push(id);
    const updateSql = `UPDATE health_tickets SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *;`;
    const updatedRes = await db.query(updateSql, params);
    const updated = updatedRes.rows[0];

    // Audit
    await audit({
      actorId: req.user.id,
      action: 'HEALTH_STATUS_UPDATED',
      entity: 'health_ticket',
      entityId: id,
      details: { fromStatus: ticket.status, toStatus: status, observations },
    });

    // Notify Student
    let notifTitle = `Health Ticket: ${status}`;
    let notifMsg = `Your health ticket status is now ${status}.`;
    if (status === 'On The Way') {
      notifTitle = `Medical Attendant is On The Way!`;
      notifMsg = `A health assistant has responded and is heading to your hostel room.`;
    } else if (status === 'Resolved') {
      notifTitle = `Health Assistance Resolved`;
      notifMsg = `Your health ticket has been marked resolved. Get well soon!`;
    }

    await notify({
      userId: ticket.student_user_id,
      type: 'health_update',
      title: notifTitle,
      message: notifMsg,
      link: `/student/health`,
    });

    return res.status(200).json({
      success: true,
      data: { ticket: updated, message: `Status updated to ${status}.` },
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
 * 5. Administer / Log Medicine with Allergy Safety Check
 * POST /api/v1/health/:id/medicine
 * Checks student's known allergies before recording!
 */
async function logMedicine(req, res) {
  try {
    const { id } = req.params;
    const { medicineName, dosage, overrideAllergyWarning, overrideReason, notes } = req.body;

    if (!medicineName || !dosage) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Medicine name and dosage are required.', code: 'VALIDATION_ERROR' },
      });
    }

    // Fetch ticket and student allergies
    const tRes = await db.query(
      `SELECT ht.*, s.allergies, s.full_name as student_name
       FROM health_tickets ht
       JOIN students s ON s.id = ht.student_id
       WHERE ht.id = $1`,
      [id]
    );

    if (tRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Ticket not found.', code: 'NOT_FOUND' } });
    }
    const ticket = tRes.rows[0];

    // ALLERGY CHECK
    const studentAllergies = (ticket.allergies || '').toLowerCase();
    const medLower = medicineName.toLowerCase();
    let allergyMatch = false;

    if (studentAllergies && studentAllergies !== 'none' && studentAllergies !== 'nil') {
      // Check for partial or direct match in allergies string
      const allergyKeywords = studentAllergies.split(/[,;\/\s]+/).map(k => k.trim()).filter(Boolean);
      for (const kw of allergyKeywords) {
        if (kw.length >= 3 && (medLower.includes(kw) || kw.includes(medLower))) {
          allergyMatch = true;
          break;
        }
      }
    }

    // If allergy detected and override not confirmed, return a warning
    if (allergyMatch && !overrideAllergyWarning) {
      return res.status(409).json({
        success: false,
        data: {
          warning: true,
          studentName: ticket.student_name,
          medicineName,
          knownAllergies: ticket.allergies,
          requiresOverride: true,
        },
        error: {
          message: `ALLERGY WARNING: Student has registered allergy to "${ticket.allergies}". Administering "${medicineName}" may trigger an adverse reaction. Please confirm doctor override.`,
          code: 'ALLERGY_CONFLICT_DETECTED',
        },
      });
    }

    // Insert into medicine_logs
    const insertLog = `
      INSERT INTO medicine_logs (
        health_ticket_id, student_id, medicine_name, dosage, administered_by,
        allergy_warning_triggered, allergy_override_reason, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const logRes = await db.query(insertLog, [
      id,
      ticket.student_id,
      medicineName,
      dosage,
      req.user.id,
      allergyMatch,
      overrideReason || null,
      notes || null,
    ]);

    // Decrement inventory stock if present
    try {
      await db.query(
        `UPDATE medicine_inventory 
         SET stock_quantity = GREATEST(0, stock_quantity - 1), updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(name) = LOWER($1) OR LOWER(generic_name) = LOWER($1)`,
        [medicineName]
      );
    } catch (e) {
      // non-fatal
    }

    await audit({
      actorId: req.user.id,
      action: 'MEDICINE_ADMINISTERED',
      entity: 'medicine_log',
      entityId: logRes.rows[0].id,
      details: { medicineName, dosage, allergyMatch, overrideReason },
    });

    return res.status(201).json({
      success: true,
      data: {
        medicineLog: logRes.rows[0],
        message: allergyMatch
          ? `Medicine administered with recorded allergy override.`
          : `Medicine administration successfully recorded.`,
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
 * 6. Emergency Medical Vehicle / Van Dispatch
 * POST /api/v1/health/:id/vehicle
 */
async function requestMedicalVehicle(req, res) {
  try {
    const { id } = req.params;
    const { hospitalName, vehicleType = 'Campus Medical Van', driverContact } = req.body;

    if (!hospitalName) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Hospital destination is required.', code: 'VALIDATION_ERROR' },
      });
    }

    const tRes = await db.query(
      `SELECT ht.*, s.full_name as student_name, s.parent_name, s.parent_phone, s.user_id as student_user_id
       FROM health_tickets ht
       JOIN students s ON s.id = ht.student_id
       WHERE ht.id = $1`,
      [id]
    );

    if (tRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, error: { message: 'Ticket not found.', code: 'NOT_FOUND' } });
    }
    const ticket = tRes.rows[0];

    const insertSql = `
      INSERT INTO vehicle_requests (
        health_ticket_id, requested_by, vehicle_type, hospital_name, driver_contact, status
      ) VALUES ($1, $2, $3, $4, $5, 'Requested')
      RETURNING *;
    `;

    const vrRes = await db.query(insertSql, [
      id,
      req.user.id,
      vehicleType,
      hospitalName,
      driverContact || '+91 99880-11223',
    ]);

    // Update ticket
    await db.query(
      `UPDATE health_tickets
       SET vehicle_needed = TRUE, hospital_name = $1, status = 'Hospital Referred', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hospitalName, id]
    );

    // Audit
    await audit({
      actorId: req.user.id,
      action: 'EMERGENCY_VEHICLE_DISPATCHED',
      entity: 'vehicle_request',
      entityId: vrRes.rows[0].id,
      details: { hospitalName, vehicleType },
    });

    // Notify Parent
    console.log(`[SMS-TO-PARENT] Emergency hospital transit arranged for ${ticket.student_name} to ${hospitalName}. Contact: ${ticket.parent_phone}`);

    // Notify Student
    await notify({
      userId: ticket.student_user_id,
      type: 'emergency_transit',
      title: 'Emergency Medical Transit Arranged',
      message: `${vehicleType} dispatched to transport you to ${hospitalName}. Campus medics are assisting.`,
      link: `/student/health`,
    });

    return res.status(201).json({
      success: true,
      data: {
        vehicleRequest: vrRes.rows[0],
        message: `Medical vehicle request created. Destination: ${hospitalName}.`,
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
 * 7. Update Vehicle Status (Requested -> Dispatched -> Reached Hospital -> Completed)
 * PUT /api/v1/health/:id/vehicle/:vehicleId/status
 */
async function updateVehicleStatus(req, res) {
  try {
    const { vehicleId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Requested', 'Dispatched', 'Reached Hospital', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Invalid vehicle status.', code: 'VALIDATION_ERROR' } });
    }

    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];

    if (status === 'Dispatched') {
      updates.push('dispatched_at = CURRENT_TIMESTAMP');
    } else if (status === 'Reached Hospital') {
      updates.push('reached_at = CURRENT_TIMESTAMP');
    }

    params.push(vehicleId);
    const sql = `UPDATE vehicle_requests SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *;`;
    const resV = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      data: { vehicleRequest: resV.rows[0], message: `Transit status updated to ${status}.` },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

/**
 * 8. Medicine Inventory Management (Stock and low-stock alerts)
 * GET /api/v1/health/inventory
 */
async function getInventory(req, res) {
  try {
    const invRes = await db.query(
      `SELECT *, (stock_quantity <= min_threshold) as is_low_stock
       FROM medicine_inventory
       ORDER BY is_low_stock DESC, name ASC;`
    );

    return res.status(200).json({
      success: true,
      data: {
        inventory: invRes.rows,
        lowStockCount: invRes.rows.filter(i => i.is_low_stock).length,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'SERVER_ERROR' } });
  }
}

module.exports = {
  raiseHealthTicket,
  listHealthTickets,
  getHealthTicketDetails,
  updateTicketStatus,
  logMedicine,
  requestMedicalVehicle,
  updateVehicleStatus,
  getInventory,
};
