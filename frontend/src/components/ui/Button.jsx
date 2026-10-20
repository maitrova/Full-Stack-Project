import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import cx from "./cx.js";

const VARIANTS = {
  primary:
    "bg-mt-btn text-mt-btn-text hover:bg-mt-btn-hover disabled:bg-mt-line-strong disabled:text-mt-subtle",
  outline:
    "border border-mt-text text-mt-text hover:bg-mt-tint/10 disabled:border-mt-line-strong disabled:text-mt-subtle",
  accent:
    "border border-mt-accent text-mt-accent-strong hover:bg-mt-accent/10 disabled:border-mt-line-strong disabled:text-mt-subtle",
  // Outline button for use on the coffee home-page banners.
  banner:
    "border border-mt-banner-accent text-mt-banner-accent hover:bg-mt-banner-accent/10 disabled:border-mt-line-strong disabled:text-mt-subtle",
  ghost: "text-mt-text hover:bg-mt-tint/10 disabled:text-mt-subtle",
  link: "text-mt-muted hover:text-mt-text underline-offset-4 hover:underline px-0 h-auto",
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2.5",
};

/**
 * Brand button. Renders a router <Link> when `to` is set, an <a> when `href`
 * is set, otherwise a <button>.
 */
const Button = ({
  variant = "primary",
  size = "md",
  to,
  href,
  fullWidth = false,
  loading = false,
  arrow = false,
  leadingIcon: LeadingIcon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}) => {
  const classes = cx(
    "inline-flex items-center justify-center rounded-mt-btn font-brand font-medium",
    "transition-colors duration-150 select-none whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text",
    "disabled:cursor-not-allowed",
    VARIANTS[variant] || VARIANTS.primary,
    variant !== "link" && (SIZES[size] || SIZES.md),
    fullWidth && "w-full",
    className
  );

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        LeadingIcon && <LeadingIcon className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{children}</span>
      {arrow && !loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
};

export default Button;
