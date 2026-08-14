const db = require('../config/db');

class Transaction {
  static async create({ txnId, userId, propertyId, amount, paymentMethod }, connection = db) {
    const [result] = await connection.execute(
      `INSERT INTO transactions (txn_id, user_id, property_id, amount, payment_method, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [txnId, userId, propertyId, amount, paymentMethod]
    );
    return result.insertId;
  }

  static async findByTxnId(txnId, connection = db) {
    const [rows] = await connection.execute(
      `SELECT t.*, p.title as property_title, p.location as property_location 
       FROM transactions t
       JOIN properties p ON t.property_id = p.id
       WHERE t.txn_id = ?`,
      [txnId]
    );
    return rows[0] || null;
  }

  static async updateDetails(txnId, accountNumber, connection = db) {
    await connection.execute(
      `UPDATE transactions SET account_number = ? WHERE txn_id = ?`,
      [accountNumber, txnId]
    );
  }

  static async updateStatus(txnId, status, connection = db) {
    await connection.execute(
      `UPDATE transactions SET status = ? WHERE txn_id = ?`,
      [status, txnId]
    );
  }

  static async findPaginatedByUser(userId, status, offset, limit) {
    let query = `SELECT t.txn_id as id, p.title, p.location, t.amount, t.payment_method as method, 
                        t.status, DATE_FORMAT(t.created_at, '%d %b %Y') as date,
                        DATE_FORMAT(t.created_at, '%h:%i %p') as time
                 FROM transactions t
                 JOIN properties p ON t.property_id = p.id
                 WHERE t.user_id = ?`;
    const params = [userId];

    if (status && status.toLowerCase() !== 'all') {
      query += ` AND LOWER(t.status) = LOWER(?)`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async countByUser(userId, status) {
    let query = `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`;
    const params = [userId];

    if (status && status.toLowerCase() !== 'all') {
      query += ` AND LOWER(status) = LOWER(?)`;
      params.push(status);
    }

    const [rows] = await db.execute(query, params);
    return rows[0].total;
  }
}

module.exports = Transaction;