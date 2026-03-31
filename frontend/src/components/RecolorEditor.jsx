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
import { motion } from "framer-motion";
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

function pointInBoundaryWithInset(x, y, b, insetRatio = 0.12) {
  if (!b) return false;
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const insetX = Math.min(width * insetRatio, width * 0.35);
  const insetY = Math.min(height * insetRatio, height * 0.35);

  return (
    x >= b.minX + insetX &&
    x <= b.maxX - insetX &&
    y >= b.minY + insetY &&
    y <= b.maxY - insetY
  );
}

function getBoundaryArea(boundary) {
  if (!boundary) return 0;
  return Math.max(0, boundary.maxX - boundary.minX) * Math.max(0, boundary.maxY - boundary.minY);
}

function rectFromCenter(x, y, halfW, halfH) {
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minY: y - halfH,
    maxY: y + halfH,
  };
}

function getRectArea(rect) {
  if (!rect) return 0;
  return Math.max(0, rect.maxX - rect.minX) * Math.max(0, rect.maxY - rect.minY);
}

function getRectBoundaryOverlapArea(rect, boundary) {
  if (!rect || !boundary) return 0;

  const overlapW = Math.max(
    0,
    Math.min(rect.maxX, boundary.maxX) - Math.max(rect.minX, boundary.minX)
  );
  const overlapH = Math.max(
    0,
    Math.min(rect.maxY, boundary.maxY) - Math.max(rect.minY, boundary.minY)
  );

  return overlapW * overlapH;
}

// Decide which zone a dragged layer belongs to by using its footprint, not only its center.
function pickZoneForLayerRect(
  x,
  y,
  halfW,
  halfH,
  zones,
  boundaries,
  preferredZone = null,
  options = {}
) {
  const {
    insetRatio = 0.12,
    switchMargin = 0.1,
    minOverlapRatio = 0.12,
    allowOversizedTarget = false,
  } = options;
  const rect = rectFromCenter(x, y, halfW, halfH);
  const rectArea = Math.max(getRectArea(rect), 1e-6);

  const candidates = (zones || [])
    .map((z) => ({ z, b: boundaries?.[z] }))
    .filter((it) => it.b && (allowOversizedTarget || boundaryCanFit(it.b, halfW, halfH)))
    .map(({ z, b }) => {
      const overlapArea = getRectBoundaryOverlapArea(rect, b);
      const overlapRatio = overlapArea / rectArea;
      const centerInside = pointInBoundary(x, y, b);
      const centerInset = pointInBoundaryWithInset(x, y, b, insetRatio);
      const sizeBonus = 1 / Math.max(getBoundaryArea(b), 1e-6);

      return {
        z,
        b,
        overlapArea,
        overlapRatio,
        centerInside,
        centerInset,
        score:
          overlapRatio +
          (centerInside ? 0.22 : 0) +
          (centerInset ? 0.12 : 0) +
          sizeBonus * 0.001,
      };
    })
    .filter((candidate) => candidate.overlapArea > 0 || candidate.centerInside);

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-6) return b.score - a.score;
    if (Math.abs(b.overlapRatio - a.overlapRatio) > 1e-6) return b.overlapRatio - a.overlapRatio;
    return getBoundaryArea(a.b) - getBoundaryArea(b.b);
  });

  const bestCandidate = candidates[0];

  if (preferredZone && bestCandidate?.z !== preferredZone) {
    const preferredCandidate = candidates.find((candidate) => candidate.z === preferredZone);
    if (preferredCandidate) {
      const bestHasClearIntent =
        bestCandidate.centerInset ||
        bestCandidate.overlapRatio >= minOverlapRatio ||
        bestCandidate.score >= preferredCandidate.score + switchMargin;

      if (!bestHasClearIntent || bestCandidate.score < preferredCandidate.score + switchMargin) {
        return preferredZone;
      }
    }
  }

  return bestCandidate.z;
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

function isClearlyBrokenBoundary(zoneKey, boundary, fallback) {
  if (!boundary) return true;

  const width = boundary.maxX - boundary.minX;
  const height = boundary.maxY - boundary.minY;
  if (width <= 0.02 || height <= 0.02) return true;

  if (zoneKey === "pocket") {
    const centerY = (boundary.minY + boundary.maxY) / 2;
    const fallbackCenterY = (fallback.minY + fallback.maxY) / 2;
    if (centerY > 0.82 || centerY < 0.48) return true;
    if (Math.abs(centerY - fallbackCenterY) > 0.12) return true;
  }

  if (zoneKey === "front-full") {
    const centerY = (boundary.minY + boundary.maxY) / 2;
    const fallbackCenterY = (fallback.minY + fallback.maxY) / 2;
    if (centerY > 0.62 || centerY < 0.28) return true;
    if (Math.abs(centerY - fallbackCenterY) > 0.12) return true;
  }

  return false;
}

function normalizeBoundary(boundary, fallback = FALLBACK_BOUNDARIES["front-full"], options = {}) {
  const { previewMeta = null, zoneKey = null } = options;
  if (!boundary || typeof boundary !== "object") return fallback;

  const previewWidth = Number(previewMeta?.width || 0);
  const previewHeight = Number(previewMeta?.height || 0);

  const maybeNormalizePixels = (value, axis) => {
    if (typeof value !== "number") return value;
    if (value <= 1) return value;
    const denom = axis === "x" ? previewWidth : previewHeight;
    return denom > 0 ? value / denom : value;
  };

  if (
    typeof boundary.minX === "number" &&
    typeof boundary.minY === "number" &&
    typeof boundary.maxX === "number" &&
    typeof boundary.maxY === "number"
  ) {
    const normalized = {
      minX: clamp01(maybeNormalizePixels(boundary.minX, "x")),
      minY: clamp01(maybeNormalizePixels(boundary.minY, "y")),
      maxX: clamp01(maybeNormalizePixels(boundary.maxX, "x")),
      maxY: clamp01(maybeNormalizePixels(boundary.maxY, "y")),
    };

    return isClearlyBrokenBoundary(zoneKey, normalized, fallback) ? fallback : normalized;
  }

  if (
    typeof boundary.left === "number" &&
    typeof boundary.top === "number" &&
    typeof boundary.width === "number" &&
    typeof boundary.height === "number"
  ) {
    const normalized = rectToBoundary({
      x: maybeNormalizePixels(boundary.left, "x"),
      y: maybeNormalizePixels(boundary.top, "y"),
      w: maybeNormalizePixels(boundary.width, "x"),
      h: maybeNormalizePixels(boundary.height, "y"),
    });
    return isClearlyBrokenBoundary(zoneKey, normalized, fallback) ? fallback : normalized;
  }

  if (
    typeof boundary.x === "number" &&
    typeof boundary.y === "number" &&
    typeof boundary.w === "number" &&
    typeof boundary.h === "number"
  ) {
    const normalized = rectToBoundary({
      x: maybeNormalizePixels(boundary.x, "x"),
      y: maybeNormalizePixels(boundary.y, "y"),
      w: maybeNormalizePixels(boundary.w, "x"),
      h: maybeNormalizePixels(boundary.h, "y"),
    });
    return isClearlyBrokenBoundary(zoneKey, normalized, fallback) ? fallback : normalized;
  }

  return fallback;
}

