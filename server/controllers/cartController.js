import mongoose from "mongoose";
import { randomUUID } from "crypto";
// import { Cart } from "../models/Cart.js";
import ReadymadeProduct from "../models/readymadeproducts.js"; // default export in your schema
import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";
import { Cart } from "../models/Cart.js";

import Dropproduct from "../models/dropproduct.model.js"; // ✅ NEW
import { attachReadymadePricing, getReadymadePricing } from "../utils/readymadePricing.js";
import ComboPack from "../models/ComboPack.js";
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeId = (value) => String(value?._id || value || "").trim();
const GUEST_CART_COOKIE = "guest_cart_id_v2";
const LEGACY_GUEST_CART_COOKIES = ["guest_cart_id"];

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!key) return acc;
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});

const getGuestCartIdFromRequest = (req) => {
  const cookies = parseCookies(req.headers?.cookie || "");
  const guestId = String(cookies[GUEST_CART_COOKIE] || "").trim();
  return guestId || null;
};

const getGuestCartCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

const clearLegacyGuestCartCookies = (res) => {
  LEGACY_GUEST_CART_COOKIES.forEach((cookieName) => {
    res.clearCookie(cookieName, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  });
};

const ensureGuestCartCookie = (req, res) => {
  clearLegacyGuestCartCookies(res);
  const existingGuestId = getGuestCartIdFromRequest(req);
  if (existingGuestId) return existingGuestId;

  const guestId = randomUUID();
  res.cookie(GUEST_CART_COOKIE, guestId, getGuestCartCookieOptions());
  return guestId;
};

const clearGuestCartCookie = (res) => {
  clearLegacyGuestCartCookies(res);
  res.clearCookie(GUEST_CART_COOKIE, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
};

const resolveCartOwner = (req, res, { createGuest = false } = {}) => {
  if (req.user?._id) {
    return { userId: req.user._id, guestId: null, isGuest: false };
  }

  const guestId = createGuest
    ? ensureGuestCartCookie(req, res)
    : getGuestCartIdFromRequest(req);

  return { userId: null, guestId, isGuest: Boolean(guestId) };
};

const getOrCreateActiveCart = async ({ userId = null, guestId = null }) => {
  if (!userId && !guestId) {
    throw new Error("Cart owner is required");
  }

  const filter = userId
    ? { user: userId, status: "ACTIVE" }
    : { guestId, status: "ACTIVE" };
  const insertPayload = userId
    ? { user: userId, guestId: null, status: "ACTIVE", items: [] }
    : { user: null, guestId, status: "ACTIVE", items: [] };

  try {
    return await Cart.findOneAndUpdate(
      filter,
      { $setOnInsert: insertPayload },
      {
        new: true,
        upsert: true,
      }
    );
  } catch (error) {
    // If two requests race on first cart creation, the unique ACTIVE-cart
    // index can reject one insert. Fetch the winner instead of surfacing 500.
    if (error?.code === 11000) {
      const existingCart = await Cart.findOne(filter);
      if (existingCart) return existingCart;
    }

    throw error;
  }
};

const computeDesignUnitPrice = (designDoc) => {
  const sale = Number(designDoc.salePrice || 0);
  const calc = Number(designDoc.calculatedPrice || 0);
  const base = Number(designDoc.basePrice || 0);

  const price = (sale > 0 ? sale : 0) || (calc > 0 ? calc : 0) || base;
  return price;
};

const parsePositiveNumber = (value) => {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const parsePriceDetails = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn("Invalid priceDetails payload:", err);
      return null;
    }
  }
  return null;
};

const parseComboSelections = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const extractProductPreviewImage = (product) => {
  if (!product) return null;

  if (typeof product.thumbnail === "string" && product.thumbnail.trim()) {
    return product.thumbnail;
  }

  const firstImage = product.images?.[0];
  if (typeof firstImage === "string" && firstImage.trim()) {
    return firstImage;
  }
  if (typeof firstImage?.url === "string" && firstImage.url.trim()) {
    return firstImage.url;
  }

  return null;
};

const extractComboPreviewImage = (combo) => {
  if (!combo) return null;
  if (combo.imageMode === "CUSTOM_IMAGES") {
    return combo.featuredImage || combo.galleryImages?.[0]?.url || combo.bannerImage || null;
  }
  return (
    extractProductPreviewImage(combo.selectionGroups?.[0]?.eligibleProducts?.[0]) ||
    extractProductPreviewImage(combo.items?.[0]?.product) ||
    combo.featuredImage ||
    null
  );
};

const sanitizePreviewImage = (value) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Avoid storing large inline data URLs in cart documents.
  if (trimmed.startsWith("data:")) {
    return null;
  }

  return trimmed;
};

const getCustomizationColorStock = (product, colorValue) => {
  if (!product || !colorValue) return null;

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const matchedColor = colors.find(
    (entry) =>
      String(entry?.value || "").trim().toLowerCase() ===
      String(colorValue || "").trim().toLowerCase()
  );

  if (!matchedColor) return null;

  const rawStock = matchedColor.stock;
  if (rawStock === null || rawStock === undefined || String(rawStock).trim() === "") {
    return null;
  }

  const numericStock = Number(rawStock);
  return Number.isFinite(numericStock) ? numericStock : null;
};

