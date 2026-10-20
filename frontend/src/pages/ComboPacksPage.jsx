import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Layers,
  Package,
  Search,
} from "lucide-react";
import axios from "axios";
import { buildImageUrl } from "../utils/responsiveImage.js";

const API_URL = import.meta.env.VITE_API_URL;

const formatPrice = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getProductImage = (product) => {
  if (product?.thumbnail) return product.thumbnail;
  const firstImage = product?.images?.[0];
  return typeof firstImage === "string" ? firstImage : firstImage?.url || "";
};

const getComboPreviewProducts = (combo) =>
  (combo?.selectionGroups?.length
    ? combo.selectionGroups
        .map((group) => group.eligibleProducts?.[0])
        .filter(Boolean)
    : (combo?.items || [])
        .map((item) => item.product)
        .filter(Boolean)
  ).slice(0, 2);

const ComboPacksPage = () => {
  const [combos, setCombos] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadCombos = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(`${API_URL}/combo-packs/public`, {
          params: { search },
          signal: controller.signal,
        });
        setCombos(response.data.data || []);
      } catch (err) {
        if (err.name !== "CanceledError") {
          setError(err.response?.data?.message || "Failed to load combo packs");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const timer = setTimeout(loadCombos, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  return (
    <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-mt-line bg-mt-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-normal text-mt-text">Shop money-saving combos</h2>
            <p className="text-sm text-mt-subtle">
              {loading ? "Finding the best offers..." : `${combos.length} bundle${combos.length === 1 ? "" : "s"} available`}
            </p>
          </div>
          <label className="relative w-full sm:w-96">
            <Search className="pointer-events-none absolute left-3 top-3 text-mt-subtle" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search combos"
              className="h-11 w-full rounded-xl border border-mt-line-strong bg-mt-surface pl-10 pr-3 text-sm outline-none focus:border-mt-text focus:ring-2 focus:ring-mt-line-strong"
            />
          </label>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-mt-danger/30 bg-mt-danger/10 px-4 py-3 text-sm text-mt-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-mt-line bg-mt-surface">
                <div className="aspect-[4/3] animate-pulse bg-mt-surface-raised" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-mt-surface-raised" />
                  <div className="h-5 animate-pulse rounded bg-mt-surface-raised" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-mt-surface-raised" />
                </div>
              </div>
            ))}
          </div>
        ) : combos.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {combos.map((combo) => {
              const previewProducts = getComboPreviewProducts(combo);
              const comboImage = combo.displayImage || combo.featuredImage || "";
              const originalPrice = Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
              const comboPrice = Number(combo.pricing?.comboPrice || combo.comboPrice || 0);
              const savings = Number(combo.pricing?.savingsAmount || 0);
              const discount = Number(combo.pricing?.discountPercentage || 0);

              return (
                <article key={combo._id} className="group overflow-hidden rounded-2xl border border-mt-line bg-mt-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:border-mt-text hover:shadow-lg">
                  <Link to={`/combo-packs/${combo.slug}`} className="block">
                    <div className="relative aspect-[4/3] bg-mt-surface px-2 pb-2 pt-3 sm:px-4 sm:pb-4 sm:pt-5">
                      {discount > 0 && (
                        <span className="absolute right-2 top-2 z-10 rounded-full bg-mt-danger px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                          {discount}% OFF
                        </span>
                      )}
                      {savings > 0 && (
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-mt-success px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                          Save {formatPrice(savings, combo.currency)}
                        </span>
                      )}
                      <div className="flex h-full items-center justify-center rounded-xl border border-mt-line bg-mt-bg px-2 pt-6 sm:px-3 sm:pt-8">
                        {comboImage ? (
                          <img
                            src={buildImageUrl(comboImage)}
                            alt={combo.name || "Combo pack"}
                            className="h-full w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : previewProducts.length ? (
                          <div className="grid w-full grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2">
                            {previewProducts.map((product, index) => {
                              const image = getProductImage(product);
                              return (
                                <React.Fragment key={`${product._id || product.title}-${index}`}>
                                  <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-mt-photo p-2 shadow-sm ring-1 ring-mt-line">
                                    {image ? (
                                      <img
                                        src={buildImageUrl(image)}
                                        alt={product.title || ""}
                                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <Package className="text-mt-line-strong" size={26} />
                                    )}
                                  </div>
                                  {index === 0 && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mt-surface text-xl font-bold text-mt-text shadow-sm ring-1 ring-mt-line">
                                      +
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {previewProducts.length === 1 && (
                              <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-mt-surface p-2 shadow-sm ring-1 ring-mt-line">
                                <Package className="text-mt-line-strong" size={26} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="text-mt-subtle" />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm sm:bottom-3 sm:left-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                          Combo Offer
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                    <div>
                      <p className="inline-flex items-center gap-1 rounded-full bg-mt-surface-raised px-2 py-1 text-[11px] font-medium text-mt-muted">
                        <Layers size={12} />
                        {combo.includedProductsCount} products included
                      </p>
                      <h3 className="mt-2 line-clamp-2 min-h-9 text-sm font-semibold leading-5 text-mt-text sm:min-h-10 sm:text-base">{combo.name}</h3>
                    </div>
                    <div className="rounded-xl border border-mt-line bg-mt-bg p-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-mt-text sm:text-lg">
                          {formatPrice(comboPrice, combo.currency)}
                        </span>
                        {originalPrice > comboPrice && (
                          <span className="text-sm text-mt-subtle line-through">
                            {formatPrice(originalPrice, combo.currency)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-mt-subtle">Combo price</span>
                        {savings > 0 && (
                          <span className="font-semibold text-mt-success">
                            You save {formatPrice(savings, combo.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/combo-packs/${combo.slug}`}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-mt-btn px-2 text-xs font-semibold text-mt-btn-text transition hover:bg-mt-btn-hover sm:h-10 sm:gap-2 sm:px-3 sm:text-sm"
                    >
                      View Combo Deal
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-mt-line bg-mt-surface p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mt-surface-raised">
              <Package className="text-mt-subtle" size={30} />
            </div>
            <h3 className="mt-4 font-semibold text-mt-text">No combo packs found</h3>
            <p className="mt-1 text-sm text-mt-subtle">Try a different search term or check back for new savings.</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-5 rounded-xl border border-mt-line-strong px-4 py-2 text-sm font-semibold text-mt-text hover:bg-mt-tint/5"
            >
              Clear search
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ComboPacksPage;
