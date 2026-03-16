import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { createReadymadeThumbnail } from "../utils/imageOptimization.js";

const shouldRefreshExisting = process.argv.includes("--refresh-existing");

const getImagePath = (image) => {
  if (!image) return null;
  return typeof image === "string" ? image : image.url || null;
};

async function run() {
  await connectDB();

  const products = await ReadymadeProduct.find({})
    .select("_id title images thumbnail")
    .lean();

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const currentThumbnail = getImagePath(product.thumbnail);
    const firstImagePath = getImagePath(product.images?.[0]);

    if (currentThumbnail && !shouldRefreshExisting) {
      skipped += 1;
      continue;
    }

    const sourcePath = firstImagePath || currentThumbnail;

    if (!sourcePath) {
      skipped += 1;
      continue;
    }

    try {
      const nextThumbnail = await createReadymadeThumbnail(sourcePath);

      if (!nextThumbnail || nextThumbnail === currentThumbnail) {
        skipped += 1;
        continue;
      }

      await ReadymadeProduct.updateOne(
        { _id: product._id },
        { $set: { thumbnail: nextThumbnail } }
      );

      updated += 1;
      console.log(`Updated thumbnail for ${product.title || product._id}`);
    } catch (error) {
      failed += 1;
      console.error(
        `Failed for ${product.title || product._id}: ${error.message}`
      );
    }
  }

  console.log(
    `Backfill complete. Updated: ${updated}, skipped: ${skipped}, failed: ${failed}`
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
