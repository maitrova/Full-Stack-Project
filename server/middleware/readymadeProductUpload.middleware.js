import multer from "multer";
import fs from "fs";
import path from "path";

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const base = "outputs/readymade-products";
    const folder = file.mimetype.startsWith("image/")
      ? path.join(base, "images")
      : path.join(base, "videos");

    ensureDir(folder);
    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const clean = file.originalname
      .replace(ext, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    cb(null, `${clean}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok =
    file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
  if (ok) return cb(null, true);
  cb(new Error("Only image/video allowed"), false);
};

/**
 * ✅ THIS IS `upload`
 * Multer instance exported
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 9,
  },
});

export default upload;
