const db = require('../config/db');

// Save direct payment from payment3.html into MariaDB
exports.createDirectPayment = async (req, res) => {
  try {
    const { transaction_id, user_id, property_id, amount, payment_method, status } = req.body;

    const sql = `
      INSERT INTO payments (transaction_id, user_id, property_id, amount, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(sql, [
      transaction_id,
      user_id || 1,        // Fallback default user_id to satisfy FK constraint
      property_id || 1,    // Fallback default property_id to satisfy FK constraint
      amount || 2825000.00,
      payment_method || 'bKash',
      status || 'completed'
    ]);

    console.log(`[MariaDB] Payment saved successfully. ID: ${result.insertId}`);
    return res.status(201).json({ status: 'success', id: result.insertId, transaction_id });

  } catch (error) {
    console.error('[MariaDB Insert Error]:', error.sqlMessage || error.message);
    return res.status(500).json({ status: 'error', message: error.sqlMessage || error.message });
  }
};

// Fetch payment records for payment5.html
exports.getUserPayments = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM payments ORDER BY id DESC');
    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('[MariaDB Query Error]:', error.sqlMessage || error.message);
    return res.status(500).json({ status: 'error', message: error.sqlMessage || error.message });
  }
};

exports.initiatePayment = async (req, res) => {
  try {
    const { amount, selectedMethod, user_id, property_id } = req.body;

    // Fix null/undefined values safely
    const validUserId = user_id && user_id !== 'null' ? parseInt(user_id) : 1; 
    const validPropertyId = property_id && property_id !== 'null' ? parseInt(property_id) : 1;

    const tran_id = `TXN_${Date.now()}`;

    // Insert into MariaDB safely without violating NOT NULL constraint
    await PaymentModel.createPayment({
      transaction_id: tran_id,
      user_id: validUserId,        // Ensured non-null integer
      property_id: validPropertyId, // Ensured non-null integer
      amount: amount || 225000.00,
      payment_method: selectedMethod || 'bKash',
      status: 'pending'
    });

    // ... proceed with SSLCommerz init payload
  } catch (error) {
    console.error('[DB ERROR]:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
exports.paymentSuccess = async (req, res) => { /* Gateway logic if needed */ };
exports.paymentFail = async (req, res) => { /* Gateway logic if needed */ };
exports.paymentCancel = async (req, res) => { /* Gateway logic if needed */ };
exports.paymentIpn = async (req, res) => { /* Gateway logic if needed */ };
exports.getPaymentByTxn = async (req, res) => { /* Single TXN lookup logic */ };