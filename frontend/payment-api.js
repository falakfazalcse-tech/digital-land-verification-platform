const API_BASE_URL = 'http://localhost:5000/api/v1/payments';

function getTxnId() {
  return localStorage.getItem('active_txn_id');
}

function setTxnId(id) {
  localStorage.setItem('active_txn_id', id);
}

// Step 1: Initiate Payment
async function initiatePayment(propertyId = 1, paymentMethod = 'bkash') {
  try {
    const res = await fetch(`${API_BASE_URL}/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, paymentMethod, termsAccepted: true })
    });
    const result = await res.json();
    if (result.status === 'success') {
      setTxnId(result.data.transactionId);
    }
    return result;
  } catch (err) {
    console.error('Initiate Error:', err);
  }
}

// Step 2: Submit Account / Phone Details
async function submitAccountDetails(accountNumber) {
  try {
    const txnId = getTxnId();
    if (!txnId) throw new Error("Missing active transaction ID");
    const res = await fetch(`${API_BASE_URL}/${txnId}/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber })
    });
    return await res.json();
  } catch (err) {
    console.error('Submit Details Error:', err);
  }
}

// Step 3: Verify OTP Code
async function verifyOtp(otp) {
  try {
    const txnId = getTxnId();
    const res = await fetch(`${API_BASE_URL}/${txnId}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    return await res.json();
  } catch (err) {
    console.error('Verify OTP Error:', err);
  }
}

// Step 4: Get Receipt Data
async function getReceipt() {
  try {
    const txnId = getTxnId();
    if (!txnId) return null;
    const res = await fetch(`${API_BASE_URL}/${txnId}/receipt`);
    return await res.json();
  } catch (err) {
    console.error('Receipt Error:', err);
  }
}

// Step 5: Get History Ledger
async function getLedger() {
  try {
    const res = await fetch(`${API_BASE_URL}?status=all&page=1&limit=5`);
    return await res.json();
  } catch (err) {
    console.error('Ledger Error:', err);
  }
}