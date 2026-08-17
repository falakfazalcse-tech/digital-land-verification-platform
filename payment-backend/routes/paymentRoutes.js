const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Direct & Gateway Endpoints (Unprotected for direct form submissions)
router.post('/direct', paymentController.createDirectPayment);
router.post('/initiate', paymentController.initiatePayment);

// Payment Gateway Callbacks
router.post('/success/:tran_id', paymentController.paymentSuccess);
router.post('/fail/:tran_id', paymentController.paymentFail);
router.post('/cancel/:tran_id', paymentController.paymentCancel);
router.post('/ipn', paymentController.paymentIpn);

// Fetching Endpoints (Unprotected so payment5.html can load history directly)
router.get('/', paymentController.getUserPayments);
router.get('/txn/:tran_id', paymentController.getPaymentByTxn);

module.exports = router;