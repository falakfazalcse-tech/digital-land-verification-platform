const db = require('../config/db');

class Otp {
  static async create({ transactionId, otpHash, expiresAt }, connection = db) {
    // Invalidate prior active OTPs for this transaction
    await connection.execute(
      'UPDATE payment_otps SET is_used = TRUE WHERE transaction_id = ?',
      [transactionId]
    );

    const [result] = await connection.execute(
      `INSERT INTO payment_otps (transaction_id, otp_code_hash, expires_at)
       VALUES (?, ?, ?)`,
      [transactionId, otpHash, expiresAt]
    );
    return result.insertId;
  }

  static async findActiveByTransactionId(transactionId, connection = db) {
    const [rows] = await connection.execute(
      `SELECT * FROM payment_otps 
       WHERE transaction_id = ? AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [transactionId]
    );
    return rows[0] || null;
  }

  static async incrementAttempts(otpId, connection = db) {
    await connection.execute(
      `UPDATE payment_otps SET attempts = attempts + 1 WHERE id = ?`,
      [otpId]
    );
  }

  static async markUsed(otpId, connection = db) {
    await connection.execute(
      `UPDATE payment_otps SET is_used = TRUE WHERE id = ?`,
      [otpId]
    );
  }
}

module.exports = Otp;