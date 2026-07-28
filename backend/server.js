const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const generateCustomUserId = require('./utils/idGenerator');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// 1. REGISTER API
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, phone, email, password, confirm_password, role, terms } = req.body;

        // Validations
        if (!full_name || !phone || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        if (confirm_password && password !== confirm_password) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        if (terms === false) {
            return res.status(400).json({ success: false, message: 'You must accept the Terms & Conditions.' });
        }

        const validRoles = ['buyer', 'seller', 'officer'];
        if (!validRoles.includes(role.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid role selected.' });
        }

        // Check if user already exists
        const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'User with this Email or Phone already exists.' });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate Custom Unique ID
        const customId = await generateCustomUserId(role);

        // Insert User into DB
        const query = `
            INSERT INTO users (custom_id, full_name, phone, email, password, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(query, [customId, full_name, phone, email, hashedPassword, role.toLowerCase()]);

        return res.status(201).json({
            success: true,
            message: 'Registration successful!',
            data: {
                userId: customId,
                name: full_name,
                email,
                role
            }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// ==========================================
// 2. LOGIN API (Supports Email, Mobile, or Custom ID)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body; // 'email' input holds email/phone/custom_id

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide credentials and password.' });
        }

        // Search user by email, phone, or custom ID
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? OR phone = ? OR custom_id = ?',
            [email, email, email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = rows[0];

        // Optional: Check role mismatch if sent from frontend tabs
        if (role && user.role !== role.toLowerCase()) {
            return res.status(403).json({ success: false, message: `Account exists, but not registered as ${role}.` });
        }

        // Verify Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, custom_id: user.custom_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                custom_id: user.custom_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});