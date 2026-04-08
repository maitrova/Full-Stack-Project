import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  adminDeleteReview,
  adminListReviews,
  createOrUpdateMyReview,
  listProductReviews,
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

reviewRouter.get("/admin", protect, adminListReviews);
reviewRouter.delete("/admin/:reviewId", protect, adminDeleteReview);
reviewRouter.get("/:kind/:targetId", listProductReviews);
reviewRouter.post("/", protect, createOrUpdateMyReview);

export default reviewRouter;
