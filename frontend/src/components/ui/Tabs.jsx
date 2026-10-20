import { useRef } from "react";
import cx from "./cx.js";

/**
 * Underlined tab row (same look as the header nav's active underline).
 * Controlled: `tabs` = [{ id, label }], `value` = active id, `onChange(id)`.
 * Render the matching panel yourself with id `${idPrefix}-panel-${tab.id}`.
 */
const Tabs = ({ tabs, value, onChange, idPrefix = "tabs", fullWidth = false, className }) => {
  const tabRefs = useRef([]);

  const focusTab = (index) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    tabRefs.current[nextIndex]?.focus();
    onChange?.(tabs[nextIndex].id);
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      className={cx(
        "flex gap-6 overflow-x-auto border-b border-mt-line font-brand",
        fullWidth && "justify-between",
        className
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 py-3 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text",
              selected
                ? "border-mt-text text-mt-text"
                : "border-transparent text-mt-muted hover:text-mt-text"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
