import mongoose from "mongoose";
import Review from "../models/Review.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";

const REVIEW_KIND_CONFIG = {
  READYMADE: {
    field: "readymadeProduct",
    model: ReadymadeProduct,
  },
  DROPPRODUCT: {
    field: "dropproduct",
    model: Dropproduct,
  },
};

export const normalizeReviewKind = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "READYMADE") {
    return "READYMADE";
  }

  if (normalized === "DROPPRODUCT" || normalized === "DROP") {
    return "DROPPRODUCT";
  }

  return null;
};

export const getReviewKindConfig = (kind) => {
  const normalizedKind = normalizeReviewKind(kind);
  return normalizedKind ? REVIEW_KIND_CONFIG[normalizedKind] : null;
};

export const createEmptyRatingBreakdown = () => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
});

export const normalizeRatingBreakdown = (value) => {
  const normalized = createEmptyRatingBreakdown();

  if (!value || typeof value !== "object") {
    return normalized;
  }

  for (const star of [1, 2, 3, 4, 5]) {
    normalized[star] = Number(value?.[star] || value?.[String(star)] || 0);
  }

  return normalized;
};

export const buildReviewLookupKey = (kind, targetId) =>
  `${normalizeReviewKind(kind) || ""}:${String(targetId || "")}`;

export const getReviewTargetFromOrderItem = (item) => {
  const itemKind = String(item?.kind || "").trim().toUpperCase();

  if (!["READYMADE", "DROPPRODUCT"].includes(itemKind)) {
    return null;
  }

  if (item?.readymadeProduct) {
    const targetId = item.readymadeProduct?._id || item.readymadeProduct;
    if (targetId) {
      return { kind: "READYMADE", targetId: String(targetId) };
    }
  }

  if (item?.dropproduct) {
    const targetId = item.dropproduct?._id || item.dropproduct;
    if (targetId) {
      return { kind: "DROPPRODUCT", targetId: String(targetId) };
    }
  }

  return null;
};

export const updateReviewTargetStats = async (kind, targetId) => {
  const normalizedKind = normalizeReviewKind(kind);
  const config = getReviewKindConfig(normalizedKind);

  if (!config || !mongoose.Types.ObjectId.isValid(targetId)) {
    return null;
  }

  const objectId = new mongoose.Types.ObjectId(targetId);
  const match = {
    status: "ACTIVE",
    [config.field]: objectId,
  };

  const [stats] = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        reviewCount: { $sum: 1 },
        rating: { $avg: "$rating" },
        oneStar: {
          $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
        },
        twoStar: {
          $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
        },
        threeStar: {
          $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
        },
        fourStar: {
          $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
        },
        fiveStar: {
          $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
        },
      },
    },
  ]);

  const nextValues = {
    rating:
      stats && Number.isFinite(Number(stats.rating))
        ? Math.round(Number(stats.rating) * 10) / 10
        : 0,
    reviewCount: Number(stats?.reviewCount || 0),
    ratingBreakdown: stats
      ? {
          1: Number(stats.oneStar || 0),
          2: Number(stats.twoStar || 0),
          3: Number(stats.threeStar || 0),
          4: Number(stats.fourStar || 0),
          5: Number(stats.fiveStar || 0),
        }
      : createEmptyRatingBreakdown(),
  };

  await config.model.updateOne({ _id: objectId }, { $set: nextValues });

  return nextValues;
};
