const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('../../db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../middleware/auth');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');
const {
  studentRegisterSchema,
  wardenRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  studentApprovalSchema,
} = require('./auth.validation');

/**
 * Register a student (Pending approval)
 */
async function registerStudent(req, res) {
  try {
    // 1. Validate Multer file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Laminated Hostel ID card photo is required.',
          code: 'FILE_REQUIRED',
        },
      });
    }

    // 2. Validate input fields with Zod
    const validationResult = studentRegisterSchema.safeParse(req.body);
    if (!validationResult.success) {
      // Remove uploaded file if validation failed
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Validation failed for registration input.',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
    }

    const data = validationResult.data;
    const fileHash = req.file.fileHash;
    const filename = req.file.filename;

    // 3. Verify block exists and gender matches
    const blockRes = await db.query('SELECT id, name, gender FROM blocks WHERE id = $1', [data.blockId]);
    if (blockRes.rows.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Selected hostel block does not exist.',
          code: 'INVALID_BLOCK',
        },
      });
    }

    const block = blockRes.rows[0];
    if (block.gender !== data.gender) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Block "${block.name}" is designated for ${block.gender} students only. Please select a ${data.gender} block.`,
          code: 'BLOCK_GENDER_MISMATCH',
        },
      });
    }

    // 4. Duplicate Checks: Email, Phone, Roll Number, Laminated ID (pg-mem & pg compatible)
    const userCheck = await db.query(
      `SELECT email, phone FROM users WHERE email = $1 OR phone = $2`,
      [data.email, data.phone]
    );
    const studentCheck = await db.query(
      `SELECT roll_number, laminated_id_number, id_card_image_hash FROM students 
       WHERE roll_number = $1 OR laminated_id_number = $2 OR id_card_image_hash = $3`,
      [data.rollNumber, data.laminatedIdNumber, fileHash]
    );

    if (userCheck.rows.length > 0 || studentCheck.rows.length > 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const userMatch = userCheck.rows[0];
      const studentMatch = studentCheck.rows[0];
      let field = 'Field';
      if (userMatch?.email === data.email) field = 'Email address';
      else if (userMatch?.phone === data.phone) field = 'Phone number';
      else if (studentMatch?.roll_number === data.rollNumber) field = 'Roll number';
      else if (studentMatch?.laminated_id_number === data.laminatedIdNumber) field = 'Laminated hostel ID number';
      else if (studentMatch?.id_card_image_hash === fileHash) field = 'ID card photo (duplicate image detected)';

      return res.status(409).json({
        success: false,
        data: null,
        error: {
          message: `${field} is already registered in the system. Duplicates are strictly disallowed.`,
          code: 'DUPLICATE_ENTRY',
        },
      });
    }

    // 5. Hash Password & Insert User
    const passwordHash = await bcrypt.hash(data.password, 10);

    const userRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, role, status, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, 'student', 'pending', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, phone, role, status, created_at`,
      [data.email, data.phone, passwordHash]
    );
    const newUser = userRes.rows[0];

    // 6. Insert Student Record
    const studentRes = await db.query(
      `INSERT INTO students (
        user_id, roll_number, laminated_id_number, id_card_image_url, id_card_image_hash,
        block_id, full_name, gender, class_name, academic_year,
        parent_name, parent_phone, emergency_contact, allergies, diet_preference, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      RETURNING id, user_id, roll_number, laminated_id_number, id_card_image_url, block_id,
                full_name, gender, class_name, academic_year, parent_name, emergency_contact, allergies, diet_preference, created_at`,
      [
        newUser.id,
        data.rollNumber,
        data.laminatedIdNumber,
        filename,
        fileHash,
        data.blockId,
        data.fullName,
        data.gender,
        data.className,
        data.academicYear,
        data.parentName,
        data.parentPhone,
        data.emergencyContact,
        data.allergies || 'None',
        data.dietPreference || 'veg',
      ]
    );
    const newStudent = studentRes.rows[0];

    // 7. Audit Log
    await audit({
      userId: newUser.id,
      action: 'STUDENT_REGISTER_SUBMITTED',
      entityType: 'student',
      entityId: newStudent.id,
      blockId: data.blockId,
      details: { rollNumber: data.rollNumber, laminatedId: data.laminatedIdNumber },
      ipAddress: req.ip,
    });

    // 8. Notify Wardens of this block
    try {
      const wardensInBlock = await db.query(
        `SELECT user_id, full_name FROM wardens WHERE block_id = $1 AND approval_status = 'approved'`,
        [data.blockId]
      );
      for (const w of wardensInBlock.rows) {
        await notify({
          userId: w.user_id,
          title: 'New Student Registration Pending',
          message: `${data.fullName} (${data.rollNumber}) has registered for your block. Please review their laminated ID.`,
          type: 'approval',
          metadata: { studentId: newStudent.id, studentUserId: newUser.id },
        });
      }
    } catch (notifErr) {
      console.warn('[AUTH-REGISTER-STUDENT] Warden notification notice:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      data: {
        message: 'Registration submitted successfully. Your account is pending verification by your hostel warden.',
        student: {
          id: newStudent.id,
          userId: newUser.id,
          fullName: newStudent.full_name,
          rollNumber: newStudent.roll_number,
          laminatedIdNumber: newStudent.laminated_id_number,
          blockId: newStudent.block_id,
          status: 'pending',
        },
      },
      error: null,
    });
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[AUTH-REGISTER-STUDENT] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        message: 'Failed to process student registration: ' + err.message,
        code: 'REGISTRATION_SERVER_ERROR',
      },
    });
  }
}

