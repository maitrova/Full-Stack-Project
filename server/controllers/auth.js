import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/authmodel.js";
import Order from "../models/Order.js";
import Address from "../models/address.js";
import { OAuth2Client } from "google-auth-library";
import {
  getBrevoTemplateId,
  sendBrevoEmail,
} from "../services/brevoEmailService.js";
import { mergeGuestCartIntoUserCart } from "./cartController.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🔐 Generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
};

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOrderItemName = (item) => {
  if (item.readymadeProduct?.title) return item.readymadeProduct.title;
  if (item.design?.title) return item.design.title;
  if (item.design?.productName) return item.design.productName;
  if (item.dropproduct?.name) return item.dropproduct.name;
  if (item.product?.name) return item.product.name;
  if (item.product?.title) return item.product.title;
  return "Product";
};

const getOrderItemImage = (item) => {
  if (item.previewImage) return item.previewImage;
  if (item.readymadeProduct?.thumbnail) return item.readymadeProduct.thumbnail;
  if (item.design?.previewImage) return item.design.previewImage;
  if (item.design?.views?.[0]?.previewImage) return item.design.views[0].previewImage;
  if (Array.isArray(item.dropproduct?.images) && item.dropproduct.images[0]) {
    const firstDropImage = item.dropproduct.images[0];
    return typeof firstDropImage === "string" ? firstDropImage : firstDropImage?.url || "";
  }
  if (item.dropproduct?.thumbnail) return item.dropproduct.thumbnail;
  return "";
};

const shapeOrderForAdminUser = (order) => ({
  _id: order._id,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  status: order.status,
  orderStatus: order.orderStatus,
  subtotal: order.subtotal || 0,
  shipping: order.shipping || 0,
  discount: order.discount || 0,
  total: order.total || 0,
  currency: order.currency || "INR",
  deliveryAddress: order.deliveryAddress || null,
  billingAddress: order.billingAddress || null,
  payment: order.payment || null,
  items: (order.items || []).map((item) => ({
    kind: item.kind,
    name: getOrderItemName(item),
    qty: item.qty || 0,
    size: item.size || "",
    unitPrice: item.unitPrice || 0,
    basePrice: item.basePrice || 0,
    previewImage: getOrderItemImage(item),
  })),
});



// ================= REGISTER =================
export const registerUser = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!phone || !password || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      role: "user",
    });

    await mergeGuestCartIntoUserCart(req, res, user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};



// ================= LOGIN =================
export const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Phone/Email and password are required",
      });
    }

    // 🔎 Check by email OR phone
    const user = await User.findOne({
      $or: [
        { phone: identifier },
        { email: identifier.toLowerCase() },
      ],
    });

    if (!user || !user.password || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    await mergeGuestCartIntoUserCart(req, res, user._id);

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Login failed",
    });
  }
};



// ================= GOOGLE LOGIN =================
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, name, email } = payload;

    if (!email) {
      return res.status(400).json({ message: "Google account has no email" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Create new Google user
      user = await User.create({
        name,
        email,
        googleId: sub,
        role: "user",
      });
    } else if (!user.googleId) {
      // Link existing account to Google
      user.googleId = sub;
      await user.save();
    }

    await mergeGuestCartIntoUserCart(req, res, user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Google authentication failed" });
  }
};



// ================= GET PROFILE =================
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



// ================= UPDATE PROFILE =================
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.email !== undefined) user.email = req.body.email;

    

    if (req.body.password) user.password = req.body.password;

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      token: generateToken(updated._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Profile update failed" });
  }
};

// ================= ADMIN USERS LIST =================
export const adminGetUsers = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const search = String(req.query.search || "").trim();
    const query = {};

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const users = await User.find(query)
      .select("_id name email phone role createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const orderStats = userIds.length
      ? await Order.aggregate([
          { $match: { user: { $in: userIds } } },
          {
            $group: {
              _id: "$user",
              totalOrders: { $sum: 1 },
              paidOrders: {
                $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] },
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] },
              },
              totalSpent: {
                $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$total", 0] },
              },
              lastOrderAt: { $max: "$createdAt" },
            },
          },
        ])
      : [];

    const statsByUserId = new Map(
      orderStats.map((entry) => [String(entry._id), entry])
    );

    const shapedUsers = users.map((user) => {
      const stats = statsByUserId.get(String(user._id));
      return {
        ...user,
        stats: {
          totalOrders: stats?.totalOrders || 0,
          paidOrders: stats?.paidOrders || 0,
          deliveredOrders: stats?.deliveredOrders || 0,
          totalSpent: stats?.totalSpent || 0,
          lastOrderAt: stats?.lastOrderAt || null,
        },
      };
    });

    return res.status(200).json({
      users: shapedUsers,
      totalUsers: shapedUsers.length,
    });
  } catch (error) {
    console.error("adminGetUsers error:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

// ================= ADMIN USER DETAILS =================
export const adminGetUserById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [user, addresses, orders] = await Promise.all([
      User.findById(userId)
        .select("_id name email phone role createdAt updatedAt")
        .lean(),
      Address.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Order.find({ user: userId })
        .populate("deliveryAddress")
        .populate("billingAddress")
        .populate({ path: "items.readymadeProduct", select: "title thumbnail" })
        .populate({ path: "items.design", select: "title productName previewImage views" })
        .populate({ path: "items.dropproduct", select: "name images thumbnail" })
        .populate({ path: "items.product", select: "name title" })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const shapedOrders = orders.map(shapeOrderForAdminUser);
    const deliveredOrders = shapedOrders.filter(
      (order) => order.orderStatus === "DELIVERED"
    );
    const receivedItems = deliveredOrders.flatMap((order) =>
      order.items.map((item) => ({
        ...item,
        orderId: order._id,
        deliveredAt: order.updatedAt || order.createdAt,
        currency: order.currency,
      }))
    );

    const orderStats = {
      totalOrders: shapedOrders.length,
      paidOrders: shapedOrders.filter((order) => order.status === "PAID").length,
      deliveredOrders: deliveredOrders.length,
      totalSpent: shapedOrders.reduce(
        (sum, order) => sum + (order.status === "PAID" ? order.total || 0 : 0),
        0
      ),
      totalItemsOrdered: shapedOrders.reduce(
        (sum, order) =>
          sum +
          order.items.reduce((itemSum, item) => itemSum + (item.qty || 0), 0),
        0
      ),
      totalItemsReceived: receivedItems.reduce(
        (sum, item) => sum + (item.qty || 0),
        0
      ),
    };

    return res.status(200).json({
      user,
      addresses,
      orders: shapedOrders,
      receivedItems,
      stats: orderStats,
    });
  } catch (error) {
    console.error("adminGetUserById error:", error);
    return res.status(500).json({ message: "Failed to fetch user details" });
  }
};




// ================= FORGOT PASSWORD =================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const templateId = getBrevoTemplateId(
      "BREVO_FORGOT_PASSWORD_TEMPLATE_ID",
      "BREVO_RESET_PASSWORD_TEMPLATE_ID"
    );

    await sendBrevoEmail({
      to: [{ email: user.email, name: user.name }],
      subject: "Password Reset OTP",
      htmlContent: `
        <h2>Password Reset OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP expires in 10 minutes.</p>
      `,
      templateId,
      params: {
        customerName: user.name,
        email: user.email,
        otp,
        expiresInMinutes: 10,
      },
    });

    res.json({ message: "OTP sent to email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};


// ================= RESET PASSWORD =================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (
      !user ||
      user.otp !== otp ||
      user.otpExpire < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpire = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Password reset failed" });
  }
};
