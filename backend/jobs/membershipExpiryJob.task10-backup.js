
const Membership = require("../models/Membership");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const DAY_MS = 24 * 60 * 60 * 1000;

// Email transporter
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS are not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Get start and end of a date in India time
const getIndiaDateRange = (date) => {
  const indiaDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const start = new Date(indiaDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

// Mark expired active memberships as ended
const markExpiredMemberships = async () => {
  const now = new Date();

  const result = await Membership.updateMany(
    {
      status: "active",
      endDate: { $lt: now }
    },
    {
      $set: { status: "ended" }
    }
  );

  if (result.modifiedCount > 0) {
    console.log(
      `Marked ${result.modifiedCount} expired membership(s) as ended`
    );
  }

  return result.modifiedCount;
};

// Send one expiry reminder per membership
const sendExpiryReminders = async () => {
  const transporter = createTransporter();

  const now = new Date();
  const targetDate = new Date(now.getTime() + 3 * DAY_MS);
  const { start, end } = getIndiaDateRange(targetDate);

  const memberships = await Membership.find({
    status: "active",
    endDate: { $gte: start, $lt: end },
    "expiryReminder.status": { $in: ["pending", "failed"] }
  }).populate("user", "name email")
    .populate("plan", "name");

  let sentCount = 0;
  let failedCount = 0;

  for (const membership of memberships) {
    if (!membership.user || !membership.user.email) {
      continue;
    }

    const lockId = crypto.randomUUID();

    // Atomic claim prevents simultaneous duplicate sends
    const claimed = await Membership.findOneAndUpdate(
      {
        _id: membership._id,
        status: "active",
        "expiryReminder.status": { $in: ["pending", "failed"] }
      },
      {
        $set: {
          "expiryReminder.status": "processing",
          "expiryReminder.lockId": lockId
        }
      },
      { new: true }
    );

    if (!claimed) {
      continue;
    }

    try {
      const recipient =
        process.env.NODE_ENV === "production"
          ? membership.user.email
          : process.env.REMINDER_TEST_EMAIL;

      if (!recipient) {
        throw new Error("REMINDER_TEST_EMAIL is not configured");
      }

      const frontendUrl =
        process.env.FRONTEND_URL || "http://localhost:5174";

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: recipient,
        subject: "Your Thendral Yoga Loft membership expires in 3 days",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Membership Expiry Reminder</h2>
            <p>Hello ${membership.user.name},</p>
            <p>
              Your ${membership.plan?.name || "membership"} plan
              will expire on
              <strong>${new Date(membership.endDate).toLocaleDateString("en-IN")}</strong>.
            </p>
            <p>Please renew your membership to continue enjoying your sessions.</p>
            <a href="${frontendUrl}"
               style="display:inline-block;padding:12px 20px;background:#176b55;color:white;text-decoration:none;border-radius:6px;">
              Login to Renew
            </a>
            <p>Thank you,<br/>Thendral Yoga Loft</p>
          </div>
        `
      });

      await Membership.updateOne(
        {
          _id: membership._id,
          "expiryReminder.lockId": lockId
        },
        {
          $set: {
            "expiryReminder.status": "sent",
            "expiryReminder.sentAt": new Date()
          },
          $unset: {
            "expiryReminder.lockId": 1
          }
        }
      );

      sentCount++;
    } catch (error) {
      await Membership.updateOne(
        {
          _id: membership._id,
          "expiryReminder.lockId": lockId
        },
        {
          $set: {
            "expiryReminder.status": "failed"
          },
          $unset: {
            "expiryReminder.lockId": 1
          }
        }
      );

      failedCount++;
      console.error(
        `Reminder failed for membership ${membership._id}:`,
        error.message
      );
    }
  }

  return { sentCount, failedCount };
};

// Run all daily expiry tasks
const runMembershipExpiryJob = async () => {
  console.log("Membership expiry job started");

  const endedCount = await markExpiredMemberships();
  const reminderResult = await sendExpiryReminders();

  return {
    endedCount,
    ...reminderResult
  };
};

// Start daily scheduler
const startMembershipExpiryJob = () => {
  console.log("Membership expiry scheduler started");

  const runSafely = async () => {
    try {
      await runMembershipExpiryJob();
    } catch (error) {
      console.error("Membership expiry job failed:", error.message);
    }
  };

  // Run once when server starts
  runSafely();

  // Check every 24 hours
  setInterval(runSafely, DAY_MS);
};

module.exports = {
  startMembershipExpiryJob,
  runMembershipExpiryJob
};
