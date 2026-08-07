const sendSuccess = (res, statusCode, message, data = null) => {
  const response = {
    status: 'success',
    message
  };
  if (data !== null) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

const sendError = (res, statusCode, message, errors = null) => {
  const response = {
    status: 'error',
    message
  };
  if (errors !== null) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };