const db = require('../../db');
const { notify } = require('../../services/notify');
const { calculatePriorityScore } = require('../../services/priority');

/**
 * Core Escalation and SLA Monitoring Job
 * 1. Detects tickets exceeding predicted time or category SLA.
 * 2. Marks is_overdue = TRUE and adds overdue priority penalty.
 * 3. Notifies Block Wardens and residents.
 * 4. Detects recurring hotspots (3+ incidents in 30 days).
 */
async function runEscalationCycle() {
  try {
    // 1. SLA Breach & Overdue Check
    const overdueSql = `
      SELECT c.*, s.user_id as student_user_id, s.full_name as student_name
      FROM complaints c
      JOIN students s ON s.id = c.student_id
      WHERE c.status NOT IN ('Resolved', 'Closed')
        AND c.is_overdue = FALSE
        AND (
          CURRENT_TIMESTAMP > c.predicted_resolution_at
          OR EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.created_at)) / 3600.0 > c.sla_hours
        );
    `;
    const overdueRes = await db.query(overdueSql);

    if (overdueRes.rows.length > 0) {
      console.log(`[ESCALATION-CRON] Found ${overdueRes.rows.length} overdue complaint(s) breaching SLA.`);

      for (const comp of overdueRes.rows) {
        // Mark overdue
        await db.query(
          `UPDATE complaints SET is_overdue = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [comp.id]
        );

        // Recalculate priority with overdue penalty
        const updatedScore = calculatePriorityScore({
          categoryKey: comp.category_key,
          createdAt: comp.created_at,
          affectedCount: comp.affected_count,
          slaHours: comp.sla_hours,
        });
        await db.query(`UPDATE complaints SET priority_score = $1 WHERE id = $2`, [updatedScore, comp.id]);

        // Write status log entry
        await db.query(
          `INSERT INTO status_logs (complaint_id, from_status, to_status, actor_role, actor_name, notes)
           VALUES ($1, $2, $2, 'system', 'Escalation Watchdog', $3)`,
          [comp.id, comp.status, `Automated SLA Breach Trigger: Exceeded ${comp.sla_hours}h SLA limit. Priority escalated to ${updatedScore}.`]
        );

        // Notify Block Wardens
        const wardensRes = await db.query(
          `SELECT u.id as user_id FROM wardens w JOIN users u ON u.id = w.user_id WHERE w.block_id = $1`,
          [comp.block_id]
        );
        for (const w of wardensRes.rows) {
          await notify({
            userId: w.user_id,
            type: 'escalation_alert',
            title: `OVERDUE ESCALATION: ${comp.complaint_id}`,
            message: `Ticket "${comp.title}" (${comp.category_key}) has breached its ${comp.sla_hours}h SLA without resolution.`,
            link: `/warden/complaints/${comp.id}`,
          });
        }

        // Notify Resident
        await notify({
          userId: comp.student_user_id,
          type: 'escalation_update',
          title: `Update on ${comp.complaint_id}`,
          message: `Your ticket has passed its target resolution time and has been escalated with high priority to hostel authorities.`,
          link: `/student/complaints/${comp.id}`,
        });
      }
    }

    // 2. Recurring Hotspot Detection (3+ incidents in 30 days)
    await runRecurringHotspotsCheck();
  } catch (err) {
    console.error('[ESCALATION-CRON-ERROR]', err.message);
  }
}

/**
 * Scan for recurring issues: 3+ occurrences in the same room or block within 30 days
 */
async function runRecurringHotspotsCheck() {
  try {
    // Room-level recurrence
    const roomSql = `
      SELECT block_id, room_id, category_key, COUNT(*) as cnt,
             MIN(created_at) as first_rep, MAX(created_at) as last_rep
      FROM complaints
      WHERE room_id IS NOT NULL
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY block_id, room_id, category_key
      HAVING COUNT(*) >= 3;
    `;
    const roomHotspots = await db.query(roomSql);

    for (const spot of roomHotspots.rows) {
      // Upsert into recurring_issue_flags
      await db.query(
        `INSERT INTO recurring_issue_flags (
          category_key, block_id, room_id, scope_type, occurrence_count,
          first_reported_at, last_reported_at, is_active
        )
        VALUES ($1, $2, $3, 'room', $4, $5, $6, TRUE)`,
        [spot.category_key, spot.block_id, spot.room_id, spot.cnt, spot.first_rep, spot.last_rep]
      );

      // Flag matching open complaints
      await db.query(
        `UPDATE complaints
         SET is_recurring = TRUE
         WHERE block_id = $1 AND room_id = $2 AND category_key = $3`,
        [spot.block_id, spot.room_id, spot.category_key]
      );
    }

    // Block-level recurrence (for common areas without specific rooms, e.g. Wi-Fi router / washroom)
    const blockSql = `
      SELECT block_id, category_key, COUNT(*) as cnt,
             MIN(created_at) as first_rep, MAX(created_at) as last_rep
      FROM complaints
      WHERE room_id IS NULL
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY block_id, category_key
      HAVING COUNT(*) >= 3;
    `;
    const blockHotspots = await db.query(blockSql);

    for (const spot of blockHotspots.rows) {
      await db.query(
        `INSERT INTO recurring_issue_flags (
          category_key, block_id, room_id, scope_type, occurrence_count,
          first_reported_at, last_reported_at, is_active
        )
        VALUES ($1, $2, NULL, 'block', $3, $4, $5, TRUE)`,
        [spot.category_key, spot.block_id, spot.cnt, spot.first_rep, spot.last_rep]
      );

      await db.query(
        `UPDATE complaints
         SET is_recurring = TRUE
         WHERE block_id = $1 AND category_key = $2`,
        [spot.block_id, spot.category_key]
      );
    }
  } catch (rErr) {
    console.warn('[RECURRING-SCAN-WARN]', rErr.message);
  }
}

/**
 * Initialize Escalation Cron Watchdog
 */
function initEscalationCron() {
  console.log('[CRON] Initializing Escalation & Recurring Issue Watchdog...');

  // Try node-cron if available, otherwise use resilient timer interval
  let cronInstalled = false;
  try {
    const cron = require('node-cron');
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      runEscalationCycle();
    });
    cronInstalled = true;
    console.log('[CRON] node-cron registered for complaint escalation (every 10 minutes).');
  } catch (e) {
    // Pure timer fallback (runs every 5 minutes)
    setInterval(runEscalationCycle, 5 * 60 * 1000);
    console.log('[CRON] Pure timer registered for complaint escalation (every 5 minutes).');
  }

  // Probe immediately on boot after DB stabilizes
  setTimeout(() => {
    runEscalationCycle();
  }, 4000);
}

module.exports = {
  initEscalationCron,
  runEscalationCycle,
  runRecurringHotspotsCheck,
};
