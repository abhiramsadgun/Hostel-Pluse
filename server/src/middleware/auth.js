const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hostelpulse_jwt_key_2026_dev';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'super_secret_hostelpulse_refresh_jwt_key_2026_dev';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

/**
 * Authentication Middleware
 * Validates Bearer token and populates req.user with role-specific context
 */
async function authenticate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'Authentication required. No bearer token provided.',
          code: 'UNAUTHORIZED',
        },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.',
          code: err.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
        },
      });
    }

    // Load full user details from DB to guarantee current status
    const userQuery = await db.query(
      `SELECT u.id, u.email, u.phone, u.role, u.status,
              s.id AS student_id, s.block_id AS student_block_id, s.gender AS student_gender, s.full_name AS student_name, s.room_id AS student_room_id, s.diet_preference AS student_diet_preference,
              w.id AS warden_id, w.block_id AS warden_block_id, w.gender AS warden_gender, w.full_name AS warden_name,
              sp.full_name AS staff_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN wardens w ON w.user_id = u.id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'User account no longer exists.',
          code: 'AUTH_USER_NOT_FOUND',
        },
      });
    }

    const row = userQuery.rows[0];

    if (row.status === 'suspended') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: 'Account has been suspended. Please contact the hostel administrator.',
          code: 'ACCOUNT_SUSPENDED',
        },
      });
    }

    req.user = {
      id: row.id,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      studentId: row.student_id || null,
      wardenId: row.warden_id || null,
      blockId: row.student_block_id || row.warden_block_id || null,
      roomId: row.student_room_id || null,
      gender: row.student_gender || row.warden_gender || null,
      dietPreference: row.student_diet_preference || 'veg',
      fullName: row.student_name || row.warden_name || row.staff_name || 'Admin',
    };

    next();
  } catch (error) {
    console.error('[AUTH-MIDDLEWARE] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        message: 'Internal authentication validation failure.',
        code: 'AUTH_SERVER_ERROR',
      },
    });
  }
}

/**
 * Role-Based Access Control Middleware
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'Authentication required before checking roles.',
          code: 'UNAUTHORIZED',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: `Forbidden: role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`,
          code: 'FORBIDDEN_ROLE',
        },
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
