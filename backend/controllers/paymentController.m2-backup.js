
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");

// Razorpay instance
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId?.trim() || !keySecret?.trim()) {
    return null;
  }

  return new Razorpay({
    key_id: keyId.trim(),
    key_secret: keySecret.trim()
  });
};

// @desc Create Razorpay Order
// @route POST /api/payments/create-order
// @access Private
const createOrder = async (req, res) => {
  try {
    const { planId, planName } = req.body;

    if (!planId && !planName) {
      return res.status(400).json({
        success: false,
        message: "Plan ID or Plan Name is required"
      });
    }

    if (planId && !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID"
      });
    }

    const query = planId
      ? { _id: planId, isActive: true }
      : { name: planName, isActive: true };

    const plan = await Plan.findOne(query);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found or inactive"
      });
    }

    const razorpay = getRazorpayInstance();

    if (!razorpay) {
      return res.status(503).json({
        success: false,
        code: "RAZORPAY_KEYS_MISSING",
        message: "Razorpay API keys are not configured"
      });
    }

    const options = {
      amount: plan.priceInPaise,
      currency: "INR",
      receipt: `rcpt_${req.user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        planId: plan._id.toString(),
        planName: plan.name
      }
    };

    let order;

    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      console.error("Razorpay order creation error:", rzpErr);

      return res.status(502).json({
        success: false,
        message: "Failed to create Razorpay order"
      });
    }

    const payment = await Payment.create({
      user: req.user._id,
      plan: plan._id,
      razorpayOrderId: order.id,
      amount: plan.priceInPaise,
      currency: order.currency || "INR",
      status: "created"
    });

    return res.status(200).json({
      success: true,
      message: "Razorpay order created successfully",
      orderId: order.id,
      paymentRecordId: payment._id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: {
        id: plan._id,
        name: plan.name,
        durationDays: plan.durationDays,
        priceInPaise: plan.priceInPaise,
        price: plan.priceInPaise / 100
      },
      user: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || ""
      }
    });

  } catch (error) {
    console.error("createOrder error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error creating payment order"
    });
  }
};

// @desc Verify Razorpay Payment and Activate Membership
// @route POST /api/payments/verify
// @access Private
const verifyPayment = async (req, res) => {
  try {
    const {
      paymentRecordId,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !paymentRecordId ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(paymentRecordId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid paymentRecordId"
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret?.trim()) {
      return res.status(500).json({
        success: false,
        code: "RAZORPAY_SECRET_MISSING",
        message: "Razorpay secret is not configured"
      });
    }

    // Find payment belonging to authenticated user
    const payment = await Payment.findOne({
      _id: paymentRecordId,
      user: req.user._id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    // Idempotency: do not create membership twice
    if (payment.status === "captured") {
      const existingMembership = payment.membership
        ? await Membership.findById(payment.membership).populate("plan")
        : null;

      if (existingMembership) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified",
          membership: {
            id: existingMembership._id,
            plan: existingMembership.plan?.name,
            status: existingMembership.status,
            startDate: existingMembership.startDate,
            endDate: existingMembership.endDate,
            classesUsed: existingMembership.classesUsed
          }
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment captured but membership record is missing. Contact support."
      });
    }

    if (payment.status !== "created") {
      return res.status(400).json({
        success: false,
        message: `Payment status is '${payment.status}'. Verification is not allowed.`
      });
    }

    const savedOrderId = payment.razorpayOrderId;

    if (!savedOrderId) {
      return res.status(500).json({
        success: false,
        message: "Saved Razorpay order ID is missing"
      });
    }

    // Verify signature using database order ID
    const expectedSignature = crypto
      .createHmac("sha256", keySecret.trim())
      .update(`${savedOrderId}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      payment.status = "failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    const plan = await Plan.findById(payment.plan);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Associated membership plan not found"
      });
    }

    if (!Number.isFinite(plan.durationDays) || plan.durationDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership plan duration"
      });
    }

    const now = new Date();
    const endDate = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
    );

    // Create membership and link it to payment.
    // Save payment as captured only after membership creation succeeds.
    const membership = await Membership.create({
      user: req.user._id,
      plan: plan._id,
      status: "active",
      startDate: now,
      endDate,
      classesUsed: 0,
      payment: payment._id
    });

    try {
      payment.status = "captured";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.membership = membership._id;

      await payment.save();

      // End previous active memberships only after successful save
      await Membership.updateMany(
        {
          user: req.user._id,
          status: "active",
          _id: { $ne: membership._id }
        },
        {
          $set: { status: "ended" }
        }
      );

    } catch (saveError) {
      // Avoid leaving an unlinked membership if payment save fails
      await Membership.findByIdAndDelete(membership._id);
      throw saveError;
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and membership activated",
      payment: {
        id: payment._id,
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        status: payment.status
      },
      membership: {
        id: membership._id,
        plan: plan.name,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        classesUsed: membership.classesUsed
      }
    });

  } catch (error) {
    console.error("verifyPayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error verifying payment"
    });
  }
};

// @desc Get user's payment history
// @route GET /api/payments/my-payments
// @access Private
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      user: req.user._id
    })
      .populate("plan", "name durationDays priceInPaise")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments: payments.map((payment) => ({
        id: payment._id,
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        planName: payment.plan ? payment.plan.name : "Custom",
        date: payment.createdAt
      }))
    });

  } catch (error) {
    console.error("getMyPayments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history"
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyPayments
};
