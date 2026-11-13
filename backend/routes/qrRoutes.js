
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { staffOnly } = require("../middleware/staffMiddleware");

const {
  getMyQRPass,
  validateQRPass,
  checkInQRPass,
  getAttendanceHistory,
  getMyAttendanceHistory
} = require("../controllers/qrController");

router.get("/my-pass", protect, getMyQRPass);
router.post("/validate", protect, staffOnly, validateQRPass);
router.post("/check-in", protect, staffOnly, checkInQRPass);
router.get("/attendance-history", protect, staffOnly, getAttendanceHistory);
router.get("/my-attendance-history", protect, getMyAttendanceHistory);

module.exports = router;
