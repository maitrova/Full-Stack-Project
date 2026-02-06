import mongoose from "mongoose";
// import { Cart } from "../models/Cart.js";
import ReadymadeProduct from "../models/readymadeproducts.js"; // default export in your schema
import { Design } from "../models/Design.js";
import { Cart } from "../models/Cart.js";

import Dropproduct from "../models/dropproduct.model.js"; // ✅ NEW
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOrCreateActiveCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId, status: "ACTIVE" });
  if (!cart) {
    cart = await Cart.create({ user: userId, status: "ACTIVE", items: [] });
  }
  return cart;
};

const computeDesignUnitPrice = (designDoc) => {
  const sale = Number(designDoc.salePrice || 0);
  const calc = Number(designDoc.calculatedPrice || 0);
  const base = Number(designDoc.basePrice || 0);

  const price = (sale > 0 ? sale : 0) || (calc > 0 ? calc : 0) || base;
  return price;
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      kind,
      qty = 1,
      readymadeProductId,
      dropproductId,          // ✅ NEW
      designId,
      size,
    } = req.body;

    const parsedQty = Number(qty);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: "qty must be an integer >= 1" });
    }
    if (!["READYMADE", "DESIGN"].includes(kind)) {
      return res.status(400).json({ message: "kind must be READYMADE or DESIGN" });
    }

    const normalizedSize = size && String(size).trim() ? String(size).trim() : "";

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

      let unitPrice = Number(product.price || 0);
      let availableStock = Number(product.stock || 0);

      if (hasVariants) {
        const variant = product.variants.find(
          (v) => String(v.size).toUpperCase() === String(normalizedSize).toUpperCase()
        );
        if (!variant) {
          return res.status(400).json({ message: "Selected size is not available" });
        }
        unitPrice = Number(variant.price || 0);
        availableStock = Number(variant.stock || 0);
      }

      if (!(unitPrice >= 0)) {
        return res.status(400).json({ message: "Invalid price" });
      }
      if (availableStock < parsedQty) {
        return res.status(400).json({ message: "Not enough stock" });
      }

      const finalSize = (hasVariants ? normalizedSize : (normalizedSize || "M")).toUpperCase();

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
        currency: product.currency || "INR",
        previewImage: product.images?.[0] || null,
        signature,
      };
    }

    // =========================
    // DESIGN
    // =========================
    if (kind === "DESIGN") {
      if (!designId || !isValidObjectId(designId)) {
        return res.status(400).json({ message: "Valid designId is required" });
      }

      const design = await Design.findById(designId).lean();
      if (!design) return res.status(404).json({ message: "Design not found" });

      const unitPrice = computeDesignUnitPrice(design);
      if (!(unitPrice > 0)) {
        return res.status(400).json({ message: "Design price is not valid" });
      }

      const finalSize = (normalizedSize || "M").toUpperCase();
      signature = `DESIGN:${design._id.toString()}:SIZE:${finalSize}`;

      itemToInsert = {
        kind: "DESIGN",
        readymadeProduct: null,
        dropproduct: null, // ✅ NEW (keep null)
        design: design._id,
        product: design.product || null,
        qty: parsedQty,
        size: finalSize,
        unitPrice,
        currency: "INR",
        previewImage: design.previewImage || null,
        signature,
      };
    }

    // =========================
    // CART MERGE / INSERT
    // =========================
    const cart = await getOrCreateActiveCart(userId);

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

        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

        let availableStock = Number(p.stock || 0);

        if (hasVariants) {
          const cartSize = String(cart.items[idx].size || "").trim();
          const variant = p.variants.find(
            (v) => String(v.size).toUpperCase() === cartSize.toUpperCase()
          );
          if (!variant) return res.status(400).json({ message: "Selected size is not available" });
          availableStock = Number(variant.stock || 0);
        }

        if (availableStock < nextQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        // refresh snapshot price as well
        if (hasVariants) {
          const cartSize = String(cart.items[idx].size || "").trim();
          const variant = p.variants.find(
            (v) => String(v.size).toUpperCase() === cartSize.toUpperCase()
          );
          if (variant) cart.items[idx].unitPrice = Number(variant.price || cart.items[idx].unitPrice);
        } else {
          cart.items[idx].unitPrice = Number(p.price || cart.items[idx].unitPrice);
        }

        cart.items[idx].currency = p.currency || cart.items[idx].currency;
        cart.items[idx].previewImage = p.images?.[0] || cart.items[idx].previewImage;
      }

      cart.items[idx].qty = nextQty;
      cart.items[idx].size = String(cart.items[idx].size || "M").toUpperCase();

      await cart.save();
      return res.status(200).json({ message: "Cart updated", cart });
    }

    cart.items.push(itemToInsert);
    await cart.save();
    return res.status(201).json({ message: "Added to cart", cart });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




