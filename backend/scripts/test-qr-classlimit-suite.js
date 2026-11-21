/**
 * Comprehensive Automated Test Suite for:
 * - Task 7: QR Validation & Check-in
 * - Task 8: Basic Membership Class Limit (8-class max, Standard 25, Premium unlimited)
 *
 * Runs locally using Node.js, Mongoose models, and controller harnesses.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");

// Controllers and Middleware
const qrController = require("../controllers/qrController");
const memberController = require("../controllers/memberController");
const { staffOnly } = require("../middleware/staffMiddleware");

// Models
const User = require("../models/User");
const Membership = require("../models/Membership");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Payment = require("../models/Payment");

// Color helpers
const green = (msg) => `\x1b[32m✔ ${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m✘ ${msg}\x1b[0m`;
const bold = (msg) => `\x1b[1m${msg}\x1b[0m`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${green(testName)}`);
    testResults.push({ name: testName, status: "PASS", details });
  } else {
    failedTests++;
    console.error(`  ${red(testName)} - ${details}`);
    testResults.push({ name: testName, status: "FAIL", details });
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

async function runTestSuite() {
  console.log("\n" + bold("====================================================================="));
  console.log(bold("   MEMBERPASS – TASK 7 (QR CHECK-IN) & TASK 8 (CLASS LIMIT) TEST SUITE"));
  console.log(bold("=====================================================================\n"));

  const mockStaffId = new mongoose.Types.ObjectId();
  const mockMemberId = new mongoose.Types.ObjectId();
  const mockBasicPlanId = new mongoose.Types.ObjectId();
  const mockStandardPlanId = new mongoose.Types.ObjectId();
  const mockPremiumPlanId = new mongoose.Types.ObjectId();
  const mockMembershipId = new mongoose.Types.ObjectId();

  const basicPlan = {
    _id: mockBasicPlanId,
    name: "Basic",
    durationDays: 30,
    classLimit: 8,
    priceInPaise: 150000,
    isActive: true
  };

  const standardPlan = {
    _id: mockStandardPlanId,
    name: "Standard",
    durationDays: 30,
    classLimit: 25,
    priceInPaise: 300000,
    isActive: true
  };

  const premiumPlan = {
    _id: mockPremiumPlanId,
    name: "Premium",
    durationDays: 90,
    classLimit: null, // Unlimited
    priceInPaise: 750000,
    isActive: true
  };

  // -------------------------------------------------------------------------
  // SECTION 1: TASK 7 – QR VALIDATION, PERMISSIONS & CHECK-IN
  // -------------------------------------------------------------------------
  console.log(bold("▶ GROUP 1: Task 7 – Staff Authorization & QR Pass Validation"));

  // Test 7.1: Staff Authorization Middleware - Denies non-staff
  {
    const req = { user: { _id: mockMemberId, role: "member" } };
    const res = createMockRes();
    let nextCalled = false;
    staffOnly(req, res, () => { nextCalled = true; });

    assert(
      res.statusCode === 403 && !nextCalled && res.body?.message?.includes("Staff access required"),
      "Test 7.1: staffOnly middleware rejects 'member' role with 403 Forbidden"
    );
  }

  // Test 7.2: Staff Authorization Middleware - Allows staff and admin
  {
    const reqStaff = { user: { _id: mockStaffId, role: "staff" } };
    const reqAdmin = { user: { _id: mockStaffId, role: "admin" } };
    let staffAllowed = false;
    let adminAllowed = false;

    staffOnly(reqStaff, createMockRes(), () => { staffAllowed = true; });
    staffOnly(reqAdmin, createMockRes(), () => { adminAllowed = true; });

    assert(
      staffAllowed && adminAllowed,
      "Test 7.2: staffOnly middleware allows 'staff' and 'admin' roles"
    );
  }

  // Test 7.3: validateQRPass - Rejects missing passCode
  {
    const req = { body: {}, user: { _id: mockStaffId, role: "staff" } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    assert(
      res.statusCode === 400 && res.body?.entryStatus === "ENTRY_DENIED" && res.body?.reason === "Invalid QR pass data",
      "Test 7.3: validateQRPass rejects missing or non-string passCode (400 Invalid QR pass data)"
    );
  }

  // Test 7.4: validateQRPass - Rejects unrecognized passCode
  {
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => null // Member not found
    });

    const req = { body: { passCode: "INVALID_PASS_CODE_XYZ" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);
    User.findOne = origUserFindOne;

    assert(
      res.statusCode === 404 && res.body?.entryStatus === "ENTRY_DENIED" && res.body?.reason === "Pass not recognised",
      "Test 7.4: validateQRPass returns 404 ENTRY_DENIED when passCode is unrecognized"
    );
  }

  // Test 7.5: validateQRPass - Parses JSON-encoded pass payload ({ pass_code: "..." })
  {
    const testCode = "MP_TEST_JSON_CODE_123";
    const jsonPayload = JSON.stringify({ pass_code: testCode, plan: "Basic", end_date: "2026-12-31" });

    let queriedCode = null;
    const origUserFindOne = User.findOne;
    User.findOne = (query) => {
      queriedCode = query.passCode;
      return {
        select: async () => ({
          _id: mockMemberId,
          name: "Test Member",
          passCode: testCode
        })
      };
    };

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 25 * 86400000),
          classesUsed: 2,
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      sort: async () => null // Not checked in today
    });

    const req = { body: { passCode: jsonPayload }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;

    assert(
      res.statusCode === 200 &&
      queriedCode === testCode &&
      res.body?.entryStatus === "ENTRY_ALLOWED" &&
      res.body?.member?.name === "Test Member",
      "Test 7.5: validateQRPass seamlessly extracts pass_code from scanned JSON payload"
    );
  }

  // Test 7.6: validateQRPass - Rejects paused membership
  {
    const testCode = "MP_PAUSED_MEMBER";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Paused Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "paused",
          startDate: new Date(),
          endDate: new Date(Date.now() + 20 * 86400000),
          classesUsed: 2,
          plan: basicPlan
        })
      })
    });

    const req = { body: { passCode: testCode }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "Plan paused",
      "Test 7.6: validateQRPass rejects paused membership (403 ENTRY_DENIED 'Plan paused')"
    );
  }

  // Test 7.7: validateQRPass - Rejects expired membership (endDate in the past)
  {
    const testCode = "MP_EXPIRED_MEMBER";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Expired Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(Date.now() - 40 * 86400000),
          endDate: new Date(Date.now() - 5 * 86400000), // Expired 5 days ago
          classesUsed: 3,
          plan: basicPlan
        })
      })
    });

    const req = { body: { passCode: testCode }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "Plan ended",
      "Test 7.7: validateQRPass rejects expired membership (403 ENTRY_DENIED 'Plan ended')"
    );
  }

  // Test 7.8: validateQRPass - Rejects ended membership (status: "ended")
  {
    const testCode = "MP_ENDED_MEMBER";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Ended Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "ended",
          startDate: new Date(Date.now() - 30 * 86400000),
          endDate: new Date(Date.now() + 10 * 86400000),
          classesUsed: 4,
          plan: basicPlan
        })
      })
    });

    const req = { body: { passCode: testCode }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "Plan ended",
      "Test 7.8: validateQRPass rejects membership with status 'ended' (403 ENTRY_DENIED)"
    );
  }

  // Test 7.9: checkInQRPass - Successful check-in increments class usage and saves Attendance
  {
    const testCode = "MP_ACTIVE_CHECKIN";
    const checkInId = "req_checkin_79";
    let attendanceCreated = null;

    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Active Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 20 * 86400000),
          classesUsed: 3,
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({
        populate: async () => null // No existing checkInId
      }),
      sort: async () => null // Not checked in today
    });

    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async (filter, update) => ({
      _id: mockMembershipId,
      user: mockMemberId,
      status: "active",
      endDate: new Date(Date.now() + 20 * 86400000),
      classesUsed: 4, // Incremented from 3 to 4
      plan: mockBasicPlanId
    });

    const origAttCreate = Attendance.create;
    Attendance.create = async (doc) => {
      attendanceCreated = doc;
      return { _id: new mongoose.Types.ObjectId(), ...doc, checkedInAt: new Date() };
    };

    const req = { body: { passCode: testCode, checkInId }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;
    Attendance.create = origAttCreate;

    assert(
      res.statusCode === 200 &&
      res.body?.entryStatus === "ENTRY_ALLOWED" &&
      res.body?.alreadyCheckedIn === false &&
      res.body?.classesUsed === 4 &&
      res.body?.classLimit === 8 &&
      attendanceCreated?.checkInId === checkInId,
      "Test 7.9: checkInQRPass performs successful check-in, increments classesUsed (3 -> 4) & creates Attendance"
    );
  }

  // Test 7.10: checkInQRPass - Duplicate same-day check-in is allowed with NO class increment
  {
    const testCode = "MP_SAME_DAY_CHECKIN";
    const existingAttId = new mongoose.Types.ObjectId();
    let incrementCalled = false;

    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "SameDay Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 20 * 86400000),
          classesUsed: 4,
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    // Today's attendance exists
    Attendance.findOne = (query) => {
      if (query.checkInId) {
        return {
          populate: () => ({ populate: async () => null })
        };
      }
      return {
        sort: async () => ({
          _id: existingAttId,
          member: mockMemberId,
          membership: mockMembershipId,
          checkedInAt: new Date()
        })
      };
    };

    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async () => {
      incrementCalled = true;
      return null;
    };

    const req = { body: { passCode: testCode, checkInId: "req_dup_same_day" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;

    assert(
      res.statusCode === 200 &&
      res.body?.entryStatus === "ENTRY_ALLOWED" &&
      res.body?.alreadyCheckedIn === true &&
      res.body?.classesUsed === 4 &&
      incrementCalled === false &&
      res.body?.message?.includes("No extra class counted"),
      "Test 7.10: Duplicate check-in on the SAME day returns ENTRY_ALLOWED without extra class deduction"
    );
  }

  // Test 7.11: checkInQRPass - Rollback on Attendance creation failure
  {
    const testCode = "MP_ROLLBACK_TEST";
    let rollbackFilter = null;
    let rollbackUpdate = null;

    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Rollback Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 20 * 86400000),
          classesUsed: 5,
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async () => ({
      _id: mockMembershipId,
      classesUsed: 6
    });

    const origAttCreate = Attendance.create;
    Attendance.create = async () => {
      throw new Error("Simulated database write failure on Attendance record");
    };

    const origMemberUpdateOne = Membership.updateOne;
    Membership.updateOne = async (filter, update) => {
      rollbackFilter = filter;
      rollbackUpdate = update;
      return { modifiedCount: 1 };
    };

    const req = { body: { passCode: testCode, checkInId: "req_rollback_11" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;
    Attendance.create = origAttCreate;
    Membership.updateOne = origMemberUpdateOne;

    assert(
      res.statusCode === 500 &&
      rollbackFilter?._id?.toString() === mockMembershipId.toString() &&
      rollbackFilter?.classesUsed === 6 &&
      rollbackUpdate?.$inc?.classesUsed === -1,
      "Test 7.11: Failed attendance creation triggers atomic rollback: classesUsed decremented by 1"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 2: TASK 8 – BASIC (8-CLASS), STANDARD (25) & PREMIUM (UNLIMITED)
  // -------------------------------------------------------------------------
  console.log("\n" + bold("▶ GROUP 2: Task 8 – Class Limit Rules & Enforcement"));

  // Test 8.1: Basic Plan allows check-in when classesUsed < 8 (e.g. 7th class to 8th class)
  {
    const testCode = "MP_BASIC_7TH_CLASS";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Basic Member 7", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 86400000),
          classesUsed: 7, // 7 out of 8
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async (filter) => {
      if (filter.classesUsed.$lt <= 7) return null;
      return {
        _id: mockMembershipId,
        classesUsed: 8,
        endDate: new Date(Date.now() + 15 * 86400000)
      };
    };

    const origAttCreate = Attendance.create;
    Attendance.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc, checkedInAt: new Date() });

    const req = { body: { passCode: testCode, checkInId: "req_basic_8th" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;
    Attendance.create = origAttCreate;

    assert(
      res.statusCode === 200 &&
      res.body?.entryStatus === "ENTRY_ALLOWED" &&
      res.body?.classesUsed === 8 &&
      res.body?.classLimit === 8,
      "Test 8.1: Basic member at 7 classes can attend their 8th class (classesUsed reaches 8/8)"
    );
  }

  // Test 8.2: validateQRPass blocks Basic Member at 8/8 classes (9th class attempt)
  {
    const testCode = "MP_BASIC_8TH_FULL";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Basic Full Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 86400000),
          classesUsed: 8, // Limit reached
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      sort: async () => null // Not checked in today
    });

    const req = { body: { passCode: testCode }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.validateQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "8-class limit reached" &&
      res.body?.member?.classesUsed === 8 &&
      res.body?.member?.classLimit === 8,
      "Test 8.2: validateQRPass rejects attempted 9th class for Basic member (403 '8-class limit reached')"
    );
  }

  // Test 8.3: checkInQRPass blocks attempted 9th class for Basic member
  {
    const testCode = "MP_BASIC_8TH_CHECKIN_BLOCK";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Basic Full Member", passCode: testCode })
    });

    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 86400000),
          classesUsed: 8,
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    const req = { body: { passCode: testCode, checkInId: "req_attempt_9th" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "8-class limit reached",
      "Test 8.3: checkInQRPass blocks attempted 9th class with 403 ENTRY_DENIED '8-class limit reached'"
    );
  }

  // Test 8.4: Concurrency / API Bypass Protection on Class Limit
  {
    const testCode = "MP_BYPASS_PROTECTION";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Bypass Protected Member", passCode: testCode })
    });

    // Simulate membership record where classesUsed is 7, but concurrent thread incremented it to 8
    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 86400000),
          classesUsed: 7, // Controller thought it was 7
          plan: basicPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    // DB atomic condition fails because DB state was already incremented to 8
    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async () => null;

    const req = { body: { passCode: testCode, checkInId: "req_concurrent_race" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;

    assert(
      res.statusCode === 409 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason?.includes("class limit reached"),
      "Test 8.4: Atomic findOneAndUpdate filter {$lt: 8} prevents class limit bypass under concurrency (409)"
    );
  }

  // Test 8.5: Standard Membership 25-Class Limit Enforcement
  {
    const testCode = "MP_STANDARD_25TH";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "Standard Member", passCode: testCode })
    });

    // Standard member at 25 classes
    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 86400000),
          classesUsed: 25,
          plan: standardPlan
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    const req = { body: { passCode: testCode, checkInId: "req_standard_26th" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;

    assert(
      res.statusCode === 403 &&
      res.body?.entryStatus === "ENTRY_DENIED" &&
      res.body?.reason === "25-class limit reached",
      "Test 8.5: Standard plan 25-class limit is enforced: 26th class blocked (403 '25-class limit reached')"
    );
  }

  // Test 8.6: Premium Membership Remains Unlimited (no class cap)
  {
    const testCode = "MP_PREMIUM_UNLIMITED";
    const origUserFindOne = User.findOne;
    User.findOne = () => ({
      select: async () => ({ _id: mockMemberId, name: "VIP Premium Member", passCode: testCode })
    });

    // Premium member who already attended 50 classes
    const origMemberFindOne = Membership.findOne;
    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 60 * 86400000),
          classesUsed: 50,
          plan: premiumPlan // classLimit: null
        })
      })
    });

    const origAttFindOne = Attendance.findOne;
    Attendance.findOne = () => ({
      populate: () => ({ populate: async () => null }),
      sort: async () => null
    });

    let filterChecked = null;
    const origMemberFindOneAndUpdate = Membership.findOneAndUpdate;
    Membership.findOneAndUpdate = async (filter) => {
      filterChecked = filter;
      return {
        _id: mockMembershipId,
        classesUsed: 51,
        endDate: new Date(Date.now() + 60 * 86400000)
      };
    };

    const origAttCreate = Attendance.create;
    Attendance.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc, checkedInAt: new Date() });

    const req = { body: { passCode: testCode, checkInId: "req_premium_51st" }, user: { _id: mockStaffId } };
    const res = createMockRes();
    await qrController.checkInQRPass(req, res);

    User.findOne = origUserFindOne;
    Membership.findOne = origMemberFindOne;
    Attendance.findOne = origAttFindOne;
    Membership.findOneAndUpdate = origMemberFindOneAndUpdate;
    Attendance.create = origAttCreate;

    assert(
      res.statusCode === 200 &&
      res.body?.entryStatus === "ENTRY_ALLOWED" &&
      res.body?.classesUsed === 51 &&
      res.body?.classLimit === null &&
      filterChecked.classesUsed?.$lt === undefined,
      "Test 8.6: Premium membership remains unlimited: allows 51st class check-in with classLimit: null"
    );
  }

  // Test 8.7: Member Profile & Dashboard displays accurate class remaining and utilization
  {
    const origUserFindById = User.findById;
    const origMemberFindOne = Membership.findOne;
    const origPaymentFind = Payment.find;

    User.findById = () => ({
      select: async () => ({
        _id: mockMemberId,
        name: "Basic Member",
        email: "basic@example.com",
        role: "member",
        passCode: "MP_BASIC_PROFILE"
      })
    });

    Membership.findOne = () => ({
      populate: () => ({
        sort: async () => ({
          _id: mockMembershipId,
          user: mockMemberId,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 20 * 86400000),
          classesUsed: 6,
          plan: basicPlan
        })
      })
    });

    Payment.find = () => ({
      populate: () => ({
        sort: () => ({
          limit: async () => []
        })
      })
    });

    const req = { user: { _id: mockMemberId } };
    const res = createMockRes();
    await memberController.getMemberProfile(req, res);

    User.findById = origUserFindById;
    Membership.findOne = origMemberFindOne;
    Payment.find = origPaymentFind;

    assert(
      res.statusCode === 200 &&
      res.body?.member?.membership?.classesUsed === 6 &&
      res.body?.member?.membership?.classesRemaining === 2 && // 8 - 6 = 2 remaining
      res.body?.member?.membership?.plan?.classLimit === 8,
      "Test 8.7: Member profile returns accurate classesUsed (6) and classesRemaining (2) for Basic plan"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 3: ATTENDANCE HISTORY TESTS
  // -------------------------------------------------------------------------
  console.log("\n" + bold("▶ GROUP 3: Attendance History Integration"));

  // Test 7.12: getAttendanceHistory (Staff) - Lists recent check-ins
  {
    const origAttFind = Attendance.find;
    Attendance.find = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            sort: () => ({
              limit: () => ({
                lean: async () => [
                  {
                    _id: new mongoose.Types.ObjectId(),
                    member: { name: "Arun Kumar", email: "arun1@example.com" },
                    membership: { plan: { name: "Basic" }, classesUsed: 4 },
                    staff: { name: "Studio Staff" },
                    checkedInAt: new Date("2026-11-21T09:00:00Z")
                  }
                ]
              })
            })
          })
        })
      })
    });

    const req = { user: { _id: mockStaffId, role: "staff" } };
    const res = createMockRes();
    await qrController.getAttendanceHistory(req, res);
    Attendance.find = origAttFind;

    assert(
      res.statusCode === 200 &&
      res.body?.count === 1 &&
      res.body?.history[0]?.memberName === "Arun Kumar" &&
      res.body?.history[0]?.planName === "Basic" &&
      res.body?.history[0]?.classesUsed === 4,
      "Test 7.12: getAttendanceHistory returns staff audit history with member, plan, and classesUsed"
    );
  }

  // Test 7.13: getMyAttendanceHistory (Member) - Lists personal attendance
  {
    const origAttFind = Attendance.find;
    Attendance.find = () => ({
      populate: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => [
                {
                  _id: new mongoose.Types.ObjectId(),
                  membership: { plan: { name: "Basic" } },
                  staff: { name: "Front Desk" },
                  checkedInAt: new Date("2026-11-21T09:00:00Z")
                }
              ]
            })
          })
        })
      })
    });

    const req = { user: { _id: mockMemberId, role: "member" } };
    const res = createMockRes();
    await qrController.getMyAttendanceHistory(req, res);
    Attendance.find = origAttFind;

    assert(
      res.statusCode === 200 &&
      res.body?.count === 1 &&
      res.body?.history[0]?.planName === "Basic",
      "Test 7.13: getMyAttendanceHistory returns personal check-in records for authenticated member"
    );
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n" + bold("====================================================================="));
  console.log(bold("   TEST RUN SUMMARY"));
  console.log(bold("====================================================================="));
  console.log(`Total Executed Tests: ${totalTests}`);
  console.log(`Passed:               ${green(passedTests.toString())}`);
  console.log(`Failed:               ${failedTests > 0 ? red(failedTests.toString()) : "0"}`);
  console.log(bold("=====================================================================\n"));

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution threw uncaught error:", err);
  process.exit(1);
});
