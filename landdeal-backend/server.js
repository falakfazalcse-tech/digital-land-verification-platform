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
const PaymentModel = require('./src/models/paymentModel'); 

const app = express();

// Middleware Configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Asset Hosting
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));
app.use('/uploads', express.static('uploads'));

// Environment & Config Variables
const PORT = process.env.PORT || 5000;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:5500/frontend';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;

const STORE_ID = process.env.SSL_STORE_ID;
const STORE_PASSWORD = process.env.SSL_STORE_PASSWORD;
const IS_LIVE = process.env.SSL_IS_LIVE === 'true';

// Helper Function: Save/Update Payment Record (UPDATED: userId parameter added properly)
async function savePaymentToDB(txnId, method, amount, status, valId = null, userId = 1) {
  try {
    const existingPayment = await PaymentModel.getPaymentByTxnId(txnId);
    if (existingPayment) {
      await PaymentModel.updatePaymentDetails(txnId, status, valId, method);
    } else {
      await PaymentModel.createPayment({
        transaction_id: txnId,
        user_id: userId || 1, 
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);

// Transaction History Endpoints
app.get('/api/v1/payments', async (req, res) => {
  try {
    const rows = await PaymentModel.getAllPayments();
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Database query error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch payment history' });
  }
});

app.get('/api/v1/payments/user/:userId', async (req, res) => {
  try {
    const rows = await PaymentModel.getPaymentsByUserId(req.params.userId);
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Database query error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch user payments' });
  }
});

// SSLCommerz Payment Initiation (PROTECTED ROUTE)
app.post('/api/v1/sslcommerz/initiate', authMiddleware, async (req, res) => {
  const tran_id = 'TXN_' + Date.now();
  
  // Safe User ID extraction from decoded JWT
  const activeUserId = req.user?.id || req.user?.userId || req.user?.user_id; 

  if (!activeUserId) {
    return res.status(401).json({ status: 'error', message: 'Invalid User Authentication' });
  }

  const { amount, selectedMethod, property_id } = req.body;
  const userRequestedAmount = Number(amount) || 225000.00;
  const MAX_SANDBOX_LIMIT = 500000.00;
  const processedAmount = Math.min(userRequestedAmount, MAX_SANDBOX_LIMIT);

  console.log(`[PAYMENT INITIATED] Logged-in User ID: ${activeUserId} | Amount: BDT ${userRequestedAmount}`);

  try {
    await PaymentModel.createPayment({
      transaction_id: tran_id,
      user_id: Number(activeUserId),
      property_id: property_id ? Number(property_id) : 1,
      amount: userRequestedAmount,
      payment_method: selectedMethod || 'bKash',
      status: 'pending'
    });
  } catch (err) {
    console.error('[DB INIT ERROR]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to record transaction' });
  }

  const data = {
  total_amount: 100,
  currency: 'BDT',
  tran_id: transactionId,
  success_url: `${process.env.BASE_URL}/api/v1/payments/success`,
  fail_url: `${process.env.BASE_URL}/api/v1/payments/fail`,
  cancel_url: `${process.env.BASE_URL}/api/v1/payments/cancel`,
    
    ipn_url: `${process.env.BASE_URL}/api/v1/sslcommerz/ipn`,
    
    shipping_method: 'NO',
    product_name: '12.5 katha Residential Plot',
    product_category: 'RealEstate',
    product_profile: 'general',
    cus_name: req.user?.name || 'Property Buyer',
    cus_email: req.user?.email || 'buyer@example.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_postcode: '1229',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    value_a: selectedMethod || 'bkash',
    value_b: String(activeUserId)
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

// SSLCommerz Success Callback
app.post('/api/v1/sslcommerz/success', async (req, res) => {
  const { tran_id, val_id, card_type, amount, value_b } = req.body;
  
  const finalTranId = req.query.tran_id || tran_id;
  const finalAmount = Number(req.query.requested_amount) || Number(amount) || 225000.00;
  const finalMethod = card_type || 'BKASH';
  
  let rawUserId = req.query.user_id || value_b;
  let finalUserId = Number(rawUserId);

  if (!rawUserId || isNaN(finalUserId) || finalUserId <= 0) {
    finalUserId = 1; 
  }

  try {
    await savePaymentToDB(finalTranId, finalMethod, finalAmount, 'completed', val_id, finalUserId);
  } catch (err) {
    console.error('[DB EXCEPTION]:', err.message);
  }

  return res.redirect(`${FRONTEND_BASE_URL}/payment4.html?transaction_id=${finalTranId}&payment_method=${encodeURIComponent(finalMethod)}&amount=${finalAmount}`);
});

// SSLCommerz Fail Callback
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

// SSLCommerz Cancel Callback
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

// Centralized Error Handlers
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});