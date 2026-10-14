const db = require('../../db');

/**
 * Shared Outpass Service
 * Exported getStudentsOut(date, mealTime) for kitchen meal count deduction.
 * Person 1 & Food Module call this to know how many students are away on approved outpass.
 *
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} mealTime - 'breakfast' | 'lunch' | 'snacks' | 'dinner'
 * @returns {Promise<Array<number>>} Array of student IDs who are out of campus
 */
async function getStudentsOut(date, mealTime = 'lunch') {
  if (!date) return [];

  // Approximate meal time windows
  const mealHours = {
    breakfast: '08:30:00',
    lunch: '13:00:00',
    snacks: '17:30:00',
    dinner: '20:00:00',
  };
  const targetHour = mealHours[mealTime] || '13:00:00';
  const targetTimestamp = `${date} ${targetHour}`;

  const sql = `
    SELECT student_id
    FROM outpasses
    WHERE status IN ('Approved', 'Out')
      AND out_time <= $1::timestamp
      AND expected_return_time >= $1::timestamp;
  `;

  try {
    const res = await db.query(sql, [targetTimestamp]);
    return res.rows.map(r => r.student_id);
  } catch (err) {
    console.warn(`[OUTPASS-SERVICE-WARN] getStudentsOut failed:`, err.message);
    return [];
  }
}

module.exports = {
  getStudentsOut,
};
