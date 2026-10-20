import { ChevronRight, Eye, Image as ImageIcon } from "lucide-react";
import cx from "../ui/cx.js";

/**
 * Product photo gallery: vertical thumbnails on desktop, horizontal on phones,
 * large 4:5 main image on a neutral background so garment colours read true.
 *
 * media: [{ type: "image" | "video", src, thumbSrc, alt, srcSet?, sizes? }]
 */
const ProductGallery = ({
  media = [],
  index = 0,
  onIndexChange,
  onOpenViewer,
  badges,
  loading = false,
  onImageLoad,
  onImageError,
  onPrev,
  onNext,
}) => {
  const current = media[index];
  const isVideo = current?.type === "video";
  const canNavigate = media.length > 1;
  const go = (step) => {
    if (step < 0 && onPrev) return onPrev();
    if (step > 0 && onNext) return onNext();
    return onIndexChange?.((index + step + media.length) % media.length);
  };

  const thumb = (item, i, sizeClass) => {
    const active = i === index;
    return (
      <button
        key={`${item.src}-${i}`}
        type="button"
        onClick={() => onIndexChange?.(i)}
        aria-label={item.type === "video" ? "Show video" : `Show image ${i + 1}`}
        aria-current={active ? "true" : undefined}
        className={cx(
          "relative shrink-0 overflow-hidden rounded-mt-btn bg-mt-photo transition-opacity",
          sizeClass,
          active ? "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-bg" : "opacity-60 hover:opacity-100"
        )}
      >
        {item.type === "video" ? (
          <>
            {item.thumbSrc ? (
              <img src={item.thumbSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <video src={item.src} className="h-full w-full object-cover" muted />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs text-white">▶</span>
          </>
        ) : (
          <img src={item.thumbSrc || item.src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
      </button>
    );
  };

  return (
    <section aria-label="Product images" className="flex gap-3">
      {canNavigate && (
        <div
          className="hidden max-h-[680px] w-20 shrink-0 flex-col gap-3 overflow-y-auto lg:flex"
          style={{ scrollbarWidth: "none" }}
        >
          {media.map((item, i) => thumb(item, i, "h-24 w-20"))}
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mt-card bg-mt-photo lg:max-h-[680px]">
          {current ? (
            isVideo ? (
              <video
                key={current.src}
                src={current.src}
                className="h-full w-full object-contain"
                autoPlay
                loop
                muted
                playsInline
                controls
              />
            ) : (
              <button
                type="button"
                onClick={onOpenViewer}
                className="block h-full w-full cursor-zoom-in"
                aria-label="Open image in full screen"
              >
                <img
                  src={current.src}
                  srcSet={current.srcSet}
                  sizes={current.sizes}
                  alt={current.alt || ""}
                  className="h-full w-full object-contain"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={onImageLoad}
                  onError={onImageError}
                />
              </button>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-mt-subtle">
              <ImageIcon className="h-12 w-12" aria-hidden="true" />
              <p className="mt-3 text-sm">No preview available</p>
            </div>
          )}

          {loading && !isVideo && (
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-mt-surface-raised" aria-hidden="true" />
          )}

          {badges && (
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-2">{badges}</div>
          )}

          {current && !isVideo && onOpenViewer && (
            <span
              className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
              aria-hidden="true"
            >
              <Eye className="h-4 w-4" />
            </span>
          )}

          {canNavigate && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
              >
                <ChevronRight className="h-5 w-5 rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {canNavigate && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" style={{ scrollbarWidth: "none" }}>
            {media.map((item, i) => thumb(item, i, "h-16 w-14"))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGallery;
