import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    const missing = [];
    if (!host) missing.push("SMTP_HOST");
    if (!user) missing.push("SMTP_USER (or EMAIL_USER)");
    if (!pass) missing.push("SMTP_PASS (or EMAIL_PASS)");
    return { transporter: null, missing };
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    }),
    missing: [],
  };
}

export async function sendOtpEmail({ to, otp }) {
  const { transporter, missing } = createTransport();
  if (!transporter) {
    console.log(`[auth] OTP for ${to}: ${otp} (SMTP not configured, logged for local development)`);
    if (missing.length > 0) {
      console.log(`[auth] Missing env vars for SMTP: ${missing.join(", ")}`);
    }
    return { delivered: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
    to,
    subject: "Your password reset OTP",
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It will expire in 10 minutes.</p>`,
  });

  return { delivered: true };
}
