import HeaderBannerSettings from "../models/HeaderBannerSettings.js";

const DEFAULT_MESSAGES = [
  "Free Shipping Nationwide",
  "Custom Designs in 48 Hours",
  "Premium Quality Guaranteed",
];

const ensureAdmin = (req, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superuser")) {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const normalizeMessages = (messages = []) => {
  const cleaned = Array.isArray(messages)
    ? messages
        .map((message) => String(message || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return cleaned;
};

const normalizeBannerPayload = (body = {}, { fallbackToDefaults = false } = {}) => {
  const messages = normalizeMessages(body.messages);
  const couponCode = String(body.couponCode || "").trim();
  const rawCodMinimumOrderAmount = body.codMinimumOrderAmount;
  const codMinimumOrderAmount =
    rawCodMinimumOrderAmount === undefined || rawCodMinimumOrderAmount === null || rawCodMinimumOrderAmount === ""
      ? 0
      : Math.max(0, Number(rawCodMinimumOrderAmount) || 0);

  return {
    messages: messages.length > 0 ? messages : fallbackToDefaults ? DEFAULT_MESSAGES : [],
    couponCode,
    codMinimumOrderAmount,
  };
};

const bannerResponse = (doc) => ({
  messages: Array.isArray(doc?.messages) ? doc.messages : [],
  couponCode: String(doc?.couponCode || ""),
  codMinimumOrderAmount: Number(doc?.codMinimumOrderAmount || 0),
  updatedAt: doc?.updatedAt || null,
});

const getOrCreateSettings = async () => {
  let settings = await HeaderBannerSettings.findOne({ key: "main" });
  if (!settings) {
    settings = await HeaderBannerSettings.create({
      key: "main",
      messages: DEFAULT_MESSAGES,
      couponCode: "",
      codMinimumOrderAmount: 0,
    });
  }
  return settings;
};

export const getHeaderBanner = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(bannerResponse(settings));
  } catch (error) {
    console.error("getHeaderBanner error:", error);
    res.status(500).json({ message: "Failed to load header banner settings" });
  }
};

export const getHeaderBannerAdmin = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const settings = await getOrCreateSettings();
    res.json(bannerResponse(settings));
  } catch (error) {
    console.error("getHeaderBannerAdmin error:", error);
    res.status(500).json({ message: "Failed to load header banner settings" });
  }
};

export const updateHeaderBannerAdmin = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const payload = normalizeBannerPayload(req.body);
    const settings = await HeaderBannerSettings.findOneAndUpdate(
      { key: "main" },
      { $set: payload },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      message: "Header banner updated successfully",
      banner: bannerResponse(settings),
    });
  } catch (error) {
    console.error("updateHeaderBannerAdmin error:", error);
    res.status(500).json({ message: "Failed to update header banner settings" });
  }
};
