import mongoose from "mongoose";
import Order from "../models/Order.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const PAYMENT_STATUSES = ["PENDING_PAYMENT", "PAID", "FAILED"];
const FULFILLMENT_STATUSES = ["PROCESSING", "READY", "SHIPPED", "DELIVERED"];

/**
 * USER: Get my PAID orders
 * GET /api/orders/paid
 */
export const getMyPaidOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const orders = await Order.find({ user: userId, status: "PAID" })
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ orders });
  } catch (err) {
    console.error("getMyPaidOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * USER: Get my single PAID order
 * GET /api/orders/paid/:orderId
 */
export const getMyPaidOrderById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId, status: "PAID" })
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product")
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.status(200).json({ order });
  } catch (err) {
    console.error("getMyPaidOrderById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Get all orders (optional filters)
 * GET /api/admin/orders?paymentStatus=PAID&orderStatus=SHIPPED&userId=...&dateFrom=2026-04-01&dateTo=2026-04-06
 */







const DESIGN_SELECT =
  "previewImage views product productSlug productName productColor productColorName calculatedPrice priceBreakdown title description salePrice";

export const adminGetAllOrders = async (req, res) => {
  try {
    const { paymentStatus, orderStatus, userId, dateFrom, dateTo } = req.query;

    const query = {};
    if (paymentStatus) query.status = paymentStatus;
    if (orderStatus) query.orderStatus = orderStatus;
    if (userId) query.user = userId;
    if (dateFrom || dateTo) {
      query.createdAt = {};

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ message: "Invalid dateFrom" });
        }
        query.createdAt.$gte = fromDate;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ message: "Invalid dateTo" });
        }
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")

      // ✅ DESIGN populate (unchanged)
      .populate({ path: "items.design", select: DESIGN_SELECT })

      // ✅ READYMADE populate with nested category/subCategory/brand
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })

      .populate("items.dropproduct")
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    // ==============================
    // Shape Response
    // ==============================
    const shaped = orders.map((o) => ({
      ...o,
      items: (o.items || []).map((it) => {
        // ==========================
        // HANDLE DESIGN (UNCHANGED)
        // ==========================
        if (it.kind === "DESIGN" && it.design) {
          const d = it.design;

          return {
            ...it,
            design: {
              _id: d._id,
              previewImage: d.previewImage,
              product: d.product,
              productSlug: d.productSlug,
              productName: d.productName,
              productColor: d.productColor,
              productColorName: d.productColorName,
              calculatedPrice: d.calculatedPrice,
              priceBreakdown: d.priceBreakdown,
              title: d.title,
              description: d.description,
              salePrice: d.salePrice,
              views: (d.views || []).map((v) => ({
                code: v.code,
                previewImage: v.previewImage,
                textLayers: v.textLayers || [],
                designLayers: (v.designLayers || []).map((dl) => ({
                  id: dl.id,
                  imageUrl: dl.imageUrl,
                  hasBgRemoved: dl.hasBgRemoved,
                  x: dl.x,
                  y: dl.y,
                  scale: dl.scale,
                  rotation: dl.rotation,
                  zone: dl.zone,
                  insideSafeArea: dl.insideSafeArea,
                  originalWidthPx: dl.originalWidthPx,
                  originalHeightPx: dl.originalHeightPx,
                  renderedWidthPx: dl.renderedWidthPx,
                  renderedHeightPx: dl.renderedHeightPx,
                  widthInches: dl.widthInches,
                  heightInches: dl.heightInches,
                  areaInches: dl.areaInches,
                  rawPrintWidthInches: dl.rawPrintWidthInches,
                  rawPrintHeightInches: dl.rawPrintHeightInches,
                  rawPrintAreaInches: dl.rawPrintAreaInches,
                })),
              })),
            },
          };
        }

        // ==========================
        // HANDLE READYMADE PRODUCT
        // Convert populated objects → string names
        // ==========================
        if (it.readymadeProduct) {
          const rp = it.readymadeProduct;

          return {
            ...it,
            readymadeProduct: {
              ...rp,
              category: rp.category?.name || "",
              subCategory: rp.subCategory?.name || "",
              brand: rp.brand?.name || "",
            },
          };
        }

        return it;
      }),
    }));

    return res.status(200).json({ orders: shaped });
  } catch (err) {
    console.error("adminGetAllOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/**
 * ADMIN: Get single order by id
 * GET /api/admin/orders/:orderId
 */
export const adminGetOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")

      // ✅ READYMADE populate with nested fields
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })

      .populate("items.dropproduct")

      // ✅ DESIGN populate (unchanged)
      .populate({ path: "items.design", select: DESIGN_SELECT })

      .populate("items.product")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ==============================
    // Shape Single Order
    // ==============================
    const shaped = {
      ...order,
      items: (order.items || []).map((it) => {
        // ==========================
        // HANDLE DESIGN (UNCHANGED)
        // ==========================
        if (it.kind === "DESIGN" && it.design) {
          const d = it.design;

          return {
            ...it,
            design: {
              _id: d._id,
              previewImage: d.previewImage,
              product: d.product,
              productSlug: d.productSlug,
              productName: d.productName,
              productColor: d.productColor,
              productColorName: d.productColorName,
              calculatedPrice: d.calculatedPrice,
              priceBreakdown: d.priceBreakdown,
              title: d.title,
              description: d.description,
              salePrice: d.salePrice,
              views: (d.views || []).map((v) => ({
                code: v.code,
                previewImage: v.previewImage,
                textLayers: v.textLayers || [],
                designLayers: (v.designLayers || []).map((dl) => ({
                  id: dl.id,
                  imageUrl: dl.imageUrl,
                  hasBgRemoved: dl.hasBgRemoved,
                  x: dl.x,
                  y: dl.y,
                  scale: dl.scale,
                  rotation: dl.rotation,
                  zone: dl.zone,
                  insideSafeArea: dl.insideSafeArea,
                  originalWidthPx: dl.originalWidthPx,
                  originalHeightPx: dl.originalHeightPx,
                  renderedWidthPx: dl.renderedWidthPx,
                  renderedHeightPx: dl.renderedHeightPx,
                  widthInches: dl.widthInches,
                  heightInches: dl.heightInches,
                  areaInches: dl.areaInches,
                  rawPrintWidthInches: dl.rawPrintWidthInches,
                  rawPrintHeightInches: dl.rawPrintHeightInches,
                  rawPrintAreaInches: dl.rawPrintAreaInches,
                })),
              })),
            },
          };
        }

        // ==========================
        // HANDLE READYMADE PRODUCT
        // Convert populated objects → string names
        // ==========================
        if (it.readymadeProduct) {
          const rp = it.readymadeProduct;

          return {
            ...it,
            readymadeProduct: {
              ...rp,
              category: rp.category?.name || "",
              subCategory: rp.subCategory?.name || "",
              brand: rp.brand?.name || "",
            },
          };
        }

        return it;
      }),
    };

    return res.status(200).json({ order: shaped });
  } catch (err) {
    console.error("adminGetOrderById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



/**
 * ADMIN: Update single order fulfillment status
 * PATCH /api/admin/orders/:orderId/order-status
 * body: { orderStatus: "READY" }
 */
export const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const { orderStatus } = req.body;
    if (!FULFILLMENT_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid orderStatus" });
    }

    // Optional rule: Only allow fulfillment updates if payment is PAID
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "PAID") {
      return res.status(400).json({ message: "Cannot update fulfillment status for unpaid order" });
    }

    order.orderStatus = orderStatus;

    // Optional: track history
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: orderStatus, at: new Date() });

    await order.save();

    return res.status(200).json({ message: "Order status updated", order });
  } catch (err) {
    console.error("adminUpdateOrderStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Bulk update fulfillment status
 * PATCH /api/admin/orders/order-status/bulk
 * body: { orderIds: [...], orderStatus: "SHIPPED" }
 */
export const adminBulkUpdateOrderStatus = async (req, res) => {
  try {
    const { orderIds, orderStatus } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds must be a non-empty array" });
    }
    if (!FULFILLMENT_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid orderStatus" });
    }

    const invalidId = orderIds.find((id) => !isValidObjectId(id));
    if (invalidId) return res.status(400).json({ message: `Invalid orderId: ${invalidId}` });

    // Optional: only update PAID orders
    const result = await Order.updateMany(
      { _id: { $in: orderIds }, status: "PAID" },
      {
        $set: { orderStatus },
        $push: { statusHistory: { status: orderStatus, at: new Date() } },
      }
    );

    return res.status(200).json({
      message: "Bulk status updated",
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
    });
  } catch (err) {
    console.error("adminBulkUpdateOrderStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
