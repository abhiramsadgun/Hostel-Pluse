const db = require('../../db');

/**
 * 1. Comprehensive Analytics Dashboard Data
 * GET /api/v1/analytics/dashboard
 */
async function getDashboardAnalytics(req, res) {
  try {
    const wardenBlockId = req.scope?.blockId || req.user?.blockId;
    const isWarden = req.user?.role === 'warden';

    let blockFilterSql = '';
    const params = [];
    if (isWarden && wardenBlockId) {
      params.push(wardenBlockId);
      blockFilterSql = `WHERE block_id = $${params.length}`;
    }

    // 1. Complaints by Category
    const catSql = `
      SELECT category_key, COUNT(*) as count
      FROM complaints
      ${blockFilterSql}
      GROUP BY category_key
      ORDER BY count DESC;
    `;
    const catRes = await db.query(catSql, params);

    // 2. Pending vs Resolved Status Overview
    const statusSql = `
      SELECT status, COUNT(*) as count
      FROM complaints
      ${blockFilterSql}
      GROUP BY status;
    `;
    const statusRes = await db.query(statusSql, params);
    const statusMap = {
      Submitted: 0,
      Assigned: 0,
      'In Progress': 0,
      Resolved: 0,
      Closed: 0,
      Reopened: 0,
    };
    for (const r of statusRes.rows) {
      statusMap[r.status] = parseInt(r.count, 10);
    }

    const pendingCount = (statusMap.Submitted || 0) + (statusMap.Assigned || 0) + (statusMap['In Progress'] || 0) + (statusMap.Reopened || 0);
    const resolvedCount = (statusMap.Resolved || 0) + (statusMap.Closed || 0);

    // 3. Average Resolution Time by Category (from empirical resolution_history)
    const avgTimeSql = `
      SELECT rh.category_key,
             ROUND(AVG(rh.resolution_hours)::numeric, 1) as avg_hours,
             COUNT(*) as sample_count
      FROM resolution_history rh
      GROUP BY rh.category_key
      ORDER BY avg_hours ASC;
    `;
    const avgTimeRes = await db.query(avgTimeSql);

    // 4. Repeat Issues Per Room (Hotspots)
    const repeatRoomSql = `
      SELECT r.room_number, b.name as block_name, COUNT(*) as complaint_count
      FROM complaints c
      JOIN rooms r ON r.id = c.room_id
      JOIN blocks b ON b.id = c.block_id
      ${blockFilterSql}
      GROUP BY r.room_number, b.name
      HAVING COUNT(*) >= 2
      ORDER BY complaint_count DESC
      LIMIT 8;
    `;
    const repeatRoomRes = await db.query(repeatRoomSql, params);

    // 5. Busiest Blocks Distribution
    const blockLoadSql = `
      SELECT b.id, b.name, b.code, COUNT(c.id) as total_complaints,
             COUNT(CASE WHEN c.status NOT IN ('Resolved', 'Closed') THEN 1 END) as open_complaints,
             COUNT(CASE WHEN c.is_overdue = TRUE THEN 1 END) as overdue_complaints
      FROM blocks b
      LEFT JOIN complaints c ON c.block_id = b.id
      GROUP BY b.id, b.name, b.code
      ORDER BY total_complaints DESC;
    `;
    const blockLoadRes = await db.query(blockLoadSql);

    // 6. Overdue Count
    let overdueSql = `SELECT COUNT(*) as count FROM complaints WHERE is_overdue = TRUE AND status NOT IN ('Resolved', 'Closed')`;
    if (isWarden && wardenBlockId) {
      overdueSql += ` AND block_id = ${parseInt(wardenBlockId, 10)}`;
    }
    const overdueRes = await db.query(overdueSql);
    const overdueCount = parseInt(overdueRes.rows[0].count, 10);

    // 7. Overall Satisfaction Rating
    const satisfactionSql = `
      SELECT ROUND(AVG(cf.rating)::numeric, 1) as avg_rating, COUNT(*) as total_feedback
      FROM complaint_feedback cf
      JOIN complaints c ON c.id = cf.complaint_id
      ${blockFilterSql};
    `;
    const satisfactionRes = await db.query(satisfactionSql, params);

    return res.status(200).json({
      success: true,
      data: {
        categoryDistribution: catRes.rows,
        statusOverview: {
          pending: pendingCount,
          resolved: resolvedCount,
          breakdown: statusMap,
        },
        avgResolutionTimeByCategory: avgTimeRes.rows,
        repeatIssuesPerRoom: repeatRoomRes.rows,
        busiestBlocks: blockLoadRes.rows,
        overdueCount,
        satisfaction: {
          averageRating: satisfactionRes.rows[0]?.avg_rating ? parseFloat(satisfactionRes.rows[0].avg_rating) : 4.5,
          totalFeedback: parseInt(satisfactionRes.rows[0]?.total_feedback || 0, 10),
        },
      },
      error: null,
    });
  } catch (err) {
    console.error('[ANALYTICS-DASHBOARD-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * 2. Operational Staff Performance Analytics
 * GET /api/v1/analytics/staff-performance
 */
async function getStaffPerformance(req, res) {
  try {
    const sql = `
      SELECT 
        sp.id,
        sp.full_name,
        sp.department,
        sp.designation,
        sp.specialisations,
        sp.is_active,
        COUNT(CASE WHEN c.status IN ('Assigned', 'In Progress') THEN 1 END) as active_tasks,
        COUNT(CASE WHEN c.status IN ('Resolved', 'Closed') THEN 1 END) as completed_tasks,
        ROUND(AVG(rh.resolution_hours)::numeric, 1) as avg_resolution_hours,
        ROUND(AVG(cf.rating)::numeric, 1) as avg_rating
      FROM staff_profiles sp
      LEFT JOIN complaints c ON c.assigned_staff_id = sp.id
      LEFT JOIN resolution_history rh ON rh.assigned_staff_id = sp.id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = c.id
      WHERE sp.department IN ('Facility Maintenance', 'Hostel Dining & Catering', 'Campus Security', 'Hostel Health Center')
      GROUP BY sp.id, sp.full_name, sp.department, sp.designation, sp.specialisations, sp.is_active
      ORDER BY completed_tasks DESC, active_tasks ASC;
    `;
    const result = await db.query(sql);

    return res.status(200).json({
      success: true,
      data: { staffPerformance: result.rows },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

module.exports = {
  getDashboardAnalytics,
  getStaffPerformance,
};
