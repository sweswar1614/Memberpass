
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getMemberProfile,
  getMemberPass,
  requestMembershipPause
} = require("../controllers/memberController");

const { getMyAttendanceHistory } = require("../controllers/qrController");

// Member profile
router.get("/profile", protect, getMemberProfile);

// Member QR pass
router.get("/pass", protect, getMemberPass);

// Member attendance history
router.get("/attendance", protect, getMyAttendanceHistory);
router.get("/attendance-history", protect, getMyAttendanceHistory);

// Membership pause request
router.post("/pause", protect, requestMembershipPause);

module.exports = router;
