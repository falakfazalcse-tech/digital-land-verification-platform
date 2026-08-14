const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'landdeal_db'
});

// Helper: Generate Txn ID
function generateTxnId() {
  return 'TXN-2026-' + Math.floor(100000 + Math.random() * 900000);
}

// Step 1: Initiate Payment
app.post('/api/v1/payments/initiate', async (req, res) => {
  try {
    const { propertyId = 1, paymentMethod = 'bkash', termsAccepted = true } = req.body;
    const [props] = await db.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (props.length === 0) return res.status(404).json({ status: 'error', message: 'Property not found' });

    const property = props[0];
    const txnId = generateTxnId();

    await db.query(
      `INSERT INTO payments (transaction_id, property_id, payment_method, amount, terms_accepted, status)
       VALUES (?, ?, ?, ?, ?, 'initiated')`,
      [txnId, property.id, paymentMethod, property.total_amount, termsAccepted]
    );

    res.json({
      status: 'success',
      data: { transactionId: txnId, amount: property.total_amount, paymentMethod }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Step 2: Submit Phone / Account Details
app.post('/api/v1/payments/:txnId/details', async (req, res) => {
  try {
    const { txnId } = req.params;
    const { accountNumber } = req.body;
    const generatedOtp = '123456'; // Mock OTP for testing

    const [result] = await db.query(
      `UPDATE payments SET account_number = ?, otp = ?, status = 'details_submitted' WHERE transaction_id = ?`,
      [accountNumber, generatedOtp, txnId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ status: 'error', message: 'Transaction not found' });

    res.json({ status: 'success', message: 'Details saved & OTP sent', data: { transactionId: txnId } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Step 3: Verify OTP Code
app.post('/api/v1/payments/:txnId/verify-otp', async (req, res) => {
  try {
    const { txnId } = req.params;
    const { otp } = req.body;

    const [rows] = await db.query('SELECT * FROM payments WHERE transaction_id = ?', [txnId]);
    if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'Transaction not found' });

    const payment = rows[0];
    if (payment.otp && payment.otp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code' });
    }

    await db.query(`UPDATE payments SET status = 'completed' WHERE transaction_id = ?`, [txnId]);
    res.json({ status: 'success', message: 'Payment verified and completed' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Step 4: Get Receipt Data
app.get('/api/v1/payments/:txnId/receipt', async (req, res) => {
  try {
    const { txnId } = req.params;
    const [rows] = await db.query(
      `SELECT p.*, pr.title, pr.location, pr.plot_id, pr.land_price, pr.service_fee, pr.verification_fee 
       FROM payments p JOIN properties pr ON p.property_id = pr.id WHERE p.transaction_id = ?`,
      [txnId]
    );

    if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'Receipt not found' });
    res.json({ status: 'success', data: rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Step 5: Get History Ledger
app.get('/api/v1/payments', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, pr.title, pr.location FROM payments p JOIN properties pr ON p.property_id = pr.id ORDER BY p.created_at DESC`
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));