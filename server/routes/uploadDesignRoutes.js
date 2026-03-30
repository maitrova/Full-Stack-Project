// server/routes/uploadDesignRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  optimizeUploadedImage,
  normalizeStoredPath,
} from "../utils/imageOptimization.js";

const designsrouters = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// make sure outputs/designs exists
const designsDir = path.join(rootDir, "outputs", "designs");
if (!fs.existsSync(designsDir)) {
  fs.mkdirSync(designsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, designsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    const name = Date.now() + "-" + Math.random().toString(36).slice(2) + ext;
    cb(null, name);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

designsrouters.post("/upload-design", upload.single("designImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const optimized = await optimizeUploadedImage(
      normalizeStoredPath(req.file.path),
      {
        outputDir: "outputs/designs",
        baseName: path.basename(req.file.filename, path.extname(req.file.filename)),
        cleanupSource: true,
      }
    );

    const relativeUrl = `/${String(optimized.url || "").replace(/^\/+/, "")}`;

    return res.status(200).json({
      message: "Design image uploaded successfully",
      imageUrl: relativeUrl,
      filename: path.basename(relativeUrl),
      variants: optimized.variants,
    });
  } catch (error) {
    console.error("Upload design error:", error);
    return res.status(500).json({ error: "Failed to upload design image" });
  }
});

export default designsrouters;
