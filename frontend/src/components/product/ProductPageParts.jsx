import { useState } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronRight, Heart, Info, RefreshCw, Ruler, Share2, Shield, ShoppingCart, Star, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import cx from "../ui/cx.js";

// Shared building blocks for every product detail page (readymade, drop, combo,
// catalogue design, saved design) so they all look and behave the same.

/** Back link on the left, share + wishlist on the right. */
export const ProductTopBar = ({
  onBack,
  backLabel = "products",
  onShare,
  shareMenu,
  shareMenuOpen,
  onShareMenuOpenChange,
  copied: copiedProp,
  favorite,
  onToggleFavorite,
  extra,
}) => {
  const [ownCopied, setCopied] = useState(false);
  const copied = copiedProp ?? ownCopied;
  const [ownMenuOpen, setOwnMenuOpen] = useState(false);
  // The share menu can be controlled by the page (shareMenuOpen) or manage itself.
  const menuOpen = shareMenuOpen ?? ownMenuOpen;
  const setMenuOpen = (next) => {
    const value = typeof next === "function" ? next(menuOpen) : next;
    if (onShareMenuOpenChange) onShareMenuOpenChange(value);
    else setOwnMenuOpen(value);
  };
  const share = async () => {
    if (shareMenu?.length) {
      setMenuOpen((open) => !open);
      return;
    }
    if (onShare) {
      await onShare();
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-10 items-center gap-2 text-sm text-mt-muted transition-colors hover:text-mt-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="capitalize">Back to {backLabel}</span>
      </button>
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={share}
          aria-label={copied ? "Link copied" : "Share"}
          aria-expanded={shareMenu?.length ? menuOpen : undefined}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-mt-muted transition-colors hover:bg-mt-tint/10 hover:text-mt-text"
        >
          {copied ? <Check className="h-4 w-4 text-mt-success" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
        </button>
        {menuOpen && shareMenu?.length > 0 && (
          <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-mt-card border border-mt-line bg-mt-surface py-1 shadow-2xl shadow-mt-tint/10">
            {shareMenu.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  item.onClick();
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-mt-muted hover:bg-mt-tint/5 hover:text-mt-text"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={favorite ? "Remove from wishlist" : "Save to wishlist"}
            aria-pressed={Boolean(favorite)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-mt-muted transition-colors hover:bg-mt-tint/10 hover:text-mt-text"
          >
            <Heart className={cx("h-4 w-4", favorite && "fill-current text-mt-text")} aria-hidden="true" />
          </button>
        )}
        {extra}
      </div>
    </div>
  );
};

/** Two-column page grid: gallery (7/12) + sticky details (5/12). */
export const ProductLayout = ({ gallery, children }) => (
  <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-3 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-20">
    <div className="lg:col-span-7">{gallery}</div>
    <section aria-label="Product details" className="lg:col-span-5">
      <div className="lg:sticky lg:top-40">{children}</div>
    </section>
  </div>
);

/** Eyebrow, title and optional rating link. */
export const ProductHeading = ({ eyebrow, title, rating, reviewCount, onReviewsClick, children }) => (
  <div>
    {eyebrow && <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">{eyebrow}</p>}
    <h1 className="mt-2 text-2xl font-medium leading-tight text-mt-text sm:text-3xl">{title}</h1>
    {onReviewsClick && (
      <button
        type="button"
        onClick={onReviewsClick}
        className="mt-3 inline-flex items-center gap-2 text-sm text-mt-muted transition-colors hover:text-mt-text"
      >
        <span className="flex items-center" aria-hidden="true">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cx("h-4 w-4", i < Math.round(Number(rating) || 0) ? "fill-current text-mt-text" : "text-mt-line-strong")}
            />
          ))}
        </span>
        {reviewCount > 0 ? (
          <span>
            {Number(rating).toFixed(1)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span>No reviews yet</span>
        )}
      </button>
    )}
    {children}
  </div>
);

/** Price, struck original price, savings line and tax note. */
export const PriceBlock = ({ price, compareAt, saving, note = "Inclusive of all taxes", children }) => (
  <div className="mt-5">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-2xl font-medium text-mt-text sm:text-3xl">{price}</span>
      {compareAt && <span className="text-base text-mt-subtle line-through">{compareAt}</span>}
      {saving && <span className="text-sm font-medium text-mt-success">{saving}</span>}
    </div>
    {note && <p className="mt-1 text-xs text-mt-subtle">{note}</p>}
    {children}
  </div>
);

/** A titled block separated by a hairline (colour, size, purchase...). */
export const DetailSection = ({ children, className }) => (
  <div className={cx("mt-6 space-y-6 border-t border-mt-line pt-6", className)}>{children}</div>
);

/**
 * Size grid. sizes: [{ value, label?, disabled?, title? }].
 * `id` lets "Add to cart" scroll here when no size is chosen.
 */
export const SizePicker = ({ id, sizes = [], selected, onSelect, error, hint, sizeGuideHref, onSizeGuide, label = "Size", locked = false }) => (
  <div id={id} className="scroll-mt-40">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm text-mt-text">
        {label}
        {selected ? <span className="text-mt-muted">: {selected}</span> : null}
      </h2>
      {sizeGuideHref && (
        <a
          href={sizeGuideHref}
          onClick={onSizeGuide}
          className="inline-flex items-center gap-1 text-xs text-mt-accent underline underline-offset-4 hover:text-mt-accent-strong"
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
          Size guide
        </a>
      )}
    </div>
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {sizes.map((size) => {
        const isSelected = String(selected || "").toUpperCase() === String(size.value).toUpperCase();
        return (
          <button
            key={size.value}
            type="button"
            onClick={() => !size.disabled && !locked && onSelect?.(size.value)}
            disabled={size.disabled || locked}
            aria-pressed={isSelected}
            title={size.title}
            className={cx(
              "h-12 rounded-mt-btn border text-sm transition-colors",
              locked && !size.disabled && "cursor-wait opacity-50",
              isSelected
                ? "border-mt-text bg-mt-btn font-medium text-mt-btn-text"
                : size.disabled
                  ? "cursor-not-allowed border-mt-line text-mt-subtle line-through"
                  : "border-mt-line-strong text-mt-text hover:border-mt-text"
            )}
          >
            {size.label ?? size.value}
          </button>
        );
      })}
    </div>
    {error ? (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-mt-danger" role="alert">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {error}
      </p>
    ) : hint ? (
      <p className="mt-2 text-xs text-mt-muted">{hint}</p>
    ) : null}
  </div>
);

/** Round colour swatches (single choice). */
export const ColorSwatches = ({ colors = [], selected, onSelect, label = "Colour" }) => (
  <div>
    <h2 className="mb-3 text-sm text-mt-text">
      {label}
      {selected ? <span className="text-mt-muted">: {selected}</span> : null}
    </h2>
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={label}>
      {colors.map((color) => {
        const isSelected = selected === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={color}
            title={color}
            onClick={() => onSelect?.(color)}
            className={cx(
              "h-9 w-9 rounded-full border border-mt-tint/25 transition-shadow",
              isSelected
                ? "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-bg"
                : "hover:ring-1 hover:ring-mt-line-strong hover:ring-offset-2 hover:ring-offset-mt-bg"
            )}
            style={{ backgroundColor: String(color).toLowerCase() }}
          />
        );
      })}
    </div>
  </div>
);

/** − n + stepper. */
export const QuantityStepper = ({ value, onDecrease, onIncrease, decreaseDisabled, increaseDisabled }) => (
  <div className="flex h-12 items-center rounded-mt-btn border border-mt-line-strong" role="group" aria-label="Quantity">
    <button
      type="button"
      onClick={onDecrease}
      disabled={decreaseDisabled}
      aria-label="Decrease quantity"
      className="flex h-full w-11 items-center justify-center text-lg text-mt-text transition-colors hover:bg-mt-tint/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      −
    </button>
    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      onClick={onIncrease}
      disabled={increaseDisabled}
      aria-label="Increase quantity"
      className="flex h-full w-11 items-center justify-center text-lg text-mt-text transition-colors hover:bg-mt-tint/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      +
    </button>
  </div>
);

const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />;

/** White primary purchase button (Add to cart). Extra props (id, data-*) pass through. */
export const PrimaryPurchaseButton = ({ children, busy, done, icon: Icon = ShoppingCart, className, ...rest }) => (
  <button
    type="button"
    className={cx(
      "inline-flex h-12 items-center justify-center gap-2 rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text transition-colors hover:bg-mt-btn-hover disabled:cursor-not-allowed disabled:bg-mt-line-strong disabled:text-mt-subtle",
      className
    )}
    {...rest}
  >
    {busy ? spinner : done ? <Check className="h-4 w-4" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
    {children}
  </button>
);

/** Outline secondary purchase button (Buy now). */
export const SecondaryPurchaseButton = ({ children, icon: Icon, className, ...rest }) => (
  <button
    type="button"
    className={cx(
      "inline-flex h-12 w-full items-center justify-center gap-2 rounded-mt-btn border border-mt-accent text-sm font-medium text-mt-accent-strong transition-colors hover:bg-mt-accent/10 disabled:cursor-not-allowed disabled:border-mt-line disabled:text-mt-subtle",
      className
    )}
    {...rest}
  >
    {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
    {children}
  </button>
);

/** Three small reassurance points. */
export const TrustRow = () => (
  <ul className="mt-6 grid grid-cols-3 gap-2 border-y border-mt-line py-4 text-center text-[11px] text-mt-muted sm:text-xs">
    <li className="flex flex-col items-center gap-1.5">
      <Truck className="h-4 w-4 text-mt-text" aria-hidden="true" />
      Ships across India
    </li>
    <li className="flex flex-col items-center gap-1.5">
      <RefreshCw className="h-4 w-4 text-mt-text" aria-hidden="true" />
      <a href="/return-refund-policy" className="hover:text-mt-text">Easy returns</a>
    </li>
    <li className="flex flex-col items-center gap-1.5">
      <Shield className="h-4 w-4 text-mt-text" aria-hidden="true" />
      Secure checkout
    </li>
  </ul>
);

/** Wrapper for the fold-out information sections. */
export const InfoSections = ({ children }) => (
  <div className="divide-y divide-mt-line border-b border-mt-line">{children}</div>
);

/** One fold-out section (native <details>, keyboard accessible). */
export const InfoSection = ({ id, title, defaultOpen = false, children }) => (
  <details id={id} className="group scroll-mt-40" open={defaultOpen || undefined}>
    <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
      {title}
      <ChevronRight className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
    </summary>
    <div className="pb-5">{children}</div>
  </details>
);

/** Label / value rows inside an InfoSection. rows: [{ label, value }] */
export const DetailList = ({ rows = [] }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
    {rows.map((row) => (
      <div key={row.label} className="contents">
        <dt className="text-mt-subtle">{row.label}</dt>
        <dd className="text-mt-text">{row.value}</dd>
      </div>
    ))}
  </dl>
);

/** Fixed bottom bar on phones: price + caption + one main action. */
export const MobilePurchaseBar = ({ price, compareAt, caption, children }) => (
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mt-line bg-mt-bg/95 px-4 py-3 backdrop-blur lg:hidden">
    <div className="mx-auto flex max-w-xl items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium leading-tight text-mt-text">
          {price}
          {compareAt && <span className="ml-2 text-xs font-normal text-mt-subtle line-through">{compareAt}</span>}
        </p>
        {caption && <p className="truncate text-[11px] text-mt-subtle">{caption}</p>}
      </div>
      {children}
    </div>
  </div>
);

/** Small bottom toast. type: success | error | info */
export const ProductToast = ({ show, type = "info", message, onClose, showCartLink, offsetClass = "bottom-24 lg:bottom-8" }) => {
  if (!show) return null;
  return (
    <div className={cx("fixed inset-x-0 z-50 flex justify-center px-4", offsetClass)} role="status" aria-live="polite">
      <div
        className={cx(
          "flex max-w-md items-center gap-3 rounded-mt-card border bg-mt-surface px-4 py-3 text-sm shadow-2xl shadow-mt-tint/10",
          type === "success" ? "border-mt-success/40" : type === "error" ? "border-mt-danger/40" : "border-mt-line-strong"
        )}
      >
        {type === "success" ? (
          <Check className="h-4 w-4 shrink-0 text-mt-success" aria-hidden="true" />
        ) : type === "error" ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-mt-danger" aria-hidden="true" />
        ) : (
          <Info className="h-4 w-4 shrink-0 text-mt-muted" aria-hidden="true" />
        )}
        <span className="text-mt-text">{message}</span>
        {showCartLink && (
          <Link to="/cart" className="ml-1 shrink-0 text-mt-accent underline underline-offset-4 hover:text-mt-accent-strong">
            View cart
          </Link>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Dismiss" className="ml-1 shrink-0 text-mt-subtle hover:text-mt-text">
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/** Loading skeleton matching the product layout. */
export const ProductPageSkeleton = ({ label = "Loading product…" }) => (
  <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-10">
      <div className="lg:col-span-7">
        <div className="aspect-[4/5] w-full animate-pulse rounded-mt-card bg-mt-surface-raised" />
      </div>
      <div className="space-y-4 lg:col-span-5">
        <div className="h-3 w-32 animate-pulse rounded bg-mt-surface-raised" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-mt-surface-raised" />
        <div className="h-6 w-40 animate-pulse rounded bg-mt-surface-raised" />
        <div className="h-px bg-mt-line" />
        <div className="h-12 w-full animate-pulse rounded bg-mt-surface-raised" />
        <div className="h-12 w-full animate-pulse rounded bg-mt-surface-raised" />
      </div>
    </div>
  </div>
);

/** "Not found" message with two actions. */
export const ProductNotFound = ({ title = "Product not found", message, onBack, browseLabel, onBrowse }) => (
  <div className="flex min-h-screen items-center justify-center bg-mt-bg p-4 font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
    <div className="w-full max-w-md text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-mt-surface-raised">
        <AlertCircle className="h-6 w-6 text-mt-muted" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-medium text-mt-text">{title}</h1>
      {message && <p className="mt-2 text-sm text-mt-muted">{message}</p>}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-mt-btn border border-mt-text px-5 text-sm font-medium text-mt-text transition-colors hover:bg-mt-tint/10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
        )}
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            className="inline-flex h-11 items-center justify-center rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text transition-colors hover:bg-mt-btn-hover"
          >
            {browseLabel || "Browse products"}
          </button>
        )}
      </div>
    </div>
  </div>
);

/** Root wrapper for every product page. */
export const ProductPage = ({ children, withMobileBar = true }) => (
  <div className={cx("min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]", withMobileBar && "pb-24 lg:pb-0")}>
    {children}
  </div>
);
