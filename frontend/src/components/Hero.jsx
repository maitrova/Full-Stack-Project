import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Palette, Shirt } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProductBySlug, fetchProducts } from "../redux/slices/productsSlice.js";
import RecolorEditor from "./RecolorEditor.jsx";
import { Button, SectionHeader, Skeleton, Swatch } from "./ui/index.js";

const API_URL = (import.meta.env.VITE_API_URL || "https://maitrova.in/backend").replace(/\/$/, "");
const IMAGE_URL = (import.meta.env.VITE_IMAGE_URL || API_URL).replace(/\/$/, "");
const FALLBACK_COLORS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#111827", label: "Black" },
  { value: "#1D4ED8", label: "Royal Blue" },
  { value: "#DC2626", label: "Red" },
  { value: "#16A34A", label: "Green" },
  { value: "#D97706", label: "Mustard" },
];

const assetUrl = (url) => {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${IMAGE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const isAvailable = (color) => color?.stock == null || Number(color.stock) > 0;

const Hero = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current: product, items: productItems } = useSelector((state) => state.products);
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [viewCode, setViewCode] = useState("front");
  const [designLayers, setDesignLayers] = useState([]);
  const [activeDesignId, setActiveDesignId] = useState(null);
  const [textLayers, setTextLayers] = useState([]);
  const [activeTextId, setActiveTextId] = useState(null);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const designRailRef = useRef(null);
  const designRailPausedRef = useRef(false);
  const productRailRef = useRef(null);
  const productRailPausedRef = useRef(false);
  const productPreviewRef = useRef(null);

  useEffect(() => {
    dispatch(fetchProductBySlug("hoodie"));
    dispatch(fetchProducts());
  }, [dispatch]);

  const productOptions = useMemo(() => {
    const source = Array.isArray(productItems) ? productItems : productItems?.data || [];
    // The public listing endpoint intentionally returns lightweight product
    // records without `views`; full mockup views are loaded after selection.
    return source.filter((item) => item?.slug);
  }, [productItems]);


  useEffect(() => {
    let cancelled = false;
    const loadDesigns = async () => {
      try {
        const folderResponse = await fetch(`${API_URL}/designuploads/folders`);
        if (!folderResponse.ok) throw new Error("Could not load design folders");
        const { folders = [] } = await folderResponse.json();
        if (!cancelled) setLibraryFolders(folders);
        const results = await Promise.all(
          folders.map(async (folder) => {
            const response = await fetch(`${API_URL}/designuploads/${encodeURIComponent(folder)}/files`);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.files || []).map((file) => ({ ...file, folder }));
          })
        );
        if (!cancelled) {
          const nextDesigns = results.flat().slice(0, 50);
          setDesigns(nextDesigns);
          setSelectedDesign(nextDesigns[0] || null);
        }
      } catch (error) {
        console.warn("Homepage design library unavailable:", error.message);
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    };
    loadDesigns();
    return () => { cancelled = true; };
  }, []);

  const colors = useMemo(() => {
    const configured = Array.isArray(product?.colors) && product.colors.length ? product.colors : FALLBACK_COLORS;
    return configured.filter(isAvailable);
  }, [product]);

  useEffect(() => {
    if (colors.length && !colors.some((color) => color.value.toLowerCase() === selectedColor.toLowerCase())) {
      setSelectedColor(colors[0].value);
    }
  }, [colors, selectedColor]);

  const frontView = product?.views?.find((view) => view.code === "front");
  const availableViews = product?.views?.filter((view) => view.code === "front" || view.code === "back") || [];
  const currentView = availableViews.find((view) => view.code === viewCode) || frontView;
  const mockupUrl = currentView?.mockupUrl || `/mockups/hoodie/${viewCode}.png`;
  const maskUrl = currentView?.maskUrl || `/masks/hoodie/${viewCode}_mask.png`;
  const selectedDesignUrl = assetUrl(selectedDesign?.url);

  useEffect(() => {
    if (!selectedDesignUrl) {
      setDesignLayers([]);
      setActiveDesignId(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const id = `homepage-design-${Date.now()}`;
      const width = image.naturalWidth || 600;
      const height = image.naturalHeight || 600;
      const scale = 0.28;
      const layer = {
        id,
        imageUrl: selectedDesignUrl,
        filename: selectedDesign?.filename || "Selected design",
        file: null,
        sourceFile: null,
        hasBgRemoved: false,
        x: 0.5,
        y: viewCode === "front" ? 0.45 : 0.47,
        zone: viewCode === "back" ? "back-full" : "front-full",
        viewCode,
        scale,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        originalWidthPx: width,
        originalHeightPx: height,
        renderedWidthPx: width * scale,
        renderedHeightPx: height * scale,
        displayWidthInches: width / 300,
        displayHeightInches: height / 300,
        printWidthInches: width / 300,
        printHeightInches: height / 300,
        renderedWidthInches: (width / 300) * scale,
        renderedHeightInches: (height / 300) * scale,
        isFromLibrary: true,
        crop: { widthRatio: 1, heightRatio: 1, leftRatio: 0, topRatio: 0, offsetX: 0, offsetY: 0 },
      };
      setDesignLayers((currentLayers) => {
        const existing = currentLayers.find((item) => item.imageUrl === selectedDesignUrl);
        if (!existing) {
          setActiveDesignId(id);
          return [layer];
        }
        const nextLayer = {
          ...existing,
          viewCode,
          zone: viewCode === "back" ? "back-full" : "front-full",
        };
        setActiveDesignId(existing.id);
        return [nextLayer];
      });
    };
    image.src = selectedDesignUrl;
    return () => { cancelled = true; };
  }, [selectedDesignUrl, selectedDesign?.filename, viewCode]);

  useEffect(() => {
    const rail = designRailRef.current;
    if (!rail || designs.length < 2) return undefined;

    let frameId;
    let previousTime = performance.now();
    const tick = (time) => {
      const elapsed = Math.min(40, time - previousTime);
      previousTime = time;

      if (!designRailPausedRef.current) {
        rail.scrollTop += elapsed * 0.018;
        const loopPoint = rail.scrollHeight / 2;
        if (rail.scrollTop >= loopPoint) rail.scrollTop -= loopPoint;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [designs]);

  useEffect(() => {
    const rail = productRailRef.current;
    if (!rail || productOptions.length < 2) return undefined;
    let frameId;
    let previousTime = performance.now();
    const tick = (time) => {
      const elapsed = Math.min(40, time - previousTime);
      previousTime = time;
      if (!productRailPausedRef.current) {
        rail.scrollLeft += elapsed * 0.022;
        const loopPoint = rail.scrollWidth / 2;
        if (rail.scrollLeft >= loopPoint) rail.scrollLeft -= loopPoint;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [productOptions]);

  const clearDesign = () => {
    setDesignLayers([]);
    setSelectedDesign(null);
    setActiveDesignId(null);
  };

  const selectProduct = (nextProduct) => {
    if (!nextProduct?.slug || nextProduct.slug === product?.slug) return;
    clearDesign();
    setViewCode("front");
    dispatch(fetchProductBySlug(nextProduct.slug));
  };

  const tiltProductPreview = (event) => {
    const stage = productPreviewRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
    const vertical = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
    stage.style.transform = `perspective(1100px) rotateX(${(-vertical * 4).toFixed(2)}deg) rotateY(${(horizontal * 5).toFixed(2)}deg) scale(0.995)`;
  };

  const resetProductTilt = () => {
    if (productPreviewRef.current) {
      productPreviewRef.current.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) scale(1)";
    }
  };

  const previewDesign = (design) => {
    setSelectedDesign(design);
  };

  const openCustomizer = ({ openLibrary = false } = {}) => {
    const params = new URLSearchParams();
    if (selectedDesign?.folder) {
      params.set("collection", selectedDesign.folder);
    }
    const queryString = params.toString();

    navigate(`/products/${product?.slug || "hoodie"}/customize${queryString ? `?${queryString}` : ""}`, {
      state: {
        homepageCustomization: {
          color: selectedColor,
          colorName: colors.find((color) => color.value.toLowerCase() === selectedColor.toLowerCase())?.label,
          design: selectedDesign ? {
            ...selectedDesign,
            imageUrl: selectedDesignUrl,
            layer: designLayers[0] || null,
            viewCode,
          } : null,
          openLibrary,
        },
      },
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <SectionHeader
        title="Design it live"
        actionLabel="Open customizer"
        onAction={() => openCustomizer()}
        className="mb-3 sm:mb-5"
      />

      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:gap-4">
        <div className="min-w-0 rounded-mt-card border border-mt-line bg-mt-surface p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-light text-mt-muted sm:text-base">Create apparel that’s uniquely yours.</p>
            <p className="truncate text-sm text-mt-text">
              Customizing <span className="font-medium">{product?.name || "your product"}</span>
            </p>
          </div>

          {productOptions.length > 0 && (
            <div className="mb-3">
              <div
                ref={productRailRef}
                onMouseEnter={() => { productRailPausedRef.current = true; }}
                onMouseLeave={() => { productRailPausedRef.current = false; }}
                onTouchStart={() => { productRailPausedRef.current = true; }}
                onTouchEnd={() => { productRailPausedRef.current = false; }}
                onFocus={() => { productRailPausedRef.current = true; }}
                onBlur={() => { productRailPausedRef.current = false; }}
                className="product-selector-rail flex gap-2 overflow-x-auto overscroll-contain"
                aria-label="Scrollable customization products"
              >
                {[...productOptions, ...productOptions].map((option, index) => {
                  const front = option.views?.find((view) => view.code === "front") || option.views?.[0];
                  const thumbnail = front?.mockupUrl || option.image?.url || option.image || `/mockups/${option.slug}/front.png`;
                  // The bundled files in /public/mockups are stored upside down; show them upright here.
                  const isBundledMockup = String(thumbnail).startsWith("/mockups/");
                  const active = option.slug === product?.slug;
                  return (
                    <button
                      key={`${option.slug}-${index}`}
                      type="button"
                      onClick={() => selectProduct(option)}
                      aria-pressed={active}
                      className={`group flex w-[132px] shrink-0 items-center gap-2 rounded-mt-btn border p-1.5 text-left transition-colors sm:w-[146px] ${active ? "border-mt-text bg-mt-surface-raised" : "border-mt-line hover:border-mt-line-strong"}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-mt-btn bg-mt-photo">
                        <img src={thumbnail} alt="" className={`h-full w-full object-contain transition-transform group-hover:scale-110 ${isBundledMockup ? "rotate-180" : ""}`} loading="lazy" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-mt-text">{option.name}</span>
                        <span className={`block text-[10px] ${active ? "text-mt-text" : "text-mt-subtle"}`}>{active ? "Selected" : "Customize"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid h-[345px] min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-2 sm:h-[420px] sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-3">
            <div
              ref={designRailRef}
              onMouseEnter={() => { designRailPausedRef.current = true; }}
              onMouseLeave={() => { designRailPausedRef.current = false; }}
              onTouchStart={() => { designRailPausedRef.current = true; }}
              onTouchEnd={() => { designRailPausedRef.current = false; }}
              onFocus={() => { designRailPausedRef.current = true; }}
              onBlur={() => { designRailPausedRef.current = false; }}
              className="hero-design-rail relative overflow-x-hidden overflow-y-auto rounded-mt-btn border border-mt-line bg-mt-header py-2 overscroll-contain"
              aria-label="Scrollable design previews"
            >
              <div className="pointer-events-none sticky top-0 z-10 -mb-10 h-10 bg-gradient-to-b from-mt-header to-transparent" />
              {designs.length ? (
                <div className="flex flex-col items-center gap-2 px-1.5">
                  {[...designs, ...designs].map((design, index) => (
                    <button
                      type="button"
                      key={`${design.folder}-${design.filename}-${index}`}
                      onClick={() => previewDesign(design)}
                      className={`aspect-square w-full shrink-0 overflow-hidden rounded-mt-btn border bg-mt-photo p-1.5 transition-transform hover:scale-105 ${selectedDesign?.filename === design.filename ? "border-mt-text ring-2 ring-mt-text/60" : "border-transparent"}`}
                      aria-label={`Preview ${design.filename}`}
                    >
                      <img src={assetUrl(design.url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center text-[10px] uppercase tracking-wider text-mt-subtle">
                  <Palette size={22} aria-hidden="true" /> {libraryLoading ? "Loading designs" : "Your design here"}
                </div>
              )}
            </div>

            <div
              ref={productPreviewRef}
              onPointerMove={tiltProductPreview}
              onPointerLeave={resetProductTilt}
              className="product-preview-stage relative flex min-w-0 flex-col overflow-hidden rounded-mt-btn border border-mt-line"
            >
              <div className="flex items-center justify-between gap-2 bg-mt-surface-raised px-2.5 py-2 sm:px-3">
                <div className="flex min-w-0 items-center gap-2 text-sm text-mt-text">
                  <Shirt size={16} aria-hidden="true" /> <span className="truncate">{product?.name || "Hoodie"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(availableViews.length ? availableViews : [{ code: "front", label: "Front" }, { code: "back", label: "Back" }]).map((view) => (
                    <button
                      key={view.code}
                      type="button"
                      onClick={() => setViewCode(view.code)}
                      aria-pressed={viewCode === view.code}
                      className={`h-8 rounded-mt-btn px-3 text-[11px] transition-colors ${viewCode === view.code ? "bg-mt-btn text-mt-btn-text" : "border border-mt-line-strong text-mt-muted hover:text-mt-text"}`}
                    >
                      {view.label || view.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#f4f4f5_0%,#d4d4d8_85%)] p-2 sm:p-4">
                <div className="min-w-0 w-full max-w-[620px] overflow-hidden [&_canvas]:max-w-full">
                  <RecolorEditor
                    mockupUrl={mockupUrl}
                    maskUrl={maskUrl}
                    previewWidth={400}
                    productColor={selectedColor}
                    textLayers={textLayers}
                    setTextLayers={setTextLayers}
                    activeTextId={activeTextId}
                    setActiveTextId={setActiveTextId}
                    onRemoveActiveText={() => {
                      setTextLayers((current) => current.filter((layer) => layer.id !== activeTextId));
                      setActiveTextId(null);
                    }}
                    designLayers={designLayers}
                    setDesignLayers={setDesignLayers}
                    activeDesignId={activeDesignId}
                    setActiveDesignId={setActiveDesignId}
                    onRemoveActiveDesign={clearDesign}
                    bgRemovalLoading={false}
                    isAdmin={false}
                    selectedView={viewCode}
                    zoneOptions={viewCode === "back" ? ["back-full"] : ["front-full", "pocket"]}
                    activeDesignZone={designLayers.find((layer) => layer.id === activeDesignId)?.zone || null}
                    showMeasurementsByDefault={false}
                  />
                </div>
                {!selectedDesign && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-mt-btn bg-black/80 px-4 py-2 text-center text-xs text-white backdrop-blur">
                    Choose a design from the side
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Swatch
              colors={colors}
              value={colors.find((color) => color.value.toLowerCase() === selectedColor.toLowerCase())?.value}
              onChange={setSelectedColor}
              size="md"
              label="Garment colour"
            />
            <Button onClick={() => openCustomizer()} arrow className="w-full sm:w-auto">
              Customize now
            </Button>
          </div>
        </div>

        <aside className="relative hidden min-w-0 flex-col rounded-mt-card border border-mt-line bg-mt-surface p-4 sm:p-5 lg:flex">
          <h3 className="text-lg font-medium text-mt-text">Featured designs</h3>
          <p className="mt-1 text-sm text-mt-muted">Tap a design to preview it on the product.</p>

          <div className="mt-4 grid h-[300px] grid-cols-[1.15fr_.85fr] grid-rows-2 gap-2.5 sm:h-[330px]">
            {designs[0] ? (
              <button
                type="button"
                onClick={() => previewDesign(designs[0])}
                className={`group relative row-span-2 overflow-hidden rounded-mt-btn border bg-mt-photo p-4 text-left transition-colors ${selectedDesign?.filename === designs[0].filename ? "border-mt-text ring-2 ring-mt-text/60" : "border-transparent"}`}
              >
                <span className="absolute left-3 top-3 z-10 rounded-mt-btn bg-black px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Featured</span>
                <img src={assetUrl(designs[0].url)} alt={designs[0].filename} className="h-full w-full object-contain pb-10 pt-6 transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <span className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between rounded-mt-btn bg-black/85 px-3 py-2 text-white backdrop-blur">
                  <span>
                    <span className="block text-[10px] uppercase tracking-wider text-white/60">{designs[0].folder || "Trending"}</span>
                    <span className="block text-xs">Try this artwork</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </button>
            ) : (
              <Skeleton className="row-span-2 h-full" />
            )}

            {designs.slice(1, 3).map((design) => (
              <button
                key={`${design.folder}-${design.filename}`}
                type="button"
                onClick={() => previewDesign(design)}
                className={`group relative overflow-hidden rounded-mt-btn border bg-mt-photo p-3 transition-colors ${selectedDesign?.filename === design.filename ? "border-mt-text ring-2 ring-mt-text/60" : "border-transparent"}`}
              >
                <img src={assetUrl(design.url)} alt={design.filename} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                <span className="absolute inset-x-2 bottom-2 translate-y-10 rounded-mt-btn bg-black/85 px-2 py-1.5 text-center text-[10px] text-white transition-transform group-hover:translate-y-0 group-focus-visible:translate-y-0">
                  Preview on product
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openCustomizer({ openLibrary: true })}
            className="group mt-4 flex items-center gap-3 rounded-mt-btn border border-mt-line bg-mt-surface-raised px-3 py-3 text-left transition-colors hover:border-mt-line-strong"
          >
            <span className="flex -space-x-3">
              {designs.slice(6, 9).map((design) => (
                <span key={`${design.folder}-${design.filename}`} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-mt-surface-raised bg-mt-photo p-1">
                  <img src={assetUrl(design.url)} alt="" className="h-full w-full object-contain" />
                </span>
              ))}
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-mt-surface-raised bg-mt-btn text-mt-btn-text">
                <LockKeyhole size={14} aria-hidden="true" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-mt-text">See the full design library</span>
              <span className="block text-xs text-mt-subtle">Browse {libraryFolders.length || "all"} categories</span>
            </span>
            <ArrowRight size={16} className="text-mt-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </aside>
      </div>
      <style>{`
        .hero-design-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hero-design-rail::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .product-selector-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .product-selector-rail::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .product-preview-stage { transform-style: preserve-3d; transform-origin: center; transition: transform .18s ease-out; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .product-preview-stage { transform: none !important; transition: none; } }
      `}</style>
    </section>
  );
};

export default Hero;
