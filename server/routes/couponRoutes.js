import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createCoupon,
  deleteCoupon,
  getCouponById,
  listActiveCoupons,
  listEligibleCoupons,
  listCoupons,
  updateCoupon,
  validateCoupon,
} from "../controllers/couponController.js";

const couponRouter = express.Router();

couponRouter.get("/active", listActiveCoupons);
couponRouter.get("/eligible", protect, listEligibleCoupons);
couponRouter.post("/validate", protect, validateCoupon);

couponRouter.post("/admin", protect, createCoupon);
couponRouter.get("/admin", protect, listCoupons);
couponRouter.get("/admin/:id", protect, getCouponById);
couponRouter.patch("/admin/:id", protect, updateCoupon);
couponRouter.delete("/admin/:id", protect, deleteCoupon);

export default couponRouter;
