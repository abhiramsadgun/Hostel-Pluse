const db = require('../db');

/**
 * Clean and extract significant keywords from title + description
 */
function extractKeywords(text = '') {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of',
    'my', 'our', 'room', 'hostel', 'not', 'working', 'please', 'help', 'fix',
    'issue', 'problem', 'there', 'has', 'have', 'been', 'with', 'very', 'too',
    'from', 'this', 'that', 'they', 'we', 'are', 'was', 'were', 'it', 'its',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word));
}

/**
 * Calculate Jaccard similarity index between two keyword arrays
 */
function calculateJaccardSimilarity(wordsA, wordsB) {
  if (!wordsA.length || !wordsB.length) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersectionCount = 0;
  for (const w of setA) {
    if (setB.has(w)) intersectionCount++;
  }

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Detect similar complaints in the same block and category within a time window
 * @param {Object} params
 * @param {number} params.blockId
 * @param {string} params.categoryKey
 * @param {string} params.title
 * @param {string} params.description
 * @param {number} [params.excludeId] - Don't compare complaint with itself
 * @param {number} [params.windowDays=7]
 * @returns {Promise<Array<{ complaint: Object, similarity: number, sharedKeywords: string[], shouldMerge: boolean }>>}
 */
async function findSimilarComplaints({
  blockId,
  categoryKey,
  title,
  description,
  excludeId = null,
  windowDays = 7,
}) {
  if (!blockId || !categoryKey) return [];

  const targetKeywords = extractKeywords(`${title} ${description}`);
  if (targetKeywords.length === 0) return [];

  // Query recent or active complaints in the same block & category
  let querySql = `
    SELECT c.id, c.complaint_id, c.title, c.description, c.category_key,
           c.status, c.priority_score, c.room_id, c.affected_count, c.created_at,
           r.room_number, s.full_name as student_name
    FROM complaints c
    LEFT JOIN rooms r ON r.id = c.room_id
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.block_id = $1
      AND c.category_key = $2
      AND c.status NOT IN ('Closed', 'Resolved')
      AND c.parent_complaint_id IS NULL
  `;
  const params = [blockId, categoryKey];

  if (excludeId) {
    params.push(excludeId);
    querySql += ` AND c.id != $${params.length}`;
  }

  querySql += ` ORDER BY c.created_at DESC LIMIT 20`;

  try {
    const res = await db.query(querySql, params);
    const candidates = [];

    for (const comp of res.rows) {
      const compKeywords = extractKeywords(`${comp.title} ${comp.description}`);
      const similarity = calculateJaccardSimilarity(targetKeywords, compKeywords);

      // Find shared keywords
      const setComp = new Set(compKeywords);
      const shared = targetKeywords.filter(w => setComp.has(w));

      // Same room bonus: if in the exact same room, bump similarity score
      let adjustedSimilarity = similarity;
      if (comp.room_id && params.roomId && comp.room_id === params.roomId) {
        adjustedSimilarity = Math.min(1.0, similarity + 0.3);
      }

      if (adjustedSimilarity >= 0.28 || shared.length >= 2) {
        candidates.push({
          complaint: comp,
          similarity: Number(adjustedSimilarity.toFixed(2)),
          sharedKeywords: Array.from(new Set(shared)),
          shouldMerge: adjustedSimilarity >= 0.45 || shared.length >= 3,
        });
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates;
  } catch (err) {
    console.warn('[SIMILARITY-WARN] Failed detecting similar complaints:', err.message);
    return [];
  }
}

module.exports = {
  findSimilarComplaints,
  extractKeywords,
  calculateJaccardSimilarity,
};