function normalizeZonesMap(zones, previewMeta = null) {
  if (!zones || typeof zones !== "object") return null;

  const normalized = {};
  Object.entries(zones).forEach(([key, value]) => {
    const fallback = FALLBACK_BOUNDARIES[key] || FALLBACK_BOUNDARIES["front-full"];
    normalized[key] = normalizeBoundary(value, fallback, { previewMeta, zoneKey: key });
  });
  return normalized;
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

function boundaryCanFit(boundary, halfW, halfH) {
  if (!boundary) return false;
  const width = Math.max(0, boundary.maxX - boundary.minX);
  const height = Math.max(0, boundary.maxY - boundary.minY);
  return halfW * 2 <= width + 1e-6 && halfH * 2 <= height + 1e-6;
}

function constrainCenterToBoundary(x, y, boundary, halfW, halfH) {
  if (!boundary) return { x, y };

  const width = Math.max(0, boundary.maxX - boundary.minX);
  const height = Math.max(0, boundary.maxY - boundary.minY);
  const effectiveHalfW = Math.min(halfW, width / 2);
  const effectiveHalfH = Math.min(halfH, height / 2);

  const minCX = boundary.minX + effectiveHalfW;
  const maxCX = boundary.maxX - effectiveHalfW;
  const minCY = boundary.minY + effectiveHalfH;
  const maxCY = boundary.maxY - effectiveHalfH;

  return {
    x: Math.max(minCX, Math.min(maxCX, x)),
    y: Math.max(minCY, Math.min(maxCY, y)),
  };
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

const imageLoadCache = new Map();

function loadImage(src) {
  if (!src) return Promise.reject(new Error("loadImage: empty src"));

  const cached = imageLoadCache.get(src);
  if (cached?.status === "fulfilled" && cached.image) {
    return Promise.resolve(cached.image);
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      imageLoadCache.set(src, { status: "fulfilled", image: img, promise: Promise.resolve(img) });
      resolve(img);
    };

    img.onerror = () => {
      imageLoadCache.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };

    img.src = src;
  });

  imageLoadCache.set(src, { status: "pending", promise });
  return promise;
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
function MeasurementOverlay({
  canvasSize,
  boundaries,
  specs,
  view,
  zonesList,
  calibratedConfig,
  compact = false,
}) {
  if (!canvasSize || !boundaries || !specs) return null;

  const zonesToShow = zonesList || [];

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {zonesToShow.map((zoneKey) => {
        const b = boundaries[zoneKey];
        if (!b) return null;

        const spec = getZoneSpec(zoneKey, specs, calibratedConfig);
        if (!spec) return null;
        const zoneWidth = b.maxX - b.minX;
        const zoneHeight = b.maxY - b.minY;
        const isTinyZone = compact || zoneWidth < 0.18 || zoneHeight < 0.18;
        const compactLabel = getZoneLabel(zoneKey, calibratedConfig);
        const left = `${b.minX * 100}%`;
        const top = `${b.minY * 100}%`;
        const width = `${(b.maxX - b.minX) * 100}%`;
        const height = `${(b.maxY - b.minY) * 100}%`;

        return (
          <div key={zoneKey} className="absolute" style={{ left, top, width, height }}>
            <div
              className="absolute inset-0"
              style={{
                border: compact
                  ? "1.5px solid rgba(59, 130, 246, 0.95)"
                  : "2px solid rgba(59, 130, 246, 0.95)",
                borderRadius: compact ? "12px" : "8px",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.15) inset",
              }}
            />

            {!isTinyZone && (
              <>
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
              </>
            )}

            <div
              className={`absolute rounded font-semibold ${compact ? "left-1.5 top-1.5 px-2 py-0.5 text-[10px]" : "right-2 top-2 px-2 py-1 text-[12px]"}`}
              style={{
                background: "rgba(255,255,255,0.85)",
                color: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(59,130,246,0.4)",
              }}
            >
              {compact
                ? compactLabel
                : `${getZoneLabel(zoneKey, calibratedConfig)} • ${spec.maxW} × ${spec.maxH} in`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MeasurementOverlayPlain({
  canvasSize,
  boundaries,
  specs,
  zonesList,
  calibratedConfig,
  compact = false,
}) {
  if (!canvasSize || !boundaries || !specs) return null;

  const zonesToShow = zonesList || [];

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {zonesToShow.map((zoneKey) => {
        const b = boundaries[zoneKey];
        if (!b) return null;

        const spec = getZoneSpec(zoneKey, specs, calibratedConfig);
        if (!spec) return null;

        const zoneWidth = b.maxX - b.minX;
        const zoneHeight = b.maxY - b.minY;
        const isTinyZone = compact || zoneWidth < 0.18 || zoneHeight < 0.18;
        const left = `${b.minX * 100}%`;
        const top = `${b.minY * 100}%`;
        const width = `${zoneWidth * 100}%`;
        const height = `${zoneHeight * 100}%`;

        return (
          <div key={zoneKey} className="absolute" style={{ left, top, width, height }}>
            <div
              className="absolute inset-0"
              style={{
                border: compact
                  ? "1.5px solid rgba(59, 130, 246, 0.95)"
                  : "2px solid rgba(59, 130, 246, 0.95)",
                borderRadius: compact ? "12px" : "8px",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.15) inset",
              }}
            />

            {!isTinyZone && (
              <>
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
              </>
            )}
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
  const panelRef = useRef(null);
  const dragPanelRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ x: 12, y: 12 });

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
  const activeRect = activeZone ? rects[activeZone] : null;

  const setZoneRect = (zoneKey, patch) => {
    setRects((prev) => {
      const current = prev[zoneKey];
      if (!current) return prev;

      const next = {
        x: typeof patch.x === "number" ? patch.x : current.x,
        y: typeof patch.y === "number" ? patch.y : current.y,
        w: typeof patch.w === "number" ? patch.w : current.w,
        h: typeof patch.h === "number" ? patch.h : current.h,
      };

      next.w = Math.max(0.04, Math.min(1, next.w));
      next.h = Math.max(0.04, Math.min(1, next.h));
      next.x = clamp01(Math.min(next.x, 1 - next.w));
      next.y = clamp01(Math.min(next.y, 1 - next.h));

      return { ...prev, [zoneKey]: next };
    });
  };

  const resetZoneToDefault = (zoneKey) => {
    const fallback = FALLBACK_BOUNDARIES[zoneKey] || FALLBACK_BOUNDARIES["front-full"];
    setRects((prev) => ({ ...prev, [zoneKey]: boundaryToRect(fallback) }));
    setActiveZone(zoneKey);
  };

  const resetAllZonesToDefaults = () => {
    const next = {};
    zones.forEach((zoneKey) => {
      const fallback = FALLBACK_BOUNDARIES[zoneKey] || FALLBACK_BOUNDARIES["front-full"];
      next[zoneKey] = boundaryToRect(fallback);
    });
    setRects(next);
  };

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
      previewMeta: {
        width: overlayRef.current?.clientWidth || null,
        height: overlayRef.current?.clientHeight || null,
      },
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
      previewMeta: {
        width: overlayRef.current?.clientWidth || null,
        height: overlayRef.current?.clientHeight || null,
      },
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


  const onPanelMove = (e) => {
  const st = dragPanelRef.current;
  if (!st) return;

  const dx = e.clientX - st.startX;
  const dy = e.clientY - st.startY;

  let newX = st.startLeft + dx;
  let newY = st.startTop + dy;

  const panel = panelRef.current;
  if (panel) {
    const rect = panel.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));
  }

  setPanelPos({ x: newX, y: newY });
};

const onPanelUp = () => {
  dragPanelRef.current = null;
  window.removeEventListener("pointermove", onPanelMove);
  window.removeEventListener("pointerup", onPanelUp);
};

const startPanelDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();

  dragPanelRef.current = {
    startX: e.clientX,
    startY: e.clientY,
    startLeft: panelPos.x,
    startTop: panelPos.y,
  };

  window.addEventListener("pointermove", onPanelMove);
  window.addEventListener("pointerup", onPanelUp);
};

  return (
    <div className="absolute inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Panel */}
<div
  ref={panelRef}
  className="absolute z-[2000] w-[min(92vw,360px)] bg-white rounded-lg shadow-lg border border-slate-200 pointer-events-auto"
  style={{
    left: panelPos.x,
    top: panelPos.y,
  }}
>
        <div
  onPointerDown={startPanelDrag}
  className="px-3 py-2 border-b border-slate-200 flex items-center justify-between cursor-move bg-slate-50"
>

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

          <div className="flex gap-2">
            <button
              onClick={resetAllZonesToDefaults}
              className="flex-1 text-xs px-3 py-2 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
              type="button"
            >
              Reset View
            </button>
            <button
              onClick={() => activeZone && resetZoneToDefault(activeZone)}
              disabled={!activeZone}
              className="flex-1 text-xs px-3 py-2 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              type="button"
            >
              Reset Active
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

          {activeZone && activeRect && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-800">
                  Active Zone: {getZoneLabel(activeZone, { zoneMeta })}
                </div>
                <div className="text-[10px] text-slate-500">Values are % of preview</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">
                  X
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(activeRect.x * 100)}
                    onChange={(e) => setZoneRect(activeZone, { x: Number(e.target.value || 0) / 100 })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Y
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(activeRect.y * 100)}
                    onChange={(e) => setZoneRect(activeZone, { y: Number(e.target.value || 0) / 100 })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Width
                  <input
                    type="number"
                    min="4"
                    max="100"
                    step="1"
                    value={Math.round(activeRect.w * 100)}
                    onChange={(e) => setZoneRect(activeZone, { w: Number(e.target.value || 4) / 100 })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Height
                  <input
                    type="number"
                    min="4"
                    max="100"
                    step="1"
                    value={Math.round(activeRect.h * 100)}
                    onChange={(e) => setZoneRect(activeZone, { h: Number(e.target.value || 4) / 100 })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
              </div>
            </div>
          )}

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

function normalizeImageLayerToBoundary(
  layer,
  canvasSize,
  boundaries,
  specs,
  calibratedConfig,
  options = {}
) {
  if (!layer?.imageUrl || !canvasSize?.width || !canvasSize?.height) return layer;

  const zoneKey = getBoundaryKeyForLayer(layer);
  const boundary =
    boundaries?.[zoneKey] ||
    boundaries?.["front-full"] ||
    FALLBACK_BOUNDARIES["front-full"];
  const spec = getZoneSpec(zoneKey, specs, calibratedConfig);

  const boundaryWidth = Math.max(0.02, boundary.maxX - boundary.minX);
  const boundaryHeight = Math.max(0.02, boundary.maxY - boundary.minY);

  let scaleX = layer.scaleX ?? layer.scale ?? 0.35;
  let scaleY = layer.scaleY ?? layer.scale ?? 0.35;

  scaleX = Math.max(0.02, Math.min(scaleX, boundaryWidth));
  scaleY = Math.max(0.02, Math.min(scaleY, boundaryHeight));

  let x =
    typeof layer.x === "number"
      ? layer.x
      : (boundary.minX + boundary.maxX) / 2;
  let y =
    typeof layer.y === "number"
      ? layer.y
      : (boundary.minY + boundary.maxY) / 2;

  const constrained = constrainCenterToBoundary(x, y, boundary, scaleX / 2, scaleY / 2);
  x = constrained.x;
  y = constrained.y;

  let renderedWidthPx = canvasSize.width * scaleX;
  let renderedHeightPx = canvasSize.height * scaleY;
  const zonePx = getPrintableAreaPx(canvasSize, boundary);
  let renderedWidthInches = inchesFromPx(renderedWidthPx, zonePx.widthPx, spec.maxW);
  let renderedHeightInches = inchesFromPx(renderedHeightPx, zonePx.heightPx, spec.maxH);

  if (renderedWidthInches > spec.maxW + 1e-6 && renderedWidthInches > 0) {
    scaleX *= spec.maxW / renderedWidthInches;
  }
  if (renderedHeightInches > spec.maxH + 1e-6 && renderedHeightInches > 0) {
    scaleY *= spec.maxH / renderedHeightInches;
  }

  scaleX = Math.max(0.02, Math.min(scaleX, boundaryWidth));
  scaleY = Math.max(0.02, Math.min(scaleY, boundaryHeight));

  const reconstrained = constrainCenterToBoundary(x, y, boundary, scaleX / 2, scaleY / 2);
  x = reconstrained.x;
  y = reconstrained.y;

  renderedWidthPx = canvasSize.width * scaleX;
  renderedHeightPx = canvasSize.height * scaleY;
  renderedWidthInches = inchesFromPx(renderedWidthPx, zonePx.widthPx, spec.maxW);
  renderedHeightInches = inchesFromPx(renderedHeightPx, zonePx.heightPx, spec.maxH);

  const changed =
    Math.abs((layer.x ?? 0) - x) > 1e-4 ||
    Math.abs((layer.y ?? 0) - y) > 1e-4 ||
    Math.abs((layer.scaleX ?? layer.scale ?? 0.35) - scaleX) > 1e-4 ||
    Math.abs((layer.scaleY ?? layer.scale ?? 0.35) - scaleY) > 1e-4 ||
    layer.zone !== zoneKey ||
    Math.abs((layer.renderedWidthPx ?? 0) - renderedWidthPx) > 0.5 ||
    Math.abs((layer.renderedHeightPx ?? 0) - renderedHeightPx) > 0.5;

  if (!changed) return layer;

  return {
    ...layer,
    x,
    y,
    zone: zoneKey,
    scaleX,
    scaleY,
    scale: Math.min(scaleX, scaleY),
    renderedWidthPx,
    renderedHeightPx,
    renderedWidthInches,
    renderedHeightInches,
    printableAreaWidthInches: spec.maxW,
    printableAreaHeightInches: spec.maxH,
  };
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
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const designRenderSeqRef = useRef(0);
  const [renderer, setRenderer] = useState(null);
  const [canvasSize, setCanvasSize] = useState(null);
  const [renderCanvasSize, setRenderCanvasSize] = useState(null);
  const [canvasFrame, setCanvasFrame] = useState(null);
  const [dragTargetZoneKey, setDragTargetZoneKey] = useState(null);
  const [designInteractionActive, setDesignInteractionActive] = useState(false);
  const effectiveCanvasWidth = canvasSize?.width || previewWidth || 800;
  const isCompactUI = effectiveCanvasWidth < 460;
  const showMeasurementsByDefault = true;

  const [showMeasurements, setShowMeasurements] = useState(showMeasurementsByDefault);
  const [calibrationMode, setCalibrationMode] = useState(false);

  useEffect(() => {
    setShowMeasurements(showMeasurementsByDefault);
  }, [showMeasurementsByDefault, mockupUrl, maskUrl, selectedView]);

  useEffect(() => {
    if (!activeDesignId) {
      setDragTargetZoneKey(null);
    }
  }, [activeDesignId]);

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
        const normalizedZones = normalizeZonesMap(doc.zones, doc.previewMeta || null);
        setCalibratedConfig({
          view: doc.view || activeView,
          zones: normalizedZones || doc.zones,
          zoneOrder: doc.zoneOrder || DEFAULT_ZONES_BY_VIEW[activeView] || [],
          zoneMeta: doc.zoneMeta || {},
          previewMeta: doc.previewMeta || null,
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
    Object.keys(calibratedConfig.zones).forEach((k) => {
      const fallback = FALLBACK_BOUNDARIES[k] || FALLBACK_BOUNDARIES["front-full"];
      merged[k] = normalizeBoundary(calibratedConfig.zones[k], fallback, {
        previewMeta: calibratedConfig.previewMeta || null,
        zoneKey: k,
      });
    });
  }

  if (calibrationOverride) {
    Object.keys(calibrationOverride).forEach((k) => {
      const fallback = FALLBACK_BOUNDARIES[k] || FALLBACK_BOUNDARIES["front-full"];
      merged[k] = normalizeBoundary(calibrationOverride[k], fallback, {
        zoneKey: k,
      });
    });
  }

  return merged;
}, [calibratedConfig, calibrationOverride]);

const zonesForActiveView = useMemo(() => {
  return getZonesForView(activeView, calibratedConfig);
}, [activeView, calibratedConfig]);

  const activeDesign = useMemo(
    () => (designLayers || []).find((layer) => layer.id === activeDesignId) || null,
    [designLayers, activeDesignId]
  );

  const moveActiveDesignToZone = useCallback(
    (zoneKey) => {
      if (!activeDesign || !canvasSize || !zoneKey) return;

      const boundary =
        boundaries?.[zoneKey] ||
        FALLBACK_BOUNDARIES?.[zoneKey] ||
        FALLBACK_BOUNDARIES["front-full"];

      const centeredLayer = normalizeImageLayerToBoundary(
        {
          ...activeDesign,
          zone: zoneKey,
          x: (boundary.minX + boundary.maxX) / 2,
          y: (boundary.minY + boundary.maxY) / 2,
        },
        canvasSize,
        boundaries,
        specs,
        calibratedConfig,
        { snapToEdges: false }
      );

      setDragTargetZoneKey(zoneKey);
      setDesignLayers((prev) =>
        prev.map((layer) => (layer.id === activeDesign.id ? { ...layer, ...centeredLayer } : layer))
      );
      setActiveDesignId(activeDesign.id);
    },
    [activeDesign, canvasSize, boundaries, specs, calibratedConfig, setDesignLayers, setActiveDesignId]
  );

  useEffect(() => {
    if (!canvasSize || !Array.isArray(designLayers) || designLayers.length === 0) return;

    let changed = false;
    const nextLayers = designLayers.map((layer) => {
      if (!layer?.imageUrl) return layer;
      const normalized = normalizeImageLayerToBoundary(
        layer,
        canvasSize,
        boundaries,
        specs,
        calibratedConfig,
        { snapToEdges: false }
      );
      if (normalized !== layer) changed = true;
      return normalized;
    });

    if (changed) {
      setDesignLayers(nextLayers);
    }
  }, [canvasSize, designLayers, setDesignLayers, boundaries, specs, calibratedConfig]);

  const handleRendererReady = useCallback((instance) => {
    setRenderer(instance || null);
    if (instance?.canvas) {
      setRenderCanvasSize({ width: instance.canvas.width, height: instance.canvas.height });
    } else {
      setRenderCanvasSize(null);
    }
  }, []);

  useEffect(() => {
    if (!renderer?.canvas) return;

    let animationFrameId = null;

    const updateSize = () => {
      if (!renderer?.canvas || !stageRef.current) return;
      const rect = renderer.canvas.getBoundingClientRect();
      const stageRect = stageRef.current.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
      setCanvasFrame({
        left: rect.left - stageRect.left,
        top: rect.top - stageRect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    const scheduleUpdate = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateSize);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleUpdate();
          })
        : null;

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    resizeObserver?.observe(renderer.canvas);
    resizeObserver?.observe(stageRef.current);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [renderer]);

  useImperativeHandle(
    ref,
    () => ({
      async capturePreview() {
        if (!renderer?.canvas) return null;
        try {
          const glCanvas = renderer.canvas;
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = glCanvas.width;
          previewCanvas.height = glCanvas.height;

          const ctx = previewCanvas.getContext("2d");
          if (!ctx) {
            return glCanvas.toDataURL("image/jpeg", 0.7);
          }

          ctx.drawImage(glCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

          (textLayers || []).forEach((layer) => {
            if (!layer?.text) return;

            const px = (layer.x ?? 0.5) * previewCanvas.width;
            const py = (layer.y ?? 0.5) * previewCanvas.height;
            const scaleX = layer.scaleX ?? 1;
            const scaleY = layer.scaleY ?? 1;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate((((layer.rotation || 0) * Math.PI) / 180) || 0);
            ctx.scale(scaleX, scaleY);
            ctx.fillStyle = layer.color || "#000000";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `700 ${layer.fontSize || 40}px ${layer.fontFamily || "Impact, sans-serif"}`;
            ctx.fillText(layer.text, 0, 0);
            ctx.restore();
          });

          const imageLayers = (designLayers || []).filter((layer) => !!layer?.imageUrl);
          if (imageLayers.length) {
            const results = await Promise.allSettled(
              imageLayers.map((layer) => loadImage(normalizeImageUrl(layer.imageUrl)))
            );

            results.forEach((result, index) => {
              if (result.status !== "fulfilled") {
                console.warn("Preview image load failed:", imageLayers[index]?.imageUrl, result.reason);
                return;
              }

              const layer = imageLayers[index];
              const img = result.value;
              const legacyScale = layer.scale ?? 0.35;
              const scaleX = layer.scaleX ?? legacyScale;
              const scaleY = layer.scaleY ?? legacyScale;
              const drawW = previewCanvas.width * scaleX;
              const drawH = previewCanvas.height * scaleY;
              const px = (layer.x ?? 0.5) * previewCanvas.width;
              const py = (layer.y ?? 0.5) * previewCanvas.height;

              ctx.save();
              ctx.translate(px, py);
              ctx.rotate((((layer.rotation || 0) * Math.PI) / 180) || 0);
              ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
              ctx.restore();
            });
          }

          return previewCanvas.toDataURL("image/jpeg", 0.82);
        } catch (e) {
          console.error("Failed to capture preview", e);
          return null;
        }
      },
    }),
    [renderer, textLayers, designLayers]
  );

  useEffect(() => {
    if (!renderer?.canvas) return;
    if (!canvasSize) return;

    const renderSeq = ++designRenderSeqRef.current;

    const glCanvas = renderer.canvas;
    const w = glCanvas.width;
    const h = glCanvas.height;
    if (!w || !h) return;

    const hasText = textLayers?.some((l) => l.text && l.text.trim().length > 0);
    // Design images are rendered by the interactive overlay layer below.
    // If we also paint them into the composited texture here, each design appears twice.
    const imageLayers = [];
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

      if (cancelled || designRenderSeqRef.current !== renderSeq) return;

      // Log failures
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.warn("Image load failed:", imageLayers[idx]?.imageUrl, r.reason);
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

        // Use the renderer canvas dimensions for texture drawing so
        // mobile and desktop keep the same visual scale for a given layer size.
        const baseCanvasW = w;
        const baseCanvasH = h;

        // ✅ Legacy fallback: still supports old "scale"
        const legacyScale = layer.scale ?? 0.35;
        const scaleX = layer.scaleX ?? legacyScale;
        const scaleY = layer.scaleY ?? legacyScale;

        // ✅ Independent draw size from canvas dims
        let drawW = baseCanvasW * scaleX;
        let drawH = baseCanvasH * scaleY;

        const zoneKey = getBoundaryKeyForLayer(layer);
        const zoneBoundary =
          boundaries?.[zoneKey] ||
          boundaries?.["front-full"] ||
          FALLBACK_BOUNDARIES["front-full"];

        const spec = getZoneSpec(zoneKey, specs, calibratedConfig);

        const zonePx = getPrintableAreaPx(
          { width: baseCanvasW, height: baseCanvasH },
          zoneBoundary
        );

        // Inches using axis-aware draw sizes
        let widthIn = inchesFromPx(drawW, zonePx.widthPx, spec.maxW);
        let heightIn = inchesFromPx(drawH, zonePx.heightPx, spec.maxH);

        // ✅ Clamp EACH axis to max inches (only shrink)
        let clampedScaleX = scaleX;
        let clampedScaleY = scaleY;

        if (widthIn > spec.maxW + 1e-6 && widthIn > 0) {
          clampedScaleX = scaleX * (spec.maxW / widthIn);
        }
        if (heightIn > spec.maxH + 1e-6 && heightIn > 0) {
          clampedScaleY = scaleY * (spec.maxH / heightIn);
        }

        // Recompute draw sizes after clamping
        if (clampedScaleX !== scaleX) drawW = baseCanvasW * clampedScaleX;
        if (clampedScaleY !== scaleY) drawH = baseCanvasH * clampedScaleY;

        // Recompute inches after clamping (for accurate tooltip/UI)
        widthIn = inchesFromPx(drawW, zonePx.widthPx, spec.maxW);
        heightIn = inchesFromPx(drawH, zonePx.heightPx, spec.maxH);

        updates.push({
          id: layer.id,
          patch: {
            renderedWidthPx: drawW,
            renderedHeightPx: drawH,
            renderedWidthInches: widthIn,
            renderedHeightInches: heightIn,
            printableAreaWidthInches: spec.maxW,
            printableAreaHeightInches: spec.maxH,
            zone: zoneKey,
            zoneKey,
            ...(
              (clampedScaleX !== scaleX || clampedScaleY !== scaleY)
                ? {
                    scaleX: clampedScaleX,
                    scaleY: clampedScaleY,
                    // keep legacy scale usable until migration
                    scale: Math.min(clampedScaleX, clampedScaleY),
                  }
                : {}
            ),
          },
        });

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((((layer.rotation || 0) * Math.PI) / 180) || 0);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      });

      if (cancelled || designRenderSeqRef.current !== renderSeq) return;

      if (updates.length) {
        setDesignLayers((prev) =>
          {
            let hasMeaningfulChange = false;
            const updatesById = new Map(updates.map((entry) => [entry.id, entry.patch]));

            const nextLayers = prev.map((layer) => {
              const patch = updatesById.get(layer.id);
              if (!patch) return layer;

              const nextLayer = { ...layer, ...patch };
              const changed =
                Math.abs((nextLayer.renderedWidthPx ?? 0) - (layer.renderedWidthPx ?? 0)) > 0.5 ||
                Math.abs((nextLayer.renderedHeightPx ?? 0) - (layer.renderedHeightPx ?? 0)) > 0.5 ||
                Math.abs((nextLayer.renderedWidthInches ?? 0) - (layer.renderedWidthInches ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.renderedHeightInches ?? 0) - (layer.renderedHeightInches ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.printableAreaWidthInches ?? 0) - (layer.printableAreaWidthInches ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.printableAreaHeightInches ?? 0) - (layer.printableAreaHeightInches ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.scaleX ?? nextLayer.scale ?? 0) - (layer.scaleX ?? layer.scale ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.scaleY ?? nextLayer.scale ?? 0) - (layer.scaleY ?? layer.scale ?? 0)) > 1e-4 ||
                Math.abs((nextLayer.scale ?? 0) - (layer.scale ?? 0)) > 1e-4 ||
                (nextLayer.zone || null) !== (layer.zone || null) ||
                (nextLayer.zoneKey || null) !== (layer.zoneKey || null);

              if (!changed) return layer;
              hasMeaningfulChange = true;
              return nextLayer;
            });

            return hasMeaningfulChange ? nextLayers : prev;
          }
        );
      }
    }

    if (cancelled || designRenderSeqRef.current !== renderSeq) return;

    renderer.updateDesignTexture(offscreen);
    renderer.render(productColor);

    const activeDesign = (designLayers || []).find((d) => d.id === activeDesignId);
    if (activeDesign && canvasSize) {
      // ✅ prefer scaleX while supporting legacy scale
      const legacy = activeDesign.scale ?? 0;
      const sx = activeDesign.scaleX ?? legacy;
      onDesignRenderWidthChange?.(canvasSize.width * sx);
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
  if (designRenderSeqRef.current === renderSeq) {
    designRenderSeqRef.current += 1;
  }
};

    
  }, [
    renderer,
    canvasSize,
    textLayers,
    designLayers,
    designInteractionActive,
    productColor,
    activeDesignId,
    setDesignLayers,
    boundaries,
    specs,
    onDesignRenderWidthChange,
  ]);

  const handleBackgroundPointerDown = (e) => {
    if (e.target !== e.currentTarget) return;
    setDragTargetZoneKey(null);
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
    <div
      ref={rootRef}
      className={`w-full h-full ${isCompactUI ? "flex flex-col gap-2" : "relative"}`}
      style={{ touchAction: isCompactUI ? "pan-y" : "none" }}
      onPointerDown={handleBackgroundPointerDown}
    >
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl bg-white/90 px-2 py-2 shadow-sm">
        <button
          onClick={() => setShowMeasurements((s) => !s)}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
          type="button"
        >
          {showMeasurements ? "Hide Measurements" : "Show Measurements"}
        </button>
        {isAdmin && (
          <button
            onClick={() => setCalibrationMode(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white shadow-sm hover:bg-blue-700"
            type="button"
          >
            Calibrate Zones
          </button>
        )}
      </div>
      <div
        ref={stageRef}
        className="relative"
        style={{ touchAction: isCompactUI ? "pan-y" : "none" }}
      >
      <CanvasRenderer
        mockupUrl={mockupUrl}
        maskUrl={maskUrl}
        previewWidth={previewWidth}
        productColor={productColor}
        onRendererReady={handleRendererReady}
      />

      {canvasFrame && (
        <div
          className="absolute"
          style={{
            left: `${canvasFrame.left}px`,
            top: `${canvasFrame.top}px`,
            width: `${canvasFrame.width}px`,
            height: `${canvasFrame.height}px`,
          }}
        >
          {showMeasurements && canvasSize && (
            <MeasurementOverlayPlain
              canvasSize={canvasSize}
              boundaries={boundaries}
              specs={specs}
              zonesList={zonesForActiveView}
              calibratedConfig={calibratedConfig}
              compact={false}
            />
          )}

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
          specs={specs}
          calibratedConfig={calibratedConfig}
        />
      )}

      {renderer &&
        canvasSize &&
        (designLayers || []).map((layer) => (
          <DesignOverlay
            key={`${layer.id}:${layer.imageUrl || ""}`}
            layer={layer}
            canvasSize={canvasSize}
            renderCanvasSize={renderCanvasSize}
            compact={isCompactUI}
            setDesignLayers={setDesignLayers}
            isActive={layer.id === activeDesignId}
            setActiveDesignId={setActiveDesignId}
            disabled={bgRemovalLoading}
            boundaries={boundaries}
            zonesForView={zonesForActiveView}
            specs={specs}
            calibratedConfig={calibratedConfig}
            setDragTargetZoneKey={setDragTargetZoneKey}
            setDesignInteractionActive={setDesignInteractionActive}
          />
        ))}
      </div>
      )}


      {bgRemovalLoading && (
        <div className="pointer-events-none absolute inset-0 bg-white/40 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded shadow-md">
            <div className="text-sm text-slate-700">Removing background...</div>
            <div className="text-xs text-slate-500 mt-1">Please wait</div>
          </div>
        </div>
      )}
      </div>
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
  zonesForView,
  specs,
  calibratedConfig,
}) {

  function buildTextMeasurementPatch(layer, overrides = {}) {
    const targetLayer = { ...layer, ...overrides };
    if (!targetLayer || !canvasSize) return null;

    const zoneKey = targetLayer.zone || getBoundaryKeyForTextLayer(targetLayer);
    const boundary =
      boundaries?.[zoneKey] ||
      FALLBACK_BOUNDARIES?.[zoneKey] ||
      FALLBACK_BOUNDARIES["front-full"];

    const zonePx = getPrintableAreaPx(canvasSize, boundary);
    const spec = getZoneSpec(zoneKey, specs, calibratedConfig);

    const fontSize = targetLayer.fontSize || 20;
    const fontFamily = targetLayer.fontFamily || "Impact, sans-serif";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const text = targetLayer.text || "";
    const scaleX = targetLayer.scaleX ?? 1;
    const scaleY = targetLayer.scaleY ?? 1;
    const textWidthPx = (ctx.measureText(text).width || 0) * scaleX;
    const textHeightPx = (fontSize || 20) * 1.2 * scaleY;

    const renderedWidthInches = inchesFromPx(textWidthPx, zonePx.widthPx, spec?.maxW);
    const renderedHeightInches = inchesFromPx(textHeightPx, zonePx.heightPx, spec?.maxH);

    return {
      renderedWidthPx: textWidthPx,
      renderedHeightPx: textHeightPx,
      renderedWidthInches,
      renderedHeightInches,
      printableAreaWidthInches: spec?.maxW || 0,
      printableAreaHeightInches: spec?.maxH || 0,
      zone: zoneKey,
      zoneKey,
    };
  }

  const formatInches = (value) =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "?";

  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);
  const designMoveRafRef = useRef(null);
  const pendingDesignEventRef = useRef(null);
  const textMoveRafRef = useRef(null);
  const pendingTextEventRef = useRef(null);


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
  const scaleX = layer.scaleX ?? 1;
  const scaleY = layer.scaleY ?? 1;

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
    const fits = ((w * scaleX) / 2) <= maxHalfWPx && ((h * scaleY) / 2) <= maxHalfHPx;

    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

  function normalizeTextLayerToBoundary(layer, overrides = {}) {
    const targetLayer = { ...layer, ...overrides };
    if (!targetLayer || !canvasSize) return layer;
    const canvasReady = canvasSize.width >= 200 && canvasSize.height >= 200;

    // Avoid shrinking a fresh text layer against a transient tiny canvas.
    // Wait for a real measured editor size, then apply the intended initial fit.
    if (!canvasReady && !targetLayer.initialTextSized) {
      return layer;
    }

    const zoneKey = targetLayer.zone || getBoundaryKeyForTextLayer(targetLayer);
    const boundary =
      boundaries?.[zoneKey] ||
      FALLBACK_BOUNDARIES?.[zoneKey] ||
      FALLBACK_BOUNDARIES["front-full"];
    const zonePx = getPrintableAreaPx(canvasSize, boundary);
    const spec = getZoneSpec(zoneKey, specs, calibratedConfig);

    let initialScaleX = targetLayer.scaleX ?? 1;
    let initialScaleY = targetLayer.scaleY ?? 1;
    let resolvedFontSize = targetLayer.fontSize || 20;

    const didApplyInitialTarget =
      canvasReady &&
      !targetLayer.initialTextSized &&
      targetLayer.initialTargetWidthInches &&
      targetLayer.initialTargetHeightInches;

    if (
      canvasReady &&
      !targetLayer.initialTextSized &&
      targetLayer.initialTargetWidthInches &&
      targetLayer.initialTargetHeightInches
    ) {
      resolvedFontSize = Math.max(
        72,
        Math.min(160, Number(targetLayer.initialBaseFontSize || targetLayer.fontSize || 120))
      );
      const initialMeasure = measureTextBoxPx({
        text: targetLayer.text || "",
        fontSize: resolvedFontSize,
        fontFamily: targetLayer.fontFamily,
      });

      const desiredWidthPx =
        (Number(targetLayer.initialTargetWidthInches || 0) / Math.max(spec?.maxW || 1, 1e-6)) *
        zonePx.widthPx;
      const desiredHeightPx =
        (Number(targetLayer.initialTargetHeightInches || 0) / Math.max(spec?.maxH || 1, 1e-6)) *
        zonePx.heightPx;

      if (initialMeasure.w > 0 && desiredWidthPx > 0) {
        initialScaleX = desiredWidthPx / initialMeasure.w;
      }
      if (initialMeasure.h > 0 && desiredHeightPx > 0) {
        initialScaleY = desiredHeightPx / initialMeasure.h;
      }
    }

    const normalizedX =
      typeof targetLayer.x === "number"
        ? targetLayer.x
        : (boundary.minX + boundary.maxX) / 2;
    const normalizedY =
      typeof targetLayer.y === "number"
        ? targetLayer.y
        : (boundary.minY + boundary.maxY) / 2;

    if (!didApplyInitialTarget) {
      resolvedFontSize = clampFontSizeToBoundary({
        desiredFontSize: targetLayer.fontSize || 20,
        layer: {
          ...targetLayer,
          x: normalizedX,
          y: normalizedY,
          scaleX: initialScaleX,
          scaleY: initialScaleY,
        },
        canvasSize,
        boundary,
      });
    }

    const { w, h } = measureTextBoxPx({
      text: targetLayer.text || "",
      fontSize: resolvedFontSize,
      fontFamily: targetLayer.fontFamily,
    });

    const availableWidthPx =
      Math.max(0, Math.min(normalizedX - boundary.minX, boundary.maxX - normalizedX)) *
      2 *
      canvasSize.width;
    const availableHeightPx =
      Math.max(0, Math.min(normalizedY - boundary.minY, boundary.maxY - normalizedY)) *
      2 *
      canvasSize.height;

    const rawScaleX = initialScaleX;
    const rawScaleY = initialScaleY;
    const maxScaleX = w > 0 ? Math.max(0.2, availableWidthPx / w) : 5;
    const maxScaleY = h > 0 ? Math.max(0.2, availableHeightPx / h) : 5;
    const scaleX = Math.max(0.2, Math.min(5, rawScaleX, maxScaleX));
    const scaleY = Math.max(0.2, Math.min(5, rawScaleY, maxScaleY));

    const halfW = ((w * scaleX) / canvasSize.width) / 2;
    const halfH = ((h * scaleY) / canvasSize.height) / 2;
    const constrained = constrainCenterToBoundary(
      normalizedX,
      normalizedY,
      boundary,
      halfW,
      halfH
    );

    const measurementPatch =
      buildTextMeasurementPatch(targetLayer, {
        x: constrained.x,
        y: constrained.y,
        fontSize: resolvedFontSize,
        scaleX,
        scaleY,
        zone: zoneKey,
      }) || {};

    const nextLayer = {
      ...targetLayer,
      x: constrained.x,
      y: constrained.y,
      zone: zoneKey,
      fontSize: resolvedFontSize,
      scaleX,
      scaleY,
      scale: Math.min(scaleX, scaleY),
      initialTextSized: Boolean(targetLayer.initialTextSized || didApplyInitialTarget),
      initialBaseFontSize: targetLayer.initialBaseFontSize,
      initialTargetWidthInches: targetLayer.initialTargetWidthInches,
      initialTargetHeightInches: targetLayer.initialTargetHeightInches,
      ...measurementPatch,
    };

    const unchanged =
      nextLayer.x === layer.x &&
      nextLayer.y === layer.y &&
      nextLayer.zone === layer.zone &&
      nextLayer.fontSize === layer.fontSize &&
      nextLayer.scaleX === (layer.scaleX ?? 1) &&
      nextLayer.scaleY === (layer.scaleY ?? 1) &&
      nextLayer.initialTextSized === layer.initialTextSized &&
      nextLayer.renderedWidthPx === layer.renderedWidthPx &&
      nextLayer.renderedHeightPx === layer.renderedHeightPx &&
      nextLayer.renderedWidthInches === layer.renderedWidthInches &&
      nextLayer.renderedHeightInches === layer.renderedHeightInches;

    return unchanged ? layer : nextLayer;
  }

  useEffect(() => {
    if (!canvasSize || !Array.isArray(textLayers) || textLayers.length === 0) return;
    if (canvasSize.width < 200 || canvasSize.height < 200) return;

    let changed = false;
    const nextLayers = textLayers.map((layer) => {
      const normalized = normalizeTextLayerToBoundary(layer);
      if (normalized !== layer) changed = true;
      return normalized;
    });

    if (changed) {
      setTextLayers(nextLayers);
    }
  }, [canvasSize, textLayers, setTextLayers, boundaries, specs, calibratedConfig]);


  const handlePointerMove = useCallback(
    (e) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { mode, id, startX, startY, rectWidth, rectHeight, initialLayer, handle } = dragState;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (mode === "drag") {
        const nxRaw = initialLayer.x + dx / rectWidth;
        const nyRaw = initialLayer.y + dy / rectHeight;

        const textLayer = textLayers.find((l) => l.id === id);
        if (!textLayer || !canvasSize) return;

        const currentZoneKey = getBoundaryKeyForTextLayer(textLayer);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const fontSize = textLayer.fontSize || 20;
        const fontFamily = textLayer.fontFamily || "Impact, sans-serif";
        ctx.font = `700 ${fontSize}px ${fontFamily}`;

        const text = textLayer.text || "";
        const sx = textLayer.scaleX ?? 1;
        const sy = textLayer.scaleY ?? 1;

        const textWidthPx = (ctx.measureText(text).width || 0) * sx;
        const textHeightPx = (fontSize || 20) * 1.2 * sy;

        const halfW = (textWidthPx / canvasSize.width) / 2;
        const halfH = (textHeightPx / canvasSize.height) / 2;

        const zoneSource = (zonesForView || []).length ? zonesForView : [currentZoneKey];
        const allowedZones = zoneSource.length ? zoneSource : [currentZoneKey];
        const detectedFittingZone =
          pickZoneForLayerRect(nxRaw, nyRaw, halfW, halfH, allowedZones, boundaries, currentZoneKey, {
            insetRatio: 0.1,
            switchMargin: 0.08,
            minOverlapRatio: 0.1,
          }) || currentZoneKey;
        const safeBoundary =
          boundaries?.[detectedFittingZone] ||
          FALLBACK_BOUNDARIES?.[detectedFittingZone] ||
          FALLBACK_BOUNDARIES["front-full"];
        const constrained = constrainCenterToBoundary(nxRaw, nyRaw, safeBoundary, halfW, halfH);
        const constrainedX = constrained.x;
        const constrainedY = constrained.y;

        const measurementPatch =
          normalizeTextLayerToBoundary(textLayer, {
            x: constrainedX,
            y: constrainedY,
            zone: detectedFittingZone,
          });

        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id
              ? measurementPatch
              : layer
          )
        );
      } else if (mode === "resize") {
        const layerNow = textLayers.find((l) => l.id === id);
        if (!layerNow || !canvasSize) return;

        const baseScaleX = initialLayer.scaleX ?? 1;
        const baseScaleY = initialLayer.scaleY ?? 1;

        const kx = 1 / rectWidth;
        const ky = 1 / rectHeight;

        let nextScaleX = baseScaleX;
        let nextScaleY = baseScaleY;

        if (handle === "right") nextScaleX = baseScaleX + dx * kx;
        if (handle === "left") nextScaleX = baseScaleX - dx * kx;

        const verticalResizeBoost = 1.8;
        if (handle === "bottom") nextScaleY = baseScaleY + dy * ky * verticalResizeBoost;
        if (handle === "top") nextScaleY = baseScaleY - dy * ky * verticalResizeBoost;

        nextScaleX = Math.max(0.2, Math.min(5, nextScaleX));
        nextScaleY = Math.max(0.2, Math.min(5, nextScaleY));

        const zoneKeyForResize = layerNow.zone || getBoundaryKeyForTextLayer(layerNow);
        const measurementPatchResize = normalizeTextLayerToBoundary(layerNow, {
          scaleX: nextScaleX,
          scaleY: nextScaleY,
          zone: zoneKeyForResize,
        });

        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id
              ? measurementPatchResize
              : layer
          )
        );
      }
    },
    [setTextLayers, textLayers, canvasSize, boundaries, zonesForView, buildTextMeasurementPatch]
  );

  const onPointerMove = useCallback(
    (e) => {
      pendingTextEventRef.current = e;
      if (textMoveRafRef.current) return;

      textMoveRafRef.current = requestAnimationFrame(() => {
        textMoveRafRef.current = null;
        const event = pendingTextEventRef.current;
        pendingTextEventRef.current = null;
        if (event) {
          handlePointerMove(event);
        }
      });
    },
    [handlePointerMove]
  );


  const onPointerUp = useCallback(() => {
    dragStateRef.current = null;
    if (textMoveRafRef.current) {
      cancelAnimationFrame(textMoveRafRef.current);
      textMoveRafRef.current = null;
    }
    pendingTextEventRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e, id, mode, handle = null) => {
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
      handle, // ✅ added for resize direction
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
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    return () => {
      if (textMoveRafRef.current) {
        cancelAnimationFrame(textMoveRafRef.current);
        textMoveRafRef.current = null;
      }
      pendingTextEventRef.current = null;
    };
  }, []);

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20" style={{ touchAction: "none" }}>
      {(textLayers || []).map((layer) => {
        const isActive = layer.id === activeTextId;
        const left = `${layer.x * 100}%`;
        const top = `${layer.y * 100}%`;
        const sx = layer.scaleX ?? 1;
        const sy = layer.scaleY ?? 1;
        const boxWidthPx = Math.max(1, layer.renderedWidthPx || 0);
        const boxHeightPx = Math.max(1, layer.renderedHeightPx || 0);
        const formattedWidth = formatInches(layer.renderedWidthInches);
        const formattedHeight = formatInches(layer.renderedHeightInches);
        const formattedMaxW = formatInches(layer.printableAreaWidthInches);
        const formattedMaxH = formatInches(layer.printableAreaHeightInches);
        return (
          <motion.div
            key={layer.id}
            initial={false}
            animate={{
              left,
              top,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
            }}
            transition={{ type: "spring", stiffness: 450, damping: 45 }}
            className="pointer-events-auto absolute"
            style={{ touchAction: "none", cursor: "move" }}
            onPointerDown={(e) => startDrag(e, layer.id, "drag")}
          >
            <div
              className={`relative border ${isActive ? "border-blue-500 bg-blue-50/30" : "border-transparent"} bg-transparent rounded`}
              style={{
                willChange: "transform",
                cursor: "move",
                userSelect: "none",
                width: `${boxWidthPx}px`,
                height: `${boxHeightPx}px`,
              }}
            >
              <div
                className="absolute left-1/2 top-1/2 whitespace-nowrap"
                style={{
                  fontFamily: layer.fontFamily,
                  fontSize: layer.fontSize,
                  fontWeight: 700,
                  color: layer.color,
                  lineHeight: 1.2,
                  transform: `translate(-50%, -50%) scale(${sx}, ${sy})`,
                  transformOrigin: "center center",
                }}
              >
                {layer.text || " "}
              </div>

              {isActive && (
  <>
                {/* X handles */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={(e) => startDrag(e, layer.id, "resize", "left")}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={(e) => startDrag(e, layer.id, "resize", "right")}
                />

                {/* Y handles */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -top-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                  style={{ cursor: "ns-resize" }}
                  onPointerDown={(e) => startDrag(e, layer.id, "resize", "top")}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                  style={{ cursor: "ns-resize" }}
                  onPointerDown={(e) => startDrag(e, layer.id, "resize", "bottom")}
                />
              </>
              )}
            </div>
            {isActive && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                {formattedWidth}″ × {formattedHeight}″ (max {formattedMaxW}″ × {formattedMaxH}″)
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* =========================
   DESIGN OVERLAY (IMAGES)
   FIX: constrain using design SIZE (not just center)
   ========================= */
function DesignOverlay({
  layer,
  canvasSize,
  renderCanvasSize,
  compact = false,
  setDesignLayers,
  isActive,
  setActiveDesignId,
  disabled,
  boundaries,
  zonesForView,
  specs,
  calibratedConfig,
  setDragTargetZoneKey,
  setDesignInteractionActive,
}) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);
  const designMoveRafRef = useRef(null);
  const pendingDesignEventRef = useRef(null);
  const latestLayerRef = useRef(layer);
  const [isInteracting, setIsInteracting] = useState(false);
  const [previewLayer, setPreviewLayer] = useState(null);

  useEffect(() => {
    if (!isInteracting) {
      latestLayerRef.current = layer;
      setPreviewLayer(null);
    }
  }, [layer, isInteracting]);

  const zoneCandidates = useMemo(() => {
    const uniqueKeys = new Set(zonesForView || []);
    if (layer?.zone) uniqueKeys.add(layer.zone);
    const inferred = getBoundaryKeyForLayer(layer);
    if (inferred) uniqueKeys.add(inferred);
    return Array.from(uniqueKeys);
  }, [zonesForView, layer?.zone, layer?.viewCode]);

  const handlePointerMove = useCallback(
    (e) => {
      const st = dragStateRef.current;
      if (!st) return;

      const { id, startX, startY, rectWidth, rectHeight, initialLayer, mode, handle } = st;

      const dxPx = e.clientX - startX;
      const dyPx = e.clientY - startY;

      const baseW = canvasSize?.width || rectWidth || 0;
      const baseH = canvasSize?.height || rectHeight || 0;

      const liveLayer = latestLayerRef.current || initialLayer;
      const currentZoneKey = liveLayer?.zone || getBoundaryKeyForLayer(initialLayer);

      const getBoundaryForZone = (zoneKey) =>
        boundaries?.[zoneKey] ||
        FALLBACK_BOUNDARIES?.[zoneKey] ||
        FALLBACK_BOUNDARIES["front-full"];

      if (mode === "move") {
        const nxRaw = (initialLayer.x ?? 0.5) + dxPx / rectWidth;
        const nyRaw = (initialLayer.y ?? 0.5) + dyPx / rectHeight;

        const zoneSource = zoneCandidates.length ? zoneCandidates : [currentZoneKey];
        const zoneSwitchInsetRatio = compact ? 0.08 : 0.06;

        const legacyScale = liveLayer.scale ?? initialLayer.scale ?? 0.35;
        const scaleX = liveLayer.scaleX ?? legacyScale;
        const scaleY = liveLayer.scaleY ?? legacyScale;

        const halfW = scaleX / 2;
        const halfH = scaleY / 2;
        const allowedZones = zoneSource.length ? zoneSource : [currentZoneKey];
        const fittingZone =
          pickZoneForLayerRect(
            nxRaw,
            nyRaw,
            halfW,
            halfH,
            allowedZones,
            boundaries,
            currentZoneKey,
            {
              insetRatio: zoneSwitchInsetRatio,
              switchMargin: compact ? 0.07 : 0.09,
              minOverlapRatio: compact ? 0.08 : 0.1,
              allowOversizedTarget: true,
            }
          ) || currentZoneKey;
        setDragTargetZoneKey?.(fittingZone);
        const normalizedLayer = normalizeImageLayerToBoundary(
          {
            ...liveLayer,
            x: nxRaw,
            y: nyRaw,
            zone: fittingZone,
          },
          canvasSize,
          boundaries,
          specs,
          calibratedConfig,
          { snapToEdges: false }
        );

        latestLayerRef.current = normalizedLayer;
        setPreviewLayer(normalizedLayer);
        dragStateRef.current = {
          ...st,
          startX: e.clientX,
          startY: e.clientY,
          initialLayer: { ...normalizedLayer },
        };
        return;
      }

      if (mode === "resize") {
        const zoneKey = getBoundaryKeyForLayer(initialLayer);
        const boundary = getBoundaryForZone(zoneKey);
        const cx = initialLayer.x ?? 0.5;
        const cy = initialLayer.y ?? 0.5;

        const legacy = initialLayer.scale ?? 0.35;
        let nextScaleX = initialLayer.scaleX ?? legacy;
        let nextScaleY = initialLayer.scaleY ?? legacy;

        const maxHalfWNorm = Math.max(0, Math.min(cx - boundary.minX, boundary.maxX - cx));
        const maxHalfHNorm = Math.max(0, Math.min(cy - boundary.minY, boundary.maxY - cy));
        const maxScaleX = Math.max(0.02, 2 * maxHalfWNorm);
        const maxScaleY = Math.max(0.02, 2 * maxHalfHNorm);

        if (handle === "right") {
          const newWpx = baseW * nextScaleX + dxPx;
          nextScaleX = baseW ? newWpx / baseW : nextScaleX;
        } else if (handle === "left") {
          const newWpx = baseW * nextScaleX - dxPx;
          nextScaleX = baseW ? newWpx / baseW : nextScaleX;
        } else if (handle === "bottom") {
          const newHpx = baseH * nextScaleY + dyPx;
          nextScaleY = baseH ? newHpx / baseH : nextScaleY;
        } else if (handle === "top") {
          const newHpx = baseH * nextScaleY - dyPx;
          nextScaleY = baseH ? newHpx / baseH : nextScaleY;
        }

        nextScaleX = Math.max(0.02, Math.min(nextScaleX, maxScaleX));
        nextScaleY = Math.max(0.02, Math.min(nextScaleY, maxScaleY));

        const resizedLayer = {
          ...liveLayer,
          scaleX: nextScaleX,
          scaleY: nextScaleY,
          scale: Math.min(nextScaleX, nextScaleY),
        };
        latestLayerRef.current = resizedLayer;
        setPreviewLayer(resizedLayer);
        dragStateRef.current = {
          ...st,
          startX: e.clientX,
          startY: e.clientY,
          initialLayer: {
            ...resizedLayer,
            scaleX: nextScaleX,
            scaleY: nextScaleY,
            scale: Math.min(nextScaleX, nextScaleY),
          },
        };
      }
    },
    [setDesignLayers, boundaries, canvasSize, zoneCandidates, compact, specs, calibratedConfig, setDragTargetZoneKey]
  );

  const onPointerMove = useCallback(
    (e) => {
      pendingDesignEventRef.current = e;
      if (designMoveRafRef.current) return;

      designMoveRafRef.current = requestAnimationFrame(() => {
        designMoveRafRef.current = null;
        const event = pendingDesignEventRef.current;
        pendingDesignEventRef.current = null;
        if (event) {
          handlePointerMove(event);
        }
      });
    },
    [handlePointerMove]
  );

  const onPointerUp = useCallback(() => {
    const finalLayer = latestLayerRef.current;
    dragStateRef.current = null;
    setIsInteracting(false);
    setDragTargetZoneKey?.(null);
    setDesignInteractionActive?.(false);
    setPreviewLayer(null);
    if (designMoveRafRef.current) {
      cancelAnimationFrame(designMoveRafRef.current);
      designMoveRafRef.current = null;
    }
    pendingDesignEventRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (finalLayer?.id === layer.id) {
      setDesignLayers((prev) =>
        prev.map((d) => (d.id === layer.id ? { ...d, ...finalLayer } : d))
      );
    }
  }, [onPointerMove, setDragTargetZoneKey, setDesignInteractionActive, setDesignLayers, layer.id]);

  const startDrag = (e, mode = "move", handle = null) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    dragStateRef.current = {
      id: layer.id,
      mode, // "move" | "resize"
      handle, // "left" | "right" | "top" | "bottom"
      startX: e.clientX,
      startY: e.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
    };

    setIsInteracting(true);
    setDragTargetZoneKey?.(layer?.zone || getBoundaryKeyForLayer(layer));
    setDesignInteractionActive?.(true);
    setActiveDesignId(layer.id);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    return () => {
      if (designMoveRafRef.current) {
        cancelAnimationFrame(designMoveRafRef.current);
        designMoveRafRef.current = null;
      }
      pendingDesignEventRef.current = null;
      setIsInteracting(false);
      setDragTargetZoneKey?.(null);
      setDesignInteractionActive?.(false);
    };
  }, [setDragTargetZoneKey, setDesignInteractionActive]);

  // ✅ prefer scaleX/scaleY with legacy fallback
  const displayLayer = previewLayer || layer;
  const legacyScale = displayLayer.scale ?? 0.35;
  const sx = displayLayer.scaleX ?? legacyScale;
  const sy = displayLayer.scaleY ?? legacyScale;

  const widthPx = canvasSize?.width ? canvasSize.width * sx : 0;
  const heightPx = canvasSize?.height ? canvasSize.height * sy : 0;
  const compactHitPadding = 0;
  const centerXPx = (displayLayer.x ?? 0.5) * (canvasSize?.width || 0);
  const centerYPx = (displayLayer.y ?? 0.5) * (canvasSize?.height || 0);
  const leftPx = centerXPx - widthPx / 2;
  const topPx = centerYPx - heightPx / 2;

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-10"
      style={{ touchAction: "none" }}
    >
      <motion.div
        initial={false}
        animate={{
          left: `${leftPx}px`,
          top: `${topPx}px`,
          rotate: displayLayer.rotation || 0,
          scale: isInteracting ? 1.015 : 1,
        }}
        transition={
          isInteracting
            ? { duration: 0 }
            : compact
              ? { type: "spring", stiffness: 700, damping: 42, mass: 0.35 }
              : { type: "spring", stiffness: 400, damping: 40 }
        }
        className="pointer-events-auto absolute"
        style={{
          cursor: disabled ? "default" : isInteracting ? "grabbing" : "grab",
          touchAction: "none",
          willChange: "transform",
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          filter: isInteracting ? "drop-shadow(0 18px 30px rgba(15,23,42,0.22))" : "none",
          zIndex: isInteracting ? 25 : undefined,
        }}
        onPointerDown={(e) => startDrag(e, "move")}
      >
        <div
          className={`relative overflow-hidden rounded-sm ${
            isActive
              ? "border-2 border-blue-500"
              : compact
                ? "border border-blue-400/70"
                : "border border-slate-300/40"
          }`}
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            opacity: disabled ? 0.6 : 1,
            backgroundColor: "transparent",
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => startDrag(e, "move")}
        >
          {displayLayer.imageUrl && (
            <img
              key={`${displayLayer.id}:${displayLayer.imageUrl || ""}`}
              src={normalizeImageUrl(displayLayer.imageUrl)}
              alt="design"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "fill",
                opacity: isActive ? 0.96 : 0.9,
                pointerEvents: "none",
              }}
              draggable={false}
            />
          )}

          {/* ✅ Resize handles (independent axes) */}
          {isActive && !disabled && (
            <>
              {/* X handles */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -left-2 rounded bg-white border-2 border-blue-500 shadow ${compact ? "w-4 h-4" : "w-3 h-3"}`}
                style={{ cursor: "ew-resize" }}
                onPointerDown={(e) => startDrag(e, "resize", "left")}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 -right-2 rounded bg-white border-2 border-blue-500 shadow ${compact ? "w-4 h-4" : "w-3 h-3"}`}
                style={{ cursor: "ew-resize" }}
                onPointerDown={(e) => startDrag(e, "resize", "right")}
              />

              {/* Y handles */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 -top-2 rounded bg-white border-2 border-blue-500 shadow ${compact ? "w-4 h-4" : "w-3 h-3"}`}
                style={{ cursor: "ns-resize" }}
                onPointerDown={(e) => startDrag(e, "resize", "top")}
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 -bottom-2 rounded bg-white border-2 border-blue-500 shadow ${compact ? "w-4 h-4" : "w-3 h-3"}`}
                style={{ cursor: "ns-resize" }}
                onPointerDown={(e) => startDrag(e, "resize", "bottom")}
              />
            </>
          )}
        </div>

        {false && isActive && !compact && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
            {layer.renderedWidthInches?.toFixed?.(1) || "?"}″ ×{" "}
            {layer.renderedHeightInches?.toFixed?.(1) || "?"}″{" "}
            (max {layer.printableAreaWidthInches || "?"}″ × {layer.printableAreaHeightInches || "?"}″)
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default RecolorEditor;
