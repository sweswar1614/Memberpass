require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");

(async () => {
  await connectDB();

  const email = "m2_classlimit_test@example.com";

  if (await User.findOne({ email })) {
    throw new Error("Test account already exists. Aborting.");
  }

  const basic = await Plan.findOne({ name: "Basic", isActive: true });
  if (!basic) throw new Error("Active Basic plan not found.");

  const staff = await User.findOne({ email: "m2.staff@example.com", role: "staff" });
  if (!staff) throw new Error("Staff account not found.");

  const user = await User.create({
    name: "M2 Class Limit Test",
    email,
    password: "MemberPass@123",
    role: "member"
  });

  const membership = await Membership.create({
    user: user._id,
    plan: basic._id,
    status: "active",
    startDate: new Date(Date.now() - 5 * 86400000),
    endDate: new Date(Date.now() + 25 * 86400000),
    classesUsed: 8
  });

  console.log("ISOLATED TEST ACCOUNT CREATED");
  console.log("Email:", email);
  console.log("Membership ID:", membership._id);
  console.log("Classes Used:", membership.classesUsed);
  console.log("Class Limit:", basic.classLimit);

  process.exit(0);
})().catch(err => {
  console.error("TEST SETUP FAILED:", err.message);
  process.exit(1);
});
