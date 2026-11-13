const express = require("express");
const router = express.Router();

const { getPlans, getPlanById } = require("../controllers/planController");

router.get("/", getPlans);
router.get("/:id", getPlanById);

module.exports = router;

