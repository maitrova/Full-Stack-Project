import { Bookmark, ChevronDown, RefreshCw } from "lucide-react";
import cx from "../ui/cx.js";
import Swatch from "../ui/Swatch.jsx";
import { PrimaryPurchaseButton, QuantityStepper, SizePicker } from "../product/ProductPageParts.jsx";

const rupees = (value) => `₹${Number(value || 0).toFixed(2).replace(/\.00$/, "")}`;

const Row = ({ label, detail, value, tone }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <div className="min-w-0">
      <p className={cx("text-sm", tone === "warning" ? "text-mt-warning" : "text-mt-text")}>{label}</p>
      {detail && <p className="text-xs text-mt-subtle">{detail}</p>}
    </div>
    <span className="shrink-0 text-sm tabular-nums text-mt-text">{value}</span>
  </div>
);

/** Colour, size and quantity pickers (also shown in the phone "Colour & size" sheet). */
export const OrderOptions = ({
  colors = [],
  selectedColor,
  selectedColorName,
  onColorChange,
  sizes = [],
  selectedSize,
  onSizeChange,
  basePrice,
  quantity,
  maxQuantity,
  onQuantityChange,
  isOutOfStock,
  stockNote,
}) => (
  <div className="space-y-5">
    <div>
      <h3 className="mb-3 text-sm text-mt-text">
        Colour<span className="text-mt-muted">: {selectedColorName}</span>
      </h3>
      <Swatch
        label="Product colour"
        value={String(selectedColor || "").toLowerCase()}
        onChange={onColorChange}
        colors={colors}
      />
    </div>

    {sizes.length > 0 && (
      <SizePicker
        sizes={sizes}
        selected={selectedSize}
        onSelect={onSizeChange}
        hint={`${rupees(basePrice)} for size ${selectedSize}`}
      />
    )}

    <div>
      <h3 className="mb-3 text-sm text-mt-text">Quantity</h3>
      <div className="flex items-center gap-3">
        <QuantityStepper
          value={quantity}
          onDecrease={() => onQuantityChange(quantity - 1)}
          onIncrease={() => onQuantityChange(quantity + 1)}
          decreaseDisabled={quantity <= 1}
          increaseDisabled={quantity >= Math.max(1, maxQuantity)}
        />
        {stockNote && (
          <p className={cx("text-xs", isOutOfStock ? "text-mt-danger" : "text-mt-subtle")}>{stockNote}</p>
        )}
      </div>
    </div>
  </div>
);

/**
 * Right-hand "buying" panel of the customizer: colour, size, quantity, price and
 * the two actions. Purely presentational; every value and handler comes from
 * DesignerPage so the existing pricing / cart / save logic is unchanged.
 */
