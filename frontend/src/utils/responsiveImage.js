const IMAGE_BASE_URL =
  import.meta.env.VITE_IMAGE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://maitrova.in/backend";

const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
const SPECIAL_URL_RE = /^(?:data:|blob:)/i;
const OUTPUTS_SEGMENT_RE = /(?:^|\/)outputs\/.+$/i;

export const getRawImagePath = (image) => {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (typeof image === "object") {
    return image.url || image.path || image.src || null;
  }
  return null;
};

export const getImageAltText = (image, fallback = "") => {
  if (!image || typeof image !== "object") {
    return fallback;
  }

  return String(image.altText || fallback || "").trim();
};

export const buildImageUrl = (image) => {
  const rawPath = getRawImagePath(image);
  if (!rawPath) return "";
  if (ABSOLUTE_URL_RE.test(rawPath) || SPECIAL_URL_RE.test(rawPath)) {
    return rawPath;
  }

  const normalizedRawPath = String(rawPath).replace(/\\/g, "/");
  const outputsMatch = normalizedRawPath.match(OUTPUTS_SEGMENT_RE);
  const publicPath = outputsMatch ? outputsMatch[0].replace(/^\/+/, "") : normalizedRawPath;

  const baseUrl = IMAGE_BASE_URL.endsWith("/")
    ? IMAGE_BASE_URL.slice(0, -1)
    : IMAGE_BASE_URL;

  return `${baseUrl}${publicPath.startsWith("/") ? "" : "/"}${publicPath}`;
};

const buildVariantPath = (image, variant) => {
  const rawPath = getRawImagePath(image);
  if (!rawPath || ABSOLUTE_URL_RE.test(rawPath) || SPECIAL_URL_RE.test(rawPath)) {
    return null;
  }

  const match = rawPath.match(/^(.*?)-(blur|sm|md)\.webp(\?.*)?$/i);
  if (!match) return null;

  return `${match[1]}-${variant}.webp${match[3] || ""}`;
};

export const getResponsiveImageProps = (
  image,
  {
    sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    loading = "lazy",
    decoding = "async",
  } = {}
) => {
  const rawPath = getRawImagePath(image);
  const medium = buildVariantPath(rawPath, "md");
  const small = buildVariantPath(rawPath, "sm");
  const blur = buildVariantPath(rawPath, "blur");
  const src = buildImageUrl(medium || rawPath);

  const srcSet =
    small && medium
      ? `${buildImageUrl(small)} 300w, ${buildImageUrl(medium)} 600w`
      : undefined;

  return {
    src,
    srcSet,
    sizes: srcSet ? sizes : undefined,
    placeholder: blur ? buildImageUrl(blur) : undefined,
    loading,
    decoding,
    fetchPriority: loading === "eager" ? "high" : "low",
  };
};

