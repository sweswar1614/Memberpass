require("dotenv").config();
const connectDB = require("../config/db");
const Membership = require("../models/Membership");
const User = require("../models/User");
require("../models/Plan");
const nodemailer = require("nodemailer");

(async () => {
  await connectDB();

  if (process.env.NODE_ENV === "production") {
    throw new Error("Test script blocked in production");
  }

  const testEmail = "m2_reminder_test@example.com";
  const recipient = process.env.REMINDER_TEST_EMAIL;

  if (!recipient) throw new Error("REMINDER_TEST_EMAIL missing");

  const testUser = await User.findOne({ email: testEmail });
  if (!testUser) throw new Error("Test user not found");

  const membership = await Membership.findOne({
    user: testUser._id,
    status: "active",
    "expiryReminder.status": { $in: ["pending", "failed"] }
  }).populate("plan", "name");

  if (!membership) {
    throw new Error("Test membership not found or not retryable");
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP configuration missing");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: recipient,
    subject: "Your Thendral Yoga Loft membership expires in 3 days",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Membership Expiry Reminder</h2>
        <p>Hello ${testUser.name || "Member"},</p>
        <p>Your ${membership.plan?.name || "membership"} plan will expire on
        <strong>${new Date(membership.endDate).toLocaleDateString("en-IN")}</strong>.</p>
        <p>Please renew your membership to continue enjoying your sessions.</p>
        <p>Thank you,<br/>Thendral Yoga Loft</p>
        <p><small>Reminder workflow test</small></p>
      </div>
    `
  });

  membership.expiryReminder.status = "sent";
  membership.expiryReminder.sentAt = new Date();
  membership.expiryReminder.lockId = undefined;
  membership.expiryReminder.lockAt = undefined;
  await membership.save();

  console.log("TEST REMINDER SENT: PASS");
  console.log("Test membership:", testEmail);
  console.log("Email recipient:", recipient);
  console.log("Reminder status:", membership.expiryReminder.status);

  process.exit(0);
})().catch((e) => {
  console.error("TEST REMINDER FAILED:", e.message);
  process.exit(1);
});
