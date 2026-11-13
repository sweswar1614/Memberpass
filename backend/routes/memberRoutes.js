const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getMemberProfile, getMemberPass } = require("../controllers/memberController");
const { getMyAttendanceHistory } = require("../controllers/qrController");

router.get("/profile", protect, getMemberProfile);
router.get("/pass", protect, getMemberPass);
router.get("/attendance", protect, getMyAttendanceHistory);
router.get("/attendance-history", protect, getMyAttendanceHistory);

module.exports = router;

