import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/authmodel.js";

export const searchOrders = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchText = q.trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(searchText);

    let userIds = [];

    // 🔹 Step 1: Search users by name or email
    const users = await User.find({
      $or: [
        { name: { $regex: searchText, $options: "i" } },
        { email: { $regex: searchText, $options: "i" } },
      ],
    }).select("_id");

    userIds = users.map((u) => u._id);

    // 🔹 Step 2: Build Order search query
    const orderQuery = {
      $or: [
        // Order ID search
        ...(isObjectId ? [{ _id: searchText }] : []),

        // User search
        ...(userIds.length ? [{ user: { $in: userIds } }] : []),

        // Product ID search inside items
        ...(isObjectId
          ? [
              { "items.readymadeProduct": searchText },
              { "items.dropproduct": searchText },
              { "items.design": searchText },
              { "items.product": searchText },
            ]
          : []),
      ],
    };

    const orders = await Order.find(orderQuery)
      .populate("user", "name email")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });

  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export default searchOrders;