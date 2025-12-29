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

  const handleDeleteDesign = (designId) => {
    setDesignLayers(prev => prev.filter(layer => layer.id !== designId));
    setActiveDesignId(null);
  };

  const handleDeleteText = (textId) => {
    setTextLayers(prev => prev.filter(layer => layer.id !== textId));
    setActiveTextId(null);
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
      />

      {/* Text overlay (drag/resize) */}
      {renderer && (
        <TextOverlay
          textLayers={textLayers}
          setTextLayers={setTextLayers}
          activeTextId={activeTextId}
          setActiveTextId={setActiveTextId}
          onAnyTextClick={() => setActiveDesignId(null)}
          onDeleteText={handleDeleteText}
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
            onDeleteDesign={handleDeleteDesign}
          />
        ))}

      {bgRemovalLoading && (
        <div className="pointer-events-none absolute inset-0 bg-white/40" />
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
  onDeleteText,
}) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { mode, id, startX, startY, rectWidth, rectHeight, initialLayer, startRotation, startSize } = dragState;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (mode === "drag") {
        const nx = initialLayer.x + dx / rectWidth;
        const ny = initialLayer.y + dy / rectHeight;

        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id
              ? {
                  ...layer,
                  x: Math.min(0.98, Math.max(0.02, nx)),
                  y: Math.min(0.98, Math.max(0.02, ny)),
                }
              : layer
          )
        );
      } else if (mode === "resize") {
        const newSize = Math.max(12, startSize + (dx + dy) * 0.3);
        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id ? { ...layer, fontSize: newSize } : layer
          )
        );
      } else if (mode === "rotate") {
        const centerX = startX;
        const centerY = startY;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const newRotation = ((angle * 180) / Math.PI) + startRotation;
        
        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id ? { ...layer, rotation: newRotation } : layer
          )
        );
      }
    },
    [setTextLayers]
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

    const startRotation = layer.rotation || 0;
    const startSize = layer.fontSize || 40;

    dragStateRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
      startRotation,
      startSize,
    };

    setActiveTextId(id);
    onAnyTextClick?.();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startRotation = (e, id) => {
    const layer = textLayers.find((l) => l.id === id);
    if (!layer) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const left = layer.x * rect.width + rect.left;
    const top = layer.y * rect.height + rect.top;
    
    const angle = Math.atan2(e.clientY - top, e.clientX - left);
    const currentRotation = layer.rotation || 0;
    
    dragStateRef.current = {
      id,
      mode: "rotate",
      startX: left,
      startY: top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
      startRotation: currentRotation - (angle * 180 / Math.PI),
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

        // Calculate approximate text dimensions for handles
        const fontSize = layer.fontSize || 40;
        const textLength = layer.text ? layer.text.length : 0;
        const approximateWidth = fontSize * textLength * 0.5;
        const approximateHeight = fontSize * 1.2;

        return (
          <div
            key={layer.id}
            style={{
              left,
              top,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
            }}
            className="pointer-events-auto absolute"
            onPointerDown={(e) => {
              if (e.target.classList.contains('handle')) return;
              startDrag(e, layer.id, "drag");
            }}
          >
            <div
              className={`relative inline-block border-2 ${
                isActive ? "border-blue-500 border-dashed" : "border-transparent"
              } bg-transparent px-4 py-2`}
              style={{
                fontFamily: layer.fontFamily,
                fontSize: fontSize,
                color: layer.color,
                whiteSpace: "nowrap",
                cursor: "move",
              }}
            >
              {layer.text || " "}
              
              {/* Active state handles */}
              {isActive && (
                <>
                  {/* Bottom-right resize handle */}
                  <div
                    className="handle absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-se-resize"
                    onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                    style={{ zIndex: 30 }}
                  />
                  
                  {/* Top-left resize handle */}
                  <div
                    className="handle absolute -top-2 -left-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-nw-resize"
                    onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                    style={{ zIndex: 30 }}
                  />
                  
                  {/* Top-right resize handle */}
                  <div
                    className="handle absolute -top-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-ne-resize"
                    onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                    style={{ zIndex: 30 }}
                  />
                  
                  {/* Bottom-left resize handle */}
                  <div
                    className="handle absolute -bottom-2 -left-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-sw-resize"
                    onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                    style={{ zIndex: 30 }}
                  />
                  
                  {/* Rotation handle */}
                  <div
                    className="handle absolute -top-10 left-1/2 transform -translate-x-1/2 h-6 w-6 rounded-full border-2 border-white bg-blue-500 cursor-grab flex items-center justify-center"
                    onPointerDown={(e) => startRotation(e, layer.id)}
                    style={{ zIndex: 30 }}
                  >
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  
                  {/* Delete button */}
                  <button
                    className="handle absolute -top-2 -right-8 h-6 w-6 rounded-full border-2 border-white bg-red-500 cursor-pointer flex items-center justify-center"
                    onClick={() => onDeleteText(layer.id)}
                    style={{ zIndex: 30 }}
                  >
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------- DESIGN OVERLAY (IMAGES) -------- */

function DesignOverlay({
  layer,
  canvasSize,
  setDesignLayers,
  isActive,
  setActiveDesignId,
  disabled,
  onDeleteDesign,
}) {
  const overlayRef = useRef(null);
  const dragStateRef = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const { mode, id, startX, startY, rectWidth, rectHeight, initialLayer, startRotation, startScale } = dragState;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (mode === "drag") {
        const nx = initialLayer.x + dx / rectWidth;
        const ny = initialLayer.y + dy / rectHeight;

        setDesignLayers((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  x: Math.min(0.98, Math.max(0.02, nx)),
                  y: Math.min(0.98, Math.max(0.02, ny)),
                }
              : d
          )
        );
      } else if (mode === "scale") {
        const scaleDelta = (dx + dy) * 0.001;
        const newScale = Math.max(0.05, Math.min(1.5, startScale + scaleDelta));
        
        setDesignLayers((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  scale: newScale,
                  renderedWidthPx: canvasSize.width * newScale,
                  renderedHeightPx: (canvasSize.width * newScale) * (layer.originalHeightPx / layer.originalWidthPx),
                }
              : d
          )
        );
      } else if (mode === "rotate") {
        const centerX = startX;
        const centerY = startY;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const newRotation = ((angle * 180) / Math.PI) + startRotation;
        
        setDesignLayers((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, rotation: newRotation } : d
          )
        );
      }
    },
    [setDesignLayers, canvasSize, layer.originalHeightPx, layer.originalWidthPx]
  );

  const onPointerUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e, mode = "drag") => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const startRotation = layer.rotation || 0;
    const startScale = layer.scale || 0.35;

    dragStateRef.current = {
      id: layer.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
      startRotation,
      startScale,
    };

    setActiveDesignId(layer.id);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startRotation = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const left = layer.x * rect.width + rect.left;
    const top = layer.y * rect.height + rect.top;
    
    const angle = Math.atan2(e.clientY - top, e.clientX - left);
    const startRotation = layer.rotation || 0;
    
    dragStateRef.current = {
      id: layer.id,
      mode: "rotate",
      startX: left,
      startY: top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      initialLayer: { ...layer },
      startRotation: startRotation - (angle * 180 / Math.PI),
    };

    setActiveDesignId(layer.id);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

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
        onPointerDown={(e) => {
          if (e.target.classList.contains('handle')) return;
          startDrag(e, "drag");
        }}
      >
        <div
          className={`relative overflow-hidden ${
            isActive ? "border-2 border-dashed border-blue-500" : "border-none"
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
          
          {/* Active state handles */}
          {isActive && !disabled && (
            <>
              {/* Bottom-right scale handle */}
              <div
                className="handle absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-se-resize"
                onPointerDown={(e) => startDrag(e, "scale")}
                style={{ zIndex: 30 }}
              />
              
              {/* Top-left scale handle */}
              <div
                className="handle absolute -top-2 -left-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-nw-resize"
                onPointerDown={(e) => startDrag(e, "scale")}
                style={{ zIndex: 30 }}
              />
              
              {/* Top-right scale handle */}
              <div
                className="handle absolute -top-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-ne-resize"
                onPointerDown={(e) => startDrag(e, "scale")}
                style={{ zIndex: 30 }}
              />
              
              {/* Bottom-left scale handle */}
              <div
                className="handle absolute -bottom-2 -left-2 h-4 w-4 rounded-full border-2 border-white bg-blue-500 cursor-sw-resize"
                onPointerDown={(e) => startDrag(e, "scale")}
                style={{ zIndex: 30 }}
              />
              
              {/* Rotation handle */}
              <div
                className="handle absolute -top-10 left-1/2 transform -translate-x-1/2 h-6 w-6 rounded-full border-2 border-white bg-blue-500 cursor-grab flex items-center justify-center"
                onPointerDown={startRotation}
                style={{ zIndex: 30 }}
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              
              {/* Delete button */}
              <button
                className="handle absolute -top-2 -right-8 h-6 w-6 rounded-full border-2 border-white bg-red-500 cursor-pointer flex items-center justify-center"
                onClick={() => onDeleteDesign(layer.id)}
                style={{ zIndex: 30 }}
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecolorEditor;