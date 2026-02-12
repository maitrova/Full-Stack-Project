import multer from "multer";
import path from "path";
import fs from "fs";

/* ==================================
   Ensure Folder Exists
================================== */

const uploadPath = path.join(process.cwd(), "outputs", "thumbnail");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

/* ==================================
   Multer Storage Config
================================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-");

    const uniqueName = `${Date.now()}-${nameWithoutExt}${ext}`;

    cb(null, uniqueName);
  },
});

/* ==================================
   File Filter (Only Images Allowed)
================================== */

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WebP images are allowed"), false);
  }
};

/* ==================================
   Upload Instance
================================== */

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default upload;
