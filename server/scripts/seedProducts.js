// server/scripts/seedProducts.js
import mongoose from "mongoose";
import { Product } from "../models/Product.js";

import dotenv from "dotenv";
import connectDB from "../config/db.js";

dotenv.config();
connectDB();

async function run() {
  
  const products = [
    {
      name: "Hoodie",
      slug: "hoodie",
      category: "hoodie",
      basePrice: 999,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/hoodie/front.png",
          maskUrl: "/masks/hoodie/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/hoodie/back.png",
          maskUrl: "/masks/hoodie/back_mask.png",
        },
        {
          code: "right",
          label: "Right Sleeve",
          mockupUrl: "/mockups/hoodie/right.png",
          maskUrl: "/masks/hoodie/right_mask.png",
        },
        {
          code: "left",
          label: "Left Sleeve",
          mockupUrl: "/mockups/hoodie/left.png",
          maskUrl: "/masks/hoodie/left_mask.png",
        },
      ],
    },
    {
      name: "Sweatshirt",
      slug: "sweatshirt",
      category: "sweatshirt",
      basePrice: 899,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/sweatshirt/front.png",
          maskUrl: "/masks/sweatshirt/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/sweatshirt/back.png",
          maskUrl: "/masks/sweatshirt/back_mask.png",
        },
      ],
    },
    {
      name: "Oversized Comfort T-Shirt",
      slug: "oversized-comfort-tee",
      category: "tshirt",
      basePrice: 799,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/oversized-comfort-tee/front.png",
          maskUrl: "/masks/oversized-comfort-tee/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/oversized-comfort-tee/back.png",
          maskUrl: "/masks/oversized-comfort-tee/back_mask.png",
        },
      ],
    },
    {
      name: "Premium Polo Shirt",
      slug: "premium-polo",
      category: "polo",
      basePrice: 899,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/premium-polo/front.png",
          maskUrl: "/masks/premium-polo/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/premium-polo/back.png",
          maskUrl: "/masks/premium-polo/back_mask.png",
        },
      ],
    },
    {
      name: "Classic Round Neck T-Shirt",
      slug: "classic-round-tee",
      category: "tshirt",
      basePrice: 699,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/classic-round-tee/front.png",
          maskUrl: "/masks/classic-round-tee/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/classic-round-tee/back.png",
          maskUrl: "/masks/classic-round-tee/back_mask.png",
        },
      ],
    },
    {
      name: "Women's Crop Top",
      slug: "womens-crop-top",
      category: "womens",
      basePrice: 749,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/womens-crop-top/front.png",
          maskUrl: "/masks/womens-crop-top/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/womens-crop-top/back.png",
          maskUrl: "/masks/womens-crop-top/back_mask.png",
        },
      ],
    },
    {
      name: "Women's Round Neck T-Shirt",
      slug: "womens-round-tee",
      category: "womens",
      basePrice: 749,
      views: [
        {
          code: "front",
          label: "Front",
          mockupUrl: "/mockups/womens-round-tee/front.png",
          maskUrl: "/masks/womens-round-tee/front_mask.png",
        },
        {
          code: "back",
          label: "Back",
          mockupUrl: "/mockups/womens-round-tee/back.png",
          maskUrl: "/masks/womens-round-tee/back_mask.png",
        },
      ],
    },
  ];

  await Product.deleteMany({});
  await Product.insertMany(products);

  console.log("✅ Seeded products");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
