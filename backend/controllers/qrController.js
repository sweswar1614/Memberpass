
const QRCode = require("qrcode");
const crypto = require("crypto");
const Membership = require("../models/Membership");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
require("../models/Plan");

// Generate member QR pass
const getMyQRPass = async (req, res) => {
  try {
    const latestMembership = await Membership.findOne({ user: req.user._id })
      .populate("plan", "name durationDays priceInPaise")
      .sort({ createdAt: -1 });

    if (!latestMembership) {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
        status: "none",
        message: "No membership found. Please purchase a membership plan.",
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
        message: "Membership is paused.",
        pass: {
          memberName: req.user.name,
          plan: latestMembership.plan?.name || "Basic",
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
        message: "Membership has expired or ended.",
        pass: {
          memberName: req.user.name,
          plan: latestMembership.plan?.name || "Basic",
          status: "ended",
          startDate: latestMembership.startDate,
          endDate: latestMembership.endDate,
          classesUsed: latestMembership.classesUsed,
          qrCode: null
        }
      });
    }

    const passPayload = {
      pass_code: req.user.passCode,
      plan: latestMembership.plan?.name || "Basic",
      end_date: latestMembership.endDate.toISOString().split("T")[0]
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(passPayload), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#451126",
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
        plan: latestMembership.plan?.name || "Basic",
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

// Shared membership validation
const findValidMembership = async (passCode) => {
  const member = await User.findOne({
    passCode: passCode.trim()
  }).select("_id name passCode");

  if (!member) {
    return { error: "Invalid membership pass code", status: 404 };
  }

  const membership = await Membership.findOne({
    user: member._id
  })
    .populate("plan", "name classLimit")
    .sort({ createdAt: -1 });

  if (!membership) {
    return { error: "No membership record found", status: 404 };
  }

  if (membership.status !== "active") {
    return {
      error: membership.status === "paused"
        ? "Membership is paused"
        : "Membership has ended",
      status: 403
    };
  }

  if (new Date(membership.endDate) < new Date()) {
    return { error: "Membership has expired", status: 403 };
  }

  const classLimit = membership.plan?.classLimit;

  if (
    classLimit !== null &&
    classLimit !== undefined &&
    membership.classesUsed >= classLimit
  ) {
    return {
      error: `Class limit of ${classLimit} reached`,
      status: 403
    };
  }

  return { member, membership };
};

// Validate QR pass - does NOT increment attendance
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

    const result = await findValidMembership(passCode);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: result.error
      });
    }

    const { member, membership } = result;

    return res.status(200).json({
      success: true,
      entryStatus: "ENTRY_ALLOWED",
      reason: "Valid active membership",
      member: {
        name: member.name,
        plan: membership.plan?.name || "Member",
        endDate: membership.endDate,
        classesUsed: membership.classesUsed,
        classLimit: membership.plan?.classLimit ?? null
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

// Actual class check-in - Staff only
const checkInQRPass = async (req, res) => {
  let incrementedMembershipId = null;
  let incrementedTo = null;

  try {
    const { passCode, checkInId } = req.body;

    if (!passCode || typeof passCode !== "string") {
      return res.status(400).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Invalid QR pass data"
      });
    }

    if (
      !checkInId ||
      typeof checkInId !== "string" ||
      checkInId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "A valid check-in request ID is required"
      });
    }

    // Same request retry must never count twice
    const existingAttendance = await Attendance.findOne({ checkInId })
      .populate("member", "name")
      .populate("membership");

    if (existingAttendance) {
      return res.status(200).json({
        success: true,
        entryStatus: "ENTRY_ALLOWED",
        alreadyCheckedIn: true,
        message: "This check-in was already recorded",
        attendance: {
          id: existingAttendance._id,
          checkedInAt: existingAttendance.checkedInAt
        }
      });
    }

    const result = await findValidMembership(passCode);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: result.error
      });
    }

    const { member, membership } = result;
    const classLimit = membership.plan?.classLimit;

    // Atomic increment with current membership conditions
    const filter = {
      _id: membership._id,
      status: "active",
      endDate: { $gte: new Date() },
      classesUsed: membership.classesUsed
    };

    if (classLimit !== null && classLimit !== undefined) {
      filter.classesUsed = {
        $eq: membership.classesUsed,
        $lt: classLimit
      };
    }

    const updatedMembership = await Membership.findOneAndUpdate(
      filter,
      { $inc: { classesUsed: 1 } },
      { new: true }
    );

    if (!updatedMembership) {
      return res.status(409).json({
        success: false,
        entryStatus: "ENTRY_DENIED",
        reason: "Membership changed or class limit reached. Please scan again."
      });
    }

    incrementedMembershipId = updatedMembership._id;
    incrementedTo = updatedMembership.classesUsed;

    // Save attendance record
    const attendance = await Attendance.create({
      member: member._id,
      membership: membership._id,
      staff: req.user._id,
      checkInId,
      checkedInAt: new Date()
    });

    return res.status(200).json({
      success: true,
      entryStatus: "ENTRY_ALLOWED",
      alreadyCheckedIn: false,
      message: "Class check-in successful",
      member: {
        name: member.name,
        plan: membership.plan?.name || "Member"
      },
      attendance: {
        id: attendance._id,
        checkedInAt: attendance.checkedInAt
      },
      classesUsed: updatedMembership.classesUsed,
      classLimit: classLimit ?? null
    });
  } catch (error) {
    // Roll back increment if attendance record was not saved
    if (incrementedMembershipId && incrementedTo !== null) {
      await Membership.updateOne(
        {
          _id: incrementedMembershipId,
          classesUsed: incrementedTo
        },
        { $inc: { classesUsed: -1 } }
      ).catch((rollbackError) => {
        console.error("Attendance rollback error:", rollbackError.message);
      });
    }

    if (error.code === 11000) {
      const duplicate = await Attendance.findOne({
        checkInId: req.body.checkInId
      });

      if (duplicate) {
        return res.status(200).json({
          success: true,
          entryStatus: "ENTRY_ALLOWED",
          alreadyCheckedIn: true,
          message: "This check-in was already recorded"
        });
      }
    }

    console.error("QR check-in error:", error.message);
    return res.status(500).json({
      success: false,
      entryStatus: "ENTRY_DENIED",
      reason: "Unable to complete class check-in"
    });
  }
};

