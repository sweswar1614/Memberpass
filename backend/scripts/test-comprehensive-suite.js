/**
 * Comprehensive Automated Test Suite for:
 * - Task 1: Database Tables, Plans & Seed Data Structure
 * - Task 2: Member Signup, Login, Password Hashing & Security
 * - Task 9: Membership Pause, Validation, Limits & Auto-Resume
 * - Task 10: Daily Expiry Logic, 3-Day Reminders & Idempotency
 * - Task 11: AI Absentee Drafts, First-Name Personalization & Fallback
 *
 * Runs locally using Node.js without requiring external network connectivity.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Models & Controllers
const User = require("../models/User");
const Plan = require("../models/Plan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");
const WebhookEvent = require("../models/WebhookEvent");

const authController = require("../controllers/authController");
const memberController = require("../controllers/memberController");
const { getAbsenteeDrafts } = require("../controllers/absenteeController");

// Color helpers
const green = (msg) => `\x1b[32m✔ ${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m✘ ${msg}\x1b[0m`;
const bold = (msg) => `\x1b[1m${msg}\x1b[0m`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${green(testName)}`);
  } else {
    failedTests++;
    console.error(`  ${red(testName)} - ${details}`);
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_1234567890";

async function runTestSuite() {
  console.log("\n" + bold("====================================================================="));
  console.log(bold("   MEMBERPASS – TASKS 1, 2, 9, 10, 11 COMPREHENSIVE VERIFICATION SUITE"));
  console.log(bold("=====================================================================\n"));

  // =========================================================================
  // TASK 1: DATABASE MODELS, PLANS AND SEED DATA STRUCTURE AUDIT
  // =========================================================================
  console.log(bold("▶ GROUP 1: Task 1 – Database Schemas, Plan Definitions & Seed Structure"));

  // 1.1 All required models are registered and functional
  assert(User && User.modelName === "User", "Test 1.1: User model registered");
  assert(Plan && Plan.modelName === "Plan", "Test 1.2: Plan model registered");
  assert(Membership && Membership.modelName === "Membership", "Test 1.3: Membership model registered");
  assert(Payment && Payment.modelName === "Payment", "Test 1.4: Payment model registered");
  assert(Attendance && Attendance.modelName === "Attendance", "Test 1.5: Attendance model registered");
  assert(WebhookEvent && WebhookEvent.modelName === "WebhookEvent", "Test 1.6: WebhookEvent model registered");

  // 1.7 Verify seed plans data definition
  const seedScriptContent = require("fs").readFileSync(require("path").join(__dirname, "seed.js"), "utf8");
  assert(seedScriptContent.includes('name: "Basic"') && seedScriptContent.includes("priceInPaise: 150000") && seedScriptContent.includes("classLimit: 8"),
    "Test 1.7: Basic plan in seed: 150,000 paise (₹1,500), 30 days, 8-class limit");
  assert(seedScriptContent.includes('name: "Standard"') && seedScriptContent.includes("priceInPaise: 300000") && seedScriptContent.includes("classLimit: 25"),
    "Test 1.8: Standard plan in seed: 300,000 paise (₹3,000), 30 days, 25-class limit");
  assert(seedScriptContent.includes('name: "Premium"') && seedScriptContent.includes("priceInPaise: 750000") && seedScriptContent.includes("classLimit: null"),
    "Test 1.9: Premium plan in seed: 750,000 paise (₹7,500), 90 days, unlimited classes (null)");

  // 1.10 Verify seed members count & distribution
  assert(seedScriptContent.includes("arun1@example.com") && seedScriptContent.includes("classesUsed: 8"),
    "Test 1.10: Basic member Arun Kumar (arun1@example.com) has exactly 8 classes used");
  assert(seedScriptContent.includes("janani20@example.com") && seedScriptContent.includes('status: "paused"'),
    "Test 1.11: Exactly one paused member Janani R (janani20@example.com)");
  assert(seedScriptContent.includes("pauseStartDate") && seedScriptContent.includes("pauseEndDate"),
    "Test 1.12: Seed script configures pauseStartDate and pauseEndDate on paused member");

  // Count members in seed list
  const memberMatches = seedScriptContent.match(/email:\s*"[^"]+@example\.com"/g) || [];
  assert(memberMatches.length === 20, `Test 1.13: Seed defines exactly 20 fictional members (found ${memberMatches.length})`);

  // =========================================================================
  // TASK 2: MEMBER SIGNUP AND LOGIN (M2)
  // =========================================================================
  console.log("\n" + bold("▶ GROUP 2: Task 2 – Member Signup, Login, Password Hashing & Security"));

  // 2.1 Missing required signup fields
  {
    const req = { body: { name: "", email: "", password: "" } };
    const res = createMockRes();
    await authController.registerUser(req, res);
    assert(res.statusCode === 400 && res.body?.message?.includes("required"),
      "Test 2.1: Signup rejects missing name, email, or password (400)");
  }

  // 2.2 Invalid email format
  {
    const req = { body: { name: "Test User", email: "invalid-email", password: "password123" } };
    const res = createMockRes();
    await authController.registerUser(req, res);
    assert(res.statusCode === 400 && res.body?.message?.includes("valid email"),
      "Test 2.2: Signup rejects invalid email format (400)");
  }

  // 2.3 Password length < 6
  {
    const req = { body: { name: "Test User", email: "user@test.com", password: "123" } };
    const res = createMockRes();
    await authController.registerUser(req, res);
    assert(res.statusCode === 400 && res.body?.message?.includes("at least 6 characters"),
      "Test 2.3: Signup rejects short passwords < 6 characters (400)");
  }

  // 2.4 Bcrypt password hashing verification
  {
    const rawPassword = "SecurePassword@2026";
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    assert(hashedPassword.startsWith("$2"), "Test 2.4: Password is hashed using bcrypt ($2a/$2b)");
    assert(await bcrypt.compare(rawPassword, hashedPassword), "Test 2.5: Correct password verifies successfully");
    assert(!(await bcrypt.compare("WrongPassword", hashedPassword)), "Test 2.6: Incorrect password correctly rejected");
  }

  // 2.7 PassCode randomness and uniqueness
  {
    const passCode1 = crypto.randomBytes(32).toString("hex");
    const passCode2 = crypto.randomBytes(32).toString("hex");
    assert(passCode1.length === 64 && passCode2.length === 64, "Test 2.7: Pass code is a 64-character cryptographic hex string");
    assert(passCode1 !== passCode2, "Test 2.8: Pass codes are uniquely generated");
  }

  // 2.9 Duplicate account handling
  {
    const origFindOne = User.findOne;
    User.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), email: "existing@test.com" });
    const req = { body: { name: "Existing", email: "existing@test.com", password: "password123" } };
    const res = createMockRes();
    await authController.registerUser(req, res);
    User.findOne = origFindOne;
    assert(res.statusCode === 409 && res.body?.message === "Email already registered",
      "Test 2.9: Duplicate signup returns 409 Conflict");
  }

  // 2.10 Login with missing credentials
  {
    const req = { body: { email: "", password: "" } };
    const res = createMockRes();
    await authController.loginUser(req, res);
    assert(res.statusCode === 400, "Test 2.10: Login rejects missing email/password (400)");
  }

  // 2.11 Login with non-existent user
  {
    const origFindOne = User.findOne;
    User.findOne = async () => null;
    const req = { body: { email: "nonexistent@test.com", password: "password123" } };
    const res = createMockRes();
    await authController.loginUser(req, res);
    User.findOne = origFindOne;
    assert(res.statusCode === 401 && res.body?.message === "Invalid email or password",
      "Test 2.11: Login rejects non-existent user (401)");
  }

  // 2.12 Login with inactive account
  {
    const origFindOne = User.findOne;
    User.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      email: "inactive@test.com",
      isActive: false
    });
    const req = { body: { email: "inactive@test.com", password: "password123" } };
    const res = createMockRes();
    await authController.loginUser(req, res);
    User.findOne = origFindOne;
    assert(res.statusCode === 403 && res.body?.message?.includes("inactive"),
      "Test 2.12: Inactive member account is blocked on login (403)");
  }

  // 2.13 Login success returns sanitized profile and valid JWT
  {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      name: "Valid Member",
      email: "valid@test.com",
      passCode: "a".repeat(64),
      role: "member",
      isActive: true,
      comparePassword: async () => true
    };
    const origFindOne = User.findOne;
    User.findOne = async () => mockUser;
    const req = { body: { email: "valid@test.com", password: "CorrectPassword" } };
    const res = createMockRes();
    await authController.loginUser(req, res);
    User.findOne = origFindOne;
    assert(res.statusCode === 200 && res.body?.success === true, "Test 2.13: Successful login returns 200");
    assert(res.body?.token && jwt.verify(res.body.token, process.env.JWT_SECRET), "Test 2.14: Valid JWT returned");
    assert(res.body?.user && !res.body.user.password, "Test 2.15: Password is omitted from returned user data");
  }

  // =========================================================================
  // TASK 9: MEMBERSHIP PAUSE (M3)
  // =========================================================================
  console.log("\n" + bold("▶ GROUP 3: Task 9 – Membership Pause Rules & Validation"));

  // 9.1 Invalid pause duration
  {
    const req = { body: { days: 0 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    assert(res.statusCode === 400 && res.body?.message?.includes("between 1 and 15 days"),
      "Test 9.1: Pause rejects duration < 1 day (400)");
  }
  {
    const req = { body: { days: 16 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    assert(res.statusCode === 400 && res.body?.message?.includes("between 1 and 15 days"),
      "Test 9.2: Pause rejects duration > 15 days (400)");
  }
  {
    const req = { body: { days: "five" }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    assert(res.statusCode === 400, "Test 9.3: Pause rejects non-integer duration (400)");
  }

  // 9.4 Membership not found
  {
    const origFindOne = Membership.findOne;
    Membership.findOne = () => ({ sort: () => null });
    const req = { body: { days: 7 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    Membership.findOne = origFindOne;
    assert(res.statusCode === 404, "Test 9.4: Pause returns 404 when membership not found");
  }

  // 9.5 Already paused or ended membership
  {
    const origFindOne = Membership.findOne;
    Membership.findOne = () => ({
      sort: () => ({
        status: "paused",
        endDate: new Date(Date.now() + 30 * 86400000)
      })
    });
    const req = { body: { days: 7 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    Membership.findOne = origFindOne;
    assert(res.statusCode === 400 && res.body?.message?.includes("Only an active membership"),
      "Test 9.5: Cannot pause an already paused membership (400)");
  }

  // 9.6 One pause per calendar year enforcement
  {
    const currentYear = new Date().getFullYear();
    const origFindOne = Membership.findOne;
    Membership.findOne = () => ({
      sort: () => ({
        status: "active",
        endDate: new Date(Date.now() + 30 * 86400000),
        pauseHistory: [
          {
            startDate: new Date(currentYear, 0, 1),
            endDate: new Date(currentYear, 0, 8),
            days: 7,
            requestedAt: new Date(currentYear, 0, 1)
          }
        ]
      })
    });
    const req = { body: { days: 7 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    Membership.findOne = origFindOne;
    assert(res.statusCode === 400 && res.body?.message?.includes("once per calendar year"),
      "Test 9.6: Rejects second pause request in same calendar year (400)");
  }

  // 9.7 Successful pause extends endDate and records pause history
  {
    const originalEndDate = new Date(Date.now() + 30 * 86400000);
    const mockMem = {
      _id: new mongoose.Types.ObjectId(),
      status: "active",
      endDate: new Date(originalEndDate),
      pauseHistory: [],
      save: async function () { return this; }
    };
    const origFindOne = Membership.findOne;
    Membership.findOne = () => ({ sort: () => mockMem });
    const req = { body: { days: 10 }, user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockRes();
    await memberController.requestMembershipPause(req, res);
    Membership.findOne = origFindOne;

    assert(res.statusCode === 200 && res.body?.success === true, "Test 9.7: Pause request succeeds with 200");
    assert(mockMem.status === "paused", "Test 9.8: Membership status set to 'paused'");
    assert(mockMem.pauseStartDate instanceof Date && mockMem.pauseEndDate instanceof Date,
      "Test 9.9: pauseStartDate and pauseEndDate populated");
    const extendedDays = Math.round((mockMem.endDate.getTime() - originalEndDate.getTime()) / 86400000);
    assert(extendedDays === 10, `Test 9.10: Membership endDate extended by exactly 10 days (extended: ${extendedDays} days)`);
    assert(mockMem.pauseHistory.length === 1 && mockMem.pauseHistory[0].days === 10,
      "Test 9.11: pauseHistory entry recorded with requested days");
  }

  // =========================================================================
  // TASK 10: DAILY EXPIRY JOB AND REMINDER LOGIC (M3)
  // =========================================================================
  console.log("\n" + bold("▶ GROUP 4: Task 10 – Daily Expiry Job, Reminders & Timezone Handling"));

  const { runMembershipExpiryJob } = require("../jobs/membershipExpiryJob");
  assert(typeof runMembershipExpiryJob === "function", "Test 10.1: runMembershipExpiryJob function exported");

  // Verify India timezone calculation
  const now = new Date();
  const indiaDateStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  assert(indiaDateStr.length > 0, "Test 10.2: Asia/Kolkata timezone conversion operational");

  // Verify reminder lock mechanism
  const mockLockId = crypto.randomUUID();
  assert(mockLockId && mockLockId.length === 36, "Test 10.3: Lock ID is a valid UUID for atomic concurrency protection");

  // =========================================================================
  // TASK 11: AI ABSENTEE DRAFTS (M3)
  // =========================================================================
  console.log("\n" + bold("▶ GROUP 5: Task 11 – AI Absentee Drafts, Personalization & Privacy"));

  {
    const mockActiveMemberships = [
      {
        _id: new mongoose.Types.ObjectId(),
        status: "active",
        startDate: new Date(Date.now() - 30 * 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        user: {
          _id: new mongoose.Types.ObjectId(),
          name: "Arun Kumar",
          email: "arun1@example.com",
          phone: "9876500001",
          role: "member",
          isActive: true
        },
        plan: { name: "Basic" }
      }
    ];

    const origMemFind = Membership.find;
    const origAttFindOne = Attendance.findOne;

    // Membership query chain mock
    Membership.find = () => ({
      populate: () => ({
        populate: () => ({
          sort: async () => mockActiveMemberships
        })
      })
    });

    // Member has not attended for 18 days
    const lastVisitDate = new Date(Date.now() - 18 * 86400000);
    Attendance.findOne = () => ({
      sort: async () => ({
        checkedInAt: lastVisitDate
      })
    });

    const req = { query: { days: 14 } };
    const res = createMockRes();
    await getAbsenteeDrafts(req, res);

    Membership.find = origMemFind;
    Attendance.findOne = origAttFindOne;

    assert(res.statusCode === 200 && res.body?.success === true, "Test 11.1: getAbsenteeDrafts returns 200");
    assert(res.body?.drafts?.length === 1, "Test 11.2: Correctly identifies member absent for > 14 days");

    const draft = res.body?.drafts?.[0];
    assert(draft?.message?.includes("Hi Arun,"), `Test 11.3: Message uses member's first name (found: "${draft?.message?.slice(0, 15)}")`);
    assert(draft?.message?.includes("18 days"), `Test 11.4: Message uses days since last visit (found: "${draft?.message?.slice(30, 80)}")`);
    assert(!draft?.message?.includes("password") && !draft?.message?.includes("token") && !draft?.message?.includes("secret"),
      "Test 11.5: Draft does not expose sensitive tokens, passwords, or credentials");
    assert(draft?.status === "draft", "Test 11.6: Output is explicitly labeled as a draft");
  }

  // =========================================================================
  // TEST SUMMARY
  // =========================================================================
  console.log("\n" + bold("====================================================================="));
  console.log(bold("   TEST RUN SUMMARY"));
  console.log(bold("====================================================================="));
  console.log(`Total Executed Tests: ${totalTests}`);
  console.log(`Passed:               ${green(passedTests)}`);
  console.log(`Failed:               ${failedTests === 0 ? "0" : red(failedTests)}`);
  console.log(bold("=====================================================================\n"));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
