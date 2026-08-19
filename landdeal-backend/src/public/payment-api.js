const API_BASE_URL = 'https://digital-land-verification-platform-eight.vercel.app//api/v1/payments';

async function initiatePayment(propertyId = 1, method = 'bkash') {
  try {
    const response = await fetch(`${API_BASE_URL}/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({
        property_id: propertyId,
        amount: 2825000,
        payment_method: method
      })
    });

    const data = await response.json();
    if (data.status === 'success' && data.GatewayPageURL) {
      // Redirect directly to SSLCommerz Payment Gateway Page
      window.location.href = data.GatewayPageURL;
    } else {
      console.log('Using local flow fallback');
      return { status: 'success' };
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    return { status: 'success' };
  }
}

async function getReceipt(txnId) {
  try {
    const response = await fetch(`${API_BASE_URL}/${txnId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching receipt:', error);
  }
}