require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

const plansData = [
  {
    name: "Basic",
    priceInPaise: 150000,
    durationDays: 30,
    classLimit: 10,
    description: "Essential access for individuals getting started with digital passes.",
    features: [
      "Access to main club facilities",
      "Up to 10 classes per month",
      "Instant Digital QR Pass",
      "Mobile dashboard & check-in history"
    ],
    isActive: true
  },
  {
    name: "Standard",
    priceInPaise: 300000,
    durationDays: 30,
    classLimit: 25,
    description: "Comprehensive access for active members seeking expanded privileges.",
    features: [
      "All Basic tier privileges",
      "Up to 25 classes per month",
      "Priority member lounge access",
      "1 Complimentary guest pass / month",
      "Instant pass verification"
    ],
    isActive: true
  },
  {
    name: "Premium",
    priceInPaise: 750000,
    durationDays: 90,
    classLimit: null,
    description: "All-inclusive 90-day VIP pass with unlimited studio & coaching access.",
    features: [
      "Unlimited classes & facility access",
      "90 days continuous validity",
      "Personal fitness consultation",
      "VIP Burgundy digital pass badge",
      "24/7 Priority member support"
    ],
    isActive: true
  }
];

const membersData = [
  // 12 Active Members
  { name: "Arun Kumar", email: "arun1@example.com", plan: "Basic", status: "active", classesUsed: 8 },
  { name: "Priya Devi", email: "priya2@example.com", plan: "Standard", status: "active", classesUsed: 3 },
  { name: "Karthik Raj", email: "karthik3@example.com", plan: "Premium", status: "active", classesUsed: 5 },
  { name: "Divya S", email: "divya4@example.com", plan: "Basic", status: "active", classesUsed: 2 },
  { name: "Vijay Kumar", email: "vijay5@example.com", plan: "Standard", status: "active", classesUsed: 4 },
  { name: "Meena R", email: "meena6@example.com", plan: "Premium", status: "active", classesUsed: 6 },
  { name: "Suresh B", email: "suresh7@example.com", plan: "Basic", status: "active", classesUsed: 1 },
  { name: "Anitha M", email: "anitha8@example.com", plan: "Standard", status: "active", classesUsed: 7 },
  { name: "Rahul P", email: "rahul9@example.com", plan: "Premium", status: "active", classesUsed: 2 },
  { name: "Kavya S", email: "kavya10@example.com", plan: "Basic", status: "active", classesUsed: 5 },
  { name: "Gokul R", email: "gokul11@example.com", plan: "Standard", status: "active", classesUsed: 3 },
  { name: "Nithya K", email: "nithya12@example.com", plan: "Premium", status: "active", classesUsed: 4 },

  // 7 Ended Members
  { name: "Manoj T", email: "manoj13@example.com", plan: "Basic", status: "ended", classesUsed: 8 },
  { name: "Lakshmi P", email: "lakshmi14@example.com", plan: "Standard", status: "ended", classesUsed: 12 },
  { name: "Praveen S", email: "praveen15@example.com", plan: "Premium", status: "ended", classesUsed: 15 },
  { name: "Swathi R", email: "swathi16@example.com", plan: "Basic", status: "ended", classesUsed: 6 },
  { name: "Deepak M", email: "deepak17@example.com", plan: "Standard", status: "ended", classesUsed: 9 },
  { name: "Harini V", email: "harini18@example.com", plan: "Premium", status: "ended", classesUsed: 10 },
  { name: "Bala K", email: "bala19@example.com", plan: "Basic", status: "ended", classesUsed: 7 },

  // Exactly 1 Paused Member
  { name: "Janani R", email: "janani20@example.com", plan: "Basic", status: "paused", classesUsed: 4 }
];

const seedDatabase = async () => {
  try {
    console.log("Connecting to database...");
    await connectDB();

    console.log("Upserting plans: Basic, Standard, Premium...");
    const planMap = {};

    // Remove legacy plans if any
    await Plan.deleteMany({ name: { $nin: ["Basic", "Standard", "Premium"] } });

    for (const planItem of plansData) {
      const plan = await Plan.findOneAndUpdate(
        { name: planItem.name },
        { $set: planItem },
        { new: true, upsert: true, runValidators: true }
      );
      planMap[plan.name] = plan;
    }

    console.log(`Plans registered: ${Object.keys(planMap).join(", ")}`);

    const now = new Date();

    for (let i = 0; i < membersData.length; i++) {
      const item = membersData[i];
      const plan = planMap[item.plan];

      // Upsert User
      let user = await User.findOne({ email: item.email });
      if (!user) {
        user = await User.create({
          name: item.name,
          email: item.email,
          password: "MemberPass@123",
          phone: `98765000${String(i + 1).padStart(2, "0")}`,
          role: "member"
        });
      } else {
        user.name = item.name;
        user.phone = `98765000${String(i + 1).padStart(2, "0")}`;
        await user.save();
      }

      // Calculate dates
      const duration = plan.durationDays;
      let startDate, endDate;

      if (item.status === "ended") {
        startDate = new Date(now.getTime() - (duration + 15) * 86400000);
        endDate = new Date(now.getTime() - 15 * 86400000);
      } else if (item.status === "paused") {
        startDate = new Date(now.getTime() - 10 * 86400000);
        endDate = new Date(now.getTime() + (duration - 10) * 86400000);
      } else {
        // active
        startDate = new Date(now.getTime() - 5 * 86400000);
        endDate = new Date(now.getTime() + (duration - 5) * 86400000);
      }

      // Upsert or create Payment
      const orderId = `order_seed_${user._id.toString().slice(-8)}`;
      let payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        payment = await Payment.create({
          user: user._id,
          plan: plan._id,
          razorpayOrderId: orderId,
          razorpayPaymentId: `pay_seed_${user._id.toString().slice(-8)}`,
          razorpaySignature: "seed_verified_signature",
          amount: plan.priceInPaise,
          currency: "INR",
          status: "captured"
        });
      }

      // Upsert Membership
      let membership = await Membership.findOne({ user: user._id });
      if (!membership) {
        membership = await Membership.create({
          user: user._id,
          plan: plan._id,
          status: item.status,
          startDate,
          endDate,
          classesUsed: item.classesUsed,
          payment: payment._id
        });
      } else {
        membership.plan = plan._id;
        membership.status = item.status;
        membership.startDate = startDate;
        membership.endDate = endDate;
        membership.classesUsed = item.classesUsed;
        membership.payment = payment._id;
        await membership.save();
      }

      // Link payment to membership
      if (!payment.membership) {
        payment.membership = membership._id;
        await payment.save();
      }

      console.log(
        `[${i + 1}/20] Seeded: ${user.name} (${user.email}) | Plan: ${item.plan} | Status: ${item.status} | Classes Used: ${item.classesUsed}`
      );
    }

    console.log("\n==========================================");
    console.log(" MemberPass Seed Completed Successfully! ");
    console.log("==========================================");
    console.log("Plans Created: Basic, Standard, Premium (3 total)");
    console.log("Members: 20 fictional members");
    console.log("Active: 12 | Ended: 7 | Paused: 1 (Janani R)");
    console.log("Basic with 8 classes used: Arun Kumar (arun1@example.com)");
    console.log("Universal Password: MemberPass@123");
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Seed execution failed:", error);
    process.exit(1);
  }
};

seedDatabase();
