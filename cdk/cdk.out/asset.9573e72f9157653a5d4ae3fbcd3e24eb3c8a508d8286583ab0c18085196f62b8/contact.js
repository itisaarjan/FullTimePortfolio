const nodemailer = require('nodemailer');

// Email configuration
const createTransporter = () => {
  const isSecure = process.env.SMTP_PORT === '465';
  
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Rate limiting (simple in-memory for Lambda - will reset on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://arjansubedi.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, email, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: name, email, message',
        }),
      };
    }

    if (name.length < 2 || name.length > 80) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Name must be between 2 and 80 characters',
        }),
      };
    }

    if (!email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Please enter a valid email address',
        }),
      };
    }

    if (message.length < 10 || message.length > 2000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Message must be between 10 and 2000 characters',
        }),
      };
    }

    // Simple rate limiting by IP
    const clientIP = event.requestContext.identity.sourceIp;
    const now = Date.now();
    const lastRequest = rateLimitMap.get(clientIP);

    if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Too many requests. Please wait a moment before trying again.',
        }),
      };
    }

    rateLimitMap.set(clientIP, now);

    // Check required environment variables
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO_EMAIL', 'FROM_EMAIL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Email service not configured. Please contact the administrator.',
        }),
      };
    }

    // Create email transporter
    const transporter = createTransporter();

    // Email content
    const subject = `New portfolio message from ${name}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Message:</strong></p>
          <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #007bff;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>
        <div style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p>This message was sent from your portfolio contact form on ${new Date().toLocaleString()}.</p>
        </div>
      </div>
    `;

    // Send email
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL,
      subject,
      html: htmlBody,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message sent successfully',
      }),
    };

  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to send email. Please try again later.',
      }),
    };
  }
};
