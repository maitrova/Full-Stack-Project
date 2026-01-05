// src/RecolorEditor.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import CanvasRenderer from "./CanvasRenderer.jsx";

// helper: load image so we can draw it into an offscreen canvas
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

// Define print area boundaries for different product zones/views
// In the DESIGN_BOUNDARIES object, make them more restrictive:
const DESIGN_BOUNDARIES = {
  // Front of t-shirt/hoodie (main torso area only)
  'front-full': {
    minX: 0.3,   // 30% from left (away from shoulders)
    maxX: 0.7,   // 70% from left (away from shoulders)
    minY: 0.25,  // 25% from top (below neckline)
    maxY: 0.65,  // 65% from top (above waist)
  },
  // Back of t-shirt/hoodie
  'back-full': {
    minX: 0.3,
    maxX: 0.7,
    minY: 0.25,
    maxY: 0.65,
  },
  // Left sleeve (small area only)
  'sleeve-left': {
    minX: 0.15,
    maxX: 0.3,
    minY: 0.18,
    maxY: 0.32,
  },
  // Right sleeve (small area only)
  'sleeve-right': {
    minX: 0.7,
    maxX: 0.85,
    minY: 0.18,
    maxY: 0.32,
  },
  // Default (fallback)
  'default': {
    minX: 0.3,
    maxX: 0.7,
    minY: 0.25,
    maxY: 0.65,
  }
};

// Text boundaries (more restrictive)
const TEXT_BOUNDARIES = {
  minX: 0.15,
  maxX: 0.85,
  minY: 0.15,
  maxY: 0.85,
};

// Helper function to get boundary for a design
function getDesignBoundary(canvasSize, layer) {
  // Use layer.zone or viewCode to determine boundary
  const zone = layer.zone || 'default';
  const viewCode = layer.viewCode || 'front';
  
  // Map view codes to boundaries
  const boundaryKey = 
    zone.includes('sleeve') ? zone : 
    viewCode === 'left' ? 'sleeve-left' :
    viewCode === 'right' ? 'sleeve-right' :
    viewCode === 'back' ? 'back-full' :
    'front-full';
  
  const boundary = DESIGN_BOUNDARIES[boundaryKey] || DESIGN_BOUNDARIES.default;
  
  // Adjust boundaries based on design size (so design doesn't overflow)
  if (canvasSize && layer.scale && layer.originalWidthPx && layer.originalHeightPx) {
    const aspectRatio = layer.originalHeightPx / layer.originalWidthPx;
    const halfWidth = (layer.scale * 0.5) / 2; // Half of design width in normalized coordinates
    const halfHeight = (layer.scale * aspectRatio * 0.5) / 2;
    
    return {
      minX: Math.max(0.05, boundary.minX + halfWidth),
      maxX: Math.min(0.95, boundary.maxX - halfWidth),
      minY: Math.max(0.05, boundary.minY + halfHeight),
      maxY: Math.min(0.95, boundary.maxY - halfHeight),
    };
  }
  
  return boundary;
}

// Snap to boundary edges
function snapToBoundary(x, y, boundary, threshold = 0.02) {
  let snappedX = x;
  let snappedY = y;
  
  if (Math.abs(x - boundary.minX) < threshold) snappedX = boundary.minX;
  if (Math.abs(x - boundary.maxX) < threshold) snappedX = boundary.maxX;
  if (Math.abs(y - boundary.minY) < threshold) snappedY = boundary.minY;
  if (Math.abs(y - boundary.maxY) < threshold) snappedY = boundary.maxY;
  
  return { x: snappedX, y: snappedY };
}

