
const Membership = require("../models/Membership");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

// Gmail transporter
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

// Get exact India calendar-day range, independent of server timezone
const getIndiaDateRange = (date) => {
  const indiaDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const year = indiaDate.getFullYear();
  const month = indiaDate.getMonth();
  const day = indiaDate.getDate();

  const start = new Date(
    Date.UTC(year, month, day) - (5 * 60 + 30) * 60 * 1000
  );

  const end = new Date(start.getTime() + DAY_MS);

  return { start, end };
};

// Mark expired memberships as ended
const markExpiredMemberships = async () => {
  const result = await Membership.updateMany(
    {
      status: "active",
      endDate: { $lt: new Date() }
    },
    {
      $set: { status: "ended" }
    }
  );

  return result.modifiedCount;
};

// Find and send expiry reminders
const sendExpiryReminders = async () => {
  const now = new Date();
  const targetDate = new Date(now.getTime() + 3 * DAY_MS);
  const { start, end } = getIndiaDateRange(targetDate);

  const staleLockTime = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const memberships = await Membership.find({
    status: "active",
    endDate: { $gte: start, $lt: end },
    $or: [
      { "expiryReminder.status": { $in: ["pending", "failed"] } },
      { "expiryReminder.status": { $exists: false } },
      {
        "expiryReminder.status": "processing",
        "expiryReminder.lockAt": { $lt: staleLockTime }
      }
    ]
  })
    .populate("user", "name email")
    .populate("plan", "name");

  let sentCount = 0;
  let failedCount = 0;

  // No matching memberships means SMTP is not needed
  if (memberships.length === 0) {
    return { sentCount, failedCount };
  }

  const transporter = createTransporter();

  for (const membership of memberships) {
    if (!membership.user || !membership.user.email) {
      continue;
    }

    const lockId = crypto.randomUUID();

    // Atomic claim prevents concurrent duplicate processing
    const claimed = await Membership.findOneAndUpdate(
      {
        _id: membership._id,
        status: "active",
        $or: [
          { "expiryReminder.status": { $in: ["pending", "failed"] } },
          { "expiryReminder.status": { $exists: false } },
          {
            "expiryReminder.status": "processing",
            "expiryReminder.lockAt": { $lt: staleLockTime }
          }
        ]
      },
      {
        $set: {
          "expiryReminder.status": "processing",
          "expiryReminder.lockId": lockId,
          "expiryReminder.lockAt": now
        }
      },
      { new: true }
    );

    if (!claimed) continue;

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
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Membership Expiry Reminder</h2>
            <p>Hello ${membership.user.name || "Member"},</p>
            <p>Your ${membership.plan?.name || "membership"} plan
            will expire on
            <strong>${new Date(membership.endDate).toLocaleDateString("en-IN")}</strong>.</p>
            <p>Please renew your membership to continue enjoying your sessions.</p>
            <a href="${frontendUrl.replace(/\/$/, "")}/#plans">Login to Renew</a>
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
            "expiryReminder.lockId": 1,
            "expiryReminder.lockAt": 1
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
          $set: { "expiryReminder.status": "failed" },
          $unset: {
            "expiryReminder.lockId": 1,
            "expiryReminder.lockAt": 1
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

// Run expiry tasks
const runMembershipExpiryJob = async () => {
  console.log("Membership expiry job started");

  const endedCount = await markExpiredMemberships();
  const reminderResult = await sendExpiryReminders();

  return {
    endedCount,
    ...reminderResult
  };
};

// Daily scheduler - runs once every 24 hours
const startMembershipExpiryJob = () => {
  console.log("Membership expiry scheduler started");

  const runSafely = async () => {
    try {
      const result = await runMembershipExpiryJob();
      console.log("Membership expiry job result:", result);
    } catch (error) {
      console.error("Membership expiry job failed:", error.message);
    }
  };

  // Run once when the server starts
  runSafely();

  // Repeat every 24 hours
  setInterval(runSafely, DAY_MS);
};

module.exports = {
  startMembershipExpiryJob,
  runMembershipExpiryJob
};

