const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({
  path: path.join(__dirname, ".env"),
});

if (!process.env.MONGO_URI) {
  dotenv.config();
}

const connectDB = require("./config/db");
const startMembershipPauseJob = require("./jobs/membershipPauseJob");
const {
  startMembershipExpiryJob,
} = require("./jobs/membershipExpiryJob");

const app = express();

// Allowed frontend origins
const allowedOrigins = [
  "https://memberpass-flax.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    // and requests from approved frontend URLs
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS blocked for origin: ${origin}`)
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  credentials: true,
};

// Middleware
app.use(cors(corsOptions));

// Razorpay Webhook - Raw body must be available for signature verification
const { handleRazorpayWebhook } = require("./controllers/webhookController");

app.post(
  "/api/payments/webhook",
  express.raw({ type: "*/*" }),
  handleRazorpayWebhook
);

// Normal request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/member", require("./routes/memberRoutes"));
app.use("/api/qr", require("./routes/qrRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/absentees", require("./routes/absenteeRoutes"));
app.use("/api/reminders", require("./routes/reminderRoutes"));

// Home Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to MemberPass API",
  });
});

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MemberPass server is running",
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);

  if (err.message.startsWith("CORS blocked")) {
    return res.status(403).json({
      success: false,
      message: "CORS policy blocked this request",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();

    startMembershipPauseJob();
    startMembershipExpiryJob();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("CORS enabled for:");

      allowedOrigins.forEach((origin) => {
        console.log(`- ${origin}`);
      });
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();