// Express 4 does not automatically catch rejected promises thrown inside
// async route handlers — an unhandled rejection there just crashes the
// serverless function instead of reaching our error-handling middleware.
// Wrapping a handler with this forwards any error to next(err) instead.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
