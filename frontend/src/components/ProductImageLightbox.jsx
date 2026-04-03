import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;
const SWIPE_THRESHOLD = 48;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ProductImageLightbox({
  isOpen,
  items = [],
  initialIndex = 0,
  title = "Image gallery",
  onClose,
  onIndexChange,
}) {
  const slides = useMemo(() => items.filter((item) => item?.src), [items]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState(MIN_SCALE);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef(null);
  const touchStateRef = useRef(null);
  const containerRef = useRef(null);

  const currentItem = slides[activeIndex] || null;
  const canNavigate = slides.length > 1;

  const resetView = () => {
    setScale(MIN_SCALE);
    setTranslate({ x: 0, y: 0 });
  };

  const updateActiveIndex = (nextIndex) => {
    if (!slides.length) return;
    const normalizedIndex = ((nextIndex % slides.length) + slides.length) % slides.length;
    setActiveIndex(normalizedIndex);
    onIndexChange?.(normalizedIndex);
    resetView();
  };

  const zoomTo = (nextScale) => {
    const normalizedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(normalizedScale);
    if (normalizedScale === MIN_SCALE) {
      setTranslate({ x: 0, y: 0 });
      return;
    }

    setTranslate((prev) => {
      const limitX = containerRef.current ? ((normalizedScale - 1) * containerRef.current.clientWidth) / 2 : 0;
      const limitY = containerRef.current ? ((normalizedScale - 1) * containerRef.current.clientHeight) / 2 : 0;

      return {
        x: clamp(prev.x, -limitX, limitX),
        y: clamp(prev.y, -limitY, limitY),
      };
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    setActiveIndex(clamp(initialIndex, 0, Math.max(slides.length - 1, 0)));
    resetView();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [initialIndex, isOpen, slides.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }

      if (event.key === "ArrowLeft" && canNavigate) {
        updateActiveIndex(activeIndex - 1);
        return;
      }

      if (event.key === "ArrowRight" && canNavigate) {
        updateActiveIndex(activeIndex + 1);
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomTo(scale + ZOOM_STEP);
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomTo(scale - ZOOM_STEP);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, canNavigate, isOpen, onClose, scale, slides.length]);

  if (!isOpen || !slides.length || !currentItem) {
    return null;
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handlePointerDown = (event) => {
    if (scale <= MIN_SCALE) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: translate.x,
      originY: translate.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !containerRef.current) return;

    const limitX = ((scale - 1) * containerRef.current.clientWidth) / 2;
    const limitY = ((scale - 1) * containerRef.current.clientHeight) / 2;
    const nextX = dragState.originX + (event.clientX - dragState.startX);
    const nextY = dragState.originY + (event.clientY - dragState.startY);

    setTranslate({
      x: clamp(nextX, -limitX, limitX),
      y: clamp(nextY, -limitY, limitY),
    });
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomTo(scale + delta);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1 || scale > MIN_SCALE) return;
    const touch = event.touches[0];
    touchStateRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!touchStateRef.current || !canNavigate) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStateRef.current.x;
    const deltaY = touch.clientY - touchStateRef.current.y;
    touchStateRef.current = null;

    if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX > 0) {
      updateActiveIndex(activeIndex - 1);
    } else {
      updateActiveIndex(activeIndex + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{title}</p>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              {activeIndex + 1} / {slides.length}
              {currentItem.label ? `  •  ${currentItem.label}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => zoomTo(scale - ZOOM_STEP)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => zoomTo(scale + ZOOM_STEP)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="hidden h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 sm:flex"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
          {canNavigate && (
            <button
              type="button"
              onClick={() => updateActiveIndex(activeIndex - 1)}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white transition hover:bg-black/55 sm:left-6"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div
            ref={containerRef}
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-white/5"
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentItem.src}
              alt={currentItem.alt || currentItem.label || title}
              className={`max-h-full max-w-full select-none object-contain transition-transform duration-200 ${
                scale > MIN_SCALE ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              }`}
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                touchAction: scale > MIN_SCALE ? "none" : "pan-y",
              }}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                if (scale === MIN_SCALE) {
                  zoomTo(1.5);
                }
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>

          {canNavigate && (
            <button
              type="button"
              onClick={() => updateActiveIndex(activeIndex + 1)}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white transition hover:bg-black/55 sm:right-6"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {slides.length > 1 && (
          <div className="border-t border-white/10 px-4 py-4 sm:px-6">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {slides.map((item, index) => (
                <button
                  key={`${item.src}-${index}`}
                  type="button"
                  onClick={() => updateActiveIndex(index)}
                  className={`relative h-20 w-20 flex-none overflow-hidden rounded-2xl border transition ${
                    index === activeIndex
                      ? "border-cyan-400 ring-2 ring-cyan-400/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img
                    src={item.thumbSrc || item.src}
                    alt={item.alt || item.label || `Image ${index + 1}`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
