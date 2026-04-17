// server/server.js or server/index.js
import "dotenv/config";
import express from 'express';
import cors from "cors";
import connectDB from './config/db.js';
import { spawn as spawnProcess } from 'child_process';
import fs from 'fs';

import path from "path";
import { fileURLToPath } from "url";
import router from './routes/productRoutes.js';
import removebgrouter from './routes/removeBg.route.js';
import designrouter from './routes/designRoutes.js';
import designsrouters from './routes/uploadDesignRoutes.js';
import authrouter from './routes/auth.js';

import adminrouter from './routes/admincontrols.js';
import readymadeproducts from './routes/readymadeProduct.routes.js';
import cartrouter from './routes/cartRoutes.js';
import homepagerouter from './routes/Homepagerouter.js';
import designuploadsrouter from './routes/designuploadsrouter.js';
import droprouter from './routes/dropproduct.routes.js';
import caliberateroutes from './routes/mockupCalibrationRoutes.js';
import designsizeselection from './routes/designsizeselectionroute.js';
import addressroute from './routes/addressroutes.js';
import paymentrouter from './routes/paymentRoutes.js';
import orderroutes from './routes/orderRoutes.js';
import admincategory from './routes/adminCategoryRoutes.js';
import exportrouter from './routes/exportRoutes.js';
import emailrouter from './routes/emailroute.js';
import searchproductroute from './routes/searchproduct.js';
import invoicerouter from './routes/invoiceroutes.js';
import brandroute from './routes/brandroute.js';
import couponRouter from "./routes/couponRoutes.js";
import headerBannerRouter from "./routes/headerBannerRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";

import colorselection from './routes/adminColorRoutes.js';
import companypdfs from './routes/companyPdfRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
connectDB();

const app = express();
const outputsDir = path.join(__dirname, "outputs");
const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://maitrova.in",
  "https://maitrova.in",
  "http://www.maitrova.in",
  "https://www.maitrova.in",
];
const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredCorsOrigins.length
  ? configuredCorsOrigins
  : defaultCorsOrigins;

// Middleware
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

  app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});


// Static files - direct image access with long-lived caching
const staticOutputs = express.static(outputsDir, {
  maxAge: "365d",
  etag: true,
  immutable: true,
  index: false,
  setHeaders: (res, filePath) => {
    if (/\.(avif|webp|png|jpe?g|gif|svg|mp4|webm)$/i.test(filePath)) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable, stale-while-revalidate=86400"
      );
    }
  },
});

// app.use("/outputs", staticOutputs);
app.use("/api/outputs", staticOutputs);

// Health check endpoint for Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', removebgrouter);
app.use('/api/savedata', designrouter);
app.use('/api/designsizeselection', designsizeselection);
app.use('/api', designsrouters);
app.use("/api/products", router);
app.use('/api/auth',authrouter);
app.use('/api/addresses', addressroute);
app.use('/api/payment', paymentrouter);
app.use('/api/orders',orderroutes)
app.use('/api/cart',cartrouter);
app.use('/api/searchproduct', searchproductroute);  
app.use('/api/admin',adminrouter);
app.use("/api/admin/excel-export", exportrouter);
app.use('/api/email',emailrouter);
app.use('/api/invoice',invoicerouter);
app.use('/api/admin-color', colorselection);  

app.use('/api/admin-category',admincategory);
app.use('/api/readymadeproducts',readymadeproducts);
app.use('/api/homepage',homepagerouter);
app.use('/api/designuploads', designuploadsrouter);
app.use('/api/dropproducts', droprouter);
app.use("/api/mockup-calibrations", caliberateroutes);
app.use("/api/brands", brandroute);
app.use("/api/company-pdfs", companypdfs);
app.use("/api/coupons", couponRouter);
app.use("/api/header-banner", headerBannerRouter);
app.use("/api/reviews", reviewRouter);
// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler - Simple middleware without path
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Warm up the rembg Python process in the background so the model is loaded
  // into OS cache before the first real user request arrives.
  const scriptPath = path.join(__dirname, "scripts", "remove_bg_cli.py");
  const warmupInput = path.join(__dirname, "scripts", "warmup_pixel.png");
  const warmupOutput = path.join(__dirname, "scripts", "warmup_pixel_out.png");

  // Write a tiny 1x1 white PNG if it doesn't exist
  if (!fs.existsSync(warmupInput)) {
    // Minimal valid 1x1 white PNG (67 bytes)
    const pixel = Buffer.from(
      "89504e470d0a1a0a0000000d494844520000000100000001080200000090" +
      "77533800000000c49444154789c6260f8cf000000000200016af5d6100000" +
      "00049454e44ae426082",
      "hex"
    );
    fs.writeFileSync(warmupInput, pixel);
  }

  const pythonCmd = process.env.PYTHON_EXECUTABLE?.trim() ||
    (process.platform === "win32" ? "python" : "python3");

  const proc = spawnProcess(pythonCmd, [scriptPath, warmupInput, warmupOutput]);
  proc.on("close", (code) => {
    if (code === 0) {
      console.log("rembg warm-up complete — model is ready");
      try { fs.unlinkSync(warmupOutput); } catch {}
    } else {
      console.warn("rembg warm-up failed (non-critical) — model will load on first request");
    }
  });
  proc.on("error", () => {
    console.warn("rembg warm-up process error (non-critical)");
  });
});


// app.use("/api/outputs", express.static(path.join(__dirname, "outputs")));
