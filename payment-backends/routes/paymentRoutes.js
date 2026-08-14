const express = require('express');
const { body, param, query } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

const router = express.Router();

// Apply Auth Protection to All Routes
router.use(authenticateToken);

// Step 1: Initiate Payment
router.post(
  '/initiate',
  [
    body('propertyId').isInt().withMessage('Valid property ID required'),
    body('paymentMethod').isIn(['bkash', 'nagad', 'rocket', 'card', 'bank']).withMessage('Invalid payment method'),
    body('termsAccepted').isBoolean().equals('true').withMessage('Terms must be accepted'),
    validate
  ],
  paymentController.initiatePayment
);

// Step 2: Submit Payment Details & Trigger OTP
router.post(
  '/:txnId/details',
  [
    param('txnId').isString().notEmpty().withMessage('Transaction ID required'),
    body('accountNumber').isString().trim().isLength({ min: 8, max: 30 }).withMessage('Valid account or card number required'),
    validate
  ],
  paymentController.submitPaymentDetails
);

// Step 3: Verify OTP Code
router.post(
  '/:txnId/verify-otp',
  [
    param('txnId').isString().notEmpty().withMessage('Transaction ID required'),
    body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('OTP must be a 6-digit number'),
    validate
  ],
  paymentController.verifyOtp
);

// Step 3 Option: Resend OTP
router.post(
  '/:txnId/resend-otp',
  [
    param('txnId').isString().notEmpty().withMessage('Transaction ID required'),
    validate
  ],
  paymentController.resendOtp
);

// Step 4 & Modal: Fetch Transaction Receipt
router.get(
  '/:txnId/receipt',
  [
    param('txnId').isString().notEmpty().withMessage('Transaction ID required'),
    validate
  ],
  paymentController.getReceipt
);

// Step 5: Get Paginated Transaction History Ledger
router.get(
  '/',
  [
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate
  ],
  paymentController.getTransactions
);

module.exports = router;