
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

    const membership = await Membership.findOne({ user: user._id })
      .populate("plan")
      .sort({ createdAt: -1 });

    let membershipStatus = "none";
    let isExpired = false;

    if (membership) {
      membershipStatus = membership.status;

      if (
        new Date(membership.endDate) < new Date() &&
        membership.status === "active"
      ) {
        isExpired = true;
        membershipStatus = "ended";
      }
    }

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
              pauseStartDate: membership.pauseStartDate,
              pauseEndDate: membership.pauseEndDate,
              pauseHistory: membership.pauseHistory || [],
              classesRemaining:
                membership.plan && membership.plan.classLimit !== null
                  ? Math.max(
                      0,
                      membership.plan.classLimit - membership.classesUsed
                    )
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

// @desc    Request membership pause
// @route   POST /api/member/pause
// @access  Private (Member)
const requestMembershipPause = async (req, res) => {
  try {
    const days = Number(req.body.days);

    if (!Number.isInteger(days) || days < 1 || days > 15) {
      return res.status(400).json({
        success: false,
        message: "Pause duration must be between 1 and 15 days"
      });
    }

    const membership = await Membership.findOne({
      user: req.user._id
    }).sort({ createdAt: -1 });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found"
      });
    }

    const now = new Date();

    if (
      membership.status !== "active" ||
      new Date(membership.endDate) <= now
    ) {
      return res.status(400).json({
        success: false,
        message: "Only an active membership can be paused"
      });
    }

    // Allow only one pause per calendar year
    const currentYear = now.getFullYear();

    const alreadyPausedThisYear = (membership.pauseHistory || []).some(
      (pause) =>
        new Date(pause.requestedAt).getFullYear() === currentYear
    );

    if (alreadyPausedThisYear) {
      return res.status(400).json({
        success: false,
        message:
          "Membership pause is allowed only once per calendar year"
      });
    }

    const pauseStartDate = new Date(now);
    const pauseEndDate = new Date(now);
    pauseEndDate.setDate(pauseEndDate.getDate() + days);

    const updatedEndDate = new Date(membership.endDate);
    updatedEndDate.setDate(updatedEndDate.getDate() + days);

    membership.status = "paused";
    membership.pauseStartDate = pauseStartDate;
    membership.pauseEndDate = pauseEndDate;
    membership.endDate = updatedEndDate;

    membership.pauseHistory.push({
      startDate: pauseStartDate,
      endDate: pauseEndDate,
      days,
      requestedAt: now
    });

    await membership.save();

    return res.status(200).json({
      success: true,
      message: `Membership paused for ${days} days`,
      membership: {
        id: membership._id,
        status: membership.status,
        pauseStartDate: membership.pauseStartDate,
        pauseEndDate: membership.pauseEndDate,
        endDate: membership.endDate
      }
    });
  } catch (error) {
    console.error("requestMembershipPause error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to pause membership"
    });
  }
};

module.exports = {
  getMemberProfile,
  requestMembershipPause,
  getMemberPass: getMyQRPass,
  getMemberAttendanceHistory: getMyAttendanceHistory
};
