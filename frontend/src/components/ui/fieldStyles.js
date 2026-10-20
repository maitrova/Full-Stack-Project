import cx from "./cx.js";

// Shared look for Input, Select and Textarea.
export const fieldClasses = (hasError, className) =>
  cx(
    "w-full rounded-mt-btn border bg-mt-surface px-3.5 font-brand text-sm text-mt-text",
    "placeholder:text-mt-subtle transition-colors",
    "focus:outline-none focus:border-mt-text",
    "disabled:cursor-not-allowed disabled:opacity-50",
    hasError ? "border-mt-danger" : "border-mt-line hover:border-mt-line-strong",
    className
  );

export const labelClasses = "font-brand text-sm font-medium text-mt-text";
export const hintClasses = "font-brand text-xs text-mt-subtle";
export const errorClasses = "font-brand text-xs text-mt-danger";
