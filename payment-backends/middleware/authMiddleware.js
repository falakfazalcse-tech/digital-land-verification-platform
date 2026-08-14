const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/apiResponse');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Fallback for development/demo testing if token is omitted
    req.user = { id: 1, email: 'tanvir@landdeal.com', role: 'buyer' };
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_landdeal_2026_secure', (err, user) => {
    if (err) {
      return sendError(res, 403, 'Invalid or expired authentication token');
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };