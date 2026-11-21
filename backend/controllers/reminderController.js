
const {
  runMembershipExpiryJob
} = require("../jobs/membershipExpiryJob");

// Staff/Admin: Manually run membership expiry job
const runExpiryReminders = async (req, res) => {
  try {
    const result = await runMembershipExpiryJob();

    return res.status(200).json({
      success: true,
      message: "Membership expiry job completed successfully",
      data: {
        endedCount: result.endedCount,
        sentCount: result.sentCount,
        failedCount: result.failedCount
      }
    });
  } catch (error) {
    console.error("Manual expiry job failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to complete membership expiry job",
      error: error.message
    });
  }
};

module.exports = {
  runExpiryReminders
};
