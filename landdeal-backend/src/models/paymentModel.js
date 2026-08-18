const db = require('../config/db');

class PaymentModel {
  static async createPayment({ transaction_id, user_id, property_id, amount, payment_method, status }) {
  const query = `
    INSERT INTO payments (transaction_id, user_id, property_id, amount, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const [result] = await db.execute(query, [
    transaction_id,
    user_id || 1,        // Fallback default user_id if null/undefined
    property_id || 1,    // Fallback default property_id if null/undefined
    amount || 225000.00,
    payment_method || 'bKash',
    status || 'pending'
  ]);
  return result;
}

  // UPDATED: Now accepts optional payment_method parameter
  static async updatePaymentStatus(transaction_id, status, val_id = null, payment_method = null) {
    let query;
    let params;

    if (payment_method) {
      query = `
        UPDATE payments 
        SET status = ?, val_id = ?, payment_method = ? 
        WHERE transaction_id = ?
      `;
      params = [status, val_id, payment_method, transaction_id];
    } else {
      query = `
        UPDATE payments 
        SET status = ?, val_id = ? 
        WHERE transaction_id = ?
      `;
      params = [status, val_id, transaction_id];
    }

    const [result] = await db.execute(query, params);
    return result;
  }

  // ADDED: Updates payment method, val_id, and status simultaneously
  static async updatePaymentDetails(transaction_id, status, val_id, payment_method) {
    const query = `
      UPDATE payments 
      SET status = ?, val_id = ?, payment_method = ? 
      WHERE transaction_id = ?
    `;
    const [result] = await db.execute(query, [status, val_id, payment_method, transaction_id]);
    return result;
  }

  static async getPaymentByTxnId(transaction_id) {
    const query = `
      SELECT p.*, pr.land_title, pr.district 
      FROM payments p
      LEFT JOIN properties pr ON p.property_id = pr.id
      WHERE p.transaction_id = ?
    `;
    const [rows] = await db.execute(query, [transaction_id]);
    return rows[0];
  }

  static async getPaymentsByUserId(user_id) {
    const query = `
      SELECT p.*, pr.land_title, pr.district 
      FROM payments p
      LEFT JOIN properties pr ON p.property_id = pr.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query, [user_id]);
    return rows;
  }

  // ADDED: Fallback method for payment5.html to return all rows if user_id matching is bypassed
  static async getAllPayments() {
    const query = `
      SELECT p.*, pr.land_title, pr.district 
      FROM payments p
      LEFT JOIN properties pr ON p.property_id = pr.id
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
  }
}

module.exports = PaymentModel;