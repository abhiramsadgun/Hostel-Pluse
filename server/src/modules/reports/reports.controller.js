const db = require('../../db');

/**
 * Filtered Report Summary Data
 * GET /api/v1/reports/summary
 */
async function getReportSummary(req, res) {
  try {
    const { startDate, endDate, blockId, categoryKey, status } = req.query;

    const conditions = [];
    const params = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`c.created_at >= $${params.length}`);
    }

    if (endDate) {
      // Add 1 day to cover end date fully
      params.push(`${endDate} 23:59:59`);
      conditions.push(`c.created_at <= $${params.length}`);
    }

    if (blockId && blockId !== 'all') {
      params.push(parseInt(blockId, 10));
      conditions.push(`c.block_id = $${params.length}`);
    }

    if (categoryKey && categoryKey !== 'all') {
      params.push(categoryKey);
      conditions.push(`c.category_key = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Overall Metrics
    const metricsSql = `
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN c.status IN ('Resolved', 'Closed') THEN 1 END) as resolved_count,
        COUNT(CASE WHEN c.status NOT IN ('Resolved', 'Closed') THEN 1 END) as pending_count,
        COUNT(CASE WHEN c.is_overdue = TRUE THEN 1 END) as overdue_count,
        COUNT(CASE WHEN c.is_recurring = TRUE THEN 1 END) as recurring_count
      FROM complaints c
      ${whereClause};
    `;
    const metricsRes = await db.query(metricsSql, params);
    const metrics = metricsRes.rows[0];

    // 2. Average Resolution Hours
    const avgResSql = `
      SELECT ROUND(AVG(rh.resolution_hours)::numeric, 1) as avg_resolution_hours
      FROM resolution_history rh
      JOIN complaints c ON c.id = rh.complaint_id
      ${whereClause};
    `;
    const avgRes = await db.query(avgResSql, params);

    // 3. Category Breakdown
    const catSql = `
      SELECT c.category_key, COUNT(*) as count
      FROM complaints c
      ${whereClause}
      GROUP BY c.category_key
      ORDER BY count DESC;
    `;
    const catRes = await db.query(catSql, params);

    // 4. Overdue Tickets List
    const overdueSql = `
      SELECT c.id, c.complaint_id, c.title, c.category_key, c.status,
             c.sla_hours, c.created_at, c.predicted_resolution_at,
             b.name as block_name, r.room_number, s.full_name as student_name
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      JOIN students s ON s.id = c.student_id
      ${whereClause ? whereClause + ' AND' : 'WHERE'} c.is_overdue = TRUE
      ORDER BY c.created_at ASC
      LIMIT 25;
    `;
    const overdueRes = await db.query(overdueSql, params);

    // 5. Recurring Hotspots
    const hotspotsSql = `
      SELECT rf.*, b.name as block_name, r.room_number
      FROM recurring_issue_flags rf
      JOIN blocks b ON b.id = rf.block_id
      LEFT JOIN rooms r ON r.id = rf.room_id
      ORDER BY rf.occurrence_count DESC, rf.flagged_at DESC
      LIMIT 15;
    `;
    const hotspotsRes = await db.query(hotspotsSql);

    // 6. Detailed Incident Records
    const detailsSql = `
      SELECT 
        c.id, c.complaint_id, c.title, c.category_key, c.status,
        c.priority_score, c.created_at, c.resolved_at, c.is_overdue, c.is_recurring,
        b.name as block_name, r.room_number, s.full_name as student_name,
        st.full_name as assigned_staff_name,
        cf.rating as feedback_rating,
        rh.resolution_hours
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      JOIN students s ON s.id = c.student_id
      LEFT JOIN staff_profiles st ON st.id = c.assigned_staff_id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = c.id
      LEFT JOIN resolution_history rh ON rh.complaint_id = c.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT 100;
    `;
    const detailsRes = await db.query(detailsSql, params);

    return res.status(200).json({
      success: true,
      data: {
        filters: { startDate, endDate, blockId, categoryKey, status },
        summary: {
          totalComplaints: parseInt(metrics.total_complaints || 0, 10),
          resolvedCount: parseInt(metrics.resolved_count || 0, 10),
          pendingCount: parseInt(metrics.pending_count || 0, 10),
          overdueCount: parseInt(metrics.overdue_count || 0, 10),
          recurringCount: parseInt(metrics.recurring_count || 0, 10),
          avgResolutionHours: avgRes.rows[0]?.avg_resolution_hours ? parseFloat(avgRes.rows[0].avg_resolution_hours) : 0,
        },
        categoryBreakdown: catRes.rows,
        overdueList: overdueRes.rows,
        recurringHotspots: hotspotsRes.rows,
        complaints: detailsRes.rows,
      },
      error: null,
    });
  } catch (err) {
    console.error('[REPORT-SUMMARY-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

/**
 * Export Complaints Report to Downloadable CSV
 * GET /api/v1/reports/export-csv
 */
async function exportComplaintsCsv(req, res) {
  try {
    const { startDate, endDate, blockId, categoryKey } = req.query;

    const conditions = [];
    const params = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`c.created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(`${endDate} 23:59:59`);
      conditions.push(`c.created_at <= $${params.length}`);
    }
    if (blockId && blockId !== 'all') {
      params.push(parseInt(blockId, 10));
      conditions.push(`c.block_id = $${params.length}`);
    }
    if (categoryKey && categoryKey !== 'all') {
      params.push(categoryKey);
      conditions.push(`c.category_key = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        c.complaint_id,
        c.title,
        c.category_key,
        b.name as block_name,
        COALESCE(r.room_number, 'N/A') as room_number,
        c.status,
        c.priority_score,
        CASE WHEN c.is_anonymous THEN 'Anonymous Resident' ELSE s.full_name END as student_name,
        c.created_at,
        c.sla_hours,
        COALESCE(TO_CHAR(c.resolved_at, 'YYYY-MM-DD HH24:MI'), 'Pending') as resolved_date,
        COALESCE(rh.resolution_hours::text, 'N/A') as turnaround_hours,
        CASE WHEN c.is_overdue THEN 'YES' ELSE 'NO' END as is_overdue,
        CASE WHEN c.is_recurring THEN 'YES' ELSE 'NO' END as is_recurring,
        COALESCE(st.full_name, 'Unassigned') as assigned_technician,
        COALESCE(cf.rating::text, 'Not rated') as rating
      FROM complaints c
      JOIN blocks b ON b.id = c.block_id
      LEFT JOIN rooms r ON r.id = c.room_id
      JOIN students s ON s.id = c.student_id
      LEFT JOIN staff_profiles st ON st.id = c.assigned_staff_id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = c.id
      LEFT JOIN resolution_history rh ON rh.complaint_id = c.id
      ${whereClause}
      ORDER BY c.created_at DESC;
    `;
    const result = await db.query(sql, params);

    // Escape CSV cell according to RFC 4180
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Complaint ID',
      'Title',
      'Category',
      'Hostel Block',
      'Room Number',
      'Status',
      'Priority Score',
      'Lodged By',
      'Created Timestamp',
      'SLA (Hours)',
      'Resolved Date',
      'Turnaround (Hours)',
      'Overdue Flag',
      'Recurring Flag',
      'Assigned Technician',
      'Student Rating (1-5)',
    ];

    const rows = [headers.join(',')];

    for (const r of result.rows) {
      rows.push([
        escapeCsv(r.complaint_id),
        escapeCsv(r.title),
        escapeCsv(r.category_key),
        escapeCsv(r.block_name),
        escapeCsv(r.room_number),
        escapeCsv(r.status),
        escapeCsv(r.priority_score),
        escapeCsv(r.student_name),
        escapeCsv(new Date(r.created_at).toLocaleString()),
        escapeCsv(r.sla_hours),
        escapeCsv(r.resolved_date),
        escapeCsv(r.turnaround_hours),
        escapeCsv(r.is_overdue),
        escapeCsv(r.is_recurring),
        escapeCsv(r.assigned_technician),
        escapeCsv(r.rating),
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const filename = `hostelpulse-complaints-report-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('[CSV-EXPORT-ERROR]', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
    });
  }
}

module.exports = {
  getReportSummary,
  exportComplaintsCsv,
};
