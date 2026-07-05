/**
 * ========================================
 * Indian Fresher & Internship Portal
 
 * ========================================
 * Main Application Server
 * Handles all API endpoints and static file serving
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------------------------------
   Load Environment Variables FIRST
--------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// your .env is in project root (nodejs_finaledit/.env)
dotenv.config({ path: path.join(__dirname, "../.env") });

/* ---------------------------------------
   Now import other modules
--------------------------------------- */

import express from "express";
import fs from "fs";
import cookieParser from "cookie-parser";

// Middleware
import corsMiddleware from "./middleware/corsMiddleware.js";
import upload from "./middleware/uploadMiddleware.js";

// Routes
import authRoutes from "./routes/auth.js";
import resumeRoutes from "./routes/resume.js";
import jobRoutes from "./routes/jobs.js";
import liveJobRoutes from "./routes/liveJobs.js";
import statisticsRoutes from "./routes/statistics.js";
import atsRoutes from "./routes/ats.js";

/* ---------------------------------------
   Initialize Express
--------------------------------------- */

const app = express();

/* ---------------------------------------
   Serve Frontend
--------------------------------------- */

const publicDir = path.join(__dirname, "../../frontend/public");
app.use(express.static(publicDir));

/* ---------------------------------------
   GLOBAL MIDDLEWARE
--------------------------------------- */

app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------------------------------
   HEALTH CHECK
--------------------------------------- */

app.get("/", (req, res) => {

  const indexFile = path.join(publicDir, "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.status(200).json({
    status: "ok",
    message: "🎓 Indian Fresher & Internship Portal - Backend API",
    endpoints: {
      resume: "POST /api/resume/analyze",
      jobs: "GET /api/jobs",
      statistics: "GET /api/statistics",
      ats: "POST /api/ats/check",
      liveJobs: "GET /api/live-jobs"
    }
  });

});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

/* ---------------------------------------
   ROUTES
--------------------------------------- */

// Authentication
app.use("/api/auth", authRoutes);

// Resume Analysis
app.use("/api/resume", upload.single("resume"), resumeRoutes);

// Job Management
app.use("/api/jobs", jobRoutes);

// Live Jobs
app.use("/api/live-jobs", liveJobRoutes);

// Statistics
app.use("/api/statistics", statisticsRoutes);

// ATS Checker
app.use("/api/ats", upload.single("resume"), atsRoutes);

/* ---------------------------------------
   ERROR HANDLER
--------------------------------------- */

app.use((err, req, res, next) => {

  console.error("Server Error:", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });

});

/* ---------------------------------------
   START SERVER
--------------------------------------- */

function startServer() {

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {

    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║     🎓 Indian Fresher & Internship Portal                 ║");
    console.log("║     Final Year Project - Resume Analyzer & Job Matcher    ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("\n");

    console.log(`✅ Server running at: http://localhost:${PORT}`);
    console.log(`📊 Database: PostgreSQL (ats_portal)`);
    console.log(`🗄️  Connected to ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log("\n");

    console.log("API ENDPOINTS:");
    console.log("  🏥 GET    /");
    console.log("  🏥 GET    /api/health");
    console.log("  📄 POST   /api/resume/analyze");
    console.log("  💼 GET    /api/jobs");
    console.log("  💼 POST   /api/jobs");
    console.log("  💼 DELETE /api/jobs/:id");
    console.log("  🔴 GET    /api/live-jobs");
    console.log("  📊 GET    /api/statistics");
    console.log("  ✅ POST   /api/ats/check");
    console.log("  ✅ POST   /api/ats/check-text");
    console.log("  ✅ POST   /api/ats/compare-job");

    console.log("\n");

  });

}

startServer();

export default app;