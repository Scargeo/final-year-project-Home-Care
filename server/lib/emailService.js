const nodemailer = require('nodemailer');

// Initialize nodemailer transporter with environment variables
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send verification email to a patient
 * @param {string} email - Patient's email address
 * @param {string} patientName - Patient's full name
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
const sendVerificationEmail = async (email, patientName, token) => {
  const verificationLink = `${process.env.FRONTEND_URL || process.env.FRONTEND_APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Home Care Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Welcome to Home Care, ${patientName}!</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Thank you for registering with us. To complete your account setup and start using Home Care services, 
            please verify your email address by clicking the button below.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link in your browser:
          </p>
          <p style="color: #0066cc; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 12px;">
            ${verificationLink}
          </p>
          
          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            If you did not create this account, please ignore this email.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            Home Care Team
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

module.exports = {
  sendVerificationEmail,
};
