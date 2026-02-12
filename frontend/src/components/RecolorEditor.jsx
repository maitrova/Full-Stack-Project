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
   Print Specs (inches)
   ========================= */
const API_URL = import.meta.env.VITE_API_URL;    
const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_URL || "";
console.log("RecolorEditor IMAGE_BASE_URL:", IMAGE_BASE_URL);

const PRINT_SPECS = {
  hoodie_basic: {
    front: { maxW: 12, maxH: 14 },
    pocket: { maxW: 8, maxH: 7 },
    sleeve: { maxW: 4, maxH: 4 },
    back: { maxW: 12, maxH: 20 },
  },
};
const DEFAULT_PRODUCT_KEY = "hoodie_basic";
/* =========================
   Default zones per view (dynamic now)
   ========================= */
const DEFAULT_ZONES_BY_VIEW = {
  front: ["front-full", "pocket"],
  back: ["back-full"],
  left: ["sleeve-left"],
  right: ["sleeve-right"],
};

/* =========================
   Defaults for known zones
   ========================= */
const DEFAULT_ZONE_LABELS = {
  "front-full": "Front",
  pocket: "Pocket",
  "back-full": "Back",
};

const DEFAULT_ZONE_TO_SPEC_KEY = {
  "front-full": "front",
  pocket: "pocket",
  "back-full": "back",
};
/* =========================
   Default fallback boundaries (Normalized 0..1)
   ========================= */
const FALLBACK_BOUNDARIES = {
  "front-full": { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.65 },
  pocket: { minX: 0.365, maxX: 0.635, minY: 0.67, maxY: 0.87 },
  "sleeve-left": { minX: 0.15, maxX: 0.3, minY: 0.18, maxY: 0.32 },
  "sleeve-right": { minX: 0.7, maxX: 0.85, minY: 0.18, maxY: 0.32 },
  "back-full": { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.75 },
};

const TEXT_BOUNDARIES = { minX: 0.15, maxX: 0.85, minY: 0.15, maxY: 0.85 };

/* =========================
   Zone -> spec key
   ========================= */
const ZONE_TO_SPEC_KEY = {
  "front-full": "front",
  pocket: "pocket",
  "sleeve-left": "sleeve",
  "sleeve-right": "sleeve",
  "back-full": "back",
};

const ZONE_LABELS = {
  "front-full": "Front",
  pocket: "Pocket",
  "sleeve-left": "Sleeve Left",
  "sleeve-right": "Sleeve Right",
  "back-full": "Back",
};

const CAL_ZONES_BY_VIEW = {
  front: ["front-full", "pocket"],
  back: ["back-full"],
};

/* =========================
   Helpers
   ========================= */


function normalizeViewFromLayer(layer) {
  const vc = String(layer?.viewCode || "").toLowerCase();
  const zone = String(layer?.zone || "").toLowerCase();

  // viewCode cases
  if (vc === "back") return "back";
  if (vc === "left" || vc === "sleeve-left") return "left";
  if (vc === "right" || vc === "sleeve-right") return "right";
  if (vc === "front") return "front";

  // zone fallback (VERY IMPORTANT if viewCode stays "front")
  if (zone === "sleeve-left") return "left";
  if (zone === "sleeve-right") return "right";
  if (zone.startsWith("back")) return "back";

  return "front";
}

function normalizeImageUrl(url) {
  if (!url) return url;

  // already absolute (http/https/protocol-relative/blob/data)
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    // ✅ DO NOT rewrite /api/outputs -> /outputs
    return url;
  }

  const base = (IMAGE_BASE_URL || window.location.origin).replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;

  // ✅ keep /api/outputs as-is (because ingress routes /api to backend)
  return `${base}${path}`;
}


