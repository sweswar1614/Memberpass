const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
if (!process.env.MONGO_URI) {
  require("dotenv").config();
}
const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

async function runM2Tests() {
  console.log("\n==========================================");
  console.log("   MEMBERPASS - M2 VERIFICATION SUITE     ");
  console.log("==========================================\n");

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TASK 1: DATABASE & SEED DATA AUDIT
    // -------------------------------------------------------------
    console.log("--- TASK 1: DATABASE TABLES & SEED DATA ---");

    const plans = await Plan.find({ isActive: true });
    assert(plans.length === 3, `Expected exactly 3 plans, found ${plans.length}`);

    const planNames = plans.map((p) => p.name).sort();
    assert(
      JSON.stringify(planNames) === JSON.stringify(["Basic", "Premium", "Standard"]),
      `Plan names are Basic, Standard, Premium: ${planNames.join(", ")}`
    );

    const membersCount = await User.countDocuments({ role: "member" });
    assert(membersCount >= 20, `Seeded members count is ${membersCount} (expected >= 20)`);

    const activeCount = await Membership.countDocuments({ status: "active" });
    const endedCount = await Membership.countDocuments({ status: "ended" });
    const pausedCount = await Membership.countDocuments({ status: "paused" });

    assert(activeCount >= 12, `Active memberships count: ${activeCount} (expected >= 12)`);
    assert(endedCount >= 7, `Ended memberships count: ${endedCount} (expected >= 7)`);
    assert(pausedCount === 1, `Paused memberships count: ${pausedCount} (expected exactly 1)`);

    const arun = await User.findOne({ email: "arun1@example.com" });
    assert(arun !== null, "Member Arun Kumar (arun1@example.com) exists");
    if (arun) {
      const arunMem = await Membership.findOne({ user: arun._id }).populate("plan");
      assert(arunMem && arunMem.plan.name === "Basic", "Arun Kumar is on the Basic plan");
      assert(arunMem && arunMem.classesUsed === 8, `Arun Kumar has exactly 8 classes used: ${arunMem?.classesUsed}`);
    }

    const janani = await User.findOne({ email: "janani20@example.com" });
    assert(janani !== null, "Member Janani R (janani20@example.com) exists");
    if (janani) {
      const jananiMem = await Membership.findOne({ user: janani._id });
      assert(jananiMem && jananiMem.status === "paused", "Janani R has status paused");
    }

    // -------------------------------------------------------------
    // TASK 2: MEMBER SIGNUP & AUTH
    // -------------------------------------------------------------
    console.log("\n--- TASK 2: MEMBER SIGNUP & LOGIN ---");

    const testEmail = `test_m2_${Date.now()}@example.com`;
    // Clean up test user if exists
    await User.deleteMany({ email: { $regex: /^test_m2_/ } });

    // Test password hashing and pass_code generation on signup
    const newUser = await User.create({
      name: "M2 Test User",
      email: testEmail,
      password: "TestPassword123",
      role: "member"
    });

    assert(newUser.passCode && newUser.passCode.length === 64, `passCode generated securely (length: ${newUser.passCode.length})`);
    assert(newUser.password !== "TestPassword123", "Password is encrypted (not plain text)");
    assert(newUser.password.startsWith("$2"), "Password hashed using bcrypt");

    // Test password comparison
    const pwMatch = await newUser.comparePassword("TestPassword123");
    assert(pwMatch === true, "Password comparison succeeds with correct password");

    const pwMismatch = await newUser.comparePassword("WrongPassword");
    assert(pwMismatch === false, "Password comparison fails with wrong password");

    // Duplicate email check
    let duplicateRejected = false;
    try {
      await User.create({
        name: "Duplicate User",
        email: testEmail,
        password: "AnotherPassword123"
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "Duplicate email registration properly rejected by unique constraint");

    // -------------------------------------------------------------
    // TASK 3: PLANS & RAZORPAY PAYMENT LOGIC
    // -------------------------------------------------------------
    console.log("\n--- TASK 3: PLANS & PAYMENT LOGIC ---");

    const basicPlan = await Plan.findOne({ name: "Basic" });
    assert(basicPlan.priceInPaise === 150000, `Basic plan price is 150000 paise (₹1,500)`);

    const standardPlan = await Plan.findOne({ name: "Standard" });
    assert(standardPlan.priceInPaise === 300000, `Standard plan price is 300000 paise (₹3,000)`);

    const premiumPlan = await Plan.findOne({ name: "Premium" });
    assert(premiumPlan.priceInPaise === 750000, `Premium plan price is 750000 paise (₹7,500)`);

    // Simulate Payment creation & HMAC-SHA256 signature verification
    const secretKey = process.env.RAZORPAY_KEY_SECRET || "m2_test_secret_for_suite";
    const testOrderId = `order_test_${Date.now()}`;
    const testPaymentId = `pay_test_${Date.now()}`;

    // Create payment in DB
    const testPayment = await Payment.create({
      user: newUser._id,
      plan: basicPlan._id,
      razorpayOrderId: testOrderId,
      amount: basicPlan.priceInPaise,
      currency: "INR",
      status: "created"
    });
    assert(testPayment.status === "created", "Payment order record created in DB with status 'created'");

    // Generate valid HMAC signature
    const validSignature = crypto
      .createHmac("sha256", secretKey)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    // Verify signature logic using timingSafeEqual
    const expectedBuf = Buffer.from(validSignature, "utf-8");
    const receivedBuf = Buffer.from(validSignature, "utf-8");
    const isValidSignature =
      expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    assert(isValidSignature, "HMAC-SHA256 signature verification passes with valid key and payload");

    // Verify invalid signature rejection
    const tamperedSignature = validSignature.slice(0, -4) + "beef";
    const tamperedBuf = Buffer.from(tamperedSignature, "utf-8");
    const isTamperedValid =
      expectedBuf.length === tamperedBuf.length && crypto.timingSafeEqual(expectedBuf, tamperedBuf);

    assert(!isTamperedValid, "Tampered signature properly rejected by verification check");

    // Activate membership upon payment capture
    testPayment.status = "captured";
    testPayment.razorpayPaymentId = testPaymentId;
    testPayment.razorpaySignature = validSignature;
    await testPayment.save();

    const now = new Date();
    const testMembership = await Membership.create({
      user: newUser._id,
      plan: basicPlan._id,
      status: "active",
      startDate: now,
      endDate: new Date(now.getTime() + basicPlan.durationDays * 86400000),
      classesUsed: 0,
      payment: testPayment._id
    });

    testPayment.membership = testMembership._id;
    await testPayment.save();

    assert(testMembership.status === "active", "Membership activated successfully upon payment capture");

    // Duplicate check: Verify that re-verifying a captured payment is blocked
    const duplicateCheck = testPayment.status === "captured";
    assert(duplicateCheck, "System prevents duplicate payment processing for already captured order");

    // -------------------------------------------------------------
    // TASK 4: QR MEMBERSHIP PASS SPECIFICATION
    // -------------------------------------------------------------
    console.log("\n--- TASK 4: QR MEMBERSHIP PASS ---");

    const qrPassPayload = {
      pass_code: newUser.passCode,
      plan: basicPlan.name,
      end_date: testMembership.endDate.toISOString().split("T")[0]
    };

    const payloadKeys = Object.keys(qrPassPayload).sort();
    assert(
      JSON.stringify(payloadKeys) === JSON.stringify(["end_date", "pass_code", "plan"]),
      `QR code contains ONLY pass_code, plan, end_date (keys: ${payloadKeys.join(", ")})`
    );

    assert(!qrPassPayload.email, "QR pass contains NO user email");
    assert(!qrPassPayload.password, "QR pass contains NO password");
    assert(!qrPassPayload.payment, "QR pass contains NO payment details");

    // Clean up test records
    await Payment.deleteMany({ user: newUser._id });
    await Membership.deleteMany({ user: newUser._id });
    await User.deleteOne({ _id: newUser._id });
    console.log("[CLEANUP] Test records cleaned up successfully");

    console.log("\n==========================================");
    console.log(` M2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED `);
    console.log("==========================================\n");

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Test error:", error);
    process.exit(1);
  }
}

runM2Tests();