const buildCartItemSignature = (item = {}) => {
  const normalizedSize = String(item.size || "M").trim().toUpperCase() || "M";

  if (item.kind === "DESIGN" && item.design) {
    return `DESIGN:${String(item.design)}:SIZE:${normalizedSize}`;
  }

  if (item.dropproduct) {
    return `DROP:${String(item.dropproduct)}:SIZE:${normalizedSize}`;
  }

  if (item.comboPack) {
    const selectionSignature = Array.isArray(item.comboSelections)
      ? item.comboSelections
          .map((selection) =>
            `${selection.productId || selection.product || ""}:${selection.size || "-"}:${selection.color?.value || selection.color || "-"}`
          )
          .join("|")
      : "-";
    return `COMBO:${String(item.comboPack)}:${selectionSignature}`;
  }

  if (item.readymadeProduct) {
    return `READYMADE:${String(item.readymadeProduct)}:SIZE:${normalizedSize}`;
  }

  if (item.product) {
    return `READYMADE:${String(item.product)}:SIZE:${normalizedSize}`;
  }

  return `LEGACY:${normalizedSize}`;
};

const normalizeLegacyCartItem = (item) => {
  if (!item) return;

  if (!item.kind) {
    item.kind = item.design ? "DESIGN" : "READYMADE";
  }

  if (!item.size || !String(item.size).trim()) {
    item.size = "M";
  } else {
    item.size = String(item.size).trim().toUpperCase();
  }

  if (!(Number(item.unitPrice) >= 0)) {
    item.unitPrice = 0;
  }

  if (!(Number(item.basePrice) >= 0)) {
    item.basePrice = Number(item.unitPrice || 0);
  }

  if (!item.currency || !String(item.currency).trim()) {
    item.currency = "INR";
  }

  if (!item.signature || !String(item.signature).trim()) {
    item.signature = buildCartItemSignature(item);
  }

  if (item.previewImage && typeof item.previewImage === "string") {
    item.previewImage = sanitizePreviewImage(item.previewImage);
  }
};

const normalizeLegacyCart = (cart) => {
  if (!cart?.items?.length) return;
  cart.items.forEach(normalizeLegacyCartItem);
};

const buildAddToCartLogContext = (body = {}, extra = {}) => ({
  kind: body.kind || null,
  qty: body.qty ?? 1,
  size: body.size || null,
  selectedSize: body.selectedSize || null,
  designId: body.designId || body.design || null,
  readymadeProductId: body.readymadeProductId || null,
  dropproductId: body.dropproductId || null,
  productId: body.productId || null,
  hasUnitPrice: Number.isFinite(Number(body.unitPrice)),
  hasBasePrice: Number.isFinite(Number(body.basePrice)),
  hasPriceDetails: Boolean(body.priceDetails),
  hasPreviewImage: Boolean(body.previewImage),
  signature: body.signature || null,
  ...extra,
});

const getReadymadeVariantSelection = (product, size) => {
  const normalizedSize = String(size || "").trim().toUpperCase();
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;

  if (!hasVariants) {
    const pricing = getReadymadePricing(product);
    return {
      hasVariants: false,
      variant: null,
      availableStock: Number(product?.stock || 0),
      size: normalizedSize || "M",
      unitPrice: pricing.effectivePrice,
      basePrice: pricing.mrp,
      priceDetails: pricing,
    };
  }

  const variant = product.variants.find(
    (entry) => String(entry.size).toUpperCase() === normalizedSize
  );

  if (!variant) return null;

  const pricing = getReadymadePricing(product, { variant });
  return {
    hasVariants: true,
    variant,
    availableStock: Number(variant.stock || 0),
    size: normalizedSize,
    unitPrice: pricing.effectivePrice,
    basePrice: pricing.mrp,
    priceDetails: pricing,
  };
};

const getColorSelection = (product, colorValue) => {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  if (!colors.length) return null;

  const normalizedColor = String(colorValue || "").trim().toLowerCase();
  return (
    colors.find(
      (entry) =>
        String(entry?.value || "").trim().toLowerCase() === normalizedColor ||
        String(entry?.label || "").trim().toLowerCase() === normalizedColor
    ) || null
  );
};

const validateComboSelections = (combo, rawSelections, qty) => {
  const selections = Array.isArray(rawSelections) ? rawSelections : [];
  const selectionGroups = Array.isArray(combo?.selectionGroups) && combo.selectionGroups.length
    ? [...combo.selectionGroups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];

  if (selectionGroups.length) {
    if (selections.length !== selectionGroups.length) {
      throw new Error("Select one product from every combo category");
    }

    const normalizedSelections = [];
    const stockRequirements = new Map();

    selectionGroups.forEach((group, index) => {
      const selection = selections[index] || {};
      const selectedProductId = normalizeId(selection.productId || selection.product);
      const eligibleProducts = Array.isArray(group.eligibleProducts) ? group.eligibleProducts : [];
      const product = eligibleProducts.find(
        (entry) => normalizeId(entry?._id || entry) === selectedProductId
      );

      if (!product || product.isActive === false) {
        throw new Error("Selected combo product is unavailable");
      }

      const productCategoryId = normalizeId(product.category?._id || product.category);
      const groupCategoryId = normalizeId(group.category?._id || group.category);
      if (productCategoryId && groupCategoryId && productCategoryId !== groupCategoryId) {
        throw new Error("Selected product does not match the combo category");
      }

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      const selectedSize = String(selection.size || "").trim().toUpperCase();
      if (hasVariants && !selectedSize) {
        throw new Error(`Select a size for ${product.title || "combo item"}`);
      }

      const variantSelection = getReadymadeVariantSelection(product, selectedSize);
      if (hasVariants && !variantSelection) {
        throw new Error(`${product.title || "Combo item"} size is unavailable`);
      }

      const colors = Array.isArray(product.colors) ? product.colors : [];
      const colorSelection = colors.length
        ? getColorSelection(product, selection.color || selection.colorValue)
        : null;
      if (colors.length && !colorSelection) {
        throw new Error(`Select a color for ${product.title || "combo item"}`);
      }
      if (
        colorSelection?.stock !== null &&
        colorSelection?.stock !== undefined &&
        Number(colorSelection.stock) < qty
      ) {
        throw new Error(`${product.title || "Combo item"} is out of stock for the selected color`);
      }

      const stockKey = `${selectedProductId}:${selectedSize || "-"}`;
      const currentRequirement = stockRequirements.get(stockKey) || {
        product,
        size: selectedSize,
        qty: 0,
        availableStock: hasVariants
          ? Number(variantSelection?.availableStock || 0)
          : Number(product.stock || 0),
      };
      currentRequirement.qty += qty;
      stockRequirements.set(stockKey, currentRequirement);

      normalizedSelections.push({
        groupId: normalizeId(group._id),
        categoryId: groupCategoryId,
        categoryName: group.category?.name || group.label || "",
        productId: selectedProductId,
        productName: product.title || "Combo item",
        productImage: extractProductPreviewImage(product),
        sortOrder: group.sortOrder ?? index,
        size: selectedSize || "",
        sku: variantSelection?.variant?.sku || "",
        unitPrice: Number(variantSelection?.unitPrice || 0),
        basePrice: Number(variantSelection?.unitPrice || product.price || 0),
        color: colorSelection
          ? {
              label: colorSelection.label || colorSelection.value || "",
              value: colorSelection.value || colorSelection.label || "",
            }
          : null,
      });
    });

    for (const requirement of stockRequirements.values()) {
      if (requirement.availableStock < requirement.qty) {
        throw new Error(
          requirement.size
            ? `${requirement.product.title || "Combo item"} is out of stock for size ${requirement.size}`
            : `${requirement.product.title || "Combo item"} is out of stock`
        );
      }
    }

    return normalizedSelections;
  }

  const comboItems = Array.isArray(combo?.items) ? combo.items : [];

  if (selections.length !== comboItems.length) {
    throw new Error("Select variants for every product in the combo");
  }

  const normalizedSelections = [];
  const stockRequirements = new Map();

  comboItems.forEach((item, index) => {
    const product = item.product;
    const selection = selections[index] || {};
    const productId = normalizeId(product?._id || product);

    if (!product || product.isActive === false) {
      throw new Error("One item in this combo is unavailable");
    }

    if (normalizeId(selection.productId || selection.product) !== productId) {
      throw new Error("Combo selections do not match the selected combo products");
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const selectedSize = String(selection.size || "").trim().toUpperCase();
    if (hasVariants && !selectedSize) {
      throw new Error(`Select a size for ${product.title || "combo item"}`);
    }

    const variantSelection = getReadymadeVariantSelection(product, selectedSize);
    if (hasVariants && !variantSelection) {
      throw new Error(`${product.title || "Combo item"} size is unavailable`);
    }

    const colors = Array.isArray(product.colors) ? product.colors : [];
    const colorSelection = colors.length
      ? getColorSelection(product, selection.color || selection.colorValue)
      : null;
    if (colors.length && !colorSelection) {
      throw new Error(`Select a color for ${product.title || "combo item"}`);
    }
    if (
      colorSelection?.stock !== null &&
      colorSelection?.stock !== undefined &&
      Number(colorSelection.stock) < qty
    ) {
      throw new Error(`${product.title || "Combo item"} is out of stock for the selected color`);
    }

    const stockKey = `${productId}:${selectedSize || "-"}`;
    const currentRequirement = stockRequirements.get(stockKey) || {
      product,
      size: selectedSize,
      qty: 0,
      availableStock: hasVariants
        ? Number(variantSelection?.availableStock || 0)
        : Number(product.stock || 0),
    };
    currentRequirement.qty += qty;
    stockRequirements.set(stockKey, currentRequirement);

    normalizedSelections.push({
      productId,
      productName: product.title || "Combo item",
      productImage: extractProductPreviewImage(product),
      sortOrder: item.sortOrder ?? index,
      size: selectedSize || "",
      sku: variantSelection?.variant?.sku || "",
      color: colorSelection
        ? {
            label: colorSelection.label || colorSelection.value || "",
            value: colorSelection.value || colorSelection.label || "",
          }
        : null,
    });
  });

  for (const requirement of stockRequirements.values()) {
    if (requirement.availableStock < requirement.qty) {
      throw new Error(
        requirement.size
          ? `${requirement.product.title || "Combo item"} is out of stock for size ${requirement.size}`
          : `${requirement.product.title || "Combo item"} is out of stock`
      );
    }
  }

  return normalizedSelections;
};

const findActiveCartWithDetails = ({ userId = null, guestId = null }) => {
  if (!userId && !guestId) {
    return null;
  }

  return Cart.findOne(
    userId ? { user: userId, status: "ACTIVE" } : { guestId, status: "ACTIVE" }
  )
    .populate({
      path: "items.readymadeProduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
        { path: "brand", select: "name" },
      ],
    })
    .populate("items.dropproduct")
    .populate({
      path: "items.comboPack",
      populate: [
        {
          path: "items.product",
          select: "title images thumbnail variants stock isActive",
        },
        {
          path: "selectionGroups.eligibleProducts",
          select: "title images thumbnail variants stock isActive category",
        },
      ],
    })
    .populate("items.design")
    .populate("items.product")
    .lean();
};

const enrichCartItems = (items = []) =>
  items.map((it) => {
    const updatedItem = { ...it };
    const sourceProduct = it.readymadeProduct || it.dropproduct || null;

    if (it.readymadeProduct) {
      updatedItem.readymadeProduct = {
        ...attachReadymadePricing({ ...it.readymadeProduct }),
        category: it.readymadeProduct.category?.name || it.readymadeProduct.category,
        subCategory: it.readymadeProduct.subCategory?.name || it.readymadeProduct.subCategory,
        brand: it.readymadeProduct.brand?.name || it.readymadeProduct.brand,
      };
    }

    if (it.dropproduct) {
      updatedItem.dropproduct = attachReadymadePricing({ ...it.dropproduct });
    }

    if (it.comboPack) {
      updatedItem.comboPack = {
        ...it.comboPack,
        displayImage: extractComboPreviewImage(it.comboPack),
      };
      updatedItem.unitPrice = Number(it.comboPack.comboPrice || updatedItem.unitPrice || 0);
      updatedItem.basePrice = Number(
        it.comboPack.originalPriceOverride || updatedItem.basePrice || updatedItem.unitPrice || 0
      );
    }

    if (it.kind === "READYMADE" && sourceProduct) {
      const selection = getReadymadeVariantSelection(sourceProduct, it.size || "M");

      if (selection) {
        updatedItem.activeVariant = selection.variant || null;
        updatedItem.unitPrice = Number(selection.unitPrice || updatedItem.unitPrice || 0);
        updatedItem.basePrice = Number(
          selection.basePrice || updatedItem.basePrice || updatedItem.unitPrice || 0
        );
        updatedItem.priceDetails = {
          ...(updatedItem.priceDetails || {}),
          ...(selection.priceDetails || {}),
        };
      }
    }

    return updatedItem;
  });

const buildActiveCartResponse = async ({ userId = null, guestId = null }) => {
  const cart = await findActiveCartWithDetails({ userId, guestId });
  if (!cart) return null;

  return {
    ...cart,
    items: enrichCartItems(cart.items || []),
  };
};

const mergeCartItemsBySignature = (targetCart, sourceCart) => {
  normalizeLegacyCart(targetCart);
  normalizeLegacyCart(sourceCart);

  for (const sourceItem of sourceCart.items || []) {
    const sourceSignature = sourceItem.signature || buildCartItemSignature(sourceItem);
    const existingIndex = targetCart.items.findIndex((item) => item.signature === sourceSignature);

    if (existingIndex >= 0) {
      targetCart.items[existingIndex].qty += Number(sourceItem.qty || 0);
      targetCart.items[existingIndex].unitPrice = Number(
        sourceItem.unitPrice || targetCart.items[existingIndex].unitPrice || 0
      );
      targetCart.items[existingIndex].basePrice = Number(
        sourceItem.basePrice || targetCart.items[existingIndex].basePrice || 0
      );
      targetCart.items[existingIndex].priceDetails =
        sourceItem.priceDetails || targetCart.items[existingIndex].priceDetails || null;
      targetCart.items[existingIndex].previewImage =
        sanitizePreviewImage(sourceItem.previewImage) || targetCart.items[existingIndex].previewImage;
      continue;
    }

    targetCart.items.push({
      ...sourceItem.toObject(),
      _id: new mongoose.Types.ObjectId(),
    });
  }
};

export const mergeGuestCartIntoUserCart = async (req, res, userId) => {
  const guestId = getGuestCartIdFromRequest(req);
  if (!guestId || !userId) return;

  const guestCart = await Cart.findOne({ guestId, status: "ACTIVE" });
  if (!guestCart || !guestCart.items?.length) {
    if (guestCart) {
      await Cart.deleteOne({ _id: guestCart._id });
      clearGuestCartCookie(res);
    }
    return;
  }

  const userCart = await getOrCreateActiveCart({ userId });
  mergeCartItemsBySignature(userCart, guestCart);
  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });
  clearGuestCartCookie(res);
};

export const addToCart = async (req, res) => {
  const { userId, guestId, isGuest } = resolveCartOwner(req, res, { createGuest: true });
  const body = req.body || {};
  let requestContext = buildAddToCartLogContext(body, {
    userId: userId ? String(userId) : null,
    guestId: guestId || null,
  });

  try {
    const {
      kind,
      qty = 1,
      readymadeProductId,
      dropproductId,          // ✅ NEW
      comboPackId,
      designId,
      size,
    } = body;
    const effectiveDesignId = designId || body.design;
    const requestedSize = size || body.selectedSize;

    requestContext = buildAddToCartLogContext(body, {
      userId: userId ? String(userId) : null,
      guestId: guestId || null,
      designId: effectiveDesignId || null,
      size: requestedSize || null,
    });

    console.info("[cart/add] Request received", requestContext);

    const requestedUnitPrice = parsePositiveNumber(body.unitPrice);
    const requestedBasePrice = parsePositiveNumber(body.basePrice);
    const priceDetailsPayload = parsePriceDetails(body.priceDetails);
    let designPriceSnapshot = null;

    const parsedQty = Number(qty);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: "qty must be an integer >= 1" });
    }
    if (!["READYMADE", "DESIGN", "COMBO"].includes(kind)) {
      return res.status(400).json({ message: "kind must be READYMADE, DESIGN, or COMBO" });
    }

    const normalizedSize =
      requestedSize && String(requestedSize).trim() ? String(requestedSize).trim() : "";

    let signature = "";
    let itemToInsert = null;

    // =========================
    // READYMADE (supports ReadymadeProduct OR Dropproduct)
    // =========================
    if (kind === "READYMADE") {
      const hasReadymadeId = !!readymadeProductId;
      const hasDropId = !!dropproductId;

      if (!hasReadymadeId && !hasDropId) {
        return res.status(400).json({
          message: "Valid readymadeProductId or dropproductId is required",
        });
      }

      if (hasReadymadeId && !isValidObjectId(readymadeProductId)) {
        return res.status(400).json({ message: "Valid readymadeProductId is required" });
      }
      if (hasDropId && !isValidObjectId(dropproductId)) {
        return res.status(400).json({ message: "Valid dropproductId is required" });
      }

      // ✅ Pick model by which id is provided
      const sourceType = hasDropId ? "DROP" : "READYMADE";
      const ProductModel = hasDropId ? Dropproduct : ReadymadeProduct;
      const productId = hasDropId ? dropproductId : readymadeProductId;

      const product = await ProductModel.findById(productId).lean();
      if (!product || product.isActive === false) {
        return res.status(404).json({ message: `${sourceType} product not found or inactive` });
      }

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants && !normalizedSize) {
        return res.status(400).json({ message: "size is required for this product" });
      }

      const selection = getReadymadeVariantSelection(product, normalizedSize);
      if (!selection) {
        return res.status(400).json({ message: "Selected size is not available" });
      }

      let unitPrice = Number(selection.unitPrice || 0);
      let availableStock = Number(selection.availableStock || 0);

      if (!(unitPrice >= 0)) {
        return res.status(400).json({ message: "Invalid price" });
      }
      if (availableStock < parsedQty) {
        return res.status(400).json({ message: "Not enough stock" });
      }

      const finalSize = selection.size;

      // ✅ Signature includes source to avoid collisions between models
      signature = `${sourceType}:${product._id.toString()}:SIZE:${finalSize}`;

      itemToInsert = {
        kind: "READYMADE",
        readymadeProduct: sourceType === "READYMADE" ? product._id : null,
        dropproduct: sourceType === "DROP" ? product._id : null,   // ✅ NEW
        design: null,
        product: null,
        qty: parsedQty,
        size: finalSize,
        unitPrice,
        basePrice: selection.basePrice,
        priceDetails: selection.priceDetails,
        currency: product.currency || "INR",
        previewImage: sanitizePreviewImage(extractProductPreviewImage(product)),
        signature,
      };
    }

    // =========================
    // COMBO
    // =========================
    if (kind === "COMBO") {
      if (!comboPackId || !isValidObjectId(comboPackId)) {
        return res.status(400).json({ message: "Valid comboPackId is required" });
      }

      const combo = await ComboPack.findById(comboPackId)
        .populate("items.product")
        .populate("selectionGroups.category", "name")
        .populate("selectionGroups.eligibleProducts")
        .lean();

      if (!combo || combo.status !== "ACTIVE") {
        return res.status(404).json({ message: "Combo pack not found or inactive" });
      }

      const normalizedSelections = validateComboSelections(
        combo,
        parseComboSelections(body.comboSelections),
        parsedQty
      );

      const selectionSignature = normalizedSelections
        .map((selection) =>
          `${selection.productId}:${selection.size || "-"}:${selection.color?.value || "-"}`
        )
        .join("|");
      signature = `COMBO:${combo._id.toString()}:${selectionSignature}`;

      const hasSelectionGroups = Array.isArray(combo.selectionGroups) && combo.selectionGroups.length > 0;
      const originalPrice = hasSelectionGroups
        ? normalizedSelections.reduce((sum, selection) => sum + Number(selection.basePrice || selection.unitPrice || 0), 0)
        : Number(combo.originalPriceOverride || 0) > 0
        ? Number(combo.originalPriceOverride)
        : normalizedSelections.reduce((sum, selection) => {
            const comboItem = combo.items.find(
              (item) => normalizeId(item.product?._id) === selection.productId
            );
            const product = comboItem?.product;
            const variant = Array.isArray(product?.variants)
              ? product.variants.find((entry) => entry.size === selection.size)
              : null;
            const pricing = getReadymadePricing(product, { variant });
            return sum + Number(pricing.effectivePrice || product?.price || 0);
          }, 0);
      const comboPrice = hasSelectionGroups
        ? Number(combo.comboPrice || 0)
        : Number(combo.comboPrice || 0);

      itemToInsert = {
        kind: "COMBO",
        readymadeProduct: null,
        dropproduct: null,
        comboPack: combo._id,
        comboSelections: normalizedSelections,
        comboName: combo.name || "Combo Pack",
        design: null,
        product: null,
        qty: parsedQty,
        size: "",
        unitPrice: comboPrice,
        basePrice: originalPrice,
        priceDetails: {
          originalPrice,
          savingsAmount: Math.max(originalPrice - comboPrice, 0),
          discountPercentage:
            hasSelectionGroups
              ? originalPrice > 0
                ? Math.round(((originalPrice - comboPrice) / originalPrice) * 100)
                : 0
              : originalPrice > 0
                ? Math.round(((originalPrice - Number(combo.comboPrice || 0)) / originalPrice) * 100)
                : 0,
        },
        currency: combo.currency || "INR",
        previewImage: sanitizePreviewImage(extractComboPreviewImage(combo)),
        signature,
      };
    }

    // =========================
    // DESIGN
    // =========================
    if (kind === "DESIGN") {
      if (!effectiveDesignId || !isValidObjectId(effectiveDesignId)) {
        return res.status(400).json({ message: "Valid designId is required" });
      }

      const design = await Design.findById(effectiveDesignId).lean();
      if (!design) return res.status(404).json({ message: "Design not found" });

      const customizationProduct = design.product
        ? await Product.findById(design.product).lean()
        : null;
      const colorStock = getCustomizationColorStock(customizationProduct, design.productColor);
      if (colorStock !== null && colorStock < parsedQty) {
        return res.status(400).json({
          message: `Not enough stock for color ${design.productColorName || design.productColor}`,
        });
      }

      const fallbackUnitPrice = computeDesignUnitPrice(design);
      const finalDesignUnitPrice =
        requestedUnitPrice > 0 ? requestedUnitPrice : fallbackUnitPrice;

      if (!(finalDesignUnitPrice > 0)) {
        return res.status(400).json({ message: "Design price is not valid" });
      }

      const finalSize = (normalizedSize || "M").toUpperCase();
      signature = `DESIGN:${design._id.toString()}:SIZE:${finalSize}`;

      const finalDesignBasePrice =
        requestedBasePrice > 0 ? requestedBasePrice : finalDesignUnitPrice;

      designPriceSnapshot = {
        unitPrice: finalDesignUnitPrice,
        basePrice: finalDesignBasePrice,
        priceDetails: priceDetailsPayload,
      };

      itemToInsert = {
        kind: "DESIGN",
        readymadeProduct: null,
        dropproduct: null, // ✅ NEW (keep null)
        design: design._id,
        product: design.product || null,
        qty: parsedQty,
        size: finalSize,
        unitPrice: finalDesignUnitPrice,
        basePrice: finalDesignBasePrice,
        priceDetails: priceDetailsPayload,
        currency: "INR",
        previewImage: sanitizePreviewImage(design.previewImage),
        signature,
      };
    }

    // =========================
    // CART MERGE / INSERT
    // =========================
    const cart = await getOrCreateActiveCart({ userId, guestId });
    normalizeLegacyCart(cart);

    const idx = cart.items.findIndex((it) => it.signature === signature);
    if (idx >= 0) {
      const nextQty = cart.items[idx].qty + parsedQty;

      if (kind === "READYMADE") {
        // Determine whether this existing item is from DROP or READYMADE
        const isDropItem = !!cart.items[idx].dropproduct;
        const ProductModel = isDropItem ? Dropproduct : ReadymadeProduct;
        const pid = isDropItem ? cart.items[idx].dropproduct : cart.items[idx].readymadeProduct;

        const p = await ProductModel.findById(pid).lean();
        if (!p || p.isActive === false) {
          return res.status(404).json({ message: "Product not found or inactive" });
        }

        const selection = getReadymadeVariantSelection(
          p,
          String(cart.items[idx].size || "").trim()
        );
        if (!selection) {
          return res.status(400).json({ message: "Selected size is not available" });
        }

        const availableStock = Number(selection.availableStock || 0);

        if (availableStock < nextQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        // refresh snapshot price as well
        cart.items[idx].unitPrice = Number(selection.unitPrice || cart.items[idx].unitPrice);
        cart.items[idx].basePrice = Number(selection.basePrice || cart.items[idx].basePrice);
        cart.items[idx].priceDetails = selection.priceDetails;

        cart.items[idx].currency = p.currency || cart.items[idx].currency;
        cart.items[idx].previewImage =
          sanitizePreviewImage(extractProductPreviewImage(p)) || cart.items[idx].previewImage;
      }

      if (kind === "COMBO") {
        const combo = await ComboPack.findById(cart.items[idx].comboPack)
          .populate("items.product")
          .populate("selectionGroups.category", "name")
          .populate("selectionGroups.eligibleProducts")
          .lean();
        if (!combo || combo.status !== "ACTIVE") {
          return res.status(404).json({ message: "Combo pack not found or inactive" });
        }
        const normalizedSelections = validateComboSelections(combo, cart.items[idx].comboSelections || [], nextQty);
        const hasSelectionGroups = Array.isArray(combo.selectionGroups) && combo.selectionGroups.length > 0;
        if (hasSelectionGroups) {
          const originalPrice = normalizedSelections.reduce((sum, selection) => sum + Number(selection.basePrice || selection.unitPrice || 0), 0);
          const comboPrice = Number(combo.comboPrice || 0);
          cart.items[idx].unitPrice = comboPrice;
          cart.items[idx].basePrice = originalPrice;
          cart.items[idx].priceDetails = {
            originalPrice,
            savingsAmount: Math.max(originalPrice - comboPrice, 0),
            discountPercentage: originalPrice > 0 ? Math.round(((originalPrice - comboPrice) / originalPrice) * 100) : 0,
          };
        } else {
          cart.items[idx].unitPrice = Number(combo.comboPrice || cart.items[idx].unitPrice);
        }
        cart.items[idx].currency = combo.currency || cart.items[idx].currency;
        cart.items[idx].previewImage =
          sanitizePreviewImage(extractComboPreviewImage(combo)) || cart.items[idx].previewImage;
      }

      cart.items[idx].qty = nextQty;
      cart.items[idx].size =
        kind === "COMBO" ? "" : String(cart.items[idx].size || "M").toUpperCase();

      if (kind === "DESIGN" && designPriceSnapshot) {
        cart.items[idx].unitPrice = designPriceSnapshot.unitPrice;
        cart.items[idx].basePrice = designPriceSnapshot.basePrice;
        cart.items[idx].priceDetails = designPriceSnapshot.priceDetails;
      }

      await cart.save();

      const responseCart = await buildActiveCartResponse({ userId, guestId });
      return res.status(200).json({ message: "Cart updated", cart: responseCart });
    }

    cart.items.push(itemToInsert);
    await cart.save();

    const responseCart = await buildActiveCartResponse({ userId, guestId });
    return res.status(201).json({
      message: isGuest ? "Added to guest cart" : "Added to cart",
      cart: responseCart,
    });
  } catch (err) {
    console.error("[cart/add] Failed", {
      ...requestContext,
      errorMessage: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ message: "Server error" });
  }
};




// cartController.js


export const getCart = async (req, res) => {
  try {
    clearLegacyGuestCartCookies(res);
    const { userId, guestId } = resolveCartOwner(req, res);
    const cart = await buildActiveCartResponse({ userId, guestId });

    if (!cart) {
      return res.status(200).json({
        message: "Cart is empty",
        cart: null,
      });
    }

    return res.status(200).json({ cart });

  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};






export const updateCartItemQty = async (req, res) => {
  try {
    const { userId, guestId } = resolveCartOwner(req, res);
    if (!userId && !guestId) return res.status(404).json({ message: "Cart not found" });

    const { itemId } = req.params;
    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const { qty } = req.body;
    const parsedQty = Number(qty);
    const requestedUnitPrice = parsePositiveNumber(req.body.unitPrice);
    const requestedBasePrice = parsePositiveNumber(req.body.basePrice);
    const hasPriceDetailsField = Object.prototype.hasOwnProperty.call(req.body, "priceDetails");
    const priceDetailsPayload = hasPriceDetailsField
      ? parsePriceDetails(req.body.priceDetails)
      : undefined;
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: "qty must be an integer >= 1" });
    }

    const cart = await Cart.findOne(
      userId ? { user: userId, status: "ACTIVE" } : { guestId, status: "ACTIVE" }
    );
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    // normalize size once (used by both drop/readymade)
    const cartSize = String(item.size || "M").trim().toUpperCase();

    // =========================
    // READYMADE (DropProduct OR ReadymadeProduct)
    // =========================
    if (item.kind === "READYMADE") {
      // ✅ Detect DropProduct first
      const dropId =
        item.dropproductId ||
        item.dropproduct || // might store ObjectId
        null;

      if (dropId) {
        // ✅ DropProduct flow
        const p = await Dropproduct.findById(dropId).lean(); // <-- IMPORTANT
        if (!p || p.isActive === false) {
          return res.status(404).json({ message: "Drop product not found or inactive" });
        }

        const selection = getReadymadeVariantSelection(p, cartSize);
        if (!selection) {
          return res.status(400).json({ message: "Selected size is not available" });
        }

        const availableStock = Number(selection.availableStock || 0);
        const unitPrice = Number(selection.unitPrice || 0);

        if (availableStock < parsedQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        // refresh snapshot fields
        item.unitPrice = unitPrice;
        item.currency = p.currency || "INR";
        item.previewImage = sanitizePreviewImage(extractProductPreviewImage(p));

        item.basePrice = selection.basePrice;
        item.priceDetails = selection.priceDetails;

        // ensure ids are consistent
        item.size = cartSize;

      } else {
        // ✅ ReadymadeProduct flow (existing logic)
        const pId = item.readymadeProduct || item.readymadeProductId;
        const p = await ReadymadeProduct.findById(pId).lean();
        if (!p || p.isActive === false) {
          return res.status(404).json({ message: "Readymade product not found or inactive" });
        }

        const selection = getReadymadeVariantSelection(p, cartSize);
        if (!selection) {
          return res.status(400).json({ message: "Selected size is not available" });
        }

        const availableStock = Number(selection.availableStock || 0);
        const unitPrice = Number(selection.unitPrice || 0);

        if (availableStock < parsedQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        item.unitPrice = unitPrice;
        item.currency = p.currency || "INR";
        item.previewImage = sanitizePreviewImage(extractProductPreviewImage(p));

        item.basePrice = selection.basePrice;
        item.priceDetails = selection.priceDetails;
        item.size = selection.size;
      }
    }

    if (item.kind === "COMBO") {
      const combo = await ComboPack.findById(item.comboPack)
        .populate("items.product")
        .populate("selectionGroups.category", "name")
        .populate("selectionGroups.eligibleProducts")
        .lean();

      if (!combo || combo.status !== "ACTIVE") {
        return res.status(404).json({ message: "Combo pack not found or inactive" });
      }

      const normalizedSelections = validateComboSelections(combo, item.comboSelections || [], parsedQty);
      const hasSelectionGroups = Array.isArray(combo.selectionGroups) && combo.selectionGroups.length > 0;
      if (hasSelectionGroups) {
        const originalPrice = normalizedSelections.reduce((sum, selection) => sum + Number(selection.basePrice || selection.unitPrice || 0), 0);
        const comboPrice = Number(combo.comboPrice || 0);
        item.unitPrice = comboPrice;
        item.basePrice = originalPrice;
        item.priceDetails = {
          originalPrice,
          savingsAmount: Math.max(originalPrice - comboPrice, 0),
          discountPercentage: originalPrice > 0 ? Math.round(((originalPrice - comboPrice) / originalPrice) * 100) : 0,
        };
      } else {
        item.unitPrice = Number(combo.comboPrice || item.unitPrice || 0);
      }
      item.currency = combo.currency || "INR";
      item.previewImage = sanitizePreviewImage(extractComboPreviewImage(combo)) || item.previewImage;
      item.size = "";
    }

    // =========================
    // DESIGN (your logic)
    // =========================
    if (item.kind === "DESIGN") {
      const d = await Design.findById(item.design).lean();
      if (!d) return res.status(404).json({ message: "Design not found" });

      const customizationProduct = d.product
        ? await Product.findById(d.product).lean()
        : null;
      const colorStock = getCustomizationColorStock(customizationProduct, d.productColor);
      if (colorStock !== null && colorStock < parsedQty) {
        return res.status(400).json({
          message: `Not enough stock for color ${d.productColorName || d.productColor}`,
        });
      }

      const isOwner = Boolean(userId) && d.user?.toString() === String(userId);
      const isPublic = d.isPublished === true;
      if (!isOwner && !isPublic) {
        return res.status(403).json({ message: "You cannot update this design item" });
      }

      if (requestedUnitPrice > 0) {
        item.unitPrice = requestedUnitPrice;
      }

      if (requestedBasePrice > 0) {
        item.basePrice = requestedBasePrice;
      } else if (!item.basePrice) {
        item.basePrice = item.unitPrice;
      }

      if (!(item.unitPrice > 0)) {
        return res.status(400).json({ message: "Design price invalid" });
      }

      if (hasPriceDetailsField) {
        item.priceDetails = priceDetailsPayload;
      }

      item.currency = "INR";
      item.previewImage = sanitizePreviewImage(d.previewImage) || item.previewImage;
      item.product = d.product || item.product;
      item.size = cartSize;
    }

    item.qty = parsedQty;

    await cart.save();

    const responseCart = await buildActiveCartResponse({ userId, guestId });
    return res.status(200).json({ message: "Quantity updated", cart: responseCart });
  } catch (err) {
    console.error("updateCartItemQty error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




export const removeCartItem = async (req, res) => {
  try {
    const { userId, guestId } = resolveCartOwner(req, res);
    if (!userId && !guestId) return res.status(404).json({ message: "Cart not found" });

    const { itemId } = req.params;
    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const cart = await Cart.findOne(
      userId ? { user: userId, status: "ACTIVE" } : { guestId, status: "ACTIVE" }
    );
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    item.deleteOne(); // remove subdocument
    await cart.save();

    const responseCart = await buildActiveCartResponse({ userId, guestId });
    return res.status(200).json({ message: "Item removed", cart: responseCart });
  } catch (err) {
    console.error("removeCartItem error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const clearCart = async (req, res) => {
  try {
    const { userId, guestId, isGuest } = resolveCartOwner(req, res);
    if (!userId && !guestId) {
      return res.status(200).json({ message: "Cart already empty", cart: null });
    }

    const cart = await Cart.findOne(
      userId ? { user: userId, status: "ACTIVE" } : { guestId, status: "ACTIVE" }
    );

    if (!cart) {
      return res.status(200).json({ message: "Cart already empty", cart: null });
    }

    cart.items = [];
    await cart.save();

    if (isGuest) {
      clearGuestCartCookie(res);
      await Cart.deleteOne({ _id: cart._id });
      return res.status(200).json({ message: "Guest cart cleared", cart: null });
    }

    const responseCart = await buildActiveCartResponse({ userId, guestId: null });
    return res.status(200).json({ message: "Cart cleared", cart: responseCart });
  } catch (err) {
    console.error("clearCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

