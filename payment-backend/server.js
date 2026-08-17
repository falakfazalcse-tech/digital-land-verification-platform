const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const STORE_ID = 'digit6a75fc760b079';
const STORE_PASSWORD = '3931a536d3216af8fa02ac5c1197688c';
const IS_LIVE = false; // Set to true for live environment

// 1. Initiate SSLCommerz Session
app.post('/api/v1/sslcommerz/initiate', async (req, res) => {
  const tran_id = 'TXN_' + Date.now();
  const { amount, selectedMethod } = req.body;

  const data = {
    total_amount: amount || 2825000.00,
    currency: 'BDT',
    tran_id: tran_id,
    success_url: `http://localhost:5000/api/v1/sslcommerz/success?tran_id=${tran_id}`,
    fail_url: `http://localhost:5000/api/v1/sslcommerz/fail?tran_id=${tran_id}`,
    cancel_url: `http://localhost:5000/api/v1/sslcommerz/cancel?tran_id=${tran_id}`,
    ipn_url: 'http://localhost:5000/api/v1/sslcommerz/ipn',
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
    value_a: selectedMethod || 'bkash' // Store method type
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

// 2. Success Redirect Handler from SSLCommerz
app.post('/api/v1/sslcommerz/success', async (req, res) => {
  const { tran_id, val_id, card_type } = req.body;
  const urlTranId = req.query.tran_id || tran_id;

  try {
    // Validate transaction with SSLCommerz server
    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, IS_LIVE);
    const validateResponse = await sslcz.validate({ val_id });

    if (validateResponse.status === 'VALID' || validateResponse.status === 'VALIDATED') {
      // INSERT INTO YOUR MARIADB DATABASE HERE
      // await db.query("INSERT INTO payments ...", [urlTranId, card_type, amount, 'completed']);

      // Redirect user to frontend payment4.html page
      return res.redirect(`http://localhost:5500/payment4.html?transaction_id=${urlTranId}&payment_method=${encodeURIComponent(card_type || 'SSLCommerz')}`);
    } else {
      return res.redirect(`http://localhost:5500/payment1.html?error=validation_failed`);
    }
  } catch (err) {
    console.error('Validation Error:', err);
    return res.redirect(`http://localhost:5500/payment4.html?transaction_id=${urlTranId}&payment_method=SSLCommerz`);
  }
});

// 3. Fail Handler
app.post('/api/v1/sslcommerz/fail', (req, res) => {
  res.redirect(`http://localhost:5500/payment1.html?error=payment_failed`);
});

// 4. Cancel Handler
app.post('/api/v1/sslcommerz/cancel', (req, res) => {
  res.redirect(`http://localhost:5500/payment1.html?error=payment_cancelled`);
});

app.listen(5000, () => console.log('Server running on port 5000'));