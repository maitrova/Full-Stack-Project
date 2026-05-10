import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "outputs", "returns");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeBase = path
      .basename(file.originalname || "return-proof", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 60);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeBase}-${unique}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const returnUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Only PNG, JPG, JPEG, and WEBP images are allowed"), false);
      return;
    }
    cb(null, true);
  },
});
