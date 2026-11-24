const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const Attendance = require("../models/Attendance");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Optional authentication middleware: attaches req.user if valid token provided
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Continue without req.user if token is invalid/expired
  }
  next();
};

// POST /api/ai/chat
router.post("/chat", optionalAuth, async (req, res) => {
  try {
    const { question } = req.body || {};

    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid question (maximum 500 characters)"
      });
    }

    const cleanQuestion = question.trim();
    const qLower = cleanQuestion.toLowerCase();

    // 1. Check if user is asking for their membership status
    if (
      qLower.includes("membership status") ||
      qLower.includes("my status") ||
      qLower.includes("check my status") ||
      (qLower.includes("status") && qLower.includes("membership"))
    ) {
      if (!req.user) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer:
            "To check your live membership status and remaining classes, please sign in to your MemberPass account.",
          requiresAuth: true
        });
      }

      const membership = await Membership.findOne({ user: req.user._id })
        .sort({ createdAt: -1 })
        .populate("plan");

      if (!membership) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer: `Hello **${req.user.name}**! You do not currently have an active membership pass. You can browse our Basic (₹1,500), Standard (₹3,000), or Premium (₹7,500) yoga tiers under the Membership Plans section to claim your pass.`
        });
      }

      const planName = membership.plan?.name || "MemberPass Tier";
      const limit = membership.plan?.classLimit ?? "Unlimited";
      const endDateStr = new Date(membership.endDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      const statusUpper = (membership.status || "ACTIVE").toUpperCase();

      return res.json({
        success: true,
        question: cleanQuestion,
        answer: `Hello **${req.user.name}**! Here is your current membership overview:

• **Plan:** ${planName}
• **Status:** ${statusUpper}
• **Classes Attended:** ${membership.classesUsed || 0} of ${limit}
• **Valid Until:** ${endDateStr}
• **Digital QR Pass:** ${statusUpper === "ACTIVE" ? "Ready for check-in" : statusUpper}

${
  membership.status === "paused"
    ? "Your pass is currently paused. You can resume it anytime directly from your dashboard."
    : membership.status === "ended"
    ? "Your previous membership has ended. You can renew your pass from the Membership Plans section."
    : "Your pass is active and in good standing. Present your digital QR pass at the studio front desk for instant entry."
}`
      });
    }

    // 2. Check how many classes attended / attendance count
    if (
      (qLower.includes("classes") &&
        (qLower.includes("attended") ||
          qLower.includes("many") ||
          qLower.includes("used") ||
          qLower.includes("count") ||
          qLower.includes("remain") ||
          qLower.includes("left"))) ||
      qLower.includes("attendance history") ||
      qLower.includes("how many classes")
    ) {
      if (!req.user) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer:
            "Please log in to your MemberPass account to view your verified class attendance records.",
          requiresAuth: true
        });
      }

      const membership = await Membership.findOne({ user: req.user._id })
        .sort({ createdAt: -1 })
        .populate("plan");
      const totalCheckins = await Attendance.countDocuments({
        member: req.user._id
      });

      if (!membership) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer: `Hello **${req.user.name}**! You do not have an active membership. Lifetime studio check-ins on record: **${totalCheckins}**.`
        });
      }

      const planName = membership.plan?.name || "Membership";
      const used = membership.classesUsed || 0;
      const limit = membership.plan?.classLimit;
      const remaining =
        limit !== null && limit !== undefined
          ? Math.max(0, limit - used)
          : "Unlimited";

      return res.json({
        success: true,
        question: cleanQuestion,
        answer: `Hello **${req.user.name}**! Here is your class attendance breakdown:

• **Current Plan:** ${planName}
• **Classes Attended:** ${used} session${used === 1 ? "" : "s"}
• **Classes Remaining:** ${remaining}
• **Lifetime Studio Check-ins:** ${totalCheckins}

Your attendance is securely logged whenever authorized staff scans your encrypted QR pass at the studio.`
      });
    }

    // 3. Check when membership expires
    if (
      qLower.includes("expire") ||
      qLower.includes("expiry") ||
      qLower.includes("end date") ||
      qLower.includes("valid until") ||
      qLower.includes("when does my membership")
    ) {
      if (!req.user) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer:
            "Please log in to your MemberPass account to check your exact membership expiration date.",
          requiresAuth: true
        });
      }

      const membership = await Membership.findOne({ user: req.user._id })
        .sort({ createdAt: -1 })
        .populate("plan");

      if (!membership) {
        return res.json({
          success: true,
          question: cleanQuestion,
          answer: `Hello **${req.user.name}**! You do not currently have an active membership with an expiration date. You can select a plan anytime to begin your practice.`
        });
      }

      const endDateStr = new Date(membership.endDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      const diffMs = new Date(membership.endDate) - new Date();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return res.json({
        success: true,
        question: cleanQuestion,
        answer: `Hello **${req.user.name}**! Your **${
          membership.plan?.name || "MemberPass"
        }** membership expiration details:

• **Expiry Date:** ${endDateStr}
• **Days Remaining:** ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}
• **Status:** ${(membership.status || "active").toUpperCase()}

We will send renewal notifications to your registered email before expiry so your studio access remains uninterrupted.`
      });
    }

    // 4. Explain membership plans
    if (
      qLower.includes("membership plans") ||
      qLower.includes("explain the plans") ||
      qLower.includes("what plans") ||
      qLower.includes("pricing") ||
      qLower.includes("tiers") ||
      (qLower.includes("plan") && (qLower.includes("cost") || qLower.includes("price") || qLower.includes("available")))
    ) {
      let plans = [];
      try {
        plans = await Plan.find({ isActive: true }).sort({ price: 1 });
      } catch (e) {
        // Fallback plans if db query fails
      }

      if (plans.length > 0) {
        const planList = plans
          .map(
            (p, idx) =>
              `${idx + 1}. **${p.name} Plan** — ₹${(p.price || 0).toLocaleString("en-IN")} for ${p.durationDays} Days\n   • Classes: ${
                p.classLimit ? `${p.classLimit} classes` : "Unlimited sessions"
              }\n   • ${p.description || "Full access with encrypted digital QR pass"}`
          )
          .join("\n\n");

        return res.json({
          success: true,
          question: cleanQuestion,
          answer: `MemberPass offers tailored membership tiers for yoga & wellness practitioners:

${planList}

All memberships include instant digital QR passes, real-time class tracking, and Razorpay-verified payments.`
        });
      }

      return res.json({
        success: true,
        question: cleanQuestion,
        answer: `MemberPass offers three tailored yoga & wellness membership plans:

1. **Basic Plan (₹1,500 / 30 Days)**: 10 studio yoga classes, encrypted digital QR pass, attendance tracking.
2. **Standard Plan (₹3,000 / 30 Days)**: 25 studio yoga classes, priority booking, flexible scheduling.
3. **Premium Plan (₹7,500 / 90 Days)**: Unlimited studio sessions & masterclasses, VIP wellness consultations, 90-day extended validity.

You can select and activate any plan with secure Razorpay test checkout under the **Membership Plans** section.`
      });
    }

    // 5. How to pause membership
    if (
      qLower.includes("pause") ||
      qLower.includes("freeze") ||
      qLower.includes("hold") ||
      qLower.includes("suspend")
    ) {
      return res.json({
        success: true,
        question: cleanQuestion,
        answer: `You can pause your active membership anytime directly from the **Member Dashboard**:

1. Log in and navigate to your **Member Dashboard**.
2. Locate the **Membership Status** card on your dashboard.
3. Click the **Pause Membership** button.
4. While paused, your expiration countdown stops and class usage is temporarily suspended until you choose to resume.

*Members can pause an active pass once per billing cycle at no extra charge.*`
      });
    }

    // 6. Try external AI microservice (Python / FastAPI) if reachable
    try {
      const response = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: cleanQuestion
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.answer && data.answer.trim().length > 0) {
          return res.json(data);
        }
      }
    } catch (aiErr) {
      // Python AI service not running on port 8000; fallback to contextual intelligent answer
    }

    // 7. Domain Knowledge Fallback for MemberPass queries
    if (
      qLower.includes("qr") ||
      qLower.includes("check-in") ||
      qLower.includes("check in") ||
      qLower.includes("scanner")
    ) {
      return res.json({
        success: true,
        question: cleanQuestion,
        answer:
          "MemberPass uses cryptographic digital QR passes. When you arrive at the yoga studio, simply present your pass from your phone or mobile browser. Authorized staff scan it with their camera scanner to instantly verify validity and deduct one class credit."
      });
    }

    if (
      qLower.includes("what is memberpass") ||
      qLower.includes("about memberpass") ||
      qLower.includes("who are you") ||
      qLower.includes("help")
    ) {
      return res.json({
        success: true,
        question: cleanQuestion,
        answer:
          "MemberPass is an all-in-one membership management platform engineered for yoga centres and wellness studios. We provide digital QR passes, automated class attendance verification, Razorpay payment processing, and intelligent member assistance."
      });
    }

    // General intelligent assistant response
    return res.json({
      success: true,
      question: cleanQuestion,
      answer: `Thank you for asking about **"${cleanQuestion}"**.

MemberPass is configured to assist with:
• **Membership Status & Renewals** — Check active plans, remaining days, and validity.
• **Attendance Tracking** — View attended classes and remaining sessions.
• **Digital QR Passes** — Access your personal pass for front-desk check-in.
• **Membership Plans** — Compare Basic, Standard, and Premium tiers.
• **Account Management** — Pause membership, view payment history, and update details.

Try asking: *"Check my membership status"*, *"How many classes have I attended?"*, or *"Explain the membership plans"* for instant answers!`
    });
  } catch (error) {
    console.error("AI service error:", error.message);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing your question."
    });
  }
});

module.exports = router;
