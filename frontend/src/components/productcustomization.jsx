// src/pages/DesignerPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProductBySlug } from "../redux/slices/productsSlice.js";
import { 
  fetchFolders, 
  fetchImages, 
  setCurrentFolder,
  clearCurrentFolder
} from "../redux/slices/admindesignuploads.js";
import RecolorEditor from "./RecolorEditor.jsx";
import { selectCurrentToken, selectCurrentUser } from "../redux/slices/Userslice.js";
import { addToCart } from "../redux/slices/Cartslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";
console.log("api_url:", API_URL); 
const IMAGE_URL = import.meta.env.VITE_IMAGE_URL;
console.log("image_url:", IMAGE_URL);
const FONT_OPTIONS = [
  "Impact, sans-serif",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "'Times New Roman', serif",
  "Georgia, serif",
  "'Comic Sans MS', cursive, sans-serif",
];



// Pricing constants
const FIXED_SIZE_INCHES = 4;
const PRICE_PER_SQ_INCH = 6;
const MINIMUM_DESIGN_CHARGE = 30;
const DISPLAY_DPI = 300;
const PRINT_DPI = 300;
const DEFAULT_IMAGE_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];
const DEFAULT_TEXT_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];
const SUPPORTED_DESIGN_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/x-tiff",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_DESIGN_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "avif",
  "heic",
  "heif",
]);
const SUPPORTED_DESIGN_FORMATS_LABEL = "PNG, JPG, JPEG, WEBP, GIF, BMP, TIFF, SVG, AVIF, HEIC, HEIF";
const SUPPORTED_DESIGN_ACCEPT = "image/*,.heic,.heif,.svg,.tif,.tiff";
const REMOVE_BG_RECOMMENDATION =
  "PNG usually gives the cleanest edges, but you can upload other common image formats too.";

const trackMetaAddToCart = ({
  productId,
  productName,
  quantity,
  unitPrice,
  currency = "INR",
}) => {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  const normalizedQuantity = Number(quantity || 1);
  const normalizedUnitPrice = Number(unitPrice || 0);
  const normalizedProductId = productId ? String(productId) : "";

  window.fbq("track", "AddToCart", {
    content_ids: normalizedProductId ? [normalizedProductId] : [],
    content_name: productName || "Customized Product",
    content_type: "product",
    contents: normalizedProductId
      ? [{ id: normalizedProductId, quantity: normalizedQuantity, item_price: normalizedUnitPrice }]
      : [],
    currency,
    value: normalizedUnitPrice * normalizedQuantity,
  });
};



const normalizeImagePriceRules = (rules = DEFAULT_IMAGE_PRICE_RULES) => {
  const source = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_IMAGE_PRICE_RULES;
  return source
    .map((entry) => {
      const rawMax = entry?.maxSideInches;
      const hasFiniteMax =
        rawMax !== null &&
        rawMax !== undefined &&
        String(rawMax).trim() !== "";
      const maxSideInches = hasFiniteMax ? Number(rawMax) : null;
      const price = Number(entry?.price || 0);

      if (hasFiniteMax && (!Number.isFinite(maxSideInches) || maxSideInches < 0)) {
        return null;
      }

      if (!Number.isFinite(price) || price < 0) {
        return null;
      }

      return { maxSideInches, price };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.maxSideInches === null) return 1;
      if (b.maxSideInches === null) return -1;
      return a.maxSideInches - b.maxSideInches;
    });
};

const resolveImagePriceRule = (wIn, hIn, rules = DEFAULT_IMAGE_PRICE_RULES) => {
  const largestSide = Math.max(Number(wIn || 0), Number(hIn || 0));
  if (!largestSide) return null;

  const normalizedRules = normalizeImagePriceRules(rules);
  return (
    normalizedRules.find(
      (rule) => rule.maxSideInches === null || largestSide <= rule.maxSideInches
    ) || normalizedRules[normalizedRules.length - 1] || null
  );
};

const getFixedImageLayerPricing = (wIn, hIn, rules = DEFAULT_IMAGE_PRICE_RULES) => {
  const matchedRule = resolveImagePriceRule(wIn, hIn, rules);
  return {
    matchedRule,
    price: Number(matchedRule?.price || 0),
  };
};

const formatImagePriceRuleLabel = (rule, index, rules = []) => {
  if (!rule) return "";

  const previousRule = index > 0 ? rules[index - 1] : null;
  const upperBound =
    rule.maxSideInches === null || rule.maxSideInches === undefined || rule.maxSideInches === ""
      ? null
      : Number(rule.maxSideInches);
  const lowerBound =
    previousRule?.maxSideInches === null || previousRule?.maxSideInches === undefined || previousRule?.maxSideInches === ""
      ? null
      : Number(previousRule.maxSideInches);

  if (upperBound === null) {
    return lowerBound !== null
      ? `Above ${lowerBound}" × ${lowerBound}"`
      : "Any image size";
  }

  if (lowerBound === null) {
    return `Up to ${upperBound}" × ${upperBound}"`;
  }

  return `Above ${lowerBound}" × ${lowerBound}" and up to ${upperBound}" × ${upperBound}"`;
};
// Tab options
const TABS = {
  PRODUCT_COLORS: 'productColors',
  DESIGNS: 'designs',
  TEXT: 'text',
  VIEWS: 'views',
  DESIGN_LIBRARY: 'designLibrary' // New tab
};

const ZONE_OPTIONS_BY_VIEW = {
  front: ["front-full", "pocket"],
  back: ["back-full"],
};

const getZoneOptionsForView = (viewCode, { supportsPocketZone = false } = {}) => {
  const zoneOptions = ZONE_OPTIONS_BY_VIEW[viewCode] || ["front-full"];
  return supportsPocketZone
    ? zoneOptions
    : zoneOptions.filter((zoneKey) => zoneKey !== "pocket");
};

const ZONE_LABELS = {
  "front-full": "Front",
  pocket: "Pocket",
  "back-full": "Back",
};

const INITIAL_ZONE_BOUNDARIES = {
  "front-full": { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.65 },
  pocket: { minX: 0.365, maxX: 0.635, minY: 0.67, maxY: 0.87 },
  "back-full": { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.75 },
};

const NON_CUSTOMIZABLE_VIEW_CODES = new Set(["left", "right"]);

const isCustomizableViewCode = (viewCode) =>
  !NON_CUSTOMIZABLE_VIEW_CODES.has(String(viewCode || "").toLowerCase());

const getCustomizableViews = (views = []) => {
  const filteredViews = (views || []).filter((view) => isCustomizableViewCode(view?.code));
  return filteredViews.length > 0 ? filteredViews : (views || []);
};

const MOBILE_TOOL_TABS = [
  { key: TABS.PRODUCT_COLORS, label: "Color" },
  { key: TABS.DESIGNS, label: "Design" },
  { key: TABS.TEXT, label: "Text" },
  { key: TABS.DESIGN_LIBRARY, label: "Library" },
];

const DEFAULT_COLOR_OPTIONS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#000000", label: "Black" },
  { value: "#FF6B6B", label: "Coral" },
  { value: "#4ECDC4", label: "Mint" },
  { value: "#45B7D1", label: "Sky" },
  { value: "#96CEB4", label: "Seafoam" },
  { value: "#FECA57", label: "Sunshine" },
  { value: "#FF9FF3", label: "Pink" },
  { value: "#54A0FF", label: "Azure" },
  { value: "#5F27CD", label: "Violet" },
  { value: "#00D2D3", label: "Teal" },
  { value: "#FF9F43", label: "Orange" },
];

const buildColorNameMap = (colorOptions = []) =>
  colorOptions.reduce((acc, option) => {
    acc[String(option?.value || "").toLowerCase()] = option?.label;
    return acc;
  }, {});

const getColorLabel = (colorValue, colorOptions = DEFAULT_COLOR_OPTIONS) => {
  if (!colorValue) return "Custom Color";
  const colorNameMap = buildColorNameMap(colorOptions);
  const normalized = colorValue.trim().toLowerCase();
  const label = colorNameMap[normalized];
  return label ? label : `Custom (${colorValue.toUpperCase()})`;
};

const getColorStockValue = (colorOption) => {
  const rawStock = colorOption?.stock;
  if (rawStock === null || rawStock === undefined || String(rawStock).trim() === "") {
    return null;
  }

  const numericStock = Number(rawStock);
  return Number.isFinite(numericStock) ? numericStock : null;
};

const isColorAvailable = (colorOption) => {
  const stock = getColorStockValue(colorOption);
  return stock === null || stock > 0;
};

const getFileExtension = (name = "") => {
  const parts = String(name).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
};

const getFilenameFromUrl = (url = "", fallback = "design.png") => {
  try {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname || "";
    const candidate = pathname.split("/").pop();
    return candidate || fallback;
  } catch {
    const pathname = String(url || "").split("?")[0];
    const candidate = pathname.split("/").pop();
    return candidate || fallback;
  }
};

const getDesignLayerDisplayName = (layer, index = 0) => {
  const rawName =
    layer?.sourceFile?.name ||
    layer?.originalFile?.name ||
    layer?.file?.name ||
    getFilenameFromUrl(layer?.imageUrl || "", `Design ${index + 1}`);

  const cleaned = String(rawName || "")
    .split("?")[0]
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return cleaned || `Design ${index + 1}`;
};

const getTextLayerDisplayName = (layer, index = 0) => {
  const text = String(layer?.text || "").replace(/\s+/g, " ").trim();
  if (!text) return `Text ${index + 1}`;
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
};

const withCacheBust = (url = "") => {
  if (!url) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}t=${Date.now()}`;
};

const stripApiSuffix = (url = "") => String(url || "").replace(/\/$/, "").replace(/\/api$/, "");

const resolveOutputAssetUrl = (relativePath = "") => {
  if (!relativePath) return "";
  if (/^(https?:)?\/\//i.test(relativePath)) return relativePath;

  const normalizedPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const apiBase = (API_URL || window.location.origin).replace(/\/$/, "");
  const publicBase = stripApiSuffix(IMAGE_URL || API_URL || window.location.origin);

  if (normalizedPath.startsWith("/api/")) {
    return `${publicBase}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("/outputs/")) {
    return `${apiBase}${normalizedPath}`;
  }

  return `${publicBase}${normalizedPath}`;
};

const isSupportedDesignSource = ({ name = "", type = "" } = {}) => {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType.startsWith("image/")) return true;
  if (SUPPORTED_DESIGN_MIME_TYPES.has(normalizedType)) return true;
  return SUPPORTED_DESIGN_EXTENSIONS.has(getFileExtension(name));
};

const shouldBypassRemoveBgFormatValidation = (designLayer) =>
  Boolean(designLayer?.isFromLibrary);

const createDefaultTextLayer = ({ zone = "front-full", viewCode = "front" } = {}) => ({
  id: "text-" + Date.now() + "-" + Math.random().toString(36).slice(2),
  text: "YOUR TEXT",
  x: 0.5,
  y: 0.5,
  zone,
  viewCode,
  fontSize: 120,
  color: "#000000",
  fontFamily: "Impact, sans-serif",
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  initialTargetWidthInches: 11.6,
  initialTargetHeightInches: 5.6,
  initialBaseFontSize: 120,
  initialTextSized: false,
});

const normalizeImageCrop = (crop = {}) => {
  const legacyZoom = Number(crop?.zoom);
  const derivedWidthRatio =
    Number.isFinite(Number(crop?.widthRatio))
      ? Number(crop.widthRatio)
      : Number.isFinite(legacyZoom) && legacyZoom > 1
        ? 1 / legacyZoom
        : 1;
  const derivedHeightRatio =
    Number.isFinite(Number(crop?.heightRatio))
      ? Number(crop.heightRatio)
      : Number.isFinite(legacyZoom) && legacyZoom > 1
        ? 1 / legacyZoom
        : 1;
  const widthRatio = Math.min(1, Math.max(0.15, derivedWidthRatio));
  const heightRatio = Math.min(1, Math.max(0.15, derivedHeightRatio));
  const rawOffsetX = Number(crop?.offsetX);
  const rawOffsetY = Number(crop?.offsetY);
  const normalizedOffsetX = Number.isFinite(rawOffsetX) ? Math.min(1, Math.max(-1, rawOffsetX)) : 0;
  const normalizedOffsetY = Number.isFinite(rawOffsetY) ? Math.min(1, Math.max(-1, rawOffsetY)) : 0;
  const sideMarginX = (1 - widthRatio) / 2;
  const sideMarginY = (1 - heightRatio) / 2;
  const rawLeftRatio = Number(crop?.leftRatio);
  const rawTopRatio = Number(crop?.topRatio);
  const leftRatio = Number.isFinite(rawLeftRatio)
    ? Math.max(0, Math.min(1 - widthRatio, rawLeftRatio))
    : Math.max(0, Math.min(1 - widthRatio, sideMarginX + normalizedOffsetX * sideMarginX));
  const topRatio = Number.isFinite(rawTopRatio)
    ? Math.max(0, Math.min(1 - heightRatio, rawTopRatio))
    : Math.max(0, Math.min(1 - heightRatio, sideMarginY + normalizedOffsetY * sideMarginY));
  const offsetX = sideMarginX <= 1e-6 ? 0 : (leftRatio - sideMarginX) / sideMarginX;
  const offsetY = sideMarginY <= 1e-6 ? 0 : (topRatio - sideMarginY) / sideMarginY;

  return {
    widthRatio,
    heightRatio,
    leftRatio,
    topRatio,
    offsetX,
    offsetY,
  };
};

const getImageCropViewportStyle = (crop = {}) => {
  const normalizedCrop = normalizeImageCrop(crop);
  const widthPercent = (1 / normalizedCrop.widthRatio) * 100;
  const heightPercent = (1 / normalizedCrop.heightRatio) * 100;
  const leftPercent = -((normalizedCrop.leftRatio / Math.max(normalizedCrop.widthRatio, 1e-6)) * 100);
  const topPercent = -((normalizedCrop.topRatio / Math.max(normalizedCrop.heightRatio, 1e-6)) * 100);

  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
  };
};

const getCropBoxRect = (crop = {}) => {
  const normalizedCrop = normalizeImageCrop(crop);

  return {
    left: normalizedCrop.leftRatio,
    top: normalizedCrop.topRatio,
    width: normalizedCrop.widthRatio,
    height: normalizedCrop.heightRatio,
  };
};

const cropRectToDraft = (rect) => {
  const widthRatio = Math.min(1, Math.max(0.15, rect.width));
  const heightRatio = Math.min(1, Math.max(0.15, rect.height));
  const sideMarginX = (1 - widthRatio) / 2;
  const sideMarginY = (1 - heightRatio) / 2;
  const offsetX = sideMarginX <= 1e-6 ? 0 : (rect.left - sideMarginX) / sideMarginX;
  const offsetY = sideMarginY <= 1e-6 ? 0 : (rect.top - sideMarginY) / sideMarginY;

  return normalizeImageCrop({
    widthRatio,
    heightRatio,
    leftRatio: Math.max(0, Math.min(1 - widthRatio, rect.left)),
    topRatio: Math.max(0, Math.min(1 - heightRatio, rect.top)),
    offsetX,
    offsetY,
  });
};

