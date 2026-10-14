/**
 * Outpass Module Integration Hook
 * 
 * CONTRACT FOR TEAMMATE (Outpass / Room Allocation Module):
 * This function is invoked by the Mess & Food Module to exclude students
 * who hold an active, approved outpass for a given date and meal type.
 * 
 * If you add an `outpasses` table, simply replace or augment this query:
 *   SELECT student_id FROM outpasses 
 *   WHERE status = 'approved' AND $1 BETWEEN from_date AND to_date;
 */
const db = require('../db');

let customOutpassProvider = null;

/**
 * Register a custom outpass provider function dynamically
 * @param {Function} providerFn - async (date, mealType) => number[] (student IDs)
 */
function registerOutpassProvider(providerFn) {
  customOutpassProvider = providerFn;
}

/**
 * Retrieve array of student IDs with approved outpasses for a specific meal
 * @param {string|Date} mealDate - Format 'YYYY-MM-DD'
 * @param {string} mealType - 'breakfast' | 'lunch' | 'snacks' | 'dinner'
 * @returns {Promise<number[]>} Array of student IDs
 */
async function getApprovedOutpassStudentIds(mealDate, mealType) {
  if (customOutpassProvider) {
    return await customOutpassProvider(mealDate, mealType);
  }

  // Check if an outpasses table exists in the database
  try {
    const tableCheck = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'outpasses'`
    );

    if (tableCheck.rows.length > 0) {
      const res = await db.query(
        `SELECT DISTINCT student_id 
         FROM outpasses 
         WHERE status = 'approved' 
           AND $1::date >= start_date::date 
           AND $1::date <= end_date::date`,
        [mealDate]
      );
      return res.rows.map(r => r.student_id);
    }
  } catch (err) {
    // Table not yet created by outpass teammate
  }

  // Default contract stub: returns empty array (no students excluded)
  return [];
}

module.exports = {
  getApprovedOutpassStudentIds,
  registerOutpassProvider,
};
