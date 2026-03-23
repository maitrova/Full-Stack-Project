import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeSize = (value) => String(value || "").trim().toUpperCase();

const buildInventoryAdjustments = (order) => {
  const adjustments = new Map();

  for (const item of order?.items || []) {
    if (item?.kind !== "READYMADE") continue;

    const qty = Number(item.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const readymadeProductId = normalizeId(item.readymadeProduct);
    const dropproductId = normalizeId(item.dropproduct);
    const size = normalizeSize(item.size);

    if (readymadeProductId) {
      const key = `READYMADE:${readymadeProductId}:${size || "-"}`;
      const current = adjustments.get(key) || {
        model: "READYMADE",
        productId: readymadeProductId,
        size,
        qty: 0,
      };
      current.qty += qty;
      adjustments.set(key, current);
      continue;
    }

    if (dropproductId) {
      const key = `DROP:${dropproductId}:${size || "-"}`;
      const current = adjustments.get(key) || {
        model: "DROP",
        productId: dropproductId,
        size,
        qty: 0,
      };
      current.qty += qty;
      adjustments.set(key, current);
    }
  }

  return [...adjustments.values()];
};

const decrementReadymadeInventory = async ({ productId, size, qty }) => {
  if (size) {
    return ReadymadeProduct.updateOne(
      {
        _id: productId,
        stock: { $gte: qty },
        variants: { $elemMatch: { size, stock: { $gte: qty } } },
      },
      {
        $inc: {
          stock: -qty,
          "variants.$.stock": -qty,
        },
      }
    );
  }

  return ReadymadeProduct.updateOne(
    {
      _id: productId,
      stock: { $gte: qty },
    },
    {
      $inc: { stock: -qty },
    }
  );
};

const rollbackReadymadeInventory = async ({ productId, size, qty }) => {
  if (size) {
    return ReadymadeProduct.updateOne(
      {
        _id: productId,
        variants: { $elemMatch: { size } },
      },
      {
        $inc: {
          stock: qty,
          "variants.$.stock": qty,
        },
      }
    );
  }

  return ReadymadeProduct.updateOne(
    { _id: productId },
    { $inc: { stock: qty } }
  );
};

const decrementDropInventory = async ({ productId, size, qty }) => {
  if (size) {
    return Dropproduct.updateOne(
      {
        _id: productId,
        totalStock: { $gte: qty },
        variants: { $elemMatch: { size, stock: { $gte: qty } } },
      },
      {
        $inc: {
          totalStock: -qty,
          "variants.$.stock": -qty,
        },
      }
    );
  }

  return Dropproduct.updateOne(
    {
      _id: productId,
      totalStock: { $gte: qty },
    },
    {
      $inc: { totalStock: -qty },
    }
  );
};

const rollbackDropInventory = async ({ productId, size, qty }) => {
  if (size) {
    return Dropproduct.updateOne(
      {
        _id: productId,
        variants: { $elemMatch: { size } },
      },
      {
        $inc: {
          totalStock: qty,
          "variants.$.stock": qty,
        },
      }
    );
  }

  return Dropproduct.updateOne(
    { _id: productId },
    { $inc: { totalStock: qty } }
  );
};

const decrementInventory = async (adjustment) => {
  if (adjustment.model === "READYMADE") {
    return decrementReadymadeInventory(adjustment);
  }

  if (adjustment.model === "DROP") {
    return decrementDropInventory(adjustment);
  }

  return { modifiedCount: 0 };
};

const rollbackInventory = async (adjustment) => {
  if (adjustment.model === "READYMADE") {
    return rollbackReadymadeInventory(adjustment);
  }

  if (adjustment.model === "DROP") {
    return rollbackDropInventory(adjustment);
  }

  return null;
};

export const applyInventoryForOrder = async (order) => {
  const adjustments = buildInventoryAdjustments(order);
  const applied = [];

  for (const adjustment of adjustments) {
    const result = await decrementInventory(adjustment);
    const modifiedCount = Number(result?.modifiedCount || result?.nModified || 0);

    if (modifiedCount < 1) {
      for (const appliedAdjustment of applied.reverse()) {
        await rollbackInventory(appliedAdjustment);
      }

      const error = new Error(
        adjustment.size
          ? `Insufficient stock for size ${adjustment.size}`
          : "Insufficient stock for one or more products"
      );
      error.statusCode = 409;
      error.code = "INSUFFICIENT_STOCK";
      throw error;
    }

    applied.push(adjustment);
  }

  return adjustments;
};
