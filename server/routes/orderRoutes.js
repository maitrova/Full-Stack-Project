import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getMyPaidOrders,adminGetAllOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
  adminBulkUpdateOrderStatus, 
  getMyPaidOrderById} from "../controllers/ordercontrollers.js";



const orderroutes = express.Router();

/** USER */
orderroutes.get("/paid", protect, getMyPaidOrders);
orderroutes.get("/paid/:orderId", protect, getMyPaidOrderById);

/** ADMIN */
orderroutes.get("/admin/orders", protect, adminGetAllOrders);
orderroutes.get("/admin/orders/:orderId", protect, adminGetOrderById);

orderroutes.patch(
  "/admin/orders/:orderId/order-status",
  protect,
  adminUpdateOrderStatus
);

orderroutes.patch(
  "/admin/orders/order-status/bulk",
  protect,
  adminBulkUpdateOrderStatus
);

export default orderroutes;
