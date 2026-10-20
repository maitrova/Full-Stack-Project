import fs from "fs";
import path from "path";
import HomepageBanners from "../models/HomepageBanners.js";
import { homepageBannersDir } from "../middleware/homepageBannerUpload.js";

// Banner slots shown on the storefront home page (see frontend HomeHero /
// MakeItYoursBanner / ComboPacksPromoBanner).
export const BANNER_SLOTS = ["hero", "makeItYours", "betterTogether"];

const outputsDir = path.join(process.cwd(), "outputs");
const MANAGED_PREFIX = "outputs/homepage-banners/";

export const isValidSlot = (slot) => BANNER_SLOTS.includes(String(slot || ""));

export const normalizeAlt = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);

// Stored image paths look like "outputs/homepage-banners/<file>" (same scheme as blog covers).
export const toStoredImagePath = (file) => {
  if (!file?.path) return "";
  const relativePath = path.relative(outputsDir, file.path).split(path.sep).join("/");
  return `outputs/${relativePath}`;
};

export const isManagedBannerPath = (imagePath) => {
  const value = String(imagePath || "");
  return value.startsWith(MANAGED_PREFIX) && !value.includes("..");
};

export const bannersResponse = (doc) =>
  BANNER_SLOTS.reduce(
    (acc, slot) => {
      acc[slot] = {
        image: String(doc?.[slot]?.image || ""),
        alt: String(doc?.[slot]?.alt || ""),
      };
      return acc;
    },
    { updatedAt: doc?.updatedAt || null }
  );

const removeLocalBannerImage = (imagePath) => {
  if (!isManagedBannerPath(imagePath)) return;
  const absolutePath = path.join(outputsDir, imagePath.replace(/^outputs\//, ""));
  if (!absolutePath.startsWith(homepageBannersDir)) return;
  if (!fs.existsSync(absolutePath)) return;
  try {
    fs.unlinkSync(absolutePath);
  } catch (error) {
    console.warn("Failed to delete homepage banner image:", absolutePath, error.message);
  }
};

const discardUpload = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
  }
};

const getOrCreateBanners = async () => {
  let banners = await HomepageBanners.findOne({ key: "main" });
  if (!banners) {
    banners = await HomepageBanners.create({ key: "main" });
  }
  return banners;
};

export const getHomepageBanners = async (req, res) => {
  try {
    const banners = await getOrCreateBanners();
    res.set("Cache-Control", "public, max-age=60");
    res.json(bannersResponse(banners));
  } catch (error) {
    console.error("getHomepageBanners error:", error);
    res.status(500).json({ message: "Failed to load homepage banners" });
  }
};

// PUT /admin/:slot  (multipart: optional "image" file + "alt" text)
export const updateHomepageBanner = async (req, res) => {
  const { slot } = req.params;
  if (!isValidSlot(slot)) {
    discardUpload(req.file);
    return res.status(400).json({ message: `Unknown banner slot "${slot}"` });
  }

  try {
    const banners = await getOrCreateBanners();
    const previousImage = banners[slot]?.image || "";
    const nextImage = req.file ? toStoredImagePath(req.file) : previousImage;
    const nextAlt = req.body?.alt !== undefined ? normalizeAlt(req.body.alt) : banners[slot]?.alt || "";

    banners[slot] = { image: nextImage, alt: nextAlt };
    await banners.save();

    if (req.file && previousImage && previousImage !== nextImage) {
      removeLocalBannerImage(previousImage);
    }

    return res.json({ message: "Banner updated", banners: bannersResponse(banners) });
  } catch (error) {
    discardUpload(req.file);
    console.error("updateHomepageBanner error:", error);
    return res.status(500).json({ message: "Failed to update banner" });
  }
};

// DELETE /admin/:slot/image  — removes the photo (the banner falls back to its default look).
export const removeHomepageBannerImage = async (req, res) => {
  const { slot } = req.params;
  if (!isValidSlot(slot)) {
    return res.status(400).json({ message: `Unknown banner slot "${slot}"` });
  }

  try {
    const banners = await getOrCreateBanners();
    const previousImage = banners[slot]?.image || "";
    banners[slot] = { image: "", alt: banners[slot]?.alt || "" };
    await banners.save();
    removeLocalBannerImage(previousImage);
    return res.json({ message: "Banner photo removed", banners: bannersResponse(banners) });
  } catch (error) {
    console.error("removeHomepageBannerImage error:", error);
    return res.status(500).json({ message: "Failed to remove banner photo" });
  }
};
