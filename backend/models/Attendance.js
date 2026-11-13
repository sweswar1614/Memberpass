const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      required: true
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    checkInId: {
      type: String,
      required: true,
      unique: true
    },
    checkedInAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ membership: 1, checkedInAt: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
