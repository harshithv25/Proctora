const rateLimit = require('express-rate-limit');

// Strict limiter applied globally on /api/auth/* (mounted in app.js before routes)
// Prevents brute-force on login / 2FA endpoints (Constraint C.3)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Try again after 15 minutes.'
    }
  }
});

// General limiter for all other API routes
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.'
    }
  }
});

module.exports = { authRateLimiter, generalRateLimiter };
