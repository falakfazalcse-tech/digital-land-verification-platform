const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { full_name, phone, email, password, confirm_password, role, terms } = req.body;

    // Validation
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Required fields missing.' });
    }

    if (!terms) {
      return res.status(400).json({ success: false, message: 'You must accept the Terms & Conditions.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Check duplicate Email or Mobile
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR (phone IS NOT NULL AND phone = ? AND phone != "")', 
      [email, phone || '']
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email or Phone Number already registered.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Format Role & Custom ID Prefix
    const normalizedRole = role.toLowerCase();
    const rolePrefixes = { buyer: 'BYR', seller: 'SLR', officer: 'OFF' };
    const prefix = rolePrefixes[normalizedRole] || 'USR';

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM users');
    const custom_id = `LD-${prefix}-${countResult[0].total + 1001}`;

    // Save to Database
    const [result] = await db.query(
      'INSERT INTO users (custom_id, full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [custom_id, full_name, email, phone || null, hashedPassword, normalizedRole]
    );

    const token = jwt.sign(
  { id: result.insertId, custom_id: custom_id, role: normalizedRole },
  process.env.JWT_SECRET || 'landdeal_secret',
  { expiresIn: '7d' }
);

    res.status(201).json({
      success: true,
      token: token,
      message: 'Account created successfully!',
      data: {
        userId: custom_id,
        id: result.insertId,
        full_name,
        email,
        role: normalizedRole
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// ------------------- LOGIN -------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/Mobile and Password are required.' });
    }

    // Query user by Email OR Phone
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email, email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = users[0];

    // Password Match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, custom_id: user.custom_id, role: user.role },
      process.env.JWT_SECRET || 'landdeal_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        custom_id: user.custom_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ------------------- GET PROFILE (PROTECTED) -------------------
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, full_name,email, phone, father_name, mother_name, date_of_birth, 
              gender, national_id, birth_certificate, occupation, 
              present_address, permanent_address, is_verified, profile_pic 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({ success: true, user: users[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------- UPDATE PROFILE INFO -------------------
exports.updateProfile = async (req, res) => {
  try {
    const {
      full_name, father_name, mother_name, date_of_birth,
      gender, national_id, birth_certificate, occupation,
      present_address, permanent_address
    } = req.body;

    await db.query(
      `UPDATE users SET 
        full_name = COALESCE(NULLIF(?, ''), full_name),
        father_name = COALESCE(NULLIF(?, ''), father_name),
        mother_name = COALESCE(NULLIF(?, ''), mother_name),
        date_of_birth = COALESCE(NULLIF(?, ''), date_of_birth),
        gender = COALESCE(NULLIF(?, ''), gender),
        national_id = COALESCE(NULLIF(?, ''), national_id),
        birth_certificate = COALESCE(NULLIF(?, ''), birth_certificate),
        occupation = COALESCE(NULLIF(?, ''), occupation),
        present_address = COALESCE(NULLIF(?, ''), present_address),
        permanent_address = COALESCE(NULLIF(?, ''), permanent_address)
      WHERE id = ?`,
      [
        full_name, father_name, mother_name, date_of_birth,
        gender, national_id, birth_certificate, occupation,
        present_address, permanent_address, req.user.id
      ]
    );

    res.status(200).json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------- UPLOAD PROFILE PIC -------------------
exports.uploadProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file received in backend.' 
      });
    }

    const fileName = req.file.filename;
    const userId = req.user.id || req.user.userId || req.user._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token payload.'
      });
    }

    const query = 'UPDATE users SET profile_pic = ? WHERE id = ?';
    const [result] = await db.query(query, [fileName, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in database or no change made.'
      });
    }

    console.log(`Profile picture updated in DB for User ID: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully!',
      profile_pic: fileName
    });

  } catch (error) {
    console.error('MySQL Update Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database error while saving profile picture.',
      error: error.message
    });
  }
};