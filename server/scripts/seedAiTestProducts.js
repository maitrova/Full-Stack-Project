// Seed a varied local catalogue for testing the AI shopping chat.
//
//   node scripts/seedAiTestProducts.js           add or update the test products
//   node scripts/seedAiTestProducts.js --remove  delete everything this script added
//
// Only runs against a local MongoDB (127.0.0.1 / localhost) unless
// --allow-remote is passed. Every record it creates is tagged so --remove
// can delete exactly these and nothing else.
import "dotenv/config";
import mongoose from "mongoose";

import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import Brand from "../models/Brand.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";
import ComboPack from "../models/ComboPack.js";

const SEED_TAG = "ai-test-seed";
// Existing local image, used as a placeholder for every seeded product.
const IMAGE = "outputs/readymade-products/images/pngtree-drop-shoulder-t-shirt-transparent-background-png-image_14825545-1790601123750-md.webp";
const ALL_SIZES = ["S", "M", "L", "XL", "XXL"];

const variants = (price, { sizes = ALL_SIZES, outOfStock = [], stock = 25, xxlExtra = 0 } = {}) =>
  sizes.map((size) => ({
    size,
    price: size === "XXL" ? price + xxlExtra : price,
    stock: outOfStock.includes(size) ? 0 : stock,
    sku: "",
  }));

