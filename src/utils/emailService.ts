import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn('SMTP credentials not configured. Email sending will fail.');
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Send OTP email
export const sendOTPEmail = async (email: string, otpCode: string, fullName: string): Promise<void> => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject: 'BloodBuddy - Email Verification OTP',
    html: `
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${email}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send Password Reset OTP email
export const sendPasswordResetOTPEmail = async (
  email: string,
  otpCode: string,
  fullName: string
): Promise<void> => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject: 'BloodBuddy - Password Reset OTP',
    html: `
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset OTP sent successfully to ${email}`);
  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    throw new Error('Failed to send password reset OTP email');
  }
};











