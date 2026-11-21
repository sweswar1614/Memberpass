
const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const WebhookEvent = require("../models/WebhookEvent");

const handleRazorpayWebhook = async (req, res) => {
  let session;

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get("X-Razorpay-Signature");
    const eventId = req.get("x-razorpay-event-id");

    if (!webhookSecret?.trim()) {
      return res.status(500).json({
        success: false,
        message: "Razorpay webhook secret is not configured"
      });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Raw webhook body is required"
      });
    }

    if (!signature || !eventId) {
      return res.status(400).json({
        success: false,
        message: "Webhook signature or event ID is missing"
      });
    }

    // Verify signature using the original raw request body.
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret.trim())
      .update(req.body)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(signature, "hex");

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature"
      });
    }

    let payload;

    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook JSON"
      });
    }

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Save event ID. Unique index prevents duplicate processing.
      await WebhookEvent.create(
        [{
          eventId,
          event: payload.event || "unknown"
        }],
        { session }
      );

      // Handle payment.failed: mark status as failed, never activate membership
      if (payload.event === "payment.failed") {
        const failedPayment = payload.payload?.payment?.entity;
        if (failedPayment?.order_id) {
          const payment = await Payment.findOne({
            razorpayOrderId: failedPayment.order_id
          }).session(session);

          if (payment && payment.status !== "captured") {
            payment.status = "failed";
            if (failedPayment.id) {
              payment.razorpayPaymentId = failedPayment.id;
            }
            await payment.save({ session });
          }
        }
        return;
      }

      // Only payment.captured can activate a membership.
      if (payload.event !== "payment.captured") {
        return;
      }

      const capturedPayment = payload.payload?.payment?.entity;

      if (
        !capturedPayment?.id ||
        !capturedPayment?.order_id ||
        !Number.isSafeInteger(capturedPayment.amount) ||
        !capturedPayment.currency
      ) {
        throw new Error("Invalid payment.captured payload");
      }

      const payment = await Payment.findOne({
        razorpayOrderId: capturedPayment.order_id
      }).session(session);

      if (!payment) {
        throw new Error("Matching payment order not found");
      }

      // Check payment amount and currency against saved order.
      if (
        payment.amount !== capturedPayment.amount ||
        payment.currency !== capturedPayment.currency
      ) {
        throw new Error("Payment amount or currency mismatch");
      }

      // Already captured: never create another membership.
      if (payment.status === "captured") {
        if (payment.razorpayPaymentId !== capturedPayment.id) {
          throw new Error(
            "Payment already captured with another payment ID"
          );
        }

        return;
      }

      if (!["created", "authorized"].includes(payment.status)) {
        throw new Error(
          `Cannot capture payment in ${payment.status} state`
        );
      }

      const plan = await Plan.findById(payment.plan).session(session);

      if (
        !plan ||
        !Number.isFinite(plan.durationDays) ||
        plan.durationDays <= 0
      ) {
        throw new Error("Valid membership plan not found");
      }

      // Also verify against the current plan price.
      if (
        payment.amount !== plan.priceInPaise ||
        plan.priceInPaise !== capturedPayment.amount
      ) {
        throw new Error("Payment amount does not match membership plan price");
      }

      const now = new Date();
      const endDate = new Date(
        now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
      );

      // Membership is created only after all validations pass.
      const [membership] = await Membership.create(
        [{
          user: payment.user,
          plan: plan._id,
          status: "active",
          startDate: now,
          endDate,
          classesUsed: 0,
          payment: payment._id
        }],
        { session }
      );

      payment.status = "captured";
      payment.razorpayPaymentId = capturedPayment.id;
      payment.membership = membership._id;

      await payment.save({ session });

      // End previous active memberships.
      await Membership.updateMany(
        {
          user: payment.user,
          status: "active",
          _id: { $ne: membership._id }
        },
        {
          $set: { status: "ended" }
        },
        { session }
      );
    });

    return res.status(200).json({
      success: true,
      message: "Webhook processed"
    });

  } catch (error) {
    // Only duplicate webhook event IDs should be acknowledged as duplicates.
    const isDuplicateEvent =
      (error.code === 11000 || error.message?.includes("E11000")) &&
      (error.keyPattern?.eventId || error.keyValue?.eventId || error.message?.includes("eventId"));

    if (isDuplicateEvent) {
      return res.status(200).json({
        success: true,
        message: "Duplicate webhook ignored"
      });
    }

    console.error("Razorpay webhook error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Webhook processing failed"
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = { handleRazorpayWebhook };
