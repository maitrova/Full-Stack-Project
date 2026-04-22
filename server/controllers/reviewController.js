import mongoose from "mongoose";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import {
  getReviewKindConfig,
  getReviewTargetFromOrderItem,
  normalizeRatingBreakdown,
  normalizeReviewKind,
  updateReviewTargetStats,
} from "../services/reviewService.js";

const formatReviewerName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "Verified Buyer";
  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
};

const mapReviewDocument = (review) => ({
  _id: review._id,
  rating: Number(review.rating || 0),
  title: review.title || "",
  comment: review.comment || "",
  verifiedPurchase: Boolean(review.verifiedPurchase),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  userName: formatReviewerName(review.user?.name),
});

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const mapAdminReviewDocument = (review) => {
  const productName =
    review.readymadeProduct?.title ||
    review.dropproduct?.name ||
    "Unknown product";
  const targetId =
    review.kind === "READYMADE"
      ? review.readymadeProduct?._id
      : review.dropproduct?._id;

  return {
    _id: review._id,
    kind: review.kind,
    targetId: targetId ? String(targetId) : "",
    productName,
    customerName: review.user?.name || "Unknown customer",
    customerEmail: review.user?.email || "",
    orderId: review.order?._id ? String(review.order._id) : "",
    orderStatus: review.order?.orderStatus || "",
    paymentStatus: review.order?.status || "",
    rating: Number(review.rating || 0),
    title: review.title || "",
    comment: review.comment || "",
    verifiedPurchase: Boolean(review.verifiedPurchase),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

const isPaidOrCodOrder = (order) =>
  order?.status === "PAID" || order?.payment?.method === "COD";

const buildPublicReviewSort = (sort) => {
  switch (String(sort || "").trim().toLowerCase()) {
    case "highest":
      return { rating: -1, createdAt: -1 };
    case "lowest":
      return { rating: 1, createdAt: -1 };
    case "oldest":
      return { createdAt: 1 };
    default:
      return { createdAt: -1 };
  }
};

export const listProductReviews = async (req, res) => {
  try {
    const kind = normalizeReviewKind(req.params.kind);
    const targetId = req.params.targetId;

    if (!kind) {
      return res.status(400).json({ message: "Invalid review target kind" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid review target id" });
    }

    const config = getReviewKindConfig(kind);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);
    const skip = (page - 1) * limit;
    const ratingFilter = Number(req.query.rating || 0);
    const withComment = String(req.query.withComment || "").trim().toLowerCase() === "true";

    const filter = {
      status: "ACTIVE",
      [config.field]: targetId,
    };

    if (ratingFilter >= 1 && ratingFilter <= 5) {
      filter.rating = ratingFilter;
    }

    if (withComment) {
      filter.comment = { $exists: true, $ne: "" };
    }

    const [reviews, total, targetDoc] = await Promise.all([
      Review.find(filter)
        .populate("user", "name")
        .sort(buildPublicReviewSort(req.query.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      config.model
        .findById(targetId)
        .select("rating reviewCount ratingBreakdown")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        rating: Number(targetDoc?.rating || 0),
        reviewCount: Number(targetDoc?.reviewCount || 0),
        ratingBreakdown: normalizeRatingBreakdown(targetDoc?.ratingBreakdown),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      reviews: reviews.map(mapReviewDocument),
    });
  } catch (error) {
    console.error("listProductReviews error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createOrUpdateMyReview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const kind = normalizeReviewKind(req.body.kind);
    const targetId = String(req.body.targetId || "").trim();
    const orderId = String(req.body.orderId || "").trim();
    const rating = Number(req.body.rating);
    const title = String(req.body.title || "").trim();
    const comment = String(req.body.comment || "").trim();

    if (!kind) {
      return res.status(400).json({ message: "Invalid review target kind" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid review target id" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      orderStatus: "DELIVERED",
    }).lean();

    if (!order || !isPaidOrCodOrder(order)) {
      return res.status(404).json({ message: "Delivered order not found" });
    }

    const matchingItem = (order.items || []).find((item) => {
      const target = getReviewTargetFromOrderItem(item);
      return target && target.kind === kind && target.targetId === targetId;
    });

    if (!matchingItem) {
      return res.status(400).json({ message: "This product is not part of the selected order" });
    }

    const config = getReviewKindConfig(kind);
    const review = await Review.findOneAndUpdate(
      { user: userId, kind, [config.field]: targetId },
      {
        $set: {
          order: orderId,
          rating,
          title,
          comment,
          verifiedPurchase: true,
          status: "ACTIVE",
          [config.field]: targetId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    )
      .populate("user", "name")
      .lean();

    const summary = await updateReviewTargetStats(kind, targetId);

    return res.status(200).json({
      success: true,
      message: "Review saved successfully",
      review: mapReviewDocument(review),
      summary: {
        rating: Number(summary?.rating || 0),
        reviewCount: Number(summary?.reviewCount || 0),
        ratingBreakdown: normalizeRatingBreakdown(summary?.ratingBreakdown),
      },
    });
  } catch (error) {
    console.error("createOrUpdateMyReview error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const adminListReviews = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const kindParam = String(req.query.kind || "").trim();
    const kind = kindParam ? normalizeReviewKind(kindParam) : null;
    const query = String(req.query.q || "").trim().toLowerCase();
    const ratingFilter = Number(req.query.rating || 0);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    if (kindParam && !kind) {
      return res.status(400).json({ message: "Invalid review target kind" });
    }

    const filter = { status: "ACTIVE" };
    if (kind) filter.kind = kind;
    if (ratingFilter >= 1 && ratingFilter <= 5) {
      filter.rating = ratingFilter;
    }

    const reviews = await Review.find(filter)
      .populate("user", "name email")
      .populate("order", "_id orderStatus status")
      .populate("readymadeProduct", "title")
      .populate("dropproduct", "name")
      .sort({ createdAt: -1 })
      .lean();

    const normalizedReviews = reviews
      .map(mapAdminReviewDocument)
      .filter((review) => {
        if (!query) return true;

        const haystack = [
          review.productName,
          review.customerName,
          review.customerEmail,
          review.orderId,
          review.title,
          review.comment,
          review.kind,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });

    const total = normalizedReviews.length;
    const pages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = normalizedReviews.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
      reviews: paginatedReviews,
    });
  } catch (error) {
    console.error("adminListReviews error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminDeleteReview = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { reviewId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review id" });
    }

    const review = await Review.findById(reviewId).lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const targetId =
      review.kind === "READYMADE"
        ? review.readymadeProduct
        : review.dropproduct;

    await Review.deleteOne({ _id: reviewId });

    if (targetId) {
      await updateReviewTargetStats(review.kind, String(targetId));
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("adminDeleteReview error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
