import { generateVirtualTryOnPreview } from "../services/virtualTryOnService.js";

const parseMetadata = (rawMetadata) => {
  if (!rawMetadata) return {};
  if (typeof rawMetadata === "object") return rawMetadata;

  try {
    return JSON.parse(rawMetadata);
  } catch {
    throw new Error("Invalid metadata JSON");
  }
};

const resolvePublicBaseUrl = (req) => {
  const forwardedProtoHeader = String(req.headers["x-forwarded-proto"] || "").trim();
  const forwardedHostHeader = String(req.headers["x-forwarded-host"] || "").trim();
  const forwardedProto = forwardedProtoHeader.split(",")[0]?.trim();
  const forwardedHost = forwardedHostHeader.split(",")[0]?.trim();

  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "";

  return host ? `${protocol}://${host}` : "";
};

export const generateVirtualTryOn = async (req, res) => {
  try {
    const userImageFile = req.files?.userImage?.[0] || null;
    const garmentImageFile = req.files?.garmentImage?.[0] || null;

    if (!userImageFile) {
      return res.status(400).json({ error: "userImage is required" });
    }

    if (!garmentImageFile) {
      return res.status(400).json({ error: "garmentImage is required" });
    }

    const metadata = parseMetadata(req.body?.metadata);
    const result = await generateVirtualTryOnPreview({
      userImageFile,
      garmentImageFile,
      metadata,
      publicBaseUrl: resolvePublicBaseUrl(req),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Virtual try-on generation error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate virtual try-on preview",
    });
  }
};
