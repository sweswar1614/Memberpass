const QRCode = require("qrcode");
const Membership = require("../models/Membership");
const User = require("../models/User");
require("../models/Plan");

// Generate member QR pass
const getMyQRPass = async (req, res) => {
  try {
    // Find latest membership for this user
    const latestMembership = await Membership.findOne({ user: req.user._id })
      .populate("plan", "name durationDays priceInPaise")
      .sort({ createdAt: -1 });

    if (!latestMembership) {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
        status: "none",
        message: "No membership found. Please purchase a membership plan to generate your pass.",
        pass: null
      });
    }

    const now = new Date();
    const isExpired = new Date(latestMembership.endDate) < now;

    if (latestMembership.status === "paused") {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
        status: "paused",
        message: "Your membership is currently paused. Please contact club administration to resume.",
        pass: {
          memberName: req.user.name,
          plan: latestMembership.plan ? latestMembership.plan.name : "Basic",
          status: "paused",
          startDate: latestMembership.startDate,
          endDate: latestMembership.endDate,
          classesUsed: latestMembership.classesUsed,
          qrCode: null
        }
      });
    }

    if (latestMembership.status === "ended" || isExpired) {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
        status: "ended",
        message: "Your membership has expired or ended. Please renew to access facilities.",
        pass: {
          memberName: req.user.name,
          plan: latestMembership.plan ? latestMembership.plan.name : "Basic",
          status: "ended",
          startDate: latestMembership.startDate,
          endDate: latestMembership.endDate,
          classesUsed: latestMembership.classesUsed,
          qrCode: null
        }
      });
    }

    // Active membership: Payload contains ONLY pass_code, plan, and end_date
    const formattedEndDate = latestMembership.endDate.toISOString().split("T")[0];
    const passPayload = {
      pass_code: req.user.passCode,
      plan: latestMembership.plan.name,
      end_date: formattedEndDate
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(passPayload), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#451126", // Burgundy Royale wine color
        light: "#FFFFFF"
      }
    });

    return res.status(200).json({
      success: true,
      hasActiveMembership: true,
      status: "active",
      message: "Active membership QR pass generated",
      pass: {
        memberName: req.user.name,
        passCode: req.user.passCode,
        plan: latestMembership.plan.name,
        status: "active",
        startDate: latestMembership.startDate,
        endDate: latestMembership.endDate,
        classesUsed: latestMembership.classesUsed,
        qrPayload: passPayload,
        qrCode
      }
    });
  } catch (error) {
    console.error("QR pass error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to generate QR pass"
    });
  }
};

// Validate member QR pass (Staff only)
const validateQRPass = async (req, res) => {
  try {
    const { passCode } = req.body;

    if (!passCode || typeof passCode !== "string") {
      return res.status(400).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Invalid QR pass data"
      });
    }

    const member = await User.findOne({
      passCode: passCode.trim()
    }).select("_id name email passCode");

    if (!member) {
      return res.status(404).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Invalid membership pass code"
      });
    }

    const membership = await Membership.findOne({
      user: member._id
    })
      .populate("plan", "name classLimit")
      .sort({ createdAt: -1 });

    if (!membership) {
      return res.status(404).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "No membership record found"
      });
    }

    if (membership.status === "paused") {
      return res.status(403).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Membership is paused",
        member: { name: member.name }
      });
    }

    if (membership.status === "ended") {
      return res.status(403).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Membership has ended",
        member: { name: member.name }
      });
    }

    if (new Date(membership.endDate) < new Date()) {
      return res.status(403).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Membership has expired",
        member: { name: member.name }
      });
    }

    if (membership.plan && membership.plan.classLimit !== null && membership.classesUsed >= membership.plan.classLimit) {
      return res.status(403).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: `Class limit of ${membership.plan.classLimit} reached`,
        member: { name: member.name }
      });
    }

    return res.status(200).json({
      success: true,
      entryStatus: "ENTRY_ALLOWED",
      reason: "Valid active membership",
      member: {
        name: member.name,
        plan: membership.plan ? membership.plan.name : "Member",
        endDate: membership.endDate,
        classesUsed: membership.classesUsed
      }
    });
  } catch (error) {
    console.error("QR validation error:", error.message);
    return res.status(500).json({
      success: false,
      entryStatus: "ENTRY_DENIED",
      reason: "Unable to validate membership"
    });
  }
};

module.exports = {
  getMyQRPass,
  validateQRPass
};
