const db = require('./index');
const { calculatePriorityScore } = require('../services/priority');

/**
 * 50+ Sample Historical Complaints Dataset for HostelPulse Hackathon Demo
 * Populates realistic cases across all 8 categories:
 * - Electrical, Plumbing, Furniture, Cleanliness, Internet, Mess, Security, Other
 * - Turnaround hours stored in resolution_history for the AI resolution predictor
 * - Student 1-5 star ratings and comments in complaint_feedback
 * - Realistic timeline entries in status_logs
 * - Upvotes in complaint_votes
 * - Overdue complaints for testing escalation
 * - 3+ recurring incidents in Room 101 (Block A) and Room 102 (Block B) to demonstrate recurring hotspots
 */
async function seedComplaints() {
  console.log('[SEED-COMPLAINTS] Seeding 50+ historical complaints and resolution data...');

  // Fetch blocks, rooms, students, staff
  const blocksRes = await db.query(`SELECT id, code FROM blocks`);
  const blockMap = {};
  for (const b of blocksRes.rows) blockMap[b.code] = b.id;

  const roomsRes = await db.query(`SELECT id, block_id, room_number FROM rooms`);
  const roomMap = {};
  for (const r of roomsRes.rows) roomMap[`${r.block_id}_${r.room_number}`] = r.id;

  const studentsRes = await db.query(`
    SELECT s.id, s.full_name, s.user_id, s.block_id, s.room_id 
    FROM students s 
    JOIN users u ON u.id = s.user_id 
    WHERE u.status = 'active'
  `);
  const students = studentsRes.rows;
  if (students.length === 0) {
    console.warn('[SEED-COMPLAINTS] No active students found to attach complaints to.');
    return;
  }

  const staffRes = await db.query(`SELECT id, full_name, department, specialisations FROM staff_profiles`);
  const staff = staffRes.rows;

  const plumberStaff = staff.find(s => s.specialisations && JSON.stringify(s.specialisations).toLowerCase().includes('plumb')) || staff[0];
  const electricStaff = staff.find(s => s.specialisations && JSON.stringify(s.specialisations).toLowerCase().includes('electric')) || staff[0];
  const messStaff = staff.find(s => s.department && s.department.toLowerCase().includes('dining')) || staff[0];
  const secStaff = staff.find(s => s.department && s.department.toLowerCase().includes('security')) || staff[0];

  const now = Date.now();
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;

  // 52 diverse, realistic incidents
  const sampleData = [
    // --- 1 to 10: PLUMBING (12h SLA) ---
    {
      title: 'Water tap leaking continuously in washbasin',
      desc: 'The brass tap in bathroom basin is dripping constantly, wasting water and creating a puddle.',
      cat: 'plumbing', block: 'BBA', room: '101', status: 'Resolved', daysAgo: 22, resHours: 6.5, rating: 5, comment: 'Fixed quickly, changed washer.', staff: plumberStaff,
    },
    {
      title: 'Low water pressure in 2nd floor shower',
      desc: 'Very weak water flow from shower head during morning rush 7-9 AM.',
      cat: 'plumbing', block: 'BBA', room: '201', status: 'Resolved', daysAgo: 19, resHours: 10.0, rating: 4, comment: 'Pressure restored after tank valve adjustment.', staff: plumberStaff,
    },
    {
      title: 'Severe drainage clog in Room 101 sink',
      desc: 'Water standing in sink for hours after washing hands. Dirty water overflowing.',
      cat: 'plumbing', block: 'BBA', room: '101', status: 'Resolved', daysAgo: 15, resHours: 8.0, rating: 4, comment: 'Plumber cleaned the trap pipe.', staff: plumberStaff,
    },
    {
      title: 'Flush tank valve not filling up automatically',
      desc: 'Toilet flush handle is stuck and inlet valve is jammed, cannot flush without bucket.',
      cat: 'plumbing', block: 'GBB', room: '101', status: 'Resolved', daysAgo: 12, resHours: 7.2, rating: 5, comment: 'Replaced ballcock assembly.', staff: plumberStaff,
    },
    {
      title: 'Pipe joint leaking under corridor water cooler',
      desc: 'Puddle formed in 1st floor corridor from cooler outlet pipe joint.',
      cat: 'plumbing', block: 'BBA', room: null, status: 'Resolved', daysAgo: 9, resHours: 5.5, rating: 5, comment: 'Teflon taped and joint tightened.', staff: plumberStaff,
    },
    {
      title: 'Bathroom drain clogged again with soap scum',
      desc: 'Third time this month bathroom water backing up into room doorway. Immediate cleaning needed.',
      cat: 'plumbing', block: 'BBA', room: '101', status: 'In Progress', daysAgo: 1, resHours: null, rating: null, comment: null, staff: plumberStaff, isRecurring: true, affectedCount: 2,
    },
    {
      title: 'Water geyser leaking hot water drops from base',
      desc: 'Small droplets leaking from geyser bottom near electrical thermostat cord. Potential danger.',
      cat: 'plumbing', block: 'GBB', room: '201', status: 'Assigned', daysAgo: 0.5, resHours: null, rating: null, comment: null, staff: plumberStaff, affectedCount: 1,
    },
    {
      title: 'Jet spray hose split near toilet seat',
      desc: 'High pressure spray hose tore open, spraying water everywhere when main tap is opened.',
      cat: 'plumbing', block: 'BBA', room: '102', status: 'Resolved', daysAgo: 4, resHours: 9.0, rating: 4, comment: 'Installed new steel braided hose.', staff: plumberStaff,
    },

    // --- 11 to 20: ELECTRICAL (12h SLA) ---
    {
      title: 'Ceiling fan making screeching bearing noise and running slow',
      desc: 'Fan wobbling at speed 4 and making loud grinding sound, disturbing study and sleep.',
      cat: 'electrical', block: 'BBA', room: '102', status: 'Resolved', daysAgo: 25, resHours: 7.0, rating: 4, comment: 'Replaced capacitor and bearing grease.', staff: electricStaff,
    },
    {
      title: 'Study desk switch socket burning smell and spark',
      desc: 'When plugging laptop charger, small spark was seen and black soot is visible around pin hole.',
      cat: 'electrical', block: 'GBB', room: '101', status: 'Resolved', daysAgo: 20, resHours: 4.5, rating: 5, comment: 'Switch plate replaced with modular 16A socket.', staff: electricStaff,
    },
    {
      title: 'Corridor tube light flickering constantly',
      desc: 'Tube light outside room 201 blinking rapidly for two days. Triggering headaches.',
      cat: 'electrical', block: 'BBA', room: '201', status: 'Resolved', daysAgo: 16, resHours: 5.0, rating: 5, comment: 'Replaced starter and LED tube.', staff: electricStaff,
    },
    {
      title: 'Main MCB trips whenever geyser is turned on',
      desc: 'Turning on bathroom geyser instantly trips room breaker on floor distribution board.',
      cat: 'electrical', block: 'GBB', room: '201', status: 'Resolved', daysAgo: 11, resHours: 8.5, rating: 4, comment: 'Heating element had earth leakage, replaced.', staff: electricStaff,
    },
    {
      title: 'Both ceiling lights not working in room 101',
      desc: 'Neither light switch turns on the lamps. Fuse appears blown.',
      cat: 'electrical', block: 'BBA', room: '101', status: 'Resolved', daysAgo: 6, resHours: 6.0, rating: 5, comment: 'Restored neutral wire connection.', staff: electricStaff,
    },
    {
      title: 'Power cut to left wing rooms - MCB tripped',
      desc: 'Multiple rooms 101-104 lost power simultaneously. MCB switch lever won’t stay up.',
      cat: 'electrical', block: 'BBA', room: null, status: 'In Progress', daysAgo: 0.3, resHours: null, rating: null, comment: null, staff: electricStaff, affectedCount: 4,
    },
    {
      title: 'Wall socket loose and hanging out of gang box',
      desc: 'Faceplate screws stripped, bare wires slightly visible inside cavity.',
      cat: 'electrical', block: 'GBB', room: '102', status: 'Overdue', daysAgo: 3, resHours: null, rating: null, comment: null, staff: null, isOverdue: true,
    },

    // --- 21 to 28: INTERNET & WI-FI (18h SLA) ---
    {
      title: 'Ethernet RJ45 wall jack broken - clip stuck inside',
      desc: 'Previous student cable broke inside port. Pins bent and LAN cable does not click in.',
      cat: 'internet', block: 'BBA', room: '101', status: 'Resolved', daysAgo: 24, resHours: 11.0, rating: 4, comment: 'Punched down new Cat6 keystone jack.', staff: electricStaff,
    },
    {
      title: 'Wi-Fi keeps dropping every 5 minutes in 2nd floor wing',
      desc: 'SSID HostelPulse-BBA connects then drops with IP configuration failure.',
      cat: 'internet', block: 'BBA', room: '201', status: 'Resolved', daysAgo: 17, resHours: 14.0, rating: 4, comment: 'AP rebooted and channel reassigned.', staff: electricStaff,
    },
    {
      title: 'No internet access - captive portal authentication failed',
      desc: 'Browser gets stuck on login gateway without prompting for student roll credentials.',
      cat: 'internet', block: 'GBB', room: '101', status: 'Resolved', daysAgo: 13, resHours: 9.5, rating: 5, comment: 'Firewall MAC table cleared.', staff: electricStaff,
    },
    {
      title: 'Extremely high latency and packet loss on LAN network',
      desc: 'Ping to campus gateway is exceeding 800ms. Online test submission impossible.',
      cat: 'internet', block: 'GBB', room: '102', status: 'Resolved', daysAgo: 7, resHours: 13.0, rating: 4, comment: 'Floor switch uplink looped cable resolved.', staff: electricStaff,
    },
    {
      title: 'Floor Wi-Fi access point completely dead (no LED light)',
      desc: 'Corridor ceiling access point outside room 102 has no power lights.',
      cat: 'internet', block: 'GBB', room: null, status: 'In Progress', daysAgo: 0.8, resHours: null, rating: null, comment: null, staff: electricStaff, affectedCount: 3,
    },
    {
      title: 'LAN port giving 10 Mbps speed instead of Gigabit',
      desc: 'Cable negotiated half duplex. Slow file download for lab assignments.',
      cat: 'internet', block: 'BBA', room: '102', status: 'Submitted', daysAgo: 0.2, resHours: null, rating: null, comment: null, staff: null,
    },

    // --- 29 to 35: CLEANLINESS & HYGIENE (24h SLA) ---
    {
      title: 'Corridor dustbin overflowing with food wrappers',
      desc: 'Large dustbin outside wing A has not been cleared since yesterday night. Flies gathering.',
      cat: 'cleanliness', block: 'BBA', room: null, status: 'Resolved', daysAgo: 23, resHours: 12.0, rating: 4, comment: 'Cleared and disinfected with phenyl.', staff: plumberStaff,
    },
    {
      title: 'Cockroaches spotted near room wardrobe and study table',
      desc: 'Multiple large cockroaches coming out of skirting gap at night. Requesting pest control spray.',
      cat: 'cleanliness', block: 'GBB', room: '101', status: 'Resolved', daysAgo: 18, resHours: 16.0, rating: 5, comment: 'Boric gel application completed.', staff: plumberStaff,
    },
    {
      title: 'Common washroom mirror and basin stained with hard water',
      desc: 'Discolored mirror and sticky counter. Regular deep cleaning needed.',
      cat: 'cleanliness', block: 'GBB', room: null, status: 'Resolved', daysAgo: 14, resHours: 13.5, rating: 4, comment: 'Descaling agent applied.', staff: plumberStaff,
    },
    {
      title: 'Water accumulated near staircase creating slippery moss',
      desc: 'AC dripping on stairs creating green algae. Serious slipping hazard for students.',
      cat: 'cleanliness', block: 'BBA', room: null, status: 'Resolved', daysAgo: 8, resHours: 11.0, rating: 5, comment: 'Scrubbed with bleaching powder.', staff: plumberStaff,
    },
    {
      title: 'Pest infestation in room 102 - bed bugs on cot frame',
      desc: 'Small bites on arms every morning. Wooden cot joints have bed bug clusters.',
      cat: 'cleanliness', block: 'GBB', room: '102', status: 'Assigned', daysAgo: 0.6, resHours: null, rating: null, comment: null, staff: plumberStaff,
    },
    {
      title: 'Trash not collected from room for two consecutive days',
      desc: 'Room cleaning staff skipped floor 2 rooms yesterday.',
      cat: 'cleanliness', block: 'BBA', room: '201', status: 'Submitted', daysAgo: 0.1, resHours: null, rating: null, comment: null, staff: null,
    },

    // --- 36 to 42: CARPENTRY & FURNITURE (48h SLA) ---
    {
      title: 'Study chair leg weld broken - wobbling dangerously',
      desc: 'Iron study chair front right leg cracked at joint. Student almost fell while studying.',
      cat: 'furniture', block: 'BBA', room: '102', status: 'Resolved', daysAgo: 26, resHours: 24.0, rating: 5, comment: 'Replaced with sturdy cushioned chair.', staff: plumberStaff,
    },
    {
      title: 'Almirah cupboard door latch jammed with lock inside',
      desc: 'Key turns but internal latch bar does not retract. Books trapped inside.',
      cat: 'furniture', block: 'GBB', room: '102', status: 'Resolved', daysAgo: 21, resHours: 18.0, rating: 4, comment: 'Lock cylinder lubricated and adjusted.', staff: plumberStaff,
    },
    {
      title: 'Window glass pane cracked and rattling in high wind',
      desc: 'Bottom glass pane on exterior window cracked across. Might shatter in monsoon wind.',
      cat: 'furniture', block: 'BBA', room: '201', status: 'Resolved', daysAgo: 10, resHours: 32.0, rating: 4, comment: 'Fitted 5mm frosted replacement glass.', staff: plumberStaff,
    },
    {
      title: 'Wooden study desk drawer rail broken off',
      desc: 'Drawer fell off slide runner and cannot be closed properly.',
      cat: 'furniture', block: 'GBB', room: '201', status: 'Resolved', daysAgo: 5, resHours: 26.0, rating: 5, comment: 'Installed new metal telescopic channel.', staff: plumberStaff,
    },
    {
      title: 'Bed cot plywood ply sagging in the middle',
      desc: 'Plywood sheet under mattress cracked in center support beam.',
      cat: 'furniture', block: 'BBA', room: '101', status: 'Assigned', daysAgo: 1.2, resHours: null, rating: null, comment: null, staff: plumberStaff,
    },

    // --- 43 to 48: MESS & FOOD QUALITY (12h SLA) ---
    {
      title: 'Undercooked rice and cold dal during Wednesday lunch',
      desc: 'Rice grains were hard and raw in the center. Multiple students left food uneaten.',
      cat: 'mess', block: 'BBA', room: null, status: 'Resolved', daysAgo: 27, resHours: 4.5, rating: 4, comment: 'Caterer warned; additional steamer added.', staff: messStaff,
    },
    {
      title: 'Hair found in morning sambar bucket',
      desc: 'Kitchen staff not wearing hairnets while serving hot sambar at counter.',
      cat: 'mess', block: 'GBB', room: null, status: 'Resolved', daysAgo: 15, resHours: 5.0, rating: 4, comment: 'Enforced hairnets and replaced batch.', staff: messStaff,
    },
    {
      title: 'Drinking water dispenser in mess hall tasting of rust',
      desc: 'Filter candle appears clogged. Metallic smell in water glasses.',
      cat: 'mess', block: 'BBA', room: null, status: 'Resolved', daysAgo: 8, resHours: 7.0, rating: 5, comment: 'RO membrane and carbon filter replaced.', staff: messStaff,
    },
    {
      title: 'Dinner chapati extremely hard and dry',
      desc: 'Rotis served like cardboard, not kept in hot case.',
      cat: 'mess', block: 'GBB', room: null, status: 'In Progress', daysAgo: 0.4, resHours: null, rating: null, comment: null, staff: messStaff, affectedCount: 5,
    },

    // --- 49 to 53: SECURITY & GATE ENTRY (6h SLA) ---
    {
      title: 'Biometric turnstile not recognizing student fingerprint',
      desc: 'Gate machine gave repeated error buzzer for 10 minutes at campus curfew.',
      cat: 'security', block: 'BBA', room: null, status: 'Resolved', daysAgo: 22, resHours: 3.2, rating: 5, comment: 'Cleaned optical glass and re-synced template.', staff: secStaff,
    },
    {
      title: 'Corridor CCTV camera in 1st floor wing has tilted facing ceiling',
      desc: 'Camera angle was knocked out of position during luggage shifting.',
      cat: 'security', block: 'GBB', room: null, status: 'Resolved', daysAgo: 16, resHours: 2.8, rating: 5, comment: 'Re-aligned dome camera angle.', staff: secStaff,
    },
    {
      title: 'Lost student laminated ID card near sports ground',
      desc: 'Dropped ID card HID-BBA-001 around basketball court at 6 PM. Reporting immediately.',
      cat: 'security', block: 'BBA', room: '101', status: 'Resolved', daysAgo: 12, resHours: 4.0, rating: 5, comment: 'Recovered at security desk.', staff: secStaff,
    },
    {
      title: 'Late check-in dispute with gate guard over biometric clock sync',
      desc: 'Guard clock was running 8 minutes ahead of atomic time, marking false late gate pass.',
      cat: 'security', block: 'GBB', room: null, status: 'Resolved', daysAgo: 3, resHours: 3.5, rating: 4, comment: 'NTP server synced on gate machine.', staff: secStaff,
    },
    {
      title: 'Unknown non-resident seen wandering in Block B stairwell',
      desc: 'Person without visitor badge loitering on 2nd floor staircase at 8:30 PM.',
      cat: 'security', block: 'GBB', room: null, status: 'Resolved', daysAgo: 2, resHours: 1.5, rating: 5, comment: 'Guard escorted unauthorized visitor off premises.', staff: secStaff,
    },

    // --- 54 to 55: OTHER CAMPUS SUPPORT ---
    {
      title: 'Request for extra study table lamp in reading room',
      desc: 'Reading hall desks 4 and 5 are in a shadow zone after sunset.',
      cat: 'other', block: 'BBA', room: null, status: 'Resolved', daysAgo: 18, resHours: 20.0, rating: 5, comment: 'Installed supplementary goose neck lamp.', staff: electricStaff,
    },
    {
      title: 'Need duplicate key for room wardrobe lock',
      desc: 'Spare key lost by previous roommate. Only single key currently exists.',
      cat: 'other', block: 'GBB', room: '101', status: 'Resolved', daysAgo: 5, resHours: 15.0, rating: 4, comment: 'Duplicate key cut by locksmith.', staff: plumberStaff,
    },
  ];

  let insertedCount = 0;
  for (let i = 0; i < sampleData.length; i++) {
    const item = sampleData[i];
    const paddedId = String(i + 1).padStart(6, '0');
    const complaintId = `HCM-2026-${paddedId}`;

    // Map block & room
    const blockId = blockMap[item.block] || blockMap['BBA'];
    const roomId = item.room ? roomMap[`${blockId}_${item.room}`] : null;

    // Pick student
    const student = students.find(s => s.block_id === blockId) || students[0];

    // Compute creation & resolution timestamps
    const createdAt = new Date(now - item.daysAgo * DAY_MS);
    const resolvedAt = item.status === 'Resolved' || item.status === 'Closed'
      ? new Date(createdAt.getTime() + (item.resHours || 8) * HOUR_MS)
      : null;

    // Check SLA
    const slaHours = item.cat === 'security' ? 6 : item.cat === 'plumbing' || item.cat === 'electrical' || item.cat === 'mess' ? 12 : item.cat === 'internet' ? 18 : item.cat === 'cleanliness' ? 24 : item.cat === 'furniture' ? 48 : 72;
    const isOverdue = item.isOverdue || (item.status !== 'Resolved' && item.status !== 'Closed' && (now - createdAt.getTime()) / HOUR_MS > slaHours);

    // Compute Priority Score
    const priorityScore = calculatePriorityScore({
      categoryKey: item.cat,
      createdAt,
      affectedCount: item.affectedCount || 1,
      slaHours,
      now,
    });

    const isRecurring = item.isRecurring || false;
    const assignedStaffId = item.staff ? item.staff.id : null;

    try {
      const res = await db.query(
        `INSERT INTO complaints (
          complaint_id, title, description, category_key,
          student_id, block_id, room_id, is_anonymous, status,
          priority_score, predicted_hours, predicted_resolution_at, sla_hours,
          is_overdue, is_recurring, affected_count,
          assigned_staff_id, assigned_note, assigned_at, resolved_at,
          ai_confidence, ai_suggested_category, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0.92, $4, $20, $21)
        ON CONFLICT (complaint_id) DO NOTHING
        RETURNING id`,
        [
          complaintId,
          item.title,
          item.desc,
          item.cat,
          student.id,
          blockId,
          roomId,
          item.status === 'Overdue' ? 'In Progress' : item.status,
          priorityScore,
          item.resHours || 12.0,
          new Date(createdAt.getTime() + (item.resHours || 12.0) * HOUR_MS),
          slaHours,
          isOverdue,
          isRecurring,
          item.affectedCount || 1,
          assignedStaffId,
          assignedStaffId ? 'Assigned by block warden.' : null,
          assignedStaffId ? new Date(createdAt.getTime() + 1 * HOUR_MS) : null,
          resolvedAt,
          createdAt,
          resolvedAt || createdAt,
        ]
      );

      if (res.rows.length > 0) {
        const cId = res.rows[0].id;
        insertedCount++;

        // Status log initial
        await db.query(
          `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_role, actor_name, notes, created_at)
           VALUES ($1, NULL, 'Submitted', 'student', $2, 'Lodged via Student Portal', $3)`,
          [cId, student.full_name, createdAt]
        );

        if (assignedStaffId) {
          await db.query(
            `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_role, actor_name, notes, created_at)
             VALUES ($1, 'Submitted', 'Assigned', 'warden', 'Block Warden', $2, $3)`,
            [cId, `Dispatched to ${item.staff.full_name}`, new Date(createdAt.getTime() + 1 * HOUR_MS)]
          );
        }

        // If resolved, seed resolution_history
        if (resolvedAt && item.resHours) {
          await db.query(
            `INSERT INTO resolution_history (
              complaint_id, category_key, assigned_staff_id, resolution_hours, resolution_notes, resolved_at, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [cId, item.cat, assignedStaffId, item.resHours, item.comment || 'Issue fixed.', resolvedAt]
          );

          await db.query(
            `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_role, actor_name, notes, created_at)
             VALUES ($1, 'Assigned', 'Resolved', 'maintenance', $2, $3, $4)`,
            [cId, item.staff?.full_name || 'Technician', item.comment || 'Repair completed.', resolvedAt]
          );
        }

        // If feedback exists, seed complaint_feedback
        if (item.rating) {
          await db.query(
            `INSERT INTO complaint_feedback (complaint_id, student_id, rating, comments, created_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (complaint_id) DO NOTHING`,
            [cId, student.id, item.rating, item.comment, new Date(resolvedAt.getTime() + 2 * HOUR_MS)]
          );
        }

        // Seed upvotes if affectedCount > 1
        if (item.affectedCount && item.affectedCount > 1) {
          for (let v = 1; v < item.affectedCount; v++) {
            const voter = students[(v + i) % students.length];
            await db.query(
              `INSERT INTO complaint_votes (complaint_id, student_id)
               VALUES ($1, $2)
               ON CONFLICT (complaint_id, student_id) DO NOTHING`,
              [cId, voter.id]
            );
          }
        }
      }
    } catch (rowErr) {
      console.warn(`[SEED-COMPLAINT-ROW-WARN] Item ${i}:`, rowErr.message);
    }
  }

  // Seed recurring hotspot flags (e.g. Room 101 BBA plumbing, Room 102 GBB cleanliness)
  const room101BBA = roomMap[`${blockMap['BBA']}_101`];
  if (room101BBA) {
    await db.query(
      `INSERT INTO recurring_issue_flags (
        category_key, block_id, room_id, scope_type, occurrence_count,
        first_reported_at, last_reported_at, is_active
      )
      VALUES ('plumbing', $1, $2, 'room', 3, CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP, TRUE)`,
      [blockMap['BBA'], room101BBA]
    );
  }

  const room102GBB = roomMap[`${blockMap['GBB']}_102`];
  if (room102GBB) {
    await db.query(
      `INSERT INTO recurring_issue_flags (
        category_key, block_id, room_id, scope_type, occurrence_count,
        first_reported_at, last_reported_at, is_active
      )
      VALUES ('cleanliness', $1, $2, 'room', 3, CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP, TRUE)`,
      [blockMap['GBB'], room102GBB]
    );
  }

  console.log(`[SEED-COMPLAINTS] Successfully seeded ${insertedCount} historical complaints with empirical telemetry.`);
}

module.exports = { seedComplaints };

if (require.main === module) {
  seedComplaints()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
