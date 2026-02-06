import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const thumbnailDir = path.join(process.cwd(), "server", "outputs", "thumbnail");
ensureDir(thumbnailDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, thumbnailDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only JPG, PNG, WEBP allowed"), false);
  cb(null, true);
};

export const uploadThumbnail = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
}).single("thumbnail");
