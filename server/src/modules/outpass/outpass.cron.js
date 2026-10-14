const db = require('../../db');
const { notify } = require('../../services/notify');

/**
 * Scheduled Late-Return Watchdog
 * Detects students currently OUT who have not returned past their expected return time.
 * Flags them as 'Overdue' and notifies block wardens and parents.
 */
async function runLateReturnWatchdog() {
  try {
    const overdueSql = `
      SELECT o.*, s.full_name as student_name, s.user_id as student_user_id,
             r.room_number, b.name as block_name
      FROM outpasses o
      JOIN students s ON s.id = o.student_id
      JOIN blocks b ON b.id = o.block_id
      LEFT JOIN rooms r ON r.id = o.room_id
      WHERE o.status = 'Out'
        AND CURRENT_TIMESTAMP > o.expected_return_time
        AND o.is_late_return = FALSE;
    `;

    const overdueRes = await db.query(overdueSql);

    if (overdueRes.rows.length > 0) {
      console.log(`[OUTPASS-WATCHDOG] Found ${overdueRes.rows.length} overdue outpass student(s).`);

      for (const op of overdueRes.rows) {
        // Mark as Overdue
        await db.query(
          `UPDATE outpasses
           SET status = 'Overdue', is_late_return = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [op.id]
        );

        // Notify Block Wardens
        const wardensRes = await db.query(
          `SELECT u.id as user_id FROM wardens w JOIN users u ON u.id = w.user_id WHERE w.block_id = $1`,
          [op.block_id]
        );
        for (const w of wardensRes.rows) {
          await notify({
            userId: w.user_id,
            type: 'outpass_overdue_alert',
            title: `CURFEW BREACH: ${op.student_name} (${op.outpass_number})`,
            message: `Student was expected at ${new Date(op.expected_return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Parent: ${op.parent_name} (${op.parent_phone}).`,
            link: `/warden/outpass/${op.id}`,
          });
        }

        // Notify Student
        await notify({
          userId: op.student_user_id,
          type: 'outpass_overdue_warning',
          title: `HOSTEL CURFEW BREACH: ${op.outpass_number}`,
          message: `Your permitted outpass expired at ${new Date(op.expected_return_time).toLocaleTimeString()}. Report to the main campus security gate immediately.`,
          link: `/student/outpass`,
        });
      }
    }
  } catch (err) {
    console.error('[OUTPASS-WATCHDOG-ERROR]', err.message);
  }
}

function initOutpassWatchdogCron() {
  console.log('[CRON] Initializing Outpass Curfew & Late Return Watchdog...');
  try {
    const cron = require('node-cron');
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', runLateReturnWatchdog);
  } catch (e) {
    setInterval(runLateReturnWatchdog, 5 * 60 * 1000);
  }

  setTimeout(runLateReturnWatchdog, 5000);
}

module.exports = {
  initOutpassWatchdogCron,
  runLateReturnWatchdog,
};
