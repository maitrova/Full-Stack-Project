import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";
import ComboPack from "../models/ComboPack.js";

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeSize = (value) => String(value || "").trim().toUpperCase();

const buildInventoryAdjustments = (order) => {
  const adjustments = new Map();

  for (const item of order?.items || []) {
    const itemKind = String(item?.kind || "").trim().toUpperCase();
    if (!["READYMADE", "DROPPRODUCT", "COMBO"].includes(itemKind)) continue;

    const qty = Number(item.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const readymadeProductId = normalizeId(item.readymadeProduct);
    const dropproductId = normalizeId(item.dropproduct);
    const comboPackId = normalizeId(item.comboPack);
    const size = normalizeSize(item.size);

    if (comboPackId) {
      const key = `COMBO:${comboPackId}:${size || "-"}`;
      const current = adjustments.get(key) || {
        model: "COMBO",
        productId: comboPackId,
        size,
        selections: Array.isArray(item.comboSelections) ? item.comboSelections : [],
        qty: 0,
      };
      current.qty += qty;
      adjustments.set(key, current);
      continue;
    }

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

const buildComboComponentAdjustments = async ({ productId, size, selections = [], qty }) => {
  const combo = await ComboPack.findById(productId)
    .populate("items.product", "_id stock variants isActive title")
    .populate("selectionGroups.eligibleProducts", "_id stock variants isActive title")
    .lean();

  if (!combo || combo.status !== "ACTIVE") {
    const error = new Error("Combo pack is not available");
    error.statusCode = 409;
    error.code = "INSUFFICIENT_STOCK";
    throw error;
  }

  const adjustments = new Map();
  const hasSelections = Array.isArray(selections) && selections.length > 0;
  const componentSelections = hasSelections
    ? selections
    : (combo.items || []).map((item) => ({
        productId: normalizeId(item.product?._id || item.product),
        size,
      }));

  for (const selection of componentSelections) {
    const productIdForSelection = normalizeId(selection.productId || selection.product);
    const comboItem = (combo.items || []).find(
      (item) => normalizeId(item.product?._id || item.product) === productIdForSelection
    );
    const groupProduct = (combo.selectionGroups || [])
      .flatMap((group) => group.eligibleProducts || [])
      .find((product) => normalizeId(product?._id || product) === productIdForSelection);
    const product = comboItem?.product || groupProduct;
    if (!product || product.isActive === false) {
      const error = new Error("A combo product is unavailable");
      error.statusCode = 409;
      error.code = "INSUFFICIENT_STOCK";
      throw error;
    }

    const componentId = normalizeId(product._id);
    const selectedSize = normalizeSize(selection.size || size);
    const key = `READYMADE:${componentId}:${selectedSize || "-"}`;
    const current = adjustments.get(key) || {
      model: "READYMADE",
      productId: componentId,
      size: selectedSize,
      qty: 0,
    };
    current.qty += qty;
    adjustments.set(key, current);
  }

  return [...adjustments.values()];
};

const decrementComboInventory = async (adjustment) => {
  const componentAdjustments = await buildComboComponentAdjustments(adjustment);
  const applied = [];

  for (const componentAdjustment of componentAdjustments) {
    const result = await decrementReadymadeInventory(componentAdjustment);
    const modifiedCount = Number(result?.modifiedCount || result?.nModified || 0);

    if (modifiedCount < 1) {
      for (const appliedAdjustment of applied.reverse()) {
        await rollbackReadymadeInventory(appliedAdjustment);
      }
      return { modifiedCount: 0 };
    }

    applied.push(componentAdjustment);
  }

  return { modifiedCount: 1 };
};

const rollbackComboInventory = async (adjustment) => {
  const componentAdjustments = await buildComboComponentAdjustments(adjustment);
  for (const componentAdjustment of componentAdjustments) {
    await rollbackReadymadeInventory(componentAdjustment);
  }
};

const decrementInventory = async (adjustment) => {
  if (adjustment.model === "READYMADE") {
    return decrementReadymadeInventory(adjustment);
  }

  if (adjustment.model === "DROP") {
    return decrementDropInventory(adjustment);
  }

  if (adjustment.model === "COMBO") {
    return decrementComboInventory(adjustment);
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

  if (adjustment.model === "COMBO") {
    return rollbackComboInventory(adjustment);
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

export const rollbackInventoryForOrder = async (order) => {
  const adjustments = buildInventoryAdjustments(order);

  for (const adjustment of adjustments) {
    await rollbackInventory(adjustment);
  }

  return adjustments;
};
