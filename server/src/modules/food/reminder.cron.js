const db = require('../../db');
const { notify } = require('../../services/notify');

/**
 * Get Tomorrow's Date String in Asia/Kolkata
 */
function getTomorrowDateIST() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const pad = n => String(n).padStart(2, '0');
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
}

/**
 * Execute the 8:00 PM Reminder notification task
 * Finds all active students who haven't confirmed tomorrow's choices,
 * and delivers a notification via notify().
 */
async function sendNightlyReminderJob() {
  try {
    const tomorrowStr = getTomorrowDateIST();
    console.log(`[FOOD-CRON] Running 8:00 PM reminder check for date: ${tomorrowStr}...`);

    // 1. Fetch active students
    const studentsRes = await db.query(`
      SELECT s.id AS student_id, s.user_id, s.full_name, u.email
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.status = 'active'
    `);
    const allActiveStudents = studentsRes.rows;

    if (allActiveStudents.length === 0) {
      console.log('[FOOD-CRON] No active students found.');
      return { sentCount: 0, tomorrowStr };
    }

    // 2. Query students who already recorded preferences for tomorrow
    const confirmedRes = await db.query(
      `SELECT DISTINCT student_id FROM meal_preferences WHERE date = $1`,
      [tomorrowStr]
    );
    const confirmedSet = new Set(confirmedRes.rows.map(r => r.student_id));

    // 3. Filter students who haven't confirmed
    const unconfirmedStudents = allActiveStudents.filter(s => !confirmedSet.has(s.student_id));
    console.log(`[FOOD-CRON] ${unconfirmedStudents.length} of ${allActiveStudents.length} students have not yet confirmed choices for ${tomorrowStr}.`);

    let sentCount = 0;
    for (const student of unconfirmedStudents) {
      try {
        await notify({
          userId: student.user_id,
          type: 'food',
          title: 'Mess Alert: Confirm Tomorrow’s Meal Choice',
          message: `Hi ${student.full_name}, tomorrow's menu is ready! Please review and confirm your Veg / Non-Veg choices before the 9:00 PM cut-off tonight.`,
          link: '/dashboard',
        });
        sentCount++;
      } catch (nErr) {
        console.warn(`[FOOD-CRON] Failed to notify student ${student.student_id}:`, nErr.message);
      }
    }

    console.log(`[FOOD-CRON] Successfully dispatched ${sentCount} reminders.`);
    return { sentCount, tomorrowStr, unconfirmedCount: unconfirmedStudents.length };
  } catch (err) {
    console.error('[FOOD-CRON] Error executing nightly reminder job:', err);
    return { error: err.message };
  }
}

/**
 * Start the 8:00 PM Cron Job
 * Uses node-cron if available, or falls back to an exact minute-checker.
 */
function initFoodReminderCron() {
  let cronScheduled = false;

  try {
    const cron = require('node-cron');
    // Run at 20:00 (8:00 PM) everyday
    cron.schedule('0 20 * * *', () => {
      console.log('[FOOD-CRON] 8:00 PM IST triggered via node-cron.');
      sendNightlyReminderJob();
    }, {
      timezone: 'Asia/Kolkata',
    });
    cronScheduled = true;
    console.log('[FOOD-CRON] Initialized 8:00 PM Asia/Kolkata reminder job via node-cron.');
  } catch (err) {
    // node-cron not installed, fallback to native timer
    console.log('[FOOD-CRON] node-cron not installed; using built-in resilient interval scheduler (Asia/Kolkata).');
  }

  if (!cronScheduled) {
    let lastRunDate = '';
    setInterval(() => {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(new Date());
        const p = {};
        parts.forEach(part => (p[part.type] = part.value));

        const currentDateStr = `${p.year}-${p.month}-${p.day}`;
        const currentHour = parseInt(p.hour, 10);
        const currentMinute = parseInt(p.minute, 10);

        // Check if 8:00 PM (20:00) IST has arrived and hasn't run yet today
        if (currentHour === 20 && currentMinute === 0 && lastRunDate !== currentDateStr) {
          lastRunDate = currentDateStr;
          console.log('[FOOD-CRON] 8:00 PM IST triggered via fallback scheduler.');
          sendNightlyReminderJob();
        }
      } catch (tErr) {
        console.warn('[FOOD-CRON-TIMER] Tick warning:', tErr.message);
      }
    }, 30000); // Check every 30 seconds
  }
}

module.exports = {
  initFoodReminderCron,
  sendNightlyReminderJob,
};
