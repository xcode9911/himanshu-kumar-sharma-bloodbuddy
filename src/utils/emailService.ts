import nodemailer from 'nodemailer';
import axios from 'axios';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = Number(process.env.BREVO_SMTP_PORT || 587);
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_PASS = process.env.BREVO_SMTP_PASS;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Initialize Nodemailer transporter
let nodemailerTransporter: nodemailer.Transporter | null = null;
if (SMTP_USER && SMTP_PASS) {
  nodemailerTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log('✓ Nodemailer (Gmail) initialized as primary email service');
} else {
  console.warn('⚠ SMTP credentials not configured. No primary SMTP configured; will attempt Brevo if available.');
}

// Initialize Brevo SMTP transporter (fallback for Nodemailer failures)
let brevoTransporter: nodemailer.Transporter | null = null;
if (BREVO_SMTP_USER && BREVO_SMTP_PASS) {
  brevoTransporter = nodemailer.createTransport({
    host: BREVO_SMTP_HOST,
    port: BREVO_SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: {
      user: BREVO_SMTP_USER,
      pass: BREVO_SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: {
      // Allow self-signed for environments that need it; set to true in production if desired
      rejectUnauthorized: false,
    },
  });
  console.log('✓ Brevo SMTP transporter initialized as secondary email service');
} else {
  console.warn('⚠ Brevo SMTP credentials not configured. Will skip Brevo fallback.');
}

// Helper: send via Brevo Transactional HTTP API (fallback when SMTP and Nodemailer fail)
const sendViaBrevoApi = async (to: string, subject: string, html: string, from: string) => {
  if (!BREVO_API_KEY) {
    throw new Error('Brevo API key not configured');
  }

  const payload = {
    sender: {
      email: from || (BREVO_SMTP_USER || 'noreply@bloodbuddy.com'),
      name: 'BloodBuddy',
    },
    to: [
      {
        email: to,
      },
    ],
    subject,
    htmlContent: html,
  } as any;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY,
  } as any;

  const url = 'https://api.brevo.com/v3/smtp/email';

  try {
    const resp = await axios.post(url, payload, { headers, timeout: 15000 });
    return resp.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const details = typeof data === 'string' ? data : JSON.stringify(data);
    const message = status
      ? `Brevo API request failed with status ${status}${details ? `: ${details}` : ''}`
      : `Brevo API request failed${error?.message ? `: ${error.message}` : ''}`;
    throw new Error(message);
  }
};

// Initialize Resend
// Resend has been removed — using Nodemailer primary and Brevo SMTP fallback only.

// Email sending utility with fallback logic
const sendEmailWithFallback = async (
  to: string,
  subject: string,
  html: string,
  from: string = SMTP_USER || 'noreply@bloodbuddy.com'
): Promise<void> => {
  let lastError: Error | null = null;

  // Try Nodemailer first (primary)
  if (nodemailerTransporter) {
    try {
      console.log(`[Primary] Attempting to send email via Nodemailer to ${to}`);
      await nodemailerTransporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(`✓ [Nodemailer] Email sent successfully to ${to}`);
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`✗ [Nodemailer] Failed to send email: ${lastError.message}`);
    }
  }

  // Try Brevo SMTP transporter next (if configured)
  if (brevoTransporter) {
    try {
      console.log(`[Secondary] Attempting to send email via Brevo SMTP to ${to}`);
      await brevoTransporter.sendMail({
        from: BREVO_SMTP_USER || from,
        to,
        subject,
        html,
      });
      console.log(`✓ [Brevo SMTP] Email sent successfully to ${to}`);
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`✗ [Brevo SMTP] Failed to send email: ${lastError.message}`);
    }
  }

  // Try Brevo Transactional HTTP API as a last-resort fallback
  if (BREVO_API_KEY) {
    try {
      console.log(`[Tertiary] Attempting to send email via Brevo HTTP API to ${to}`);
      await sendViaBrevoApi(to, subject, html, from);
      console.log(`✓ [Brevo API] Email sent successfully to ${to}`);
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`✗ [Brevo API] Failed to send email: ${lastError.message}`);
    }
  }

  // Both Nodemailer and Brevo failed
  // Provide actionable hint for common Brevo error (unauthorized IP)
  const msg = lastError?.message || 'Unknown error';
  if (/unrecognised IP address|Unauthorized IP|525 5\.7\.1|unauthorized/i.test(msg)) {
    const ipMatch = msg.match(/unrecognised IP address\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})/i);
    const ipText = ipMatch?.[1] ? ` (${ipMatch[1]})` : '';
    throw new Error(
      `Failed to send email: ${msg}. Brevo is blocking requests from an unrecognised server IP${ipText}. Fix: in Brevo go to https://app.brevo.com/security/authorised_ips and add/allowlist your server IP (or disable IP restriction).`
    );
  }

  if (/status 401|invalid api key|api key/i.test(msg)) {
    throw new Error(
      `Failed to send email: ${msg}. Brevo rejected the API key or the key is not valid for transactional email. Check that BREVO_API_KEY is the transactional API key from the same Brevo account, not an SMTP password, and that the key is enabled.`,
    );
  }

  throw new Error(`Failed to send email to ${to} via Nodemailer, Brevo SMTP, and Brevo API. Last error: ${msg}`);
};

// Send OTP email
export const sendOTPEmail = async (email: string, otpCode: string, fullName: string): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">BloodBuddy Email Verification</h2>
      <p>Hello ${fullName},</p>
      <p>Thank you for registering with BloodBuddy. Please use the following OTP to verify your email address:</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #d32f2f; margin: 0; font-size: 32px; letter-spacing: 5px;">${otpCode}</h1>
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you did not request this verification, please ignore this email.</p>
      <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Best regards,<br>
        The BloodBuddy Team
      </p>
    </div>
  `;

  try {
    await sendEmailWithFallback(email, 'BloodBuddy - Email Verification OTP', html);
  } catch (error) {
    console.error('Error sending OTP email:', (error as Error)?.message || error);
    throw error;
  }
};

// Send Password Reset OTP email
export const sendPasswordResetOTPEmail = async (
  email: string,
  otpCode: string,
  fullName: string
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">BloodBuddy Password Reset</h2>
      <p>Hello ${fullName},</p>
      <p>We received a request to reset your password. Use the OTP below to proceed:</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #d32f2f; margin: 0; font-size: 32px; letter-spacing: 5px;">${otpCode}</h1>
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Best regards,<br>
        The BloodBuddy Team
      </p>
    </div>
  `;

  try {
    await sendEmailWithFallback(email, 'BloodBuddy - Password Reset OTP', html);
  } catch (error) {
    console.error('Error sending password reset OTP email:', (error as Error)?.message || error);
    throw error;
  }
};











