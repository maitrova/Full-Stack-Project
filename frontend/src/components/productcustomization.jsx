// src/pages/DesignerPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
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
const IMAGE_FIXED_INCH = 4;
const IMAGE_PRICE_SMALL = 40;   // <= 4x4
const IMAGE_PRICE_LARGE = 100; 
const SUPPORTED_DESIGN_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SUPPORTED_DESIGN_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const SUPPORTED_DESIGN_FORMATS_LABEL = "JPG, JPEG, PNG, and WEBP";
const SUPPORTED_DESIGN_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";



const getFixedImageLayerPrice = (wIn, hIn) => {
  const w = Number(wIn || 0);
  const h = Number(hIn || 0);
  if (!w || !h) return 0; // unknown yet
  return (w <= IMAGE_FIXED_INCH && h <= IMAGE_FIXED_INCH) ? IMAGE_PRICE_SMALL : IMAGE_PRICE_LARGE;
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

const ZONE_LABELS = {
  "front-full": "Front",
  pocket: "Pocket",
  "back-full": "Back",
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
  { key: TABS.VIEWS, label: "View" },
  { key: TABS.DESIGN_LIBRARY, label: "Library" },
];

const COLOR_OPTIONS = [
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

const COLOR_NAME_MAP = COLOR_OPTIONS.reduce((acc, option) => {
  acc[option.value.toLowerCase()] = option.label;
  return acc;
}, {});

const getColorLabel = (colorValue) => {
  if (!colorValue) return "Custom Color";
  const normalized = colorValue.trim().toLowerCase();
  const label = COLOR_NAME_MAP[normalized];
  return label ? label : `Custom (${colorValue.toUpperCase()})`;
};

const getFileExtension = (name = "") => {
  const parts = String(name).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
};

const isSupportedDesignSource = ({ name = "", type = "" } = {}) => {
  const normalizedType = String(type || "").toLowerCase();
  if (SUPPORTED_DESIGN_MIME_TYPES.has(normalizedType)) return true;
  return SUPPORTED_DESIGN_EXTENSIONS.has(getFileExtension(name));
};

const createDefaultTextLayer = () => ({
  id: "text-" + Date.now() + "-" + Math.random().toString(36).slice(2),
  text: "YOUR TEXT",
  x: 0.5,
  y: 0.5,
  fontSize: 42,
  color: "#000000",
  fontFamily: "Impact, sans-serif",
  rotation: 0,
});

const createDesignLayer = (id, imageUrl, file, width, height, isFromLibrary = false) => {
  const displayWidthInches = width / DISPLAY_DPI;
  const displayHeightInches = height / DISPLAY_DPI;

  const printWidthInches = width / PRINT_DPI;
  const printHeightInches = height / PRINT_DPI;

  const initialScale = 0.35;

  const initialWidthIn = printWidthInches * initialScale;
  const initialHeightIn = printHeightInches * initialScale;

  // ✅ FIXED PRICE here too
  const layerPrice = getFixedImageLayerPrice(initialWidthIn, initialHeightIn);

  return {
    id,
    imageUrl,
    file,
    hasBgRemoved: false,
    x: 0.5,
    y: 0.5,
    scale: initialScale,
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
    minimumChargeApplied: layerPrice === IMAGE_PRICE_SMALL,
  };
};


export default function DesignerPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectCurrentToken);
  const { current: product, currentStatus, currentError } = useSelector(
    (state) => state.products
  );
  const user = useSelector(selectCurrentUser);

  const isAdmin = user?.role === "admin" || user?.isAdmin === true || user?.role === "superuser";
  // Design uploads state
  const DEFAULT_SIZE = "M";
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
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

  const [savedDesignId, setSavedDesignId] = useState(null);
  const [lastSavedPreview, setLastSavedPreview] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);

  const defaultColorValue = COLOR_OPTIONS[0]?.value || "#FFFFFF";
  
  const defaultColorLabel = getColorLabel(defaultColorValue);
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
  const availableSizes = (product?.sizePricing?.length ? product.sizePricing : [])
  .map((x) => x.size);
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
  const [isDesktopToolsLayout, setIsDesktopToolsLayout] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });

  const editorRef = useRef(null);
  const viewStatesRef = useRef({});

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

  const handleColorChange = (color, label = null) => {
    setProductColor(color);
    setProductColorName(label || getColorLabel(color));
  };

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

  // Inches should be derived from PRINT inches * scale
  const currentDisplayWidthInches = (layer.displayWidthInches || 0) * nextScaleX;
  const currentDisplayHeightInches = (layer.displayHeightInches || 0) * nextScaleY;

  const currentPrintWidthInches = (layer.printWidthInches || 0) * nextScaleX;
  const currentPrintHeightInches = (layer.printHeightInches || 0) * nextScaleY;

  // Pixels
  const renderedWidthPx = (layer.originalWidthPx || 0) * nextScaleX;
  const renderedHeightPx = (layer.originalHeightPx || 0) * nextScaleY;

  // ✅ ALWAYS recompute inches from print inches so it updates immediately
  const widthIn = Number(currentPrintWidthInches || 0);
  const heightIn = Number(currentPrintHeightInches || 0);

  const layerPrice = getFixedImageLayerPrice(widthIn, heightIn);

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
    minimumChargeApplied: layerPrice === IMAGE_PRICE_SMALL,

    currentAdditionalArea: 0,
  };
};

