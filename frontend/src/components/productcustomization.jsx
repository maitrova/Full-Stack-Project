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
import { ArrowLeft, Bookmark, LayoutGrid, Palette, RotateCcw, Type, Upload, UserRound, X } from "lucide-react";
import RecolorEditor from "./RecolorEditor.jsx";
import OrderPanel, { OrderOptions } from "./customizer/OrderPanel.jsx";
import MobileDock from "./customizer/MobileDock.jsx";
import CanvasFooter from "./customizer/CanvasFooter.jsx";
import UploadPanel from "./customizer/UploadPanel.jsx";
import TextPanel from "./customizer/TextPanel.jsx";
import LibraryPanel from "./customizer/LibraryPanel.jsx";
import { PrimaryPurchaseButton, ProductToast } from "./product/ProductPageParts.jsx";
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

// Tool tabs in the left panel (colour, size and quantity live in the order panel).
const TOOL_TABS = [
  { key: TABS.DESIGNS, label: "Upload", icon: Upload },
  { key: TABS.DESIGN_LIBRARY, label: "Library", icon: LayoutGrid },
  { key: TABS.TEXT, label: "Text", icon: Type },
];

// Phones also get colour / size / quantity as a tool (desktop shows it in the order panel).
const MOBILE_TOOLS = [...TOOL_TABS, { key: TABS.PRODUCT_COLORS, label: "Colour", icon: Palette }];

