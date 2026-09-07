const nodemailer = require('nodemailer')

let transporter

function getTransporter() {
  if (transporter) return transporter

  const GMAIL_USER = String(process.env.GMAIL_USER || '').trim()
  const GMAIL_APP_PASSWORD = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail configuration is missing. Set GMAIL_USER and GMAIL_APP_PASSWORD.')
  }
  if (GMAIL_APP_PASSWORD.length !== 16) {
    throw new Error('Gmail app password must contain 16 characters. Generate a new Gmail App Password and update GMAIL_APP_PASSWORD.')
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  return transporter
}

async function sendVerificationEmail(email, name, otp) {
  const from = process.env.GMAIL_FROM || process.env.GMAIL_USER
  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'Your Home Care+ verification code',
    text: `Hello ${name || 'there'},\n\nYour Home Care+ verification code is ${otp}. It expires in 5 minutes.\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Hello ${name || 'there'},</p><p>Your Home Care+ verification code is:</p><p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p><p>This code expires in 5 minutes.</p><p>If you did not create this account, you can ignore this email.</p>`,
  })
}

module.exports = {
  sendVerificationEmail,
};
