// src/pages/DesignerPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProductBySlug } from "../redux/slices/productsSlice.js";
import RecolorEditor from "./RecolorEditor.jsx";
import {selectCurrentToken} from "../redux/slices/Userslice.js"
const API_URL = "http://localhost:5000";

const FONT_OPTIONS = [
  "Impact, sans-serif",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "'Times New Roman', serif",
  "Georgia, serif",
  "'Comic Sans MS', cursive, sans-serif",
];

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

const createDesignLayer = (id, imageUrl, file) => ({
  id,
  imageUrl,
  file,
  hasBgRemoved: false,
  x: 0.5,
  y: 0.5,
  scale: 0.35,
  rotation: 0,
});

export default function DesignerPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectCurrentToken);
  const { current: product, currentStatus, currentError } = useSelector(
    (state) => state.products
  );

  const [productColor, setProductColor] = useState("#FFFFFF");

  // per-view state: { [viewCode]: { textLayers, activeTextId, designLayers, activeDesignId } }
  const [viewStates, setViewStates] = useState({});
  const [viewCode, setViewCode] = useState("front");

  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);
  const [error, setError] = useState("");
  const [designRenderWidth, setDesignRenderWidth] = useState(null);

  // save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // edit mode state
  const editDesignId = searchParams.get("edit");
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [originalDesign, setOriginalDesign] = useState(null);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  const editorRef = useRef(null);

  const colorOptions = [
    "#FFFFFF",
    "#000000",
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
    "#00D2D3",
    "#FF9F43",
  ];
  const PRINT_DPI = 300;

  const handleColorChange = (color) => setProductColor(color);
  const getImageNaturalSize = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });


  // -------- IMAGE UPLOAD FUNCTION --------
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
      // Fallback: convert to data URL if upload fails
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
  };

  // -------- FETCH PRODUCT --------
  useEffect(() => {
    if (slug) {
      console.log("Fetching product for slug:", slug);
      dispatch(fetchProductBySlug(slug));
    }
  }, [slug, dispatch]);

  // -------- LOAD DESIGN FOR EDIT --------
  useEffect(() => {
    if (!editDesignId || !product) {
      console.log("Not in edit mode or product not loaded yet");
      setIsEditMode(false);
      return;
    }

    // Only load if we haven't initialized edit mode yet
    if (editModeInitialized) {
      return;
    }

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
        
        // Store original design for reference
        setOriginalDesign(design);
        
        // Set product color
        setProductColor(design.productColor || "#FFFFFF");

        // Initialize view states with loaded data
        const loadedViewStates = {};
        design.views?.forEach((view) => {
          loadedViewStates[view.code] = {
            textLayers: view.textLayers?.map(t => ({
              ...t,
              id: t.id || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`
            })) || [],
            activeTextId: view.textLayers?.[0]?.id || null,
            designLayers: view.designLayers?.map(d => ({
              ...d,
              id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              // Convert image URLs to fetchable format
              imageUrl: d.imageUrl?.startsWith('http') || d.imageUrl?.startsWith('blob:') || d.imageUrl?.startsWith('data:')
                ? d.imageUrl 
                : d.imageUrl?.startsWith('/') 
                  ? `${API_URL}${d.imageUrl}`
                  : d.imageUrl,
              file: null,
              originalFile: null
            })) || [],
            activeDesignId: view.designLayers?.[0]?.id || null,
          };
        });

        setViewStates(loadedViewStates);
        setIsEditMode(true);
        setEditModeInitialized(true);
        
        // Set to front view by default
        if (design.views?.[0]?.code) {
          setViewCode(design.views[0].code);
        }
        
        console.log("Edit mode initialized with view states:", loadedViewStates);
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

  // -------- INIT VIEW STATES WHEN PRODUCT LOADS (FOR NEW DESIGNS) --------
  useEffect(() => {
    if (!product?.views?.length) {
      console.log("No product views found");
      return;
    }
    
    // If we're in edit mode and already initialized, don't override
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
    
    console.log("New design initialized with view states:", initial);
  }, [product, isEditMode, editModeInitialized]);

  // -------- CLEANUP BLOB URLs --------
  useEffect(() => {
    return () => {
      // Clean up all blob URLs
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

  // helper to get current view state safely
  const getCurrentViewState = () => {
    const existing = viewStates[viewCode];
    return existing ? { ...baseViewState, ...existing } : baseViewState;
  };

  // helper to update current view state
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

  const { textLayers, activeTextId, designLayers, activeDesignId } =
    getCurrentViewState();

  const activeTextLayer =
    textLayers.find((l) => l.id === activeTextId) || textLayers[0];

  const activeDesign =
    designLayers.find((d) => d.id === activeDesignId) || null;

  // -------- TEXT HELPERS (PER VIEW) --------

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

  // -------- DESIGN HELPERS (PER VIEW) --------

  const handleDesignUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError("");

    try {
      const newLayers = [];
      
      for (const file of files) {
        // Upload the image to server
        const serverUrl = await uploadDesignImage(file);
        
        const id = `design-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
          const { width, height } = await getImageNaturalSize(serverUrl);
        newLayers.push({
          ...createDesignLayer(id, serverUrl, file),
          originalFile: file,

          // ✅ store original pixel size
          originalWidthPx: width,
          originalHeightPx: height,

          // optional: initial rendered px (based on scale)
          renderedWidthPx: width * 0.35,
          renderedHeightPx: height * 0.35,
        });

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
      return;
    }
    
    const fileToUse = activeDesign.originalFile || activeDesign.file;
    if (!fileToUse) {
      setError("No original file available for background removal");
      return;
    }

    try {
      setBgRemovalLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("image", fileToUse);

      const res = await fetch(`${API_URL}/api/remove-bg`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Background removal failed");

      // Use the server URL from background removal
      const updatedLayers = designLayers.map((d) =>
        d.id === activeDesign.id
          ? {
              ...d,
              imageUrl: `${API_URL}${data.outputUrl}?t=${Date.now()}`,
              hasBgRemoved: true,
              // Keep the original file for further processing if needed
              originalFile: fileToUse,
            }
          : d
      );

      updateCurrentViewState({ designLayers: updatedLayers });
    } catch (err) {
      console.error("Remove BG error:", err);
      setError(err.message || "Background removal failed");
    } finally {
      setBgRemovalLoading(false);
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
    const updated = designLayers.map((d) =>
      d.id === activeDesign.id ? { ...d, scale: v } : d
    );
    updateCurrentViewState({ designLayers: updated });
  };

  // -------- SAFE WRAPPERS FOR RecolorEditor SETTERS --------

  const handleSetTextLayers = (updater) => {
    setViewStates((prev) => {
      const existing = prev[viewCode];
      const current = existing ? { ...baseViewState, ...existing } : baseViewState;
      const nextTextLayers =
        typeof updater === "function"
          ? updater(current.textLayers)
          : updater;

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
      const nextDesignLayers =
        typeof updater === "function"
          ? updater(current.designLayers)
          : updater;

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
      const nextId =
        typeof idOrUpdater === "function"
          ? idOrUpdater(current.activeTextId)
          : idOrUpdater;

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
      const nextId =
        typeof idOrUpdater === "function"
          ? idOrUpdater(current.activeDesignId)
          : idOrUpdater;

      return {
        ...prev,
        [viewCode]: {
          ...current,
          activeDesignId: nextId,
        },
      };
    });
  };

  // -------- CAPTURE PREVIEWS FOR ALL VIEWS --------

  const captureAllViewPreviews = async () => {
    if (!product?.views || product.views.length === 0 || !editorRef.current) {
      return {};
    }

    const previewsByCode = {};
    const originalViewCode = viewCode;

    // loop each view (front, back, left, right...)
    for (const v of product.views) {
      setViewCode(v.code);
      // wait a bit for React + WebGL to render that view
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const img =
        editorRef.current && editorRef.current.capturePreview
          ? editorRef.current.capturePreview()
          : null;

      if (img) {
        previewsByCode[v.code] = img;
      }
    }

    // restore original view
    setViewCode(originalViewCode);

    return previewsByCode;
  };

  // -------- SAVE / UPDATE DESIGN --------

  

const handleSaveDesign = async () => {
  
  if (!product) return;

  // ✅ require login
  if (!token) {
    setSaveError("Please login to save your design.");
    setSaveSuccess(false);
    return;
  }

  setSaving(true);
  setSaveError("");
  setSaveSuccess(false);

  try {
    const previewsByCode = await captureAllViewPreviews();

    // Process each design layer to ensure we have proper URLs
    const processedViewStates = { ...viewStates };

    for (const [viewCode, viewState] of Object.entries(processedViewStates)) {
      if (viewState.designLayers && viewState.designLayers.length > 0) {
        const processedLayers = [];

        for (const layer of viewState.designLayers) {
          // If it's a blob URL or data URL, we need to upload it
          if (
            layer.imageUrl &&
            (layer.imageUrl.startsWith("blob:") ||
              layer.imageUrl.startsWith("data:"))
          ) {
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
            // Already a server URL, keep as-is
            processedLayers.push(layer);
          }
        }

        processedViewStates[viewCode] = {
          ...viewState,
          designLayers: processedLayers,
        };
      }
    }

    // main preview (front if present, else first)
    const mainPreview =
      previewsByCode["front"] ||
      (product.views?.[0] && previewsByCode[product.views[0].code]) ||
      null;

    const viewsPayload =
      product.views?.map((v) => {
        const vs = processedViewStates[v.code]
          ? { ...baseViewState, ...processedViewStates[v.code] }
          : baseViewState;

        const textLayersPayload = (vs.textLayers || []).map(
          ({ id, text, x, y, fontSize, color, fontFamily, rotation }) => ({
            id,
            text,
            x,
            y,
            fontSize,
            color,
            fontFamily,
            rotation,
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
          }) => {
            const renderedWidthPx =
              typeof originalWidthPx === "number" ? originalWidthPx * scale : null;

            const renderedHeightPx =
              typeof originalHeightPx === "number" ? originalHeightPx * scale : null;

            return {
              id,
              imageUrl,
              hasBgRemoved: !!hasBgRemoved,
              x,
              y,
              scale,
              rotation,
              zone: zone || null,
              insideSafeArea:
                typeof insideSafeArea === "boolean" ? insideSafeArea : true,

              // ✅ pixel-first fields
              originalWidthPx: typeof originalWidthPx === "number" ? originalWidthPx : null,
              originalHeightPx: typeof originalHeightPx === "number" ? originalHeightPx : null,
              renderedWidthPx,
              renderedHeightPx,
            };
          }
        );



        return {
          code: v.code,
          textLayers: textLayersPayload,
          designLayers: designLayersPayload,
          previewImage: previewsByCode[v.code] || null,
        };
      }) || [];

    const body = {
      productId: product._id || product.id,
      productSlug: product.slug || slug,
      productColor,
      previewImage: mainPreview,
      views: viewsPayload,
    };

    console.log("Saving design. Is edit mode?", isEditMode);
    console.log("Edit design ID:", editDesignId);

    // Use PUT for edit mode, POST for create mode
    const url =
      isEditMode && editDesignId
        ? `${API_URL}/savedata/${editDesignId}`
        : `${API_URL}/savedata`;

    const method = isEditMode && editDesignId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // ✅ IMPORTANT
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Failed to save design");
    }

    setSaveSuccess(true);

    if (isEditMode) {
      alert("Design updated successfully!");
    } else {
      alert("Design saved successfully!");
    }
  } catch (err) {
    console.error("Save design error:", err);
    setSaveError(err.message || "Failed to save design");
  } finally {
    setSaving(false);
  }
};


  // -------- RESET TO ORIGINAL --------
  const handleResetToOriginal = () => {
    if (!originalDesign || !window.confirm("Reset all changes to original design?")) {
      return;
    }

    // Restore from original design
    const restoredViewStates = {};
    originalDesign.views?.forEach((view) => {
      restoredViewStates[view.code] = {
        textLayers: view.textLayers?.map(t => ({
          ...t,
          id: t.id || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`
        })) || [],
        activeTextId: view.textLayers?.[0]?.id || null,
        designLayers: view.designLayers?.map(d => ({
          ...d,
          id: d.id || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          imageUrl: d.imageUrl?.startsWith('http') || d.imageUrl?.startsWith('blob:') || d.imageUrl?.startsWith('data:')
            ? d.imageUrl 
            : d.imageUrl?.startsWith('/') 
              ? `${API_URL}${d.imageUrl}`
              : d.imageUrl,
          file: null,
          originalFile: null
        })) || [],
        activeDesignId: view.designLayers?.[0]?.id || null,
      };
    });

    setViewStates(restoredViewStates);
    setProductColor(originalDesign.productColor || "#FFFFFF");
    alert("Design reset to original!");
  };

  // -------- HANDLE BACK TO ADMIN --------
  const handleBackToAdmin = () => {
    navigate('/admin/designs');
  };

  // -------- LOADING / ERROR STATES --------

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

  const currentView =
    product.views.find((v) => v.code === viewCode) || product.views[0];
  const mockupUrl = currentView?.mockupUrl;
  const maskUrl = currentView?.maskUrl;

  // Debug info
  console.log("DesignerPage rendering:", {
    slug,
    productName: product?.name,
    isEditMode,
    editDesignId,
    viewStatesCount: Object.keys(viewStates).length,
    mockupUrl,
    maskUrl
  });

  // -------- RENDER --------

  return (
    <div className="flex h-screen flex-col bg-neutral-100 text-slate-900">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <div className="text-lg font-extrabold tracking-wide text-orange-500">
            MYPRINT
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
            <button 
              onClick={handleBackToAdmin}
              className="text-sky-700 hover:underline"
            >
              Back to Admin
            </button>
          )}

          {isEditMode && originalDesign && (
            <button
              type="button"
              onClick={handleResetToOriginal}
              className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Reset to Original
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDesign}
            disabled={saving}
            className="rounded-full border border-sky-600 bg-sky-600 px-4 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditMode ? "Update Design" : "Save Design"}
          </button>

          <button className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
            Sign In
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 p-6 gap-6">
        {/* Sidebar */}
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

          {/* Product colors */}
          <div>
            <h3 className="mb-3 font-semibold">Product Colors</h3>
            <p className="mb-4 text-sm text-slate-600">
              Choose your base product color
            </p>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium">
                Current Color
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded border border-slate-300"
                  style={{ backgroundColor: productColor }}
                />
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer"
                  value={productColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-2">
              <label className="mb-2 block text-xs font-medium">
                Quick Select
              </label>
              <div className="grid grid-cols-6 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === productColor
                        ? "border-sky-500"
                        : "border-slate-300"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* View selector */}
          {product.views && product.views.length > 1 && (
            <div>
              <h3 className="mb-2 font-semibold">View</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {product.views.map((v) => {
                  const viewState = viewStates[v.code];
                  const hasLayers = viewState && (
                    viewState.textLayers?.length > 0 || 
                    viewState.designLayers?.length > 0
                  );
                  
                  return (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => setViewCode(v.code)}
                      className={`relative rounded px-2 py-1 border ${
                        v.code === viewCode
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {v.label}
                      {hasLayers && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <hr className="border-slate-200" />

          {/* Upload / BG removal for designs */}
          <div>
            <h3 className="mb-2 font-semibold">Upload Designs</h3>
            <p className="mb-2 text-xs text-slate-600">
              Upload one or more images. They will be saved to the server automatically.
            </p>

            <div className="mb-3 text-xs">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleDesignUpload}
                className="w-full text-xs"
              />
            </div>

            {activeDesign && (
              <>
                <div className="mb-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      Selected design
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ID: {activeDesign.id.slice(0, 6)}…
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={bgRemovalLoading}
                      className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
                        bgRemovalLoading
                          ? "border-slate-300 text-slate-400"
                          : "border-sky-500 text-sky-700 hover:bg-sky-50"
                      }`}
                    >
                      {bgRemovalLoading ? "Removing…" : "Remove background"}
                    </button>
                    <button
                      type="button"
                      onClick={clearActiveDesign}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mb-3 text-xs">
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">
                    Design size (relative)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.1}
                      max={1.2}
                      step={0.02}
                      value={activeDesign.scale}
                      onChange={(e) => handleDesignScaleChange(e.target.value)}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-[11px] text-slate-600">
                      {Math.round(activeDesign.scale * 100)}%
                    </span>
                  </div>
                  {designRenderWidth && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Approx width on shirt:{" "}
                      <span className="font-semibold">
                        {Math.round(designRenderWidth)} px
                      </span>
                    </p>
                  )}
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span
                      className={
                        activeDesign.hasBgRemoved
                          ? "font-semibold text-emerald-600"
                          : "font-medium text-slate-600"
                      }
                    >
                      {activeDesign.hasBgRemoved
                        ? "Background removed"
                        : "Original (saved on server)"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Tip: click a design on the shirt to select it. Click empty
                    area or text to hide its border.
                  </p>
                </div>
              </>
            )}

            {!activeDesign && designLayers.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                Click any design on the shirt to select it and edit.
              </p>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* Text tools */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Text</h3>
              <div className="flex gap-2">
                <button
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
                  type="button"
                  onClick={addNewText}
                >
                  + Add text
                </button>
                <button
                  className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                  type="button"
                  onClick={removeActiveText}
                  disabled={!activeTextLayer}
                >
                  Remove
                </button>
              </div>
            </div>

            {activeTextLayer ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">
                    Text
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500"
                    value={activeTextLayer.text}
                    onChange={(e) =>
                      updateActiveTextLayer({ text: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">
                      Font
                    </label>
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500"
                      value={activeTextLayer.fontFamily}
                      onChange={(e) =>
                        updateActiveTextLayer({ fontFamily: e.target.value })
                      }
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f.replace(/,.*$/, "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-16">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">
                      Color
                    </label>
                    <input
                      type="color"
                      className="h-7 w-full cursor-pointer rounded border border-slate-300"
                      value={activeTextLayer.color}
                      onChange={(e) =>
                        updateActiveTextLayer({ color: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">
                    Size
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={14}
                      max={120}
                      value={activeTextLayer.fontSize}
                      onChange={(e) =>
                        updateActiveTextLayer({
                          fontSize: parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-[11px] text-slate-600">
                      {activeTextLayer.fontSize}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">
                    Rotation
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={activeTextLayer.rotation}
                      onChange={(e) =>
                        updateActiveTextLayer({
                          rotation: parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-[11px] text-slate-600">
                      {activeTextLayer.rotation}°
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Drag the text on the shirt, or use the corner handle to
                  resize.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                No text added yet. Click{" "}
                <span className="font-semibold">"+ Add text"</span> to start.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
              {error}
            </div>
          )}

          {saveError && (
            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
              {isEditMode ? "Design updated successfully!" : "Design saved successfully!"}
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
                  <div className="text-sm text-slate-500 text-center">
                    {product?.name ? `No view configuration found for ${product.name}` : "Product not loaded"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Bottom bar */}
      <footer className="flex h-16 items-center justify-between border-t border-slate-200 bg-white px-6 text-xs">
        <div className="flex flex-col">
          <span className="font-semibold">
            {product?.name || "Custom Product"}
          </span>
          <span className="text-slate-500">
            Color: <span className="font-medium">{productColor}</span>
            {isEditMode && (
              <span className="ml-3 text-amber-600">
                • Editing mode • 
              </span>
            )}
          </span>
        </div>
        <span className="text-slate-400">
          {isEditMode 
            ? "Editing existing design. Changes will update the original when you click 'Update Design'."
            : "Product color, text & design preview – drag, resize, and customize on the left. All sides are captured when you save."
          }
        </span>
      </footer>
    </div>
  );
}