import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { CheckCircle2, Gift, Plus, Sparkles } from "lucide-react";
import { addToCart } from "../redux/slices/Cartslice.js";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";

const formatRupees = (value) =>
  `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const RecommendationCard = ({ product, gapAmount }) => {
  const dispatch = useDispatch();
  const [size, setSize] = useState(product.sizes?.[0]?.size || "");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const selected = product.sizes?.find((entry) => entry.size === size) || product.sizes?.[0];
  const price = Number(selected?.price ?? product.price ?? 0);
  const productPath = buildReadymadeProductPath(product);
  const imageUrl = product.image ? buildImageUrl(product.image) : null;

  const handleAdd = async () => {
    setAdding(true);
    setError("");
    const payload = { kind: "READYMADE", readymadeProductId: product._id, qty: 1 };
    if (size) payload.size = size;
    const result = await dispatch(addToCart(payload));
    if (addToCart.rejected.match(result)) {
      setError(result.payload?.message || "Could not add this item");
    }
    setAdding(false);
  };

  return (
    <div className="flex w-40 flex-shrink-0 flex-col rounded-lg border border-mt-line bg-mt-surface p-2 sm:w-44">
      <Link to={productPath || "#"} className="block">
        <div className="aspect-square w-full overflow-hidden rounded-md bg-mt-surface-raised">
          {imageUrl ? (
            <img src={imageUrl} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 text-xs font-medium text-mt-text">{product.title}</p>
      </Link>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-sm font-semibold text-mt-text">{formatRupees(price)}</span>
        {Number(product.mrp) > price ? (
          <span className="text-xs text-mt-subtle line-through">{formatRupees(product.mrp)}</span>
        ) : null}
      </div>
      {price >= gapAmount ? (
        <span className="mt-1 w-fit rounded-full bg-mt-success/10 px-2 py-0.5 text-[10px] font-semibold text-mt-success">
          Unlocks offer
        </span>
      ) : null}
      <div className="mt-auto flex items-center gap-1 pt-2">
        {product.sizes?.length > 1 || product.sizes?.[0]?.size ? (
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-mt-line-strong px-1 py-1 text-xs"
            aria-label={`Size for ${product.title}`}
          >
            {product.sizes.map((entry) => (
              <option key={entry.size} value={entry.size}>
                {entry.size}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-mt-btn px-2 py-1 text-xs font-semibold text-mt-btn-text hover:bg-mt-btn-hover disabled:opacity-60"
        >
          <Plus className="h-3 w-3" />
          {adding ? "Adding" : "Add"}
        </button>
      </div>
      {error ? <p className="mt-1 text-[10px] text-mt-danger">{error}</p> : null}
    </div>
  );
};

const CartOffersPanel = ({ offers }) => {
  const [showAll, setShowAll] = useState(false);
  const { applied, nextUnlock, recommendations = [], offers: allOffers = [] } = offers || {};

  if (!allOffers.length) return null;

  return (
    <div className="mb-4 rounded-xl bg-mt-surface p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-mt-text" />
        <h2 className="text-lg font-normal text-mt-text">Offers for you</h2>
      </div>

      {applied ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-mt-success/30 bg-mt-success/10 px-3 py-2 text-sm text-mt-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{applied.benefitText}</strong> applied ({applied.name}). You save{" "}
            <strong>{formatRupees(applied.discountApplied)}</strong>.
          </span>
        </div>
      ) : null}

      {nextUnlock ? (
        <div className="mt-4">
          <p className="text-sm text-mt-text">
            <Sparkles className="mr-1 inline h-4 w-4 text-amber-500" />
            Add <strong>{formatRupees(nextUnlock.gapAmount)}</strong> more to unlock{" "}
            <strong>{nextUnlock.benefitText}</strong>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-mt-line">
            <div
              className="h-full rounded-full bg-mt-btn transition-all duration-500"
              style={{ width: `${nextUnlock.progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-mt-subtle">
            {formatRupees(nextUnlock.currentAmount)} of {formatRupees(nextUnlock.targetAmount)}
          </p>

          {recommendations.length ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-mt-text">Add one of these to get there</p>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {recommendations.map((product) => (
                  <RecommendationCard key={product._id} product={product} gapAmount={nextUnlock.gapAmount} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : applied ? (
        <p className="mt-3 text-sm text-mt-muted">You've unlocked the best offer available on this cart.</p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowAll((value) => !value)}
        className="mt-4 text-sm font-medium text-mt-text hover:underline"
      >
        {showAll ? "Hide all offers" : `View all offers (${allOffers.length})`}
      </button>

      {showAll ? (
        <ul className="mt-3 space-y-3">
          {allOffers.map((offer) => (
            <li key={offer.ruleId} className="rounded-lg border border-mt-line p-3">
              <p className="text-sm font-semibold text-mt-text">{offer.name}</p>
              {offer.description ? <p className="mt-0.5 text-xs text-mt-muted">{offer.description}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {offer.tiers.map((tier) => (
                  <span
                    key={tier.minCartAmount}
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      tier.unlocked ? "bg-mt-success/10 text-mt-success" : "bg-mt-surface-raised text-mt-muted"
                    }`}
                  >
                    Spend {formatRupees(tier.minCartAmount)} → {tier.benefitText}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-mt-subtle">
                {offer.hasCategoryLimit ? "Selected categories only. " : ""}
                {offer.includeComboPacks ? "" : "Combo packs don't count. "}
                {offer.stackWithCoupons ? "Works with coupons." : "Can't be combined with coupons."}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default CartOffersPanel;