// cartController.js


export const getCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
      .populate("items.readymadeProduct")
      .populate("items.dropproduct") // ✅ NEW
      .populate("items.design")
      .populate("items.product")
      .lean();

    if (!cart) {
      return res.status(200).json({ message: "Cart is empty", cart: null });
    }

    // ✅ Optional enrichment for UI (readymade variant support)
    const enrichedItems = (cart.items || []).map((it) => {
      if (
        it.kind === "READYMADE" &&
        it.readymadeProduct &&
        Array.isArray(it.readymadeProduct.variants)
      ) {
        const v = it.readymadeProduct.variants.find(
          (x) => String(x.size).toUpperCase() === String(it.size || "M").toUpperCase()
        );
        return { ...it, activeVariant: v || null };
      }
      return it;
    });

    return res.status(200).json({
      cart: { ...cart, items: enrichedItems },
    });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ message: "Server error" });
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

        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

        let availableStock = Number(p.stock || p.totalStock || 0);
        let unitPrice = Number(p.price || 0);

        if (hasVariants) {
          const variant = p.variants.find(
            (v) => String(v.size || "").toUpperCase() === cartSize
          );

          if (!variant) {
            return res.status(400).json({ message: "Selected size is not available" });
          }

          availableStock = Number(variant.stock || 0);
          unitPrice = Number(variant.price || 0);
        }

        if (availableStock < parsedQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        // refresh snapshot fields
        item.unitPrice = unitPrice;
        item.currency = p.currency || "INR";
        item.previewImage = p.images?.[0] || null;

        // ensure ids are consistent
        item.size = cartSize;

      } else {
        // ✅ ReadymadeProduct flow (existing logic)
        const pId = item.readymadeProduct || item.readymadeProductId;
        const p = await ReadymadeProduct.findById(pId).lean();
        if (!p || p.isActive === false) {
          return res.status(404).json({ message: "Readymade product not found or inactive" });
        }

        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

        let availableStock = Number(p.stock || p.totalStock || 0);
        let unitPrice = Number(p.price || 0);

        if (hasVariants) {
          const variant = p.variants.find(
            (v) => String(v.size || "").toUpperCase() === cartSize
          );

          if (!variant) {
            return res.status(400).json({ message: "Selected size is not available" });
          }

          availableStock = Number(variant.stock || 0);
          unitPrice = Number(variant.price || 0);
        }

        if (availableStock < parsedQty) {
          return res.status(400).json({ message: "Not enough stock" });
        }

        item.unitPrice = unitPrice;
        item.currency = p.currency || "INR";
        item.previewImage = p.images?.[0] || null;

        item.size = cartSize;
      }
    }

    // =========================
    // DESIGN (your logic)
    // =========================
    if (item.kind === "DESIGN") {
      const d = await Design.findById(item.design).lean();
      if (!d) return res.status(404).json({ message: "Design not found" });

      const isOwner = d.user?.toString() === userId.toString();
      const isPublic = d.isPublished === true;
      if (!isOwner && !isPublic) {
        return res.status(403).json({ message: "You cannot update this design item" });
      }

      const unitPrice = computeDesignUnitPrice(d);
      if (!(unitPrice > 0)) return res.status(400).json({ message: "Design price invalid" });

      item.unitPrice = unitPrice;
      item.currency = "INR";
      item.previewImage = d.previewImage || null;
      item.product = d.product || item.product;
      item.size = cartSize;
    }

    item.qty = parsedQty;

    await cart.save();
    return res.status(200).json({ message: "Quantity updated", cart });
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

    return res.status(200).json({ message: "Item removed", cart });
  } catch (err) {
    console.error("removeCartItem error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