const getImageCropSourceRectForDraft = (img, crop = {}) => {
  const normalizedCrop = normalizeImageCrop(crop);
  const naturalWidth = Math.max(1, img?.naturalWidth || img?.width || 1);
  const naturalHeight = Math.max(1, img?.naturalHeight || img?.height || 1);
  const srcWidth = naturalWidth * normalizedCrop.widthRatio;
  const srcHeight = naturalHeight * normalizedCrop.heightRatio;
  const maxShiftX = Math.max(0, (naturalWidth - srcWidth) / 2);
  const maxShiftY = Math.max(0, (naturalHeight - srcHeight) / 2);

  return {
    naturalWidth,
    naturalHeight,
    srcX: naturalWidth * normalizedCrop.leftRatio,
    srcY: naturalHeight * normalizedCrop.topRatio,
    srcWidth,
    srcHeight,
  };
};

const loadImageForCrop = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing image source"));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

const resolveTrimImageSource = async (layer) => {
  if (layer?.sourceFile instanceof Blob) {
    const objectUrl = URL.createObjectURL(layer.sourceFile);
    return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  }

  if (layer?.originalFile instanceof Blob) {
    const objectUrl = URL.createObjectURL(layer.originalFile);
    return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  }

  if (layer?.file instanceof Blob) {
    const objectUrl = URL.createObjectURL(layer.file);
    return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  }

  const imageUrl = layer?.imageUrl;
  if (!imageUrl) {
    throw new Error("Missing layer image source");
  }

  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    console.warn("Trim source fetch failed, falling back to direct URL:", error);
    return { src: imageUrl, revoke: null };
  }
};

const trimCropDraftToVisiblePixels = async (layer, cropDraft) => {
  let cleanup = null;
  try {
    const { src, revoke } = await resolveTrimImageSource(layer);
    cleanup = revoke;
    const img = await loadImageForCrop(src);
    const { naturalWidth, naturalHeight, srcX, srcY, srcWidth, srcHeight } =
      getImageCropSourceRectForDraft(img, cropDraft);

    const maxSampleEdge = 1024;
    const sampleScale = Math.min(1, maxSampleEdge / Math.max(srcWidth, srcHeight, 1));
    const sampleWidth = Math.max(1, Math.round(srcWidth * sampleScale));
    const sampleHeight = Math.max(1, Math.round(srcHeight * sampleScale));
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return normalizeImageCrop(cropDraft);

    ctx.clearRect(0, 0, sampleWidth, sampleHeight);
    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, sampleWidth, sampleHeight);
    const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const alpha = data[(y * sampleWidth + x) * 4 + 3];
        if (alpha > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return normalizeImageCrop(cropDraft);
    }

    const trimmedLeft = srcX + minX / sampleScale;
    const trimmedTop = srcY + minY / sampleScale;
    const trimmedWidth = (maxX - minX + 1) / sampleScale;
    const trimmedHeight = (maxY - minY + 1) / sampleScale;

    return cropRectToDraft({
      left: trimmedLeft / naturalWidth,
      top: trimmedTop / naturalHeight,
      width: trimmedWidth / naturalWidth,
      height: trimmedHeight / naturalHeight,
    });
  } catch (error) {
    console.warn("Failed to trim crop to visible pixels:", error);
    return normalizeImageCrop(cropDraft);
  } finally {
    cleanup?.();
  }
};

const getCropMeasurementInches = (layer, draftCrop, axis = "width") => {
  if (!layer) return 0;

  const currentCrop = normalizeImageCrop(layer.crop);
  const targetCrop = normalizeImageCrop(draftCrop);
  const currentRatio = axis === "width" ? (currentCrop.widthRatio || 1) : (currentCrop.heightRatio || 1);
  const targetRatio = axis === "width" ? (targetCrop.widthRatio || 1) : (targetCrop.heightRatio || 1);

  const currentMeasured =
    axis === "width"
      ? Number(layer.currentPrintWidthInches ?? layer.renderedWidthInches)
      : Number(layer.currentPrintHeightInches ?? layer.renderedHeightInches);

  const fallbackBase =
    axis === "width"
      ? Number(layer.printWidthInches || 0) * Number(layer.scaleX ?? layer.scale ?? 1)
      : Number(layer.printHeightInches || 0) * Number(layer.scaleY ?? layer.scale ?? 1);

  const safeCurrentMeasured = Number.isFinite(currentMeasured) ? currentMeasured : fallbackBase;
  const uncroppedBase = safeCurrentMeasured / Math.max(currentRatio, 1e-6);
  const nextValue = uncroppedBase * targetRatio;

  return Number.isFinite(nextValue) ? nextValue : 0;
};

const getInitialZoneKey = (viewCode, preferredZone = null) => {
  if (preferredZone) return preferredZone;
  if (viewCode === "back") return "back-full";
  return "front-full";
};

const normalizeEditorZone = (zone, fallback = "front-full") => {
  const normalized = String(zone || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (
    normalized === "front-pocket" ||
    normalized === "front_pocket" ||
    normalized === "pocket-front" ||
    normalized === "pocket"
  ) {
    return "pocket";
  }
  return normalized;
};

const createDesignLayer = (
  id,
  imageUrl,
  file,
  width,
  height,
  options = {}
) => {
  const { isFromLibrary = false, viewCode = "front", zone = null } = options;
  const normalizedPriceRules = normalizeImagePriceRules(options.priceRules);
  const displayWidthInches = width / DISPLAY_DPI;
  const displayHeightInches = height / DISPLAY_DPI;

  const printWidthInches = width / PRINT_DPI;
  const printHeightInches = height / PRINT_DPI;

  const zoneKey = getInitialZoneKey(viewCode, zone);
  const boundary =
    INITIAL_ZONE_BOUNDARIES[zoneKey] || INITIAL_ZONE_BOUNDARIES["front-full"];
  const boundaryWidth = Math.max(0.02, boundary.maxX - boundary.minX);
  const boundaryHeight = Math.max(0.02, boundary.maxY - boundary.minY);
  const initialScale = Math.max(
    0.12,
    Math.min(0.8, boundaryWidth * 0.78, boundaryHeight * 0.78)
  );

  const initialWidthIn = printWidthInches * initialScale;
  const initialHeightIn = printHeightInches * initialScale;

  // ✅ FIXED PRICE here too
  const { price: layerPrice, matchedRule } = getFixedImageLayerPricing(
    initialWidthIn,
    initialHeightIn,
    normalizedPriceRules
  );

  return {
    id,
    imageUrl,
    filename: file?.name || getFilenameFromUrl(imageUrl, "design.png"),
    file,
    sourceFile: file,
    hasBgRemoved: false,
    x: (boundary.minX + boundary.maxX) / 2,
    y: (boundary.minY + boundary.maxY) / 2,
    zone: zoneKey,
    scale: initialScale,
    scaleX: initialScale,
    scaleY: initialScale,
    rotation: 0,

    originalWidthPx: width,
    originalHeightPx: height,

    renderedWidthPx: width * initialScale,
    renderedHeightPx: height * initialScale,

    isFromLibrary,
    displayWidthInches,
    displayHeightInches,

    printWidthInches,
    printHeightInches,

    // ✅ IMPORTANT: initialize inches so price works immediately
    renderedWidthInches: initialWidthIn,
    renderedHeightInches: initialHeightIn,

    layerPrice,
    minimumChargeApplied: Boolean(matchedRule?.maxSideInches !== null),
    priceRules: normalizedPriceRules,
    crop: normalizeImageCrop(options.crop),
  };
};


export default function DesignerPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSelector(selectCurrentToken);
  const { current: product, currentStatus, currentError } = useSelector(
    (state) => state.products
  );
  const user = useSelector(selectCurrentUser);

  const isAdmin = user?.role === "admin" || user?.isAdmin === true || user?.role === "superuser";
  // Design uploads state
  const DEFAULT_SIZE = "M";
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const { 
    folders, 
    images, 
    currentFolder, 
    loading: libraryLoading 
  } = useSelector((state) => state.designUploads);
const getSizeBasePrice = (prod, size) => {
  const list = prod?.sizePricing || [];
  const found = list.find((x) => String(x.size).toUpperCase() === String(size).toUpperCase());
  return found?.price ?? prod?.basePrice ?? 600;
  };
  const BASE_PRICE = getSizeBasePrice(product, selectedSize);
  const productImagePriceRules = normalizeImagePriceRules(product?.normalPricing?.imagePriceRules);
  const productTextPriceRules = normalizeImagePriceRules(
    product?.normalPricing?.textPriceRules || product?.normalPricing?.imagePriceRules || DEFAULT_TEXT_PRICE_RULES
  );

  const [savedDesignId, setSavedDesignId] = useState(null);
  const [lastSavedPreview, setLastSavedPreview] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);

  const productColorOptions =
    Array.isArray(product?.colors) && product.colors.length > 0
      ? product.colors
      : DEFAULT_COLOR_OPTIONS;
  const selectableProductColorOptions = productColorOptions.filter(isColorAvailable);
  const defaultColorValue = productColorOptions[0]?.value || "#FFFFFF";
  const defaultColorLabel = getColorLabel(defaultColorValue, productColorOptions);
  const [productColor, setProductColor] = useState(defaultColorValue);
  const [productColorName, setProductColorName] = useState(defaultColorLabel);
  const [viewStates, setViewStates] = useState({});
  const [viewCode, setViewCode] = useState("front");
  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);
  const [error, setError] = useState("");
  const [designRenderWidth, setDesignRenderWidth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [selectedLibraryImage, setSelectedLibraryImage] = useState(null);
  const [price, setPrice] = useState(BASE_PRICE);
  const [priceBreakdown, setPriceBreakdown] = useState({
    basePrice: BASE_PRICE,
    images: { count: 0, total: 0, items: [] },
    text: { count: 0, total: 0, items: [] },
    additionalArea: 0,
    minimumCharges: 0,
    totalPrice: BASE_PRICE
  });
  

// ✅ Available sizes (prefer from DB)
  const availableSizePricing = Array.isArray(product?.sizePricing) ? product.sizePricing : [];
  const inStockSizePricing = availableSizePricing.filter(
    (entry) => entry?.stock === undefined || Number(entry.stock) > 0
  );
  const availableSizes = (inStockSizePricing.length > 0 ? inStockSizePricing : availableSizePricing).map(
    (x) => x.size
  );
  // Edit mode state
  const editDesignId = searchParams.get("edit");
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [originalDesign, setOriginalDesign] = useState(null);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState(TABS.PRODUCT_COLORS);
  const [showMobilePriceDetails, setShowMobilePriceDetails] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropDraft, setCropDraft] = useState(() => normalizeImageCrop());
  const [isDesktopToolsLayout, setIsDesktopToolsLayout] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });

  const editorRef = useRef(null);
  const viewStatesRef = useRef({});
  const removeBgRequestSeqRef = useRef(0);
  const cropPreviewFrameRef = useRef(null);
  const cropDragStateRef = useRef(null);
  const customizerReturnPath = `${location.pathname}${location.search}`;
  const promptLoginForRestrictedAction = (message) => {
    setSaveError(message);
    setSaveSuccess(false);
    navigate("/login", {
      state: {
        from: customizerReturnPath,
      },
    });
  };
  const supportsPocketZone = String(slug || product?.slug || "")
    .trim()
    .toLowerCase() === "hoodie";

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleMediaChange = (event) => {
      setIsDesktopToolsLayout(event.matches);
    };

    setIsDesktopToolsLayout(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => mediaQuery.removeEventListener("change", handleMediaChange);
    }

    mediaQuery.addListener(handleMediaChange);
    return () => mediaQuery.removeListener(handleMediaChange);
  }, []);

  const shouldShowToolSection = (tabKey) => activeTab === tabKey;

  const jumpToToolSection = (tabKey) => {
    setActiveTab(tabKey);
  };

  const handleToolTabChange = (tabKey) => {
    setActiveTab(tabKey);
  };

  const handleColorChange = (color, label = null) => {
    setProductColor(color);
    setProductColorName(label || getColorLabel(color, productColorOptions));
  };

  useEffect(() => {
    const matchedColor = productColorOptions.find(
      (option) => String(option?.value || "").toLowerCase() === String(productColor || "").toLowerCase()
    );

    if (matchedColor) {
      const nextLabel = matchedColor.label || getColorLabel(matchedColor.value, productColorOptions);
      if (productColorName !== nextLabel) {
        setProductColorName(nextLabel);
      }
      return;
    }

    if (isEditMode && originalDesign?.productColor) {
      return;
    }

    const fallbackColor = selectableProductColorOptions[0] || productColorOptions[0];
    if (fallbackColor) {
      setProductColor(fallbackColor.value);
      setProductColorName(fallbackColor.label || getColorLabel(fallbackColor.value, productColorOptions));
    }
  }, [isEditMode, originalDesign, productColor, productColorName, productColorOptions, selectableProductColorOptions]);

  const getImageSizeFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(size);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cannot read image size (invalid/corrupt file)"));
    };

    img.src = objectUrl;
  });

  const getImageNaturalSize = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });

const updateDesignLayerDimensions = (layer, opts = {}) => {
  // Supports:
  // - legacy uniform scale: opts.scale
  // - new independent scaling: opts.scaleX / opts.scaleY
  // Falls back cleanly if some values missing.

  const nextScaleX =
    typeof opts.scaleX === "number"
      ? opts.scaleX
      : typeof opts.scale === "number"
        ? opts.scale
        : (layer.scaleX ?? layer.scale ?? 0.35);

  const nextScaleY =
    typeof opts.scaleY === "number"
      ? opts.scaleY
      : typeof opts.scale === "number"
        ? opts.scale
        : (layer.scaleY ?? layer.scale ?? 0.35);

  // Keep legacy `scale` for backward compatibility
  // (use avg so old places still work)
  const nextScale = (nextScaleX + nextScaleY) / 2;
  const crop = normalizeImageCrop(layer.crop);
  const cropWidthRatio = crop.widthRatio || 1;
  const cropHeightRatio = crop.heightRatio || 1;

  // Inches should be derived from PRINT inches * scale
  const currentDisplayWidthInches = (layer.displayWidthInches || 0) * nextScaleX * cropWidthRatio;
  const currentDisplayHeightInches = (layer.displayHeightInches || 0) * nextScaleY * cropHeightRatio;

  const currentPrintWidthInches = (layer.printWidthInches || 0) * nextScaleX * cropWidthRatio;
  const currentPrintHeightInches = (layer.printHeightInches || 0) * nextScaleY * cropHeightRatio;

  // Pixels
  const renderedWidthPx = (layer.originalWidthPx || 0) * nextScaleX * cropWidthRatio;
  const renderedHeightPx = (layer.originalHeightPx || 0) * nextScaleY * cropHeightRatio;

  // ✅ ALWAYS recompute inches from print inches so it updates immediately
  const widthIn = Number(currentPrintWidthInches || 0);
  const heightIn = Number(currentPrintHeightInches || 0);

  const { price: layerPrice, matchedRule } = getFixedImageLayerPricing(
    widthIn,
    heightIn,
    layer.priceRules
  );

  return {
    ...layer,

    // legacy
    scale: nextScale,

    // new
    scaleX: nextScaleX,
    scaleY: nextScaleY,

    currentDisplayWidthInches,
    currentDisplayHeightInches,
    currentPrintWidthInches,
    currentPrintHeightInches,

    renderedWidthPx,
    renderedHeightPx,

    renderedWidthInches: widthIn,
    renderedHeightInches: heightIn,

    layerPrice,
    minimumChargeApplied: Boolean(matchedRule?.maxSideInches !== null),

    currentAdditionalArea: 0,
  };
};