const RecolorEditor = forwardRef(function RecolorEditor(
  {
    mockupUrl,
    maskUrl,
    previewWidth = 800,
    productColor = "#FFFFFF",
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
  },
  ref
) {
  const [renderer, setRenderer] = useState(null);
  const [canvasSize, setCanvasSize] = useState(null);
  const [showBoundaries, setShowBoundaries] = useState(false);

  const handleRendererReady = useCallback((instance) => {
    setRenderer(instance || null);
    if (instance && instance.canvas) {
      setCanvasSize({
        width: instance.canvas.width,
        height: instance.canvas.height,
      });
    } else {
      setCanvasSize(null);
    }
  }, []);

  useEffect(() => {
    if (!renderer || !renderer.canvas) return;
    setCanvasSize({
      width: renderer.canvas.width,
      height: renderer.canvas.height,
    });
  }, [renderer]);

  // Expose capturePreview() to parent
  useImperativeHandle(
    ref,
    () => ({
      capturePreview() {
        if (!renderer || !renderer.canvas) return null;
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

  // Effect that draws TEXT + UPLOADED IMAGES into WebGL design texture
  useEffect(() => {
    if (!renderer) return;
    const glCanvas = renderer.canvas;
    if (!glCanvas) return;

    const w = glCanvas.width;
    const h = glCanvas.height;
    if (!w || !h) return;

    const hasText = textLayers && textLayers.some((l) => l.text && l.text.trim().length > 0);
    const imageLayers = (designLayers || []).filter((l) => !!l.imageUrl);
    const hasImages = imageLayers.length > 0;

    // If no text and no images, clear the design texture
    if (!hasText && !hasImages) {
      renderer.clearDesignTexture();
      renderer.render(productColor);

      const activeDesign = designLayers.find((d) => d.id === activeDesignId);
      if (activeDesign && canvasSize) {
        onDesignRenderWidthChange?.(canvasSize.width * activeDesign.scale);
      } else {
        onDesignRenderWidthChange?.(null);
      }

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

        // Draw TEXT
        textLayers.forEach((layer) => {
          if (!layer.text) return;

          const { x, y, fontSize, color, fontFamily, rotation = 0 } = layer;
          const px = x * w;
          const py = y * h;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate((rotation * Math.PI) / 180);

          ctx.fillStyle = color || "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `700 ${fontSize || 40}px ${
            fontFamily || "Impact, sans-serif"
          }`;

          ctx.fillText(layer.text, 0, 0);
          ctx.restore();
        });

        // Draw UPLOADED IMAGES (designLayers)
        if (imageLayers.length > 0 && canvasSize) {
          // Load all images first
          const imgs = await Promise.all(
            imageLayers.map((layer) => loadImage(layer.imageUrl))
          );

          imgs.forEach((img, index) => {
            const layer = imageLayers[index];

            const px = layer.x * w;
            const py = layer.y * h;

            const canvasWidth = canvasSize.width;
            const targetWidthPx = canvasWidth * (layer.scale || 0.35);

            const imgRatio = img.width > 0 ? targetWidthPx / img.width : 1.0;
            const drawW = img.width * imgRatio;
            const drawH = img.height * imgRatio;

            const rotationRad = ((layer.rotation || 0) * Math.PI) / 180;

            // Update layer dimensions for price calculation
            if (!layer.renderedWidthPx || !layer.renderedHeightPx) {
              setDesignLayers(prev => prev.map(l => 
                l.id === layer.id ? {
                  ...l,
                  renderedWidthPx: drawW,
                  renderedHeightPx: drawH
                } : l
              ));
            }

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(rotationRad);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          });
        }

        if (cancelled) return;

        // Update approximate width for UI
        const activeDesign = designLayers.find((d) => d.id === activeDesignId);
        if (activeDesign && canvasSize) {
          onDesignRenderWidthChange?.(canvasSize.width * activeDesign.scale);
        } else {
          onDesignRenderWidthChange?.(null);
        }

        // Push final offscreen image into WebGL texture
        renderer.updateDesignTexture(offscreen);
        renderer.render(productColor);
      } catch (err) {
        console.error("Error drawing text + images into design texture:", err);
      }
    }

    drawAll();

    return () => {
      cancelled = true;
    };
  }, [
    renderer,
    textLayers,
    designLayers,
    productColor,
    activeDesignId,
    canvasSize,
    onDesignRenderWidthChange,
    setDesignLayers,
  ]);

  const handleBackgroundMouseDown = () => {
    // Clicking empty area: deselect active design
    setActiveDesignId(null);
    setActiveTextId(null);
  };

  // Toggle boundary visualization (for debugging)
  const toggleBoundaries = () => {
    setShowBoundaries(!showBoundaries);
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseDown={handleBackgroundMouseDown}
    >
      <CanvasRenderer
        mockupUrl={mockupUrl}
        maskUrl={maskUrl}
        previewWidth={previewWidth}
        productColor={productColor}
        onRendererReady={handleRendererReady}
        showBoundaries={showBoundaries}
      />
      
      {/* Boundary toggle button (for debugging) */}
      <button
        onClick={toggleBoundaries}
        className="absolute top-2 right-2 z-50 bg-white/80 hover:bg-white text-xs px-2 py-1 rounded border border-slate-300 shadow-sm"
        title="Toggle boundary visualization"
      >
        {showBoundaries ? "Hide Boundaries" : "Show Boundaries"}
      </button>

      {/* Text overlay (drag/resize) */}
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

      {/* Image overlays (multiple) */}
      {renderer &&
        canvasSize &&
        designLayers.map((layer) => (
          <DesignOverlay
            key={layer.id}
            layer={layer}
            canvasSize={canvasSize}
            setDesignLayers={setDesignLayers}
            isActive={layer.id === activeDesignId}
            setActiveDesignId={setActiveDesignId}
            disabled={bgRemovalLoading}
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

/* -------- TEXT OVERLAY -------- */

function TextOverlay({
  textLayers,
  setTextLayers,
  activeTextId,
  setActiveTextId,
  onAnyTextClick,
  canvasSize,
}) {
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

        // Apply boundary constraints
        let constrainedX = nx;
        let constrainedY = ny;

        // Get text size for boundary adjustment
        const textLayer = textLayers.find(l => l.id === id);
        if (textLayer && canvasSize) {
          // Estimate text dimensions
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.font = `${textLayer.fontSize}px ${textLayer.fontFamily}`;
          const textWidth = ctx.measureText(textLayer.text).width;
          const textHeight = textLayer.fontSize * 1.2;
          
          // Convert to normalized coordinates
          const halfWidth = (textWidth / canvasSize.width) / 2;
          const halfHeight = (textHeight / canvasSize.height) / 2;
          
          // Adjust boundaries based on text size
          const adjustedBoundaries = {
            minX: TEXT_BOUNDARIES.minX + halfWidth,
            maxX: TEXT_BOUNDARIES.maxX - halfWidth,
            minY: TEXT_BOUNDARIES.minY + halfHeight,
            maxY: TEXT_BOUNDARIES.maxY - halfHeight,
          };

          constrainedX = Math.max(adjustedBoundaries.minX, Math.min(adjustedBoundaries.maxX, nx));
          constrainedY = Math.max(adjustedBoundaries.minY, Math.min(adjustedBoundaries.maxY, ny));
          
          // Apply snap to boundary
          const snapped = snapToBoundary(constrainedX, constrainedY, TEXT_BOUNDARIES);
          constrainedX = snapped.x;
          constrainedY = snapped.y;
        }

        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id
              ? {
                  ...layer,
                  x: constrainedX,
                  y: constrainedY,
                }
              : layer
          )
        );
      } else if (mode === "resize") {
        const newSize = Math.max(12, Math.min(200, initialLayer.fontSize + (dx + dy) * 0.3));
        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id ? { ...layer, fontSize: newSize } : layer
          )
        );
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
      {textLayers.map((layer) => {
        const isActive = layer.id === activeTextId;
        const left = `${layer.x * 100}%`;
        const top = `${layer.y * 100}%`;

        return (
          <div
            key={layer.id}
            style={{
              left,
              top,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
            }}
            className="pointer-events-auto absolute"
            onPointerDown={(e) => startDrag(e, layer.id, "drag")}
          >
            <div
              className={`relative inline-block border ${
                isActive ? "border-blue-500 bg-blue-50/30" : "border-transparent"
              } bg-transparent px-2 py-1 rounded`}
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
                <>
                  <div
                    onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-blue-500 bg-white shadow-sm"
                    style={{ cursor: "nwse-resize" }}
                  />
                  {/* Boundary indicator */}
                  <div className="absolute -inset-3 border border-red-300 border-dashed pointer-events-none rounded opacity-50"></div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------- DESIGN OVERLAY (IMAGES) WITH BOUNDARY CONSTRAINTS -------- */

function DesignOverlay({
  layer,
  canvasSize,
  setDesignLayers,
  isActive,
  setActiveDesignId,
  disabled,
}) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { id, startX, startY, rectWidth, rectHeight, initialLayer } = dragState;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Calculate new position
      const nx = initialLayer.x + dx / rectWidth;
      const ny = initialLayer.y + dy / rectHeight;

      // Get boundary constraints for this view/layer
      const boundary = getDesignBoundary(canvasSize, layer);
      
      // Apply boundary constraints
      let constrainedX = Math.max(boundary.minX, Math.min(boundary.maxX, nx));
      let constrainedY = Math.max(boundary.minY, Math.min(boundary.maxY, ny));
      
      // Apply snap to boundary
      const snapped = snapToBoundary(constrainedX, constrainedY, boundary);
      constrainedX = snapped.x;
      constrainedY = snapped.y;

      setDesignLayers((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                x: constrainedX,
                y: constrainedY,
              }
            : d
        )
      );
    },
    [setDesignLayers, canvasSize, layer]
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

  const boundary = getDesignBoundary(canvasSize, layer);
  const left = `${layer.x * 100}%`;
  const top = `${layer.y * 100}%`;
  const widthPx = canvasSize.width * layer.scale;
  const heightPx = widthPx * (layer.originalHeightPx / layer.originalWidthPx);

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
          className={`overflow-hidden rounded-sm ${
            isActive ? 'border-2 border-blue-500 bg-blue-50/20' : 'border border-slate-300/50'
          }`}
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
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
        
        {/* Visual boundary indicator when active */}
        {isActive && (
          <>
            <div className="absolute -inset-4 border-2 border-red-400 border-dashed pointer-events-none rounded-lg opacity-60"></div>
            {/* Boundary position info */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
              X: {(layer.x * 100).toFixed(1)}% Y: {(layer.y * 100).toFixed(1)}%
            </div>
          </>
        )}
        
        {/* Boundary limits (always show for debugging) */}
        <div 
          className="absolute pointer-events-none opacity-30"
          style={{
            left: `${boundary.minX * 100}%`,
            top: `${boundary.minY * 100}%`,
            width: `${(boundary.maxX - boundary.minX) * 100}%`,
            height: `${(boundary.maxY - boundary.minY) * 100}%`,
            transform: 'translate(-50%, -50%)',
            border: '1px dashed #666',
            background: 'transparent',
          }}
        ></div>
      </div>
    </div>
  );
}

export default RecolorEditor;