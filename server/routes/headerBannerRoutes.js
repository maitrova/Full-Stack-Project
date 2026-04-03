import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getHeaderBanner,
  getHeaderBannerAdmin,
  updateHeaderBannerAdmin,
} from "../controllers/headerBannerController.js";

const headerBannerRouter = express.Router();

headerBannerRouter.get("/", getHeaderBanner);
headerBannerRouter.get("/admin", protect, getHeaderBannerAdmin);
headerBannerRouter.put("/admin", protect, updateHeaderBannerAdmin);

export default headerBannerRouter;
