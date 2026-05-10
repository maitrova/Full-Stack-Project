import Order from "../models/Order.js";
import { sendOrderStatusEmail } from "../services/orderEmailService.js";



export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, orderIds, orderStatus } = req.body;

    if (!orderStatus) {
      return res.status(400).json({
        message: "orderStatus is required",
      });
    }

    let orders = [];

    // 🔹 SINGLE ORDER
    if (orderId) {
      const order = await Order.findById(orderId).populate("user");

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      orders.push(order);
    }

    // 🔹 BULK ORDERS
    if (orderIds && Array.isArray(orderIds)) {
      const bulkOrders = await Order.find({
        _id: { $in: orderIds },
      }).populate("user");

      orders = [...orders, ...bulkOrders];
    }

    if (orders.length === 0) {
      return res.status(400).json({
        message: "No valid orders found",
      });
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      if (order.orderStatus === orderStatus) {
        skippedCount++;
        continue;
      }

      order.orderStatus = orderStatus;
      await order.save();

      // 🔥 Send Email Immediately (No Queue)
      await sendOrderStatusEmail(order, order.user);

      updatedCount++;
    }

    return res.json({
      message: "Order status update completed",
      summary: {
        totalProcessed: orders.length,
        updated: updatedCount,
        skipped: skippedCount,
      },
    });

  } catch (error) {
    console.error("Bulk/Single Update Error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};


