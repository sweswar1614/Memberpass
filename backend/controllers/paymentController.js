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

// @desc Verify Razorpay Payment Signature
// @route POST /api/payments/verify
// @access Private
// IMPORTANT: This function does NOT activate membership.
// Only the payment.captured webhook activates membership.
const verifyPayment = async (req, res) => {
  try {
    const {
      paymentRecordId,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!paymentRecordId || !razorpay_payment_id || !razorpay_signature) {
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

    // Webhook may have captured the payment before this request.
    if (payment.status === "captured") {
      let activeMembership = null;
      if (payment.membership) {
        activeMembership = await Membership.findById(payment.membership).populate("plan", "name durationDays priceInPaise");
      }
      return res.status(200).json({
        success: true,
        message: "Payment already captured and membership activation completed",
        status: "captured",
        membership: activeMembership
      });
    }

    // An already authorized payment must match the stored payment ID.
    if (payment.status === "authorized") {
      if (payment.razorpayPaymentId !== razorpay_payment_id) {
        return res.status(409).json({
          success: false,
          message: "Payment ID does not match the authorized payment"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment verified. Membership activation is pending webhook confirmation.",
        status: "authorized",
        membership: null
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

    // Verify checkout signature using the saved Razorpay order ID.
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
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    // Atomically authorize only a payment that is still in created state.
    // This prevents a late verification request from overwriting a webhook
    // that has already changed the payment to captured.
    const authorizedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        user: req.user._id,
        status: "created"
      },
      {
        $set: {
          status: "authorized",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!authorizedPayment) {
      const latestPayment = await Payment.findById(payment._id);

      if (
        latestPayment?.status === "captured"
      ) {
        let activeMembership = null;
        if (latestPayment.membership) {
          activeMembership = await Membership.findById(latestPayment.membership).populate("plan", "name durationDays priceInPaise");
        }
        return res.status(200).json({
          success: true,
          message: "Payment already captured and membership activation completed",
          status: "captured",
          membership: activeMembership
        });
      }

      if (
        latestPayment?.status === "authorized" &&
        latestPayment.razorpayPaymentId === razorpay_payment_id
      ) {
        return res.status(200).json({
          success: true,
          message: "Payment verified. Membership activation is pending webhook confirmation.",
          status: "authorized",
          membership: null
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment status changed. Please refresh and check payment history."
      });
    }

    // Membership activation is intentionally handled only by the webhook.
    return res.status(200).json({
      success: true,
      message: "Payment signature verified. Membership activation is pending webhook confirmation.",
      payment: {
        id: authorizedPayment._id,
        orderId: authorizedPayment.razorpayOrderId,
        paymentId: authorizedPayment.razorpayPaymentId,
        amount: authorizedPayment.amount,
        status: authorizedPayment.status
      },
      status: "authorized",
      membership: null
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
