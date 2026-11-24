
const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true
    },
    status: {
      type: String,
      enum: ["active", "ended", "paused"],
      default: "active"
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    classesUsed: {
      type: Number,
      default: 0,
      min: 0
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    // Membership Expiry Reminder Tracking
    expiryReminder: {
      status: {
        type: String,
        enum: ["pending", "processing", "sent", "failed"],
        default: "pending"
      },
      sentAt: {
        type: Date,
        default: null
      },
      lockId: {
        type: String,
        default: null
      },
      lockAt: {
        type: Date,
        default: null
      }
    },

    // Membership Pause Details
    pauseStartDate: {
      type: Date,
      default: null
    },
    pauseEndDate: {
      type: Date,
      default: null
    },
    pauseHistory: [
      {
        startDate: {
          type: Date,
          required: true
        },
        endDate: {
          type: Date,
          required: true
        },
        days: {
          type: Number,
          required: true
        },
        requestedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Membership", membershipSchema);
