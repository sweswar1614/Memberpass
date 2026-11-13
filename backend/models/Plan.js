const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['Basic', 'Standard', 'Premium'],
      required: true,
      unique: true
    },
    priceInPaise: {
      type: Number,
      required: true,
      min: 0
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1
    },
    classLimit: {
      type: Number,
      default: null
    },
    description: {
      type: String,
      default: ''
    },
    features: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);

