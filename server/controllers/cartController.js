import mongoose from "mongoose";
// import { Cart } from "../models/Cart.js";
import ReadymadeProduct from "../models/readymadeproducts.js"; // default export in your schema
import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";
import { Cart } from "../models/Cart.js";

import Dropproduct from "../models/dropproduct.model.js"; // ✅ NEW
import { attachReadymadePricing, getReadymadePricing } from "../utils/readymadePricing.js";
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOrCreateActiveCart = async (userId) => {
  try {
    return await Cart.findOneAndUpdate(
      { user: userId, status: "ACTIVE" },
      { $setOnInsert: { user: userId, status: "ACTIVE", items: [] } },
      {
        new: true,
        upsert: true,
      }
    );
  } catch (error) {
    // If two requests race on first cart creation, the unique ACTIVE-cart
    // index can reject one insert. Fetch the winner instead of surfacing 500.
    if (error?.code === 11000) {
      const existingCart = await Cart.findOne({ user: userId, status: "ACTIVE" });
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

const findActiveCartWithDetails = (userId) =>
  Cart.findOne({ user: userId, status: "ACTIVE" })
    .populate({
      path: "items.readymadeProduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
        { path: "brand", select: "name" },
      ],
    })
    .populate("items.dropproduct")
    .populate("items.design")
    .populate("items.product")
    .lean();

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

const buildActiveCartResponse = async (userId) => {
  const cart = await findActiveCartWithDetails(userId);
  if (!cart) return null;

  return {
    ...cart,
    items: enrichCartItems(cart.items || []),
  };
};

export const addToCart = async (req, res) => {
  const userId = req.user?._id;
  const body = req.body || {};
  let requestContext = buildAddToCartLogContext(body, {
    userId: userId ? String(userId) : null,
  });

  try {
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      kind,
      qty = 1,
      readymadeProductId,
      dropproductId,          // ✅ NEW
      designId,
      size,
    } = body;
    const effectiveDesignId = designId || body.design;
    const requestedSize = size || body.selectedSize;

    requestContext = buildAddToCartLogContext(body, {
      userId: String(userId),
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
    if (!["READYMADE", "DESIGN"].includes(kind)) {
      return res.status(400).json({ message: "kind must be READYMADE or DESIGN" });
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
    const cart = await getOrCreateActiveCart(userId);
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

      cart.items[idx].qty = nextQty;
      cart.items[idx].size = String(cart.items[idx].size || "M").toUpperCase();

      if (kind === "DESIGN" && designPriceSnapshot) {
        cart.items[idx].unitPrice = designPriceSnapshot.unitPrice;
        cart.items[idx].basePrice = designPriceSnapshot.basePrice;
        cart.items[idx].priceDetails = designPriceSnapshot.priceDetails;
      }

      await cart.save();

      const responseCart = await buildActiveCartResponse(userId);
      return res.status(200).json({ message: "Cart updated", cart: responseCart });
    }

    cart.items.push(itemToInsert);
    await cart.save();

    const responseCart = await buildActiveCartResponse(userId);
    return res.status(201).json({ message: "Added to cart", cart: responseCart });
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
    const userId = req.user?._id;

    if (!userId)
      return res.status(401).json({ message: "Unauthorized" });

    const cart = await buildActiveCartResponse(userId);

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
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" });
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

      const isOwner = d.user?.toString() === userId.toString();
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

    const responseCart = await buildActiveCartResponse(userId);
    return res.status(200).json({ message: "Quantity updated", cart: responseCart });
  } catch (err) {
    console.error("updateCartItemQty error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




export const removeCartItem = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    item.deleteOne(); // remove subdocument
    await cart.save();

    const responseCart = await buildActiveCartResponse(userId);
    return res.status(200).json({ message: "Item removed", cart: responseCart });
  } catch (err) {
    console.error("removeCartItem error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

