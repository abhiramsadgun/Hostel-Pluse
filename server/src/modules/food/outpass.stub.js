/**
 * Outpass Module Integration Stub
 * 
 * CONTRACT HOOK FOR TEAMMATE (Outpass Module):
 * This stub exports `getStudentsOut(date, mealType)` which returns an array of student IDs
 * who have an approved outpass during the given date and meal type.
 * 
 * When your teammate finishes the outpass module, they can either:
 * 1. Implement this function to query the `outpasses` table, OR
 * 2. Call `registerOutpassHandler(customFn)`.
 */

let customHandler = null;

/**
 * Register a custom outpass checker dynamically
 * @param {Function} handlerFn - async (date, mealType) => number[] (student IDs)
 */
function registerOutpassHandler(handlerFn) {
  customHandler = handlerFn;
}

/**
 * Get student IDs on approved outpass for the selected date and meal type
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} mealType - 'breakfast' | 'lunch' | 'snacks' | 'dinner'
 * @returns {Promise<number[]>} Array of student IDs to exclude from food prep
 */
async function getStudentsOut(date, mealType) {
  if (customHandler && typeof customHandler === 'function') {
    try {
      const result = await customHandler(date, mealType);
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn('[OUTPASS-HOOK] Custom handler error:', err.message);
      return [];
    }
  }

  // Default stub: returns empty list until outpass module is linked
  return [];
}

module.exports = {
  getStudentsOut,
  registerOutpassHandler,
};
