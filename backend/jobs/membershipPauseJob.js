
const Membership = require("../models/Membership");

const resumePausedMemberships = async () => {
  try {
    const now = new Date();

    const result = await Membership.updateMany(
      {
        status: "paused",
        pauseEndDate: { $lte: now }
      },
      {
        $set: {
          status: "active",
          pauseStartDate: null,
          pauseEndDate: null
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `Automatically resumed ${result.modifiedCount} membership(s)`
      );
    }
  } catch (error) {
    console.error(
      "Membership auto-resume failed:",
      error.message
    );
  }
};

const startMembershipPauseJob = () => {
  console.log("Membership auto-resume job started");

  // Run once when the server starts
  resumePausedMemberships();

  // Check every minute
  setInterval(resumePausedMemberships, 60 * 1000);
};

module.exports = startMembershipPauseJob;