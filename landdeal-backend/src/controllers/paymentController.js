const db = require('../config/db');
const PaymentModel = require('../models/paymentModel');

// Save direct payment
exports.createDirectPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId; // Extracted from decoded JWT
    const { transaction_id, property_id, amount, payment_method, status } = req.body;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized user.' });
    }

    const sql = `
      INSERT INTO payments (transaction_id, user_id, property_id, amount, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(sql, [
      transaction_id,
      userId,
      property_id || 1,
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

// Initiate payment with SSLCommerz
exports.initiatePayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId; // Extracted safely from JWT token
    const { amount, selectedMethod, property_id } = req.body;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User authentication required.' });
    }

    const tran_id = `TXN_${Date.now()}`;

    // Insert into DB using PaymentModel
    await PaymentModel.createPayment({
      transaction_id: tran_id,
      user_id: userId,
      property_id: property_id ? parseInt(property_id) : 1,
      amount: amount || 225000.00,
      payment_method: selectedMethod || 'bKash',
      status: 'pending'
    });

    // ... proceed with SSLCommerz session initiation ...

  } catch (error) {
    console.error('[DB ERROR]:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get authenticated user's payments
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    // Fetch payments specific to logged-in user
    const rows = await PaymentModel.getPaymentsByUserId(userId);
    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('[MariaDB Query Error]:', error.sqlMessage || error.message);
    return res.status(500).json({ status: 'error', message: error.sqlMessage || error.message });
  }
};