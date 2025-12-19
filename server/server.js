// server/server.js or server/index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import connectDB from './config/db.js';

import path from "path";
import { fileURLToPath } from "url";
import router from './routes/productRoutes.js';
import removebgrouter from './routes/removeBg.route.js';
import designrouter from './routes/designRoutes.js';
import designsrouters from './routes/uploadDesignRoutes.js';
import authrouter from './routes/auth.js';
import cartrouter from './routes/addtocartroutes.js';
import adminrouter from './routes/admincontrols.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors({ origin: [
    "http://localhost:5173", 
    "http://narifighter.online", 
    "https://narifighter.online"
  ], credentials: true }));

// Static files
app.use("/outputs", express.static(path.join(__dirname, "outputs")));

// Routes
app.use('/api', removebgrouter);
app.use('/savedata', designrouter);
app.use('/api', designsrouters);
app.use("/api/products", router);
app.use('/api/auth',authrouter);
app.use('/api/cart',cartrouter);
app.use('/api/admin',adminrouter);
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