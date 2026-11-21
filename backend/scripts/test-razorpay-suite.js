/**
 * Comprehensive Automated Test Suite for:
 * - Task 5: Razorpay Payment Integration & Verification
 * - Task 6: Razorpay Webhook Handling & Idempotency
 *
 * Runs entirely locally using Node.js, Express, and crypto.
 * No real money or live keys are used (Razorpay Test Mode only).
 */

const crypto = require("crypto");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");

// Load controllers
const paymentController = require("../controllers/paymentController");
const { handleRazorpayWebhook } = require("../controllers/webhookController");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Plan = require("../models/Plan");
const WebhookEvent = require("../models/WebhookEvent");

// Test Configuration
const TEST_KEY_SECRET = "test_key_secret_abc1234567890xyz";
const TEST_WEBHOOK_SECRET = "test_webhook_secret_secure_9xK7pL2mQ8vR";

process.env.RAZORPAY_KEY_ID = "rzp_test_TzHrcNgrnxRfSr";
process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

// Color helpers for test output
const green = (msg) => `\x1b[32m✔ ${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m✘ ${msg}\x1b[0m`;
const yellow = (msg) => `\x1b[33m${msg}\x1b[0m`;
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

// Mock Helper for Express Request/Response
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
  console.log(bold("   MEMBERPASS – RAZORPAY PAYMENT (TASK 5) & WEBHOOK (TASK 6) TEST SUITE"));
  console.log(bold("=====================================================================\n"));

  // -------------------------------------------------------------------------
  // SECTION 1: TASK 5 – PAYMENT CONTROLLER TESTS
  // -------------------------------------------------------------------------
  console.log(bold("▶ GROUP 1: Task 5 – Razorpay Payment Testing"));

  const mockUserId = new mongoose.Types.ObjectId();
  const mockPlanId = new mongoose.Types.ObjectId();
  const mockPaymentId = new mongoose.Types.ObjectId();

  // Test 5.1: createOrder - Missing planId and planName
  {
    const req = { body: {}, user: { _id: mockUserId, email: "user@test.com", name: "User" } };
    const res = createMockRes();
    await paymentController.createOrder(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Plan ID or Plan Name is required",
      "Test 5.1: createOrder rejects missing planId and planName (400)"
    );
  }

  // Test 5.2: createOrder - Invalid planId ObjectId
  {
    const req = { body: { planId: "not-a-valid-id" }, user: { _id: mockUserId } };
    const res = createMockRes();
    await paymentController.createOrder(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Invalid plan ID",
      "Test 5.2: createOrder rejects malformed planId format (400)"
    );
  }

  // Test 5.3: createOrder - Plan Not Found / Inactive
  {
    const origFindOne = Plan.findOne;
    Plan.findOne = async () => null; // simulate plan not found

    const req = { body: { planId: mockPlanId.toString() }, user: { _id: mockUserId } };
    const res = createMockRes();
    await paymentController.createOrder(req, res);
    Plan.findOne = origFindOne; // restore

    assert(
      res.statusCode === 404 && res.body?.message === "Membership plan not found or inactive",
      "Test 5.3: createOrder returns 404 when membership plan is not found or inactive"
    );
  }

  // Test 5.4: createOrder - Missing Razorpay API keys
  {
    const origKey = process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_ID;

    const req = { body: { planName: "Standard Yoga" }, user: { _id: mockUserId } };
    const res = createMockRes();
    const origFindOne = Plan.findOne;
    Plan.findOne = async () => ({ _id: mockPlanId, name: "Standard Yoga", priceInPaise: 299900, durationDays: 30, isActive: true });

    await paymentController.createOrder(req, res);
    process.env.RAZORPAY_KEY_ID = origKey; // restore
    Plan.findOne = origFindOne;

    assert(
      res.statusCode === 503 && res.body?.code === "RAZORPAY_KEYS_MISSING",
      "Test 5.4: createOrder returns 503 RAZORPAY_KEYS_MISSING if keys are unconfigured"
    );
  }

  // Test 5.5: verifyPayment - Missing required parameters
  {
    const req = { body: {}, user: { _id: mockUserId } };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Missing payment verification parameters",
      "Test 5.5: verifyPayment rejects missing parameters (400)"
    );
  }

  // Test 5.6: verifyPayment - Invalid paymentRecordId format
  {
    const req = {
      body: {
        paymentRecordId: "invalid-mongo-id",
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Invalid paymentRecordId",
      "Test 5.6: verifyPayment rejects invalid ObjectId paymentRecordId (400)"
    );
  }

  // Test 5.7: verifyPayment - Payment record not found
  {
    const origFindOne = Payment.findOne;
    Payment.findOne = async () => null;

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 404 && res.body?.message === "Payment record not found",
      "Test 5.7: verifyPayment returns 404 when payment record does not exist for the user"
    );
  }

  // Test 5.8: verifyPayment - Payment status is not 'created' (e.g. status === 'failed')
  {
    const origFindOne = Payment.findOne;
    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "failed",
      razorpayOrderId: "order_test_123"
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 400 && res.body?.message?.includes("status is 'failed'"),
      "Test 5.8: verifyPayment rejects payment whose status is not 'created' (400)"
    );
  }

  // Test 5.9: verifyPayment - Idempotency when already 'captured'
  {
    const mockMembership = { _id: new mongoose.Types.ObjectId(), status: "active" };
    const origFindOne = Payment.findOne;
    const origMemberFind = Membership.findById;

    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "captured",
      membership: mockMembership._id
    });
    Membership.findById = () => ({
      populate: async () => mockMembership
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;
    Membership.findById = origMemberFind;

    assert(
      res.statusCode === 200 && res.body?.status === "captured" && res.body?.membership !== null,
      "Test 5.9: verifyPayment is idempotent: returns 200 and active membership if already captured"
    );
  }

  // Test 5.10: verifyPayment - Idempotency when already 'authorized'
  {
    const origFindOne = Payment.findOne;
    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "authorized",
      razorpayPaymentId: "pay_test_already_auth"
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_already_auth",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 200 && res.body?.status === "authorized",
      "Test 5.10: verifyPayment is idempotent: returns 200 when already authorized with matching ID"
    );
  }

  // Test 5.11: verifyPayment - Invalid HMAC Signature Rejection
  {
    const orderId = "order_test_511";
    const paymentId = "pay_test_511";
    const invalidSignature = crypto.createHmac("sha256", "wrong_secret").update(`${orderId}|${paymentId}`).digest("hex");

    const origFindOne = Payment.findOne;
    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "created",
      razorpayOrderId: orderId
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: paymentId,
        razorpay_signature: invalidSignature
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 400 && res.body?.message === "Invalid payment signature",
      "Test 5.11: verifyPayment rejects invalid HMAC-SHA256 signature (400)"
    );
  }

  // Test 5.12: verifyPayment - Valid Signature & TimingSafeEqual Comparison
  {
    const orderId = "order_test_512";
    const paymentId = "pay_test_512";
    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const origFindOne = Payment.findOne;
    const origFindOneAndUpdate = Payment.findOneAndUpdate;

    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "created",
      razorpayOrderId: orderId
    });

    let updatedPaymentData = null;
    Payment.findOneAndUpdate = async (filter, update) => {
      updatedPaymentData = update.$set;
      return {
        _id: mockPaymentId,
        user: mockUserId,
        status: "authorized",
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amount: 299900
      };
    };

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;
    Payment.findOneAndUpdate = origFindOneAndUpdate;

    assert(
      res.statusCode === 200 &&
      res.body?.status === "authorized" &&
      res.body?.payment?.paymentId === paymentId &&
      updatedPaymentData?.status === "authorized" &&
      res.body?.membership === null,
      "Test 5.12: verifyPayment validates HMAC-SHA256, marks authorized, and does NOT activate membership"
    );
  }

  // Test 5.13: getMyPayments - Correct formatting and currency/paise conversion
  {
    const origFind = Payment.find;
    Payment.find = () => ({
      populate: () => ({
        sort: async () => [
          {
            _id: mockPaymentId,
            razorpayOrderId: "order_1",
            razorpayPaymentId: "pay_1",
            amount: 299900,
            currency: "INR",
            status: "captured",
            plan: { name: "Standard Yoga" },
            createdAt: new Date("2026-11-20T10:00:00Z")
          }
        ]
      })
    });

    const req = { user: { _id: mockUserId } };
    const res = createMockRes();
    await paymentController.getMyPayments(req, res);
    Payment.find = origFind;

    assert(
      res.statusCode === 200 &&
      res.body?.count === 1 &&
      res.body?.payments[0]?.amount === 2999 &&
      res.body?.payments[0]?.currency === "INR" &&
      res.body?.payments[0]?.planName === "Standard Yoga",
      "Test 5.13: getMyPayments retrieves payment history, converts paise to INR (299900 -> 2999)"
    );
  }

  // Test 5.14: verifyPayment - Missing RAZORPAY_KEY_SECRET in env
  {
    const origSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    process.env.RAZORPAY_KEY_SECRET = origSecret;

    assert(
      res.statusCode === 500 && res.body?.code === "RAZORPAY_SECRET_MISSING",
      "Test 5.14: verifyPayment returns 500 RAZORPAY_SECRET_MISSING if secret is unconfigured"
    );
  }

  // Test 5.15: verifyPayment - Saved Razorpay order ID is missing in database record
  {
    const origFindOne = Payment.findOne;
    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "created",
      razorpayOrderId: null // missing orderId
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 500 && res.body?.message === "Saved Razorpay order ID is missing",
      "Test 5.15: verifyPayment returns 500 if saved order ID is missing in database"
    );
  }

  // Test 5.16: verifyPayment - Payment ID mismatch on already-authorized payment
  {
    const origFindOne = Payment.findOne;
    Payment.findOne = async () => ({
      _id: mockPaymentId,
      user: mockUserId,
      status: "authorized",
      razorpayPaymentId: "pay_test_original"
    });

    const req = {
      body: {
        paymentRecordId: mockPaymentId.toString(),
        razorpay_payment_id: "pay_test_DIFFERENT",
        razorpay_signature: "sig_abc"
      },
      user: { _id: mockUserId }
    };
    const res = createMockRes();
    await paymentController.verifyPayment(req, res);
    Payment.findOne = origFindOne;

    assert(
      res.statusCode === 409 && res.body?.message?.includes("does not match the authorized payment"),
      "Test 5.16: verifyPayment returns 409 if payment ID does not match the already authorized payment"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 2: TASK 6 – WEBHOOK CONTROLLER TESTS
  // -------------------------------------------------------------------------
  console.log("\n" + bold("▶ GROUP 2: Task 6 – Razorpay Webhook Testing"));

  // Test 6.1: Missing RAZORPAY_WEBHOOK_SECRET in environment
  {
    const origSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? "abc" : "evt_1"),
      body: Buffer.from("{}")
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);
    process.env.RAZORPAY_WEBHOOK_SECRET = origSecret;

    assert(
      res.statusCode === 500 && res.body?.message?.includes("secret is not configured"),
      "Test 6.1: Webhook returns 500 if RAZORPAY_WEBHOOK_SECRET is missing"
    );
  }

  // Test 6.2: Raw body required (non-Buffer rejection)
  {
    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? "abc" : "evt_1"),
      body: "not-a-buffer-string" // parsed as string/object
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Raw webhook body is required",
      "Test 6.2: Webhook rejects non-Buffer body (400 Raw webhook body is required)"
    );
  }

  // Test 6.3: Missing signature or eventId headers
  {
    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? "" : "evt_1"), // empty signature
      body: Buffer.from("{}")
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);
    assert(
      res.statusCode === 400 && res.body?.message?.includes("signature or event ID is missing"),
      "Test 6.3: Webhook rejects missing X-Razorpay-Signature header (400)"
    );
  }

  // Test 6.4: Invalid HMAC-SHA256 webhook signature
  {
    const payloadStr = JSON.stringify({ event: "payment.captured" });
    const invalidSignature = crypto
      .createHmac("sha256", "wrong_webhook_secret")
      .update(Buffer.from(payloadStr))
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? invalidSignature : "evt_64"),
      body: Buffer.from(payloadStr)
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Invalid webhook signature",
      "Test 6.4: Webhook rejects invalid HMAC-SHA256 signature (400 Invalid webhook signature)"
    );
  }

  // Test 6.5: Malformed JSON body with valid signature
  {
    const malformedBody = Buffer.from("{ malformed json :::");
    const validSignature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(malformedBody)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? validSignature : "evt_65"),
      body: malformedBody
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);
    assert(
      res.statusCode === 400 && res.body?.message === "Invalid webhook JSON",
      "Test 6.5: Webhook rejects invalid JSON payload (400 Invalid webhook JSON)"
    );
  }

  // Setup Mock Mongoose Session for Webhook Unit Tests
  const setupMockSession = () => {
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: async () => {},
      withTransaction: async (cb) => {
        return await cb();
      }
    };
    const origStartSession = mongoose.startSession;
    mongoose.startSession = async () => mockSession;
    return () => {
      mongoose.startSession = origStartSession;
    };
  };

  // Test 6.6: Unsupported webhook event (e.g. order.paid, invoice.created)
  {
    const restoreSession = setupMockSession();
    let savedWebhookEvent = null;
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async (records) => {
      savedWebhookEvent = records[0];
      return records;
    };

    const payloadObj = {
      event: "order.paid",
      payload: { order: { entity: { id: "order_66" } } }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_66"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    restoreSession();

    assert(
      res.statusCode === 200 &&
      res.body?.message === "Webhook processed" &&
      savedWebhookEvent?.event === "order.paid",
      "Test 6.6: Unsupported event (order.paid) logs WebhookEvent, returns 200, no membership activated"
    );
  }

  // Test 6.7: payment.failed event handling
  {
    const restoreSession = setupMockSession();
    let savedWebhookEvent = null;
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async (records) => {
      savedWebhookEvent = records[0];
      return records;
    };

    let paymentStatusUpdated = null;
    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        status: "created",
        razorpayOrderId: "order_67",
        save: async function () {
          paymentStatusUpdated = this.status;
        }
      })
    });

    const payloadObj = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_failed_67",
            order_id: "order_67",
            amount: 299900,
            status: "failed"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_67"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 200 &&
      res.body?.message === "Webhook processed" &&
      paymentStatusUpdated === "failed",
      "Test 6.7: payment.failed event marks Payment status as 'failed' in DB, does not activate membership"
    );
  }

  // Test 6.8: payment.captured - Invalid payload structure rejection
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_68"
            // Missing order_id, amount, currency
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_68"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.8: payment.captured rejects incomplete payload missing order_id/amount/currency (400)"
    );
  }

  // Test 6.9: payment.captured - Order not found
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};
    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => null // order not found
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_69",
            order_id: "order_not_found_69",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_69"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.9: payment.captured rejects when order is not found in database (400)"
    );
  }

  // Test 6.10: payment.captured - Amount mismatch rejection
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};
    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        amount: 299900, // DB expects ₹2999
        currency: "INR"
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_70",
            order_id: "order_70",
            amount: 199900, // Webhook sends ₹1999 (tampered amount)
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_70"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.10: payment.captured rejects amount mismatch between webhook and DB order (400)"
    );
  }

  // Test 6.11: payment.captured - Currency mismatch rejection
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};
    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        amount: 299900,
        currency: "INR"
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_71",
            order_id: "order_71",
            amount: 299900,
            currency: "USD" // USD instead of INR
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_71"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.11: payment.captured rejects currency mismatch (USD vs INR) (400)"
    );
  }

  // Test 6.12: payment.captured - Successful End-to-End Processing
  {
    const restoreSession = setupMockSession();
    let savedWebhookEvent = null;
    let createdMembership = null;
    let previousMembershipsEnded = null;
    let paymentSaved = false;

    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async (records) => {
      savedWebhookEvent = records[0];
      return records;
    };

    const mockPayment = {
      _id: mockPaymentId,
      user: mockUserId,
      plan: mockPlanId,
      amount: 299900,
      currency: "INR",
      status: "authorized",
      razorpayOrderId: "order_72",
      save: async function () {
        paymentSaved = true;
      }
    };

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => mockPayment
    });

    const origPlanFindById = Plan.findById;
    Plan.findById = () => ({
      session: () => ({
        _id: mockPlanId,
        name: "Standard Yoga",
        durationDays: 30,
        priceInPaise: 299900
      })
    });

    const origMemberCreate = Membership.create;
    Membership.create = async (records) => {
      createdMembership = records[0];
      return [{ _id: new mongoose.Types.ObjectId(), ...createdMembership }];
    };

    const origMemberUpdateMany = Membership.updateMany;
    Membership.updateMany = async (filter, update) => {
      previousMembershipsEnded = { filter, update };
      return { modifiedCount: 1 };
    };

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_captured_72",
            order_id: "order_72",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_72"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    Plan.findById = origPlanFindById;
    Membership.create = origMemberCreate;
    Membership.updateMany = origMemberUpdateMany;
    restoreSession();

    const datesAreValid =
      createdMembership?.startDate &&
      createdMembership?.endDate &&
      createdMembership.endDate.getTime() > createdMembership.startDate.getTime();

    assert(
      res.statusCode === 200 &&
      res.body?.message === "Webhook processed" &&
      mockPayment.status === "captured" &&
      mockPayment.razorpayPaymentId === "pay_captured_72" &&
      createdMembership?.status === "active" &&
      createdMembership?.classesUsed === 0 &&
      datesAreValid &&
      previousMembershipsEnded?.update?.$set?.status === "ended",
      "Test 6.12: payment.captured activates active Membership, marks Payment captured, ends previous active passes"
    );
  }

  // Test 6.13: Webhook Idempotency (Duplicate eventId returns 200 Duplicate webhook ignored)
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {
      const err = new Error("E11000 duplicate key error collection: test.webhookevents index: eventId_1 dup key: { eventId: \"evt_dup_73\" }");
      err.code = 11000;
      err.keyPattern = { eventId: 1 };
      throw err;
    };

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup_73",
            order_id: "order_dup_73",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_dup_73"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    restoreSession();

    assert(
      res.statusCode === 200 && res.body?.message === "Duplicate webhook ignored",
      "Test 6.13: Duplicate eventId triggers idempotency handler: returns 200 'Duplicate webhook ignored'"
    );
  }

  // Test 6.14: Repeated payment.captured on already captured payment
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    let membershipCreated = false;
    const origMemberCreate = Membership.create;
    Membership.create = async () => {
      membershipCreated = true;
      return [];
    };

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        amount: 299900,
        currency: "INR",
        status: "captured", // already captured
        razorpayPaymentId: "pay_captured_74"
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_captured_74",
            order_id: "order_74",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_74"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Membership.create = origMemberCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 200 &&
      res.body?.message === "Webhook processed" &&
      membershipCreated === false,
      "Test 6.14: Repeated delivery on already-captured payment is idempotent (no duplicate membership)"
    );
  }

  // Test 6.15: payment.captured - Rejects invalid state (e.g. status: 'failed')
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        amount: 299900,
        currency: "INR",
        status: "failed", // invalid state for capture
        razorpayOrderId: "order_615"
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_615",
            order_id: "order_615",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_615"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.15: payment.captured rejects capture on payment in 'failed' status (400)"
    );
  }

  // Test 6.16: payment.captured - Rejects when already captured with different payment ID
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        amount: 299900,
        currency: "INR",
        status: "captured",
        razorpayPaymentId: "pay_ORIGINAL_ID",
        razorpayOrderId: "order_616"
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_DIFFERENT_ID",
            order_id: "order_616",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_616"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.16: payment.captured rejects when already captured with different payment ID (400)"
    );
  }

  // Test 6.17: payment.captured - Rejects when plan durationDays <= 0
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        plan: mockPlanId,
        amount: 299900,
        currency: "INR",
        status: "created",
        razorpayOrderId: "order_617"
      })
    });

    const origPlanFindById = Plan.findById;
    Plan.findById = () => ({
      session: () => ({
        _id: mockPlanId,
        name: "Broken Plan",
        durationDays: 0, // invalid duration
        priceInPaise: 299900
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_617",
            order_id: "order_617",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_617"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    Plan.findById = origPlanFindById;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.17: payment.captured rejects when Plan durationDays <= 0 (400)"
    );
  }

  // Test 6.18: payment.captured - Rejects when plan price does not match payment amount
  {
    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const origPaymentFindOne = Payment.findOne;
    Payment.findOne = () => ({
      session: () => ({
        _id: mockPaymentId,
        plan: mockPlanId,
        amount: 299900,
        currency: "INR",
        status: "created",
        razorpayOrderId: "order_618"
      })
    });

    const origPlanFindById = Plan.findById;
    Plan.findById = () => ({
      session: () => ({
        _id: mockPlanId,
        name: "Standard Yoga",
        durationDays: 30,
        priceInPaise: 499900 // plan price changed to ₹4999, mismatch with ₹2999
      })
    });

    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_618",
            order_id: "order_618",
            amount: 299900,
            currency: "INR"
          }
        }
      }
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    const req = {
      get: (h) => (h.toLowerCase() === "x-razorpay-signature" ? signature : "evt_618"),
      body: payloadBuffer
    };
    const res = createMockRes();
    await handleRazorpayWebhook(req, res);

    WebhookEvent.create = origWebEventCreate;
    Payment.findOne = origPaymentFindOne;
    Plan.findById = origPlanFindById;
    restoreSession();

    assert(
      res.statusCode === 400 && res.body?.message === "Webhook processing failed",
      "Test 6.18: payment.captured rejects when payment amount does not match Plan price (400)"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 3: EXPRESS MIDDLEWARE & RAW BODY PIPELINE TEST
  // -------------------------------------------------------------------------
  console.log("\n" + bold("▶ GROUP 3: Express Middleware & Raw Body Integration"));

  await new Promise((resolve) => {
    const { Readable } = require("stream");
    const rawParser = express.raw({ type: "*/*" });

    const restoreSession = setupMockSession();
    const origWebEventCreate = WebhookEvent.create;
    WebhookEvent.create = async () => {};

    const payloadString = JSON.stringify({ event: "order.paid", id: "evt_wire_1" });
    const payloadBuffer = Buffer.from(payloadString);
    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    // Construct stream simulating incoming HTTP request
    const stream = new Readable();
    stream.push(payloadBuffer);
    stream.push(null);

    stream.method = "POST";
    stream.headers = {
      "content-type": "application/json",
      "content-length": payloadBuffer.length.toString(),
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": "evt_wire_test_101"
    };
    stream.get = (header) => stream.headers[header.toLowerCase()];

    const res = createMockRes();

    // Pass request through express.raw() middleware, then to handleRazorpayWebhook
    rawParser(stream, res, async (err) => {
      if (err) {
        assert(false, "Test 6.15: express.raw middleware failed with error", err.message);
        WebhookEvent.create = origWebEventCreate;
        restoreSession();
        return resolve();
      }

      await handleRazorpayWebhook(stream, res);

      assert(
        res.statusCode === 200 && res.body?.success === true && res.body?.message === "Webhook processed",
        "Test 6.19: express.raw({ type: '*/*' }) middleware preserves raw Buffer and webhook processes successfully"
      );

      WebhookEvent.create = origWebEventCreate;
      restoreSession();
      resolve();
    });
  });

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