const _num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const restoreDesignLayerFromSaved = (d, pricingRules = DEFAULT_IMAGE_PRICE_RULES) => {
  // 1) restore scaleX/scaleY safely (support legacy scale)
  const scaleX = typeof d.scaleX === "number" ? d.scaleX : (typeof d.scale === "number" ? d.scale : 0.35);
  const scaleY = typeof d.scaleY === "number" ? d.scaleY : (typeof d.scale === "number" ? d.scale : 0.35);

  // IMPORTANT: legacy "scale" should represent the UI slider (avg of X/Y)
  const scale = (scaleX + scaleY) / 2;

  // 2) figure out original pixel dimensions (best effort)
  let originalWidthPx = _num(d.originalWidthPx, 0);
  let originalHeightPx = _num(d.originalHeightPx, 0);

  // If original px missing, infer from saved inches (most reliable if you saved them)
  if ((!originalWidthPx || !originalHeightPx) && (d.renderedWidthInches || d.renderedHeightInches)) {
    const rwIn = _num(d.renderedWidthInches, 0);
    const rhIn = _num(d.renderedHeightInches, 0);

    // rendered inches = (originalPx / PRINT_DPI) * scaleX
    // => originalPx = (renderedInches * PRINT_DPI) / scaleX
    if (rwIn && scaleX) originalWidthPx = (rwIn * PRINT_DPI) / scaleX;
    if (rhIn && scaleY) originalHeightPx = (rhIn * PRINT_DPI) / scaleY;
  }

  // If still missing, infer from rendered px (legacy saves)
  if ((!originalWidthPx || !originalHeightPx) && (d.renderedWidthPx || d.renderedHeightPx)) {
    const rwp = _num(d.renderedWidthPx, 0);
    const rhp = _num(d.renderedHeightPx, 0);
    if (rwp && scaleX) originalWidthPx = rwp / scaleX;
    if (rhp && scaleY) originalHeightPx = rhp / scaleY;
  }

  // 3) rebuild base layer (no derived fields trusted yet)
  const baseLayer = {
    ...d,
    zone: normalizeEditorZone(d.zone, getInitialZoneKey(d.viewCode)),
    priceRules: d.priceRules || normalizeImagePriceRules(pricingRules),
    scale,
    scaleX,
    scaleY,
    originalWidthPx,
    originalHeightPx,

    // keep these if present (but we will recompute in updateDesignLayerDimensions)
    displayWidthInches: originalWidthPx / DISPLAY_DPI,
    displayHeightInches: originalHeightPx / DISPLAY_DPI,
    printWidthInches: originalWidthPx / PRINT_DPI,
    printHeightInches: originalHeightPx / PRINT_DPI,
    crop: normalizeImageCrop(d.crop),
  };

  // 4) recompute all dependent fields in ONE place
  return updateDesignLayerDimensions(baseLayer, { scaleX, scaleY });
};

  // -------- PRICE CALCULATION --------
  const calculatePrice = async (updateUI = true) => {
    try {
      if (updateUI) setCalculatingPrice(true);
      
      const currentBasePrice = getSizeBasePrice(product, selectedSize);

      
      const allDesignLayers = [];
      const allTextLayers = [];
      const allZones = [];

      Object.entries(viewStates).forEach(([viewCode, viewState]) => {
        if (!isCustomizableViewCode(viewCode)) {
          return;
        }

        if (viewState.designLayers) {
          viewState.designLayers.forEach(layer => {
            let zone = layer.zone;
            if (!zone) {
              if (viewCode === 'back') zone = 'back-full';
              else zone = 'front-full';
            }
            
            allDesignLayers.push({
              ...layer,
              zone,
              viewCode
            });
            allZones.push(zone);
          });
        }

        if (viewState.textLayers) {
          viewState.textLayers.forEach(textLayer => {
            let zone = textLayer.zone;
            if (!zone) {
              if (viewCode === "back") zone = "back-full";
              else if (supportsPocketZone && viewCode === "front") zone = "front-full";
              else zone = "front-full";
            }

            allTextLayers.push({
              ...textLayer,
              zone,
              viewCode
            });
          });
        }
      });

      const { totalPrice, breakdown } = calculateLocalPrice(
        allDesignLayers, 
        allTextLayers, 
        allZones,
        currentBasePrice
      );
      
      if (updateUI) {
        setPrice(totalPrice);
        setPriceBreakdown(breakdown);
      }

      return { totalPrice, breakdown };

    } catch (err) {
      console.error("Price calculation error:", err);
      if (updateUI) {
        setError("Failed to calculate price: " + err.message);
      }
      return { totalPrice: BASE_PRICE, breakdown: null };
    } finally {
      if (updateUI) setCalculatingPrice(false);
    }
  };

  const calculateLocalPrice = (designLayers, textLayers, zones, basePrice) => {
    let totalPrice = basePrice;
    const breakdown = {
      basePrice: basePrice,
      images: { count: 0, total: 0, items: [] },
      text: { count: 0, total: 0, items: [] },
      additionalArea: 0,
      minimumCharges: 0,
      totalPrice: basePrice
    };

    designLayers.forEach((layer, index) => {
  const zone = layer.zone || zones[index] || "front-full";

  // ✅ FIXED PRICE based on RecolorEditor inches
  const widthIn = Number(layer.renderedWidthInches || 0);
  const heightIn = Number(layer.renderedHeightInches || 0);

  const { price, matchedRule } = getFixedImageLayerPricing(
    widthIn,
    heightIn,
    layer.priceRules || productImagePriceRules
  );

  breakdown.images.count += 1;
  breakdown.images.total += price;
  totalPrice += price;

  breakdown.images.items.push({
    id: layer.id,
    type: "image",
    price,
    zone,
    viewCode: layer.viewCode,
    size: `${widthIn.toFixed(2)}" × ${heightIn.toFixed(2)}"`,
    note: formatImagePriceRuleLabel(
      matchedRule,
      (layer.priceRules || productImagePriceRules).findIndex(
        (rule) => Number(rule?.maxSideInches) === Number(matchedRule?.maxSideInches)
      ),
      layer.priceRules || productImagePriceRules
    ),
  });
});



    textLayers.forEach((textLayer) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `${textLayer.fontSize}px ${textLayer.fontFamily}`;
      
      const textMetrics = ctx.measureText(textLayer.text);
      const fallbackTextWidthPx = textMetrics.width;
      const fallbackTextHeightPx = textLayer.fontSize * 1.2;

      const widthInches =
        Number(textLayer.renderedWidthInches || textLayer.widthInches || 0) || (fallbackTextWidthPx / PRINT_DPI);
      const heightInches =
        Number(textLayer.renderedHeightInches || textLayer.heightInches || 0) || (fallbackTextHeightPx / PRINT_DPI);
      const areaInches = widthInches * heightInches;

      const { price: textPrice, matchedRule } = getFixedImageLayerPricing(
        widthInches,
        heightInches,
        textLayer.priceRules || productTextPriceRules
      );

      if (textPrice > 0) {
        totalPrice += textPrice;
        breakdown.text.count += 1;
        breakdown.text.total += textPrice;
        
        breakdown.text.items.push({
          id: textLayer.id,
          text: textLayer.text?.substring(0, 15) + (textLayer.text?.length > 15 ? "..." : ""),
          fontSize: textLayer.fontSize,
          displaySize: `${((textLayer.renderedWidthPx || fallbackTextWidthPx) / DISPLAY_DPI).toFixed(2)}" × ${((textLayer.renderedHeightPx || fallbackTextHeightPx) / DISPLAY_DPI).toFixed(2)}"`,
          printSize: `${widthInches.toFixed(3)}" × ${heightInches.toFixed(3)}"`,
          areaInches: areaInches.toFixed(3),
          price: textPrice,
          viewCode: textLayer.viewCode,
          zone: textLayer.zone,
          note: formatImagePriceRuleLabel(
            matchedRule,
            (textLayer.priceRules || productTextPriceRules).findIndex(
              (rule) => Number(rule?.maxSideInches) === Number(matchedRule?.maxSideInches)
            ),
            textLayer.priceRules || productTextPriceRules
          ),
        });
      }
    });

    breakdown.totalPrice = totalPrice;
    return { totalPrice, breakdown };
  };

  useEffect(() => {
    if (Object.keys(viewStates).length > 0) {
      const timeoutId = setTimeout(() => {
        calculatePrice();
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [viewStates]);

  useEffect(() => {
  if (!product) return;

  const newBase = getSizeBasePrice(product, selectedSize);

  setPrice(newBase);
  setPriceBreakdown((prev) => ({
    ...prev,
    basePrice: newBase,
    totalPrice: newBase + (prev.totalPrice - prev.basePrice),
  }));

  // also trigger full recalculation (design/text)
  if (Object.keys(viewStates).length > 0) {
    setTimeout(() => calculatePrice(), 0);
  }
}, [product, selectedSize]); // ✅ depends on selectedSize



  const uploadDesignImage = async (file) => {
  const formData = new FormData();
  formData.append("designImage", file);

  try {
    const res = await fetch(`${API_URL}/upload-design`, {
      method: "POST",
      body: formData,
    });
    console.log("upload-design response:", res.data);

    // Safely parse JSON (backend might return HTML/text on error)
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data?.error || `Failed to upload image (${res.status})`);
    }

    const rawUrl =
      data?.imageUrl || data?.url || data?.fileUrl || data?.path || null;

    if (!rawUrl) {
      throw new Error("Upload succeeded but response did not include imageUrl");
    }

    // If backend already returns absolute URL, use it as-is
   const BASE_IMAGE_HOST = IMAGE_URL || API_URL; // prefer IMAGE_URL if provided

const finalUrl = rawUrl.startsWith("http")
  ? rawUrl
  : `${BASE_IMAGE_HOST}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;


    return finalUrl;

  } catch (err) {
    console.error("Upload design image error:", err);

    // Fallback: local preview (DataURL) — ensure it never resolves undefined
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => reject(new Error("Failed to read file locally"));
      reader.readAsDataURL(file);
    });
  }
};


  // Fetch design library folders on component mount
  useEffect(() => {
    dispatch(fetchFolders());
  }, [dispatch]);

  // Fetch images when folder changes
  useEffect(() => {
    if (activeTab === TABS.DESIGN_LIBRARY && currentFolder) {
      dispatch(fetchImages(currentFolder));
    }
  }, [dispatch, currentFolder, activeTab]);

  useEffect(() => {
    if (slug) {
      console.log("Fetching product for slug:", slug);
      dispatch(fetchProductBySlug(slug));
    }
  }, [slug, dispatch]);

  useEffect(() => {
    if (editDesignId && !token) {
      setIsEditMode(false);
      setOriginalDesign(null);
      setEditModeInitialized(false);
      setLoadingEditData(false);
      setSaveError("Please login to edit a saved design. You can still customize this product as a guest.");
      navigate(`/products/${slug}/customize`, { replace: true });
      return;
    }

    if (!editDesignId || !product) {
      console.log("Not in edit mode or product not loaded yet");
      setIsEditMode(false);
      return;
    }

    if (editModeInitialized) return;

    const loadDesignForEdit = async () => {
      try {
        console.log("Loading design for edit, ID:", editDesignId);
        setLoadingEditData(true);
        setError("");
        
        const res = await fetch(`${API_URL}/savedata/${editDesignId}`);
        const design = await res.json();

        if (!res.ok) {
          throw new Error(design.error || "Failed to load design");
        }

        console.log("Design loaded successfully:", design);
        
        setOriginalDesign(design);
        if (design.selectedSize) {
          setSelectedSize(design.selectedSize);
        }
        const restoredBase = design.basePrice ?? getSizeBasePrice(product, design.selectedSize);
setPrice(restoredBase);

setPriceBreakdown((prev) => ({
  ...prev,
  basePrice: restoredBase,
  totalPrice: restoredBase, // will be recalculated when calculatePrice runs
}));

        const resolvedColor = design.productColor || defaultColorValue;
        setProductColor(resolvedColor);
        setProductColorName(
          design.productColorName || getColorLabel(resolvedColor, productColorOptions)
        );

        const loadedViewStates = {};
        design.views?.forEach((view) => {
          loadedViewStates[view.code] = {
            textLayers: view.textLayers?.map(t => ({
              ...t,
              zone: normalizeEditorZone(t.zone, getInitialZoneKey(view.code)),
              id: t.id || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`
            })) || [],
            activeTextId: view.textLayers?.[0]?.id || null,
            designLayers: (view.designLayers || []).map((d) => {
  const fixedUrl =
    d.imageUrl?.startsWith("http") ||
    d.imageUrl?.startsWith("blob:") ||
    d.imageUrl?.startsWith("data:")
      ? d.imageUrl
      : d.imageUrl?.startsWith("/")
        ? `${API_URL}${d.imageUrl}`
        : d.imageUrl;

  const restored = restoreDesignLayerFromSaved({
    ...d,
    id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageUrl: fixedUrl,
    file: null,
    originalFile: null,
    isFromLibrary: d.isFromLibrary || false,
  }, productImagePriceRules);

  return restored;
              }) || [],
            activeDesignId: view.designLayers?.[0]?.id || null,
          };
        });

        setViewStates(loadedViewStates);
        setIsEditMode(true);
        setEditModeInitialized(true);
        
        const firstEditableView =
          design.views?.find((view) => isCustomizableViewCode(view.code))?.code ||
          getCustomizableViews(product.views)[0]?.code;

        if (firstEditableView) {
          setViewCode(firstEditableView);
        }
        
        setTimeout(() => calculatePrice(), 0);

        
      } catch (err) {
        console.error("Error loading design for edit:", err);
        setError(`Failed to load design: ${err.message}`);
        setIsEditMode(false);
      } finally {
        setLoadingEditData(false);
      }
    };

    loadDesignForEdit();
  }, [editDesignId, product, editModeInitialized, navigate, slug, token]);

  useEffect(() => {
    if (!product?.views?.length) {
      console.log("No product views found");
      return;
    }
    
    if (isEditMode && editModeInitialized) {
      console.log("Edit mode already initialized, skipping new design init");
      return;
    }

    console.log("Initializing new design for product:", product.name);
    
    const initialViews = getCustomizableViews(product.views);
    const initial = {};

    initialViews.forEach((v) => {
      initial[v.code] = {
        textLayers: [],          // ✅ no default text on load
        activeTextId: null,      // ✅ no active text selected
        designLayers: [],
        activeDesignId: null,
      };
    });


    setViewStates(initial);
    setViewCode(initialViews[0].code);
    setIsEditMode(false);
    setEditModeInitialized(false);
    
  }, [product, isEditMode, editModeInitialized]);

  useEffect(() => {
    if (!product?.views?.length) return;
    if (isCustomizableViewCode(viewCode)) return;

    const fallbackView = getCustomizableViews(product.views)[0];
    if (fallbackView?.code) {
      setViewCode(fallbackView.code);
    }
  }, [product, viewCode]);

  useEffect(() => {
  if (!product) return;

  // ✅ If editing and the design already has a saved size, DO NOT override it
  if (isEditMode && originalDesign?.selectedSize) return;

  const sizeRows = Array.isArray(product.sizePricing) ? product.sizePricing : [];
  const sizesInStock = sizeRows
    .filter((entry) => entry?.stock === undefined || Number(entry.stock) > 0)
    .map((entry) => entry.size);
  const sizes = sizesInStock.length > 0 ? sizesInStock : sizeRows.map((entry) => entry.size);
  if (sizes.length === 0) return;

  // keep existing selection if valid
  if (selectedSize && sizes.includes(selectedSize)) return;

  if (sizes.includes("M")) setSelectedSize("M");
  else setSelectedSize(sizes[0]);
}, [product, isEditMode, originalDesign, selectedSize]);



  useEffect(() => {
    viewStatesRef.current = viewStates;
  }, [viewStates]);

  useEffect(() => {
    return () => {
      Object.values(viewStatesRef.current || {}).forEach(viewState => {
        if (viewState.designLayers) {
          viewState.designLayers.forEach(layer => {
            if (layer.imageUrl && layer.imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(layer.imageUrl);
            }
          });
        }
      });
    };
  }, []);

  const baseViewState = {
    textLayers: [],
    activeTextId: null,
    designLayers: [],
    activeDesignId: null,
  };

  const getCurrentViewState = () => {
    const existing = viewStates[viewCode];
    return existing ? { ...baseViewState, ...existing } : baseViewState;
  };

  const updateCurrentViewState = (patch) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const { textLayers, activeTextId, designLayers, activeDesignId } = getCurrentViewState();
  const activeTextLayer = textLayers.find((l) => l.id === activeTextId) || textLayers[0];
  const activeDesign = designLayers.find((d) => d.id === activeDesignId) || null;
  const cropDraftValue = normalizeImageCrop(cropDraft);
  const cropBoxRect = getCropBoxRect(cropDraftValue);
  const selectedOrLatestDesign = activeDesign || designLayers[designLayers.length - 1] || null;
  const availableZonesForView = getZoneOptionsForView(viewCode, { supportsPocketZone });
  const activeDesignZone = normalizeEditorZone(activeDesign?.zone, availableZonesForView[0] || "front-full");
  const activeTextZone = normalizeEditorZone(activeTextLayer?.zone, availableZonesForView[0] || "front-full");

  useEffect(() => {
    if (!activeDesignId) {
      setIsCropModalOpen(false);
      setCropDraft(normalizeImageCrop());
    }
  }, [activeDesignId]);

  useEffect(() => {
    if (!isCropModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCropModalOpen(false);
        setCropDraft(normalizeImageCrop(activeDesign?.crop));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      stopCropPreviewPan();
    };
  }, [isCropModalOpen, activeDesign]);
  const shouldUseFolderDropdown = folders.length > 6;
  const selectedSizeStockEntry = availableSizePricing.find(
    (entry) => String(entry?.size || "").toUpperCase() === String(selectedSize || "").toUpperCase()
  );
  const selectedSizeStock = selectedSizeStockEntry?.stock;
  const selectedColorOption = productColorOptions.find(
    (option) => String(option?.value || "").toLowerCase() === String(productColor || "").toLowerCase()
  );
  const selectedColorStock = getColorStockValue(selectedColorOption);
  const sizeLimit =
    selectedSizeStock !== undefined && selectedSizeStock !== null && Number(selectedSizeStock) >= 0
      ? Number(selectedSizeStock)
      : Number.POSITIVE_INFINITY;
  const colorLimit =
    selectedColorStock !== null && selectedColorStock >= 0
      ? Number(selectedColorStock)
      : Number.POSITIVE_INFINITY;
  const resolvedStockLimit = Math.min(sizeLimit, colorLimit);
  const maxOrderQuantity =
    Number.isFinite(resolvedStockLimit) ? resolvedStockLimit : 99;
  const isSelectionOutOfStock = maxOrderQuantity < 1;
  const customizationNames = [
    ...designLayers.map((layer, index) => getDesignLayerDisplayName(layer, index)),
    ...textLayers.map((layer, index) => getTextLayerDisplayName(layer, index)),
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  const visibleCustomizationNames = customizationNames.slice(0, 3);
  const remainingCustomizationCount = Math.max(0, customizationNames.length - visibleCustomizationNames.length);
  const refreshPriceLabel = calculatingPrice ? "Refreshing..." : "Refresh price";

  const getLibraryImageUrl = (folderName, filename) =>
    `${IMAGE_URL}/outputs/adminuploadeddesigns/${folderName}/${filename}`;

  const moveActiveDesignToZone = (zoneKey) => {
    if (!activeDesign || !zoneKey) return;

    updateCurrentViewState({
      designLayers: designLayers.map((layer) =>
        layer.id === activeDesign.id
          ? {
              ...layer,
              zone: zoneKey,
              x: null,
              y: null,
            }
          : layer
      ),
      activeDesignId: activeDesign.id,
    });
  };

  const moveActiveTextToZone = (zoneKey) => {
    if (!activeTextLayer || !zoneKey) return;

    updateCurrentViewState({
      textLayers: textLayers.map((layer) =>
        layer.id === activeTextLayer.id
          ? {
              ...layer,
              zone: zoneKey,
              x: null,
              y: null,
            }
          : layer
      ),
      activeTextId: activeTextLayer.id,
    });
  };

  const updateActiveTextLayer = (patch) => {
    if (!activeTextLayer) return;
    const newLayers = textLayers.map((layer) =>
      layer.id === activeTextLayer.id ? { ...layer, ...patch } : layer
    );
    updateCurrentViewState({ textLayers: newLayers });
  };

  const addNewText = () => {
    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const defaultZoneForView = availableZonesForView[0] || getInitialZoneKey(viewCode);
    const newLayer = {
      ...createDefaultTextLayer({
        zone: defaultZoneForView,
        viewCode,
      }),
      id,
      text: "New Text",
    };
    updateCurrentViewState({
      textLayers: [...textLayers, newLayer],
      activeTextId: id,
    });
  };

  const removeActiveText = () => {
    if (!activeTextLayer) return;
    const remaining = textLayers.filter((l) => l.id !== activeTextLayer.id);
    const newActiveId = remaining[0]?.id ?? null;
    updateCurrentViewState({
      textLayers: remaining,
      activeTextId: newActiveId,
    });
  };

  useEffect(() => {
    setSelectedQuantity((prev) => {
      const next = Number(prev || 1);
      if (next < 1) return 1;
      return Math.min(next, Math.max(1, maxOrderQuantity));
    });
  }, [maxOrderQuantity]);

  const updateSelectedQuantity = (nextValue) => {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) {
      setSelectedQuantity(1);
      return;
    }

    const normalized = Math.max(1, Math.min(Math.floor(parsed), Math.max(1, maxOrderQuantity)));
    setSelectedQuantity(normalized);
  };

