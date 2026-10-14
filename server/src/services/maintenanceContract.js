/**
 * Maintenance Module Integration Hook
 * 
 * CONTRACT FOR TEAMMATE (Complaints / AI Dispatch Module):
 * This service allows the Complaints & AI module to query active maintenance
 * personnel and auto-suggest assignees based on category specialisation.
 */
const db = require('../db');

/**
 * Retrieve active maintenance personnel matching category specialisation
 * @param {string} [categoryName] - e.g., 'Plumbing & Water Supply', 'Electrical & Lighting'
 * @returns {Promise<Array>} List of maintenance staff with `isBestMatch: true` if specialised
 */
async function getSuggestedMaintenanceAssignees(categoryName = '') {
  try {
    const query = `
      SELECT sp.id, sp.staff_id_number, sp.full_name, sp.department, sp.designation,
             sp.specialisations, sp.is_active, u.email, u.phone
      FROM staff_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.role = 'maintenance' AND sp.is_active = TRUE
      ORDER BY sp.full_name ASC
    `;
    const result = await db.query(query);

    return result.rows.map(staff => {
      const specs = typeof staff.specialisations === 'string'
        ? JSON.parse(staff.specialisations)
        : (staff.specialisations || []);

      const isBestMatch = categoryName
        ? specs.some(c => c.toLowerCase().trim() === categoryName.toLowerCase().trim())
        : false;

      return {
        id: staff.id,
        staffIdNumber: staff.staff_id_number,
        fullName: staff.full_name,
        department: staff.department,
        designation: staff.designation,
        specialisations: specs,
        isActive: staff.is_active,
        email: staff.email,
        phone: staff.phone,
        isBestMatch,
      };
    }).sort((a, b) => (b.isBestMatch ? 1 : 0) - (a.isBestMatch ? 1 : 0));
  } catch (err) {
    console.error('[MAINTENANCE-CONTRACT] Error fetching assignees:', err);
    return [];
  }
}

module.exports = {
  getSuggestedMaintenanceAssignees,
};
