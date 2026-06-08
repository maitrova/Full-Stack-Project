import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { returnUpload } from "../middleware/returnUpload.js";
import { getMyPaidOrders,adminGetAllOrders,
  adminGetOrderById,
  adminGetDashboardSummary,
  adminUpdateOrderStatus,
  adminBulkUpdateOrderStatus, 
  getMyPaidOrderById,
  cancelMyOrder,
  submitReturnRequest,
  adminGetReturnRequests,
  adminUpdateReturnRequest,
  adminUpdateReturnRefundStatus} from "../controllers/ordercontrollers.js";



const orderroutes = express.Router();

/** USER */
orderroutes.get("/paid", protect, getMyPaidOrders);
orderroutes.get("/paid/:orderId", protect, getMyPaidOrderById);
orderroutes.patch("/:orderId/cancel", protect, cancelMyOrder);
orderroutes.post(
  "/:orderId/return-request",
  protect,
  returnUpload.array("images", 5),
  submitReturnRequest
);

/** ADMIN */
orderroutes.get("/admin/dashboard-summary", protect, adminGetDashboardSummary);
orderroutes.get("/admin/orders", protect, adminGetAllOrders);
orderroutes.get("/admin/orders/:orderId", protect, adminGetOrderById);
orderroutes.get("/admin/returns", protect, adminGetReturnRequests);
orderroutes.patch("/admin/returns/:orderId", protect, adminUpdateReturnRequest);
orderroutes.patch("/admin/returns/:orderId/refund-status", protect, adminUpdateReturnRefundStatus);

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