// Get attendance history - Staff only
const getAttendanceHistory = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate("member", "name email")
      .populate({
        path: "membership",
        populate: {
          path: "plan",
          select: "name"
        }
      })
      .populate("staff", "name")
      .sort({ checkedInAt: -1 })
      .limit(100)
      .lean();

    const history = records.map((record) => ({
      id: record._id,
      memberName: record.member?.name || "Unknown Member",
      memberEmail: record.member?.email || "",
      planName: record.membership?.plan?.name || "Unknown Plan",
      classesUsed: record.membership?.classesUsed ?? 0,
      staffName: record.staff?.name || "Unknown Staff",
      checkedInAt: record.checkedInAt
    }));

    return res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error("Attendance history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch attendance history"
    });
  }
};

// Get logged-in member's own attendance history
const getMyAttendanceHistory = async (req, res) => {
  try {
    const records = await Attendance.find({
      member: req.user._id
    })
      .populate({
        path: "membership",
        populate: {
          path: "plan",
          select: "name"
        }
      })
      .populate("staff", "name")
      .sort({ checkedInAt: -1 })
      .limit(100)
      .lean();

    const history = records.map((record) => ({
      id: record._id,
      planName: record.membership?.plan?.name || "Unknown Plan",
      staffName: record.staff?.name || "Studio Staff",
      checkedInAt: record.checkedInAt
    }));

    return res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error("Member attendance history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch your attendance history"
    });
  }
};

module.exports = {
  getMyQRPass,
  validateQRPass,
  checkInQRPass,
  getAttendanceHistory,
  getMyAttendanceHistory
};