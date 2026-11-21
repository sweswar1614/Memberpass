const User = require("../models/User");
const Membership = require("../models/Membership");
const Attendance = require("../models/Attendance");

// M3 Task 11: AI Absentee Drafts
const getAbsenteeDrafts = async (req, res) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 14, 1),
      365
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find currently active memberships
    const activeMemberships = await Membership.find({
      status: "active",
      endDate: { $gte: new Date() }
    })
      .populate("user", "name email phone isActive role")
      .populate("plan", "name")
      .sort({ startDate: -1 });

    // Filter valid active members
    const validMemberships = activeMemberships.filter(
      (membership) =>
        membership.user &&
        membership.user.isActive &&
        membership.user.role === "member"
    );

    const absenteeDrafts = [];

    for (const membership of validMemberships) {
      const lastAttendance = await Attendance.findOne({
        membership: membership._id
      }).sort({ checkedInAt: -1 });

      // Members with recent attendance are not absentees
      if (
        lastAttendance &&
        lastAttendance.checkedInAt >= cutoffDate
      ) {
        continue;
      }

      const lastVisit = lastAttendance
        ? lastAttendance.checkedInAt
        : null;

      const inactiveDays = lastVisit
        ? Math.floor(
            (Date.now() - lastVisit.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const memberName = membership.user.name || "Member";
      const planName = membership.plan?.name || "Membership";

      let message;

      if (!lastVisit) {
        message = `Hi ${memberName}, we noticed you haven't visited our centre yet after joining your ${planName} membership. We'd love to help you get started with your fitness journey. Let us know if you need any assistance scheduling your first session. We look forward to seeing you!`;
      } else {
        message = `Hi ${memberName}, we hope you're doing well! It's been ${inactiveDays} days since your last visit to our centre. Your ${planName} membership is still active, and we'd love to see you back. A little consistency can make a big difference. Let us know if you'd like help planning your next session.`;
      }

      absenteeDrafts.push({
        memberId: membership.user._id,
        membershipId: membership._id,
        name: memberName,
        email: membership.user.email,
        phone: membership.user.phone || "",
        plan: planName,
        membershipStartDate: membership.startDate,
        membershipEndDate: membership.endDate,
        lastAttendance: lastVisit,
        inactiveDays,
        message,
        status: "draft"
      });
    }

    return res.status(200).json({
      success: true,
      days,
      totalAbsentees: absenteeDrafts.length,
      drafts: absenteeDrafts
    });
  } catch (error) {
    console.error("getAbsenteeDrafts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to generate absentee drafts"
    });
  }
};

module.exports = {
  getAbsenteeDrafts
};