function pointInBoundary(x, y, b) {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

// Decide which zone the point belongs to (prefer smaller zones like pocket if overlap)
function pickZoneForPoint(x, y, zones, boundaries) {
  const candidates = (zones || [])
    .map((z) => ({ z, b: boundaries?.[z] }))
    .filter((it) => it.b && pointInBoundary(x, y, it.b));

  if (!candidates.length) return null;

  // pick smallest area zone (pocket wins over front-full usually)
  candidates.sort((a, b) => {
    const areaA = (a.b.maxX - a.b.minX) * (a.b.maxY - a.b.minY);
    const areaB = (b.b.maxX - b.b.minX) * (b.b.maxY - b.b.minY);
    return areaA - areaB;
  });

  return candidates[0].z;
}

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
  // x,y are CENTER coordinates. Keep snapping to the closest "valid center edges"
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
function getBoundaryKeyForTextLayer(layer) {
  if (layer?.zone) return layer.zone;

  const viewCode = layer?.viewCode || "front";
  if (viewCode === "back") return "back-full";
  return "front-full";
}

function getBoundaryKeyForLayer(layer) {
  if (layer?.zone) return layer.zone;

  const viewCode = layer?.viewCode || "front";
  if (viewCode === "back") return "back-full";
  if (viewCode === "left") return "sleeve-left";
  if (viewCode === "right") return "sleeve-right";
  return "front-full";
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
    if (!src) return reject(new Error("loadImage: empty src"));

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);

    img.onerror = (e) => {
      // Convert browser Event -> readable error
      reject(new Error(`Failed to load image: ${src}`));
    };

    // cache-bust (optional, helps during updates)
    img.src = src;
  });
}


/* =========================
   LocalStorage persistence
   ========================= */
/* =========================
   DB persistence (API)
   ========================= */
async function fetchCalibration({ productKey, view, mockupUrl, maskUrl }) {
  const qs = new URLSearchParams({
    productKey,
    view,
    mockupUrl: mockupUrl || "",
    maskUrl: maskUrl || "",
  }).toString();

  const res = await fetch(`${API_URL}/mockup-calibrations?${qs}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Failed to load calibration");
  return json?.data || null;
}

async function upsertCalibration({ productKey, view, mockupUrl, maskUrl, payload }) {
  const res = await fetch(`${API_URL}/mockup-calibrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productKey, view, mockupUrl, maskUrl, payload }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Failed to save calibration");
  return json?.data || null;
}


/* =========================
   Measurement Overlay
   ========================= */