const TOP_BAR_LINK =
  "inline-flex h-9 items-center gap-1.5 rounded-mt-btn border border-mt-line-strong px-3 text-xs font-medium text-mt-text transition-colors hover:bg-mt-tint/10";

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
  const [searchParams, setSearchParams] = useSearchParams();
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
    imagesFolder,
    imagesByFolder,
    currentFolder, 
    loadingFolders,
    loadingImagesFor
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
  // Edit mode state
  const editDesignId = searchParams.get("edit");
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [originalDesign, setOriginalDesign] = useState(null);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState(TABS.DESIGNS);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropDraft, setCropDraft] = useState(() => normalizeImageCrop());

  const editorRef = useRef(null);
  const viewStatesRef = useRef({});
  const removeBgRequestSeqRef = useRef(0);
  // Track the exact product object that received the homepage handoff. The
  // customizer fetch replaces the product after navigation, so a boolean would
  // incorrectly block re-applying the design after view initialization resets.
  const homepageCustomizationAppliedRef = useRef(null);
  const cropPreviewFrameRef = useRef(null);
  const cropDragStateRef = useRef(null);
  const customizerReturnPath = `${location.pathname}${location.search}`;
  const requestedCollection = searchParams.get("collection") || "";
  const shouldOpenLibraryFromUrlRef = useRef(searchParams.has("collection"));

  const resolveFolderFromCollection = (collection, availableFolders = []) => {
    if (!collection || !availableFolders.length) return null;
    return (
      availableFolders.find((folder) => folder === collection) ||
      availableFolders.find(
        (folder) => String(folder).toLowerCase() === String(collection).toLowerCase()
      ) ||
      null
    );
  };

  const updateDesignLibraryCollectionUrl = (folder, { replace = false } = {}) => {
    if (!folder) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("collection", folder);
    setSearchParams(nextParams, { replace });
  };

  const selectDesignLibraryFolder = (folder, options = {}) => {
    if (!folder) return;
    dispatch(setCurrentFolder(folder));
    updateDesignLibraryCollectionUrl(folder, options);
  };

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

  const shouldShowToolSection = (tabKey) => activeTab === tabKey;

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

  useEffect(() => {
    if (!folders.length) return;

    const folderFromUrl = resolveFolderFromCollection(requestedCollection, folders);
    const nextFolder = folderFromUrl || currentFolder || folders[0];

    if (nextFolder && currentFolder !== nextFolder) {
      dispatch(setCurrentFolder(nextFolder));
    }

    if (!requestedCollection || !folderFromUrl) {
      updateDesignLibraryCollectionUrl(nextFolder, { replace: true });
    }
  }, [dispatch, folders, requestedCollection, currentFolder]);

  useEffect(() => {
    if (!shouldOpenLibraryFromUrlRef.current || !requestedCollection || !folders.length) return;

    const folderFromUrl = resolveFolderFromCollection(requestedCollection, folders);
    if (folderFromUrl) {
      setActiveTab(TABS.DESIGN_LIBRARY);
      setIsLibraryModalOpen(true);
      shouldOpenLibraryFromUrlRef.current = false;
    }
  }, [requestedCollection, folders]);

  // Fetch images when folder changes
  useEffect(() => {
    if (currentFolder) {
      dispatch(fetchImages(currentFolder));
    }
  }, [dispatch, currentFolder]);

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
  const currentFolderImages =
    (currentFolder && imagesByFolder?.[currentFolder]) ||
    (imagesFolder === currentFolder ? images : []);
  const isCurrentFolderLoading =
    Boolean(currentFolder) &&
    Boolean(loadingFolders?.[currentFolder] || loadingImagesFor === currentFolder) &&
    currentFolderImages.length === 0;
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

  useEffect(() => {
    const homepageCustomization = location.state?.homepageCustomization;
    if (
      !product ||
      !homepageCustomization ||
      homepageCustomizationAppliedRef.current === product
    ) return;

    homepageCustomizationAppliedRef.current = product;

    if (homepageCustomization.color) {
      handleColorChange(homepageCustomization.color, homepageCustomization.colorName);
    }

    const previewDesign = homepageCustomization.design;
    if (!previewDesign?.imageUrl) {
      if (homepageCustomization.openLibrary) {
        setActiveTab(TABS.DESIGN_LIBRARY);
        setIsLibraryModalOpen(true);
      }
      return;
    }
    const productForApplication = product;

    const applyPreviewDesign = async () => {
      try {
        setError("");
        const { width, height } = await getImageNaturalSize(previewDesign.imageUrl);
        if (homepageCustomizationAppliedRef.current !== productForApplication) return;
        const id = `design-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
        const targetViewCode = previewDesign.viewCode === "back" ? "back" : "front";
        const baseLayer = createDesignLayer(
          id,
          previewDesign.imageUrl,
          null,
          width,
          height,
          {
            isFromLibrary: true,
            viewCode: targetViewCode,
            zone: getInitialZoneKey(targetViewCode),
            priceRules: productImagePriceRules,
          }
        );
        const homepageLayer = previewDesign.layer || {};
        const newLayer = {
          ...baseLayer,
          ...homepageLayer,
          id,
          imageUrl: previewDesign.imageUrl,
          filename: previewDesign.filename || baseLayer.filename,
          file: null,
          sourceFile: null,
          isFromLibrary: true,
          viewCode: targetViewCode,
          zone: targetViewCode === "back"
            ? "back-full"
            : (homepageLayer.zone === "pocket" ? "pocket" : "front-full"),
          priceRules: productImagePriceRules,
        };

        setViewCode(targetViewCode);
        setViewStates((prev) => ({
          ...prev,
          [targetViewCode]: {
            ...(prev[targetViewCode] || {}),
            textLayers: prev[targetViewCode]?.textLayers || [],
            activeTextId: prev[targetViewCode]?.activeTextId || null,
            designLayers: [...(prev[targetViewCode]?.designLayers || []), newLayer],
            activeDesignId: id,
          },
        }));
        setSelectedLibraryImage(previewDesign.filename || "Homepage selection");
        if (homepageCustomization.openLibrary) {
          setActiveTab(TABS.DESIGN_LIBRARY);
          setIsLibraryModalOpen(true);
        } else {
          setActiveTab(TABS.DESIGNS);
        }
      } catch (previewError) {
        console.error("Failed to apply homepage customization:", previewError);
        setError("The selected homepage design could not be loaded. You can choose it again from the design library.");
      }
    };

    applyPreviewDesign();
  }, [location.state, product]);

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
      <div className="flex h-screen items-center justify-center bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
        <div className="rounded-md bg-mt-surface px-4 py-3 shadow text-sm">
          {loadingEditData ? "Loading design for editing..." : "Loading product…"}
        </div>
      </div>
    );
  }

  if (currentStatus === "failed") {
    return (
      <div className="flex h-screen items-center justify-center bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
        <div className="rounded-md bg-mt-surface px-4 py-3 shadow text-sm text-mt-danger">
          Failed to load product: {currentError}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-screen items-center justify-center bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
        <div className="rounded-md bg-mt-surface px-4 py-3 shadow text-sm text-mt-danger">
          Product not found. Please check the URL.
        </div>
      </div>
    );
  }

  const customizableViews = getCustomizableViews(product?.views);
  const currentView = customizableViews.find((v) => v.code === viewCode) || customizableViews[0] || product.views[0];
  const mockupUrl = currentView?.mockupUrl;
  const maskUrl = currentView?.maskUrl;
  const zoneChoices = availableZonesForView.map((zone) => ({ value: zone, label: ZONE_LABELS[zone] || zone }));

  // Tapping something on the product opens its editor in the tools panel.
  const selectTextFromCanvas = (idOrUpdater) => {
    handleSetActiveTextId(idOrUpdater);
    if (typeof idOrUpdater === "string" && idOrUpdater) setActiveTab(TABS.TEXT);
  };
  const selectDesignFromCanvas = (idOrUpdater) => {
    handleSetActiveDesignId(idOrUpdater);
    if (typeof idOrUpdater === "string" && idOrUpdater) setActiveTab(TABS.DESIGNS);
  };

  // Colour / size / quantity pickers: shared by the order panel and the phone "Colour" sheet.
  const orderOptionProps = {
    colors: productColorOptions.map((option) => {
      const available = isColorAvailable(option);
      const label = option.label || getColorLabel(option.value, productColorOptions);
      return {
        value: String(option.value).toLowerCase(),
        hex: option.value,
        label: available ? label : `${label} (out of stock)`,
        disabled: !available,
      };
    }),
    selectedColor: productColor,
    selectedColorName: productColorName,
    onColorChange: (value) => {
      const option = productColorOptions.find((o) => String(o.value).toLowerCase() === value);
      if (option && isColorAvailable(option)) handleColorChange(option.value, option.label);
    },
    sizes: (inStockSizePricing.length > 0 ? inStockSizePricing : availableSizePricing).map((entry) => {
      const isOutOfStock = entry?.stock !== undefined && Number(entry?.stock ?? 0) <= 0;
      return {
        value: entry.size,
        disabled: isOutOfStock,
        title: isOutOfStock ? "Out of stock" : `₹${getSizeBasePrice(product, entry.size)}`,
      };
    }),
    selectedSize,
    onSizeChange: setSelectedSize,
    basePrice: BASE_PRICE,
    quantity: selectedQuantity,
    maxQuantity: maxOrderQuantity,
    onQuantityChange: updateSelectedQuantity,
    isOutOfStock: isSelectionOutOfStock,
    stockNote: isSelectionOutOfStock
      ? "Out of stock in this size and colour"
      : maxOrderQuantity <= 10
        ? `Only ${maxOrderQuantity} left`
        : "",
  };

  // Phones: the tools panel opens as a bottom sheet (also when a library link asks for it).
  const isToolSheetOpen = mobileSheetOpen || isLibraryModalOpen;
  const closeToolSheet = () => {
    setMobileSheetOpen(false);
    setIsLibraryModalOpen(false);
  };
  const handleDockTool = (key) => {
    if (isToolSheetOpen && activeTab === key) {
      closeToolSheet();
      return;
    }
    setActiveTab(key);
    setMobileSheetOpen(true);
  };
  const toolSheetTitle = MOBILE_TOOLS.find((tool) => tool.key === activeTab)?.label || "Tools";
  const canAddSavedDesignToCart = Boolean(savedDesignId || editDesignId);
  const primarySaveActionLabel = token
    ? (saving ? "Saving…" : isEditMode ? "Update Design" : "Save Design")
    : "Login to Save";
  const primaryCartActionLabel = token
    ? (addingToCart ? "Adding…" : savedDesignId ? "Add to Cart" : "Save & Add to Cart")
    : "Login for Cart";

  return (
    <div className="min-h-[100dvh] bg-mt-bg pb-40 font-brand text-mt-text [color-scheme:var(--mt-scheme)] lg:pb-12">
      {/* Top bar: what is being customized + account / admin links */}
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">
            {isEditMode ? "Editing saved design" : "Customize"}
          </p>
          <h1 className="mt-1 truncate text-2xl leading-tight text-mt-text sm:text-3xl">
            {product?.name || "Custom product"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && (
            <button type="button" onClick={handleBackToAdmin} className={TOP_BAR_LINK}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to admin
            </button>
          )}
          {isEditMode && originalDesign && (
            <button type="button" onClick={handleResetToOriginal} className={TOP_BAR_LINK}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset to original
            </button>
          )}
          <Link
            to={token ? "/usersaved_designs" : "/login"}
            state={token ? undefined : { from: customizerReturnPath }}
            className={TOP_BAR_LINK}
          >
            {token ? <Bookmark className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
            {token ? "My designs" : "Log in"}
          </Link>
        </div>
      </div>
      {!token && (
        <p className="mx-auto max-w-[1500px] px-4 pt-2 text-xs text-mt-muted sm:px-6 lg:px-8">
          Design freely — you only need to log in to save your design or add it to your cart.
        </p>
      )}

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 pt-4 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:items-start lg:gap-6 lg:px-8">
        {/* Left: design tools */}
        <aside
          aria-label="Design tools"
          className={`${isToolSheetOpen ? "flex" : "hidden"} fixed inset-x-0 bottom-0 z-50 max-h-[58dvh] min-h-0 flex-col gap-4 rounded-t-[14px] border-t border-mt-line bg-mt-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,0.18)] lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-40 lg:z-auto lg:order-1 lg:flex lg:max-h-[calc(100dvh-11rem)] lg:rounded-mt-card lg:border lg:shadow-none`}
        >
          {/* Phone sheet header */}
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <p className="text-sm font-medium text-mt-text">{toolSheetTitle}</p>
            <button
              type="button"
              onClick={closeToolSheet}
              className="h-9 rounded-mt-btn bg-mt-btn px-4 text-xs font-medium text-mt-btn-text hover:bg-mt-btn-hover"
            >
              Done
            </button>
          </div>
          <div role="tablist" aria-label="Design tools" className="hidden grid-cols-3 gap-1 rounded-mt-btn bg-mt-bg p-1 lg:grid">
            {TOOL_TABS.map(({ key, label, icon }) => {
              const Icon = icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleToolTabChange(key)}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-[2px] text-xs font-medium transition-colors ${
                    isActive ? "bg-mt-surface text-mt-text shadow-sm" : "text-mt-muted hover:text-mt-text"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {shouldShowToolSection(TABS.DESIGNS) && (
              <UploadPanel
                accept={SUPPORTED_DESIGN_ACCEPT}
                formatsLabel="PNG, JPG, WEBP, SVG, HEIC and more"
                onUpload={handleDesignUpload}
                layers={designLayers.map((layer, index) => ({
                  id: layer.id,
                  label: getDesignLayerDisplayName(layer, index),
                  thumb: layer.imageUrl,
                }))}
                activeDesign={activeDesign}
                onSelectLayer={handleSetActiveDesignId}
                libraryName={selectedLibraryImage}
                onScale={handleDesignScaleChange}
                onScaleX={handleDesignScaleXChange}
                onScaleY={handleDesignScaleYChange}
                onNudge={nudgeDesignScaleAxis}
                onRemoveBackground={handleRemoveBackground}
                removingBackground={bgRemovalLoading}
                onCrop={openCropModal}
                onDelete={clearActiveDesign}
                zones={zoneChoices}
                activeZone={activeDesignZone}
                onZoneChange={moveActiveDesignToZone}
              />
            )}

            {shouldShowToolSection(TABS.TEXT) && (
              <TextPanel
                layers={textLayers.map((layer, index) => ({
                  id: layer.id,
                  label: getTextLayerDisplayName(layer, index),
                }))}
                activeLayer={activeTextLayer}
                onSelectLayer={handleSetActiveTextId}
                onAdd={addNewText}
                onRemove={removeActiveText}
                onChange={updateActiveTextLayer}
                fonts={FONT_OPTIONS}
                zones={zoneChoices}
                activeZone={activeTextZone}
                onZoneChange={moveActiveTextToZone}
              />
            )}

            {shouldShowToolSection(TABS.DESIGN_LIBRARY) && (
              <LibraryPanel
                folders={folders}
                currentFolder={currentFolder}
                onSelectFolder={selectDesignLibraryFolder}
                images={currentFolderImages}
                loading={isCurrentFolderLoading}
                getImageUrl={getLibraryImageUrl}
                onPick={handleSelectFromLibrary}
                lastPicked={selectedLibraryImage}
              />
            )}
            {shouldShowToolSection(TABS.PRODUCT_COLORS) && (
              <div className="lg:hidden">
                <OrderOptions {...orderOptionProps} />
              </div>
            )}
          </div>
        </aside>

        {isCropModalOpen && activeDesign && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-0 sm:p-4"
            onClick={closeCropModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="crop-dialog-title"
              className="flex h-[100dvh] w-full flex-col overflow-hidden bg-mt-surface font-brand text-mt-text shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-mt-card sm:border sm:border-mt-line"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-mt-line px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <h3 id="crop-dialog-title" className="text-lg leading-tight text-mt-text">
                    Crop image
                  </h3>
                  <p className="mt-0.5 text-xs text-mt-subtle">Drag the box to move it, or its side handles to trim.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCropModal}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mt-btn text-mt-muted hover:bg-mt-tint/10 hover:text-mt-text"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex items-center justify-center bg-mt-photo p-4 sm:p-6">
                  <div
                    ref={cropPreviewFrameRef}
                    className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[2px] bg-mt-surface"
                    style={{
                      aspectRatio: `${Math.max(activeDesign.originalWidthPx || 1, 1)} / ${Math.max(activeDesign.originalHeightPx || 1, 1)}`,
                      touchAction: "none",
                    }}
                  >
                    <img
                      src={activeDesign.imageUrl}
                      alt="Image being cropped"
                      className="absolute inset-0 h-full w-full select-none object-fill"
                      draggable={false}
                    />

                    <div className="pointer-events-none absolute inset-0 bg-black/40" />

                    <div
                      className="absolute cursor-move border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                      style={{
                        left: `${cropBoxRect.left * 100}%`,
                        top: `${cropBoxRect.top * 100}%`,
                        width: `${cropBoxRect.width * 100}%`,
                        height: `${cropBoxRect.height * 100}%`,
                      }}
                      onPointerDown={(event) => startCropPreviewPan(event, "move")}
                    >
                      <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
                      <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />

                      <button
                        type="button"
                        aria-label="Crop left"
                        className="absolute left-0 top-1/2 h-10 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20 bg-white shadow"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startCropPreviewPan(event, "resize-left");
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Crop right"
                        className="absolute right-0 top-1/2 h-10 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border border-black/20 bg-white shadow"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startCropPreviewPan(event, "resize-right");
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Crop top"
                        className="absolute left-1/2 top-0 h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20 bg-white shadow"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startCropPreviewPan(event, "resize-top");
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Crop bottom"
                        className="absolute bottom-0 left-1/2 h-4 w-10 -translate-x-1/2 translate-y-1/2 rounded-full border border-black/20 bg-white shadow"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startCropPreviewPan(event, "resize-bottom");
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  <div>
                    <p className="text-xs text-mt-muted">Prints at about</p>
                    <p className="mt-1 text-xl tabular-nums text-mt-text">
                      {getCropMeasurementInches(activeDesign, cropDraftValue, "width").toFixed(1)} ×{" "}
                      {getCropMeasurementInches(activeDesign, cropDraftValue, "height").toFixed(1)} in
                    </p>
                    <p className="mt-1 text-[11px] text-mt-subtle">
                      Keeping {Math.round(cropDraftValue.widthRatio * 100)}% × {Math.round(cropDraftValue.heightRatio * 100)}% of the image.
                      A smaller crop prints smaller.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetCropDraft}
                    disabled={cropDraftValue.widthRatio === 1 && cropDraftValue.heightRatio === 1 && cropDraftValue.offsetX === 0 && cropDraftValue.offsetY === 0}
                    className="inline-flex items-center gap-1.5 text-xs text-mt-muted underline-offset-4 hover:text-mt-text hover:underline disabled:pointer-events-none disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset crop
                  </button>
                </div>
              </div>

              <div className="flex gap-2 border-t border-mt-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeCropModal}
                  className="h-11 flex-1 rounded-mt-btn border border-mt-text px-5 text-sm font-medium text-mt-text hover:bg-mt-tint/10 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCropDraft}
                  className="h-11 flex-1 rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text hover:bg-mt-btn-hover sm:flex-none"
                >
                  Apply crop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Centre: canvas */}
        <main className="order-1 min-w-0 lg:order-2">
          <div className="overflow-hidden rounded-mt-card border border-mt-line bg-mt-surface">
            <div className="flex min-h-[46vh] items-center justify-center bg-mt-photo p-2 sm:p-5 lg:min-h-[560px] lg:p-6">
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
                    setActiveTextId={selectTextFromCanvas}
                    onRemoveActiveText={removeActiveText}
                    designLayers={designLayers}
                    setDesignLayers={handleSetDesignLayers}
                    activeDesignId={activeDesignId}
                    setActiveDesignId={selectDesignFromCanvas}
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
                  <div className="text-sm text-mt-subtle text-center">{product?.name ? `No view configuration found for ${product.name}` : "Product not loaded"}</div>
                )}
              </div>
            </div>
            <CanvasFooter
              views={customizableViews.map((v) => ({
                code: v.code,
                label: v.label,
                hasLayers: Boolean(viewStates[v.code]?.textLayers?.length || viewStates[v.code]?.designLayers?.length),
              }))}
              currentView={viewCode}
              onViewChange={setViewCode}
              addedNames={visibleCustomizationNames}
              extraCount={remainingCustomizationCount}
            />
          </div>
        </main>

        {/* Right: colour, size, quantity, price and actions */}
        <aside aria-label="Your order" className="order-3 lg:sticky lg:top-40">
          <OrderPanel
            productName={product?.name}
            price={price}
            basePrice={BASE_PRICE}
            priceBreakdown={priceBreakdown}
            additionalAreaCharge={priceBreakdown.additionalArea * PRICE_PER_SQ_INCH}
            minimumChargeNote={`For text smaller than ${FIXED_SIZE_INCHES}" × ${FIXED_SIZE_INCHES}"`}
            pricingNotes={productImagePriceRules.map((rule, index) => ({
              label: formatImagePriceRuleLabel(rule, index, productImagePriceRules),
              price: Number(rule.price || 0),
            }))}
            viewLabel={(code) => customizableViews.find((v) => v.code === code)?.label || code || "Front"}
            calculatingPrice={calculatingPrice}
            onRefreshPrice={() => calculatePrice()}
            {...orderOptionProps}
            saveLabel={primarySaveActionLabel}
            cartLabel={primaryCartActionLabel}
            onSave={handleSaveDesign}
            onAddToCart={handleSaveAndAddToCart}
            busy={saving || addingToCart}
            saving={saving}
            addingToCart={addingToCart}
            addToCartId="customization-add-to-cart-header-desktop"
          />
        </aside>
      </div>

      <ProductToast
        show={Boolean(error || saveError || saveSuccess)}
        type={error || saveError ? "error" : "success"}
        message={error || saveError || (isEditMode ? "Design updated." : "Design saved.")}
        onClose={() => {
          setError("");
          setSaveError("");
          setSaveSuccess(false);
        }}
        offsetClass="bottom-36 lg:bottom-8"
      />

      <MobileDock
        tools={MOBILE_TOOLS}
        activeKey={isToolSheetOpen ? activeTab : null}
        onTool={handleDockTool}
        price={`₹${price.toFixed(2)}`}
        caption={`${productColorName} · Size ${selectedSize} · Qty ${selectedQuantity}`}
      >
        <button
          type="button"
          onClick={handleSaveDesign}
          disabled={saving || addingToCart}
          aria-label={primarySaveActionLabel}
          title={primarySaveActionLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mt-btn border border-mt-line-strong text-mt-text disabled:opacity-50"
        >
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        </button>
        <PrimaryPurchaseButton
          id="customization-add-to-cart-footer-mobile"
          onClick={handleSaveAndAddToCart}
          aria-label="Add customized product to cart"
          data-meta-track="add-to-cart"
          disabled={saving || addingToCart}
          busy={addingToCart}
          className="h-11 shrink-0"
        >
          {primaryCartActionLabel}
        </PrimaryPurchaseButton>
      </MobileDock>
    </div>
  );
}



