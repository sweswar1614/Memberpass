require("dotenv").config({ path: "./backend/.env" });
require("../models/Plan");
const connectDB = require("../config/db");
const User = require("../models/User");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

(async () => {
  await connectDB();

  const user = await User.findOne({ email: "m2.test.member@example.com" });

  if (!user) {
    console.log("Test member not found. Nothing to clean.");
    process.exit(0);
  }

  const payments = await Payment.deleteMany({ user: user._id });
  const memberships = await Membership.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });

  console.log("Cleanup complete:");
  console.log("Payments removed:", payments.deletedCount);
  console.log("Memberships removed:", memberships.deletedCount);
  console.log("Test user removed:", user.email);

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