const OrderPanel = ({
  productName,
  price,
  basePrice,
  priceBreakdown,
  pricingNotes = [],
  additionalAreaCharge = 0,
  minimumChargeNote,
  viewLabel = (code) => code,
  calculatingPrice,
  onRefreshPrice,
  colors = [],
  selectedColor,
  selectedColorName,
  onColorChange,
  sizes = [],
  selectedSize,
  onSizeChange,
  quantity,
  maxQuantity,
  onQuantityChange,
  isOutOfStock,
  stockNote,
  saveLabel,
  cartLabel,
  onSave,
  onAddToCart,
  busy,
  saving,
  addingToCart,
  addToCartId,
  className,
}) => {
  const images = priceBreakdown?.images?.items || [];
  const texts = priceBreakdown?.text?.items || [];
  const extras = Number(price || 0) - Number(basePrice || 0);

  return (
    <div className={cx("rounded-mt-card border border-mt-line bg-mt-surface p-5", className)}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">Your order</p>
      <h2 className="mt-1.5 text-xl leading-tight text-mt-text">{productName || "Custom product"}</h2>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-medium tabular-nums text-mt-text">{rupees(price)}</span>
        <span className="text-xs text-mt-subtle">{quantity > 1 ? "per piece" : "incl. of all taxes"}</span>
      </div>
      {extras > 0.009 && (
        <p className="mt-0.5 text-xs text-mt-subtle">
          {rupees(basePrice)} product + {rupees(extras)} printing
        </p>
      )}

      <div className="mt-5 border-t border-mt-line pt-5">
        <OrderOptions
          colors={colors}
          selectedColor={selectedColor}
          selectedColorName={selectedColorName}
          onColorChange={onColorChange}
          sizes={sizes}
          selectedSize={selectedSize}
          onSizeChange={onSizeChange}
          basePrice={basePrice}
          quantity={quantity}
          maxQuantity={maxQuantity}
          onQuantityChange={onQuantityChange}
          isOutOfStock={isOutOfStock}
          stockNote={stockNote}
        />
      </div>

      <details className="group mt-5 border-y border-mt-line">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
          <span>Price details</span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{rupees(price)}</span>
            <ChevronDown className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        <div className="pb-4">
          <Row label={`${productName || "Product"} (size ${selectedSize})`} value={rupees(basePrice)} />
          {images.map((item, index) => (
            <Row
              key={`image-${index}`}
              label={`Image ${index + 1} · ${viewLabel(item.viewCode)}`}
              detail={item.note}
              value={`+${rupees(item.price)}`}
            />
          ))}
          {texts.map((item, index) => (
            <Row
              key={`text-${index}`}
              label={`Text “${item.text}” · ${viewLabel(item.viewCode)}`}
              value={`+${rupees(item.price)}`}
            />
          ))}
          {priceBreakdown?.minimumCharges > 0 && (
            <Row label="Small text minimum charge" detail={minimumChargeNote} value={`+${rupees(priceBreakdown.minimumCharges)}`} tone="warning" />
          )}
          {additionalAreaCharge > 0 && (
            <Row label="Extra text area" value={`+${rupees(additionalAreaCharge)}`} />
          )}
          <div className="mt-2 flex items-center justify-between border-t border-mt-line pt-3">
            <span className="text-sm font-medium text-mt-text">Total</span>
            <span className="text-sm font-medium tabular-nums text-mt-text">{rupees(price)}</span>
          </div>

          {pricingNotes.length > 0 && (
            <div className="mt-4 rounded-mt-card bg-mt-bg p-3 text-xs text-mt-muted">
              <p className="mb-1.5 text-mt-text">How printing is priced</p>
              <p>Each image or text is charged by its printed size:</p>
              <ul className="mt-1 space-y-0.5">
                {pricingNotes.map((note) => (
                  <li key={note.label} className="flex justify-between gap-3">
                    <span>{note.label}</span>
                    <span className="tabular-nums">{rupees(note.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onRefreshPrice}
            disabled={calculatingPrice}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-mt-muted underline-offset-4 hover:text-mt-text hover:underline disabled:opacity-50"
          >
            <RefreshCw className={cx("h-3.5 w-3.5", calculatingPrice && "animate-spin")} aria-hidden="true" />
            {calculatingPrice ? "Updating price…" : "Update price"}
          </button>
        </div>
      </details>

      <div className="mt-5 space-y-2.5">
        <PrimaryPurchaseButton
          id={addToCartId}
          onClick={onAddToCart}
          aria-label="Add customized product to cart"
          data-meta-track="add-to-cart"
          disabled={busy}
          busy={addingToCart}
          className="w-full"
        >
          {cartLabel}
        </PrimaryPurchaseButton>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-mt-btn border border-mt-text text-sm font-medium text-mt-text transition-colors hover:bg-mt-tint/10 disabled:cursor-not-allowed disabled:border-mt-line-strong disabled:text-mt-subtle"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
          {saveLabel}
        </button>
      </div>
    </div>
  );
};

export default OrderPanel;
