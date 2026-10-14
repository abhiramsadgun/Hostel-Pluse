const bcrypt = require('bcryptjs');
const db = require('../../db');
const { audit } = require('../../services/audit');
const { notify } = require('../../services/notify');

/**
 * Get Admin Dashboard Overview Statistics
 */
async function getAdminStats(req, res) {
  try {
    const totalStudentsRes = await db.query(
      `SELECT status, COUNT(*) AS count FROM users WHERE role = 'student' GROUP BY status`
    );
    const totalWardensRes = await db.query(`SELECT COUNT(*) AS count FROM wardens WHERE approval_status = 'approved'`);
    const totalBlocksRes = await db.query(`SELECT COUNT(*) AS count FROM blocks`);
    const totalRoomsRes = await db.query(
      `SELECT COUNT(*) AS total_rooms, SUM(capacity) AS total_capacity, SUM(occupied_count) AS total_occupied FROM rooms`
    );
    const recentAuditRes = await db.query(
      `SELECT a.*, u.email, u.role 
       FROM audit_logs a 
       LEFT JOIN users u ON u.id = a.user_id 
       ORDER BY a.created_at DESC LIMIT 10`
    );

    return res.status(200).json({
      success: true,
      data: {
        studentStatusCounts: totalStudentsRes.rows,
        totalWardens: parseInt(totalWardensRes.rows[0]?.count || 0, 10),
        totalBlocks: parseInt(totalBlocksRes.rows[0]?.count || 0, 10),
        rooms: totalRoomsRes.rows[0] || { total_rooms: 0, total_capacity: 0, total_occupied: 0 },
        recentAudits: recentAuditRes.rows,
      },
      error: null,
    });
  } catch (err) {
    console.error('[ADMIN-STATS] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to fetch admin stats: ' + err.message, code: 'ADMIN_STATS_ERROR' },
    });
  }
}

/**
 * Blocks Management
 */
async function getAllBlocks(req, res) {
  try {
    const blocksRes = await db.query(
      `SELECT b.*, 
              COUNT(DISTINCT s.id) AS student_count, 
              COUNT(DISTINCT r.id) AS room_count,
              COUNT(DISTINCT w.id) AS warden_count
       FROM blocks b
       LEFT JOIN students s ON s.block_id = b.id
       LEFT JOIN rooms r ON r.block_id = b.id
       LEFT JOIN wardens w ON w.block_id = b.id
       GROUP BY b.id
       ORDER BY b.name ASC`
    );
    return res.status(200).json({ success: true, data: blocksRes.rows, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'BLOCKS_ERROR' } });
  }
}

async function createBlock(req, res) {
  try {
    const { name, code, gender, totalFloors, description } = req.body;
    if (!name || !code || !gender) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Name, code, and gender are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const check = await db.query('SELECT id FROM blocks WHERE code = $1', [code.toUpperCase()]);
    if (check.rows.length > 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: { message: `Block code "${code}" already exists.`, code: 'DUPLICATE_BLOCK_CODE' },
      });
    }

    const insertRes = await db.query(
      `INSERT INTO blocks (name, code, gender, total_floors, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, code.toUpperCase(), gender, parseInt(totalFloors || 4, 10), description || '']
    );

    await audit({
      userId: req.user.id,
      action: 'BLOCK_CREATED',
      entityType: 'block',
      entityId: insertRes.rows[0].id,
      details: { name, code: code.toUpperCase(), gender },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, data: insertRes.rows[0], error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'BLOCK_CREATE_ERROR' } });
  }
}

/**
 * Rooms Management
 */
async function getAllRooms(req, res) {
  try {
    const blockId = req.query.blockId;
    let query = `
      SELECT r.*, b.name AS block_name, b.code AS block_code, b.gender AS block_gender
      FROM rooms r
      JOIN blocks b ON b.id = r.block_id
    `;
    const params = [];
    if (blockId) {
      params.push(blockId);
      query += ` WHERE r.block_id = $1`;
    }
    query += ` ORDER BY b.code ASC, r.floor ASC, r.room_number ASC`;

    const result = await db.query(query, params);
    return res.status(200).json({ success: true, data: result.rows, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'ROOMS_ERROR' } });
  }
}

async function createRoom(req, res) {
  try {
    const { blockId, roomNumber, floor, capacity, status } = req.body;
    if (!blockId || !roomNumber || floor === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Block ID, room number, and floor are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const check = await db.query('SELECT id FROM rooms WHERE block_id = $1 AND room_number = $2', [blockId, roomNumber]);
    if (check.rows.length > 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: { message: `Room ${roomNumber} already exists in this block.`, code: 'DUPLICATE_ROOM' },
      });
    }

    const insertRes = await db.query(
      `INSERT INTO rooms (block_id, room_number, floor, capacity, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [blockId, roomNumber, parseInt(floor, 10), parseInt(capacity || 2, 10), status || 'available']
    );

    return res.status(201).json({ success: true, data: insertRes.rows[0], error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'ROOM_CREATE_ERROR' } });
  }
}

