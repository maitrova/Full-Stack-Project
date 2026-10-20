import cx from "../ui/cx.js";

/**
 * Strip under the customizer canvas: one Front / Back switcher and a short list
 * of what has been added to the product.
 *
 * views: [{ code, label, hasLayers }]
 */
const CanvasFooter = ({ views = [], currentView, onViewChange, addedNames = [], extraCount = 0 }) => (
  <div className="flex flex-col gap-3 border-t border-mt-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    {views.length > 1 ? (
      <div role="tablist" aria-label="Product side" className="inline-flex self-center rounded-mt-btn border border-mt-line-strong p-0.5 sm:self-auto">
        {views.map((view) => {
          const active = view.code === currentView;
          return (
            <button
              key={view.code}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onViewChange(view.code)}
              className={cx(
                "relative h-9 min-w-[84px] rounded-[2px] px-4 text-sm transition-colors",
                active ? "bg-mt-btn text-mt-btn-text" : "text-mt-muted hover:text-mt-text"
              )}
            >
              {view.label || view.code}
              {view.hasLayers && !active && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-mt-accent" aria-label="has designs" />
              )}
            </button>
          );
        })}
      </div>
    ) : (
      <span />
    )}

    <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-xs sm:justify-end">
      {addedNames.length > 0 ? (
        <>
          <span className="text-mt-subtle">Added:</span>
          {addedNames.map((name) => (
            <span key={name} className="max-w-[160px] truncate rounded-mt-btn border border-mt-line bg-mt-bg px-2 py-1 text-mt-muted">
              {name}
            </span>
          ))}
          {extraCount > 0 && <span className="text-mt-subtle">+{extraCount} more</span>}
        </>
      ) : (
        <span className="text-mt-subtle">Nothing added yet. Upload an image or add text to start.</span>
      )}
    </div>
  </div>
);

export default CanvasFooter;
