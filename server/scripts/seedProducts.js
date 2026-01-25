import mongoose from "mongoose";

import { Product } from "../models/Product.js";
import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/db.js";

connectDB();

async function run() {
  const products = [
    {
      name: "Hoodie",
      slug: "hoodie",
      category: "hoodie",
      subCategory: "outerwear",
      basePrice: 999,

      // ✅ size-based pricing
      sizePricing: [
        { size: "S", price: 900 },
        { size: "M", price: 1000 },
        { size: "L", price: 1100 },
        { size: "XL", price: 1200 },
        { size: "XXL", price: 1300 },
      ],

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

      sizePricing: [
        { size: "S", price: 850 },
        { size: "M", price: 900 },
        { size: "L", price: 950 },
        { size: "XL", price: 999 },
        { size: "XXL", price: 1050 },
      ],

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

      sizePricing: [
        { size: "S", price: 699 },
        { size: "M", price: 749 },
        { size: "L", price: 799 },
        { size: "XL", price: 849 },
        { size: "XXL", price: 899 },
      ],

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

      sizePricing: [
        { size: "S", price: 849 },
        { size: "M", price: 899 },
        { size: "L", price: 949 },
        { size: "XL", price: 999 },
        { size: "XXL", price: 1099 },
      ],

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

      sizePricing: [
        { size: "S", price: 599 },
        { size: "M", price: 649 },
        { size: "L", price: 699 },
        { size: "XL", price: 749 },
        { size: "XXL", price: 799 },
      ],

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

      sizePricing: [
        { size: "XS", price: 699 },
        { size: "S", price: 749 },
        { size: "M", price: 799 },
        { size: "L", price: 849 },
        { size: "XL", price: 899 },
      ],

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

      sizePricing: [
        { size: "XS", price: 699 },
        { size: "S", price: 749 },
        { size: "M", price: 799 },
        { size: "L", price: 849 },
        { size: "XL", price: 899 },
      ],

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
