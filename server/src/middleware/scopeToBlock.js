/**
 * scopeToBlock Middleware
 * 
 * Enforces tenant isolation across hostel blocks and genders:
 * - For 'warden': Restricts data queries to `req.user.blockId` and `req.user.gender`.
 * - For 'student': Restricts data queries to the student's assigned `req.user.blockId`.
 * - For 'admin': Has full cross-block visibility (req.blockScope = null).
 * - For other staff (mess, maintenance): Allows access or optional block filtering.
 */
function scopeToBlock(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        message: 'Authentication required for block-scoped access.',
        code: 'UNAUTHORIZED',
      },
    });
  }

  const { role, blockId, gender } = req.user;

  if (role === 'admin') {
    // Admin has global, unrestricted block scope
    req.blockScope = {
      isGlobal: true,
      blockId: null,
      gender: null,
    };
    req.scope = req.blockScope;
    return next();
  }

  if (role === 'warden') {
    if (!blockId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: 'Warden profile is not mapped to any valid hostel block.',
          code: 'BLOCK_UNASSIGNED',
        },
      });
    }

    req.blockScope = {
      isGlobal: false,
      blockId: blockId,
      gender: gender,
    };
    req.scope = req.blockScope;
    return next();
  }

  if (role === 'student') {
    req.blockScope = {
      isGlobal: false,
      blockId: blockId,
      gender: gender,
    };
    req.scope = req.blockScope;
    return next();
  }

  // Other staff roles default to global unless explicitly constrained
  req.blockScope = {
    isGlobal: true,
    blockId: null,
    gender: null,
  };
  req.scope = req.blockScope;
  return next();
}

module.exports = {
  scopeToBlock,
};
