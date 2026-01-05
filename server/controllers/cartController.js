import mongoose from "mongoose";
// import { Cart } from "../models/Cart.js";
import ReadymadeProduct from "../models/readymadeproducts.js"; // default export in your schema
import { Design } from "../models/Design.js";
import { Cart } from "../models/Cart.js";


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

/**
 * POST /api/cart/add
 * Body:
 *  - kind: "READYMADE" | "DESIGN"
 *  - qty: number
 *  - readymadeProductId (if READYMADE)
 *  - designId (if DESIGN)
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      kind,
      qty = 1,
      readymadeProductId,
      designId,
      size, // ✅ added
    } = req.body;

    const parsedQty = Number(qty);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: "qty must be an integer >= 1" });
    }
    if (!["READYMADE", "DESIGN"].includes(kind)) {
      return res.status(400).json({ message: "kind must be READYMADE or DESIGN" });
    }

    // ✅ normalize size (default M)
    const normalizedSize =
      size && String(size).trim() ? String(size).trim() : "M";

    let signature = "";
    let itemToInsert = null;

    // READYMADE
    if (kind === "READYMADE") {
      if (!readymadeProductId || !isValidObjectId(readymadeProductId)) {
        return res
          .status(400)
          .json({ message: "Valid readymadeProductId is required" });
      }

      const product = await ReadymadeProduct.findById(readymadeProductId).lean();
      if (!product || product.isActive === false) {
        return res
          .status(404)
          .json({ message: "Readymade product not found or inactive" });
      }

      if (product.stock < parsedQty) {
        return res.status(400).json({ message: "Not enough stock" });
      }

      // ✅ include size in signature so different sizes don't merge
      signature = `READYMADE:${product._id.toString()}:SIZE:${normalizedSize}`;

      itemToInsert = {
        kind: "READYMADE",
        readymadeProduct: product._id,
        design: null,
        product: null,
        qty: parsedQty,

        // ✅ store size in cart item
        size: normalizedSize,

        unitPrice: product.price,
        currency: product.currency || "INR",
        previewImage: product.images?.[0] || null,
        signature,
      };
    }

    // DESIGN
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

      // ✅ include size in signature here too (optional but consistent)
      signature = `DESIGN:${design._id.toString()}:SIZE:${normalizedSize}`;

      itemToInsert = {
        kind: "DESIGN",
        readymadeProduct: null,
        design: design._id,
        product: design.product || null,
        qty: parsedQty,

        // ✅ store size in cart item
        size: normalizedSize,

        unitPrice,
        currency: "INR",
        previewImage: design.previewImage || null,
        signature,
      };
    }

    const cart = await getOrCreateActiveCart(userId);

    // merge by signature
    const idx = cart.items.findIndex((it) => it.signature === signature);
    if (idx >= 0) {
      const nextQty = cart.items[idx].qty + parsedQty;

      // If READYMADE, re-check stock for merged qty
      if (kind === "READYMADE") {
        const p = await ReadymadeProduct.findById(readymadeProductId).lean();
        if (!p || p.isActive === false) {
          return res
            .status(404)
            .json({ message: "Readymade product not found or inactive" });
        }
        if (p.stock < nextQty) return res.status(400).json({ message: "Not enough stock" });
      }

      cart.items[idx].qty = nextQty;

      // Refresh snapshot fields (optional but recommended)
      cart.items[idx].unitPrice = itemToInsert.unitPrice;
      cart.items[idx].currency = itemToInsert.currency;
      cart.items[idx].previewImage = itemToInsert.previewImage;

      // ✅ ensure size is also set on existing merged item
      cart.items[idx].size = normalizedSize;

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

/**
 * GET /api/cart
 * Returns the active cart with populated items.
 */
export const getCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
      .populate("items.readymadeProduct")
      .populate("items.design")
      .populate("items.product")
      .lean();

    if (!cart) return res.status(200).json({ message: "Cart is empty", cart: null });

    return res.status(200).json({ cart });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/cart/item/:itemId
 * Body: { qty: number }
 * - qty must be integer >= 1
 * - For READYMADE items, checks stock for new qty
 */
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

    // If READYMADE, validate stock
    if (item.kind === "READYMADE") {
      const pId = item.readymadeProduct;
      const p = await ReadymadeProduct.findById(pId).lean();
      if (!p || p.isActive === false) {
        return res.status(404).json({ message: "Readymade product not found or inactive" });
      }
      if (p.stock < parsedQty) return res.status(400).json({ message: "Not enough stock" });

      // Optional: refresh price snapshot
      item.unitPrice = p.price;
      item.currency = p.currency || "INR";
      item.previewImage = p.images?.[0] || null;
    }

    // If DESIGN, optionally refresh price snapshot
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
    }

    item.qty = parsedQty;

    await cart.save();
    return res.status(200).json({ message: "Quantity updated", cart });
  } catch (err) {
    console.error("updateCartItemQty error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/cart/item/:itemId
 * Removes a cart item.
 */
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

