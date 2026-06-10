import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { reviewPhotoUpload } from "../middleware/reviewPhotoUpload.js";
import {
  adminDeleteReview,
  adminCreateReviews,
  adminListReviews,
  createOrUpdateMyReview,
  listProductReviews,
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

reviewRouter.get("/admin", protect, adminListReviews);
reviewRouter.post("/admin", protect, reviewPhotoUpload.any(), adminCreateReviews);
reviewRouter.delete("/admin/:reviewId", protect, adminDeleteReview);
reviewRouter.get("/:kind/:targetId", listProductReviews);
reviewRouter.post("/", protect, reviewPhotoUpload.array("photos", 8), createOrUpdateMyReview);

export default reviewRouter;
