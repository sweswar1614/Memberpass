
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { staffOnly } = require("../middleware/staffMiddleware");

const {
  runExpiryReminders
} = require("../controllers/reminderController");

// Staff/Admin only: Run expiry job manually
router.post(
  "/run-now",
  protect,
  staffOnly,
  runExpiryReminders
);

module.exports = router;
