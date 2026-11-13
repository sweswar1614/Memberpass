const Plan = require("../models/Plan");

// @desc    Get all active membership plans
// @route   GET /api/plans
// @access  Public
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ priceInPaise: 1 });

    const formattedPlans = plans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      priceInPaise: plan.priceInPaise,
      price: plan.priceInPaise / 100,
      durationDays: plan.durationDays,
      classLimit: plan.classLimit,
      description: plan.description,
      features: plan.features || []
    }));

    return res.status(200).json({
      success: true,
      count: formattedPlans.length,
      plans: formattedPlans
    });
  } catch (error) {
    console.error("Error fetching plans:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve membership plans"
    });
  }
};

// @desc    Get single plan by ID
// @route   GET /api/plans/:id
// @access  Public
const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found"
      });
    }

    return res.status(200).json({
      success: true,
      plan: {
        _id: plan._id,
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        price: plan.priceInPaise / 100,
        durationDays: plan.durationDays,
        classLimit: plan.classLimit,
        description: plan.description,
        features: plan.features || []
      }
    });
  } catch (error) {
    console.error("Error fetching plan by ID:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve membership plan"
    });
  }
};

module.exports = {
  getPlans,
  getPlanById
};