const _num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const restoreDesignLayerFromSaved = (d) => {
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
            allTextLayers.push({
              ...textLayer,
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

  const price = getFixedImageLayerPrice(widthIn, heightIn);

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
    note: "Fixed price (from RecolorEditor inches)",
  });
});



    textLayers.forEach((textLayer) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${textLayer.fontSize}px ${textLayer.fontFamily}`;
      
      const textMetrics = ctx.measureText(textLayer.text);
      const textWidthPx = textMetrics.width;
      const textHeightPx = textLayer.fontSize * 1.2;
      
      const widthInches = textWidthPx / PRINT_DPI;
      const heightInches = textHeightPx / PRINT_DPI;
      const areaInches = widthInches * heightInches;
      
      const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
      const additionalArea = Math.max(0, areaInches - fixedArea);
      let textPrice = additionalArea * PRICE_PER_SQ_INCH;
      
      if (areaInches > 0 && textPrice < MINIMUM_DESIGN_CHARGE && areaInches <= fixedArea) {
        textPrice = MINIMUM_DESIGN_CHARGE;
        breakdown.minimumCharges += MINIMUM_DESIGN_CHARGE; // add zero value here
      }
      
      if (additionalArea > 0) {
        breakdown.additionalArea += additionalArea;
      }
      
      if (textPrice > 0) {
        totalPrice += textPrice;
        breakdown.text.count += 1;
        breakdown.text.total += textPrice;
        
        breakdown.text.items.push({
          id: textLayer.id,
          text: textLayer.text?.substring(0, 15) + (textLayer.text?.length > 15 ? "..." : ""),
          fontSize: textLayer.fontSize,
          displaySize: `${(textWidthPx / DISPLAY_DPI).toFixed(2)}" × ${(textHeightPx / DISPLAY_DPI).toFixed(2)}"`,
          printSize: `${widthInches.toFixed(3)}" × ${heightInches.toFixed(3)}"`,
          areaInches: areaInches.toFixed(3),
          additionalArea: additionalArea.toFixed(3),
          price: textPrice,
          viewCode: textLayer.viewCode,
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
        setProductColorName(design.productColorName || getColorLabel(resolvedColor));

        const loadedViewStates = {};
        design.views?.forEach((view) => {
          loadedViewStates[view.code] = {
            textLayers: view.textLayers?.map(t => ({
              ...t,
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
  });

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
  }, [editDesignId, product, editModeInitialized]);

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

  const sizes = (product.sizePricing || []).map((x) => x.size);
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
  const selectedOrLatestDesign = activeDesign || designLayers[designLayers.length - 1] || null;
  const availableZonesForView = ZONE_OPTIONS_BY_VIEW[viewCode] || ["front-full"];
  const activeDesignZone = activeDesign?.zone || availableZonesForView[0] || "front-full";

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

  const updateActiveTextLayer = (patch) => {
    if (!activeTextLayer) return;
    const newLayers = textLayers.map((layer) =>
      layer.id === activeTextLayer.id ? { ...layer, ...patch } : layer
    );
    updateCurrentViewState({ textLayers: newLayers });
  };

  const addNewText = () => {
    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newLayer = { ...createDefaultTextLayer(), id, text: "New Text" };
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

      newLayers.push(createDesignLayer(id, serverUrl, file, width, height, false));
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

        if (!isSupportedDesignSource({ name: image.filename })) {
          setError(`Only ${SUPPORTED_DESIGN_FORMATS_LABEL} files are allowed for background removal.`);
          return;
        }
        
        // Construct full URL for the image from design library
        const imageUrl = `${IMAGE_URL}/outputs/adminuploadeddesigns/${currentFolder}/${image.filename}`;
      
      // Fetch the image to create a file object for background removal
      console.log("Fetching image from library...");
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
        
        const blob = await response.blob();
        const file = new File([blob], image.filename, { type: blob.type });
        if (!isSupportedDesignSource(file)) {
          throw new Error(`Only ${SUPPORTED_DESIGN_FORMATS_LABEL} files are allowed for background removal`);
        }
        console.log("Created file object from library image:", image.filename);
      
      const id = `design-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { width, height } = await getImageNaturalSize(imageUrl);
      console.log("Pixels source: design library image", {
        filename: image.filename,
        width,
        height,
      });
      
      const newLayer = createDesignLayer(id, imageUrl, file, width, height, true);
      
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

    try {
      setBgRemovalLoading(true);
      setError("");
      console.log("Starting background removal for:", targetDesign.id);
      
      let fileToUse = targetDesign.originalFile || targetDesign.file;
      
      // If no file object exists (design came from library or was previously loaded without file), fetch it
      if (!fileToUse && targetDesign.imageUrl) {
        console.log("No file object found, fetching image from URL...");
        
        try {
          // Fetch the image from the URL
          const response = await fetch(targetDesign.imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          
          // Convert response to blob
          const blob = await response.blob();
          
          // Create a File object from the blob
          const filename = targetDesign.imageUrl.split('/').pop() || 'design.png';
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

      if (!data.outputUrl) {
        console.log("Output URL is missing in the response");
        throw new Error("Background removal failed: no output URL");
      }

      const assetBaseUrl = (IMAGE_URL || API_URL || window.location.origin)
        .replace(/\/$/, "")
        .replace(/\/api$/, "");
      const outputAssetUrl = `${assetBaseUrl}${data.outputUrl}`;
      const outputPreviewUrl = `${outputAssetUrl}?t=${Date.now()}`;
      console.log("Constructed background removed image URL:", outputAssetUrl);

      let previewUrl = outputPreviewUrl;
      let processedFile = fileToUse;

      try {
        const processedResponse = await fetch(outputAssetUrl, { cache: "no-store" });
        if (!processedResponse.ok) {
          throw new Error(`Failed to fetch processed image: ${processedResponse.status}`);
        }

        const processedBlob = await processedResponse.blob();
        const processedName =
          data.outputUrl.split("/").pop() || `${targetDesign.id}-transparent.png`;

        processedFile = new File([processedBlob], processedName, {
          type: processedBlob.type || "image/png",
        });
        previewUrl = URL.createObjectURL(processedBlob);
      } catch (fetchProcessedErr) {
        console.warn("Falling back to direct processed image URL:", fetchProcessedErr);
      }

      if (
        targetDesign.imageUrl &&
        targetDesign.imageUrl.startsWith("blob:") &&
        targetDesign.imageUrl !== previewUrl
      ) {
        URL.revokeObjectURL(targetDesign.imageUrl);
      }

      setViewStates((prev) => {
        const existing = prev[viewCode];
        const current = existing ? { ...baseViewState, ...existing } : baseViewState;
        const updatedLayers = (current.designLayers || []).map((layer) =>
          layer.id === targetDesign.id
            ? {
                ...layer,
                imageUrl: previewUrl,
                hasBgRemoved: true,
                file: processedFile,
                originalFile: processedFile,
                isFromLibrary: false,
              }
            : layer
        );

        console.log("Updated layers with background removed:", updatedLayers);

        return {
          ...prev,
          [viewCode]: {
            ...current,
            designLayers: updatedLayers,
            activeDesignId: targetDesign.id,
          },
        };
      });
      
      // Clear the library image indicator since it's now a processed image
      setSelectedLibraryImage(null);
      
    } catch (err) {
      console.error("Remove BG error:", err);
      setError(err.message || "Background removal failed");
    } finally {
      setBgRemovalLoading(false);
      console.log("Background removal process completed");
    }
  };

  const clearActiveDesign = () => {
    if (!activeDesign) return;
    setError("");

    if (activeDesign.imageUrl && activeDesign.imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(activeDesign.imageUrl);
    }

    const remaining = designLayers.filter((d) => d.id !== activeDesign.id);
    const newActiveId = remaining[0]?.id ?? null;

    updateCurrentViewState({
      designLayers: remaining,
      activeDesignId: newActiveId,
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
      setSaveError("Please login to save your design.");
      setSaveSuccess(false);
      return;
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
          ({ id, text, x, y, fontSize, color, fontFamily, rotation }) => ({
            id, text, x, y, fontSize, color, fontFamily, rotation,
          })
        );

        const designLayersPayload = (vs.designLayers || []).map(
  ({
    id,
    imageUrl,
    hasBgRemoved,
    x,
    y,
    scale,
    rotation,
    zone,
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

    hasBgRemoved: !!hasBgRemoved,

    x,
    y,
    scale,
    rotation,

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
      // ✅ keep these after successful save


    } catch (err) {
      console.error("Save design error:", err);
      setSaveError(err.message || "Failed to save design");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAddToCart = async () => {
  if (!token) {
    setSaveError("Please login to add items to cart.");
    return;
  }

  try {
    setAddingToCart(true);
    setError("");

    // If not saved yet, save first
    let designIdToUse = savedDesignId;

    if (!designIdToUse) {
      await handleSaveDesign();

      // handleSaveDesign sets savedDesignId; wait a tick for state
      await new Promise((r) => setTimeout(r, 0));
      designIdToUse = savedDesignId || editDesignId;
    }

    if (!designIdToUse) {
      throw new Error("Design not saved yet. Please save the design first.");
    }

    // ✅ cart payload (backend can ignore extra fields if not needed)
    const cartPayload = {
      kind: "DESIGN",
      design: designIdToUse,
      productId: product?._id || product?.id,
      qty: 1,
      selectedSize,
      productColor,
      productColorName,
      designId: designIdToUse,
      previewImage: lastSavedPreview || null,
      unitPrice: price, // total calculated price shown on UI
      signature: `${product?._id || product?.id}|${selectedSize}|${productColor}|${designIdToUse}`,
    };

    await dispatch(addToCart(cartPayload)).unwrap();

    // optional: go to cart page
    navigate("/cart");
  } catch (e) {
    setError(e?.message || "Failed to add to cart");
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
  });
        }) || [],
        activeDesignId: view.designLayers?.[0]?.id || null,
      };
    });

    setViewStates(restoredViewStates);
    const resolvedColor = originalDesign.productColor || defaultColorValue;
    setProductColor(resolvedColor);
    setProductColorName(originalDesign.productColorName || getColorLabel(resolvedColor));
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

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-slate-100 via-white to-slate-100 text-slate-900 sm:min-h-screen sm:h-auto sm:overflow-visible">
      {/* Top bar */}
      <header className="sticky top-0 z-20 hidden flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-extrabold tracking-wide text-orange-500">
              MYPRINT
            </div>

            <Link
              to="/usersaved_designs"
              className="rounded-full border border-sky-600 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 transition"
            >
              My Designs
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
              {saving ? "Savingâ€¦" : isEditMode ? "Update Design" : "Save Design"}
            </button>

            <button
              onClick={handleSaveAndAddToCart}
              disabled={saving || addingToCart}
              className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {addingToCart
                ? "Addingâ€¦"
                : savedDesignId
                  ? "Add to Cart"
                  : "Save & Add to Cart"}
            </button>
          </div>

          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <button
              onClick={handleSaveDesign}
              disabled={saving || addingToCart}
              className="rounded-full border border-sky-600 bg-sky-600 px-4 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : isEditMode ? "Update Design" : "Save Design"}
            </button>

            <button
              onClick={handleSaveAndAddToCart}
              disabled={saving || addingToCart}
              className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {addingToCart
                ? "Adding…"
                : savedDesignId
                  ? "Add to Cart"
                  : "Save & Add to Cart"}
            </button>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-2 py-2 backdrop-blur sm:hidden">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(TABS.VIEWS)}
              className={`flex h-11 items-center justify-center rounded-[16px] border text-sm font-semibold transition ${
                activeTab === TABS.VIEWS
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Views
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(TABS.DESIGNS)}
              className={`rounded-[16px] px-4 py-2 text-[12px] font-semibold transition ${
                activeTab === TABS.DESIGNS
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Designs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(TABS.DESIGN_LIBRARY)}
              className={`rounded-[16px] px-4 py-2 text-[12px] font-semibold transition ${
                activeTab === TABS.DESIGN_LIBRARY
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Library
            </button>
          </div>

          <div className={`grid gap-2 ${canAddSavedDesignToCart ? "grid-cols-3" : "grid-cols-2"}`}>
            <button
              type="button"
              onClick={() => setShowMobilePriceDetails((value) => !value)}
              className={`rounded-[16px] border px-3 py-2 text-left transition ${
                showMobilePriceDetails
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Price</div>
              <div className="mt-0.5 text-sm font-bold">₹{price.toFixed(2)}</div>
            </button>
            <button
              type="button"
              onClick={handleSaveDesign}
              disabled={saving || addingToCart}
              className="rounded-[16px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEditMode ? "Update Design" : "Save Design"}
            </button>
            {canAddSavedDesignToCart && (
              <button
                type="button"
                onClick={handleSaveAndAddToCart}
                disabled={saving || addingToCart}
                className="rounded-[16px] bg-sky-600 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {addingToCart ? "Adding..." : "Add to Cart"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-2 pb-2 pt-2 sm:gap-6 sm:overflow-visible sm:px-6 sm:pb-6 sm:pt-3">
        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)] lg:items-start lg:gap-6 lg:overflow-visible">
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
                  {calculatingPrice ? "Refreshing..." : "Refresh price"}
                </button>
              </div>
            </div>
          </div>
          {/* Left sidebar - Controls */}
          <aside className="order-2 flex h-[min(24vh,220px)] w-full flex-col gap-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] min-h-0 sm:h-auto sm:rounded-2xl sm:p-4 sm:shadow-sm lg:order-1 lg:w-auto lg:gap-6">
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
              onClick={() => setActiveTab(TABS.PRODUCT_COLORS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.PRODUCT_COLORS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Product Colors
            </button>
            <button
              onClick={() => setActiveTab(TABS.DESIGNS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGNS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Designs
            </button>
            <button
              onClick={() => setActiveTab(TABS.TEXT)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.TEXT ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Text
            </button>
            <button
              onClick={() => setActiveTab(TABS.VIEWS)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${activeTab === TABS.VIEWS ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Views
            </button>
            <button
              onClick={() => setActiveTab(TABS.DESIGN_LIBRARY)}
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
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-medium">Current Color</label>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded border border-slate-300" style={{ backgroundColor: productColor }} />
                      <input type="color" className="h-10 w-full cursor-pointer" value={productColor} onChange={(e) => handleColorChange(e.target.value)} />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
                      <span>{productColorName}</span>
                      <span className="font-mono text-[10px] text-slate-400">{productColor?.toUpperCase()}</span>
                    </p>
                  </div>

                 
                  {/* ✅ Size Selection */}
                  <div className="mt-5">
                    <h3 className="mb-2 font-semibold text-sm">Size</h3>

                    {availableSizes.length > 0 ? (
                      <>
                        <label className="mb-2 block text-xs font-medium">Select Size</label>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {availableSizes.map((size) => {
                            const isActive = selectedSize === size;
                            const sizePrice = getSizeBasePrice(product, size);

                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSelectedSize(size)}
                                className={`rounded border px-2 py-2 text-xs font-semibold transition ${
                                  isActive
                                    ? "border-sky-500 bg-sky-50 text-sky-700"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <div>{size}</div>
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

                  {/* Quick Select */}
                  <div className="mb-2">
                    <label className="mb-2 block text-xs font-medium">Quick Select</label>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                      {COLOR_OPTIONS.map((option) => {
                        const currentColorKey = productColor?.toLowerCase() || "";
                        const isActive = option.value.toLowerCase() === currentColorKey;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`h-8 w-8 rounded-full border-2 ${isActive ? "border-sky-500" : "border-slate-300"}`}
                            style={{ backgroundColor: option.value }}
                            onClick={() => handleColorChange(option.value, option.label)}
                          />
                        );
                      })}
                    </div>
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
                          <button type="button" onClick={handleRemoveBackground} disabled={bgRemovalLoading} className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${bgRemovalLoading ? "border-slate-300 text-slate-400" : "border-sky-500 text-sky-700 hover:bg-sky-50"}`}>
                            {bgRemovalLoading ? "Removing…" : "Remove BG"}
                          </button>
                          <button type="button" onClick={clearActiveDesign} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            Clear
                          </button>
                        </div>

                        {availableZonesForView.length > 0 && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Move To Zone
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Current: {ZONE_LABELS[activeDesignZone] || activeDesignZone}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {availableZonesForView.map((zoneKey) => {
                                const isCurrentZone = activeDesignZone === zoneKey;
                                return (
                                  <button
                                    key={zoneKey}
                                    type="button"
                                    onClick={() => moveActiveDesignToZone(zoneKey)}
                                    disabled={isCurrentZone}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                      isCurrentZone
                                        ? "cursor-default bg-sky-100 text-sky-700"
                                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
                          <p>• Remove BG supports only {SUPPORTED_DESIGN_FORMATS_LABEL}</p>
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
                        onClick={() => setIsLibraryModalOpen(true)}
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

        {isLibraryModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 p-3 sm:p-6">
            <div className="flex h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Design Library</h3>
                  <p className="mt-1 text-xs text-slate-500">Browse folders, upload a design, or pick one from the library.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLibraryModalOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-700">Upload a design</label>
                    <input
                      type="file"
                      accept={SUPPORTED_DESIGN_ACCEPT}
                      multiple
                      onChange={handleDesignUpload}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <p className="mt-2 text-[11px] text-slate-500">Uploaded files go straight into your editable design layers.</p>
                    <p className="mt-1 text-[11px] text-slate-500">Supported formats: {SUPPORTED_DESIGN_FORMATS_LABEL}.</p>
                    </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-medium text-slate-700">Folders</label>
                    <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1 lg:max-h-[420px]">
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
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {images.map((image) => (
                          <button
                            key={image.filename}
                            type="button"
                            onClick={() => handleSelectFromLibrary(image)}
                            className="group text-left"
                          >
                            <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img
                                src={`${IMAGE_URL}/outputs/adminuploadeddesigns/${currentFolder}/${image.filename}`}
                                alt={image.filename}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                            <div className="mt-2 truncate text-[11px] text-slate-600">{image.filename}</div>
                          </button>
                        ))}
                      </div>
                    ) : currentFolder ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-slate-700">No designs in this folder</p>
                          <p className="mt-1 text-xs text-slate-500">Upload a design above or choose another folder.</p>
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
        <main className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden sm:overflow-auto lg:order-2">
          <div className="flex-1 min-h-0 p-0">
            <div className="mx-auto flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:rounded-[28px]">
              <div className="hidden border-b border-slate-200 bg-white px-3 py-3 sm:block sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-800 sm:text-base">
                      {product?.name || "Custom Product"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {productColorName} • {customizableViews.find((v) => v.code === viewCode)?.label || "Front view"} • Size {selectedSize}
                    </p>
                  </div>
                  {customizableViews.length > 0 && (
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
                  )}
                </div>
              </div>
              <div className="mx-auto flex min-h-0 flex-1 w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,116,214,0.05),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-1 sm:max-w-6xl sm:p-5 lg:p-6">
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
                    designLayers={designLayers}
                    setDesignLayers={handleSetDesignLayers}
                    activeDesignId={activeDesignId}
                    setActiveDesignId={handleSetActiveDesignId}
                    bgRemovalLoading={bgRemovalLoading}
                    onDesignRenderWidthChange={setDesignRenderWidth}
                    isAdmin={isAdmin}
                    selectedView={viewCode}
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
              
              <button onClick={() => calculatePrice()} disabled={calculatingPrice} className="text-xs text-green-600 hover:text-green-800">
                {calculatingPrice ? "Calculating..." : "↻"}
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
              
              {/* Minimum Charges */}
              {priceBreakdown.minimumCharges > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-amber-700">Minimum Charges</span>
                    <span className="text-sm font-semibold text-amber-700">+₹{priceBreakdown.minimumCharges.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-amber-600">
                    Applied to designs/text smaller than {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"
                  </div>
                </div>
              )}
              
              {/* Additional Area */}
              {priceBreakdown.additionalArea > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-green-700">Additional Area</span>
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
              <p>• Base includes {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}" design area</p>
              <p>• Minimum charge: ₹{MINIMUM_DESIGN_CHARGE} (≤{FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}")</p>
              <p>• Additional: ₹{PRICE_PER_SQ_INCH} per sq.inch beyond {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"</p>
              <p>• Display: 72 DPI (screen preview)</p>
              <p>• Print: 300 DPI (production)</p>
            </div>
          </div>
        </aside>
      </div>
      </div>

      <nav className="grid shrink-0 grid-cols-5 gap-1 border-t border-slate-900/90 bg-slate-950 px-2 py-2 shadow-[0_-14px_30px_rgba(15,23,42,0.28)] sm:hidden">
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
