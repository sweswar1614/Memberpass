require("dotenv").config();
require("./models/User");
const mongoose = require("mongoose");
const Membership = require("./models/Membership");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Membership.updateOne(
    { _id: "6b0156ff23f88c05dac022dd", status: "paused" },
    { $set: { pauseEndDate: new Date(Date.now() - 60000) } }
  );
  console.log(result);
  await mongoose.disconnect();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
