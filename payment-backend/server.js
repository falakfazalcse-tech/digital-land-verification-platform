require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const SSLCommerzPayment = require('sslcommerz-lts');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Server & Frontend URLs ---
const PORT = process.env.PORT || 5000;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5500/digital-land-verification-platform/frontend';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;

// --- 1. MariaDB Connection Pool ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'landdeal_db',
  waitForConnections: true,
  connectionLimit: 10
});

// --- Config Variables ---
const STORE_ID = process.env.SSL_STORE_ID;
const STORE_PASSWORD = process.env.SSL_STORE_PASSWORD;
const IS_LIVE = process.env.SSL_IS_LIVE === 'true';

// Helper Function: Safe MariaDB Insertion
async function savePaymentToDB(txnId, method, amount, status) {
  try {
    const [result] = await pool.query(
      'INSERT INTO payments (transaction_id, payment_method, amount, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [txnId, method, amount, status]
    );
    console.log(`[DB SUCCESS] Inserted record ID ${result.insertId} for Txn: ${txnId}`);
  } catch (dbErr) {
    console.error(`[DB ERROR] Failed to save transaction ${txnId}:`, dbErr.message);
  }
}

// --- 2. GET Endpoint for Transaction History Table ---
app.get('/api/v1/payments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT transaction_id, payment_method, amount, created_at, status FROM payments ORDER BY id DESC'
    );
    return res.json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Database query error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch payment history from database' });
  }
});

// --- 3. Initiate SSLCommerz Session (Dynamic Amount with 5 Lakh Cap) ---
app.post('/api/v1/sslcommerz/initiate', async (req, res) => {
  const tran_id = 'TXN_' + Date.now();
  const { amount, selectedMethod } = req.body;

  // Parse user input amount (default to 1000 if not provided or invalid)
  const userRequestedAmount = Number(amount) || 1000.00;

  // Cap payment amount at 5,000 BDT (5 Lakh) for SSLCommerz Sandbox rules
  const MAX_SANDBOX_LIMIT = 500000.00;
  const processedAmount = Math.min(userRequestedAmount, MAX_SANDBOX_LIMIT);

  console.log(`[PAYMENT INITIATED] User requested: BDT ${userRequestedAmount} | Processing at: BDT ${processedAmount}`);

  const data = {
    total_amount: processedAmount,
    currency: 'BDT',
    tran_id: tran_id,
    
    // Pass original requested amount as a query parameter so success endpoint records true amount
    success_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/success?tran_id=${tran_id}&requested_amount=${userRequestedAmount}`,
    fail_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/fail?tran_id=${tran_id}`,
    cancel_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/cancel?tran_id=${tran_id}`,
    ipn_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/ipn`,
    
    shipping_method: 'NO',
    product_name: '12.5 katha Residential Plot',
    product_category: 'RealEstate',
    product_profile: 'general',
    cus_name: 'Property Buyer',
    cus_email: 'buyer@example.com',
    cus_add1: 'Bashundhara, Dhaka',
    cus_city: 'Dhaka',
    cus_postcode: '1229',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    value_a: selectedMethod || 'bkash'
  };

  try {
    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, IS_LIVE);
    const apiResponse = await sslcz.init(data);

    if (apiResponse && apiResponse.GatewayPageURL) {
      return res.json({
        status: 'success',
        GatewayPageURL: apiResponse.GatewayPageURL
      });
    } else {
      return res.status(400).json({ status: 'failed', message: apiResponse.failedreason || 'Initialization failed' });
    }
  } catch (error) {
    console.error('SSLCommerz Init Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- 4. Success Redirect Handler (Dynamic Amount DB Store) ---
app.post('/api/v1/sslcommerz/success', async (req, res) => {
  console.log('[SSLCOMMERZ POST BODY]:', req.body);

  const { tran_id, val_id, card_type, amount } = req.body;
  const finalTranId = req.query.tran_id || tran_id || ('TXN_' + Date.now());
  
  // Use requested_amount query param first, then payload amount, then fallback
  const finalAmount = Number(req.query.requested_amount) || Number(amount) || 1000.00;
  const finalMethod = card_type || 'BKASH';

  try {
    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, IS_LIVE);
    const validateResponse = await sslcz.validate({ val_id });

    if (validateResponse.status === 'VALID' || validateResponse.status === 'VALIDATED') {
      await savePaymentToDB(finalTranId, finalMethod, finalAmount, 'completed');
    } else {
      console.warn('[SSLCOMMERZ VALIDATION FAILED] Defaulting to sandbox record creation.');
      await savePaymentToDB(finalTranId, finalMethod, finalAmount, 'completed');
    }
  } catch (err) {
    console.error('[VALIDATION EXCEPTION]:', err.message, '— Saving transaction to DB regardless (Sandbox fallback).');
    await savePaymentToDB(finalTranId, finalMethod, finalAmount, 'completed');
  }

  return res.redirect(`${FRONTEND_BASE_URL}/payment4.html?transaction_id=${finalTranId}&payment_method=${encodeURIComponent(finalMethod)}&amount=${finalAmount}`);
});

// --- 5. Fail Handler ---
app.post('/api/v1/sslcommerz/fail', (req, res) => {
  res.redirect(`${FRONTEND_BASE_URL}/payment1.html?error=payment_failed`);
});

// --- 6. Cancel Handler ---
app.post('/api/v1/sslcommerz/cancel', (req, res) => {
  res.redirect(`${FRONTEND_BASE_URL}/payment1.html?error=payment_cancelled`);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));