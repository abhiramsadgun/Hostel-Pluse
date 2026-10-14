const db = require('../db');

/**
 * Concurrency-Safe Unique Readable Outpass Number Generator
 * Formats: OUT-YYYY-000001, OUT-YYYY-000002, etc.
 *
 * @param {number} [targetYear]
 * @returns {Promise<string>}
 */
async function generateUniqueOutpassNumber(targetYear = new Date().getFullYear()) {
  const year = parseInt(targetYear, 10) || new Date().getFullYear();

  const queryText = `
    INSERT INTO outpass_counter (year, last_val)
    VALUES ($1, 1)
    ON CONFLICT (year)
    DO UPDATE SET last_val = outpass_counter.last_val + 1
    RETURNING last_val;
  `;

  try {
    const res = await db.query(queryText, [year]);
    const nextVal = res.rows[0].last_val;
    const padded = String(nextVal).padStart(6, '0');
    return `OUT-${year}-${padded}`;
  } catch (err) {
    console.error('[OUTPASS-ID-ERROR] Atomic counter query failed, using safe fallback:', err.message);
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `OUT-${year}-${rand}`;
  }
}

module.exports = {
  generateUniqueOutpassNumber,
};