/**
 * Register a Warden
 * Auto-approves if matches preloaded_wardens list; otherwise marks as pending admin approval
 */
async function registerWarden(req, res) {
  try {
    const validationResult = wardenRegisterSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid warden registration details.',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
    }

    const data = validationResult.data;

    // Check existing duplicates (pg-mem & pg compatible)
    const userDup = await db.query(
      `SELECT email, phone FROM users WHERE email = $1 OR phone = $2`,
      [data.email, data.phone]
    );
    const wardenDup = await db.query(
      `SELECT college_id_number FROM wardens WHERE college_id_number = $1`,
      [data.collegeIdNumber]
    );

    if (userDup.rows.length > 0 || wardenDup.rows.length > 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: {
          message: 'Email, phone, or College ID number is already registered in the system.',
          code: 'DUPLICATE_ENTRY',
        },
      });
    }

    // Verify block
    const blockRes = await db.query('SELECT id, gender FROM blocks WHERE id = $1', [data.blockId]);
    if (blockRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Specified hostel block not found.', code: 'INVALID_BLOCK' },
      });
    }

    // Check pre-loaded list
    const preloadedRes = await db.query(
      `SELECT * FROM preloaded_wardens 
       WHERE college_id_number = $1 AND email = $2`,
      [data.collegeIdNumber, data.email]
    );

    const isPreloaded = preloadedRes.rows.length > 0;
    const accountStatus = isPreloaded ? 'active' : 'pending';
    const wardenApprovalStatus = isPreloaded ? 'approved' : 'pending';

    const passwordHash = await bcrypt.hash(data.password, 10);

    const userRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, role, status, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, 'warden', $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, phone, role, status`,
      [data.email, data.phone, passwordHash, accountStatus, isPreloaded]
    );
    const newUser = userRes.rows[0];

    const wardenRes = await db.query(
      `INSERT INTO wardens (user_id, college_id_number, full_name, gender, block_id, is_night_deputy, approval_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, user_id, college_id_number, full_name, gender, block_id, is_night_deputy, approval_status`,
      [newUser.id, data.collegeIdNumber, data.fullName, data.gender, data.blockId, data.isNightDeputy || false, wardenApprovalStatus]
    );
    const newWarden = wardenRes.rows[0];

    await audit({
      userId: newUser.id,
      action: isPreloaded ? 'WARDEN_AUTO_APPROVED_PRELOAD' : 'WARDEN_REGISTER_PENDING',
      entityType: 'warden',
      entityId: newWarden.id,
      blockId: data.blockId,
      details: { collegeId: data.collegeIdNumber, preloaded: isPreloaded },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      data: {
        message: isPreloaded
          ? 'Warden verified against college roster and activated successfully.'
          : 'Registration recorded. Awaiting confirmation from Chief Warden/Administrator.',
        warden: {
          id: newWarden.id,
          userId: newUser.id,
          fullName: newWarden.full_name,
          collegeIdNumber: newWarden.college_id_number,
          blockId: newWarden.block_id,
          status: accountStatus,
          approvalStatus: wardenApprovalStatus,
        },
      },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-REGISTER-WARDEN] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        message: 'Failed to process warden registration: ' + err.message,
        code: 'WARDEN_REG_SERVER_ERROR',
      },
    });
  }
}

/**
 * Universal Login
 * Students: Laminated ID + password
 * Wardens: College ID + password
 * Staff/Admin: Email or Staff ID + password
 */
async function login(req, res) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Identifier and password are required.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const { identifier, password } = parseResult.data;

    // Search user by email, laminated ID, college ID, or staff ID
    const query = `
      SELECT u.id, u.email, u.phone, u.password_hash, u.role, u.status,
             s.id AS student_id, s.full_name AS student_name, s.laminated_id_number, s.roll_number, s.block_id AS student_block_id, s.gender AS student_gender, s.rejection_reason,
             w.id AS warden_id, w.full_name AS warden_name, w.college_id_number, w.block_id AS warden_block_id, w.gender AS warden_gender, w.approval_status,
             sp.id AS staff_id, sp.full_name AS staff_name, sp.staff_id_number, sp.department,
             b.name AS block_name
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN wardens w ON w.user_id = u.id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      LEFT JOIN blocks b ON b.id = COALESCE(s.block_id, w.block_id)
      WHERE u.email = $1 
         OR s.laminated_id_number = $1 
         OR s.roll_number = $1 
         OR w.college_id_number = $1 
         OR sp.staff_id_number = $1
    `;

    const userRes = await db.query(query, [identifier]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid credentials. Please verify your ID or email and password.',
          code: 'AUTH_FAILED',
        },
      });
    }

    const user = userRes.rows[0];

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid credentials. Please verify your password.',
          code: 'AUTH_FAILED',
        },
      });
    }

    // Check Account Status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: user.role === 'student'
            ? 'Your registration is still pending approval by your block warden.'
            : 'Your warden registration is pending confirmation by the chief administrator.',
          code: 'ACCOUNT_PENDING',
        },
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: `Your registration was rejected: ${user.rejection_reason || 'Information could not be verified'}. Please register again or consult hostel administration.`,
          code: 'ACCOUNT_REJECTED',
          details: { rejectionReason: user.rejection_reason },
        },
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: 'Your account has been suspended by administration.',
          code: 'ACCOUNT_SUSPENDED',
        },
      });
    }

    // Generate JWT
    const tokenPayload = {
      userId: user.id,
      role: user.role,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Audit Login
    await audit({
      userId: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      blockId: user.student_block_id || user.warden_block_id || null,
      ipAddress: req.ip,
    });

    const fullName = user.student_name || user.warden_name || user.staff_name || 'Admin';

    return res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          fullName: fullName,
          studentId: user.student_id || null,
          wardenId: user.warden_id || null,
          staffId: user.staff_id || null,
          blockId: user.student_block_id || user.warden_block_id || null,
          blockName: user.block_name || null,
          gender: user.student_gender || user.warden_gender || null,
          rollNumber: user.roll_number || null,
          laminatedIdNumber: user.laminated_id_number || null,
          collegeIdNumber: user.college_id_number || null,
          department: user.department || null,
        },
      },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-LOGIN] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        message: 'Login server error: ' + err.message,
        code: 'LOGIN_SERVER_ERROR',
      },
    });
  }
}

/**
 * Token Refresh
 */
async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Refresh token is required.', code: 'TOKEN_REQUIRED' },
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const userRes = await db.query('SELECT id, role, status FROM users WHERE id = $1', [decoded.userId]);

    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'active') {
      return res.status(401).json({
        success: false,
        data: null,
        error: { message: 'Invalid session or account inactive.', code: 'INVALID_SESSION' },
      });
    }

    const newAccessToken = signAccessToken({ userId: decoded.userId, role: userRes.rows[0].role });
    return res.status(200).json({
      success: true,
      data: { token: newAccessToken },
      error: null,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { message: 'Expired or invalid refresh token.', code: 'INVALID_REFRESH_TOKEN' },
    });
  }
}

/**
 * Get current session profile & assigned warden (for student portal)
 */
async function getCurrentUser(req, res) {
  try {
    const userId = req.user.id;

    // Fetch full profile
    const query = `
      SELECT u.id, u.email, u.phone, u.role, u.status, u.created_at,
             s.id AS student_id, s.full_name AS student_name, s.roll_number, s.laminated_id_number,
             s.class_name, s.academic_year, s.parent_name, s.parent_phone, s.emergency_contact,
             s.allergies, s.id_card_image_url, s.block_id AS student_block_id, s.room_id,
             w.id AS warden_id, w.full_name AS warden_name, w.college_id_number, w.is_night_deputy,
             w.photo_url AS warden_photo, w.block_id AS warden_block_id,
             sp.id AS staff_id, sp.full_name AS staff_name, sp.staff_id_number, sp.department, sp.designation,
             b.name AS block_name, b.code AS block_code, b.gender AS block_gender,
             r.room_number, r.floor AS room_floor
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN wardens w ON w.user_id = u.id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      LEFT JOIN blocks b ON b.id = COALESCE(s.block_id, w.block_id)
      LEFT JOIN rooms r ON r.id = s.room_id
      WHERE u.id = $1
    `;

    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'User not found.', code: 'NOT_FOUND' },
      });
    }

    const row = result.rows[0];

    // If role is student, load assigned block wardens (primary and optional deputy/night warden)
    let assignedWardens = [];
    if (row.role === 'student' && row.student_block_id) {
      const wardenRes = await db.query(
        `SELECT w.id, w.full_name, w.college_id_number, w.is_night_deputy, w.photo_url, u.email, u.phone
         FROM wardens w
         JOIN users u ON u.id = w.user_id
         WHERE w.block_id = $1 AND w.approval_status = 'approved'`,
        [row.student_block_id]
      );
      assignedWardens = wardenRes.rows;
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: row.id,
          email: row.email,
          phone: row.phone,
          role: row.role,
          status: row.status,
          createdAt: row.created_at,
          fullName: row.student_name || row.warden_name || row.staff_name || 'Hostel Administrator',
          student: row.student_id ? {
            id: row.student_id,
            rollNumber: row.roll_number,
            laminatedIdNumber: row.laminated_id_number,
            className: row.class_name,
            academicYear: row.academic_year,
            parentName: row.parent_name,
            parentPhone: row.parent_phone,
            emergencyContact: row.emergency_contact,
            allergies: row.allergies,
            idCardImageUrl: row.id_card_image_url,
            blockId: row.student_block_id,
            blockName: row.block_name,
            blockCode: row.block_code,
            roomId: row.room_id,
            roomNumber: row.room_number,
            floor: row.room_floor,
          } : null,
          warden: row.warden_id ? {
            id: row.warden_id,
            collegeIdNumber: row.college_id_number,
            isNightDeputy: row.is_night_deputy,
            photoUrl: row.warden_photo,
            blockId: row.warden_block_id,
            blockName: row.block_name,
            blockCode: row.block_code,
          } : null,
          staff: row.staff_id ? {
            id: row.staff_id,
            staffIdNumber: row.staff_id_number,
            department: row.department,
            designation: row.designation,
          } : null,
          assignedWardens,
        },
      },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-ME] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to retrieve profile: ' + err.message, code: 'PROFILE_ERROR' },
    });
  }
}

/**
 * Get Pending Students for Warden Approval (Scoped to Warden's Block)
 */
async function getPendingStudents(req, res) {
  try {
    const { blockScope } = req;
    let query = `
      SELECT s.id, s.user_id, s.roll_number, s.laminated_id_number, s.full_name,
             s.gender, s.class_name, s.academic_year, s.parent_name, s.parent_phone,
             s.emergency_contact, s.allergies, s.id_card_image_url, s.id_card_image_hash,
             s.created_at, u.email, u.phone, u.status, b.name AS block_name, b.code AS block_code
      FROM students s
      JOIN users u ON u.id = s.user_id
      JOIN blocks b ON b.id = s.block_id
      WHERE u.status = 'pending'
    `;
    const params = [];

    if (blockScope && !blockScope.isGlobal) {
      params.push(blockScope.blockId);
      query += ` AND s.block_id = $${params.length}`;
      if (blockScope.gender) {
        params.push(blockScope.gender);
        query += ` AND s.gender = $${params.length}`;
      }
    }

    query += ` ORDER BY s.created_at ASC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      success: true,
      data: {
        pendingStudents: result.rows,
        total: result.rows.length,
      },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-PENDING-STUDENTS] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to fetch pending student registrations: ' + err.message, code: 'PENDING_FETCH_ERROR' },
    });
  }
}

