const User = require("../models/User");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");
const { getMyQRPass, getMyAttendanceHistory } = require("./qrController");

// @desc    Get logged in member profile, current membership and recent payments
// @route   GET /api/member/profile
// @access  Private (Member)
const getMemberProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    // Get current/latest membership
    const membership = await Membership.findOne({ user: user._id })
      .populate("plan")
      .sort({ createdAt: -1 });

    // Determine current status
    let membershipStatus = "none";
    let isExpired = false;

    if (membership) {
      membershipStatus = membership.status;
      if (new Date(membership.endDate) < new Date() && membership.status === "active") {
        isExpired = true;
        membershipStatus = "ended";
      }
    }

    // Get recent payments
    const payments = await Payment.find({ user: user._id })
      .populate("plan", "name priceInPaise")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      member: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        passCode: user.passCode,
        membershipStatus,
        isExpired,
        membership: membership
          ? {
              id: membership._id,
              plan: membership.plan
                ? {
                    id: membership.plan._id,
                    name: membership.plan.name,
                    price: membership.plan.priceInPaise / 100,
                    classLimit: membership.plan.classLimit,
                    durationDays: membership.plan.durationDays
                  }
                : null,
              status: membership.status,
              startDate: membership.startDate,
              endDate: membership.endDate,
              classesUsed: membership.classesUsed,
              classesRemaining:
                membership.plan && membership.plan.classLimit !== null
                  ? Math.max(0, membership.plan.classLimit - membership.classesUsed)
                  : "Unlimited"
            }
          : null,
        recentPayments: payments.map((p) => ({
          id: p._id,
          orderId: p.razorpayOrderId,
          paymentId: p.razorpayPaymentId,
          amount: p.amount / 100,
          currency: p.currency,
          status: p.status,
          planName: p.plan ? p.plan.name : "Custom",
          date: p.createdAt
        }))
      }
    });
  } catch (error) {
    console.error("getMemberProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load member profile"
    });
  }
};

module.exports = {
  getMemberProfile,
  getMemberPass: getMyQRPass,
  getMemberAttendanceHistory: getMyAttendanceHistory
};