const handleDesignUpload = async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  setError("");

  const invalidFiles = files.filter((file) => !isSupportedDesignSource(file));
  if (invalidFiles.length) {
    setError(
      `Only ${SUPPORTED_DESIGN_FORMATS_LABEL} files are allowed for design upload and background removal. Unsupported: ${invalidFiles
        .map((file) => file.name)
        .join(", ")}`
    );
    e.target.value = "";
    return;
  }

  try {
    const newLayers = [];

    for (const file of files) {
      // ✅ 1) Read size from local file (no CORS / no server dependency)
      const { width, height } = await getImageSizeFromFile(file);

      // ✅ 2) Upload to server (for persistence)
      const serverUrl = await uploadDesignImage(file);
      console.log("Uploaded file:", file.name, "to URL:", serverUrl);
      if (!serverUrl || typeof serverUrl !== "string") {
        console.warn("Upload returned invalid url:", file.name, serverUrl);
        continue;
      }

      const id = `design-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

      console.log("Pixels source: local file", { filename: file.name, width, height });
      console.log("Server URL:", serverUrl);

      newLayers.push(
        createDesignLayer(id, serverUrl, file, width, height, {
          isFromLibrary: false,
          viewCode,
          zone: availableZonesForView[0] || getInitialZoneKey(viewCode),
          priceRules: productImagePriceRules,
        })
      );
    }

    if (!newLayers.length) {
      setError("No valid images were uploaded. Try JPG/PNG and smaller file sizes.");
      return;
    }

    const lastId = newLayers[newLayers.length - 1].id;

    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          designLayers: [...(current.designLayers || []), ...newLayers],
          activeDesignId: lastId,
        },
      };
    });
    setActiveTab(TABS.DESIGNS);
    setIsLibraryModalOpen(false);

  } catch (err) {
    console.error("Error uploading design images:", err);
    setError("Failed to upload images: " + (err?.message || String(err)));
  } finally {
    e.target.value = "";
  }
};



  // NEW: Handle selecting design from library
    const handleSelectFromLibrary = async (image) => {
      try {
        setError("");
        
        // Construct full URL for the image from design library
        const imageUrl = getLibraryImageUrl(currentFolder, image.filename);
      
      // Fetch the image to create a file object for background removal
      console.log("Fetching image from library...");
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
        
        const blob = await response.blob();
        const file = new File([blob], image.filename, { type: blob.type });
        console.log("Created file object from library image:", image.filename);
      
      const id = `design-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { width, height } = await getImageNaturalSize(imageUrl);
      console.log("Pixels source: design library image", {
        filename: image.filename,
        width,
        height,
      });
      
      const newLayer = createDesignLayer(id, imageUrl, file, width, height, {
        isFromLibrary: true,
        viewCode,
        zone: availableZonesForView[0] || getInitialZoneKey(viewCode),
        priceRules: productImagePriceRules,
      });
      
      setViewStates((prev) => {
        const existing = prev[viewCode];
        const current = existing ? { ...baseViewState, ...existing } : baseViewState;
        return {
          ...prev,
          [viewCode]: {
            ...current,
            designLayers: [...(current.designLayers || []), newLayer],
            activeDesignId: id,
          },
        };
      });

      // Switch to designs tab to show the controls
      setActiveTab(TABS.DESIGNS);
      setIsLibraryModalOpen(false);
      setSelectedLibraryImage(image.filename);
      
    } catch (err) {
      console.error("Error loading design from library:", err);
      setError("Failed to load design from library: " + err.message);
    }
  };

  const handleRemoveBackground = async () => {
    const targetDesign = selectedOrLatestDesign;

    if (!targetDesign) {
      setError("Upload or select a design first");
      console.log("No design selected");
      return;
    }

    let requestSeq = 0;
    try {
      requestSeq = ++removeBgRequestSeqRef.current;
      const targetViewCode = viewCode;
      const targetDesignId = targetDesign.id;
      setBgRemovalLoading(true);
      setError("");
      console.log("Starting background removal for:", targetDesign.id);
      
      if (targetDesign.hasBgRemoved) {
        setError("Background is already removed for this design");
        setBgRemovalLoading(false);
        return;
      }

      let fileToUse = targetDesign.sourceFile || targetDesign.originalFile || targetDesign.file;
      
      // If no file object exists (design came from library or was previously loaded without file), fetch it
      if (!fileToUse && targetDesign.imageUrl) {
        console.log("No file object found, fetching image from URL...");
        
        try {
          const response = await fetch(withCacheBust(targetDesign.imageUrl), {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const filename = getFilenameFromUrl(targetDesign.imageUrl, "design.png");
          fileToUse = new File([blob], filename, { type: blob.type });
          console.log("Created file from image URL:", filename);
          
        } catch (fetchErr) {
          console.error("Error fetching image:", fetchErr);
          setError("Failed to load design image for background removal");
          setBgRemovalLoading(false);
          return;
        }
      }
      
      if (!fileToUse) {
        setError("No file available for background removal");
        console.log("No file available for background removal");
        setBgRemovalLoading(false);
        return;
      }

        if (
          !shouldBypassRemoveBgFormatValidation(targetDesign) &&
          !isSupportedDesignSource(fileToUse) &&
          !isSupportedDesignSource({ name: targetDesign.imageUrl?.split("/").pop() || "" })
        ) {
          setError(`Remove BG supports only ${SUPPORTED_DESIGN_FORMATS_LABEL} files`);
          setBgRemovalLoading(false);
          return;
        }

      console.log("Preparing FormData with image");
      const formData = new FormData();
      formData.append("image", fileToUse);
      
      console.log("Sending to remove-bg API...");
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: "POST",
        body: formData,
      });

      console.log("Remove BG response status:", res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.log("Error response body:", errorText);
        throw new Error(errorText || "Background removal failed");
      }

      const data = await res.json();
      console.log("Response data:", data);

      if (requestSeq !== removeBgRequestSeqRef.current) {
        return;
      }

      if (!data.outputUrl) {
        console.log("Output URL is missing in the response");
        throw new Error("Background removal failed: no output URL");
      }

      const outputAssetUrl = resolveOutputAssetUrl(data.outputUrl);
      const outputPreviewUrl = withCacheBust(outputAssetUrl);
      console.log("Constructed background removed image URL:", outputAssetUrl);

      let previewUrl = outputPreviewUrl;
      let processedFile = fileToUse;

      try {
        const processedResponse = await fetch(outputPreviewUrl, {
          cache: "no-store",
        });
        if (!processedResponse.ok) {
          throw new Error(`Failed to fetch processed image: ${processedResponse.status}`);
        }

        const processedBlob = await processedResponse.blob();
        const processedName =
          data.outputUrl.split("/").pop() || `${targetDesign.id}-transparent.png`;

        processedFile = new File([processedBlob], processedName, {
          type: processedBlob.type || "image/png",
        });
      } catch (fetchProcessedErr) {
        console.warn("Falling back to direct processed image URL:", fetchProcessedErr);
      }

      if (requestSeq !== removeBgRequestSeqRef.current) {
        return;
      }

      if (
        targetDesign.imageUrl &&
        targetDesign.imageUrl.startsWith("blob:") &&
        targetDesign.imageUrl !== previewUrl
      ) {
        URL.revokeObjectURL(targetDesign.imageUrl);
      }

      setViewStates((prev) => {
        const existing = prev[targetViewCode];
        const current = existing ? { ...baseViewState, ...existing } : baseViewState;
        let didUpdateTargetLayer = false;
        const updatedLayers = (current.designLayers || []).map((layer) =>
          layer.id === targetDesignId
            ? {
                ...layer,
                imageUrl: previewUrl,
                hasBgRemoved: true,
                file: processedFile,
                originalFile: processedFile,
                sourceFile: processedFile,
                isFromLibrary: false,
              }
            : layer
        );

        didUpdateTargetLayer = updatedLayers.some((layer) => layer.id === targetDesignId);

        if (!didUpdateTargetLayer) {
          return prev;
        }

        console.log("Updated layers with background removed:", updatedLayers);

        return {
          ...prev,
          [targetViewCode]: {
            ...current,
            designLayers: updatedLayers,
            activeDesignId: targetDesignId,
          },
        };
      });
      
      // Clear the library image indicator since it's now a processed image
      setSelectedLibraryImage(null);
      
    } catch (err) {
      console.error("Remove BG error:", err);
      setError(err.message || "Background removal failed");
    } finally {
      if (requestSeq === removeBgRequestSeqRef.current) {
        setBgRemovalLoading(false);
      }
      console.log("Background removal process completed");
    }
  };

  const clearActiveDesign = () => {
    const targetDesign = activeDesign || selectedOrLatestDesign;
    if (!targetDesign) return;

    const targetViewCode = viewCode;
    const targetDesignId = targetDesign.id;
    setError("");
    removeBgRequestSeqRef.current += 1;
    setBgRemovalLoading(false);

    if (targetDesign.imageUrl && targetDesign.imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(targetDesign.imageUrl);
    }

    setViewStates((prev) => {
      const existing = prev[targetViewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const remaining = (current.designLayers || []).filter((layer) => layer.id !== targetDesignId);
      const nextActiveId = remaining.length
        ? current.activeDesignId === targetDesignId
          ? remaining[remaining.length - 1].id
          : current.activeDesignId
        : null;

      return {
        ...prev,
        [targetViewCode]: {
          ...current,
          designLayers: remaining,
          activeDesignId: nextActiveId,
        },
      };
    });

    setDesignRenderWidth(null);
    setSelectedLibraryImage(null);
  };

  const handleDesignScaleChange = (value) => {
  // legacy uniform slider (kept)
  if (!activeDesign) return;
  const v = Math.max(0.05, parseFloat(value) || 0.35);

  const updated = designLayers.map((d) => {
    if (d.id === activeDesign.id) {
      return updateDesignLayerDimensions(d, { scale: v });
    }
    return d;
  });

  updateCurrentViewState({ designLayers: updated });
  calculatePrice();
};

const handleDesignScaleXChange = (value) => {
  if (!activeDesign) return;
  const v = Math.max(0.05, parseFloat(value) || 0.35);

  const updated = designLayers.map((d) => {
    if (d.id === activeDesign.id) {
      return updateDesignLayerDimensions(d, { scaleX: v });
    }
    return d;
  });

  updateCurrentViewState({ designLayers: updated });
  calculatePrice();
};

const handleDesignScaleYChange = (value) => {
  if (!activeDesign) return;
  const v = Math.max(0.05, parseFloat(value) || 0.35);

  const updated = designLayers.map((d) => {
    if (d.id === activeDesign.id) {
      return updateDesignLayerDimensions(d, { scaleY: v });
    }
    return d;
  });

  updateCurrentViewState({ designLayers: updated });
  calculatePrice();
};

const nudgeDesignScaleAxis = (axis, delta) => {
  if (!activeDesign) return;
  const current =
    axis === "x"
      ? (activeDesign.scaleX ?? activeDesign.scale ?? 0.35)
      : (activeDesign.scaleY ?? activeDesign.scale ?? 0.35);
  const next = Math.max(0.1, Math.min(1.6, current + delta));
  if (axis === "x") {
    handleDesignScaleXChange(next);
    return;
  }
  handleDesignScaleYChange(next);
};

const handleActiveDesignCropChange = (patch) => {
  if (!activeDesign) return;

  const updated = designLayers.map((designLayer) => {
    if (designLayer.id !== activeDesign.id) return designLayer;
    return updateDesignLayerDimensions({
      ...designLayer,
      crop: normalizeImageCrop({
        ...(designLayer.crop || {}),
        ...patch,
      }),
    });
  });

  updateCurrentViewState({ designLayers: updated });
  calculatePrice();
};

const openCropModal = () => {
  if (!activeDesign) return;
  setCropDraft(normalizeImageCrop(activeDesign.crop));
  setIsCropModalOpen(true);
};

const closeCropModal = () => {
  stopCropPreviewPan();
  setIsCropModalOpen(false);
  setCropDraft(normalizeImageCrop(activeDesign?.crop));
};

const applyCropDraft = async () => {
  if (!activeDesign) return;
  stopCropPreviewPan();
  const trimmedCrop = await trimCropDraftToVisiblePixels(activeDesign, cropDraftValue);
  handleActiveDesignCropChange(trimmedCrop);
  setIsCropModalOpen(false);
};

const resetCropDraft = () => {
  setCropDraft(normalizeImageCrop());
};

const updateCropDraft = (updater) => {
  setCropDraft((prev) => {
    const current = normalizeImageCrop(prev);
    const nextValue =
      typeof updater === "function" ? updater(current) : { ...current, ...updater };
    return normalizeImageCrop(nextValue);
  });
};

const stopCropPreviewPan = () => {
  cropDragStateRef.current = null;
  window.removeEventListener("pointermove", handleCropPreviewPointerMove);
  window.removeEventListener("pointerup", stopCropPreviewPan);
  window.removeEventListener("pointercancel", stopCropPreviewPan);
};

function handleCropPreviewPointerMove(event) {
  const state = cropDragStateRef.current;
  if (!state) return;
  const nextDx = (event.clientX - state.startX) / Math.max(state.rectWidth, 1);
  const nextDy = (event.clientY - state.startY) / Math.max(state.rectHeight, 1);
  const minRatio = 0.15;
  let nextRect = { ...state.startRect };

  if (state.mode === "move") {
    nextRect.left = Math.max(0, Math.min(1 - state.startRect.width, state.startRect.left + nextDx));
    nextRect.top = Math.max(0, Math.min(1 - state.startRect.height, state.startRect.top + nextDy));
  } else if (state.mode === "resize-left") {
    const right = state.startRect.left + state.startRect.width;
    const proposedLeft = Math.max(0, Math.min(right - minRatio, state.startRect.left + nextDx));
    nextRect.left = proposedLeft;
    nextRect.width = right - proposedLeft;
  } else if (state.mode === "resize-right") {
    const proposedWidth = Math.max(minRatio, Math.min(1 - state.startRect.left, state.startRect.width + nextDx));
    nextRect.width = proposedWidth;
  } else if (state.mode === "resize-top") {
    const bottom = state.startRect.top + state.startRect.height;
    const proposedTop = Math.max(0, Math.min(bottom - minRatio, state.startRect.top + nextDy));
    nextRect.top = proposedTop;
    nextRect.height = bottom - proposedTop;
  } else if (state.mode === "resize-bottom") {
    const proposedHeight = Math.max(minRatio, Math.min(1 - state.startRect.top, state.startRect.height + nextDy));
    nextRect.height = proposedHeight;
  }

  setCropDraft(cropRectToDraft(nextRect));
}

const startCropPreviewPan = (event, mode = "move") => {
  event.preventDefault();
  event.stopPropagation();
  const rect = cropPreviewFrameRef.current?.getBoundingClientRect();
  if (!rect) return;

  cropDragStateRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    rectWidth: rect.width,
    rectHeight: rect.height,
    startRect: getCropBoxRect(cropDraftValue),
    mode,
  };

  window.addEventListener("pointermove", handleCropPreviewPointerMove);
  window.addEventListener("pointerup", stopCropPreviewPan);
  window.addEventListener("pointercancel", stopCropPreviewPan);
  event.currentTarget?.setPointerCapture?.(event.pointerId);
};

  const handleSetTextLayers = (updater) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const nextTextLayers = typeof updater === "function" ? updater(current.textLayers) : updater;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          textLayers: nextTextLayers,
        },
      };
    });
  };

  const handleSetDesignLayers = (updater) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const nextDesignLayers = typeof updater === "function" ? updater(current.designLayers) : updater;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          designLayers: nextDesignLayers,
        },
      };
    });
  };

  const handleSetActiveTextId = (idOrUpdater) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const nextId = typeof idOrUpdater === "function" ? idOrUpdater(current.activeTextId) : idOrUpdater;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          activeTextId: nextId,
        },
      };
    });
  };

  const handleSetActiveDesignId = (idOrUpdater) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const nextId = typeof idOrUpdater === "function" ? idOrUpdater(current.activeDesignId) : idOrUpdater;
      return {
        ...prev,
        [viewCode]: {
          ...current,
          activeDesignId: nextId,
        },
      };
    });
  };

  const captureAllViewPreviews = async () => {
    const viewsToCapture = getCustomizableViews(product?.views);

    if (viewsToCapture.length === 0 || !editorRef.current) {
      return {};
    }

    const previewsByCode = {};
    const originalViewCode = isCustomizableViewCode(viewCode)
      ? viewCode
      : viewsToCapture[0]?.code;

    for (const v of viewsToCapture) {
      setViewCode(v.code);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const img = (await editorRef.current?.capturePreview?.()) || null;
      if (img) {
        previewsByCode[v.code] = img;
      }
    }

    if (originalViewCode) {
      setViewCode(originalViewCode);
    }
    return previewsByCode;
  };

  const handleSaveDesign = async () => {
    if (!product) return;

    if (!token) {
      promptLoginForRestrictedAction("Please login to save your design.");
      return null;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const { totalPrice, breakdown } = await calculatePrice(false);

      const previewsByCode = await captureAllViewPreviews();

      const processedViewStates = { ...viewStates };
      for (const [viewCode, viewState] of Object.entries(processedViewStates)) {
        if (viewState.designLayers?.length > 0) {
          const processedLayers = [];
          for (const layer of viewState.designLayers) {
            if (layer.imageUrl && (layer.imageUrl.startsWith("blob:") || layer.imageUrl.startsWith("data:"))) {
              if (layer.originalFile) {
                const serverUrl = await uploadDesignImage(layer.originalFile);
                processedLayers.push({ ...layer, imageUrl: serverUrl });
              } else if (layer.file) {
                const serverUrl = await uploadDesignImage(layer.file);
                processedLayers.push({ ...layer, imageUrl: serverUrl });
              } else {
                console.warn(`No file available for layer ${layer.id}, skipping`);
                continue;
              }
            } else {
              processedLayers.push(layer);
            }
          }
          processedViewStates[viewCode] = { ...viewState, designLayers: processedLayers };
        }
      }

      const viewsPayload = getCustomizableViews(product.views).map((v) => {
        const vs = processedViewStates[v.code] ? { ...baseViewState, ...processedViewStates[v.code] } : baseViewState;

        const textLayersPayload = (vs.textLayers || []).map(
          ({
            id,
            text,
            x,
            y,
            zone,
            fontSize,
            color,
            fontFamily,
            rotation,
            scale,
            scaleX,
            scaleY,
            widthInches,
            heightInches,
            areaInches,
            renderedWidthPx,
            renderedHeightPx,
            renderedWidthInches,
            renderedHeightInches,
            printableAreaWidthInches,
            printableAreaHeightInches,
          }) => ({
            id,
            text,
            x,
            y,
            zone: zone === "pocket" ? "front-pocket" : (zone || null),
            fontSize,
            color,
            fontFamily,
            rotation,
            scale,
            scaleX,
            scaleY,
            widthInches,
            heightInches,
            areaInches,
            renderedWidthPx,
            renderedHeightPx,
            renderedWidthInches,
            renderedHeightInches,
            printableAreaWidthInches,
            printableAreaHeightInches,
          })
        );

        const designLayersPayload = (vs.designLayers || []).map(
  ({
    id,
    imageUrl,
    filename,
    hasBgRemoved,
    x,
    y,
    scale,
    scaleX,
    scaleY,
    rotation,
    zone,
    crop,
    insideSafeArea,

    originalWidthPx,
    originalHeightPx,

    renderedWidthPx,
    renderedHeightPx,

    // ✅ CANVAS-TRUE INCHES (FROM RecolorEditor)
    renderedWidthInches,
    renderedHeightInches,
    printableAreaWidthInches,
    printableAreaHeightInches,

    // existing inches (keep – backward compatibility)
    displayWidthInches,
    displayHeightInches,
    displayAreaInches,

    printWidthInches,
    printHeightInches,
    printAreaInches,

    currentDisplayWidthInches,
    currentDisplayHeightInches,

    currentPrintWidthInches,
    currentPrintHeightInches,
    currentPrintAreaInches,

    currentAdditionalArea,
    layerPrice,
    minimumChargeApplied,
    isFromLibrary,
  }) => ({
    id,
    imageUrl,
    filename: filename || getFilenameFromUrl(imageUrl, "design.png"),

    hasBgRemoved: !!hasBgRemoved,

    x,
    y,
    scale,
    scaleX,
    scaleY,
    rotation,
    crop: normalizeImageCrop(crop),

    zone: zone === "pocket" ? "front-pocket" : (zone || null),

    insideSafeArea:
      typeof insideSafeArea === "boolean" ? insideSafeArea : true,

    originalWidthPx,
    originalHeightPx,

    renderedWidthPx,
    renderedHeightPx,

    // ✅ SAVE REAL CANVAS INCHES (IMPORTANT)
    renderedWidthInches,
    renderedHeightInches,
    printableAreaWidthInches,
    printableAreaHeightInches,

    // keep existing fields (do NOT break old data)
    displayWidthInches,
    displayHeightInches,
    displayAreaInches,

    printWidthInches,
    printHeightInches,
    printAreaInches,

    currentDisplayWidthInches,
    currentDisplayHeightInches,

    currentPrintWidthInches,
    currentPrintHeightInches,
    currentPrintAreaInches,

    currentAdditionalArea,

    // ✅ FINAL FIXED PRICE (40 / 100)
    layerPrice,

    minimumChargeApplied,
    isFromLibrary: isFromLibrary || false,
  })
);


        return {
          code: v.code,
          textLayers: textLayersPayload,
          designLayers: designLayersPayload,
          previewImage: previewsByCode[v.code] || null,
        };
      }) || [];

      const primaryView = getCustomizableViews(product.views)[0];
      const mainPreview = previewsByCode["front"] || (primaryView && previewsByCode[primaryView.code]) || null;

      const body = {
        productId: product._id || product.id,
        productSlug: product.slug || slug,
        productColor,
        productColorName,
        previewImage: mainPreview,
        views: viewsPayload,
        basePrice: BASE_PRICE,
        selectedSize,
        calculatedPrice: totalPrice,
        priceBreakdown: breakdown,
      };
      console.log("Saving design with body:", body);
      const url = isEditMode && editDesignId ? `${API_URL}/savedata/${editDesignId}` : `${API_URL}/savedata`;
      const method = isEditMode && editDesignId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      

        if (!res.ok) {
          throw new Error(data?.error || data?.message || "Failed to save design");
        }

        // ✅ store saved design info for cart
        const newDesignId =
          data?.design?._id ||
          data?.savedDesignId ||
          data?._id ||
          data?.id ||
          editDesignId ||
          null;

        setSavedDesignId(newDesignId);
        setLastSavedPreview(mainPreview);

        setSaveSuccess(true);
        alert(isEditMode ? "Design updated successfully!" : "Design saved successfully!");
        return {
          designId: newDesignId,
          previewImage: mainPreview,
        };
      // ✅ keep these after successful save


    } catch (err) {
      console.error("Save design error:", err);
      setSaveError(err.message || "Failed to save design");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAddToCart = async () => {
  if (!token) {
    promptLoginForRestrictedAction("Please login to add items to cart.");
    return;
  }

  if (isSelectionOutOfStock) {
    setError("The selected size or color is out of stock.");
    return;
  }

  let designIdToUse = savedDesignId;

  try {
    setAddingToCart(true);
    setError("");

    // If not saved yet, save first
    if (!designIdToUse) {
      const savedDesign = await handleSaveDesign();

      // handleSaveDesign sets savedDesignId; wait a tick for state
      await new Promise((r) => setTimeout(r, 0));
      designIdToUse = savedDesign?.designId || savedDesignId || editDesignId;
    }

    if (!designIdToUse) {
      throw new Error("Design not saved yet. Please save the design first.");
    }

    // ✅ cart payload (backend can ignore extra fields if not needed)
    const cartPayload = {
      kind: "DESIGN",
      design: designIdToUse,
      productId: product?._id || product?.id,
      qty: selectedQuantity,
      size: selectedSize,
      selectedSize,
      productColor,
      productColorName,
      designId: designIdToUse,
      previewImage: lastSavedPreview || null,
      unitPrice: price, // total calculated price shown on UI
      signature: `${product?._id || product?.id}|${selectedSize}|${productColor}|${designIdToUse}`,
    };

    console.info("[productcustomization] add to cart request", {
      productId: product?._id || product?.id || null,
      designId: designIdToUse,
      selectedSize,
      qty: selectedQuantity,
      productColor,
      price,
      payload: cartPayload,
    });

    const addToCartResult = await dispatch(addToCart(cartPayload)).unwrap();
    trackMetaAddToCart({
      productId: product?._id || product?.id,
      productName: product?.title || product?.name || product?.productName,
      quantity: cartPayload.qty,
      unitPrice: cartPayload.unitPrice,
      currency: "INR",
    });

    console.info("[productcustomization] add to cart success", {
      designId: designIdToUse,
      itemCount: addToCartResult?.cart?.items?.length ?? null,
      message: addToCartResult?.message || null,
    });

    // optional: go to cart page
    navigate("/cart");
  } catch (e) {
    console.error("[productcustomization] add to cart failed", {
      productId: product?._id || product?.id || null,
      designId: designIdToUse || null,
      selectedSize,
      qty: selectedQuantity,
      productColor,
      error: e,
    });
    setError(e?.message || e?.data?.message || "Failed to add to cart");
  } finally {
    setAddingToCart(false);
  }
};


  const handleResetToOriginal = () => {
    if (!originalDesign || !window.confirm("Reset all changes to original design?")) {
      return;
    }

    const restoredViewStates = {};
    originalDesign.views?.forEach((view) => {
      restoredViewStates[view.code] = {
        textLayers: view.textLayers?.map(t => ({
          ...t,
          zone: normalizeEditorZone(t.zone, getInitialZoneKey(view.code)),
          id: t.id || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`
        })) || [],
        activeTextId: view.textLayers?.[0]?.id || null,
        designLayers: (view.designLayers || []).map((d) => {
  const fixedUrl =
    d.imageUrl?.startsWith("http") ||
    d.imageUrl?.startsWith("blob:") ||
    d.imageUrl?.startsWith("data:")
      ? d.imageUrl
      : d.imageUrl?.startsWith("/")
        ? `${API_URL}${d.imageUrl}`
        : d.imageUrl;

  return restoreDesignLayerFromSaved({
    ...d,
    id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageUrl: fixedUrl,
    file: null,
    originalFile: null,
    isFromLibrary: d.isFromLibrary || false,
  }, productImagePriceRules);
        }) || [],
        activeDesignId: view.designLayers?.[0]?.id || null,
      };
    });

    setViewStates(restoredViewStates);
    const resolvedColor = originalDesign.productColor || defaultColorValue;
    setProductColor(resolvedColor);
    setProductColorName(
      originalDesign.productColorName || getColorLabel(resolvedColor, productColorOptions)
    );
    calculatePrice();
    alert("Design reset to original!");
  };

  const handleBackToAdmin = () => {
    navigate('/admin/designs');
  };

  if (currentStatus === "loading" || loadingEditData) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-100">
        <div className="rounded-md bg-white px-4 py-3 shadow text-sm">
          {loadingEditData ? "Loading design for editing..." : "Loading product…"}
        </div>
      </div>
    );
  }

  if (currentStatus === "failed") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-100">
        <div className="rounded-md bg-white px-4 py-3 shadow text-sm text-red-600">
          Failed to load product: {currentError}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-100">
        <div className="rounded-md bg-white px-4 py-3 shadow text-sm text-red-600">
          Product not found. Please check the URL.
        </div>
      </div>
    );
  }

  const customizableViews = getCustomizableViews(product?.views);
  const currentView = customizableViews.find((v) => v.code === viewCode) || customizableViews[0] || product.views[0];
  const mockupUrl = currentView?.mockupUrl;
  const maskUrl = currentView?.maskUrl;
  const canAddSavedDesignToCart = Boolean(savedDesignId || editDesignId);
  const primarySaveActionLabel = token
    ? (saving ? "Saving…" : isEditMode ? "Update Design" : "Save Design")
    : "Login to Save";
  const primaryCartActionLabel = token
    ? (addingToCart ? "Adding…" : savedDesignId ? "Add to Cart" : "Save & Add to Cart")
    : "Login for Cart";

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-gradient-to-b from-slate-100 via-white to-slate-100 text-slate-900 sm:min-h-screen sm:overflow-visible">
      {/* Top bar */}
      <header className="sticky top-0 z-20 hidden flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-extrabold tracking-wide text-orange-500">
              Customization
            </div>
            
            <Link
              to={token ? "/usersaved_designs" : "/login"}
              state={token ? undefined : { from: customizerReturnPath }}
              className="rounded-full border border-sky-600 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 transition"
            >
              {token ? "My Designs" : "Login"}
            </Link>
          </div>

          <div className="text-xs text-slate-500">
            {isEditMode ? "Edit Design" : "My Designs"} <span className="mx-1">›</span>{" "}
            <span className="font-medium text-slate-700">
              {product?.name || "Untitled design"}
              {isEditMode && " (Editing)"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-wrap gap-2">
            {isEditMode && (
              <button onClick={handleBackToAdmin} className="text-sky-700 hover:underline">
                Back to Admin
              </button>
            )}

            {isEditMode && originalDesign && (
              <button onClick={handleResetToOriginal} className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
                Reset to Original
              </button>
            )}
          </div>

          <div className="flex flex-col text-left sm:items-end sm:text-right">
            <span className="text-xs text-slate-500">Total Price</span>
            <span className="text-xl font-bold text-green-600">₹{price.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <button
              onClick={handleSaveDesign}
              disabled={saving || addingToCart}
              className="rounded-full border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {primarySaveActionLabel}
            </button>

            <button
              type="button"
              id="customization-add-to-cart-header-mobile"
              onClick={handleSaveAndAddToCart}
              aria-label="Add customized product to cart"
              data-meta-track="add-to-cart"
              disabled={saving || addingToCart}
              className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {primaryCartActionLabel}
            </button>
          </div>

          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <button
              onClick={handleSaveDesign}
              disabled={saving || addingToCart}
              className="rounded-full border border-sky-600 bg-sky-600 px-4 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {primarySaveActionLabel}
            </button>

            <button
              type="button"
              id="customization-add-to-cart-header-desktop"
              onClick={handleSaveAndAddToCart}
              aria-label="Add customized product to cart"
              data-meta-track="add-to-cart"
              disabled={saving || addingToCart}
              className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {primaryCartActionLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-x-hidden px-2 pb-2 pt-2 sm:gap-6 sm:overflow-visible sm:px-6 sm:pb-6 sm:pt-3">
        {!token && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Explore and customize freely. Login is only required when you want to save the design or add it to your cart.
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)] lg:items-start lg:gap-6 lg:overflow-visible">
          {/* Mobile helper card */}
          <div className="hidden">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-[11px] text-slate-600 shadow-sm">
              <p className="mb-1 font-semibold text-slate-800">Design tips</p>
              <p className="text-[11px] leading-tight text-slate-600">
                Tap any design or text on the mockup to edit it. All controls are available below, and the jump chips take you straight to the section you need.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToToolSection(TABS.DESIGNS)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  Open designs
                </button>
                <button
                  type="button"
                  onClick={() => jumpToToolSection(TABS.TEXT)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  Add text
                </button>
                <button
                  type="button"
                  onClick={() => jumpToToolSection(TABS.PRODUCT_COLORS)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  Pick colors
                </button>
              </div>
            </div>
          </div>
          <div className="hidden">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Size</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{selectedSize || "Default"}</div>
                <div className="text-[11px] text-slate-500">Base Rs.{BASE_PRICE.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">View</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {product?.views?.find((v) => v.code === viewCode)?.label || "Front"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {designLayers.length} design{designLayers.length !== 1 ? "s" : ""}, {textLayers.length} text
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-500">Live total</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">Rs.{price.toFixed(2)}</div>
                <button
                  type="button"
                  onClick={() => calculatePrice()}
                  disabled={calculatingPrice}
                  className="mt-1 text-[11px] font-medium text-emerald-700 disabled:opacity-60"
                >
                  {refreshPriceLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Left sidebar - Controls */}
          <aside
            className={`${
              isDesktopToolsLayout
                ? "order-1 flex w-full min-h-[220px] max-h-[42vh] flex-col gap-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:h-auto sm:max-h-none sm:rounded-2xl sm:p-4 sm:shadow-sm lg:order-1 lg:w-auto lg:gap-6"
                : "order-2 flex w-full flex-col gap-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
            }`}
          >
          <div className="grid grid-cols-4 gap-1 border-b border-slate-100 pb-3 sm:hidden">
            {MOBILE_TOOL_TABS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleToolTabChange(item.key)}
                  className={`rounded-[14px] px-2 py-2 text-[10px] font-semibold transition ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Total</p>
                <p className="text-base font-bold text-emerald-800">Rs.{price.toFixed(2)}</p>
                <p className="truncate text-[11px] text-emerald-700/80">
                  {productColorName} / {customizableViews.find((v) => v.code === viewCode)?.label || "Front view"} / {selectedSize || "Default"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => calculatePrice()}
                disabled={calculatingPrice}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 disabled:opacity-50"
              >
                {refreshPriceLabel}
              </button>
            </div>
          </div>

          {/* Edit mode indicator */}
          {isEditMode && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-xs font-medium text-amber-700">Edit Mode</span>
              </div>
              <p className="mt-1 text-[10px] text-amber-600">
                Editing design ID: {editDesignId?.slice(0, 8)}...
              </p>
            </div>
          )}

          <div className="hidden sm:block" />

          {/* Tab navigation */}
          <div className="hidden gap-1 overflow-x-auto border-b border-slate-200 pb-2 text-[10px] sm:flex sm:gap-2">
            <button
              onClick={() => handleToolTabChange(TABS.PRODUCT_COLORS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.PRODUCT_COLORS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Product Colors
            </button>
            <button
              onClick={() => handleToolTabChange(TABS.DESIGNS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGNS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Designs
            </button>
            <button
              onClick={() => handleToolTabChange(TABS.TEXT)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.TEXT ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Text
            </button>
            <button
              onClick={() => handleToolTabChange(TABS.VIEWS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.VIEWS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Views
            </button>
            <button
              onClick={() => handleToolTabChange(TABS.DESIGN_LIBRARY)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGN_LIBRARY ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Design Library
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {/* Product Colors Tab */}
            {shouldShowToolSection(TABS.PRODUCT_COLORS) && (
              <section
                id={`tool-section-${TABS.PRODUCT_COLORS}`}
                className="mb-4 space-y-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 scroll-mt-24 sm:mb-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Product Colors</h3>

                 
                  {/* ✅ Size Selection */}
                  <div className="mt-5">
                    <h3 className="mb-2 font-semibold text-sm">Size</h3>

                    {availableSizes.length > 0 ? (
                      <>
                        <label className="mb-2 block text-xs font-medium">Select Size</label>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(inStockSizePricing.length > 0 ? inStockSizePricing : availableSizePricing).map((sizeEntry) => {
                            const size = sizeEntry.size;
                            const isActive = selectedSize === size;
                            const sizePrice = getSizeBasePrice(product, size);
                            const stock = Number(sizeEntry?.stock ?? 0);
                            const isOutOfStock = sizeEntry?.stock !== undefined && stock <= 0;

                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSelectedSize(size)}
                                disabled={isOutOfStock}
                                className={`rounded border px-2 py-2 text-xs font-semibold transition ${
                                  isActive
                                    ? "border-sky-500 bg-sky-50 text-sky-700"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                } ${isOutOfStock ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                <div>{size}</div>
                                <div className="text-[10px] font-normal text-slate-400">
                                  {sizeEntry?.stock === undefined
                                    ? "Stock not set"
                                    : isOutOfStock
                                      ? "Out of stock"
                                      : `${stock} in stock`}
                                </div>
                                <div className="text-[10px] font-normal text-slate-500">₹{sizePrice}</div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2 text-[11px] text-slate-500">
                          Selected: <span className="font-medium text-slate-700">{selectedSize}</span> • Base:{" "}
                          <span className="font-medium text-slate-700">₹{BASE_PRICE}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500">
                        No sizePricing configured for this product. Using basePrice.
                      </div>
                    )}
                  </div>

                  <div className="mt-5">
                    <h3 className="mb-2 font-semibold text-sm">Quantity</h3>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-slate-700">Order quantity</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {selectedSizeStock !== undefined
                              ? `${Math.max(0, maxOrderQuantity)} item${Math.max(0, maxOrderQuantity) === 1 ? "" : "s"} available for size ${selectedSize || "Default"}${selectedColorOption?.label ? ` in ${selectedColorOption.label}` : ""}`
                              : "Choose how many customized pieces you want to order."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedQuantity(selectedQuantity - 1)}
                            disabled={selectedQuantity <= 1}
                            className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700 disabled:opacity-40"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={maxOrderQuantity}
                            value={selectedQuantity}
                            onChange={(e) => updateSelectedQuantity(e.target.value)}
                            className="w-16 rounded-xl border border-slate-300 px-2 py-2 text-center text-sm font-semibold text-slate-800 outline-none focus:border-sky-400"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedQuantity(selectedQuantity + 1)}
                            disabled={selectedQuantity >= Math.max(1, maxOrderQuantity)}
                            className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Select */}
                  <div className="mb-2 hidden sm:block">
                    <label className="mb-2 block text-xs font-medium">Quick Select</label>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                      {productColorOptions.map((option) => {
                        const currentColorKey = productColor?.toLowerCase() || "";
                        const isActive = option.value.toLowerCase() === currentColorKey;
                        const colorStock = getColorStockValue(option);
                        const colorOutOfStock = !isColorAvailable(option);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`relative h-8 w-8 rounded-full border-2 ${isActive ? "border-sky-500" : "border-slate-300"} ${colorOutOfStock ? "cursor-not-allowed opacity-40" : ""}`}
                            style={{ backgroundColor: option.value }}
                            onClick={() => !colorOutOfStock && handleColorChange(option.value, option.label)}
                            disabled={colorOutOfStock}
                            title={
                              colorStock === null
                                ? option.label
                                : colorOutOfStock
                                  ? `${option.label} - Out of stock`
                                  : `${option.label} - ${colorStock} in stock`
                            }
                          >
                            {colorOutOfStock ? (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                                ×
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {selectedColorStock !== null ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {selectedColorStock > 0
                          ? `${selectedColorStock} item${selectedColorStock === 1 ? "" : "s"} available in ${productColorName}`
                          : `${productColorName} is out of stock`}
                      </p>
                    ) : null}
                  </div>

                </div>

                <div className="hidden text-xs text-slate-600 space-y-2 sm:block">
                  <p className="font-medium">How to use:</p>
                  <p>• Select a color to change the product color</p>
                  <p>• Use the color picker for custom colors</p>
                  <p>• Quick select colors are commonly used options</p>
                </div>
              </section>
            )}

            {/* Designs Tab */}
            {shouldShowToolSection(TABS.DESIGNS) && (
              <section
                id={`tool-section-${TABS.DESIGNS}`}
                className="mb-4 space-y-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 scroll-mt-24 sm:mb-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Upload Designs</h3>
                  <p className="mb-2 text-xs text-slate-600">Upload one or more images. They will be saved to the server automatically.</p>
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {REMOVE_BG_RECOMMENDATION}
                  </div>

                  <div className="mb-3 text-xs">
                    <input type="file" accept={SUPPORTED_DESIGN_ACCEPT} multiple onChange={handleDesignUpload} className="w-full text-xs border border-slate-300 rounded px-3 py-2" />
                    <p className="mt-2 text-[11px] text-slate-500">Supported formats: {SUPPORTED_DESIGN_FORMATS_LABEL}.</p>
                    </div>

                  {activeDesign && (
                    <>
                      <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-slate-700 text-xs">Selected Design</span>
                          <span className="text-[10px] text-slate-500">ID: {activeDesign.id.slice(0, 6)}…</span>
                        </div>
                        
                        {selectedLibraryImage && (
                          <div className="mb-2 px-2 py-1 bg-sky-50 border border-sky-200 rounded text-xs text-sky-700">
                            <span className="font-medium">From Library:</span> {selectedLibraryImage}
                          </div>
                        )}
                        
                        <div className="mb-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-center">
                              <div className="text-[10px] text-slate-500">Display</div>
                              <div className="font-medium">{activeDesign.currentDisplayWidthInches?.toFixed(2)}" × {activeDesign.currentDisplayHeightInches?.toFixed(2)}"</div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-slate-500">Print</div>
                              <div className="font-medium">{activeDesign.currentPrintWidthInches?.toFixed(2)}" × {activeDesign.currentPrintHeightInches?.toFixed(2)}"</div>
                            </div>
                          </div>
                          <div className="mt-2 text-center">
                            <div className="text-[10px] text-slate-500">Print Area</div>
                            <div className="font-medium">{activeDesign.currentPrintAreaInches?.toFixed(2)} sq.in</div>
                            {activeDesign.currentAdditionalArea > 0 ? (
                              <div className="text-[10px] text-green-600">
                                +{activeDesign.currentAdditionalArea?.toFixed(2)} sq.in extra
                              </div>
                            ) : activeDesign.minimumChargeApplied && (
                              <div className="text-[10px] text-amber-600">
                                Minimum ₹{MINIMUM_DESIGN_CHARGE} charge
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRemoveBackground}
                            disabled={bgRemovalLoading || activeDesign.hasBgRemoved}
                            className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
                              bgRemovalLoading || activeDesign.hasBgRemoved
                                ? "border-slate-300 text-slate-400"
                                : "border-sky-500 text-sky-700 hover:bg-sky-50"
                            }`}
                          >
                            {bgRemovalLoading
                              ? "Removing…"
                              : activeDesign.hasBgRemoved
                                ? "BG Removed"
                              : "Remove BG"}
                          </button>
                          <button
                            type="button"
                            onClick={openCropModal}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Crop
                          </button>
                          <button type="button" onClick={clearActiveDesign} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            Clear
                          </button>
                        </div>

                      </div>

                      <div className="mb-4">
                        <label className="mb-2 block text-xs font-medium">Design Size</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0.1} max={1.2} step={0.02} value={activeDesign.scale} onChange={(e) => handleDesignScaleChange(e.target.value)} className="flex-1" />
                          <span className="w-10 text-right text-xs text-slate-600">{Math.round(activeDesign.scale * 100)}%</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                          <div>Display: {activeDesign.currentDisplayWidthInches?.toFixed(2)}" × {activeDesign.currentDisplayHeightInches?.toFixed(2)}"</div>
                          <div>Print: {activeDesign.currentPrintWidthInches?.toFixed(2)}" × {activeDesign.currentPrintHeightInches?.toFixed(2)}"</div>
                        </div>
                      </div>

                      <div className="mb-4 space-y-3 sm:hidden">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">Width</label>
                            <span className="text-xs font-semibold text-slate-600">
                              {Math.round((activeDesign.scaleX ?? activeDesign.scale ?? 0.35) * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => nudgeDesignScaleAxis("x", -0.04)}
                              className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700"
                            >
                              -
                            </button>
                            <input
                              type="range"
                              min={0.1}
                              max={1.6}
                              step={0.02}
                              value={activeDesign.scaleX ?? activeDesign.scale ?? 0.35}
                              onChange={(e) => handleDesignScaleXChange(e.target.value)}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => nudgeDesignScaleAxis("x", 0.04)}
                              className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">Height</label>
                            <span className="text-xs font-semibold text-slate-600">
                              {Math.round((activeDesign.scaleY ?? activeDesign.scale ?? 0.35) * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => nudgeDesignScaleAxis("y", -0.04)}
                              className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700"
                            >
                              -
                            </button>
                            <input
                              type="range"
                              min={0.1}
                              max={1.6}
                              step={0.02}
                              value={activeDesign.scaleY ?? activeDesign.scale ?? 0.35}
                              onChange={(e) => handleDesignScaleYChange(e.target.value)}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => nudgeDesignScaleAxis("y", 0.04)}
                              className="h-9 w-9 rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>


                      <div className="mb-4 hidden sm:block">
  <label className="mb-2 block text-xs font-medium">Scale X (Width)</label>
  <div className="flex items-center gap-2">
    <input
      type="range"
      min={0.1}
      max={1.6}
      step={0.02}
      value={activeDesign.scaleX ?? activeDesign.scale ?? 0.35}
      onChange={(e) => handleDesignScaleXChange(e.target.value)}
      className="flex-1"
    />
    <span className="w-10 text-right text-xs text-slate-600">
      {Math.round((activeDesign.scaleX ?? activeDesign.scale ?? 0.35) * 100)}%
    </span>
  </div>
</div>

<div className="mb-4 hidden sm:block">
  <label className="mb-2 block text-xs font-medium">Scale Y (Height)</label>
  <div className="flex items-center gap-2">
    <input
      type="range"
      min={0.1}
      max={1.6}
      step={0.02}
      value={activeDesign.scaleY ?? activeDesign.scale ?? 0.35}
      onChange={(e) => handleDesignScaleYChange(e.target.value)}
      className="flex-1"
    />
    <span className="w-10 text-right text-xs text-slate-600">
      {Math.round((activeDesign.scaleY ?? activeDesign.scale ?? 0.35) * 100)}%
    </span>
  </div>
</div>

                      <div className="hidden text-xs text-slate-600 space-y-1 sm:block">
                        <p>• Click on a design in the editor to select it</p>
                        <p>• Drag to reposition, or use the resize handle</p>
                        <p>• Click "Remove BG" for transparent background</p>
                        <p>• Best result: use PNG artwork with a plain background</p>
                        <p>• Supported formats: {SUPPORTED_DESIGN_FORMATS_LABEL}</p>
                      </div>
                    </>
                  )}

                  {!activeDesign && designLayers.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600 text-center">
                        {designLayers.length} design{designLayers.length !== 1 ? 's' : ''} uploaded
                      </p>
                      <p className="text-[10px] text-slate-500 text-center mt-1">
                        Click any design on the shirt to select it and edit.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Text Tab */}
            {shouldShowToolSection(TABS.TEXT) && (
              <section
                id={`tool-section-${TABS.TEXT}`}
                className="mb-4 space-y-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 scroll-mt-24 sm:mb-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Text Customization</h3>
                  <div className="flex gap-2">
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={addNewText}>+ Add Text</button>
                    <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40" type="button" onClick={removeActiveText} disabled={!activeTextLayer}>Remove</button>
                  </div>
                </div>

                {activeTextLayer ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Text Content</label>
                      <input type="text" className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500" value={activeTextLayer.text} onChange={(e) => updateActiveTextLayer({ text: e.target.value })} placeholder="Enter text here" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Font</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500" value={activeTextLayer.fontFamily} onChange={(e) => updateActiveTextLayer({ fontFamily: e.target.value })}>
                          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.replace(/,.*$/, "")}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
                        <input type="color" className="h-8 w-full cursor-pointer rounded border border-slate-300" value={activeTextLayer.color} onChange={(e) => updateActiveTextLayer({ color: e.target.value })} />
                      </div>
                    </div>

                    {/* <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Font Size</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={14} max={120} value={activeTextLayer.fontSize} onChange={(e) => updateActiveTextLayer({ fontSize: parseInt(e.target.value, 10) })} className="flex-1" />
                        <span className="w-10 text-right text-xs text-slate-600">{activeTextLayer.fontSize}px</span>
                      </div>
                    </div> */}

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Rotation</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={-45} max={45} value={activeTextLayer.rotation} onChange={(e) => updateActiveTextLayer({ rotation: parseInt(e.target.value, 10) })} className="flex-1" />
                        <span className="w-10 text-right text-xs text-slate-600">{activeTextLayer.rotation}°</span>
                      </div>
                    </div>

                    {availableZonesForView.length > 1 && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-500">Text Position Area</label>
                        <div className="flex flex-wrap gap-2">
                          {availableZonesForView.map((zoneKey) => {
                            const isCurrentZone = activeTextZone === zoneKey;
                            return (
                              <button
                                key={`text-zone-${zoneKey}`}
                                type="button"
                                onClick={() => moveActiveTextToZone(zoneKey)}
                                disabled={isCurrentZone}
                                className={`rounded border px-3 py-1.5 text-xs font-medium ${
                                  isCurrentZone
                                    ? "cursor-default border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {isCurrentZone
                                  ? `In ${ZONE_LABELS[zoneKey] || zoneKey}`
                                  : `Move to ${ZONE_LABELS[zoneKey] || zoneKey}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Drag the text on the shirt to reposition</p>
                      <p>• Use the corner handle to resize</p>
                      <p>• Click "Remove" to delete selected text</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center">
                    <p className="text-xs text-slate-600">No text added yet.</p>
                    <p className="text-[10px] text-slate-500 mt-1">Click "+ Add Text" to start customizing.</p>
                  </div>
                )}
              </section>
            )}

            {/* Views Tab */}
            {shouldShowToolSection(TABS.VIEWS) && customizableViews.length > 1 && (
              <section
                id={`tool-section-${TABS.VIEWS}`}
                className="mb-4 space-y-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 scroll-mt-24 sm:mb-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Product Views</h3>
                  <p className="mb-3 text-xs text-slate-600">Switch between different views of the product to add designs/text on different areas.</p>

                  <div className="space-y-2">
                    {customizableViews.map((v) => {
                      const viewState = viewStates[v.code];
                      const hasLayers = viewState && (viewState.textLayers?.length > 0 || viewState.designLayers?.length > 0);
                      const isCurrent = v.code === viewCode;
                      
                      return (
                        <button
                          key={v.code}
                          type="button"
                          onClick={() => setViewCode(v.code)}
                          className={`w-full flex items-center justify-between rounded px-3 py-2 text-xs border ${isCurrent ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        >
                          <span>{v.label}</span>
                          <div className="flex items-center gap-2">
                            {hasLayers && <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>}
                            {isCurrent && (
                              <svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden text-xs text-slate-600 space-y-2 sm:block">
                  <p className="font-medium">Current View: {customizableViews.find(v => v.code === viewCode)?.label}</p>
                  <p>• Front: Main design area</p>
                  <p>• Back: Back of the product</p>
                  <p>• Each view has separate text and design layers</p>
                </div>
              </section>
            )}

            {/* Design Library Tab - NEW */}
            {shouldShowToolSection(TABS.DESIGN_LIBRARY) && (
              <section
                id={`tool-section-${TABS.DESIGN_LIBRARY}`}
                className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 scroll-mt-24 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Design Library</h3>
                  <p className="mb-3 text-xs text-slate-600">Open the library in a popup so the sidebar stays compact.</p>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Library Picker</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {currentFolder
                            ? `Current folder: ${currentFolder}${images.length ? ` • ${images.length} design${images.length === 1 ? "" : "s"}` : ""}`
                            : "Choose a folder and select a design in the popup."}
                        </p>
                        {selectedLibraryImage && (
                          <p className="mt-2 text-xs text-sky-700">
                            Last selected: <span className="font-medium">{selectedLibraryImage}</span>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLibraryModalOpen(true);
                        }}
                        className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        Open Library
                      </button>
                    </div>
                  </div>

                  <div className="hidden text-xs text-slate-600 space-y-2 mt-4 sm:block">
                    <p className="font-medium">How to use:</p>
                    <p>• Select a folder to view available designs</p>
                    <p>• Click on any design to add it to your product</p>
                    <p>• Switch to "Designs" tab to edit the selected design</p>
                    <p>• Background removal works for both uploaded and library designs</p>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Error messages */}
        {(error || saveError || saveSuccess) && (
            <div className="mt-4">
              {error && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
              {saveError && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</div>}
              {saveSuccess && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{isEditMode ? "Design updated successfully!" : "Design saved successfully!"}</div>}
            </div>
          )}
        </aside>

        {isCropModalOpen && activeDesign && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 p-0 sm:p-4"
            onClick={closeCropModal}
          >
            <div
              className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-[28px] sm:border sm:border-slate-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Crop image</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Drag the image with your finger, or use the controls below, then click OK.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCropModal}
                  className="min-h-10 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                      <span>Crop Preview</span>
                      <span>
                        {Math.round(cropDraftValue.widthRatio * 100)}% × {Math.round(cropDraftValue.heightRatio * 100)}%
                      </span>
                    </div>
                    <div className="relative mx-auto w-full max-w-[520px] rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_48%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-4">
                      <div
                        ref={cropPreviewFrameRef}
                        className="relative mx-auto w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-inner"
                        style={{
                          aspectRatio: `${Math.max(activeDesign.originalWidthPx || 1, 1)} / ${Math.max(activeDesign.originalHeightPx || 1, 1)}`,
                          touchAction: "none",
                        }}
                      >
                        <img
                          src={activeDesign.imageUrl}
                          alt="Crop editor"
                          className="absolute inset-0 h-full w-full select-none object-fill"
                          draggable={false}
                        />

                        <div className="absolute inset-0 bg-slate-950/45 pointer-events-none" />

                        <div
                          className="absolute border-2 border-sky-400 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.38)] cursor-move"
                          style={{
                            left: `${cropBoxRect.left * 100}%`,
                            top: `${cropBoxRect.top * 100}%`,
                            width: `${cropBoxRect.width * 100}%`,
                            height: `${cropBoxRect.height * 100}%`,
                          }}
                          onPointerDown={(event) => startCropPreviewPan(event, "move")}
                        >
                          <div className="pointer-events-none absolute inset-0 border border-white/80" />
                          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/50" />
                          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/50" />

                          <button
                            type="button"
                            aria-label="Crop left"
                            className="absolute left-0 top-1/2 h-10 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startCropPreviewPan(event, "resize-left");
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Crop right"
                            className="absolute right-0 top-1/2 h-10 w-5 translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startCropPreviewPan(event, "resize-right");
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Crop top"
                            className="absolute left-1/2 top-0 h-5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startCropPreviewPan(event, "resize-top");
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Crop bottom"
                            className="absolute bottom-0 left-1/2 h-5 w-10 -translate-x-1/2 translate-y-1/2 rounded-full border border-white bg-sky-500 shadow"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startCropPreviewPan(event, "resize-bottom");
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white/88 px-3 py-2 text-center text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
                        Drag inside the box to move the crop. Drag the side handles to crop width or height.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-4 pb-24 sm:p-6 sm:pb-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Crop details</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Cropping now changes the actual printed size and inches.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetCropDraft}
                      disabled={cropDraftValue.widthRatio === 1 && cropDraftValue.heightRatio === 1 && cropDraftValue.offsetX === 0 && cropDraftValue.offsetY === 0}
                      className="min-h-10 rounded-full border border-slate-300 px-4 py-2 text-[11px] font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Cropped Width</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {getCropMeasurementInches(activeDesign, cropDraftValue, "width").toFixed(2)}"
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Cropped Height</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {getCropMeasurementInches(activeDesign, cropDraftValue, "height").toFixed(2)}"
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      This behaves like phone crop: crop inline on the image itself, and the final inches reduce with the crop box.
                    </div>
                  </div>

                  <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-slate-200 bg-white/96 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <button
                      type="button"
                      onClick={closeCropModal}
                      className="min-h-11 flex-1 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyCropDraft}
                      className="min-h-11 flex-1 rounded-full border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 sm:flex-none"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLibraryModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 p-0 sm:p-6">
            <div className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(88vh,760px)] sm:max-w-5xl sm:rounded-[28px] sm:border sm:border-slate-200">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Design Library</h3>
                  <p className="mt-1 text-xs text-slate-500">Pick a folder and tap any image to use it.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLibraryModalOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-0 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-700">Folders</label>
                    <div className="space-y-2 sm:hidden">
                      <select
                        value={currentFolder || ""}
                        onChange={(e) => dispatch(setCurrentFolder(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                      >
                        <option value="" disabled>
                          Select a folder
                        </option>
                        {folders.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Browse folders from the dropdown to keep the gallery easy to scan on mobile.
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      {shouldUseFolderDropdown ? (
                        <div className="space-y-2">
                          <select
                            value={currentFolder || ""}
                            onChange={(e) => dispatch(setCurrentFolder(e.target.value))}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                          >
                            <option value="" disabled>
                              Select a folder
                            </option>
                            {folders.map((folder) => (
                              <option key={folder} value={folder}>
                                {folder}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-500">
                            {folders.length} folders available. Use the dropdown to switch quickly without hiding the designs.
                          </p>
                        </div>
                      ) : (
                        <div className="flex max-h-[180px] flex-wrap gap-2 overflow-y-auto pr-1 lg:max-h-[220px]">
                          {folders.map((folder) => (
                            <button
                              key={folder}
                              type="button"
                              onClick={() => dispatch(setCurrentFolder(folder))}
                              className={`rounded-full border px-3 py-1.5 text-xs ${
                                currentFolder === folder
                                  ? "border-sky-300 bg-sky-100 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {folder}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {currentFolder || "Select a folder"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {currentFolder
                            ? `${images.length} design${images.length === 1 ? "" : "s"} available`
                            : "Choose a folder on the left to view designs."}
                        </p>
                      </div>
                      {selectedLibraryImage && (
                        <div className="hidden rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 sm:block">
                          Last selected: {selectedLibraryImage}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                    {libraryLoading ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Loading designs...
                      </div>
                    ) : currentFolder && images.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                        {images.map((image) => (
                          <button
                            key={image.filename}
                            type="button"
                            onClick={() => handleSelectFromLibrary(image)}
                            className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 text-left transition hover:border-sky-300 hover:bg-sky-50/60"
                          >
                            <div className="aspect-square overflow-hidden bg-white p-3">
                              <img
                                src={getLibraryImageUrl(currentFolder, image.filename)}
                                alt={image.filename}
                                className="h-full w-full rounded-2xl object-cover"
                                loading="lazy"
                              />
                            </div>

                            <div className="px-3 pb-3 pt-2">
                              <p className="truncate text-xs font-medium text-slate-700">{image.filename}</p>
                              <p className="mt-1 text-[11px] text-slate-500">Tap image to use</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : currentFolder ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-slate-700">No designs in this folder</p>
                          <p className="mt-1 text-xs text-slate-500">Choose another folder from the left.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Select a folder to view designs</p>
                          <p className="mt-1 text-xs text-slate-500">The popup keeps the library compact while still letting you browse everything.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center workspace */}
        <main className="order-1 flex min-h-0 flex-1 flex-col overflow-visible sm:overflow-auto lg:order-2">
          <div className="flex-1 min-h-0 p-0">
            <div className="mx-auto flex h-auto min-h-[52vh] flex-col overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:h-full sm:min-h-0 sm:overflow-hidden sm:rounded-[28px]">
              <div className="hidden border-b border-slate-200 bg-white px-3 py-3 sm:block sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-800 sm:text-base">
                      {product?.name || "Custom Product"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {productColorName} • Size {selectedSize}
                    </p>
                  </div>
                  {customizableViews.length > 0 && (
                    <div className="flex flex-col gap-2 lg:items-end">
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {customizableViews.map((v) => {
                          const isCurrentView = v.code === viewCode;
                          return (
                            <button
                              key={v.code}
                              type="button"
                              onClick={() => setViewCode(v.code)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                isCurrentView
                                  ? "bg-sky-600 text-white shadow-sm"
                                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {v.label || v.code}
                            </button>
                          );
                        })}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 lg:max-w-[360px]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Customized Names
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 lg:justify-end">
                          {visibleCustomizationNames.length > 0 ? (
                            <>
                              {visibleCustomizationNames.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700"
                                >
                                  {name}
                                </span>
                              ))}
                              {remainingCustomizationCount > 0 && (
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
                                  +{remainingCustomizationCount} more
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500">No customized names yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {customizableViews.length > 0 && (
                <div className="border-b border-slate-200 bg-white px-3 py-2 sm:hidden">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">View</p>
                      <p className="text-[11px] font-medium leading-none text-slate-700">
                        {customizableViews.find((v) => v.code === viewCode)?.label || "Front view"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Color
                        </span>
                        {productColorOptions.map((option) => {
                          const currentColorKey = productColor?.toLowerCase() || "";
                          const isActive = option.value.toLowerCase() === currentColorKey;
                          const colorOutOfStock = !isColorAvailable(option);

                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-label={option.label}
                              title={colorOutOfStock ? `${option.label} - Out of stock` : option.label}
                              onClick={() => !colorOutOfStock && handleColorChange(option.value, option.label)}
                              disabled={colorOutOfStock}
                              className={`h-5 w-5 shrink-0 rounded-full border ${
                                isActive ? "border-sky-500 ring-1 ring-sky-200" : "border-slate-300"
                              } ${colorOutOfStock ? "opacity-40" : ""}`}
                              style={{ backgroundColor: option.value }}
                            />
                          );
                        })}
                      </div>
                      <p className="truncate text-[10px] text-slate-500">
                        {productColorName} / {selectedSize || "Default"} / Qty {selectedQuantity}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveDesign}
                        disabled={saving || addingToCart}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {token ? (saving ? "Saving..." : isEditMode ? "Update" : "Save") : "Login"}
                      </button>
                      <button
                        type="button"
                        id="customization-add-to-cart-footer-mobile"
                        onClick={handleSaveAndAddToCart}
                        aria-label="Add customized product to cart"
                        data-meta-track="add-to-cart"
                        disabled={saving || addingToCart}
                        className="rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                      >
                        {token
                          ? (addingToCart
                            ? "Adding..."
                            : savedDesignId
                              ? "Add to Cart"
                              : "Save & Cart")
                          : "Cart Login"}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {customizableViews.map((v) => {
                      const isCurrentView = v.code === viewCode;
                      return (
                        <button
                          key={v.code}
                          type="button"
                          onClick={() => setViewCode(v.code)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                            isCurrentView
                              ? "bg-sky-600 text-white shadow-sm"
                              : "border border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          {v.label || v.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mx-auto flex min-h-[44vh] flex-1 w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,116,214,0.05),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-2 sm:min-h-0 sm:max-w-6xl sm:p-5 lg:p-6">
                <div className="mx-auto w-full max-w-[960px]">
                {mockupUrl && maskUrl ? (
                  <RecolorEditor
                    ref={editorRef}
                    mockupUrl={mockupUrl}
                    maskUrl={maskUrl}
                    previewWidth={880}
                    productColor={productColor}
                    textLayers={textLayers}
                    setTextLayers={handleSetTextLayers}
                    activeTextId={activeTextId}
                    setActiveTextId={handleSetActiveTextId}
                    onRemoveActiveText={removeActiveText}
                    designLayers={designLayers}
                    setDesignLayers={handleSetDesignLayers}
                    activeDesignId={activeDesignId}
                    setActiveDesignId={handleSetActiveDesignId}
                    onRemoveActiveDesign={clearActiveDesign}
                    bgRemovalLoading={bgRemovalLoading}
                    onDesignRenderWidthChange={setDesignRenderWidth}
                    isAdmin={isAdmin}
                    selectedView={viewCode}
                    zoneOptions={availableZonesForView}
                    activeDesignZone={activeDesignZone}
                    activeTextZone={activeTextZone}
                    onMoveActiveDesignToZone={moveActiveDesignToZone}
                    onMoveActiveTextToZone={moveActiveTextToZone}
                  />
                ) : (
                  <div className="text-sm text-slate-500 text-center">{product?.name ? `No view configuration found for ${product.name}` : "Product not loaded"}</div>
                )}
                </div>
              </div>
              <div className="hidden" />
            </div>
          </div>
        </main>

        {/* Right sidebar - Price Breakdown */}
        <aside className="order-3 hidden w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-h-0 lg:sticky lg:top-24 lg:flex lg:w-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-800">Price Breakdown</h3>
              
              <button
                type="button"
                onClick={() => calculatePrice()}
                disabled={calculatingPrice}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 disabled:opacity-50"
              >
                {refreshPriceLabel}
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">Real-time price calculation</div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Base</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">Rs.{BASE_PRICE.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-500">Total</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">Rs.{price.toFixed(2)}</div>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setShowMobilePriceDetails((value) => !value)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
            >
              {showMobilePriceDetails ? "Hide price details" : "Show price details"}
            </button>
            <span className="text-[11px] text-slate-500">Keep this closed while designing.</span>
          </div>

          <div className={`${showMobilePriceDetails ? "block" : "hidden"} flex-1 overflow-auto lg:block`}>
            <div className="space-y-4">
              {/* Base Price */}
              <div className="pb-3 border-b border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-slate-700">Base Product</span>
                  <span className="text-sm font-semibold">₹{BASE_PRICE.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {product?.name || "Product"} base price
                </div>
              </div>
              
              {/* Images/Designs */}
              {priceBreakdown.images.total > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-slate-700">Designs</span>
                    <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.images.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {priceBreakdown.images.items.map((item, index) => (
                      <div key={index} className="text-[10px] bg-slate-50 p-2 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">Design {index + 1}</span>
                          <span>₹{item.price.toFixed(2)}</span>
                        </div>
                        <div className="text-slate-500 mt-1">Size: {item.displaySize}</div>
                        <div className="text-slate-500">Print: {item.printSize}</div>
                        <div className="text-amber-600 text-[9px] mt-1">{item.note}</div>
                        <div className="text-amber-600 text-[9px] mt-1">{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Text */}
              {priceBreakdown.text.total > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-slate-700">Text</span>
                    <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.text.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {priceBreakdown.text.items.map((item, index) => (
                      <div key={index} className="text-[10px] bg-slate-50 p-2 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">"{item.text}"</span>
                          <span>₹{item.price.toFixed(2)}</span>
                        </div>
                        <div className="text-slate-500 mt-1">Size: {item.displaySize} (Display)</div>
                        <div className="text-slate-500">Print: {item.printSize}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Text Minimum Charges */}
              {priceBreakdown.minimumCharges > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-amber-700">Text Minimum Charges</span>
                    <span className="text-sm font-semibold text-amber-700">+₹{priceBreakdown.minimumCharges.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-amber-600">
                    Applied to text layers smaller than {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"
                  </div>
                </div>
              )}
              
              {/* Text Additional Area */}
              {priceBreakdown.additionalArea > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-green-700">Text Additional Area</span>
                    <span className="text-sm font-semibold text-green-700">+₹{(priceBreakdown.additionalArea * PRICE_PER_SQ_INCH).toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-green-600">
                    {priceBreakdown.additionalArea.toFixed(2)} sq.in × ₹{PRICE_PER_SQ_INCH}/sq.in
                  </div>
                </div>
              )}
              
              {/* Total */}
              <div className="pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-800">Total Price</span>
                  <span className="text-xl font-bold text-green-600">₹{price.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Including all designs, text, and additional charges
                </div>
              </div>
            </div>
          </div>
          {/* Pricing Info */}
          <div className={`${showMobilePriceDetails ? "block" : "hidden"} mt-6 pt-4 border-t border-slate-200 lg:block`}>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-medium mb-1">Pricing Information:</p>
              <p>• Base price depends on the size you select for the product.</p>
              <p>• Every uploaded image is charged separately based on its printed size.</p>
              {productImagePriceRules.map((rule, index) => (
                <p key={`${rule.maxSideInches ?? "catch-all"}-${index}`}>
                  • {formatImagePriceRuleLabel(rule, index, productImagePriceRules)}: ₹{Number(rule.price || 0)}
                </p>
              ))}
              <p>• If you upload multiple images, the charge is applied per image.</p>
              <p>• Display: 72 DPI (screen preview)</p>
              <p>• Print: 300 DPI (production)</p>
            </div>
          </div>
        </aside>
      </div>
      </div>

      <nav className="hidden">
        {MOBILE_TOOL_TABS.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`rounded-[18px] px-2 py-2.5 text-[11px] font-semibold transition ${
                isActive
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}



