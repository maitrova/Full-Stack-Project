import cx from "./cx.js";

const VARIANTS = {
  neutral: "bg-mt-surface-raised text-mt-muted",
  solid: "bg-mt-btn text-mt-btn-text",
  outline: "border border-mt-line-strong text-mt-text",
  new: "text-mt-new px-0",
  success: "bg-mt-success/15 text-mt-success",
  danger: "bg-mt-danger/15 text-mt-danger",
};

/** Small label: "New", "Best seller", order status, etc. */
const Badge = ({ variant = "neutral", className, children, ...rest }) => (
  <span
    className={cx(
      "inline-flex items-center rounded-mt-btn px-2 py-0.5 font-brand text-xs font-medium",
      VARIANTS[variant] || VARIANTS.neutral,
      className
    )}
    {...rest}
  >
    {children}
  </span>
);

export default Badge;
