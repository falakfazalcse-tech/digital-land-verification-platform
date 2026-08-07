const db = require('../config/db');

class Property {
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async updateStatus(id, status, connection = db) {
    await connection.execute('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
  }
}

module.exports = Property;