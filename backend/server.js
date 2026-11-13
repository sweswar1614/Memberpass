
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

const app = express();

// Allowed frontend origins
const allowedOrigins = [
  "https://memberpass-flax.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// Allow production, local and matching Vercel preview URLs
const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Allow Vercel preview deployments for this project
  const vercelPreviewPattern =
    /^https:\/\/memberpass-[a-zA-Z0-9-]+\.vercel\.app$/;

  return vercelPreviewPattern.test(origin);
};

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.error("CORS blocked for origin:", origin);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
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
  optionsSuccessStatus: 204,
};

// Middleware
app.use(cors(corsOptions));

// Normalization middleware in case client request contains /VITE_API_URL prefix
app.use((req, res, next) => {
  if (req.url.startsWith("/VITE_API_URL")) {
    req.url = req.url.replace(/^\/VITE_API_URL/, "") || "/";
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Primary API Routes (standard /api prefix)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/member", require("./routes/memberRoutes"));
app.use("/api/qr", require("./routes/qrRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));

// Route Aliases without /api prefix for resilient client connectivity
app.use("/auth", require("./routes/authRoutes"));
app.use("/plans", require("./routes/planRoutes"));
app.use("/payments", require("./routes/paymentRoutes"));
app.use("/member", require("./routes/memberRoutes"));
app.use("/qr", require("./routes/qrRoutes"));
app.use("/ai", require("./routes/aiRoutes"));

// Home Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to MemberPass API",
  });
});

// API Root Route
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MemberPass API Gateway",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      plans: "/api/plans",
      payments: "/api/payments",
      member: "/api/member",
      qr: "/api/qr",
      ai: "/api/ai"
    }
  });
});

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MemberPass server is running",
  });
});

// Health Check Alias
app.get("/health", (req, res) => {
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
    path: req.originalUrl,
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

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("CORS enabled for:");

      allowedOrigins.forEach((origin) => {
        console.log(`- ${origin}`);
      });

      console.log("- Matching Vercel preview deployments");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
