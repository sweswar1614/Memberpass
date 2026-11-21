require("dotenv").config();
const nodemailer = require("nodemailer");

(async () => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s/g, ""),
    },
    tls: { rejectUnauthorized: false },
  });

  await transporter.verify();
  console.log("SMTP CONNECTION: PASS");

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.REMINDER_TEST_EMAIL,
    subject: "MemberPass SMTP Test",
    text: "MemberPass daily reminder email configuration test successful.",
  });

  console.log("TEST EMAIL SENT:", info.messageId);
  console.log("RECIPIENT:", process.env.REMINDER_TEST_EMAIL);
})().catch((err) => {
  console.error("SMTP TEST FAILED:", err.message);
  process.exit(1);
});
