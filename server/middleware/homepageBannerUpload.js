import fs from "fs";
import multer from "multer";
import path from "path";

export const homepageBannersDir = path.join(process.cwd(), "outputs", "homepage-banners");

if (!fs.existsSync(homepageBannersDir)) {
  fs.mkdirSync(homepageBannersDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, homepageBannersDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const slot = String(req.params?.slot || "banner").replace(/[^\w-]+/g, "");
    cb(null, `${slot}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowed = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"]);

export const homepageBannerUpload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    if (allowed.has(String(file.mimetype || "").toLowerCase())) {
      cb(null, true);
      return;
    }
    cb(new Error("Only png, jpg, jpeg, webp or avif images are allowed"), false);
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});
