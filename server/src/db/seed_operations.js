const db = require('./index');
const { generateQrDataUrl } = require('../services/qr');

async function seedOperations() {
  console.log('[SEED-OPERATIONS] Seeding Operations & Student Life Modules...');

  // Get references
  const blockRes = await db.query(`SELECT id, code, gender FROM blocks ORDER BY id ASC`);
  if (blockRes.rows.length === 0) return;
  const blockA = blockRes.rows[0];
  const blockB = blockRes.rows[1] || blockRes.rows[0];

  const roomsRes = await db.query(`SELECT id, block_id, room_number, capacity FROM rooms ORDER BY id ASC`);
  const roomA101 = roomsRes.rows.find(r => r.block_id === blockA.id && r.room_number === '101') || roomsRes.rows[0];
  const roomA102 = roomsRes.rows.find(r => r.block_id === blockA.id && r.room_number === '102') || roomsRes.rows[1];
  const roomA201 = roomsRes.rows.find(r => r.block_id === blockA.id && r.room_number === '201') || roomsRes.rows[2];

  const studentsRes = await db.query(`SELECT s.*, u.id as user_id FROM students s JOIN users u ON u.id = s.user_id ORDER BY s.id ASC`);
  if (studentsRes.rows.length === 0) return;
  const student1 = studentsRes.rows[0]; // e.g. Rahul Sharma
  const student2 = studentsRes.rows[1] || student1;
  const student3 = studentsRes.rows[2] || student1;

  const wardensRes = await db.query(`SELECT w.*, u.id as user_id FROM wardens w JOIN users u ON u.id = w.user_id ORDER BY w.id ASC`);
  const warden1 = wardensRes.rows[0];

  const staffRes = await db.query(`SELECT sp.*, u.id as user_id, u.role FROM staff_profiles sp JOIN users u ON u.id = sp.user_id`);
  const maintStaff = staffRes.rows.find(s => s.role === 'maintenance');
  const healthStaff = staffRes.rows.find(s => s.role === 'health_assistant');
  const secStaff = staffRes.rows.find(s => s.role === 'security');

  // ==========================================
  // MODULE 1: ROOM SERVICES
  // ==========================================
  console.log('[SEED-OPERATIONS] 1. Seeding room services schedules...');
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  await db.query(
    `INSERT INTO service_schedules (
      service_type, block_id, room_id, scheduled_date, scheduled_time, recurrence,
      assigned_staff_id, status, student_acknowledgement, completion_notes, completed_at
    ) VALUES 
      ('house_cleaning', $1, $2, $3, '10:30 AM', 'weekly', $4, 'Confirmed', 'Confirmed', NULL, NULL),
      ('laundry', $1, $2, $5, '04:00 PM', 'bi_weekly', $4, 'Scheduled', 'Pending', NULL, NULL),
      ('pest_control', $1, $6, $5, '02:00 PM', 'monthly', $4, 'Scheduled', 'Away', NULL, NULL),
      ('deep_sanitization', $1, $2, $7, '11:00 AM', 'one_time', $4, 'Completed', 'Confirmed', 'Disinfected all mattress covers, study desks, and AC vents.', CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;`,
    [blockA.id, roomA101.id, dateStr, maintStaff?.id || null, nextWeekStr, roomA102.id, yesterdayStr]
  );

  // ==========================================
  // MODULE 2: OUTPASSES
  // ==========================================
  console.log('[SEED-OPERATIONS] 2. Seeding digital outpasses, parent calls, and gate logs...');
  const qrData1 = generateQrDataUrl({
    outpassNumber: 'OUT-2026-000001',
    studentName: student1.full_name,
    roll: student1.roll_number,
    destination: 'City Central Library & Book Fair',
    validUntil: new Date(Date.now() + 6 * 3600000).toISOString(),
  });

  const qrData2 = generateQrDataUrl({
    outpassNumber: 'OUT-2026-000002',
    studentName: student2.full_name,
    roll: student2.roll_number,
    destination: 'Hometown Family Residence, Warangal',
    validUntil: new Date(Date.now() + 48 * 3600000).toISOString(),
  });

  // Outpass 1: Approved Day Pass
  const op1 = await db.query(
    `INSERT INTO outpasses (
      outpass_number, student_id, block_id, room_id, type, reason, destination,
      out_time, expected_return_time, status, qr_code_data, parent_name, parent_phone,
      parent_consent_status, approved_by, approved_at
    ) VALUES (
      'OUT-2026-000001', $1, $2, $3, 'day', 'Attending National Technical Library seminar and project study',
      'City Central Library, Koti, Hyderabad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 hours',
      'Approved', $4, $5, $6, 'consent_granted', $7, CURRENT_TIMESTAMP
    ) RETURNING id`,
    [student1.id, blockA.id, roomA101.id, qrData1, student1.parent_name || 'Mr. Ramesh Sharma', student1.parent_phone || '+91 98480-11223', warden1?.user_id || null]
  );

  // Parent call log for Outpass 1
  if (op1.rows.length > 0) {
    await db.query(
      `INSERT INTO outpass_call_logs (outpass_id, warden_id, contact_person, phone_dialed, response_status, notes)
       VALUES ($1, $2, $3, $4, 'consent_granted', 'Father confirmed book fair attendance and promised return by 8 PM.')`,
      [op1.rows[0].id, warden1?.user_id || null, student1.parent_name || 'Mr. Ramesh Sharma', student1.parent_phone || '+91 98480-11223']
    );
  }

  // Outpass 2: Active Out / Off Campus with Gate Check-Out Log
  const op2 = await db.query(
    `INSERT INTO outpasses (
      outpass_number, student_id, block_id, room_id, type, reason, destination,
      out_time, expected_return_time, actual_out_time, status, qr_code_data, parent_name, parent_phone,
      parent_consent_status, approved_by, approved_at
    ) VALUES (
      'OUT-2026-000002', $1, $2, $3, 'home', 'Weekend home visit for family religious ceremony',
      'Hometown Residence, Hanamkonda, Warangal', CURRENT_TIMESTAMP - INTERVAL '3 hours',
      CURRENT_TIMESTAMP + INTERVAL '36 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours',
      'Out', $4, $5, $6, 'consent_granted', $7, CURRENT_TIMESTAMP
    ) RETURNING id`,
    [student2.id, blockA.id, roomA102.id, qrData2, student2.parent_name || 'Mrs. Lakshmi Rao', student2.parent_phone || '+91 98490-22334', warden1?.user_id || null]
  );

  if (op2.rows.length > 0) {
    await db.query(
      `INSERT INTO outpass_call_logs (outpass_id, warden_id, contact_person, phone_dialed, response_status, notes)
       VALUES ($1, $2, $3, $4, 'consent_granted', 'Mother consented for weekend festival leave.')`,
      [op2.rows[0].id, warden1?.user_id || null, student2.parent_name || 'Mrs. Lakshmi Rao', student2.parent_phone || '+91 98490-22334']
    );
    await db.query(
      `INSERT INTO gate_logs (outpass_id, security_guard_id, action, timestamp, remarks, is_late)
       VALUES ($1, $2, 'CHECK_OUT', CURRENT_TIMESTAMP - INTERVAL '2 hours', 'QR scanned at Main Gate 1. Exit cleared on RTC bus pass.', FALSE)`,
      [op2.rows[0].id, secStaff?.user_id || null]
    );
  }

  // Outpass 3: Requested (waiting for warden parental call)
  await db.query(
    `INSERT INTO outpasses (
      outpass_number, student_id, block_id, room_id, type, reason, destination,
      out_time, expected_return_time, status, parent_name, parent_phone, parent_consent_status
    ) VALUES (
      'REQ-889102', $1, $2, $3, 'night', 'Hackathon overnight coding lab at Innovation Park',
      'T-Hub 2.0, Knowledge City, Raidurg', CURRENT_TIMESTAMP + INTERVAL '4 hours',
      CURRENT_TIMESTAMP + INTERVAL '16 hours', 'Requested', $4, $5, 'Pending'
    )`,
    [student1.id, blockA.id, roomA101.id, student1.parent_name || 'Mr. Ramesh Sharma', student1.parent_phone || '+91 98480-11223']
  );

  // ==========================================
  // MODULE 3: HEALTH ASSISTANCE & INVENTORY
  // ==========================================
  console.log('[SEED-OPERATIONS] 3. Seeding clinic medicine inventory and health assistance records...');
  await db.query(
    `INSERT INTO medicine_inventory (name, generic_name, category, stock_quantity, min_threshold, unit)
     VALUES 
      ('Paracetamol 500mg', 'Acetaminophen', 'Antipyretic / Pain Relief', 120, 20, 'tablets'),
      ('Cetirizine 10mg', 'Cetirizine Hydrochloride', 'Antihistamine / Allergy', 8, 15, 'tablets'), -- LOW STOCK
      ('Ibuprofen 400mg', 'Ibuprofen', 'NSAID / Pain', 45, 15, 'tablets'),
      ('ORS Electrolyte Sachet', 'Oral Rehydration Salts', 'Hydration', 65, 20, 'sachets'),
      ('Amoxicillin 250mg', 'Amoxicillin Trihydrate', 'Antibiotic', 5, 15, 'capsules'), -- LOW STOCK
      ('Antacid Digene Gel', 'Magnesium Hydroxide + Simethicone', 'Antacid', 24, 10, 'bottles'),
      ('Betadine Ointment 5%', 'Povidone Iodine', 'First Aid Antiseptic', 18, 5, 'tubes'),
      ('Elastic Crepe Bandage', 'Cotton Crepe', 'First Aid / Sprains', 30, 8, 'rolls')
     ON CONFLICT (name) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;`
  );

  // Seed Health Ticket 1: Mild
  const ht1 = await db.query(
    `INSERT INTO health_tickets (
      student_id, block_id, room_id, symptoms, severity, status, health_assistant_id, observations
    ) VALUES (
      $1, $2, $3, 'Fever of 101.2°F with acute throat soreness and body ache', 'mild', 'Under Care',
      $4, 'Throat shows mild erythema. Prescribed hydration and paracetamol.'
    ) RETURNING id`,
    [student1.id, blockA.id, roomA101.id, healthStaff?.user_id || null]
  );

  if (ht1.rows.length > 0) {
    await db.query(
      `INSERT INTO medicine_logs (
        health_ticket_id, student_id, medicine_name, dosage, administered_by, notes
      ) VALUES ($1, $2, 'Paracetamol 500mg', '1 tablet post meal', $3, 'Temperature checked at 101.2°F')`,
      [ht1.rows[0].id, student1.id, healthStaff?.user_id || null]
    );
  }

  // Seed Health Ticket 2: Emergency SOS with Hospital Van Dispatch
  const ht2 = await db.query(
    `INSERT INTO health_tickets (
      student_id, block_id, room_id, symptoms, severity, is_sos, status, health_assistant_id,
      hospital_name, vehicle_needed, observations
    ) VALUES (
      $1, $2, $3, '🚨 CODE RED SOS: Severe respiratory distress, sudden chest tightness and asthmatic wheezing',
      'emergency', TRUE, 'Hospital Referred', $4, 'Apollo City Hospital & Trauma Centre', TRUE,
      'Oxygen saturation 92%. Inhaler provided. Immediate ER transit required.'
    ) RETURNING id`,
    [student2.id, blockA.id, roomA102.id, healthStaff?.user_id || null]
  );

  if (ht2.rows.length > 0) {
    await db.query(
      `INSERT INTO vehicle_requests (
        health_ticket_id, requested_by, vehicle_type, hospital_name, driver_contact, status, dispatched_at
      ) VALUES (
        $1, $2, 'Ambulance', 'Apollo City Hospital & Trauma Centre', '+91 99880-11223', 'Dispatched', CURRENT_TIMESTAMP
      )`,
      [ht2.rows[0].id, healthStaff?.user_id || null]
    );
  }

  // ==========================================
  // MODULE 4: ROOM ALLOCATION & PEER GROUPS
  // ==========================================
  console.log('[SEED-OPERATIONS] 4. Seeding room allocation groups, waitlists, and move history...');
  // Ensure students have joined_on dates:
  // student1: 8 months tenure (eligible)
  // student2: 10 months tenure (eligible)
  // student3: 2 months tenure (ineligible)
  await db.query(`UPDATE students SET joined_on = CURRENT_DATE - INTERVAL '8 months' WHERE id = $1`, [student1.id]);
  await db.query(`UPDATE students SET joined_on = CURRENT_DATE - INTERVAL '10 months' WHERE id = $1`, [student2.id]);
  if (student3.id !== student1.id && student3.id !== student2.id) {
    await db.query(`UPDATE students SET joined_on = CURRENT_DATE - INTERVAL '2 months' WHERE id = $1`, [student3.id]);
  }

  // Create a peer group
  const grpRes = await db.query(
    `INSERT INTO room_groups (leader_id, group_name, target_class, target_year, target_gender, status)
     VALUES ($1, 'Apex Quad Innovators', $2, $3, $4, 'Submitted')
     RETURNING id`,
    [student1.id, student1.class || 'B.Tech CSE', student1.year || 2, student1.gender || 'male']
  );

  if (grpRes.rows.length > 0) {
    const grpId = grpRes.rows[0].id;
    await db.query(
      `INSERT INTO room_group_members (group_id, student_id, invite_status)
       VALUES 
        ($1, $2, 'Leader'),
        ($1, $3, 'Accepted')
       ON CONFLICT DO NOTHING`,
      [grpId, student1.id, student2.id]
    );

    // Place a room request on Waitlist for Room 201
    await db.query(
      `INSERT INTO room_requests (
        request_type, group_id, student_id, block_id, preferred_room_id, reason,
        status, queue_position, seniority_score
      ) VALUES (
        'GroupAllocation', $1, $2, $3, $4,
        'Second-year classmates forming an AI hackathon study pod. Room 201 has optimal high-speed LAN connectivity.',
        'Waitlisted', 1, 380
      )`,
      [grpId, student1.id, blockA.id, roomA201.id]
    );
  }

  // Seed Move History
  await db.query(
    `INSERT INTO room_history (student_id, from_room_id, to_room_id, move_type, authorized_by, notes)
     VALUES 
      ($1, NULL, $2, 'InitialAssignment', $3, 'Campus admission allocation for Academic Year 2026.'),
      ($4, NULL, $5, 'InitialAssignment', $3, 'Campus admission allocation for Academic Year 2026.')`,
    [student1.id, roomA101.id, warden1?.user_id || null, student2.id, roomA102.id]
  );

  console.log('[SEED-OPERATIONS] All 4 operations & student life modules successfully seeded with demo data!');
}

if (require.main === module) {
  db.initDb()
    .then(seedOperations)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[SEED-OPERATIONS-ERROR]', err);
      process.exit(1);
    });
}

module.exports = { seedOperations };
