import cx from "./cx.js";

const SIZES = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

/**
 * Colour picker row (single choice).
 * `colors` = [{ value, label, hex?, disabled? }] — `hex` defaults to `value`.
 * Pass no `onChange` for a read-only row of dots.
 */
const Swatch = ({ colors = [], value, onChange, size = "md", label = "Colour", className }) => {
  const readOnly = !onChange;

  return (
    <div
      role={readOnly ? "list" : "radiogroup"}
      aria-label={label}
      className={cx("flex flex-wrap items-center gap-2.5", className)}
    >
      {colors.map((color) => {
        const selected = color.value === value;
        const dot = cx(
          "shrink-0 rounded-full border border-mt-tint/25",
          SIZES[size] || SIZES.md,
          selected && "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-surface",
          color.disabled && "opacity-35"
        );
        const style = { backgroundColor: color.hex || color.value };

        if (readOnly) {
          return (
            <span
              key={color.value}
              role="listitem"
              title={color.label}
              aria-label={color.label}
              className={dot}
              style={style}
            />
          );
        }

        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            title={color.label}
            disabled={color.disabled}
            onClick={() => onChange(color.value)}
            className={cx(
              dot,
              "cursor-pointer transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mt-text",
              "disabled:cursor-not-allowed"
            )}
            style={style}
          />
        );
      })}
    </div>
  );
};

export default Swatch;
