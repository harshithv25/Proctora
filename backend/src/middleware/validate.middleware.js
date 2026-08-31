const { AppError } = require('../lib/apiError');

function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.body = parsed.body || req.body;
      req.query = parsed.query || req.query;
      req.params = parsed.params || req.params;
      next();
    } catch (err) {
      if (err.errors) {
        const fieldErrors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(new AppError(400, 'VALIDATION_ERROR', 'Request payload validation failed.', fieldErrors));
      }
      next(err);
    }
  };
}

module.exports = { validate };