// category -> subCategory -> products
const READYMADE = {
  "T-Shirts": {
    "Men T-Shirts": [
      {
        title: "Oversized Black Cotton T-Shirt",
        description: "Heavyweight 220 GSM pure cotton oversized tee with dropped shoulders and a soft brushed finish. Breathable for everyday wear.",
        price: 999, salePrice: 799,
        merchandising: { productType: "T-Shirt", gender: "Men", colors: ["Black"], fabric: "100% Cotton, 220 GSM", fit: "Oversized", sleeve: "Half Sleeve", pattern: "Solid", style: "Streetwear", occasions: ["Casual", "College"], care: "Machine wash cold, dry in shade, do not bleach." },
        variants: variants(999, { outOfStock: ["XXL"] }),
        rating: 4.5, reviewCount: 38, bestSeller: true,
      },
      {
        title: "Classic White Crew Neck T-Shirt",
        description: "Everyday 180 GSM combed cotton crew neck tee. Lightweight and soft, ideal for summer.",
        price: 599,
        merchandising: { productType: "T-Shirt", gender: "Men", colors: ["White"], fabric: "Combed Cotton, 180 GSM", fit: "Regular Fit", sleeve: "Half Sleeve", pattern: "Solid", style: "Casual", occasions: ["Casual", "Daily Wear"], care: "Machine wash cold with similar colours." },
        variants: variants(599),
        rating: 4.2, reviewCount: 21,
      },
      {
        title: "Navy Striped Polo T-Shirt",
        description: "Cotton pique polo with contrast stripes, ribbed collar and two-button placket.",
        price: 1199, salePrice: 999,
        merchandising: { productType: "Polo T-Shirt", gender: "Men", colors: ["Navy Blue", "White"], fabric: "Cotton Pique", fit: "Regular Fit", sleeve: "Half Sleeve", pattern: "Striped", style: "Smart Casual", occasions: ["Office", "Casual"], care: "Machine wash cold, do not tumble dry." },
        variants: variants(1199, { sizes: ["M", "L", "XL"] }),
        rating: 4.4, reviewCount: 12,
      },
      {
        title: "Black Graphic Print T-Shirt",
        description: "Soft cotton tee with a bold front graphic print. Regular fit.",
        price: 699,
        merchandising: { productType: "T-Shirt", gender: "Unisex", colors: ["Black"], fabric: "Cotton, 180 GSM", fit: "Regular Fit", sleeve: "Half Sleeve", pattern: "Graphic Printed", style: "Streetwear", occasions: ["Casual"], care: "Wash inside out, do not iron on print." },
        variants: variants(699, { outOfStock: ["S"] }),
        rating: 4.0, reviewCount: 9, newArrival: true,
      },
      {
        title: "Olive Henley T-Shirt",
        description: "Three-button henley in slub cotton with a relaxed regular fit.",
        price: 849,
        merchandising: { productType: "Henley T-Shirt", gender: "Men", colors: ["Olive"], fabric: "Slub Cotton", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Casual", occasions: ["Casual", "Travel"], care: "Machine wash cold." },
        variants: variants(849),
      },
    ],
  },
  Shirts: {
    "Men Shirts": [
      {
        title: "Sky Blue Linen Shirt",
        description: "Breathable pure linen shirt with a relaxed fit. Made for hot, humid days.",
        price: 1899, salePrice: 1499,
        merchandising: { productType: "Shirt", gender: "Men", colors: ["Sky Blue"], fabric: "100% Linen", fit: "Relaxed Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Casual", occasions: ["Summer", "Vacation", "Casual"], care: "Gentle wash, line dry, iron while damp." },
        variants: variants(1899, { xxlExtra: 100 }),
        rating: 4.6, reviewCount: 17, bestSeller: true,
      },
      {
        title: "White Formal Cotton Shirt",
        description: "Crisp cotton poplin shirt with a slim fit and spread collar for office wear.",
        price: 1299,
        merchandising: { productType: "Shirt", gender: "Men", colors: ["White"], fabric: "Cotton Poplin", fit: "Slim Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Formal", occasions: ["Office", "Interview"], care: "Machine wash warm, iron on medium." },
        variants: variants(1299),
      },
      {
        title: "Red Check Casual Shirt",
        description: "Brushed cotton flannel shirt in a red and black check.",
        price: 1099,
        merchandising: { productType: "Shirt", gender: "Men", colors: ["Red", "Black"], fabric: "Cotton Flannel", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Checked", style: "Casual", occasions: ["Casual", "Winter"], care: "Machine wash cold, tumble dry low." },
        variants: variants(1099, { sizes: ["M", "L", "XL", "XXL"] }),
      },
    ],
  },
  Hoodies: {
    "Men Hoodies": [
      {
        title: "Charcoal Fleece Hoodie",
        description: "Warm 320 GSM brushed fleece pullover hoodie with kangaroo pocket and lined hood.",
        price: 1799, salePrice: 1399,
        merchandising: { productType: "Hoodie", gender: "Unisex", colors: ["Charcoal Grey"], fabric: "Cotton-Poly Fleece, 320 GSM", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Casual", occasions: ["Winter", "Travel"], care: "Wash inside out, do not tumble dry." },
        variants: variants(1799),
        rating: 4.7, reviewCount: 44, bestSeller: true,
      },
      {
        title: "Maroon Zip Hoodie",
        description: "Full-zip fleece hoodie in maroon with side pockets.",
        price: 1999,
        merchandising: { productType: "Hoodie", gender: "Unisex", colors: ["Maroon"], fabric: "Cotton Fleece", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Casual", occasions: ["Winter"], care: "Machine wash cold." },
        // Fully sold out, for availability questions.
        variants: variants(1999, { outOfStock: ALL_SIZES }),
      },
    ],
  },
  Kurtas: {
    "Men Kurtas": [
      {
        title: "Mustard Cotton Kurta",
        description: "Straight-cut cotton kurta in mustard with a mandarin collar. Comfortable for festivals and family functions.",
        price: 1299,
        merchandising: { productType: "Kurta", gender: "Men", colors: ["Mustard"], fabric: "Cotton", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Solid", style: "Ethnic", occasions: ["Festive", "Pooja"], care: "Hand wash or gentle machine wash, dry in shade." },
        variants: variants(1299, { sizes: ["M", "L", "XL"] }),
      },
      {
        title: "White Chikankari Kurta",
        description: "Hand-embroidered Lucknowi chikankari kurta in soft cotton. Pairs well with white pyjamas.",
        price: 2199, salePrice: 1799,
        merchandising: { productType: "Kurta", gender: "Men", colors: ["White"], fabric: "Cotton", fit: "Regular Fit", sleeve: "Full Sleeve", pattern: "Embroidered", style: "Ethnic", occasions: ["Festive", "Wedding"], care: "Dry clean recommended." },
        variants: variants(2199),
        rating: 4.8, reviewCount: 26,
      },
    ],
    "Women Kurtis": [
      {
        title: "Pink Floral Rayon Kurti",
        description: "Flowy A-line rayon kurti with an all-over floral print and three-quarter sleeves.",
        price: 899,
        merchandising: { productType: "Kurti", gender: "Women", colors: ["Pink"], fabric: "Rayon", fit: "A-Line", sleeve: "Three-Quarter Sleeve", pattern: "Floral Printed", style: "Ethnic", occasions: ["Daily Wear", "Office"], care: "Hand wash cold, dry in shade." },
        variants: variants(899, { sizes: ["XS", "S", "M", "L", "XL"] }),
      },
    ],
  },
  Jeans: {
    "Men Jeans": [
      {
        title: "Dark Blue Slim Fit Jeans",
        description: "Stretch denim jeans with a slim fit and mid rise.",
        price: 1999,
        merchandising: { productType: "Jeans", gender: "Men", colors: ["Dark Blue"], fabric: "Stretch Denim", fit: "Slim Fit", pattern: "Solid", style: "Casual", occasions: ["Casual", "College"], care: "Wash inside out in cold water." },
        variants: variants(1999, { sizes: ["S", "M", "L", "XL"] }),
      },
    ],
  },
};

const DROPS = [
  {
    name: "Galaxy Oversized Tee - Drop 01",
    description: "Limited Drop 01 oversized tee with a glow-in-the-dark galaxy print on 240 GSM cotton. Only one run.",
    category: "T-Shirts", subCategory: "Drop 01",
    salePrice: 1099,
    variants: variants(1299, { stock: 8, outOfStock: ["S"] }),
    newArrival: true,
  },
  {
    name: "Retro Racer Hoodie - Drop 01",
    description: "Limited Drop 01 heavyweight hoodie with retro racing graphics on the back.",
    category: "Hoodies", subCategory: "Drop 01",
    variants: variants(2299, { stock: 5 }),
  },
  {
    name: "Monsoon Windbreaker - Drop 02",
    description: "Water-resistant nylon windbreaker from Drop 02, packable into its own pocket.",
    category: "Jackets", subCategory: "Drop 02",
    variants: variants(2499, { sizes: ["M", "L", "XL"], stock: 6 }),
  },
];

const COMBOS = [
  {
    name: "Everyday Tee Duo",
    slug: "ai-test-everyday-tee-duo",
    shortDescription: "The Classic White Crew Neck and the Oversized Black Cotton T-Shirt together at a combo price.",
    comboPrice: 1199,
    discountPercentage: 14,
    titles: ["Classic White Crew Neck T-Shirt", "Oversized Black Cotton T-Shirt"],
  },
  {
    name: "Winter Layer Pack",
    slug: "ai-test-winter-layer-pack",
    shortDescription: "Charcoal Fleece Hoodie with an Olive Henley T-Shirt to layer underneath.",
    comboPrice: 1999,
    discountPercentage: 11,
    titles: ["Charcoal Fleece Hoodie", "Olive Henley T-Shirt"],
  },
];

const isLocal = (url) => /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url || "");

async function ensureTaxonomy(categoryName, subCategoryName) {
  const category = await Category.findOneAndUpdate(
    { name: categoryName },
    { $setOnInsert: { name: categoryName, thumbnail: IMAGE, altText: SEED_TAG, isActive: true } },
    { upsert: true, new: true }
  );
  const subCategory = await SubCategory.findOneAndUpdate(
    { name: subCategoryName, category: category._id },
    { $setOnInsert: { name: subCategoryName, category: category._id, thumbnail: IMAGE, altText: SEED_TAG, isActive: true } },
    { upsert: true, new: true }
  );
  const brand = await Brand.findOneAndUpdate(
    { name: "Maitrova Test", subCategory: subCategory._id },
    { $setOnInsert: { name: "Maitrova Test", subCategory: subCategory._id } },
    { upsert: true, new: true }
  );
  return { category, subCategory, brand };
}

async function seed() {
  let readymadeCount = 0;
  for (const [categoryName, subCategories] of Object.entries(READYMADE)) {
    for (const [subCategoryName, products] of Object.entries(subCategories)) {
      const { category, subCategory, brand } = await ensureTaxonomy(categoryName, subCategoryName);
      for (const product of products) {
        const existing = await ReadymadeProduct.findOne({ title: product.title });
        const document = existing || new ReadymadeProduct();
        document.set({
          ...product,
          salePrice: product.salePrice ?? null,
          category: category._id,
          subCategory: subCategory._id,
          brand: brand._id,
          merchandising: { ...product.merchandising, searchTags: [SEED_TAG] },
          stock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
          images: [{ url: IMAGE, altText: product.title }],
          thumbnail: IMAGE,
          isActive: true,
        });
        await document.save();
        readymadeCount += 1;
      }
    }
  }

  for (const drop of DROPS) {
    const existing = await Dropproduct.findOne({ name: drop.name });
    const document = existing || new Dropproduct();
    document.set({ ...drop, salePrice: drop.salePrice ?? null, images: [{ url: IMAGE, altText: drop.name }], isActive: true });
    await document.save();
  }

  for (const combo of COMBOS) {
    const products = await Promise.all(combo.titles.map((title) => ReadymadeProduct.findOne({ title })));
    const { titles, ...fields } = combo;
    await ComboPack.findOneAndUpdate(
      { slug: combo.slug },
      {
        ...fields,
        items: products.map((product, index) => ({ product: product._id, sortOrder: index })),
        featuredImage: IMAGE,
        status: "ACTIVE",
        imageMode: "CUSTOM_IMAGES",
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Seeded ${readymadeCount} readymade, ${DROPS.length} drop products and ${COMBOS.length} combo packs.`);
  console.log("The chat sees them immediately. Semantic search embeddings are added by FastAPI's indexer within a few minutes.");
}

async function remove() {
  const readymade = await ReadymadeProduct.deleteMany({ "merchandising.searchTags": SEED_TAG });
  const drops = await Dropproduct.deleteMany({ name: { $in: DROPS.map((drop) => drop.name) } });
  await ComboPack.deleteMany({ slug: { $in: COMBOS.map((combo) => combo.slug) } });
  const seededSubCategories = await SubCategory.find({ altText: SEED_TAG }, { _id: 1 });
  const brands = await Brand.deleteMany({ name: "Maitrova Test", subCategory: { $in: seededSubCategories.map((item) => item._id) } });
  const subCategories = await SubCategory.deleteMany({ altText: SEED_TAG });
  const categories = await Category.deleteMany({ altText: SEED_TAG });
  console.log(
    `Removed ${readymade.deletedCount} readymade, ${drops.deletedCount} drop products, ` +
    `${categories.deletedCount} categories, ${subCategories.deletedCount} sub-categories, ${brands.deletedCount} brands.`
  );
}

const url = process.env.MONGOOSE_URL;
if (!isLocal(url) && !process.argv.includes("--allow-remote")) {
  console.error("Refusing to seed: MONGOOSE_URL is not a local MongoDB. Pass --allow-remote to override.");
  process.exit(1);
}

try {
  await mongoose.connect(url);
  if (process.argv.includes("--remove")) await remove();
  else await seed();
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
