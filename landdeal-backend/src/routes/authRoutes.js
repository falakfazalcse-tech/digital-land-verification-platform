const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const verifyToken = require('../middlewares/authMiddleware');

// Public Routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected Route (Requires JWT)
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile/update', verifyToken, authController.updateProfile);

module.exports = router;