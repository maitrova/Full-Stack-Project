import multer from "multer";
import path from "path";
import fs from "fs";

const BASE_DIR = path.join(process.cwd(), "outputs", "adminuploadeddesigns");

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Sanitize folder name
 */
export function sanitizeFolderName(name = "") {

  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

}

/**
 * Secure path join (IMPORTANT SECURITY FIX)
 */
function safeJoinFolder(folderRaw = "") {

  const folder = sanitizeFolderName(folderRaw);

  if (!folder) {
    throw new Error("Folder name is required");
  }

  const target = path.join(BASE_DIR, folder);

  // prevent ../../ attacks
  if (!target.startsWith(BASE_DIR)) {
    throw new Error("Invalid folder path");
  }

  return { folder, target };

}

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    try {

      const raw =
        req.params.folder ||
        req.body.folder ||
        "";

      const { target } = safeJoinFolder(raw);

      ensureDir(target);

      cb(null, target);

    } catch (err) {

      cb(err, null);

    }

  },

  filename: (req, file, cb) => {

    try {

      const ext =
        path.extname(file.originalname || "")
        .toLowerCase();

      const base =
        path.basename(file.originalname || "image", ext)
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 60);

      const unique =
        Date.now() +
        "-" +
        Math.round(Math.random() * 1e9);

      const finalName =
        `${base}-${unique}${ext}`;

      cb(null, finalName);

    } catch (err) {

      cb(err);

    }

  },

});


/**
 * Allowed file types
 */
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);


const fileFilter = (req, file, cb) => {

  if (ALLOWED.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only png, jpg, jpeg, webp, svg allowed"
      ),
      false
    );
  }

};


/**
 * FINAL MULTER EXPORT
 */
export const adminDesignUpload = multer({

  storage,

  fileFilter,

  limits: {

    fileSize: 15 * 1024 * 1024, // 15MB per file

    files: 1000, // IMPORTANT: allow folder upload

  },

});