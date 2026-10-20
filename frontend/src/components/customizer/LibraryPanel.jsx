import { Check } from "lucide-react";
import cx from "../ui/cx.js";
import { PanelHeading } from "./controls.jsx";

/**
 * "Library" tool: ready-made designs shown right in the side panel.
 * images: [{ filename }] for the current folder.
 */
const LibraryPanel = ({
  folders = [],
  currentFolder,
  onSelectFolder,
  images = [],
  loading,
  getImageUrl,
  onPick,
  lastPicked,
}) => (
  <div className="space-y-4">
    <PanelHeading title="Design library" hint="Pick a collection, then tap a design to add it." />

    {folders.length > 0 ? (
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {folders.map((folder) => {
          const active = currentFolder === folder;
          return (
            <button
              key={folder}
              type="button"
              onClick={() => onSelectFolder(folder)}
              aria-pressed={active}
              className={cx(
                "h-8 shrink-0 rounded-mt-btn border px-3 text-xs capitalize transition-colors",
                active ? "border-mt-text bg-mt-btn text-mt-btn-text" : "border-mt-line-strong text-mt-muted hover:text-mt-text"
              )}
            >
              {folder}
            </button>
          );
        })}
      </div>
    ) : (
      <p className="text-xs text-mt-subtle">Loading collections…</p>
    )}

    {loading ? (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-mt-card bg-mt-surface-raised" />
        ))}
      </div>
    ) : currentFolder && images.length > 0 ? (
      <>
        <p className="text-[11px] text-mt-subtle">
          {images.length} design{images.length === 1 ? "" : "s"} in {currentFolder}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
          {images.map((image) => {
            const picked = lastPicked === image.filename;
            return (
              <button
                key={image.filename}
                type="button"
                onClick={() => onPick(image)}
                title={image.filename}
                className={cx(
                  "group relative aspect-square overflow-hidden rounded-mt-card border bg-mt-photo p-2 transition-colors",
                  picked ? "border-mt-text" : "border-mt-line hover:border-mt-line-strong"
                )}
              >
                <img
                  src={getImageUrl(currentFolder, image.filename)}
                  alt={image.filename}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform group-hover:scale-105"
                />
                {picked && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-mt-btn text-mt-btn-text">
                    <Check className="h-3 w-3" aria-label="Added" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </>
    ) : currentFolder ? (
      <p className="rounded-mt-card border border-dashed border-mt-line p-5 text-center text-xs text-mt-subtle">
        No designs in this collection yet.
      </p>
    ) : null}
  </div>
);

export default LibraryPanel;