/**
 * Warden Approval or Rejection of Student Registration
 */
async function processStudentApproval(req, res) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const parseResult = studentApprovalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid approval request: must specify action (approve/reject).',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { action, reason } = parseResult.data;

    // Load student and verify block tenancy
    const studentRes = await db.query(
      `SELECT s.id, s.user_id, s.full_name, s.roll_number, s.block_id, s.gender, u.email, u.phone, u.status
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Student registration not found.', code: 'STUDENT_NOT_FOUND' },
      });
    }

    const student = studentRes.rows[0];

    // Check block scope if warden
    if (req.user.role === 'warden' && student.block_id !== req.user.blockId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: 'Forbidden: You can only approve or reject students assigned to your own hostel block.',
          code: 'FORBIDDEN_CROSS_BLOCK',
        },
      });
    }

    if (action === 'approve') {
      await db.query(
        `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [student.user_id]
      );
      await db.query(
        `UPDATE students 
         SET approved_by_warden_id = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = NULL 
         WHERE id = $2`,
        [req.user.wardenId || req.user.id, studentId]
      );

      // Audit Log
      await audit({
        userId: req.user.id,
        action: 'STUDENT_REGISTRATION_APPROVED',
        entityType: 'student',
        entityId: studentId,
        blockId: student.block_id,
        details: { approvedBy: req.user.fullName, rollNumber: student.roll_number },
        ipAddress: req.ip,
      });

      // Notify Student
      await notify({
        userId: student.user_id,
        title: 'Hostel Registration Approved',
        message: `Congratulations ${student.full_name}! Your hostel registration has been approved by your block warden. You can now log in and select your meal preferences.`,
        type: 'approval',
        email: student.email,
        phone: student.phone,
      });

      return res.status(200).json({
        success: true,
        data: {
          message: `Student ${student.full_name} (${student.roll_number}) approved successfully.`,
          status: 'active',
        },
        error: null,
      });
    } else {
      // Rejection
      const rejectionReason = reason || 'Hostel ID card credentials or photo could not be verified.';
      await db.query(
        `UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [student.user_id]
      );
      await db.query(
        `UPDATE students SET rejection_reason = $1 WHERE id = $2`,
        [rejectionReason, studentId]
      );

      await audit({
        userId: req.user.id,
        action: 'STUDENT_REGISTRATION_REJECTED',
        entityType: 'student',
        entityId: studentId,
        blockId: student.block_id,
        details: { rejectedBy: req.user.fullName, reason: rejectionReason },
        ipAddress: req.ip,
      });

      await notify({
        userId: student.user_id,
        title: 'Hostel Registration Status Update',
        message: `Your hostel registration was not approved. Reason: ${rejectionReason}. Please reach out to your warden or resubmit.`,
        type: 'approval',
        email: student.email,
        phone: student.phone,
      });

      return res.status(200).json({
        success: true,
        data: {
          message: `Registration for ${student.full_name} has been rejected.`,
          status: 'rejected',
          reason: rejectionReason,
        },
        error: null,
      });
    }
  } catch (err) {
    console.error('[AUTH-APPROVE-STUDENT] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update approval status: ' + err.message, code: 'APPROVAL_SERVER_ERROR' },
    });
  }
}

/**
 * Secure ID Card Image Server
 * Only accessible by:
 * - Warden of the student's block
 * - Admin
 * - The student themselves
 */
async function serveSecureIdCard(req, res) {
  try {
    const { filename } = req.params;
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../../../server/uploads/ids', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'ID card file not found.', code: 'FILE_NOT_FOUND' },
      });
    }

    // Check access rights
    const record = await db.query(
      `SELECT s.id, s.user_id, s.block_id FROM students s WHERE s.id_card_image_url = $1`,
      [safeFilename]
    );

    if (record.rows.length > 0) {
      const student = record.rows[0];
      const isOwner = req.user.id === student.user_id;
      const isAdmin = req.user.role === 'admin';
      const isBlockWarden = req.user.role === 'warden' && req.user.blockId === student.block_id;

      if (!isOwner && !isAdmin && !isBlockWarden) {
        return res.status(403).json({
          success: false,
          data: null,
          error: { message: 'Forbidden: You do not have permission to view this ID card.', code: 'FORBIDDEN_FILE' },
        });
      }
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error('[AUTH-SERVE-FILE] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Error retrieving file.', code: 'FILE_SERVE_ERROR' },
    });
  }
}

/**
 * Forgot Password - Send OTP via Email
 */
async function forgotPassword(req, res) {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Valid email address is required.', code: 'VALIDATION_ERROR' },
      });
    }

    const { email } = parseResult.data;
    const userRes = await db.query('SELECT id, email, phone, role FROM users WHERE email = $1', [email]);

    if (userRes.rows.length === 0) {
      // Return success to avoid email enumeration
      return res.status(200).json({
        success: true,
        data: { message: 'If an account exists with this email, a 6-digit verification code has been dispatched.' },
        error: null,
      });
    }

    const user = userRes.rows[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store in password_resets
    await db.query(
      `INSERT INTO password_resets (user_id, otp, expires_at, used, created_at)
       VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP)`,
      [user.id, otp, expiresAt]
    );

    // Notify user via Email and SMS
    await notify({
      userId: user.id,
      title: 'HostelPulse Password Reset Code',
      message: `Your one-time password reset code is ${otp}. It will expire in 15 minutes. If you did not request this, please disregard.`,
      type: 'alert',
      email: user.email,
      phone: user.phone,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Password reset code has been dispatched to your registered email address.',
        // For development/demo convenience, include preview OTP if in development mode
        demoOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
      },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-FORGOT-PASSWORD] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to process forgot password: ' + err.message, code: 'FORGOT_PW_ERROR' },
    });
  }
}

/**
 * Reset Password with OTP
 */
async function resetPassword(req, res) {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid reset payload.',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
    }

    const { email, otp, newPassword } = parseResult.data;

    // Check user
    const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid or expired OTP code.', code: 'INVALID_OTP' },
      });
    }
    const userId = userRes.rows[0].id;

    const nowIso = new Date().toISOString();
    const otpRes = await db.query(
      `SELECT id FROM password_resets 
       WHERE user_id = $1 AND otp = $2 AND used = FALSE AND expires_at > $3
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp, nowIso]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid or expired OTP code. Please request a new code.', code: 'INVALID_OTP' },
      });
    }

    const resetRecordId = otpRes.rows[0].id;

    // Update Password
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newHash, userId]
    );

    // Mark OTP used
    await db.query(`UPDATE password_resets SET used = TRUE WHERE id = $1`, [resetRecordId]);

    // Audit log
    await audit({
      userId,
      action: 'PASSWORD_RESET_SUCCESS',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Password has been successfully updated. You may now log in with your new password.' },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-RESET-PASSWORD] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to reset password: ' + err.message, code: 'RESET_PW_ERROR' },
    });
  }
}

/**
 * Update Profile (Student or Warden)
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { phone, allergies, emergencyContact, parentPhone, isNightDeputy } = req.body;

    if (phone) {
      // Check phone uniqueness
      const check = await db.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, userId]);
      if (check.rows.length > 0) {
        return res.status(409).json({
          success: false,
          data: null,
          error: { message: 'This phone number is already registered to another account.', code: 'PHONE_DUPLICATE' },
        });
      }
      await db.query('UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [phone, userId]);
    }

    if (req.user.role === 'student') {
      const updates = [];
      const params = [userId];

      if (allergies !== undefined) {
        params.push(allergies);
        updates.push(`allergies = $${params.length}`);
      }
      if (emergencyContact !== undefined) {
        params.push(emergencyContact);
        updates.push(`emergency_contact = $${params.length}`);
      }
      if (parentPhone !== undefined) {
        params.push(parentPhone);
        updates.push(`parent_phone = $${params.length}`);
      }

      if (updates.length > 0) {
        await db.query(`UPDATE students SET ${updates.join(', ')} WHERE user_id = $1`, params);
      }
    } else if (req.user.role === 'warden' && isNightDeputy !== undefined) {
      await db.query(`UPDATE wardens SET is_night_deputy = $1 WHERE user_id = $2`, [Boolean(isNightDeputy), userId]);
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Profile updated successfully.' },
      error: null,
    });
  } catch (err) {
    console.error('[AUTH-UPDATE-PROFILE] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update profile: ' + err.message, code: 'UPDATE_PROFILE_ERROR' },
    });
  }
}

/**
 * Get available blocks for registration dropdowns
 */
async function getBlocks(req, res) {
  try {
    const gender = req.query.gender;
    let query = 'SELECT id, name, code, gender, total_floors FROM blocks';
    const params = [];
    if (gender) {
      params.push(gender);
      query += ' WHERE gender = $1';
    }
    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    return res.status(200).json({
      success: true,
      data: result.rows,
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to fetch blocks list.', code: 'BLOCKS_FETCH_ERROR' },
    });
  }
}

module.exports = {
  registerStudent,
  registerWarden,
  login,
  refreshAccessToken,
  getCurrentUser,
  getPendingStudents,
  processStudentApproval,
  serveSecureIdCard,
  forgotPassword,
  resetPassword,
  updateProfile,
  getBlocks,
};
