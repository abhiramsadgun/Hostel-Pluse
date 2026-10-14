const db = require('../db');

// Sensible default resolution turnarounds in hours
const DEFAULT_PREDICTED_HOURS = {
  security: 4.0,
  electrical: 8.0,
  plumbing: 9.5,
  mess: 6.0,
  internet: 12.0,
  cleanliness: 14.0,
  furniture: 28.0,
  other: 36.0,
};

/**
 * Predicts resolution hours based on empirical historical resolution records
 * in resolution_history, blended with default category baselines.
 *
 * @param {string} categoryKey
 * @returns {Promise<{ predictedHours: number, confidence: string, sampleCount: number, source: string }>}
 */
async function predictResolutionHours(categoryKey = 'other') {
  const normalizedKey = (categoryKey || 'other').toLowerCase();
  const defaultHours = DEFAULT_PREDICTED_HOURS[normalizedKey] || 24.0;

  try {
    const res = await db.query(
      `SELECT AVG(resolution_hours) as avg_hours, COUNT(*) as sample_count
       FROM resolution_history
       WHERE category_key = $1`,
      [normalizedKey]
    );

    const row = res.rows[0];
    const sampleCount = row ? parseInt(row.sample_count, 10) : 0;
    const avgHours = row && row.avg_hours ? parseFloat(row.avg_hours) : null;

    if (sampleCount >= 2 && avgHours && avgHours > 0) {
      // Bayesian blending: weight historical average higher as sample size grows
      const weight = Math.min(0.9, 0.6 + sampleCount * 0.05);
      const blended = weight * avgHours + (1 - weight) * defaultHours;
      const rounded = Number(blended.toFixed(1));

      return {
        predictedHours: rounded,
        confidence: sampleCount >= 5 ? 'high' : 'medium',
        sampleCount,
        source: `Historical average of ${sampleCount} resolved incidents (${avgHours.toFixed(1)}h)`,
      };
    }

    return {
      predictedHours: defaultHours,
      confidence: 'baseline',
      sampleCount: 0,
      source: 'HostelPulse category SLA baseline default',
    };
  } catch (err) {
    console.warn(`[PREDICTOR-WARN] Fallback for ${categoryKey}:`, err.message);
    return {
      predictedHours: defaultHours,
      confidence: 'fallback',
      sampleCount: 0,
      source: 'Standard fallback baseline',
    };
  }
}

module.exports = {
  predictResolutionHours,
  DEFAULT_PREDICTED_HOURS,
};
