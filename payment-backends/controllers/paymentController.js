const db = require('../config/db');
const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const Otp = require('../models/Otp');
const { generateOtp, hashOtp, verifyOtpHash } = require('../utils/otpGenerator');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Step 1: Initiate Payment Session
 * POST /api/v1/payments/initiate
 */
exports.initiatePayment = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { propertyId, paymentMethod, termsAccepted } = req.body;
    const userId = req.user.id;

    if (!termsAccepted) {
      await connection.rollback();
      return sendError(res, 400, 'You must accept the terms and conditions');
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      await connection.rollback();
      return sendError(res, 404, 'Property not found');
    }

    if (property.status === 'sold') {
      await connection.rollback();
      return sendError(res, 400, 'Property is no longer available');
    }

    const txnId = 'TXN-2026-' + Math.floor(100000 + Math.random() * 900000);

    const transactionId = await Transaction.create({
      txnId,
      userId,
      propertyId,
      amount: property.price,
      paymentMethod
    }, connection);

    await connection.commit();

    return sendSuccess(res, 201, 'Payment session initiated', {
      transactionId: txnId,
      amount: property.price,
      paymentMethod,
      property: {
        id: property.id,
        title: property.title,
        location: property.location
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Step 2: Submit Gateway/Account Details & Issue OTP
 * POST /api/v1/payments/:txnId/details
 */
exports.submitPaymentDetails = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { txnId } = req.params;
    const { accountNumber } = req.body;

    const transaction = await Transaction.findByTxnId(txnId, connection);
    if (!transaction) {
      await connection.rollback();
      return sendError(res, 404, 'Transaction not found');
    }

    if (transaction.status !== 'Pending') {
      await connection.rollback();
      return sendError(res, 400, `Cannot process transaction in state: ${transaction.status}`);
    }

    // Mask account number for security before saving
    const maskedAccount = accountNumber.length > 4 
      ? '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4) 
      : accountNumber;

    await Transaction.updateDetails(txnId, maskedAccount, connection);

    // Generate & Hash 6-digit OTP
    const rawOtp = generateOtp();
    const hashedOtp = await hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    await Otp.create({
      transactionId: transaction.id,
      otpHash: hashedOtp,
      expiresAt
    }, connection);

    await connection.commit();

    // Console log OTP for local development testing
    console.log(`[OTP SENT] Transaction ${txnId} OTP Code: ${rawOtp}`);

    return sendSuccess(res, 200, 'Payment details accepted. OTP code dispatched to registered device', {
      txnId,
      expiresInSeconds: 300,
      devNote: process.env.NODE_ENV === 'development' ? `Demo OTP Code: ${rawOtp}` : undefined
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Step 3: Verify OTP & Complete Transaction
 * POST /api/v1/payments/:txnId/verify-otp
 */
exports.verifyOtp = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { txnId } = req.params;
    const { otp } = req.body;

    const transaction = await Transaction.findByTxnId(txnId, connection);
    if (!transaction) {
      await connection.rollback();
      return sendError(res, 404, 'Transaction not found');
    }

    const activeOtp = await Otp.findActiveByTransactionId(transaction.id, connection);
    if (!activeOtp) {
      await connection.rollback();
      return sendError(res, 400, 'OTP code expired or invalid. Please request a new code.');
    }

    if (activeOtp.attempts >= 3) {
      await Otp.markUsed(activeOtp.id, connection);
      await connection.commit();
      return sendError(res, 400, 'Maximum OTP attempts exceeded. Please request a new code.');
    }

    const isMatch = await verifyOtpHash(otp, activeOtp.otp_code_hash);
    if (!isMatch) {
      await Otp.incrementAttempts(activeOtp.id, connection);
      await connection.commit();
      return sendError(res, 400, 'Invalid verification code');
    }

    // Code verified: finalize payment and update land property status
    await Otp.markUsed(activeOtp.id, connection);
    await Transaction.updateStatus(txnId, 'Completed', connection);
    await Property.updateStatus(transaction.property_id, 'sold', connection);

    await connection.commit();

    return sendSuccess(res, 200, 'Payment verified and transaction completed successfully', {
      txnId,
      status: 'Completed'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Step 3 Option: Resend OTP
 * POST /api/v1/payments/:txnId/resend-otp
 */
exports.resendOtp = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { txnId } = req.params;
    const transaction = await Transaction.findByTxnId(txnId, connection);

    if (!transaction || transaction.status !== 'Pending') {
      await connection.rollback();
      return sendError(res, 400, 'Invalid transaction for OTP resend');
    }

    const rawOtp = generateOtp();
    const hashedOtp = await hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.create({
      transactionId: transaction.id,
      otpHash: hashedOtp,
      expiresAt
    }, connection);

    await connection.commit();

    console.log(`[OTP RESENT] Transaction ${txnId} New OTP: ${rawOtp}`);

    return sendSuccess(res, 200, 'A new verification code has been sent', {
      txnId,
      expiresInSeconds: 300,
      devNote: process.env.NODE_ENV === 'development' ? `Demo OTP Code: ${rawOtp}` : undefined
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Step 4 & Modal: Fetch Single Transaction Receipt
 * GET /api/v1/payments/:txnId/receipt
 */
exports.getReceipt = async (req, res, next) => {
  try {
    const { txnId } = req.params;
    const transaction = await Transaction.findByTxnId(txnId);

    if (!transaction) {
      return sendError(res, 404, 'Transaction receipt not found');
    }

    const methodColorMap = {
      bkash: '#e2136e',
      nagad: '#f7941d',
      rocket: '#8c338d',
      card: '#1a1f71',
      bank: '#0b6b32'
    };

    return sendSuccess(res, 200, 'Receipt retrieved successfully', {
      id: transaction.txn_id,
      title: transaction.property_title,
      location: transaction.property_location,
      amount: `৳ ${Number(transaction.amount).toLocaleString('en-IN')}`,
      method: transaction.payment_method.charAt(0).toUpperCase() + transaction.payment_method.slice(1),
      methodColor: methodColorMap[transaction.payment_method.toLowerCase()] || '#0b6b32',
      status: transaction.status,
      date: new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date(transaction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 5: Get All Payments Ledger (Paginated + Filtered)
 * GET /api/v1/payments
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;

    const items = await Transaction.findPaginatedByUser(userId, status, offset, limit);
    const totalItems = await Transaction.countByUser(userId, status);

    const formattedItems = items.map(item => {
      const methodColorMap = {
        bkash: '#e2136e',
        nagad: '#f7941d',
        rocket: '#8c338d',
        card: '#1a1f71',
        bank: '#0b6b32'
      };
      return {
        id: item.id,
        title: item.title,
        location: item.location,
        amount: `৳ ${Number(item.amount).toLocaleString('en-IN')}`,
        method: item.method.charAt(0).toUpperCase() + item.method.slice(1),
        methodColor: methodColorMap[item.method.toLowerCase()] || '#0b6b32',
        status: item.status,
        date: item.date,
        time: item.time
      };
    });

    return sendSuccess(res, 200, 'Transactions retrieved successfully', {
      transactions: formattedItems,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    next(error);
  }
};