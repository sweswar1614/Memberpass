const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
if (!process.env.MONGO_URI) {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const connectDB = require("../config/db");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

async function runLiveApiTests() {
  console.log("\n==========================================");
  console.log("   MEMBERPASS - LIVE API HTTP TEST SUITE   ");
  console.log("==========================================\n");

  await connectDB();

  // Create isolated express app for test
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/plans", require("../routes/planRoutes"));
  app.use("/api/payments", require("../routes/paymentRoutes"));
  app.use("/api/member", require("../routes/memberRoutes"));
  app.use("/api/qr", require("../routes/qrRoutes"));

  app.get("/api/health", (req, res) => res.json({ success: true, message: "OK" }));

  const TEST_PORT = 5099;
  const server = app.listen(TEST_PORT);
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

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
    // 1. Health check
    console.log("--- 1. HEALTH CHECK ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.success, "GET /api/health returned 200 OK");

    // 2. Plans Endpoint
    console.log("\n--- 2. PLANS ENDPOINT ---");
    const plansRes = await fetch(`${BASE_URL}/plans`);
    const plansJson = await plansRes.json();
    assert(plansRes.status === 200, "GET /api/plans status is 200");
    assert(plansJson.plans && plansJson.plans.length === 3, `GET /api/plans returns 3 plans (found ${plansJson.plans?.length})`);
    const names = plansJson.plans.map(p => p.name).sort();
    assert(names.join(", ") === "Basic, Premium, Standard", `Plans are Basic, Standard, Premium: ${names.join(", ")}`);

    // 3. Auth Endpoints: Signup & Login
    console.log("\n--- 3. AUTH ENDPOINTS ---");
    const testEmail = `live_test_${Date.now()}@example.com`;
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Live Test Member",
        email: testEmail,
        password: "LivePassword@123",
        phone: "9988776655"
      })
    });
    const signupJson = await signupRes.json();
    assert(signupRes.status === 201, `POST /api/auth/signup returned 201 Created`);
    assert(signupJson.token && signupJson.user?.passCode, "Signup returns valid JWT and passCode");

    // Duplicate prevention
    const duplicateRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        email: testEmail,
        password: "AnyPassword123"
      })
    });
    assert(duplicateRes.status === 409, `POST /api/auth/signup rejected duplicate email with 409 Conflict`);

    // Login with Arun Kumar
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "arun1@example.com",
        password: "MemberPass@123"
      })
    });
    const arunAuth = await loginRes.json();
    assert(loginRes.status === 200, "POST /api/auth/login with Arun Kumar credentials succeeded (200)");
    const arunToken = arunAuth.token;
    assert(arunToken !== undefined, "Login returned bearer JWT token");

    // 4. Member Profile Endpoint
    console.log("\n--- 4. MEMBER PROFILE ---");
    const profileRes = await fetch(`${BASE_URL}/member/profile`, {
      headers: { Authorization: `Bearer ${arunToken}` }
    });
    const profileJson = await profileRes.json();
    assert(profileRes.status === 200, "GET /api/member/profile returned 200 OK");
    assert(profileJson.member?.name === "Arun Kumar", `Profile user name matches: ${profileJson.member?.name}`);
    assert(profileJson.member?.membership?.plan?.name === "Basic", `Arun Kumar plan is Basic`);
    assert(profileJson.member?.membership?.classesUsed === 8, `Arun Kumar classesUsed is exactly 8 (${profileJson.member?.membership?.classesUsed})`);
    assert(profileJson.member?.membershipStatus === "active", `Arun Kumar membershipStatus is active`);

    // 5. Member QR Pass Endpoint
    console.log("\n--- 5. MEMBER QR PASS ---");
    const passRes = await fetch(`${BASE_URL}/member/pass`, {
      headers: { Authorization: `Bearer ${arunToken}` }
    });
    const passJson = await passRes.json();
    assert(passRes.status === 200, "GET /api/member/pass returned 200 OK");
    assert(passJson.hasActiveMembership === true, "hasActiveMembership is true for active member");
    assert(passJson.pass?.qrCode?.startsWith("data:image/png;base64,"), "Pass includes base64 DataURL QR code");

    // QR payload inspection
    const qrPayload = passJson.pass?.qrPayload;
    assert(qrPayload && qrPayload.pass_code && qrPayload.plan && qrPayload.end_date, "QR payload contains pass_code, plan, end_date");
    assert(!qrPayload.email, "QR payload does NOT contain email");
    assert(!qrPayload.password, "QR payload does NOT contain password");
    assert(!qrPayload.payment, "QR payload does NOT contain payment info");

    // 6. Paused Member QR Pass Test (Janani R)
    console.log("\n--- 6. PAUSED MEMBER PASS CHECK (Janani R) ---");
    const jananiLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "janani20@example.com",
        password: "MemberPass@123"
      })
    });
    const jananiAuth = await jananiLogin.json();
    assert(jananiLogin.status === 200, "Janani R logged in successfully");

    const jananiPassRes = await fetch(`${BASE_URL}/member/pass`, {
      headers: { Authorization: `Bearer ${jananiAuth.token}` }
    });
    const jananiPassJson = await jananiPassRes.json();
    assert(jananiPassJson.hasActiveMembership === false, "Janani R hasActiveMembership is false");
    assert(jananiPassJson.status === "paused", `Janani R status is paused (found: ${jananiPassJson.status})`);
    assert(jananiPassJson.pass?.qrCode === null, "Paused pass does not generate active entry QR code");

    // 7. Payment Verification Flow
    console.log("\n--- 7. PAYMENT FLOW & HMAC VERIFICATION ---");
    // Test creating order when keys not configured
    const testKeySecret = "m2_live_secret_key_999";
    process.env.RAZORPAY_KEY_SECRET = testKeySecret;

    const basicPlan = await Plan.findOne({ name: "Basic" });
    const orderRef = `order_live_${Date.now()}`;
    const payRef = `pay_live_${Date.now()}`;

    // Create payment in DB
    const livePayment = await Payment.create({
      user: signupJson.user.id,
      plan: basicPlan._id,
      razorpayOrderId: orderRef,
      amount: basicPlan.priceInPaise,
      currency: "INR",
      status: "created"
    });

    const validSig = crypto
      .createHmac("sha256", testKeySecret)
      .update(`${orderRef}|${payRef}`)
      .digest("hex");

    // Verify payment endpoint
    const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${signupJson.token}`
      },
      body: JSON.stringify({
        razorpay_order_id: orderRef,
        razorpay_payment_id: payRef,
        razorpay_signature: validSig
      })
    });
    const verifyJson = await verifyRes.json();
    assert(verifyRes.status === 200, "POST /api/payments/verify accepted valid HMAC signature (200)");
    assert(verifyJson.success === true && verifyJson.membership?.status === "active", "Membership activated on payment verify");

    // Rejection of duplicate payment verification
    const dupVerifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${signupJson.token}`
      },
      body: JSON.stringify({
        razorpay_order_id: orderRef,
        razorpay_payment_id: payRef,
        razorpay_signature: validSig
      })
    });
    assert(dupVerifyRes.status === 400, "POST /api/payments/verify rejected duplicate verification attempt (400)");

    // Cleanup live test user
    await Payment.deleteMany({ user: signupJson.user.id });
    await Membership.deleteMany({ user: signupJson.user.id });
    await User.deleteOne({ _id: signupJson.user.id });
    console.log("[CLEANUP] Test user and payments cleaned up");

    console.log("\n==========================================");
    console.log(` LIVE API RESULTS: ${passed} PASSED, ${failed} FAILED `);
    console.log("==========================================\n");

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Live API test error:", err);
    server.close();
    process.exit(1);
  }
}

runLiveApiTests();

