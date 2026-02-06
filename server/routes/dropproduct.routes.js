import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  createDropproduct,
  getAllDropproducts,
  getDropproductById,
  updateDropproduct,
  deleteDropproduct,
} from "../controllers/dropproduct.controller.js";

const droprouter = express.Router();

/* 🔹 Use existing output folder */
const uploadDir = path.join(process.cwd(), "outputs", "dropimages");

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

const upload = multer({
  storage,
  // ✅ allow up to 7 total files (6 images + 1 thumbnail)
  limits: { files: 7 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

/* ✅ Accept both images + thumbnail */
const uploadDropFiles = upload.fields([
  { name: "images", maxCount: 6 },
  { name: "thumbnail", maxCount: 1 },
]);

/* 🔹 Routes */
droprouter.post("/", uploadDropFiles, createDropproduct);
droprouter.get("/", getAllDropproducts);
droprouter.get("/:id", getDropproductById);
droprouter.put("/:id", uploadDropFiles, updateDropproduct);
droprouter.delete("/:id", deleteDropproduct);

export default droprouter;
