import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REVIEW_PHOTO_DIR = path.join(__dirname, "..", "outputs", "reviews");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(REVIEW_PHOTO_DIR);
    cb(null, REVIEW_PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "review-photo", ext)
      .replace(/[^\w-]+/g, "_")
      .slice(0, 60);
    cb(null, `${base}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const fileFilter = (req, file, cb) => {
  if (allowedTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only png, jpg, jpeg, and webp review photos are allowed"), false);
};

export const reviewPhotoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 40,
  },
});
