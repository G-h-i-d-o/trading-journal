exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  try {
    const { email, code } = JSON.parse(event.body || '{}');

    if (!email || !code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Email and code are required.' })
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM || process.env.LOGIN_CODE_FROM || 'TradeWizer Journal <no-reply@tradewizer.app>';

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM in Netlify environment variables.'
        })
      };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Your TradeWizer login code',
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <h2 style="margin-bottom: 8px;">TradeWizer login code</h2>
            <p>Your one-time login code is:</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${code}</p>
            <p>This code will expire in 10 minutes.</p>
          </div>
        `
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Unable to send login code email.');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message || 'Unable to send login code email.' })
    };
  }
};
