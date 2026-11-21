require("dotenv").config();
const connectDB = require("../config/db");
const Membership = require("../models/Membership");
require("../models/User");
require("../models/Plan");

(async () => {
  await connectDB();

  const now = new Date();
  const target = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const indiaDate = new Date(
    target.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const start = new Date(
    Date.UTC(
      indiaDate.getFullYear(),
      indiaDate.getMonth(),
      indiaDate.getDate()
    ) - 19800000
  );

  const end = new Date(start.getTime() + 86400000);

  const rows = await Membership.find({
    status: "active",
    endDate: { $gte: start, $lt: end }
  })
    .populate("user", "name email")
    .populate("plan", "name")
    .select("endDate expiryReminder user plan");

  console.log("ELIGIBLE MEMBERSHIPS:", rows.length);

  rows.forEach((x) => {
    console.log({
      name: x.user?.name,
      email: x.user?.email,
      plan: x.plan?.name,
      endDate: x.endDate,
      reminderStatus: x.expiryReminder?.status
    });
  });

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
