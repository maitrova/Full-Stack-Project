// src/pages/DesignerPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProductBySlug } from "../redux/slices/productsSlice.js";
import RecolorEditor from "./RecolorEditor.jsx";
import {selectCurrentToken} from "../redux/slices/Userslice.js"

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

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
const SLEEVE_PRICE = 30;
const MINIMUM_DESIGN_CHARGE = 30;
const DISPLAY_DPI = 72;
const PRINT_DPI = 300;

// Tab options
const TABS = {
  PRODUCT_COLORS: 'productColors',
  DESIGNS: 'designs',
  TEXT: 'text',
  VIEWS: 'views'
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

const createDesignLayer = (id, imageUrl, file, width, height) => {
  const displayWidthInches = width / DISPLAY_DPI;
  const displayHeightInches = height / DISPLAY_DPI;
  const displayAreaInches = displayWidthInches * displayHeightInches;
  
  const printWidthInches = width / PRINT_DPI;
  const printHeightInches = height / PRINT_DPI;
  const printAreaInches = printWidthInches * printHeightInches;
  
  const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
  const additionalPrintArea = Math.max(0, printAreaInches - fixedArea);
  
  let layerPrice = 0;
  const scaledPrintArea = printAreaInches * 0.35 * 0.35;
  const scaledFixedArea = fixedArea * 0.35 * 0.35;
  
  if (scaledPrintArea <= scaledFixedArea) {
    layerPrice = MINIMUM_DESIGN_CHARGE;
  } else {
    layerPrice = additionalPrintArea * PRICE_PER_SQ_INCH * 0.35 * 0.35;
    if (layerPrice < MINIMUM_DESIGN_CHARGE) {
      layerPrice = MINIMUM_DESIGN_CHARGE;
    }
  }
  
  return {
    id,
    imageUrl,
    file,
    hasBgRemoved: false,
    x: 0.5,
    y: 0.5,
    scale: 0.35,
    rotation: 0,
    originalWidthPx: width,
    originalHeightPx: height,
    renderedWidthPx: width * 0.35,
    renderedHeightPx: height * 0.35,
    originalFile: file,
    displayWidthInches,
    displayHeightInches,
    displayAreaInches,
    currentDisplayWidthInches: displayWidthInches * 0.35,
    currentDisplayHeightInches: displayHeightInches * 0.35,
    printWidthInches,
    printHeightInches,
    printAreaInches,
    currentPrintWidthInches: printWidthInches * 0.35,
    currentPrintHeightInches: printHeightInches * 0.35,
    currentPrintAreaInches: printAreaInches * 0.35 * 0.35,
    currentAdditionalArea: Math.max(0, (printAreaInches * 0.35 * 0.35) - (fixedArea * 0.35 * 0.35)),
    layerPrice,
    minimumChargeApplied: scaledPrintArea <= scaledFixedArea
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

  const BASE_PRICE = product?.basePrice || 600;
  
  const [productColor, setProductColor] = useState("#FFFFFF");
  const [viewStates, setViewStates] = useState({});
  const [viewCode, setViewCode] = useState("front");
  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);
  const [error, setError] = useState("");
  const [designRenderWidth, setDesignRenderWidth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  
  const [price, setPrice] = useState(BASE_PRICE);
  const [priceBreakdown, setPriceBreakdown] = useState({
    basePrice: BASE_PRICE,
    images: { count: 0, total: 0, items: [] },
    text: { count: 0, total: 0, items: [] },
    sleeves: { count: 0, total: 0 },
    additionalArea: 0,
    minimumCharges: 0,
    totalPrice: BASE_PRICE
  });

  // Edit mode state
  const editDesignId = searchParams.get("edit");
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [originalDesign, setOriginalDesign] = useState(null);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState(TABS.PRODUCT_COLORS);

  const editorRef = useRef(null);

  const colorOptions = [
    "#FFFFFF", "#000000", "#FF6B6B", "#4ECDC4", "#45B7D1",
    "#96CEB4", "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD",
    "#00D2D3", "#FF9F43",
  ];

  const handleColorChange = (color) => setProductColor(color);
  
  const getImageNaturalSize = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });

  const updateDesignLayerDimensions = (layer, scale = null) => {
    const currentScale = scale !== null ? scale : layer.scale;
    
    const currentDisplayWidthInches = layer.displayWidthInches * currentScale;
    const currentDisplayHeightInches = layer.displayHeightInches * currentScale;
    
    const currentPrintWidthInches = layer.printWidthInches * currentScale;
    const currentPrintHeightInches = layer.printHeightInches * currentScale;
    const currentPrintAreaInches = layer.printAreaInches * currentScale * currentScale;
    
    const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
    const additionalArea = Math.max(0, currentPrintAreaInches - fixedArea);
    
    let layerPrice = 0;
    if (currentPrintAreaInches <= fixedArea) {
      layerPrice = MINIMUM_DESIGN_CHARGE;
    } else {
      layerPrice = additionalArea * PRICE_PER_SQ_INCH;
      if (layerPrice < MINIMUM_DESIGN_CHARGE) {
        layerPrice = MINIMUM_DESIGN_CHARGE;
      }
    }
    
    return {
      ...layer,
      scale: currentScale,
      currentDisplayWidthInches,
      currentDisplayHeightInches,
      currentPrintWidthInches,
      currentPrintHeightInches,
      currentPrintAreaInches,
      currentAdditionalArea: additionalArea,
      layerPrice,
      renderedWidthPx: layer.originalWidthPx * currentScale,
      renderedHeightPx: layer.originalHeightPx * currentScale,
      minimumChargeApplied: currentPrintAreaInches <= fixedArea
    };
  };

  // -------- PRICE CALCULATION --------
  const calculatePrice = async (updateUI = true) => {
    try {
      if (updateUI) setCalculatingPrice(true);
      
      const currentBasePrice = product?.basePrice || BASE_PRICE;
      
      const allDesignLayers = [];
      const allTextLayers = [];
      const allZones = [];

      Object.entries(viewStates).forEach(([viewCode, viewState]) => {
        if (viewState.designLayers) {
          viewState.designLayers.forEach(layer => {
            let zone = layer.zone;
            if (!zone) {
              if (viewCode === 'left') zone = 'sleeve-left';
              else if (viewCode === 'right') zone = 'sleeve-right';
              else if (viewCode === 'back') zone = 'back-full';
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
      sleeves: { count: 0, total: 0 },
      additionalArea: 0,
      minimumCharges: 0,
      totalPrice: basePrice
    };

    designLayers.forEach((layer, index) => {
      const zone = layer.zone || zones[index] || 'front-full';
      
      if (zone === "sleeve-left" || zone === "sleeve-right") {
        breakdown.sleeves.count += 1;
        breakdown.sleeves.total += SLEEVE_PRICE;
        totalPrice += SLEEVE_PRICE;
        
        breakdown.images.items.push({
          id: layer.id,
          type: 'sleeve',
          price: SLEEVE_PRICE,
          zone: zone,
          viewCode: layer.viewCode,
          displaySize: `${layer.currentDisplayWidthInches?.toFixed(2)}" × ${layer.currentDisplayHeightInches?.toFixed(2)}"`,
          note: 'Sleeve - fixed price'
        });
      } else {
        const printAreaInches = layer.currentPrintAreaInches || 0;
        const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
        const additionalArea = layer.currentAdditionalArea || Math.max(0, printAreaInches - fixedArea);
        const perSqInchPrice = additionalArea * PRICE_PER_SQ_INCH;
        
        let layerPrice = 0;
        
        if (printAreaInches > 0) {
          if (printAreaInches <= fixedArea) {
            layerPrice = MINIMUM_DESIGN_CHARGE;
            breakdown.minimumCharges += MINIMUM_DESIGN_CHARGE;
          } else {
            layerPrice = perSqInchPrice;
            if (perSqInchPrice < MINIMUM_DESIGN_CHARGE) {
              layerPrice = MINIMUM_DESIGN_CHARGE;
              breakdown.minimumCharges += MINIMUM_DESIGN_CHARGE;
            }
          }
          
          if (additionalArea > 0) {
            breakdown.additionalArea += additionalArea;
          }
        }
        
        totalPrice += layerPrice;
        breakdown.images.count += 1;
        breakdown.images.total += layerPrice;
        
        breakdown.images.items.push({
          id: layer.id,
          type: 'image',
          displaySize: `${layer.currentDisplayWidthInches?.toFixed(2)}" × ${layer.currentDisplayHeightInches?.toFixed(2)}"`,
          printSize: `${layer.currentPrintWidthInches?.toFixed(2)}" × ${layer.currentPrintHeightInches?.toFixed(2)}"`,
          printAreaInches: printAreaInches.toFixed(2),
          additionalArea: additionalArea.toFixed(2),
          price: layerPrice,
          zone: zone,
          viewCode: layer.viewCode,
          scale: layer.scale,
          note: printAreaInches <= fixedArea ? 
                `Minimum charge (${printAreaInches.toFixed(1)} sq.in ≤ ${fixedArea} sq.in)` : 
                `Area-based pricing`
        });
      }
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
        breakdown.minimumCharges += MINIMUM_DESIGN_CHARGE;
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
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [viewStates]);

  useEffect(() => {
    if (product?.basePrice) {
      setPrice(product.basePrice);
      setPriceBreakdown(prev => ({
        ...prev,
        basePrice: product.basePrice,
        totalPrice: product.basePrice + (prev.totalPrice - prev.basePrice)
      }));
    }
  }, [product?.basePrice]);

  const uploadDesignImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append("designImage", file);

      const res = await fetch(`${API_URL}/api/upload-design`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      return `${API_URL}${data.imageUrl}`;
    } catch (err) {
      console.error("Upload design image error:", err);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
  };

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
        setProductColor(design.productColor || "#FFFFFF");

        const loadedViewStates = {};
        design.views?.forEach((view) => {
          loadedViewStates[view.code] = {
            textLayers: view.textLayers?.map(t => ({
              ...t,
              id: t.id || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`
            })) || [],
            activeTextId: view.textLayers?.[0]?.id || null,
            designLayers: view.designLayers?.map(d => {
              const widthPx = d.originalWidthPx || d.renderedWidthPx / (d.scale || 0.35);
              const heightPx = d.originalHeightPx || d.renderedHeightPx / (d.scale || 0.35);
              
              const displayWidthInches = widthPx / DISPLAY_DPI;
              const displayHeightInches = heightPx / DISPLAY_DPI;
              const displayAreaInches = displayWidthInches * displayHeightInches;
              
              const printWidthInches = widthPx / PRINT_DPI;
              const printHeightInches = heightPx / PRINT_DPI;
              const printAreaInches = printWidthInches * printHeightInches;
              
              const scale = d.scale || 0.35;
              
              return {
                ...d,
                id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                imageUrl: d.imageUrl?.startsWith('http') || d.imageUrl?.startsWith('blob:') || d.imageUrl?.startsWith('data:')
                  ? d.imageUrl 
                  : d.imageUrl?.startsWith('/') 
                    ? `${API_URL}${d.imageUrl}`
                    : d.imageUrl,
                file: null,
                originalFile: null,
                originalWidthPx: widthPx,
                originalHeightPx: heightPx,
                displayWidthInches: displayWidthInches,
                displayHeightInches: displayHeightInches,
                displayAreaInches: displayAreaInches,
                printWidthInches: printWidthInches,
                printHeightInches: printHeightInches,
                printAreaInches: printAreaInches,
                scale: scale,
                currentDisplayWidthInches: displayWidthInches * scale,
                currentDisplayHeightInches: displayHeightInches * scale,
                currentPrintWidthInches: printWidthInches * scale,
                currentPrintHeightInches: printHeightInches * scale,
                currentPrintAreaInches: printAreaInches * scale * scale,
                renderedWidthPx: widthPx * scale,
                renderedHeightPx: heightPx * scale
              };
            }) || [],
            activeDesignId: view.designLayers?.[0]?.id || null,
          };
        });

        setViewStates(loadedViewStates);
        setIsEditMode(true);
        setEditModeInitialized(true);
        
        if (design.views?.[0]?.code) {
          setViewCode(design.views[0].code);
        }
        
        setTimeout(() => calculatePrice(), 500);
        
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
    
    const initial = {};
    product.views.forEach((v, index) => {
      initial[v.code] = {
        textLayers: index === 0 ? [createDefaultTextLayer()] : [],
        activeTextId: index === 0 ? initial[v.code]?.textLayers?.[0]?.id || null : null,
        designLayers: [],
        activeDesignId: null,
      };
    });

    setViewStates(initial);
    setViewCode(product.views[0].code);
    setIsEditMode(false);
    setEditModeInitialized(false);
    
  }, [product, isEditMode, editModeInitialized]);

  useEffect(() => {
    return () => {
      Object.values(viewStates).forEach(viewState => {
        if (viewState.designLayers) {
          viewState.designLayers.forEach(layer => {
            if (layer.imageUrl && layer.imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(layer.imageUrl);
            }
          });
        }
      });
    };
  }, [viewStates]);

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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError("");

    try {
      const newLayers = [];
      
      for (const file of files) {
        const serverUrl = await uploadDesignImage(file);
        const id = `design-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { width, height } = await getImageNaturalSize(serverUrl);
        
        newLayers.push(createDesignLayer(id, serverUrl, file, width, height, BASE_PRICE));
      }

      const all = [...designLayers, ...newLayers];
      const lastId = newLayers[newLayers.length - 1].id;

      updateCurrentViewState({
        designLayers: all,
        activeDesignId: lastId,
      });

    } catch (err) {
      console.error("Error uploading design images:", err);
      setError("Failed to upload images: " + err.message);
    }
  };

 const handleRemoveBackground = async () => {
  if (!activeDesign) {
    setError("Select a design first");
    console.log("No design selected");
    return;
  }
  
  const fileToUse = activeDesign.originalFile || activeDesign.file;
  if (!fileToUse) {
    setError("No original file available for background removal");
    console.log("No file available for background removal");
    return;
  }

  try {
    setBgRemovalLoading(true);
    setError("");
    console.log("Starting background removal");

    const formData = new FormData();
    formData.append("image", fileToUse);
    console.log("FormData prepared with image");

    const res = await fetch(`${API_URL}/api/remove-bg`, {
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

    const updatedLayers = designLayers.map((d) =>
      d.id === activeDesign.id
        ? {
            ...d,
            imageUrl: `${API_URL}${data.outputUrl}?t=${Date.now()}`,
            hasBgRemoved: true,
            originalFile: fileToUse,
          }
        : d
    );

    console.log("Updated layers with background removed:", updatedLayers);

    updateCurrentViewState({ designLayers: updatedLayers });
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
  };

  const handleDesignScaleChange = (value) => {
    if (!activeDesign) return;
    const v = parseFloat(value);
    
    const updated = designLayers.map((d) => {
      if (d.id === activeDesign.id) {
        return updateDesignLayerDimensions(d, v);
      }
      return d;
    });
    
    updateCurrentViewState({ designLayers: updated });
    calculatePrice();
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
    if (!product?.views || product.views.length === 0 || !editorRef.current) {
      return {};
    }

    const previewsByCode = {};
    const originalViewCode = viewCode;

    for (const v of product.views) {
      setViewCode(v.code);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const img = editorRef.current?.capturePreview?.() || null;
      if (img) {
        previewsByCode[v.code] = img;
      }
    }

    setViewCode(originalViewCode);
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
      const { totalPrice } = await calculatePrice(false);
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

      const viewsPayload = product.views?.map((v) => {
        const vs = processedViewStates[v.code] ? { ...baseViewState, ...processedViewStates[v.code] } : baseViewState;

        const textLayersPayload = (vs.textLayers || []).map(
          ({ id, text, x, y, fontSize, color, fontFamily, rotation }) => ({
            id, text, x, y, fontSize, color, fontFamily, rotation,
          })
        );

        const designLayersPayload = (vs.designLayers || []).map(
          ({ id, imageUrl, hasBgRemoved, x, y, scale, rotation, zone, insideSafeArea, 
             originalWidthPx, originalHeightPx, renderedWidthPx, renderedHeightPx,
             displayWidthInches, displayHeightInches, displayAreaInches,
             printWidthInches, printHeightInches, printAreaInches,
             currentDisplayWidthInches, currentDisplayHeightInches,
             currentPrintWidthInches, currentPrintHeightInches, currentPrintAreaInches,
             currentAdditionalArea, layerPrice, minimumChargeApplied }) => ({
            id, imageUrl, hasBgRemoved: !!hasBgRemoved, x, y, scale, rotation,
            zone: zone || null, insideSafeArea: typeof insideSafeArea === "boolean" ? insideSafeArea : true,
            originalWidthPx, originalHeightPx, 
            renderedWidthPx, renderedHeightPx,
            displayWidthInches, displayHeightInches, displayAreaInches,
            printWidthInches, printHeightInches, printAreaInches,
            currentDisplayWidthInches, currentDisplayHeightInches,
            currentPrintWidthInches, currentPrintHeightInches, currentPrintAreaInches,
            currentAdditionalArea, layerPrice, minimumChargeApplied
          })
        );

        return {
          code: v.code,
          textLayers: textLayersPayload,
          designLayers: designLayersPayload,
          previewImage: previewsByCode[v.code] || null,
        };
      }) || [];

      const mainPreview = previewsByCode["front"] || (product.views?.[0] && previewsByCode[product.views[0].code]) || null;

      const body = {
        productId: product._id || product.id,
        productSlug: product.slug || slug,
        productColor,
        previewImage: mainPreview,
        views: viewsPayload,
        basePrice: BASE_PRICE,
        calculatedPrice: totalPrice,
        priceBreakdown: priceBreakdown,
      };

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

      setSaveSuccess(true);
      alert(isEditMode ? "Design updated successfully!" : "Design saved successfully!");
      
    } catch (err) {
      console.error("Save design error:", err);
      setSaveError(err.message || "Failed to save design");
    } finally {
      setSaving(false);
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
        designLayers: view.designLayers?.map(d => {
          const widthPx = d.originalWidthPx || d.renderedWidthPx / (d.scale || 0.35);
          const heightPx = d.originalHeightPx || d.renderedHeightPx / (d.scale || 0.35);
          
          const displayWidthInches = widthPx / DISPLAY_DPI;
          const displayHeightInches = heightPx / DISPLAY_DPI;
          const displayAreaInches = displayWidthInches * displayHeightInches;
          
          const printWidthInches = widthPx / PRINT_DPI;
          const printHeightInches = heightPx / PRINT_DPI;
          const printAreaInches = printWidthInches * printHeightInches;
          
          const scale = d.scale || 0.35;
          
          return {
            ...d,
            id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            imageUrl: d.imageUrl?.startsWith('http') || d.imageUrl?.startsWith('blob:') || d.imageUrl?.startsWith('data:')
              ? d.imageUrl 
              : d.imageUrl?.startsWith('/') 
                ? `${API_URL}${d.imageUrl}`
                : d.imageUrl,
            file: null,
            originalFile: null,
            originalWidthPx: widthPx,
            originalHeightPx: heightPx,
            displayWidthInches: displayWidthInches,
            displayHeightInches: displayHeightInches,
            displayAreaInches: displayAreaInches,
            printWidthInches: printWidthInches,
            printHeightInches: printHeightInches,
            printAreaInches: printAreaInches,
            scale: scale,
            currentDisplayWidthInches: displayWidthInches * scale,
            currentDisplayHeightInches: displayHeightInches * scale,
            currentPrintWidthInches: printWidthInches * scale,
            currentPrintHeightInches: printHeightInches * scale,
            currentPrintAreaInches: printAreaInches * scale * scale,
            renderedWidthPx: widthPx * scale,
            renderedHeightPx: heightPx * scale
          };
        }) || [],
        activeDesignId: view.designLayers?.[0]?.id || null,
      };
    });

    setViewStates(restoredViewStates);
    setProductColor(originalDesign.productColor || "#FFFFFF");
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

  const currentView = product.views.find((v) => v.code === viewCode) || product.views[0];
  const mockupUrl = currentView?.mockupUrl;
  const maskUrl = currentView?.maskUrl;

  return (
    <div className="flex h-screen flex-col bg-neutral-100 text-slate-900">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-4">
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

        <div className="flex items-center gap-4 text-xs">
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

          <div className="flex items-center gap-3">
            <div className="price-display text-right">
              <div className="text-xs text-slate-500">Total Price</div>
              <div className="text-xl font-bold text-green-600">
                ₹{price.toFixed(2)}
              </div>
            </div>

            <button onClick={handleSaveDesign} disabled={saving} className="rounded-full border border-sky-600 bg-sky-600 px-4 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
              {saving ? "Saving…" : isEditMode ? "Update Design" : "Save Design"}
            </button>
          </div>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 p-6 gap-6">
        {/* Left sidebar - Controls */}
        <aside className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-6">
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

          {/* Tab navigation */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab(TABS.PRODUCT_COLORS)}
              className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.PRODUCT_COLORS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Product Colors
            </button>
            <button
              onClick={() => setActiveTab(TABS.DESIGNS)}
              className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGNS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Designs
            </button>
            <button
              onClick={() => setActiveTab(TABS.TEXT)}
              className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.TEXT ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Text
            </button>
            <button
              onClick={() => setActiveTab(TABS.VIEWS)}
              className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.VIEWS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Views
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {/* Product Colors Tab */}
            {activeTab === TABS.PRODUCT_COLORS && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Product Colors</h3>
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-medium">Current Color</label>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded border border-slate-300" style={{ backgroundColor: productColor }} />
                      <input type="color" className="h-10 w-full cursor-pointer" value={productColor} onChange={(e) => handleColorChange(e.target.value)} />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="mb-2 block text-xs font-medium">Quick Select</label>
                    <div className="grid grid-cols-6 gap-2">
                      {colorOptions.map((color) => (
                        <button key={color} className={`h-8 w-8 rounded-full border-2 ${color === productColor ? "border-sky-500" : "border-slate-300"}`} style={{ backgroundColor: color }} onClick={() => handleColorChange(color)} type="button" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-2">
                  <p className="font-medium">How to use:</p>
                  <p>• Select a color to change the product color</p>
                  <p>• Use the color picker for custom colors</p>
                  <p>• Quick select colors are commonly used options</p>
                </div>
              </div>
            )}

            {/* Designs Tab */}
            {activeTab === TABS.DESIGNS && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Upload Designs</h3>
                  <p className="mb-2 text-xs text-slate-600">Upload one or more images. They will be saved to the server automatically.</p>

                  <div className="mb-3 text-xs">
                    <input type="file" accept="image/*" multiple onChange={handleDesignUpload} className="w-full text-xs border border-slate-300 rounded px-3 py-2" />
                  </div>

                  {activeDesign && (
                    <>
                      <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-slate-700 text-xs">Selected Design</span>
                          <span className="text-[10px] text-slate-500">ID: {activeDesign.id.slice(0, 6)}…</span>
                        </div>
                        
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

                      <div className="text-xs text-slate-600 space-y-1">
                        <p>• Click on a design in the editor to select it</p>
                        <p>• Drag to reposition, or use the resize handle</p>
                        <p>• Click "Remove BG" for transparent background</p>
                        <p>• Sleeves have fixed pricing of ₹{SLEEVE_PRICE} each</p>
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
              </div>
            )}

            {/* Text Tab */}
            {activeTab === TABS.TEXT && (
              <div className="space-y-6">
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

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Font Size</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={14} max={120} value={activeTextLayer.fontSize} onChange={(e) => updateActiveTextLayer({ fontSize: parseInt(e.target.value, 10) })} className="flex-1" />
                        <span className="w-10 text-right text-xs text-slate-600">{activeTextLayer.fontSize}px</span>
                      </div>
                    </div>

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
              </div>
            )}

            {/* Views Tab */}
            {activeTab === TABS.VIEWS && product.views && product.views.length > 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Product Views</h3>
                  <p className="mb-3 text-xs text-slate-600">Switch between different views of the product to add designs/text on different areas.</p>

                  <div className="space-y-2">
                    {product.views.map((v) => {
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

                <div className="text-xs text-slate-600 space-y-2">
                  <p className="font-medium">Current View: {product.views.find(v => v.code === viewCode)?.label}</p>
                  <p>• Front: Main design area</p>
                  <p>• Back: Back of the product</p>
                  <p>• Left/Right Sleeves: Sleeve designs</p>
                  <p>• Each view has separate text and design layers</p>
                </div>
              </div>
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

        {/* Center workspace */}
        <main className="flex flex-1 flex-col overflow-auto">
          <div className="flex-1 p-0">
            <div className="mx-auto flex max-w-4xl items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="w-full max-w-[650px]">
                {mockupUrl && maskUrl ? (
                  <RecolorEditor
                    ref={editorRef}
                    mockupUrl={mockupUrl}
                    maskUrl={maskUrl}
                    previewWidth={650}
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
                  />
                ) : (
                  <div className="text-sm text-slate-500 text-center">{product?.name ? `No view configuration found for ${product.name}` : "Product not loaded"}</div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar - Price Breakdown */}
        <aside className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-800">Price Breakdown</h3>
              <button onClick={() => calculatePrice()} disabled={calculatingPrice} className="text-xs text-green-600 hover:text-green-800">
                {calculatingPrice ? "Calculating..." : "↻"}
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">Real-time price calculation</div>
          </div>
          
          <div className="flex-1 overflow-auto">
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
              
              {/* Sleeves */}
              {priceBreakdown.sleeves.total > 0 && (
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-slate-700">Sleeves</span>
                    <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.sleeves.total.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {priceBreakdown.sleeves.count} sleeve{priceBreakdown.sleeves.count !== 1 ? 's' : ''} × ₹{SLEEVE_PRICE} each
                  </div>
                </div>
              )}
              
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
                        {item.type === 'sleeve' ? (
                          <div className="text-slate-500 mt-1">Sleeve ({item.zone}) - Fixed price</div>
                        ) : (
                          <>
                            <div className="text-slate-500 mt-1">Size: {item.displaySize}</div>
                            <div className="text-slate-500">Print: {item.printSize}</div>
                            <div className="text-amber-600 text-[9px] mt-1">{item.note}</div>
                          </>
                        )}
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
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-medium mb-1">Pricing Information:</p>
              <p>• Base includes {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}" design area</p>
              <p>• Minimum charge: ₹{MINIMUM_DESIGN_CHARGE} (≤{FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}")</p>
              <p>• Additional: ₹{PRICE_PER_SQ_INCH} per sq.inch beyond {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"</p>
              <p>• Sleeves: Fixed ₹{SLEEVE_PRICE} each</p>
              <p>• Display: 72 DPI (screen preview)</p>
              <p>• Print: 300 DPI (production)</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <footer className="flex h-16 items-center justify-between border-t border-slate-200 bg-white px-6 text-xs">
        <div className="flex flex-col">
          <span className="font-semibold">{product?.name || "Custom Product"}</span>
          <span className="text-slate-500">
            Color: <span className="font-medium">{productColor}</span>
            {isEditMode && <span className="ml-3 text-amber-600">• Editing mode •</span>}
          </span>
        </div>
        <span className="text-slate-400">
          {isEditMode ? "Editing existing design. Changes will update the original when you click 'Update Design'." : "Drag, resize, and customize elements. Click tabs on the left to switch between tools."}
        </span>
      </footer>
    </div>
  );
}

