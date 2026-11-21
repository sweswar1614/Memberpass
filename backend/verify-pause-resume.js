require("dotenv").config();
require("./models/User");
const mongoose = require("mongoose");
const Membership = require("./models/Membership");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const m = await Membership.findById("6b0156ff23f88c05dac022dd").select("status pauseStartDate pauseEndDate endDate");
  console.log(m);
  await mongoose.disconnect();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
