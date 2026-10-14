const db = require('../db');

/**
 * Log an audit trail entry for critical state changes & compliance
 * @param {Object} params
 * @param {number|null} [params.userId=null] - Acting user id
 * @param {string} params.action - e.g., 'STUDENT_REGISTER', 'STUDENT_APPROVE', 'MEAL_PREFERENCE_SET'
 * @param {string} params.entityType - 'student' | 'warden' | 'menu' | 'user' | 'system'
 * @param {string|number} [params.entityId=null] - Target entity ID
 * @param {number|null} [params.blockId=null] - Block scope for filtering
 * @param {Object} [params.details={}] - Arbitrary metadata
 * @param {string|null} [params.ipAddress=null] - Client IP address
 */
async function audit({ actorId, userId = null, action, entity, entityType, entityId = null, blockId = null, details = {}, ipAddress = null }) {
  try {
    const finalUserId = actorId || userId;
    const finalEntityType = entity || entityType || 'general';

    const res = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, block_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *`,
      [finalUserId, action, finalEntityType, String(entityId || ''), blockId, JSON.stringify(details), ipAddress]
    );
    return res.rows[0];
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err);
    // Non-blocking in case of secondary failures
    return null;
  }
}

module.exports = {
  audit,
};
