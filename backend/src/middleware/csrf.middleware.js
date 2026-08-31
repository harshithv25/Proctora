const crypto = require('crypto');
const { env } = require('../config/env');
const { AppError } = require('../lib/apiError');

function generateCsrfToken() {
  const raw = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', env.CSRF_SECRET).update(raw).digest('hex');
  return `${raw}.${hmac}`;
}

// CSRF is only relevant after a session is established.
// These paths are pre-session (no cookies set yet) — exempt from check.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/2fa/verify',
  '/api/auth/2fa/setup',
  '/api/auth/refresh',
  '/api/health',
]);

function csrfProtection(req, res, next) {
  // All safe methods bypass CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // Pre-session endpoints that don't yet have cookies
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies?.csrfToken;

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return next(new AppError(403, 'CSRF_INVALID', 'Invalid or missing CSRF token.'));
  }

  const parts = tokenFromHeader.split('.');
  if (parts.length !== 2) {
    return next(new AppError(403, 'CSRF_MALFORMED', 'Malformed CSRF token.'));
  }

  const [raw, hmac] = parts;
  const expected = crypto.createHmac('sha256', env.CSRF_SECRET).update(raw).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    return next(new AppError(403, 'CSRF_SIGNATURE_MISMATCH', 'CSRF token signature invalid.'));
  }

  next();
}

module.exports = { generateCsrfToken, csrfProtection };
