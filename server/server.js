// server/server.js or server/index.js
import "dotenv/config";
import express from 'express';
import cors from "cors";
import connectDB from './config/db.js';

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

import colorselection from './routes/adminColorRoutes.js';
import companypdfs from './routes/companyPdfRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
connectDB();

const app = express();

// Middleware
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(cors({ origin: [
    "http://localhost:5173", 
    "http://maitrova.in", 
    "https://maitrova.in"
  ], credentials: true }));

  app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});


// Static files - serve at both /outputs and /api/outputs
// app.use("/outputs", express.static(path.join(__dirname, "outputs")));
app.use(
  "/api/outputs",
  express.static(path.join(__dirname, "outputs"), {
    maxAge: "30d",
    etag: true,
    setHeaders: (res, filePath) => {
      if (/\.(avif|webp|png|jpe?g|gif|svg|mp4|webm)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      }
    },
  })
);

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// app.use("/api/outputs", express.static(path.join(__dirname, "outputs")));
