const { AppError } = require('../lib/apiError');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required.'));
    }

    const userRole = req.user.role;
    const normalizedUserRole = userRole === 'STUDENT' ? 'CANDIDATE' : userRole;

    const normalizedAllowedRoles = allowedRoles.map(r => r === 'STUDENT' ? 'CANDIDATE' : r);

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return next(new AppError(403, 'FORBIDDEN_ROLE', `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}.`));
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requireRole('ADMIN'),
  requireCandidate: requireRole('CANDIDATE', 'STUDENT')
};
