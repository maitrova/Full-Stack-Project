import { Cart } from "../models/addtocart.js";
import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";


const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// GET /api/cart
export const getMyCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);

    const populated = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.design");

    return res.json(populated);
  } catch (err) {
    console.error("Get cart error:", err);
    return res.status(500).json({ error: "Failed to get cart" });
  }
};

// POST /api/cart/items  (product → cart)
// POST /api/cart/items  (product → cart)
export const addProductToCart = async (req, res) => {
  try {
    const { productId, qty = 1, size, color = null } = req.body;

    if (!productId) return res.status(400).json({ error: "productId is required" });

    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ error: "qty must be >= 1" });
    }

    // ✅ Normalize size to enforce default "M"
    const normalizedSize = (size && String(size).trim()) ? String(size).trim() : "M";

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const cart = await getOrCreateCart(req.user._id);

    // ✅ same item key (product + size + color + no design)
    const idx = cart.items.findIndex((it) =>
      it.product.toString() === productId &&
      !it.design &&
      ((it.size && String(it.size).trim()) ? String(it.size).trim() : "M") === normalizedSize &&
      (it.color ?? null) === (color ?? null)
    );

    if (idx !== -1) {
      cart.items[idx].qty += parsedQty;
    } else {
      cart.items.push({
        product: product._id,
        design: null,
        qty: parsedQty,
        size: normalizedSize,          // ✅ always saved (M if not sent)
        color: color ?? null,
        unitPrice: product.basePrice,
        currency: product.currency || "INR",
      });
    }

    await cart.save();

    const populated = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.design");

    return res.status(201).json(populated);
  } catch (err) {
    console.error("Add product to cart error:", err);
    return res.status(500).json({ error: "Failed to add to cart" });
  }
};


// POST /api/cart/designs  (saved design → cart)
// POST /api/cart/designs  (saved design → cart)
export const addDesignToCart = async (req, res) => {
  try {
    const { designId, qty = 1, size, color = null } = req.body;

    if (!designId) return res.status(400).json({ error: "designId is required" });

    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ error: "qty must be >= 1" });
    }

    // ✅ Normalize size to enforce default "M"
    const normalizedSize = (size && String(size).trim()) ? String(size).trim() : "M";

    // ✅ design must belong to this user
    const design = await Design.findOne({ _id: designId, user: req.user._id });
    if (!design) return res.status(404).json({ error: "Design not found or not authorized" });

    const productId = design.product.toString();
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found for this design" });

    const cart = await getOrCreateCart(req.user._id);

    // ✅ same item key (product + design + size + color)
    const idx = cart.items.findIndex((it) =>
      it.product.toString() === productId &&
      it.design?.toString() === designId &&
      ((it.size && String(it.size).trim()) ? String(it.size).trim() : "M") === normalizedSize &&
      (it.color ?? null) === (color ?? null)
    );

    if (idx !== -1) {
      cart.items[idx].qty += parsedQty;
    } else {
      cart.items.push({
        product: product._id,
        design: design._id,
        qty: parsedQty,
        size: normalizedSize, // ✅ always saved (M if not sent)
        color: (color ?? design.productColor ?? null),
        unitPrice: product.basePrice,
        currency: product.currency || "INR",
      });
    }

    await cart.save();

    const populated = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.design");

    return res.status(201).json(populated);
  } catch (err) {
    console.error("Add design to cart error:", err);
    return res.status(500).json({ error: "Failed to add design to cart" });
  }
};
