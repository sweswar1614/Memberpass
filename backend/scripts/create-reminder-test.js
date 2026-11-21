require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const Membership = require("../models/Membership");
const Plan = require("../models/Plan");
const bcrypt = require("bcryptjs");

(async () => {
  await connectDB();

  const email = "m2_reminder_test@example.com";
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: "M2 Reminder Test",
      email,
      password: "MemberPass@123",
      role: "member",
      isActive: true
    });
    console.log("TEST USER CREATED");
  } else {
    console.log("TEST USER ALREADY EXISTS");
  }

  const plan = await Plan.findOne({ name: "Basic" });
  if (!plan) throw new Error("Basic plan not found");

  const now = new Date();
  const endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const existingMembership = await Membership.findOne({
    user: user._id,
    status: "active"
  });

  if (existingMembership) {
    console.log("Active membership already exists for test user. No new membership created.");
    console.log("Existing end date:", existingMembership.endDate);
    process.exit(0);
  }

  await Membership.create({
    user: user._id,
    plan: plan._id,
    status: "active",
    startDate: now,
    endDate,
    classesUsed: 0,
    expiryReminder: { status: "pending" }
  });

  console.log("TEST MEMBERSHIP CREATED");
  console.log("User:", email);
  console.log("Plan:", plan.name);
  console.log("End date:", endDate);
  console.log("Reminder status: pending");

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
