const { sendError } = require('../utils/apiResponse');

const notFound = (req, res, next) => {
  sendError(res, 404, `Route not found - ${req.originalUrl}`);
};

const errorHandler = (err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  sendError(res, statusCode, message);
};

module.exports = { notFound, errorHandler };