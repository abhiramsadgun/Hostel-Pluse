const db = require('../../db');

/**
 * Exported Room Services helper for external modules & student dashboard
 * Returns upcoming and past service schedules for a specific room.
 *
 * @param {number|string} roomId
 * @returns {Promise<Array>}
 */
async function getRoomServices(roomId) {
  const parsedId = parseInt(roomId, 10);
  if (!parsedId) return [];

  const sql = `
    SELECT 
      ss.*,
      b.name as block_name,
      b.code as block_code,
      r.room_number,
      sp.full_name as assigned_staff_name,
      u_staff.phone as assigned_staff_phone,
      sp.designation as assigned_staff_designation
    FROM service_schedules ss
    JOIN blocks b ON b.id = ss.block_id
    JOIN rooms r ON r.id = ss.room_id
    LEFT JOIN staff_profiles sp ON sp.id = ss.assigned_staff_id
    LEFT JOIN users u_staff ON u_staff.id = sp.user_id
    WHERE ss.room_id = $1
    ORDER BY ss.scheduled_date DESC, ss.created_at DESC;
  `;

  try {
    const res = await db.query(sql, [parsedId]);
    return res.rows;
  } catch (err) {
    console.warn(`[ROOM-SERVICES-WARN] Error fetching room services for room ${roomId}:`, err.message);
    return [];
  }
}

module.exports = {
  getRoomServices,
};
