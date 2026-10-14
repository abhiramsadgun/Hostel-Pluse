/**
 * Pure Priority Score Calculation Engine
 * 
 * FORMULA:
 * Priority Score = Category Severity Weight (W_cat)
 *                + Waiting-Time Factor (hours_waiting * 0.75)
 *                + Student Impact Boost ((affected_count - 1) * 15.0)
 *                + Overdue Urgency Penalty (is_overdue ? 25.0 : 0.0)
 * 
 * DOCUMENTED WEIGHTS:
 * 1. Category Severity (W_cat):
 *    - security:    90 (Physical threat, perimeter safety, theft)
 *    - electrical:  80 (Fire hazard, shock danger, blackout, MCB trip)
 *    - plumbing:    75 (Water shortage, sewer overflow, major leak)
 *    - mess:        70 (Food safety, mass gastrointestinal risk)
 *    - internet:    65 (Academic connectivity, exams, assignment submission)
 *    - cleanliness: 50 (Hygiene, pest control, garbage collection)
 *    - furniture:   45 (Study desk, cot, window latch, cupboard)
 *    - other:       30 (General requests, inquiries)
 * 
 * 2. Waiting-Time Factor (F_wait = 0.75):
 *    - Accumulates 0.75 points per hour of waiting to prevent starvation
 *      of lower-severity tickets while respecting high initial urgency.
 * 
 * 3. Student Impact Multiplier (F_impact = 15.0):
 *    - Each additional affected student ("I'm also affected" upvote) adds 15 points.
 *    - 3 students reporting a corridor Wi-Fi issue adds +30 points.
 * 
 * 4. SLA Overdue Penalty:
 *    - Adds +25.0 points immediately once the complaint breaches its SLA window.
 */

const CATEGORY_SEVERITY_WEIGHTS = {
  security: 90,
  electrical: 80,
  plumbing: 75,
  mess: 70,
  internet: 65,
  cleanliness: 50,
  furniture: 45,
  other: 30,
};

const CATEGORY_SLA_HOURS = {
  security: 6,
  electrical: 12,
  plumbing: 12,
  mess: 12,
  internet: 18,
  cleanliness: 24,
  furniture: 48,
  other: 72,
};

/**
 * Pure function to calculate priority score
 * @param {Object} params
 * @param {string} params.categoryKey - Category slug (e.g., 'electrical')
 * @param {Date|string|number} params.createdAt - Creation timestamp
 * @param {number} [params.affectedCount=1] - Number of affected students (1 base + upvotes)
 * @param {number} [params.slaHours] - Per-category SLA in hours
 * @param {Date|string|number} [params.now=new Date()] - Reference timestamp for deterministic testing
 * @returns {number} Float priority score rounded to 2 decimal places
 */
function calculatePriorityScore({
  categoryKey = 'other',
  createdAt,
  affectedCount = 1,
  slaHours,
  now = new Date(),
}) {
  const normKey = (categoryKey || 'other').toLowerCase();
  const baseWeight = CATEGORY_SEVERITY_WEIGHTS[normKey] ?? 30;
  const sla = slaHours || CATEGORY_SLA_HOURS[normKey] || 24;

  const createdTime = new Date(createdAt).getTime();
  const currentTime = new Date(now).getTime();

  // Elapsed hours (cannot be negative)
  const elapsedMillis = Math.max(0, currentTime - createdTime);
  const elapsedHours = elapsedMillis / (1000 * 60 * 60);

  // 1. Waiting-time factor
  const waitingFactor = elapsedHours * 0.75;

  // 2. Student impact factor (additional students beyond original reporter)
  const additionalStudents = Math.max(0, (affectedCount || 1) - 1);
  const impactFactor = additionalStudents * 15.0;

  // 3. Overdue penalty
  const isOverdue = elapsedHours > sla;
  const overduePenalty = isOverdue ? 25.0 : 0.0;

  const totalScore = baseWeight + waitingFactor + impactFactor + overduePenalty;
  return Number(totalScore.toFixed(2));
}

module.exports = {
  calculatePriorityScore,
  CATEGORY_SEVERITY_WEIGHTS,
  CATEGORY_SLA_HOURS,
};
