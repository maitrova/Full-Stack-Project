import express from "express";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";
import { homepageBannerUpload } from "../middleware/homepageBannerUpload.js";
import {
  getHomepageBanners,
  removeHomepageBannerImage,
  updateHomepageBanner,
} from "../controllers/homepageBannerController.js";

const homepageBannerRouter = express.Router();

// Turns multer errors (wrong type, too large) into a clear 400 instead of a 500.
const uploadSingleImage = (req, res, next) => {
  homepageBannerUpload.single("image")(req, res, (error) => {
    if (error) {
      const message =
        error.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 8 MB)" : error.message || "Upload failed";
      return res.status(400).json({ message });
    }
    next();
  });
};

homepageBannerRouter.get("/", getHomepageBanners);
homepageBannerRouter.put("/admin/:slot", protect, requireAdmin, uploadSingleImage, updateHomepageBanner);
homepageBannerRouter.delete("/admin/:slot/image", protect, requireAdmin, removeHomepageBannerImage);

export default homepageBannerRouter;