/**
 * Preload Warden Roster
 */
async function preloadWarden(req, res) {
  try {
    const { collegeIdNumber, fullName, email, gender, blockId } = req.body;
    if (!collegeIdNumber || !fullName || !email || !gender || !blockId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'All fields are required (collegeIdNumber, fullName, email, gender, blockId).', code: 'VALIDATION_ERROR' },
      });
    }

    const insertRes = await db.query(
      `INSERT INTO preloaded_wardens (college_id_number, full_name, email, gender, block_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (college_id_number) 
       DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, gender = EXCLUDED.gender, block_id = EXCLUDED.block_id
       RETURNING *`,
      [collegeIdNumber, fullName, email.toLowerCase(), gender, blockId]
    );

    await audit({
      userId: req.user.id,
      action: 'PRELOADED_WARDEN_REGISTERED',
      entityType: 'preloaded_warden',
      entityId: insertRes.rows[0].id,
      blockId,
      details: { collegeIdNumber, fullName, email },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Warden ${fullName} (${collegeIdNumber}) pre-loaded. Their registration will be auto-approved upon sign-up.`,
        preloadedWarden: insertRes.rows[0],
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'PRELOAD_ERROR' } });
  }
}

/**
 * List Wardens & Pending Approvals
 */
async function getAllWardens(req, res) {
  try {
    const result = await db.query(
      `SELECT w.*, u.email, u.phone, u.status AS user_status, b.name AS block_name, b.code AS block_code
       FROM wardens w
       JOIN users u ON u.id = w.user_id
       JOIN blocks b ON b.id = w.block_id
       ORDER BY b.name ASC, w.full_name ASC`
    );
    const preloadedRes = await db.query(
      `SELECT pw.*, b.name AS block_name 
       FROM preloaded_wardens pw 
       JOIN blocks b ON b.id = pw.block_id
       ORDER BY pw.full_name ASC`
    );
    return res.status(200).json({
      success: true,
      data: {
        wardens: result.rows,
        preloadedList: preloadedRes.rows,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'WARDENS_ERROR' } });
  }
}

/**
 * Staff Accounts Management (Create maintenance, health, security, mess, admin)
 */
async function createStaffAccount(req, res) {
  try {
    const { email, phone, password, role, staffIdNumber, fullName, department, designation, specialisations, isActive } = req.body;
    const allowedRoles = ['maintenance', 'health_assistant', 'security', 'mess', 'admin'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: `Role must be one of: [${allowedRoles.join(', ')}]`, code: 'INVALID_ROLE' },
      });
    }

    if (!email || !phone || !password || !staffIdNumber || !fullName || !department) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Missing required staff fields.', code: 'VALIDATION_ERROR' },
      });
    }

    const userCheck = await db.query('SELECT email FROM users WHERE email = $1', [email]);
    const staffCheck = await db.query('SELECT staff_id_number FROM staff_profiles WHERE staff_id_number = $1', [staffIdNumber]);

    if (userCheck.rows.length > 0 || staffCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: { message: 'Email or Staff ID number already exists.', code: 'DUPLICATE_STAFF' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
       VALUES ($1, $2, $3, $4, 'active', TRUE)
       RETURNING id, email, phone, role, status`,
      [email, phone, passwordHash, role]
    );
    const user = userRes.rows[0];

    const staffRes = await db.query(
      `INSERT INTO staff_profiles (user_id, staff_id_number, full_name, department, designation, specialisations, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user.id,
        staffIdNumber,
        fullName,
        department,
        designation || 'Staff Member',
        JSON.stringify(specialisations || []),
        isActive !== undefined ? Boolean(isActive) : true,
      ]
    );

    await audit({
      userId: req.user.id,
      action: 'STAFF_ACCOUNT_CREATED',
      entityType: 'staff',
      entityId: staffRes.rows[0].id,
      details: { role, staffIdNumber, fullName, department, specialisations: specialisations || [] },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      data: {
        message: `Staff account (${role}) for ${fullName} created successfully.`,
        user,
        staff: staffRes.rows[0],
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'STAFF_CREATE_ERROR' } });
  }
}

/**
 * Contract Endpoint for Complaints Teammate:
 * Returns maintenance staff with auto-suggestion match score for categories
 */
async function getMaintenanceAssignees(req, res) {
  try {
    const { getSuggestedMaintenanceAssignees } = require('../../services/maintenanceContract');
    const category = req.query.category || '';
    const staff = await getSuggestedMaintenanceAssignees(category);
    return res.status(200).json({ success: true, data: staff, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'ASSIGNEES_ERROR' } });
  }
}

async function getAllStaff(req, res) {
  try {
    const result = await db.query(
      `SELECT sp.*, u.email, u.phone, u.role, u.status, u.created_at AS user_created_at
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       ORDER BY sp.department ASC, sp.full_name ASC`
    );
    return res.status(200).json({ success: true, data: result.rows, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'STAFF_LIST_ERROR' } });
  }
}

/**
 * Complaint Categories Seed List (For complaints module teammate)
 */
async function getCategories(req, res) {
  try {
    const result = await db.query('SELECT * FROM complaint_categories ORDER BY department ASC, name ASC');
    return res.status(200).json({ success: true, data: result.rows, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'CATEGORIES_ERROR' } });
  }
}

async function createCategory(req, res) {
  try {
    const { name, department, description } = req.body;
    if (!name || !department) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Category name and department are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const insertRes = await db.query(
      `INSERT INTO complaint_categories (name, department, description, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (name) DO UPDATE SET department = EXCLUDED.department, description = EXCLUDED.description
       RETURNING *`,
      [name, department, description || '']
    );

    return res.status(201).json({ success: true, data: insertRes.rows[0], error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'CATEGORY_CREATE_ERROR' } });
  }
}

/**
 * System Audit Logs
 */
async function getAuditLogs(req, res) {
  try {
    const { action, blockId, limit = 50 } = req.query;
    let query = `
      SELECT a.*, u.email AS user_email, u.role AS user_role, b.name AS block_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN blocks b ON b.id = a.block_id
    `;
    const params = [];
    const conditions = [];

    if (action) {
      params.push(`%${action}%`);
      conditions.push(`a.action ILIKE $${params.length}`);
    }
    if (blockId) {
      params.push(blockId);
      conditions.push(`a.block_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    params.push(parseInt(limit, 10));
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    return res.status(200).json({ success: true, data: result.rows, error: null });
  } catch (err) {
    return res.status(500).json({ success: false, data: null, error: { message: err.message, code: 'AUDIT_LOG_ERROR' } });
  }
}

module.exports = {
  getAdminStats,
  getAllBlocks,
  createBlock,
  getAllRooms,
  createRoom,
  preloadWarden,
  getAllWardens,
  createStaffAccount,
  getAllStaff,
  getMaintenanceAssignees,
  getCategories,
  createCategory,
  getAuditLogs,
};
