import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Palette, Shirt } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProductBySlug, fetchProducts } from "../redux/slices/productsSlice.js";
import RecolorEditor from "./RecolorEditor.jsx";

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
    navigate(`/products/${product?.slug || "hoodie"}/customize`, {
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
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#f7f1e8_0%,#f4f5eb_48%,#ecf3d2_100%)] px-2 py-4 text-slate-950 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-lime-300/30 blur-3xl" />
      <div className="pointer-events-none absolute left-[42%] top-12 h-28 w-28 rounded-full border border-white/70 bg-white/30 shadow-xl backdrop-blur" />

      <div className="relative mx-auto grid max-w-[1240px] items-stretch gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:gap-5">
        <div className="floating-panel min-w-0 rounded-[1.35rem] border border-white/80 bg-[#fffdf8]/95 p-2.5 shadow-[0_25px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:rounded-[2rem] sm:p-4">
          <h1 className="mb-2 truncate text-xl font-black tracking-[-0.035em] sm:text-2xl">
            Customize <span className="text-orange-600">{product?.name || "your product"}</span>
          </h1>

          {productOptions.length > 0 && (
            <div className="mb-2">
              <div
                ref={productRailRef}
                onMouseEnter={() => { productRailPausedRef.current = true; }}
                onMouseLeave={() => { productRailPausedRef.current = false; }}
                onTouchStart={() => { productRailPausedRef.current = true; }}
                onTouchEnd={() => { productRailPausedRef.current = false; }}
                onFocus={() => { productRailPausedRef.current = true; }}
                onBlur={() => { productRailPausedRef.current = false; }}
                className="product-selector-rail flex gap-1 overflow-x-auto overscroll-contain rounded-xl border border-white/80 bg-white/55 p-1 shadow-inner backdrop-blur sm:rounded-2xl sm:p-1.5"
                aria-label="Scrollable customization products"
              >
                {[...productOptions, ...productOptions].map((option, index) => {
                  const front = option.views?.find((view) => view.code === "front") || option.views?.[0];
                  const thumbnail = front?.mockupUrl || option.image?.url || option.image || `/mockups/${option.slug}/front.png`;
                  const active = option.slug === product?.slug;
                  return (
                    <button
                      key={`${option.slug}-${index}`}
                      type="button"
                      onClick={() => selectProduct(option)}
                      className={`group flex w-[126px] shrink-0 items-center gap-1.5 rounded-xl border px-1.5 py-1 text-left transition hover:-translate-y-1 hover:shadow-lg sm:w-[138px] ${active ? "border-orange-500 bg-white shadow-md" : "border-white/80 bg-white/70 shadow-sm"}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        <img src={thumbnail} alt="" className="h-full w-full object-contain transition group-hover:scale-110" loading="lazy" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-black text-slate-900">{option.name}</span>
                        <span className={`block text-[9px] font-bold ${active ? "text-orange-600" : "text-slate-400"}`}>{active ? "Selected" : "Customize"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid h-[345px] min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-2 sm:h-[410px] sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-3">
            <div
              ref={designRailRef}
              onMouseEnter={() => { designRailPausedRef.current = true; }}
              onMouseLeave={() => { designRailPausedRef.current = false; }}
              onTouchStart={() => { designRailPausedRef.current = true; }}
              onTouchEnd={() => { designRailPausedRef.current = false; }}
              onFocus={() => { designRailPausedRef.current = true; }}
              onBlur={() => { designRailPausedRef.current = false; }}
              className="hero-design-rail relative overflow-x-hidden overflow-y-auto rounded-2xl border border-black/10 bg-slate-950 py-2 overscroll-contain"
              aria-label="Scrollable design previews"
            >
              <div className="absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-slate-950 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-slate-950 to-transparent" />
              {designs.length ? (
                <div className="flex flex-col items-center gap-2 px-1.5">
                  {[...designs, ...designs].map((design, index) => (
                    <button
                      type="button"
                      key={`${design.folder}-${design.filename}-${index}`}
                      onClick={() => previewDesign(design)}
                      className={`aspect-square w-full shrink-0 overflow-hidden rounded-xl border bg-white p-1.5 transition hover:scale-105 ${selectedDesign?.filename === design.filename ? "border-orange-400 ring-2 ring-orange-400/40" : "border-white/15"}`}
                      aria-label={`Preview ${design.filename}`}
                    >
                      <img src={assetUrl(design.url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/60">
                  <Palette size={24} /> {libraryLoading ? "Loading designs" : "Your design here"}
                </div>
              )}
            </div>

            <div
              ref={productPreviewRef}
              onPointerMove={tiltProductPreview}
              onPointerLeave={resetProductTilt}
              className="product-preview-stage relative flex min-w-0 flex-col overflow-hidden rounded-[1.4rem] bg-slate-50 shadow-[0_14px_35px_rgba(15,23,42,.12)]"
            >
              <div className="flex items-center justify-between gap-1 bg-white px-2 py-2 sm:gap-2 sm:px-3">
                <div className="flex items-center gap-2 text-sm font-black"><Shirt size={16} /> {product?.name || "Hoodie"}</div>
                <div className="flex items-center gap-2">
                  {(availableViews.length ? availableViews : [{ code: "front", label: "Front" }, { code: "back", label: "Back" }]).map((view) => (
                    <button key={view.code} type="button" onClick={() => setViewCode(view.code)} className={`rounded-full px-2 py-1 text-[9px] font-bold transition sm:px-3 sm:text-[10px] ${viewCode === view.code ? "bg-orange-500 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{view.label || view.code}</button>
                  ))}
                </div>
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#fff_0%,#eef2f7_75%)] p-2 sm:p-4">
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
                  <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-4 py-2 text-center text-xs font-bold text-white backdrop-blur">Choose a design from either side</div>
                )}
              </div>

            </div>
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((color) => {
                  const active = color.value.toLowerCase() === selectedColor.toLowerCase();
                  return (
                    <button key={color.value} type="button" onClick={() => setSelectedColor(color.value)} title={color.label} aria-label={`Use ${color.label}`} className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${active ? "border-orange-500 ring-2 ring-orange-200" : "border-white shadow-[0_0_0_1px_rgba(15,23,42,.18)]"}`} style={{ backgroundColor: color.value }} />
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={openCustomizer} className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-xs font-bold text-white transition hover:bg-orange-600 sm:w-auto">
              Customize this look <ArrowRight size={17} className="transition group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        <aside className="floating-panel floating-panel-delay relative min-w-0 flex flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-[#dbe8a6]/95 p-3 shadow-[0_28px_75px_rgba(62,78,20,0.2)] backdrop-blur sm:rounded-[2rem] sm:p-4">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border-[42px] border-white/25" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />

          <h2 className="relative text-2xl font-black tracking-[-0.04em]">Featured designs</h2>

          <div className="relative mt-3 grid h-[270px] grid-cols-[1.15fr_.85fr] grid-rows-2 gap-2 sm:h-[318px] sm:gap-2.5">
            {designs[0] ? (
              <button type="button" onClick={() => previewDesign(designs[0])} className={`floating-art-card group relative row-span-2 overflow-hidden rounded-[1.4rem] border p-4 text-left transition duration-300 hover:shadow-2xl ${selectedDesign?.filename === designs[0].filename ? "border-slate-950 bg-[#fff1dc] shadow-xl" : "border-white/80 bg-white/80 shadow-lg"}`}>
                <span className="absolute left-4 top-4 z-10 rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">Featured</span>
                <span className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">01</span>
                <img src={assetUrl(designs[0].url)} alt={designs[0].filename} className="h-full w-full object-contain pb-9 pt-5 transition duration-500 group-hover:scale-110 group-hover:-rotate-2" loading="lazy" />
                <span className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
                  <span><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{designs[0].folder || "Trending"}</span><span className="block text-xs font-black text-slate-900">Try this artwork</span></span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white transition group-hover:bg-orange-500"><ArrowRight size={14} /></span>
                </span>
              </button>
            ) : <div className="row-span-2 animate-pulse rounded-[1.4rem] bg-white/45" />}

            {designs.slice(1, 3).map((design, index) => (
              <button key={`${design.folder}-${design.filename}`} type="button" onClick={() => previewDesign(design)} className={`floating-art-card group relative overflow-hidden rounded-[1.2rem] border p-3 transition duration-300 hover:shadow-xl ${selectedDesign?.filename === design.filename ? "border-slate-950 bg-orange-100 shadow-lg" : "border-white/80 bg-white/75 shadow-md"}`} style={{ animationDelay: `${(index + 1) * 0.7}s` }}>
                <span className="absolute left-3 top-3 z-10 text-[9px] font-black text-slate-400">0{index + 2}</span>
                <img src={assetUrl(design.url)} alt={design.filename} className="h-full w-full object-contain transition duration-300 group-hover:scale-110" loading="lazy" />
                <span className="absolute inset-x-2 bottom-2 translate-y-10 rounded-lg bg-slate-950/90 px-2 py-1.5 text-center text-[9px] font-bold text-white transition group-hover:translate-y-0">Preview on product</span>
              </button>
            ))}
          </div>

          <button type="button" onClick={() => openCustomizer({ openLibrary: true })} className="group relative mt-3 overflow-hidden rounded-2xl border border-slate-950 bg-slate-950 p-1 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,.2)] transition hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(15,23,42,.3)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(249,115,22,.8),transparent_38%)] opacity-80 transition group-hover:scale-110" />
            <div className="relative flex items-center gap-2.5 rounded-[0.8rem] border border-white/15 px-3 py-2.5">
              <div className="flex -space-x-3">
                {designs.slice(6, 9).map((design) => <span key={`${design.folder}-${design.filename}`} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-slate-950 bg-white p-1"><img src={assetUrl(design.url)} alt="" className="h-full w-full object-contain" /></span>)}
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-950 bg-orange-500"><LockKeyhole size={14} /></span>
              </div>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black">See the full design library</span><span className="block text-xs text-white/65">Browse {libraryFolders.length || "all"} categories</span></span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-950"><ArrowRight size={16} /></span>
            </div>
          </button>

        </aside>
      </div>
      <style>{`
        .hero-design-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hero-design-rail::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .product-selector-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .product-selector-rail::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .floating-panel { animation: panelFloat 6s ease-in-out infinite; }
        .floating-panel-delay { animation-delay: -2.4s; }
        .floating-art-card { animation: artworkFloat 5s ease-in-out infinite; }
        .floating-art-card:hover, .floating-art-card:focus-visible { animation-play-state: paused; transform: translateY(-7px) scale(1.01); }
        .product-preview-stage { transform-style: preserve-3d; transform-origin: center; transition: transform .18s ease-out, box-shadow .3s ease; will-change: transform; }
        .product-preview-stage:hover, .product-preview-stage:focus-within { box-shadow: 0 20px 45px rgba(15,23,42,.16); }
        @keyframes panelFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes artworkFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-4px) rotate(.35deg); } }
        @media (prefers-reduced-motion: reduce) { .product-preview-stage, .floating-panel, .floating-art-card { transform: none !important; transition: none; animation: none; } }
      `}</style>
    </section>
  );
};

export default Hero;
