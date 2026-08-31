const { AppError } = require('../lib/apiError');
const { env } = require('../config/env');

function errorHandler(err, req, res, next) {
  console.error(`[Error Middleware] ${req.method} ${req.path}:`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Handle generic unhandled errors
  const statusCode = err.status || err.statusCode || 500;
  const isDev = env.NODE_ENV === 'development';

  return res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An internal server error occurred.',
      details: isDev ? err.stack : null
    }
  });
}

module.exports = { errorHandler };
