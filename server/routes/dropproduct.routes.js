import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
  createDropproduct,
  getAllDropproducts,
  getDropproductById,
  getDropproductBySlug,
  updateDropproduct,
  deleteDropproduct,
} from "../controllers/dropproduct.controller.js";

const droprouter = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

/* 🔹 Use existing output folder */
const uploadDir = path.join(serverRoot, "outputs", "dropimages");

/* 🔹 Create dropimages only if missing */
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* 🔹 Multer storage */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const hasAllowedVideoType = (file) => {
  if (!file) return false;

  const mimeType = String(file.mimetype || "").toLowerCase();
  if (mimeType.startsWith("video/")) {
    return true;
  }

  const fileName = String(file.originalname || "").toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)$/i.test(fileName);
};

const upload = multer({
  storage,
  limits: { files: 8 },
  fileFilter: (_, file, cb) => {
    if (file.fieldname === "video") {
      if (!hasAllowedVideoType(file)) {
        return cb(new Error("Only video files are allowed for video uploads"));
      }
      return cb(null, true);
    }

    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/* Accept gallery images and optional size chart */
const uploadDropFiles = upload.fields([
  { name: "images", maxCount: 6 },
  { name: "sizeChart", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

const handleDropUpload = (req, res, next) => {
  uploadDropFiles(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({ message: error.message || "Upload failed" });
  });
};

/* 🔹 Routes */
droprouter.post("/", handleDropUpload, createDropproduct);
droprouter.get("/", getAllDropproducts);
droprouter.get("/slug/:slug", getDropproductBySlug);
droprouter.get("/:id", getDropproductById);
droprouter.put("/:id", handleDropUpload, updateDropproduct);
droprouter.delete("/:id", deleteDropproduct);

export default droprouter;
