const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { staffOnly } = require("../middleware/staffMiddleware");
const { getAbsenteeDrafts } = require("../controllers/absenteeController");

router.get("/", protect, staffOnly, getAbsenteeDrafts);

module.exports = router;
