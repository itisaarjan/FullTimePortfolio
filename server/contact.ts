import { Router } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const router = Router();

// Rate limiting in memory (simple implementation)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 1;

// Contact form validation schema
const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name must be less than 80 characters'),
  email: z.string().email('Please enter a valid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message must be less than 2000 characters'),
});

type ContactData = z.infer<typeof contactSchema>;

// Rate limiting middleware
const rateLimit = (req: any, res: any, next: any) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip);

  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before trying again.',
    });
  }

  rateLimitMap.set(ip, now);
  next();
};

// Create Nodemailer transporter
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

// Contact form submission endpoint
router.post('/', rateLimit, async (req, res) => {
  try {
    // Validate request body
    const validationResult = contactSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid form data. Please check your inputs.',
      });
    }

    const { name, email, message } = validationResult.data;

    // Check required environment variables
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO_EMAIL', 'FROM_EMAIL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please contact the administrator.',
      });
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

    res.json({
      success: true,
      message: 'Message sent successfully',
    });

  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email. Please try again later.',
    });
  }
});

export { router as contactRouter };
