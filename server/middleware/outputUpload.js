import multer from "multer";
import path from "path";
import fs from "fs";

const BASE_DIR = path.join(process.cwd(), "outputs", "adminuploadeddesigns");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// allow only safe folder names
export function sanitizeFolderName(name = "") {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")   // remove weird chars
    .replace(/\s+/g, "-")          // spaces -> hyphen
    .replace(/-+/g, "-")           // collapse
    .replace(/^-|-$/g, "");        // trim hyphens
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const raw = req.params.folder || req.body.folder || "";
    const folder = sanitizeFolderName(raw);

    if (!folder) return cb(new Error("Folder name is required"), null);

    const target = path.join(BASE_DIR, folder);
    ensureDir(target);
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "image", ext)
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);

    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(new Error("Only images (png/jpg/webp/svg) are allowed."), false);
};

export const adminDesignUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per image
});
