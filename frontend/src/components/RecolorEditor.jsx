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
        const newSize = Math.max(12, initialLayer.fontSize + (dx + dy) * 0.3);
        setTextLayers((prev) =>
          prev.map((layer) =>
            layer.id === id ? { ...layer, fontSize: newSize } : layer
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
                isActive ? "border-sky-500" : "border-transparent"
              } bg-transparent px-2 py-1`}
              style={{
                fontFamily: layer.fontFamily,
                fontSize: layer.fontSize,
                color: layer.color,
                whiteSpace: "nowrap",
                cursor: "move",
              }}
            >
              {layer.text || " "}
              <div
                onPointerDown={(e) => startDrag(e, layer.id, "resize")}
                className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm border border-sky-500 bg-white"
                style={{ cursor: "nwse-resize" }}
              />
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
    },
    [setDesignLayers]
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

  const left = `${layer.x * 100}%`;
  const top = `${layer.y * 100}%`;
  const widthPx = canvasSize.width * layer.scale;

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
          className={`overflow-hidden ${
            isActive ? "border border-dashed border-slate-400" : "border-none"
          }`}
          style={{
            width: `${widthPx}px`,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {layer.imageUrl && (
            <img
              src={layer.imageUrl}
              alt="design"
              style={{
                width: "100%",
                height: "auto",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default RecolorEditor;