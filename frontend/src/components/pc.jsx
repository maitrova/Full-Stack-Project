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
import { selectCurrentToken } from "../redux/slices/Userslice.js";

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
  VIEWS: 'views',
  DESIGN_LIBRARY: 'designLibrary' // New tab
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
    isFromLibrary, // Flag to identify library images
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

  // Design uploads state
  const { 
    folders, 
    images, 
    currentFolder, 
    loading: libraryLoading 
  } = useSelector((state) => state.designUploads);

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
  const [selectedLibraryImage, setSelectedLibraryImage] = useState(null);
  
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
                isFromLibrary: false,
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
        
        newLayers.push(createDesignLayer(id, serverUrl, file, width, height, false));
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

  // NEW: Handle selecting design from library
  const handleSelectFromLibrary = async (image) => {
    try {
      setError("");
      
      // Construct full URL for the image from design library
      const imageUrl = `http://localhost:5000/outputs/adminuploadeddesigns/${currentFolder}/${image.filename}`;
      
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
      
      const newLayer = createDesignLayer(id, imageUrl, file, width, height, true);
      
      const all = [...designLayers, newLayer];
      updateCurrentViewState({
        designLayers: all,
        activeDesignId: id,
      });

      // Switch to designs tab to show the controls
      setActiveTab(TABS.DESIGNS);
      setSelectedLibraryImage(image.filename);
      
    } catch (err) {
      console.error("Error loading design from library:", err);
      setError("Failed to load design from library: " + err.message);
    }
  };

  const handleRemoveBackground = async () => {
    if (!activeDesign) {
      setError("Select a design first");
      console.log("No design selected");
      return;
    }

    try {
      setBgRemovalLoading(true);
      setError("");
      console.log("Starting background removal for:", activeDesign.id);
      
      let fileToUse = activeDesign.originalFile || activeDesign.file;
      
      // If no file object exists (design came from library or was previously loaded without file), fetch it
      if (!fileToUse && activeDesign.imageUrl) {
        console.log("No file object found, fetching image from URL...");
        
        try {
          // Fetch the image from the URL
          const response = await fetch(activeDesign.imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          
          // Convert response to blob
          const blob = await response.blob();
          
          // Create a File object from the blob
          const filename = activeDesign.imageUrl.split('/').pop() || 'design.png';
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

      console.log("Preparing FormData with image");
      const formData = new FormData();
      formData.append("image", fileToUse);
      
      console.log("Sending to remove-bg API...");
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
              originalFile: fileToUse, // Store the file for future use
              isFromLibrary: false, // Once processed, it's no longer a library image
            }
          : d
      );

      console.log("Updated layers with background removed:", updatedLayers);

      updateCurrentViewState({ designLayers: updatedLayers });
      
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
             currentAdditionalArea, layerPrice, minimumChargeApplied, isFromLibrary }) => ({
            id, imageUrl, hasBgRemoved: !!hasBgRemoved, x, y, scale, rotation,
            zone: zone || null, insideSafeArea: typeof insideSafeArea === "boolean" ? insideSafeArea : true,
            originalWidthPx, originalHeightPx, 
            renderedWidthPx, renderedHeightPx,
            displayWidthInches, displayHeightInches, displayAreaInches,
            printWidthInches, printHeightInches, printAreaInches,
            currentDisplayWidthInches, currentDisplayHeightInches,
            currentPrintWidthInches, currentPrintHeightInches, currentPrintAreaInches,
            currentAdditionalArea, layerPrice, minimumChargeApplied,
            isFromLibrary: isFromLibrary || false
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
            isFromLibrary: d.isFromLibrary || false,
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
            <button
              onClick={() => setActiveTab(TABS.DESIGN_LIBRARY)}
              className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGN_LIBRARY ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Design Library
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

            {/* Design Library Tab - NEW */}
            {activeTab === TABS.DESIGN_LIBRARY && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-semibold text-sm">Design Library</h3>
                  <p className="mb-3 text-xs text-slate-600">Select designs from your library to use on your product.</p>

                  {/* Folder selection */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-medium">Select Folder</label>
                    <div className="flex flex-wrap gap-2">
                      {folders.map((folder) => (
                        <button
                          key={folder}
                          type="button"
                          onClick={() => dispatch(setCurrentFolder(folder))}
                          className={`px-3 py-1 rounded text-xs border ${currentFolder === folder ? 'bg-sky-100 border-sky-300 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                        >
                          {folder}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Images grid */}
                  {libraryLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="text-xs text-slate-500">Loading designs...</div>
                    </div>
                  ) : currentFolder && images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((image) => (
                        <div 
                          key={image.filename} 
                          className="relative group cursor-pointer"
                          onClick={() => handleSelectFromLibrary(image)}
                        >
                          <div className="aspect-square overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <img 
                              src={`http://localhost:5000/outputs/adminuploadeddesigns/${currentFolder}/${image.filename}`} 
                              alt={image.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600 truncate">
                            {image.filename}
                          </div>
                          <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/10 transition-colors rounded border-2 border-transparent group-hover:border-sky-400"></div>
                        </div>
                      ))}
                    </div>
                  ) : currentFolder ? (
                    <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center">
                      <p className="text-xs text-slate-600">No designs in this folder</p>
                      <p className="text-[10px] text-slate-500 mt-1">Upload designs to this folder in the admin panel</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center">
                      <p className="text-xs text-slate-600">Select a folder to view designs</p>
                      <p className="text-[10px] text-slate-500 mt-1">Designs are organized in folders for easy access</p>
                    </div>
                  )}

                  <div className="text-xs text-slate-600 space-y-2 mt-4">
                    <p className="font-medium">How to use:</p>
                    <p>• Select a folder to view available designs</p>
                    <p>• Click on any design to add it to your product</p>
                    <p>• Switch to "Designs" tab to edit the selected design</p>
                    <p>• Background removal works for both uploaded and library designs</p>
                  </div>
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


// src/RecolorEditor.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import CanvasRenderer from "./CanvasRenderer.jsx";

/* =========================
   Product Type Detection from URL
   ========================= */
function getProductTypeFromUrl() {
  const url = window.location.pathname;
  const match = url.match(/\/products\/([^\/]+)\/customize/);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }
  return "hoodie"; // default
}

/* =========================
   Zone Configurations by Product Type - EMPTY START
   ========================= */
const PRODUCT_ZONES = {
  hoodie: {
    views: ["front", "back"],
  },
  "t-shirt": {
    views: ["front", "back"],
  },
  "long-sleeve": {
    views: ["front", "back"],
  },
  sweater: {
    views: ["front", "back"],
  },
  default: {
    views: ["front", "back"],
  },
};

const TEXT_BOUNDARIES = { minX: 0.15, maxX: 0.85, minY: 0.15, maxY: 0.85 };

/* =========================
   Helpers
   ========================= */
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function rectToBoundary(rect) {
  const minX = clamp01(rect.x);
  const minY = clamp01(rect.y);
  const maxX = clamp01(rect.x + rect.w);
  const maxY = clamp01(rect.y + rect.h);
  return { minX, minY, maxX, maxY };
}

function boundaryToRect(boundary) {
  return {
    x: boundary.minX,
    y: boundary.minY,
    w: boundary.maxX - boundary.minX,
    h: boundary.maxY - boundary.minY,
  };
}

function snapToBoundaryCenter(x, y, boundary, halfW, halfH, threshold = 0.02) {
  const minCX = boundary.minX + halfW;
  const maxCX = boundary.maxX - halfW;
  const minCY = boundary.minY + halfH;
  const maxCY = boundary.maxY - halfH;

  let sx = x;
  let sy = y;

  if (Math.abs(x - minCX) < threshold) sx = minCX;
  if (Math.abs(x - maxCX) < threshold) sx = maxCX;
  if (Math.abs(y - minCY) < threshold) sy = minCY;
  if (Math.abs(y - maxCY) < threshold) sy = maxCY;

  return { x: sx, y: sy };
}

function getZoneForLayer(layer, zones) {
  if (layer?.zoneId) {
    return zones.find(z => z.id === layer.zoneId);
  }
  
  // If no zone assigned, return null
  return null;
}

function getPrintableAreaPx(canvasSize, boundary) {
  return {
    widthPx: canvasSize.width * (boundary.maxX - boundary.minX),
    heightPx: canvasSize.height * (boundary.maxY - boundary.minY),
  };
}

function inchesFromPx(px, zonePx, zoneInches) {
  if (!zonePx || zonePx <= 0) return 0;
  return (px / zonePx) * zoneInches;
}

function clampScaleToMaxInches({
  currentScale,
  drawWpx,
  drawHpx,
  zoneWpx,
  zoneHpx,
  maxWIn,
  maxHIn,
}) {
  const wIn = inchesFromPx(drawWpx, zoneWpx, maxWIn);
  const hIn = inchesFromPx(drawHpx, zoneHpx, maxHIn);

  if (wIn <= maxWIn + 1e-6 && hIn <= maxHIn + 1e-6) return currentScale;

  const fitScaleW = (maxWIn / wIn) * currentScale;
  const fitScaleH = (maxHIn / hIn) * currentScale;
  return Math.min(fitScaleW, fitScaleH, currentScale);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* =========================
   LocalStorage persistence
   ========================= */
function getCalibrationKey({ productType, view, mockupUrl, maskUrl }) {
  const base = `${productType}::${view}::${mockupUrl || ""}::${maskUrl || ""}`;
  return `mockup_calibration::${base}`;
}

function loadCalibration({ productType, view, mockupUrl, maskUrl }) {
  try {
    const key = getCalibrationKey({ productType, view, mockupUrl, maskUrl });
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { zones: data.zones || [], boundaries: data.boundaries || {} };
  } catch {
    return null;
  }
}

function saveCalibration({ productType, view, mockupUrl, maskUrl, zones, boundaries }) {
  const key = getCalibrationKey({ productType, view, mockupUrl, maskUrl });
  localStorage.setItem(key, JSON.stringify({ zones, boundaries }));
}

/* =========================
   Measurement Overlay
   ========================= */
function MeasurementOverlay({ canvasSize, zones, boundaries, view }) {
  if (!canvasSize || !zones || !boundaries) return null;

  const zonesToShow = zones.filter(z => z.view === view);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {zonesToShow.map((zone) => {
        const b = boundaries[zone.id];
        if (!b) return null;

        const left = `${b.minX * 100}%`;
        const top = `${b.minY * 100}%`;
        const width = `${(b.maxX - b.minX) * 100}%`;
        const height = `${(b.maxY - b.minY) * 100}%`;

        return (
          <div key={zone.id} className="absolute" style={{ left, top, width, height }}>
            <div
              className="absolute inset-0"
              style={{
                border: "2px solid rgba(59, 130, 246, 0.95)",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.15) inset",
              }}
            />

            <div
              className="absolute left-1/2 -bottom-6 -translate-x-1/2 text-[12px] font-medium"
              style={{ color: "rgba(30, 64, 175, 0.95)" }}
            >
              {zone.maxW} inches
            </div>

            <div
              className="absolute -left-12 top-1/2 -translate-y-1/2 text-[12px] font-medium"
              style={{ color: "rgba(30, 64, 175, 0.95)" }}
            >
              {zone.maxH} inches
            </div>

            <div
              className="absolute right-2 top-2 rounded px-2 py-1 text-[12px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.85)",
                color: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(59,130,246,0.4)",
              }}
            >
              {zone.maxW} × {zone.maxH} inches
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   Zone Management Modal - ZERO DEFAULT START
   ========================= */
function ZoneManagementModal({ isOpen, onClose, zones, setZones, activeView, boundaries, setBoundaries, productType }) {
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [newZoneWidth, setNewZoneWidth] = useState("6");
  const [newZoneHeight, setNewZoneHeight] = useState("8");
  const [selectedView, setSelectedView] = useState("front");
  const [editingZone, setEditingZone] = useState(null);

  if (!isOpen) return null;

  const productConfig = PRODUCT_ZONES[productType] || PRODUCT_ZONES.default;
  const availableViews = productConfig.views || ["front", "back"];

  const currentViewZones = zones.filter(z => z.view === selectedView);

  const handleAddZone = () => {
    if (!newZoneLabel.trim()) {
      alert("Please enter a zone label");
      return;
    }

    if (!newZoneWidth || !newZoneHeight) {
      alert("Please enter width and height");
      return;
    }

    const width = parseFloat(newZoneWidth);
    const height = parseFloat(newZoneHeight);
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      alert("Please enter valid width and height values");
      return;
    }

    const newId = `zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newZone = {
      id: newId,
      label: newZoneLabel,
      view: selectedView,
      maxW: width,
      maxH: height,
    };

    setZones(prev => [...prev, newZone]);
    
    // Create default boundary at center for new zone
    setBoundaries(prev => ({
      ...prev,
      [newId]: { minX: 0.4, minY: 0.4, maxX: 0.6, maxY: 0.6 }
    }));

    setNewZoneLabel("");
    setNewZoneWidth("6");
    setNewZoneHeight("8");
    
    alert(`Zone "${newZoneLabel}" added to ${selectedView} view`);
  };

  const handleUpdateZone = (zoneId) => {
    if (!newZoneLabel.trim()) {
      alert("Please enter a zone label");
      return;
    }

    if (!newZoneWidth || !newZoneHeight) {
      alert("Please enter width and height");
      return;
    }

    const width = parseFloat(newZoneWidth);
    const height = parseFloat(newZoneHeight);
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      alert("Please enter valid width and height values");
      return;
    }

    setZones(prev => prev.map(z => 
      z.id === zoneId ? {
        ...z,
        label: newZoneLabel,
        maxW: width,
        maxH: height
      } : z
    ));

    setEditingZone(null);
    setNewZoneLabel("");
    setNewZoneWidth("6");
    setNewZoneHeight("8");
    
    alert(`Zone updated successfully`);
  };

  const handleDeleteZone = (zoneId) => {
    if (!confirm("Are you sure you want to delete this zone?")) return;
    
    setZones(prev => prev.filter(z => z.id !== zoneId));
    setBoundaries(prev => {
      const updated = { ...prev };
      delete updated[zoneId];
      return updated;
    });
    
    alert("Zone deleted successfully");
  };

  const startEditZone = (zone) => {
    setEditingZone(zone.id);
    setNewZoneLabel(zone.label);
    setNewZoneWidth(zone.maxW.toString());
    setNewZoneHeight(zone.maxH.toString());
    setSelectedView(zone.view);
  };

  const resetAllZones = () => {
    if (!confirm("Are you sure you want to delete ALL zones? This cannot be undone.")) return;
    
    setZones([]);
    setBoundaries({});
    setEditingZone(null);
    setNewZoneLabel("");
    setNewZoneWidth("6");
    setNewZoneHeight("8");
    
    alert("All zones have been deleted");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Manage Print Zones - {productType}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage custom print areas from scratch
          </p>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* View Selection */}
          <div>
            <div className="text-sm font-medium text-slate-800 mb-2">Select View</div>
            <div className="flex gap-2">
              {availableViews.map(view => (
                <button
                  key={view}
                  onClick={() => setSelectedView(view)}
                  className={`px-3 py-2 rounded text-sm font-medium ${
                    selectedView === view
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Add/Edit Zone Form */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="text-sm font-medium text-slate-800 mb-3">
              {editingZone ? "Edit Zone" : "Add New Zone to " + selectedView.charAt(0).toUpperCase() + selectedView.slice(1)}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Zone Label *</label>
                <input
                  type="text"
                  value={newZoneLabel}
                  onChange={(e) => setNewZoneLabel(e.target.value)}
                  placeholder="e.g., 'Left Chest', 'Center Logo', etc."
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Width (inches) *</label>
                  <input
                    type="number"
                    value={newZoneWidth}
                    onChange={(e) => setNewZoneWidth(e.target.value)}
                    step="0.1"
                    min="1"
                    max="20"
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Height (inches) *</label>
                  <input
                    type="number"
                    value={newZoneHeight}
                    onChange={(e) => setNewZoneHeight(e.target.value)}
                    step="0.1"
                    min="1"
                    max="20"
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                {editingZone ? (
                  <>
                    <button
                      onClick={() => handleUpdateZone(editingZone)}
                      className="flex-1 text-sm px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                    >
                      Update Zone
                    </button>
                    <button
                      onClick={() => {
                        setEditingZone(null);
                        setNewZoneLabel("");
                        setNewZoneWidth("6");
                        setNewZoneHeight("8");
                      }}
                      className="text-sm px-4 py-2 border border-slate-300 rounded hover:bg-slate-50 font-medium"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleAddZone}
                    className="flex-1 text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Add Zone to {selectedView.charAt(0).toUpperCase() + selectedView.slice(1)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Zone List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-800">
                Zones in {selectedView.charAt(0).toUpperCase() + selectedView.slice(1)} ({currentViewZones.length})
              </div>
              {zones.length > 0 && (
                <button
                  onClick={resetAllZones}
                  className="text-xs px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 font-medium"
                >
                  Delete All Zones
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              {currentViewZones.map((zone) => (
                <div key={zone.id} className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{zone.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        {zone.view}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Size: {zone.maxW}″ × {zone.maxH}″
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditZone(zone)}
                      className="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      className="text-xs px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              
              {currentViewZones.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded bg-slate-50">
                  <div className="text-slate-400 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    No zones created yet
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Use the form above to create your first print zone
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              Total zones: {zones.length} • Current view: {selectedView}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-900 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Calibration Overlay UI
   ========================= */
function CalibrationOverlay({ view, zones, initialBoundaries, onSave, onClose }) {
  const overlayRef = useRef(null);
  const [activeZone, setActiveZone] = useState(null);

  const [rects, setRects] = useState(() => {
    const out = {};
    const viewZones = zones.filter(z => z.view === view);
    viewZones.forEach((zone) => {
      const defaultRect = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
      if (initialBoundaries && initialBoundaries[zone.id]) {
        out[zone.id] = boundaryToRect(initialBoundaries[zone.id]);
      } else {
        out[zone.id] = defaultRect;
      }
    });
    return out;
  });

  const dragRef = useRef(null);

  const onMove = (e) => {
    const st = dragRef.current;
    if (!st) return;

    const dxPx = e.clientX - st.startX;
    const dyPx = e.clientY - st.startY;

    const dx = dxPx / st.rectW;
    const dy = dyPx / st.rectH;

    setRects((prev) => {
      const next = { ...prev };
      const r = { ...st.startRect };

      const minSize = 0.04;

      if (st.mode === "move") {
        r.x = clamp01(r.x + dx);
        r.y = clamp01(r.y + dy);
        r.x = clamp01(Math.min(r.x, 1 - r.w));
        r.y = clamp01(Math.min(r.y, 1 - r.h));
      } else if (st.mode === "resize") {
        if (st.handle === "se") {
          r.w = clamp01(r.w + dx);
          r.h = clamp01(r.h + dy);
        } else if (st.handle === "sw") {
          r.x = clamp01(r.x + dx);
          r.w = clamp01(r.w - dx);
          r.h = clamp01(r.h + dy);
        } else if (st.handle === "ne") {
          r.y = clamp01(r.y + dy);
          r.h = clamp01(r.h - dy);
          r.w = clamp01(r.w + dx);
        } else if (st.handle === "nw") {
          r.x = clamp01(r.x + dx);
          r.y = clamp01(r.y + dy);
          r.w = clamp01(r.w - dx);
          r.h = clamp01(r.h - dy);
        }

        r.w = Math.max(minSize, r.w);
        r.h = Math.max(minSize, r.h);

        r.x = clamp01(Math.min(r.x, 1 - r.w));
        r.y = clamp01(Math.min(r.y, 1 - r.h));
      }

      next[st.zoneId] = r;
      return next;
    });
  };

  const onUp = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  const startDrag = (e, zoneId, mode, handle = null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!overlayRef.current) return;
    const r = rects[zoneId];
    if (!r) return;

    const bounds = overlayRef.current.getBoundingClientRect();

    dragRef.current = {
      zoneId,
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...r },
      rectW: bounds.width,
      rectH: bounds.height,
    };

    setActiveZone(zoneId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const boundaryMap = useMemo(() => {
    const out = {};
    Object.keys(rects).forEach((zoneId) => {
      out[zoneId] = rectToBoundary(rects[zoneId]);
    });
    return out;
  }, [rects]);

  const exportJson = () => {
    const payload = {
      view,
      zones: zones.filter(z => z.view === view),
      boundaries: boundaryMap,
      updatedAt: new Date().toISOString(),
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    alert("Copied calibration JSON to clipboard ✅");
  };

  const saveNow = () => onSave(boundaryMap);

  const resetAllZones = () => {
    const resetRects = {};
    zones.filter(z => z.view === view).forEach((zone) => {
      resetRects[zone.id] = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    });
    setRects(resetRects);
  };

  const viewZones = zones.filter(z => z.view === view);

  return (
    <div className="absolute inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Panel */}
      <div className="absolute top-3 left-3 z-[2000] bg-white rounded-lg shadow-lg border border-slate-200 w-[320px] pointer-events-auto">
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Calibration Mode - {view}
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
            type="button"
          >
            Close
          </button>
        </div>

        <div className="p-3 space-y-2">
          <div className="text-xs text-slate-600">
            Drag & resize each zone to match your mockup.
          </div>

          <div className="text-xs font-medium text-slate-800">Select Zone</div>
          <div className="grid grid-cols-2 gap-2">
            {viewZones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                type="button"
                className={`text-xs px-2 py-2 rounded border ${
                  activeZone === zone.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {zone.label}
              </button>
            ))}
          </div>

          {activeZone && (
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
              <div className="font-medium">Current Zone</div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-semibold">
                  {viewZones.find(z => z.id === activeZone)?.maxW}″ × {viewZones.find(z => z.id === activeZone)?.maxH}″
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={saveNow}
              className="flex-1 text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              type="button"
            >
              Save Calibration
            </button>
            <button
              onClick={exportJson}
              className="text-xs px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
              type="button"
            >
              Copy JSON
            </button>
            <button
              onClick={resetAllZones}
              className="text-xs px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 text-red-600"
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Drag layer */}
      <div ref={overlayRef} className="absolute inset-0 z-[1000] pointer-events-auto">
        {viewZones.map((zone) => {
          const r = rects[zone.id];
          if (!r) return null;

          const isActive = zone.id === activeZone;

          return (
            <div
              key={zone.id}
              className="absolute"
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
              }}
            >
              <div
                className="absolute inset-0"
                onPointerDown={(e) => startDrag(e, zone.id, "move")}
                style={{
                  border: isActive
                    ? "3px solid rgba(59,130,246,1)"
                    : "2px solid rgba(59,130,246,0.7)",
                  background: isActive ? "rgba(59,130,246,0.08)" : "transparent",
                  cursor: "move",
                }}
              />

              <div
                className="absolute -top-7 left-0 text-[11px] font-semibold px-2 py-1 rounded"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  color: "white",
                }}
              >
                {zone.label} • {zone.maxW}″×{zone.maxH}″
              </div>

              {isActive && (
                <>
                  {["nw", "ne", "sw", "se"].map((h) => (
                    <div
                      key={h}
                      onPointerDown={(e) => startDrag(e, zone.id, "resize", h)}
                      className="absolute w-3 h-3 bg-white border-2 border-blue-600 rounded"
                      style={{
                        cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                        left: h.includes("w") ? "-6px" : "auto",
                        right: h.includes("e") ? "-6px" : "auto",
                        top: h.includes("n") ? "-6px" : "auto",
                        bottom: h.includes("s") ? "-6px" : "auto",
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   RecolorEditor - ZERO DEFAULT START
   ========================= */
const RecolorEditor = forwardRef(function RecolorEditor(
  {
    mockupUrl,
    maskUrl,
    previewWidth = 800,
    productColor = "#FFFFFF",
    productKey,

    textLayers,
    setTextLayers,
    activeTextId,
    setActiveTextId,

    designLayers,
    setDesignLayers,
    activeDesignId,
    setActiveDesignId,

    bgRemovalLoading,
    onDesignRenderWidthChange,

    calibrationOverride = null,
  },
  ref
) {
  const [renderer, setRenderer] = useState(null);
  const [canvasSize, setCanvasSize] = useState(null);

  const [showMeasurements, setShowMeasurements] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [zoneManagementOpen, setZoneManagementOpen] = useState(false);

  // Detect product type
  const productType = useMemo(() => {
    if (productKey) return productKey;
    return getProductTypeFromUrl();
  }, [productKey]);

  // Get product config
  const productConfig = useMemo(() => {
    return PRODUCT_ZONES[productType] || PRODUCT_ZONES.default;
  }, [productType]);

  // Active view
  const activeView = useMemo(() => {
    const active = designLayers?.find((d) => d.id === activeDesignId);
    const viewCode = active?.viewCode || designLayers?.[0]?.viewCode || "front";
    return viewCode === "back" ? "back" : "front";
  }, [designLayers, activeDesignId]);

  // Zones state - EMPTY ARRAY (NO DEFAULT ZONES)
  const [zones, setZones] = useState(() => {
    return []; // Start with empty array - no default zones
  });

  // Boundaries state
  const [boundaries, setBoundaries] = useState(() => {
    return {}; // Start with empty object
  });

  // Load saved calibration
  useEffect(() => {
    const loaded = loadCalibration({ productType, view: activeView, mockupUrl, maskUrl });
    if (loaded?.zones && loaded?.boundaries) {
      setZones(loaded.zones);
      setBoundaries(loaded.boundaries);
    }
  }, [productType, activeView, mockupUrl, maskUrl]);

  // Apply calibration override
  useEffect(() => {
    if (calibrationOverride) {
      setBoundaries(prev => ({ ...prev, ...calibrationOverride }));
    }
  }, [calibrationOverride]);

  const handleRendererReady = useCallback((instance) => {
    setRenderer(instance || null);
    if (instance?.canvas) {
      setCanvasSize({ width: instance.canvas.width, height: instance.canvas.height });
    } else {
      setCanvasSize(null);
    }
  }, []);

  useEffect(() => {
    if (!renderer?.canvas) return;
    setCanvasSize({ width: renderer.canvas.width, height: renderer.canvas.height });
  }, [renderer]);

  useImperativeHandle(
    ref,
    () => ({
      capturePreview() {
        if (!renderer?.canvas) return null;
        try {
          return renderer.canvas.toDataURL("image/jpeg", 0.7);
        } catch (e) {
          console.error("Failed to capture preview", e);
          return null;
        }
      },
    }),
    [renderer]
  );

  useEffect(() => {
    if (!renderer?.canvas) return;
    if (!canvasSize) return;

    const glCanvas = renderer.canvas;
    const w = glCanvas.width;
    const h = glCanvas.height;
    if (!w || !h) return;

    const hasText = textLayers?.some((l) => l.text && l.text.trim().length > 0);
    const imageLayers = (designLayers || []).filter((l) => !!l.imageUrl);
    const hasImages = imageLayers.length > 0;

    if (!hasText && !hasImages) {
      renderer.clearDesignTexture();
      renderer.render(productColor);
      onDesignRenderWidthChange?.(null);
      return;
    }

    let cancelled = false;

    async function drawAll() {
      try {
        const offscreen = document.createElement("canvas");
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext("2d");
        ctx.clearRect(0, 0, w, h);

        // Draw text layers
        (textLayers || []).forEach((layer) => {
          if (!layer.text) return;
          const px = layer.x * w;
          const py = layer.y * h;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
          ctx.fillStyle = layer.color || "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `700 ${layer.fontSize || 40}px ${layer.fontFamily || "Impact, sans-serif"}`;
          ctx.fillText(layer.text, 0, 0);
          ctx.restore();
        });

        // Draw image layers
        if (imageLayers.length) {
          const imgs = await Promise.all(imageLayers.map((l) => loadImage(l.imageUrl)));
          const updates = [];

          imgs.forEach((img, idx) => {
            const layer = imageLayers[idx];
            const px = layer.x * w;
            const py = layer.y * h;

            const targetWidthPx = canvasSize.width * (layer.scale || 0.35);
            const imgRatio = img.width > 0 ? targetWidthPx / img.width : 1;
            const drawW = img.width * imgRatio;
            const drawH = img.height * imgRatio;

            const zone = getZoneForLayer(layer, zones);
            const zoneBoundary = boundaries[zone?.id];

            // If no zone or boundary, designs move freely
            if (!zone || !zoneBoundary) {
              updates.push({
                id: layer.id,
                patch: {
                  renderedWidthPx: drawW,
                  renderedHeightPx: drawH,
                  renderedWidthInches: null,
                  renderedHeightInches: null,
                  printableAreaWidthInches: null,
                  printableAreaHeightInches: null,
                  zoneId: zone?.id,
                },
              });

              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
              ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
              ctx.restore();
              return;
            }

            const zonePx = getPrintableAreaPx(canvasSize, zoneBoundary);

            const widthIn = inchesFromPx(drawW, zonePx.widthPx, zone.maxW);
            const heightIn = inchesFromPx(drawH, zonePx.heightPx, zone.maxH);

            const clampedScale = clampScaleToMaxInches({
              currentScale: layer.scale || 0.35,
              drawWpx: drawW,
              drawHpx: drawH,
              zoneWpx: zonePx.widthPx,
              zoneHpx: zonePx.heightPx,
              maxWIn: zone.maxW,
              maxHIn: zone.maxH,
            });

            updates.push({
              id: layer.id,
              patch: {
                renderedWidthPx: drawW,
                renderedHeightPx: drawH,
                renderedWidthInches: widthIn,
                renderedHeightInches: heightIn,
                printableAreaWidthInches: zone.maxW,
                printableAreaHeightInches: zone.maxH,
                zoneId: zone.id,
                ...(clampedScale < (layer.scale || 0.35) ? { scale: clampedScale } : {}),
              },
            });

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          });

          if (updates.length) {
            setDesignLayers((prev) =>
              prev.map((l) => {
                const u = updates.find((x) => x.id === l.id);
                return u ? { ...l, ...u.patch } : l;
              })
            );
          }
        }

        if (cancelled) return;

        renderer.updateDesignTexture(offscreen);
        renderer.render(productColor);

        const activeDesign = designLayers.find((d) => d.id === activeDesignId);
        if (activeDesign && canvasSize) {
          onDesignRenderWidthChange?.(canvasSize.width * activeDesign.scale);
        } else {
          onDesignRenderWidthChange?.(null);
        }
      } catch (err) {
        console.error("Error drawing texture:", err);
      }
    }

    drawAll();
    return () => {
      cancelled = true;
    };
  }, [
    renderer,
    canvasSize,
    textLayers,
    designLayers,
    productColor,
    activeDesignId,
    setDesignLayers,
    boundaries,
    zones,
    onDesignRenderWidthChange,
  ]);

  const handleBackgroundMouseDown = () => {
    setActiveDesignId(null);
    setActiveTextId(null);
  };

  const saveCalibratedZones = (newBoundaries) => {
    saveCalibration({ 
      productType, 
      view: activeView, 
      mockupUrl, 
      maskUrl, 
      zones,
      boundaries: newBoundaries 
    });
    setBoundaries(newBoundaries);
    setCalibrationMode(false);
    alert("Calibration saved ✅");
  };

  return (
    <div className="relative w-full h-full" onMouseDown={handleBackgroundMouseDown}>
      <CanvasRenderer
        mockupUrl={mockupUrl}
        maskUrl={maskUrl}
        previewWidth={previewWidth}
        productColor={productColor}
        onRendererReady={handleRendererReady}
      />

      {showMeasurements && canvasSize && zones.length > 0 && (
        <MeasurementOverlay 
          canvasSize={canvasSize} 
          zones={zones}
          boundaries={boundaries}
          view={activeView}
        />
      )}

      <div className="absolute top-2 right-2 z-50 flex flex-col gap-2">
        <div className="flex gap-2">
          {zones.length > 0 && (
            <button
              onClick={() => setShowMeasurements((s) => !s)}
              className="bg-white/85 hover:bg-white text-xs px-3 py-1.5 rounded border border-slate-300 shadow-sm font-medium"
              type="button"
            >
              {showMeasurements ? "Hide Zones" : "Show Zones"}
            </button>
          )}

          <button
            onClick={() => setZoneManagementOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded shadow-sm font-medium"
            type="button"
          >
            {zones.length === 0 ? "Create Zones" : "Manage Zones"}
          </button>

          {zones.filter(z => z.view === activeView).length > 0 && (
            <button
              onClick={() => setCalibrationMode(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded shadow-sm font-medium"
              type="button"
            >
              Calibrate
            </button>
          )}
        </div>

        {showMeasurements && zones.filter(z => z.view === activeView).length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 border border-slate-300 shadow-sm max-w-xs">
            <div className="text-xs font-semibold text-slate-800 mb-2">
              Zones ({activeView.charAt(0).toUpperCase() + activeView.slice(1)})
            </div>
            <div className="text-xs text-slate-600 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {zones.filter(z => z.view === activeView).map(zone => (
                <div key={zone.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="truncate max-w-[120px]">{zone.label}</span>
                  </div>
                  <span className="font-semibold whitespace-nowrap">{zone.maxW}″ × {zone.maxH}″</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone Management Modal */}
      <ZoneManagementModal
        isOpen={zoneManagementOpen}
        onClose={() => setZoneManagementOpen(false)}
        zones={zones}
        setZones={setZones}
        activeView={activeView}
        boundaries={boundaries}
        setBoundaries={setBoundaries}
        productType={productType}
      />

      {/* Calibration Overlay */}
      {calibrationMode && canvasSize && zones.filter(z => z.view === activeView).length > 0 && (
        <CalibrationOverlay
          view={activeView}
          zones={zones}
          initialBoundaries={boundaries}
          onSave={saveCalibratedZones}
          onClose={() => setCalibrationMode(false)}
        />
      )}

      {/* Text Overlay */}
      {renderer && (
        <TextOverlay
          textLayers={textLayers}
          setTextLayers={setTextLayers}
          activeTextId={activeTextId}
          setActiveTextId={setActiveTextId}
          onAnyTextClick={() => setActiveDesignId(null)}
          canvasSize={canvasSize}
        />
      )}

      {/* Design Overlay */}
      {renderer &&
        canvasSize &&
        (designLayers || []).map((layer) => (
          <DesignOverlay
            key={layer.id}
            layer={layer}
            canvasSize={canvasSize}
            setDesignLayers={setDesignLayers}
            isActive={layer.id === activeDesignId}
            setActiveDesignId={setActiveDesignId}
            disabled={bgRemovalLoading}
            zones={zones}
            boundaries={boundaries}
          />
        ))}

      {bgRemovalLoading && (
        <div className="pointer-events-none absolute inset-0 bg-white/40 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded shadow-md">
            <div className="text-sm text-slate-700">Removing background...</div>
            <div className="text-xs text-slate-500 mt-1">Please wait</div>
          </div>
        </div>
      )}
    </div>
  );
});

/* =========================
   TEXT OVERLAY
   ========================= */
function TextOverlay({ textLayers, setTextLayers, activeTextId, setActiveTextId, onAnyTextClick, canvasSize }) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { mode, id, startX, startY, rectWidth, rectHeight, initialLayer } = dragState;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (mode === "drag") {
        const nx = initialLayer.x + dx / rectWidth;
        const ny = initialLayer.y + dy / rectHeight;

        let constrainedX = nx;
        let constrainedY = ny;

        const textLayer = textLayers.find((l) => l.id === id);
        if (textLayer && canvasSize) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          ctx.font = `${textLayer.fontSize}px ${textLayer.fontFamily}`;
          const textWidth = ctx.measureText(textLayer.text).width;
          const textHeight = textLayer.fontSize * 1.2;

          const halfWidth = textWidth / canvasSize.width / 2;
          const halfHeight = textHeight / canvasSize.height / 2;

          const adjusted = {
            minX: TEXT_BOUNDARIES.minX + halfWidth,
            maxX: TEXT_BOUNDARIES.maxX - halfWidth,
            minY: TEXT_BOUNDARIES.minY + halfHeight,
            maxY: TEXT_BOUNDARIES.maxY - halfHeight,
          };

          constrainedX = Math.max(adjusted.minX, Math.min(adjusted.maxX, nx));
          constrainedY = Math.max(adjusted.minY, Math.min(adjusted.maxY, ny));
        }

        setTextLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, x: constrainedX, y: constrainedY } : layer)));
      } else if (mode === "resize") {
        const newSize = Math.max(12, Math.min(200, initialLayer.fontSize + (dx + dy) * 0.3));
        setTextLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, fontSize: newSize } : layer)));
      }
    },
    [setTextLayers, textLayers, canvasSize]
  );

  const onPointerUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e, id, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const layer = textLayers.find((l) => l.id === id);
    if (!layer) return;

    dragStateRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
    };

    setActiveTextId(id);
    onAnyTextClick?.();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20">
      {(textLayers || []).map((layer) => {
        const isActive = layer.id === activeTextId;
        const left = `${layer.x * 100}%`;
        const top = `${layer.y * 100}%`;

        return (
          <div
            key={layer.id}
            style={{ left, top, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)` }}
            className="pointer-events-auto absolute"
            onPointerDown={(e) => startDrag(e, layer.id, "drag")}
          >
            <div
              className={`relative inline-block border ${isActive ? "border-blue-500 bg-blue-50/30" : "border-transparent"} bg-transparent px-2 py-1 rounded`}
              style={{
                fontFamily: layer.fontFamily,
                fontSize: layer.fontSize,
                color: layer.color,
                whiteSpace: "nowrap",
                cursor: "move",
                userSelect: "none",
              }}
            >
              {layer.text || " "}
              {isActive && (
                <div
                  onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                  className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                  style={{ cursor: "nwse-resize" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   DESIGN OVERLAY (IMAGES)
   ========================= */
/* =========================
   DESIGN OVERLAY (IMAGES) - FIXED WITH PROPER BOUNDARY CONSTRAINTS
   ========================= */
// Complete fixed DesignOverlay component
function DesignOverlay({ layer, canvasSize, setDesignLayers, isActive, setActiveDesignId, disabled, zones, boundaries }) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const st = dragStateRef.current;
      if (!st) return;

      const { id, startX, startY, rectWidth, rectHeight, initialLayer } = st;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const nx = initialLayer.x + dx / rectWidth;
      const ny = initialLayer.y + dy / rectHeight;

      const zone = getZoneForLayer(initialLayer, zones);
      const b = boundaries?.[zone?.id];

      // If no zone or boundary, allow free movement within canvas bounds
      if (!zone || !b) {
        const scale = initialLayer.scale || 0.35;
        const aspect = (initialLayer.originalHeightPx / initialLayer.originalWidthPx) || 1;
        const wPx = canvasSize.width * scale;
        const hPx = wPx * aspect;
        
        const halfW = (wPx / canvasSize.width) / 2;
        const halfH = (hPx / canvasSize.height) / 2;
        
        // Clamp to canvas bounds (0 to 1)
        let constrainedX = Math.max(halfW, Math.min(1 - halfW, nx));
        let constrainedY = Math.max(halfH, Math.min(1 - halfH, ny));
        
        setDesignLayers((prev) => prev.map((d) => (d.id === id ? { ...d, x: constrainedX, y: constrainedY } : d)));
        return;
      }

      // Design size in normalized units (center anchored)
      const scale = initialLayer.scale || 0.35;
      const aspect = (initialLayer.originalHeightPx / initialLayer.originalWidthPx) || 1;

      const wPx = canvasSize.width * scale;
      const hPx = wPx * aspect;

      const halfW = (wPx / canvasSize.width) / 2;   // normalized half width
      const halfH = (hPx / canvasSize.height) / 2;  // normalized half height

      // Calculate the boundaries where the CENTER of the design can go
      const minCenterX = b.minX + halfW;
      const maxCenterX = b.maxX - halfW;
      const minCenterY = b.minY + halfH;
      const maxCenterY = b.maxY - halfH;

      // If the zone is smaller than the design, keep design centered in zone
      let constrainedX, constrainedY;
      
      if (minCenterX > maxCenterX) {
        // Zone is narrower than design - center design in zone
        constrainedX = (b.minX + b.maxX) / 2;
      } else {
        // Normal case - clamp center within boundaries
        constrainedX = Math.max(minCenterX, Math.min(maxCenterX, nx));
      }
      
      if (minCenterY > maxCenterY) {
        // Zone is shorter than design - center design in zone
        constrainedY = (b.minY + b.maxY) / 2;
      } else {
        // Normal case - clamp center within boundaries
        constrainedY = Math.max(minCenterY, Math.min(maxCenterY, ny));
      }

      // Snap to edges if close (optional)
      const snapped = snapToBoundaryCenter(constrainedX, constrainedY, b, halfW, halfH);
      constrainedX = snapped.x;
      constrainedY = snapped.y;

      setDesignLayers((prev) => prev.map((d) => (d.id === id ? { 
        ...d, 
        x: constrainedX, 
        y: constrainedY 
      } : d)));
    },
    [setDesignLayers, zones, boundaries, canvasSize]
  );

  const onPointerUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    dragStateRef.current = {
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
    };

    setActiveDesignId(layer.id);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Get current zone to check if design is within bounds
  const currentZone = getZoneForLayer(layer, zones);
  const zoneBoundary = boundaries?.[currentZone?.id];
  
  // Calculate if design is within its zone
  const isOutOfBounds = useMemo(() => {
    if (!currentZone || !zoneBoundary || !canvasSize) return false;
    
    const scale = layer.scale || 0.35;
    const aspect = (layer.originalHeightPx / layer.originalWidthPx) || 1;
    const wPx = canvasSize.width * scale;
    const hPx = wPx * aspect;
    
    const halfW = (wPx / canvasSize.width) / 2;
    const halfH = (hPx / canvasSize.height) / 2;
    
    const minCenterX = zoneBoundary.minX + halfW;
    const maxCenterX = zoneBoundary.maxX - halfW;
    const minCenterY = zoneBoundary.minY + halfH;
    const maxCenterY = zoneBoundary.maxY - halfH;
    
    // Check if design center is within allowed center positions
    const isXInBounds = layer.x >= minCenterX && layer.x <= maxCenterX;
    const isYInBounds = layer.y >= minCenterY && layer.y <= maxCenterY;
    
    return !(isXInBounds && isYInBounds);
  }, [currentZone, zoneBoundary, canvasSize, layer]);

  const left = `${layer.x * 100}%`;
  const top = `${layer.y * 100}%`;

  const widthPx = canvasSize.width * layer.scale;
  const heightPx = widthPx * ((layer.originalHeightPx / layer.originalWidthPx) || 1);

  const zone = getZoneForLayer(layer, zones);

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10">
      <div
        style={{
          left,
          top,
          transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
          cursor: disabled ? "default" : "grab",
        }}
        className="pointer-events-auto absolute"
        onPointerDown={startDrag}
      >
        <div
          className={`overflow-hidden rounded-sm ${isActive ? "border-2 border-blue-500 bg-blue-50/20" : "border border-slate-300/50"} ${isOutOfBounds ? 'border-2 border-red-500' : ''}`}
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {layer.imageUrl && (
            <img
              src={layer.imageUrl}
              alt="design"
              style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
            />
          )}
        </div>

        {isActive && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
            {layer.renderedWidthInches?.toFixed?.(1) || "?"}″ ×{" "}
            {layer.renderedHeightInches?.toFixed?.(1) || "?"}″
            {zone && ` (${zone.label}: ${zone.maxW}″ × ${zone.maxH}″)`}
            {isOutOfBounds && " ⚠ Out of bounds"}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecolorEditor;