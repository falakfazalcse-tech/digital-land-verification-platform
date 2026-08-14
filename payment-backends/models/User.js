const db = require('../config/db');

class User {
  static async findById(id) {
    const [rows] = await db.execute('SELECT id, full_name, email, phone, role FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }
}

module.exports = User;