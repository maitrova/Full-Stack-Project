// src/TextOverlay.jsx
import React, { useRef, useCallback } from 'react';

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
        const textLayer = textLayers.find((l) => l.id === id);
        if (textLayer && canvasSize) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.font = `${textLayer.fontSize}px ${textLayer.fontFamily}`;
          const textWidth = ctx.measureText(textLayer.text).width;
          const textHeight = textLayer.fontSize * 1.2;

          const halfWidth = (textWidth / canvasSize.width) / 2;
          const halfHeight = (textHeight / canvasSize.height) / 2;

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

export default TextOverlay;
