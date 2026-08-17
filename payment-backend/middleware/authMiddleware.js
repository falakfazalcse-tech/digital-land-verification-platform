const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Optional fallback: use session user ID or a mock guest ID during initial testing
    req.user = { id: 1, name: "Rafiqul Islam", email: "rafiq@example.com" };
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ status: 'fail', message: 'Invalid or expired token.' });
    }
    req.user = decoded;
    next();
  });
};

module.exports = { verifyToken };