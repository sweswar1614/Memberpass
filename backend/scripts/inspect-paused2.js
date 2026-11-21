require("dotenv").config({ path: "./backend/.env" });
require("../models/User");
require("../models/Plan");
const connectDB = require("../config/db");
const Membership = require("../models/Membership");

(async () => {
  await connectDB();
  const rows = await Membership.find({ status: "paused" })
    .populate("user", "name email")
    .populate("plan", "name");

  console.log(JSON.stringify(rows.map(m => ({
    name: m.user?.name,
    email: m.user?.email,
    plan: m.plan?.name,
    status: m.status
  })), null, 2));

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
