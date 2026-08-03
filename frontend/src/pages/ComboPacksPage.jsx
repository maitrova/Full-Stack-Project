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
  (combo?.items || [])
    .map((item) => item.product)
    .filter(Boolean)
    .slice(0, 2);

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
    <div className="min-h-screen bg-[#f7f7f5]">
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-950">Shop money-saving combos</h2>
            <p className="text-sm text-gray-500">
              {loading ? "Finding the best offers..." : `${combos.length} bundle${combos.length === 1 ? "" : "s"} available`}
            </p>
          </div>
          <label className="relative w-full sm:w-96">
            <Search className="pointer-events-none absolute left-3 top-3 text-gray-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search combos"
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-gray-950 focus:ring-2 focus:ring-gray-100"
            />
          </label>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="aspect-[4/3] animate-pulse bg-gray-100" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                  <div className="h-5 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : combos.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {combos.map((combo) => {
              const previewProducts = getComboPreviewProducts(combo);
              const originalPrice = Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
              const savings = Number(combo.pricing?.savingsAmount || 0);
              const discount = Number(combo.pricing?.discountPercentage || 0);

              return (
                <article key={combo._id} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">
                  <Link to={`/combo-packs/${combo.slug}`} className="block">
                    <div className="relative aspect-[4/3] bg-white px-4 pb-4 pt-5">
                      {discount > 0 && (
                        <span className="absolute right-3 top-3 z-10 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                          {discount}% OFF
                        </span>
                      )}
                      {savings > 0 && (
                        <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                          Save {formatPrice(savings, combo.currency)}
                        </span>
                      )}
                      <div className="flex h-full items-center justify-center rounded-xl border border-gray-100 bg-gray-50 px-3 pt-8">
                        {previewProducts.length ? (
                          <div className="grid w-full grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2">
                            {previewProducts.map((product, index) => {
                              const image = getProductImage(product);
                              return (
                                <React.Fragment key={`${product._id || product.title}-${index}`}>
                                  <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-100">
                                    {image ? (
                                      <img
                                        src={buildImageUrl(image)}
                                        alt={product.title || ""}
                                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <Package className="text-gray-300" size={26} />
                                    )}
                                  </div>
                                  {index === 0 && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xl font-bold text-gray-950 shadow-sm ring-1 ring-gray-200">
                                      +
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {previewProducts.length === 1 && (
                              <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-100">
                                <Package className="text-gray-300" size={26} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="text-gray-400" />
                          </div>
                        )}
                        <div className="absolute bottom-3 left-3 rounded-md bg-yellow-300 px-2.5 py-1 text-[11px] font-bold text-gray-950 shadow-sm">
                          Combo Offer
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                        <Layers size={12} />
                        {combo.includedProductsCount} products included
                      </p>
                      <h3 className="mt-2 line-clamp-2 min-h-10 text-base font-semibold leading-5 text-gray-950">{combo.name}</h3>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-gray-950">
                          {formatPrice(combo.comboPrice, combo.currency)}
                        </span>
                        {originalPrice > Number(combo.comboPrice) && (
                          <span className="text-sm text-gray-400 line-through">
                            {formatPrice(originalPrice, combo.currency)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-gray-500">Combo price</span>
                        {savings > 0 && (
                          <span className="font-semibold text-emerald-700">
                            You save {formatPrice(savings, combo.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/combo-packs/${combo.slug}`}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-3 text-sm font-semibold text-white transition hover:bg-gray-800"
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
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Package className="text-gray-400" size={30} />
            </div>
            <h3 className="mt-4 font-semibold text-gray-950">No combo packs found</h3>
            <p className="mt-1 text-sm text-gray-500">Try a different search term or check back for new savings.</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-5 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
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
