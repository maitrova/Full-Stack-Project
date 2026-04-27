import fs from "fs";
import multer from "multer";
import path from "path";

const blogCoversDir = path.join(process.cwd(), "outputs", "blog-covers");

if (!fs.existsSync(blogCoversDir)) {
  fs.mkdirSync(blogCoversDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, blogCoversDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base =
      path
        .basename(file.originalname || "blog-cover", ext)
        .replace(/[^\w-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "blog-cover";

    cb(null, `${base}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

export const blogCoverUpload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    if (allowed.has(String(file.mimetype || "").toLowerCase())) {
      cb(null, true);
      return;
    }

    cb(new Error("Only png, jpg, jpeg, webp, svg, avif images are allowed"), false);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
