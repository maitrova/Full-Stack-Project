import cx from "../ui/cx.js";

// Small shared controls for the customizer tool panels.

export const PanelHeading = ({ title, hint, action }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-mt-text">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-mt-subtle">{hint}</p>}
    </div>
    {action}
  </div>
);

/** Labelled range slider with optional − / + buttons. */
export const SliderRow = ({ label, value, display, min, max, step, onChange, onStep, stepSize }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-xs">
      <span className="text-mt-muted">{label}</span>
      <span className="tabular-nums text-mt-text">{display}</span>
    </div>
    <div className="flex items-center gap-2">
      {onStep && (
        <button
          type="button"
          onClick={() => onStep(-stepSize)}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mt-btn border border-mt-line-strong text-mt-text hover:bg-mt-tint/10"
        >
          −
        </button>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-8 min-w-0 flex-1 cursor-pointer accent-[var(--mt-btn)]"
      />
      {onStep && (
        <button
          type="button"
          onClick={() => onStep(stepSize)}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mt-btn border border-mt-line-strong text-mt-text hover:bg-mt-tint/10"
        >
          +
        </button>
      )}
    </div>
  </div>
);

/** Single-choice segmented buttons. options: [{ value, label }] */
export const Segmented = ({ label, options = [], value, onChange }) => (
  <div>
    {label && <p className="mb-1.5 text-xs text-mt-muted">{label}</p>}
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-mt-btn border border-mt-line-strong p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(option.value)}
            className={cx(
              "h-8 flex-1 rounded-[2px] text-xs transition-colors",
              active ? "bg-mt-btn text-mt-btn-text" : "text-mt-muted hover:text-mt-text"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);

/** Small bordered action button with an icon. */
export const ToolButton = ({ icon: Icon, children, tone, className, ...rest }) => (
  <button
    type="button"
    className={cx(
      "inline-flex h-9 items-center justify-center gap-1.5 rounded-mt-btn border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      tone === "danger"
        ? "border-mt-danger/40 text-mt-danger hover:bg-mt-danger/10"
        : "border-mt-line-strong text-mt-text hover:bg-mt-tint/10",
      className
    )}
    {...rest}
  >
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </button>
);

/** Row of selectable layer chips (images or texts on the current side). */
export const LayerChips = ({ items = [], activeId, onSelect, label }) =>
  items.length > 0 ? (
    <div>
      {label && <p className="mb-1.5 text-xs text-mt-muted">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              className={cx(
                "inline-flex max-w-full items-center gap-1.5 rounded-mt-btn border px-2 py-1 text-xs transition-colors",
                active ? "border-mt-text bg-mt-tint/10 text-mt-text" : "border-mt-line text-mt-muted hover:border-mt-line-strong"
              )}
            >
              {item.thumb && <img src={item.thumb} alt="" className="h-6 w-6 shrink-0 rounded-[2px] bg-mt-photo object-contain" />}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;
