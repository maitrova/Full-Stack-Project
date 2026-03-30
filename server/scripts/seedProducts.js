import mongoose from "mongoose";

import { Product } from "../models/Product.js";
import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/db.js";

connectDB();

async function run() {
  const defaultColors = [
    { value: "#FFFFFF", label: "White" },
    { value: "#000000", label: "Black" },
    { value: "#1D4ED8", label: "Royal Blue" },
    { value: "#DC2626", label: "Red" },
    { value: "#16A34A", label: "Green" },
    { value: "#F59E0B", label: "Mustard" },
  ];

  const buildSizePricing = (entries) =>
    entries.map(({ size, price, stock = 100 }) => ({ size, price, stock }));

  const products = [
    {
      name: "Hoodie",
      slug: "hoodie",
      category: "hoodie",
      subCategory: "outerwear",
      basePrice: 999,

      // ✅ size-based pricing
      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "S", price: 899, stock: 60 },
        { size: "M", price: 899, stock: 75 },
        { size: "L", price: 899, stock: 75 },
        { size: "XL", price: 899, stock: 50 },
        { size: "XXL", price: 899, stock: 35 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/hoodie/front.png", maskUrl: "/masks/hoodie/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/hoodie/back.png", maskUrl: "/masks/hoodie/back_mask.png" },
        { code: "right", label: "Right Sleeve", mockupUrl: "/mockups/hoodie/right.png", maskUrl: "/masks/hoodie/right_mask.png" },
        { code: "left", label: "Left Sleeve", mockupUrl: "/mockups/hoodie/left.png", maskUrl: "/masks/hoodie/left_mask.png" },
      ],
    },

    {
      name: "Sweatshirt",
      slug: "sweatshirt",
      category: "sweatshirt",
      subCategory: "outerwear",
      basePrice: 899,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "S", price: 799, stock: 65 },
        { size: "M", price: 799, stock: 80 },
        { size: "L", price: 799, stock: 80 },
        { size: "XL", price: 799, stock: 50 },
        { size: "XXL", price: 799, stock: 30 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/sweatshirt/front.png", maskUrl: "/masks/sweatshirt/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/sweatshirt/back.png", maskUrl: "/masks/sweatshirt/back_mask.png" },
      ],
    },

    {
      name: "Oversized Comfort T-Shirt",
      slug: "oversized-comfort-tee",
      category: "tshirt",
      subCategory: "casual",
      basePrice: 799,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "S", price: 699, stock: 70 },
        { size: "M", price: 699, stock: 90 },
        { size: "L", price: 699, stock: 90 },
        { size: "XL", price: 699, stock: 55 },
        { size: "XXL", price: 699, stock: 35 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/oversized-comfort-tee/front.png", maskUrl: "/masks/oversized-comfort-tee/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/oversized-comfort-tee/back.png", maskUrl: "/masks/oversized-comfort-tee/back_mask.png" },
      ],
    },

    {
      name: "Premium Polo Shirt",
      slug: "premium-polo",
      category: "polo",
      subCategory: "formal",
      basePrice: 899,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "S", price: 699, stock: 45 },
        { size: "M", price: 699, stock: 60 },
        { size: "L", price: 699, stock: 60 },
        { size: "XL", price: 699, stock: 40 },
        { size: "XXL", price: 699, stock: 20 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/premium-polo/front.png", maskUrl: "/masks/premium-polo/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/premium-polo/back.png", maskUrl: "/masks/premium-polo/back_mask.png" },
      ],
    },

    {
      name: "Classic Round Neck T-Shirt",
      slug: "classic-round-tee",
      category: "tshirt",
      subCategory: "casual",
      basePrice: 699,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "S", price: 499, stock: 80 },
        { size: "M", price: 499, stock: 100 },
        { size: "L", price: 499, stock: 100 },
        { size: "XL", price: 499, stock: 70 },
        { size: "XXL", price: 499, stock: 40 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/classic-round-tee/front.png", maskUrl: "/masks/classic-round-tee/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/classic-round-tee/back.png", maskUrl: "/masks/classic-round-tee/back_mask.png" },
      ],
    },

    {
      name: "Women's Crop Top",
      slug: "womens-crop-top",
      category: "womens",
      subCategory: "casual",
      basePrice: 749,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "XS", price: 349, stock: 30 },
        { size: "S", price: 349, stock: 45 },
        { size: "M", price: 349, stock: 45 },
        { size: "L", price: 349, stock: 35 },
        { size: "XL", price: 349, stock: 20 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/womens-crop-top/front.png", maskUrl: "/masks/womens-crop-top/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/womens-crop-top/back.png", maskUrl: "/masks/womens-crop-top/back_mask.png" },
      ],
    },

    {
      name: "Women's Round Neck T-Shirt",
      slug: "womens-round-tee",
      category: "womens",
      subCategory: "casual",
      basePrice: 749,

      colors: defaultColors,
      sizePricing: buildSizePricing([
        { size: "XS", price: 499, stock: 35 },
        { size: "S", price: 499, stock: 50 },
        { size: "M", price: 499, stock: 50 },
        { size: "L", price: 499, stock: 40 },
        { size: "XL", price: 499, stock: 25 },
      ]),

      views: [
        { code: "front", label: "Front", mockupUrl: "/mockups/womens-round-tee/front.png", maskUrl: "/masks/womens-round-tee/front_mask.png" },
        { code: "back", label: "Back", mockupUrl: "/mockups/womens-round-tee/back.png", maskUrl: "/masks/womens-round-tee/back_mask.png" },
      ],
    },
  ];

  for (const product of products) {
    await Product.findOneAndUpdate(
      { slug: product.slug },
      { $set: product },
      { upsert: true, new: true }
    );
  }

  console.log("✅ Seeded or updated products (with sizePricing)");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