function MeasurementOverlay({ canvasSize, boundaries, specs, view, zonesList, calibratedConfig }) {
  if (!canvasSize || !boundaries || !specs) return null;

  const zonesToShow = zonesList || [];

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {zonesToShow.map((zoneKey) => {
        const b = boundaries[zoneKey];
        if (!b) return null;

        const spec = getZoneSpec(zoneKey, specs, calibratedConfig);
        if (!spec) return null;

        const left = `${b.minX * 100}%`;
        const top = `${b.minY * 100}%`;
        const width = `${(b.maxX - b.minX) * 100}%`;
        const height = `${(b.maxY - b.minY) * 100}%`;

        return (
          <div key={zoneKey} className="absolute" style={{ left, top, width, height }}>
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
              {spec.maxW} inches
            </div>

            <div
              className="absolute -left-12 top-1/2 -translate-y-1/2 text-[12px] font-medium"
              style={{ color: "rgba(30, 64, 175, 0.95)" }}
            >
              {spec.maxH} inches
            </div>

            <div
              className="absolute right-2 top-2 rounded px-2 py-1 text-[12px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.85)",
                color: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(59,130,246,0.4)",
              }}
            >
              {getZoneLabel(zoneKey, calibratedConfig)} • {spec.maxW} × {spec.maxH} in
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* =========================
   Calibration Overlay UI
   FIXES:
   ✅ Panel is now ABOVE drag layer (Save is clickable)
   ✅ Drag layer does NOT block panel clicks
   ========================= */
function CalibrationOverlay({
  view,
  specs,
  initialBoundaries,
  zonesList,
  calibratedConfig,
  onSave,
  onClose,
}) {
  const overlayRef = useRef(null);

  const [zones, setZones] = useState(() => zonesList || []);
  const [zoneMeta, setZoneMeta] = useState(() => calibratedConfig?.zoneMeta || {});
  const [activeZone, setActiveZone] = useState(() => (zonesList?.[0] || null));

  const [rects, setRects] = useState(() => {
    const out = {};
    (zonesList || []).forEach((z) => {
      out[z] = boundaryToRect(initialBoundaries[z] || FALLBACK_BOUNDARIES[z] || FALLBACK_BOUNDARIES["front-full"]);
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

      next[st.zoneKey] = r;
      return next;
    });
  };

  const onUp = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  const startDrag = (e, zoneKey, mode, handle = null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!overlayRef.current) return;
    const r = rects[zoneKey];
    if (!r) return;

    const bounds = overlayRef.current.getBoundingClientRect();

    dragRef.current = {
      zoneKey,
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...r },
      rectW: bounds.width,
      rectH: bounds.height,
    };

    setActiveZone(zoneKey);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const boundaryMap = useMemo(() => {
    const out = {};
    zones.forEach((z) => {
      out[z] = rectToBoundary(rects[z]);
    });
    return out;
  }, [rects, zones]);

  const exportJson = () => {
    const payload = {
      view,
      zones: boundaryMap,
      zoneOrder: zones,
      zoneMeta,
      updatedAt: new Date().toISOString(),
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    alert("Copied calibration JSON to clipboard ✅");
  };

  const saveNow = () => {
    const payload = {
      view,
      zones: boundaryMap,
      zoneOrder: zones,
      zoneMeta,
      updatedAt: new Date().toISOString(),
    };
    onSave(payload);
  };

  const addZone = () => {
    const key = (prompt("Zone key (unique) e.g. front-2 / logo-area") || "").trim();
    if (!key) return;

    if (zones.includes(key)) {
      alert("Zone key already exists.");
      return;
    }

    const label = (prompt("Zone label (shown in UI) e.g. Logo Area") || key).trim();

    const maxW = Number(prompt("Max Width (inches) e.g. 6") || "6");
    const maxH = Number(prompt("Max Height (inches) e.g. 6") || "6");

    // Default rect in center
    const r = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

    setZones((prev) => [...prev, key]);
     // placeholder to avoid lint confusion (remove)

    setRects((prev) => ({ ...prev, [key]: r }));
    setZoneMeta((prev) => ({
      ...prev,
      [key]: { label, maxW: isFinite(maxW) ? maxW : 6, maxH: isFinite(maxH) ? maxH : 6 },
    }));
    setActiveZone(key);
  };

  const deleteZone = (zoneKey) => {
    const ok = window.confirm(`Delete zone "${zoneKey}"? This cannot be undone.`);
    if (!ok) return;

    setZones((prev) => prev.filter((z) => z !== zoneKey));
    setRects((prev) => {
      const next = { ...prev };
      delete next[zoneKey];
      return next;
    });
    setZoneMeta((prev) => {
      const next = { ...prev };
      delete next[zoneKey];
      return next;
    });

    if (activeZone === zoneKey) {
      const remaining = zones.filter((z) => z !== zoneKey);
      setActiveZone(remaining[0] || null);
    }
  };

  const updateMeta = (zoneKey, patch) => {
    setZoneMeta((prev) => ({
      ...prev,
      [zoneKey]: { ...(prev[zoneKey] || {}), ...patch },
    }));
  };

  return (
    <div className="absolute inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Panel */}
      <div className="absolute top-3 left-3 z-[2000] bg-white rounded-lg shadow-lg border border-slate-200 w-[360px] pointer-events-auto">
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Calibration Mode • {view.toUpperCase()}
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
            type="button"
          >
            Close
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="text-xs text-slate-600">
            Manage zones for this view. Add/remove zones and adjust boundaries. Save once per mockup.
          </div>

          <div className="flex gap-2">
            <button
              onClick={addZone}
              className="flex-1 text-xs px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
              type="button"
            >
              + Add Zone
            </button>
            <button
              onClick={exportJson}
              className="text-xs px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
              type="button"
            >
              Copy JSON
            </button>
          </div>

          <div className="text-xs font-medium text-slate-800">Zones</div>
          <div className="max-h-[220px] overflow-auto space-y-2 pr-1">
            {zones.map((z) => {
              const isActive = z === activeZone;

              const label = getZoneLabel(z, { zoneMeta });
              const spec = getZoneSpec(z, specs, { zoneMeta });

              return (
                <div
                  key={z}
                  className={`rounded border p-2 ${isActive ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveZone(z)}
                      className="text-left flex-1"
                    >
                      <div className="text-xs font-semibold text-slate-900">{label}</div>
                      <div className="text-[11px] text-slate-600">{z}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteZone(z)}
                      className="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="text-[11px] text-slate-600">Label</div>
                      <input
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                        value={label}
                        onChange={(e) => updateMeta(z, { label: e.target.value })}
                      />
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-600">Size (in)</div>
                      <div className="flex gap-2">
                        <input
                          className="w-1/2 text-xs border border-slate-200 rounded px-2 py-1"
                          value={spec.maxW}
                          onChange={(e) => updateMeta(z, { maxW: Number(e.target.value || 0) })}
                        />
                        <input
                          className="w-1/2 text-xs border border-slate-200 rounded px-2 py-1"
                          value={spec.maxH}
                          onChange={(e) => updateMeta(z, { maxH: Number(e.target.value || 0) })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={saveNow}
            className="w-full text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            type="button"
          >
            Save Calibration
          </button>
        </div>
      </div>

      {/* Drag layer */}
      <div ref={overlayRef} className="absolute inset-0 z-[1000] pointer-events-auto">
        {zones.map((zoneKey) => {
          const r = rects[zoneKey];
          if (!r) return null;

          const isActive = zoneKey === activeZone;
          const spec = getZoneSpec(zoneKey, specs, { zoneMeta });

          return (
            <div
              key={zoneKey}
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
                onPointerDown={(e) => startDrag(e, zoneKey, "move")}
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
                style={{ background: "rgba(0,0,0,0.65)", color: "white" }}
              >
                {getZoneLabel(zoneKey, { zoneMeta })} • {spec.maxW}×{spec.maxH} in
              </div>

              {isActive && (
                <>
                  {["nw", "ne", "sw", "se"].map((h) => (
                    <div
                      key={h}
                      onPointerDown={(e) => startDrag(e, zoneKey, "resize", h)}
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


function getZonesForView(view, calibratedConfig) {
  return calibratedConfig?.zoneOrder?.length
    ? calibratedConfig.zoneOrder
    : (DEFAULT_ZONES_BY_VIEW[view] || []);
}


function getZoneLabel(zoneKey, calibratedConfig) {
  return (
    calibratedConfig?.zoneMeta?.[zoneKey]?.label ||
    DEFAULT_ZONE_LABELS[zoneKey] ||
    zoneKey
  );
}

function getZoneSpec(zoneKey, specs, calibratedConfig) {
  // If user-defined/custom spec exists, prefer it
  const m = calibratedConfig?.zoneMeta?.[zoneKey];
  if (m?.maxW && m?.maxH) return { maxW: Number(m.maxW), maxH: Number(m.maxH) };

  // fallback to your product print specs for known zones
  const specKey = DEFAULT_ZONE_TO_SPEC_KEY[zoneKey] || "front";
  return specs?.[specKey] || specs.front;
}

/* =========================
   RecolorEditor
   ========================= */
const RecolorEditor = forwardRef(function RecolorEditor(
  {
    mockupUrl,
    maskUrl,
    previewWidth = 800,
    productColor = "#FFFFFF",
    productKey = DEFAULT_PRODUCT_KEY,

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
    isAdmin,
    selectedView = "front", 
    
    // OPTIONAL: you can pass your tested front boundaries here if you want to force them
    // Example: { "front-full": {minX, minY, maxX, maxY} }
    calibrationOverride = null,
  },
  ref
) {
  const [renderer, setRenderer] = useState(null);
  const [canvasSize, setCanvasSize] = useState(null);

  const [showMeasurements, setShowMeasurements] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState(false);

  const specs = PRINT_SPECS[productKey] || PRINT_SPECS[DEFAULT_PRODUCT_KEY];

const activeView = selectedView;




  const [calibratedConfig, setCalibratedConfig] = useState(null);

useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const doc = await fetchCalibration({
        productKey,
        view: activeView,
        mockupUrl,
        maskUrl,
      });

      if (cancelled) return;

      // doc may already be in payload shape, but normalize safely
      if (doc?.zones) {
        setCalibratedConfig({
          view: doc.view || activeView,
          zones: doc.zones,
          zoneOrder: doc.zoneOrder || DEFAULT_ZONES_BY_VIEW[activeView] || [],
          zoneMeta: doc.zoneMeta || {},
          updatedAt: doc.updatedAtIso || doc.updatedAt || null,
        });
      } else {
        setCalibratedConfig(null);
      }
    } catch (e) {
      console.error("Load calibration failed:", e);
      setCalibratedConfig(null);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [productKey, activeView, mockupUrl, maskUrl]);
 

  const boundaries = useMemo(() => {
  const merged = { ...FALLBACK_BOUNDARIES };

  if (calibratedConfig?.zones) {
    Object.keys(calibratedConfig.zones).forEach((k) => (merged[k] = calibratedConfig.zones[k]));
  }

  if (calibrationOverride) {
    Object.keys(calibrationOverride).forEach((k) => (merged[k] = calibrationOverride[k]));
  }

  return merged;
}, [calibratedConfig, calibrationOverride]);

const zonesForActiveView = useMemo(() => {
  return getZonesForView(activeView, calibratedConfig);
}, [activeView, calibratedConfig]);
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

    const updateSize = () => {
      if (!renderer?.canvas) return;
      const rect = renderer.canvas.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    };
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
    if (!ctx) {
      console.error("Error drawing texture: 2D context not available");
      return;
    }

    ctx.clearRect(0, 0, w, h);

    /* -------------------------
       Draw TEXT layers
       ------------------------- */
    (textLayers || []).forEach((layer) => {
      if (!layer?.text) return;

      const px = (layer.x ?? 0.5) * w;
      const py = (layer.y ?? 0.5) * h;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((((layer.rotation || 0) * Math.PI) / 180) || 0);
      ctx.fillStyle = layer.color || "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const fontSize = layer.fontSize || 40;
      const fontFamily = layer.fontFamily || "Impact, sans-serif";
      ctx.font = `700 ${fontSize}px ${fontFamily}`;

      ctx.fillText(layer.text, 0, 0);
      ctx.restore();
    });

    /* -------------------------
       Draw IMAGE layers
       ------------------------- */
    if (imageLayers && imageLayers.length) {
      // Load images safely (one failure should NOT break all)
      const results = await Promise.allSettled(
      imageLayers.map((l) => {
        const url = l?.imageUrl;
        if (!url) return Promise.reject(new Error("Missing imageUrl"));
        return loadImage(normalizeImageUrl(url));
      })
    );


      // Log failures
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.warn(
            "Image load failed:",
            imageLayers[idx]?.imageUrl,
            r.reason
          );
        }
      });

      // Pair each successful img with its layer
      const loaded = results
        .map((r, idx) => ({ r, layer: imageLayers[idx] }))
        .filter((x) => x.r.status === "fulfilled")
        .map((x) => ({ img: x.r.value, layer: x.layer }));

      const updates = [];

      loaded.forEach(({ img, layer }) => {
        if (!img || !layer) return;

        const px = (layer.x ?? 0.5) * w;
        const py = (layer.y ?? 0.5) * h;

        const scale = layer.scale || 0.35;

        // Use canvasSize if available; otherwise fallback to w/h
        const baseCanvasW = canvasSize?.width || w;
        const baseCanvasH = canvasSize?.height || h;

        const targetWidthPx = baseCanvasW * scale;
        const imgRatio = img.width > 0 ? targetWidthPx / img.width : 1;

        const drawW = img.width * imgRatio;
        const drawH = img.height * imgRatio;

        const zoneKey = getBoundaryKeyForLayer(layer);
        const zoneBoundary = boundaries?.[zoneKey] || boundaries?.["front-full"] || FALLBACK_BOUNDARIES["front-full"];
        const spec = getZoneSpec(zoneKey, specs, calibratedConfig);

        const zonePx = getPrintableAreaPx(
          { width: baseCanvasW, height: baseCanvasH },
          zoneBoundary
        );

        const widthIn = inchesFromPx(drawW, zonePx.widthPx, spec.maxW);
        const heightIn = inchesFromPx(drawH, zonePx.heightPx, spec.maxH);

        const clampedScale = clampScaleToMaxInches({
          currentScale: scale,
          drawWpx: drawW,
          drawHpx: drawH,
          zoneWpx: zonePx.widthPx,
          zoneHpx: zonePx.heightPx,
          maxWIn: spec.maxW,
          maxHIn: spec.maxH,
        });

        updates.push({
          id: layer.id,
          patch: {
            renderedWidthPx: drawW,
            renderedHeightPx: drawH,
            renderedWidthInches: widthIn,
            renderedHeightInches: heightIn,
            printableAreaWidthInches: spec.maxW,
            printableAreaHeightInches: spec.maxH,
            zone: zoneKey, // ✅ important: this is what getBoundaryKeyForLayer reads
            zoneKey,       // optional (debug)
            ...(clampedScale < scale ? { scale: clampedScale } : {}),
          },
        });

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((((layer.rotation || 0) * Math.PI) / 180) || 0);
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

    const activeDesign = (designLayers || []).find((d) => d.id === activeDesignId);
    if (activeDesign && canvasSize) {
      onDesignRenderWidthChange?.(canvasSize.width * (activeDesign.scale || 0));
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
    specs,
    onDesignRenderWidthChange,
  ]);

  const handleBackgroundMouseDown = () => {
    setActiveDesignId(null);
    setActiveTextId(null);
  };

  const saveCalibratedZones = async (payload) => {
  try {
    const doc = await upsertCalibration({
      productKey,
      view: activeView,
      mockupUrl,
      maskUrl,
      payload,
    });

    // keep UI in same expected shape
    setCalibratedConfig({
      view: doc?.view || activeView,
      zones: doc?.zones || payload.zones,
      zoneOrder: doc?.zoneOrder || payload.zoneOrder || [],
      zoneMeta: doc?.zoneMeta || payload.zoneMeta || {},
      updatedAt: doc?.updatedAtIso || payload.updatedAt || null,
    });

    setCalibrationMode(false);
    alert("Calibration saved ✅");
  } catch (e) {
    console.error("Save calibration failed:", e);
    alert(e?.message || "Failed to save calibration");
  }
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

      {showMeasurements && canvasSize && (
        <MeasurementOverlay
  canvasSize={canvasSize}
  boundaries={boundaries}
  specs={specs}
  view={activeView}
  zonesList={zonesForActiveView}
  calibratedConfig={calibratedConfig}
/>
      )}

      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <button
          onClick={() => setShowMeasurements((s) => !s)}
          className="bg-white/85 hover:bg-white text-xs px-2 py-1 rounded border border-slate-300 shadow-sm"
          type="button"
        >
          {showMeasurements ? "Hide Measurements" : "Show Measurements"}
        </button>
        {isAdmin && (
        <button
          onClick={() => setCalibrationMode(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded shadow-sm"
          type="button"
        >
          Calibrate Zones
        </button>
        )}
      </div>
      

      {calibrationMode && canvasSize && (
  <CalibrationOverlay
    view={activeView}
    specs={specs}
    initialBoundaries={boundaries}
    zonesList={zonesForActiveView}
    calibratedConfig={calibratedConfig}
    onSave={saveCalibratedZones}
    onClose={() => setCalibrationMode(false)}
  />
)}


      {renderer && (
        <TextOverlay
  textLayers={textLayers}
  setTextLayers={setTextLayers}
  activeTextId={activeTextId}
  setActiveTextId={setActiveTextId}
  onAnyTextClick={() => setActiveDesignId(null)}
  canvasSize={canvasSize}
  boundaries={boundaries}
  zonesForView={zonesForActiveView}
  
/>

      )}

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
      boundaries={boundaries}
      zonesForView={zonesForActiveView}   // ✅ ADD THIS
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
   TEXT OVERLAY (unchanged)
   ========================= */
function TextOverlay({ 
  textLayers, 
  setTextLayers, 
  activeTextId, 
  setActiveTextId, 
  onAnyTextClick, 
  canvasSize,
  boundaries,
  zonesForView

}) {

  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);


function measureTextBoxPx({ text, fontSize, fontFamily }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${fontSize}px ${fontFamily || "Impact, sans-serif"}`;

  const w = ctx.measureText(text || "").width;
  const h = (fontSize || 20) * 1.2; // same height estimate you're using
  return { w, h };
}

// Binary search the largest fontSize that still fits inside boundary
function clampFontSizeToBoundary({
  desiredFontSize,
  minFontSize = 12,
  maxFontSize = 200,
  layer,
  canvasSize,
  boundary,
}) {
  if (!canvasSize || !boundary) return Math.max(minFontSize, Math.min(maxFontSize, desiredFontSize));

  const text = layer.text || "";
  const fontFamily = layer.fontFamily || "Impact, sans-serif";

  // If empty text, just clamp numeric range
  if (!text.trim()) return Math.max(minFontSize, Math.min(maxFontSize, desiredFontSize));

  // available space around the current center point
  const maxHalfWNorm = Math.min(layer.x - boundary.minX, boundary.maxX - layer.x);
  const maxHalfHNorm = Math.min(layer.y - boundary.minY, boundary.maxY - layer.y);

  const maxHalfWPx = maxHalfWNorm * canvasSize.width;
  const maxHalfHPx = maxHalfHNorm * canvasSize.height;

  // If already outside somehow, don’t explode
  if (maxHalfWPx <= 0 || maxHalfHPx <= 0) return minFontSize;

  let lo = minFontSize;
  let hi = Math.max(minFontSize, Math.min(maxFontSize, desiredFontSize));
  let best = minFontSize;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { w, h } = measureTextBoxPx({ text, fontSize: mid, fontFamily });

    // must fit fully inside boundary at current x,y
    const fits = (w / 2) <= maxHalfWPx && (h / 2) <= maxHalfHPx;

    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}


 const onPointerMove = useCallback(
  (e) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const { mode, id, startX, startY, rectWidth, rectHeight, initialLayer } = dragState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

   if (mode === "drag") {
  const nxRaw = initialLayer.x + dx / rectWidth;
  const nyRaw = initialLayer.y + dy / rectHeight;

  const textLayer = textLayers.find((l) => l.id === id);
  if (!textLayer || !canvasSize) return;

  // ✅ detect which zone the center is inside (pocket/front-full etc.)
  const currentZoneKey = getBoundaryKeyForTextLayer(textLayer);
  const detectedZone =
    pickZoneForPoint(nxRaw, nyRaw, zonesForView, boundaries) || currentZoneKey;

  const zoneKey = detectedZone;

  const b =
    boundaries?.[zoneKey] ||
    FALLBACK_BOUNDARIES?.[zoneKey] ||
    FALLBACK_BOUNDARIES["front-full"];

  // measure text size in px
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSize = textLayer.fontSize || 20;
  const fontFamily = textLayer.fontFamily || "Impact, sans-serif";
  ctx.font = `700 ${fontSize}px ${fontFamily}`;

  const text = textLayer.text || "";
  const textWidthPx = ctx.measureText(text).width || 0;
  const textHeightPx = (fontSize || 20) * 1.2;

  const halfW = (textWidthPx / canvasSize.width) / 2;
  const halfH = (textHeightPx / canvasSize.height) / 2;

  // clamp CENTER so the full text box stays inside boundary
  const constrainedX = Math.max(b.minX + halfW, Math.min(b.maxX - halfW, nxRaw));
  const constrainedY = Math.max(b.minY + halfH, Math.min(b.maxY - halfH, nyRaw));

  setTextLayers((prev) =>
    prev.map((layer) =>
      layer.id === id
        ? { ...layer, x: constrainedX, y: constrainedY, zone: zoneKey } // ✅ SAVE ZONE
        : layer
    )
  );

} else if (mode === "resize") {
  const layerNow = textLayers.find((l) => l.id === id);
  if (!layerNow || !canvasSize) return;

  let proposed = Math.max(12, Math.min(200, initialLayer.fontSize + (dx + dy) * 0.3));

  const zoneKey = getBoundaryKeyForTextLayer(layerNow);
  const b =
    boundaries?.[zoneKey] ||
    FALLBACK_BOUNDARIES?.[zoneKey] ||
    FALLBACK_BOUNDARIES["front-full"];

  // helper to check if a font size fits at current x/y inside boundary
  const fits = (fontSize) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontFamily = layerNow.fontFamily || "Impact, sans-serif";
    ctx.font = `700 ${fontSize}px ${fontFamily}`;

    const text = layerNow.text || "";
    const wPx = ctx.measureText(text).width || 0;
    const hPx = fontSize * 1.2;

    const halfW = (wPx / canvasSize.width) / 2;
    const halfH = (hPx / canvasSize.height) / 2;

    const x = layerNow.x ?? initialLayer.x ?? 0.5;
    const y = layerNow.y ?? initialLayer.y ?? 0.5;

    return (
      x - halfW >= b.minX &&
      x + halfW <= b.maxX &&
      y - halfH >= b.minY &&
      y + halfH <= b.maxY
    );
  };

  // clamp down until it fits
  while (proposed > 12 && !fits(proposed)) {
    proposed -= 1;
  }

  setTextLayers((prev) =>
    prev.map((layer) =>
      layer.id === id ? { ...layer, fontSize: proposed } : layer
    )
  );
}


  },
  [setTextLayers, textLayers, canvasSize, boundaries]
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
   FIX: constrain using design SIZE (not just center)
   ========================= */
function DesignOverlay({ layer, canvasSize, setDesignLayers, isActive, setActiveDesignId, disabled, boundaries, zonesForView }) {

  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const zoneCandidates = useMemo(() => {
    const uniqueKeys = new Set(zonesForView || []);
    if (layer?.zone) uniqueKeys.add(layer.zone);
    const inferred = getBoundaryKeyForLayer(layer);
    if (inferred) uniqueKeys.add(inferred);
    return Array.from(uniqueKeys);
  }, [zonesForView, layer?.zone, layer?.viewCode]);

  const onPointerMove = useCallback(
  (e) => {
    const st = dragStateRef.current;
    if (!st) return;

    const { id, startX, startY, rectWidth, rectHeight, initialLayer } = st;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // raw target center (NOT constrained yet)
    const nxRaw = initialLayer.x + dx / rectWidth;
    const nyRaw = initialLayer.y + dy / rectHeight;

    // current zone (fallback)
    const currentZoneKey = getBoundaryKeyForLayer(initialLayer);

    // ✅ Detect which zone the center is inside
    const zoneSource = zoneCandidates.length ? zoneCandidates : [currentZoneKey];
    const detectedZone =
      pickZoneForPoint(nxRaw, nyRaw, zoneSource, boundaries) || currentZoneKey;

    const zoneKey = detectedZone;

    const b =
      boundaries?.[zoneKey] ||
      FALLBACK_BOUNDARIES?.[zoneKey] ||
      FALLBACK_BOUNDARIES["front-full"];

    // design size in normalized units (center anchored)
    const scale = initialLayer.scale || 0.35;
    const aspect =
      (initialLayer.originalHeightPx / initialLayer.originalWidthPx) || 1;

    const baseWidth = canvasSize?.width || st.rectWidth || 0;
    const baseHeight = canvasSize?.height || st.rectHeight || 0;

    const widthPx = baseWidth * scale;
    const heightPx = widthPx * aspect;

    const halfW = baseWidth ? (widthPx / baseWidth) / 2 : 0;
    const halfH = baseHeight ? (heightPx / baseHeight) / 2 : 0;

    // clamp center so full rect stays in boundary
    let constrainedX = Math.max(b.minX + halfW, Math.min(b.maxX - halfW, nxRaw));
    let constrainedY = Math.max(b.minY + halfH, Math.min(b.maxY - halfH, nyRaw));

    // optional snap
    const snapped = snapToBoundaryCenter(constrainedX, constrainedY, b, halfW, halfH);
    constrainedX = snapped.x;
    constrainedY = snapped.y;

    // ✅ Save x,y AND zone
    setDesignLayers((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, x: constrainedX, y: constrainedY, zone: zoneKey } : d
      )
    );
  },
  [setDesignLayers, boundaries, canvasSize, zoneCandidates]
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
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  };

  const left = `${layer.x * 100}%`;
  const top = `${layer.y * 100}%`;

  const widthPx = canvasSize?.width ? canvasSize.width * layer.scale : 0;
  const heightPx = widthPx * ((layer.originalHeightPx / layer.originalWidthPx) || 1);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-10"
      style={{ touchAction: "none" }}
    >
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
          className={`overflow-hidden rounded-sm ${isActive ? "border-2 border-blue-500 bg-blue-50/20" : "border border-slate-300/50"}`}
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {layer.imageUrl && (
            <img
              src={normalizeImageUrl(layer.imageUrl)}
              alt="design"
              style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
            />
          )}
        </div>

        {isActive && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
            {layer.renderedWidthInches?.toFixed?.(1) || "?"}″ ×{" "}
            {layer.renderedHeightInches?.toFixed?.(1) || "?"}″{" "}
            (max {layer.printableAreaWidthInches || "?"}″ × {layer.printableAreaHeightInches || "?"}″)
          </div>
        )}
      </div>
    </div>
  );
}

export default RecolorEditor;


