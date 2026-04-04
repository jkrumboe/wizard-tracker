/**
 * Wraps an async route handler to automatically catch errors and forward to Express error handler.
 * Eliminates the need for try/catch blocks in every route handler.
 *
 * @param {Function} fn - Async route handler function (req, res, next)
 * @returns {Function} Express middleware that catches rejected promises
 *
 * @example
 * router.get('/users', catchAsync(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
