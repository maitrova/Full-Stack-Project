import express from "express";
import multer from "multer";
import { generateVirtualTryOn } from "../controllers/virtualTryOnController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      cb(new Error("Only image files are allowed for virtual try-on"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/generate",
  upload.fields([
    { name: "userImage", maxCount: 1 },
    { name: "garmentImage", maxCount: 1 },
  ]),
  generateVirtualTryOn
);

export default router;
