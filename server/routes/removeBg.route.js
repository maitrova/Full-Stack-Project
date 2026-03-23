import express from "express";
import multer from "multer";
import { removeBgController } from "../controllers/removeBg.controller.js";


const removebgrouter = express.Router();
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Configure multer with file size limit and better error handling
const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has((file.mimetype || "").toLowerCase())) {
      cb(new Error("Only JPG, JPEG, PNG, and WEBP files are allowed"), false);
      return;
    }
    cb(null, true);
  }
});

removebgrouter.post("/remove-bg", upload.single("image"), removeBgController);

export default removebgrouter;
