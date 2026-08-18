require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const SSLCommerzPayment = require('sslcommerz-lts');

// --- Import Route Modules ---
const authRoutes = require('./src/routes/authRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const authMiddleware = require('./src/middlewares/authMiddleware'); 

// --- Import Models ---
const PaymentModel = require('./src/models/PaymentModel'); // Adjust path to match your directory structure

const app = express();

// =========================
// Middleware Configuration
// =========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Asset Hosting
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));
app.use('/uploads', express.static('uploads'));

// Environment & Config Variables
const PORT = process.env.PORT || 5000;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5500/digital-land-verification-platform/frontend';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;

const STORE_ID = process.env.SSL_STORE_ID;
const STORE_PASSWORD = process.env.SSL_STORE_PASSWORD;
const IS_LIVE = process.env.SSL_IS_LIVE === 'true';

// Helper Function: Save/Update Payment Record
async function savePaymentToDB(txnId, method, amount, status, valId = null) {
  try {
    // Check if the payment already exists to update or insert accordingly
    const existingPayment = await PaymentModel.getPaymentByTxnId(txnId);
    if (existingPayment) {
      await PaymentModel.updatePaymentDetails(txnId, status, valId, method);
    } else {
      await PaymentModel.createPayment({
        transaction_id: txnId,
        user_id: 1, // Default/Fallback user ID; adjust as needed for logged-in user context
        property_id: null,
        amount: amount,
        payment_method: method,
        status: status
      });
    }
    console.log(`[DB SUCCESS] Processed payment for Txn: ${txnId}`);
  } catch (dbErr) {
    console.error(`[DB ERROR] Failed to save transaction ${txnId}:`, dbErr.message);
  }
}

// =========================
// API Routes
// =========================

// 1. Auth & Property Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);

// 2. Transaction History Endpoints
app.get('/api/v1/payments', async (req, res) => {
  try {
    const rows = await PaymentModel.getAllPayments();
    return res.json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Database query error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch payment history from database' });
  }
});

app.get('/api/v1/payments/user/:userId', async (req, res) => {
  try {
    const rows = await PaymentModel.getPaymentsByUserId(req.params.userId);
    return res.json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Database query error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch user payments' });
  }
});

// 3. SSLCommerz Payment Initiation
app.post('/api/v1/sslcommerz/initiate', authMiddleware, async (req, res) => {
  const tran_id = 'TXN_' + Date.now();
  
  // 1. JWT Token থেকে লগইন করা ইউজারের আসল ID এক্সট্র্যাক্ট করা
  const activeUserId = req.user.id; 

  const { amount, selectedMethod, property_id } = req.body;
  const userRequestedAmount = Number(amount) || 225000.00;
  const MAX_SANDBOX_LIMIT = 500000.00;
  const processedAmount = Math.min(userRequestedAmount, MAX_SANDBOX_LIMIT);

  console.log(`[PAYMENT INITIATED] Logged-in User ID: ${activeUserId} | Amount: BDT ${userRequestedAmount}`);

  // 2. DataBase-এ Logged-in User ID দিয়েই Record তৈরি হবে
  try {
    await PaymentModel.createPayment({
      transaction_id: tran_id,
      user_id: Number(activeUserId), // Logged-In User ID Connected!
      property_id: property_id ? Number(property_id) : 1,
      amount: userRequestedAmount,
      payment_method: selectedMethod || 'bKash',
      status: 'pending'
    });
  } catch (err) {
    console.error('[DB INIT ERROR]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to record transaction' });
  }

  // 3. SSLCommerz Payload Build
  const data = {
    total_amount: processedAmount,
    currency: 'BDT',
    tran_id: tran_id,
    
    // Pass user_id explicitly in query params and value_b for SSLCommerz POST callback
    success_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/success?tran_id=${tran_id}&requested_amount=${userRequestedAmount}&user_id=${activeUserId}`,
    fail_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/fail?tran_id=${tran_id}`,
    cancel_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/cancel?tran_id=${tran_id}`,
    ipn_url: `${BACKEND_BASE_URL}/api/v1/sslcommerz/ipn`,
    
    shipping_method: 'NO',
    product_name: '12.5 katha Residential Plot',
    product_category: 'RealEstate',
    product_profile: 'general',
    cus_name: req.user.name || 'Property Buyer',
    cus_email: req.user.email || 'buyer@example.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_postcode: '1229',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    value_a: selectedMethod || 'bkash',
    value_b: String(activeUserId) // Sent back by SSLCommerz
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

// 4. SSLCommerz Success Callback
app.post('/api/v1/sslcommerz/success', async (req, res) => {
  const { tran_id, val_id, card_type, amount, value_b } = req.body;
  
  const finalTranId = req.query.tran_id || tran_id;
  const finalAmount = Number(req.query.requested_amount) || Number(amount) || 225000.00;
  const finalMethod = card_type || 'BKASH';
  
  // 💡 Safe User ID Extractor: query param, value_b অথবা Default User (1)
  let rawUserId = req.query.user_id || value_b;
  let finalUserId = Number(rawUserId);

  // যদি ইউজার আইডি না পাওয়া যায়, তবে Default System User ID = 1 ব্যবহার হবে
  if (!rawUserId || isNaN(finalUserId) || finalUserId <= 0) {
    finalUserId = 1; 
  }

  try {
    // Save payment safely without triggering Database FK Error
    await savePaymentToDB(finalTranId, finalMethod, finalAmount, 'completed', val_id, finalUserId);
  } catch (err) {
    console.error('[DB EXCEPTION]:', err.message);
  }

  // Redirect to payment4.html
  return res.redirect(`${FRONTEND_BASE_URL}/payment4.html?transaction_id=${finalTranId}&payment_method=${encodeURIComponent(finalMethod)}&amount=${finalAmount}`);
});

// 5. SSLCommerz Fail Callback
app.post('/api/v1/sslcommerz/fail', async (req, res) => {
  const tranId = req.query.tran_id || req.body.tran_id;
  if (tranId) {
    try {
      await PaymentModel.updatePaymentStatus(tranId, 'failed');
    } catch (err) {
      console.error('[DB FAIL UPDATE ERROR]:', err.message);
    }
  }
  res.redirect(`${FRONTEND_BASE_URL}/payment1.html?error=payment_failed`);
});

// 6. SSLCommerz Cancel Callback
app.post('/api/v1/sslcommerz/cancel', async (req, res) => {
  const tranId = req.query.tran_id || req.body.tran_id;
  if (tranId) {
    try {
      await PaymentModel.updatePaymentStatus(tranId, 'cancelled');
    } catch (err) {
      console.error('[DB CANCEL UPDATE ERROR]:', err.message);
    }
  }
  res.redirect(`${FRONTEND_BASE_URL}/payment1.html?error=payment_cancelled`);
});

// 7. System Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date()
  });
});

// =========================
// Global Handlers
// =========================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// =========================
// Start Server
// =========================
app.listen(PORT, () => {
  console.log(`🚀 LandDeal Unified Server running on http://localhost:${PORT}`);
});