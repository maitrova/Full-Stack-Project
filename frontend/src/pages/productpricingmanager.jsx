// src/components/AdminUnlimitedPricingManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

// from productsSlice
import { fetchProducts } from "../redux/slices/productsSlice.js"; // adjust path if needed

// from productPricingSlice
import {
  getProductPricing,
  toggleUnlimitedPricing,
  selectUnlimitedPricing,
  selectIsToggleUnlimitedLoading,
} from "../redux/slices/productpricing.js"; // adjust path

export default function AdminUnlimitedPricingManager() {
  const dispatch = useDispatch();

  // Products list state (based on your slice shape)
  const items = useSelector((state) => state.products.items);
  const itemsStatus = useSelector((state) => state.products.itemsStatus);
  const itemsError = useSelector((state) => state.products.itemsError);

  // Pricing toggle state
  const unlimited = useSelector(selectUnlimitedPricing);
  const isToggling = useSelector(selectIsToggleUnlimitedLoading);

  // Selected product (admin picks)
  const [selectedId, setSelectedId] = useState("");

  // Fetch products list on mount
  useEffect(() => {
    if (itemsStatus === "idle") {
      dispatch(fetchProducts());
    }
  }, [dispatch, itemsStatus]);

  // When selected product changes, fetch its pricing (to sync toggle state)
  useEffect(() => {
    if (!selectedId) return;
    dispatch(getProductPricing(selectedId));
  }, [dispatch, selectedId]);

  const selectedProduct = useMemo(() => {
    if (!selectedId) return null;
    return items?.find((p) => p._id === selectedId) || null;
  }, [items, selectedId]);

  const enabled = Boolean(unlimited?.enabled);

  const onToggle = async () => {
    if (!selectedId) return;

    await dispatch(
      toggleUnlimitedPricing({
        id: selectedId,
        enabled: !enabled, // ✅ explicitly send next state
        // If you want to update these too, add flatCharge/label/description here
      })
    );

    // optional: re-fetch to ensure UI matches backend
    dispatch(getProductPricing(selectedId));
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Unlimited Pricing Toggle
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Select a product, then enable/disable unlimited pricing.
      </p>

      {/* Product selector */}
      <div className="mt-5">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">
            Select Product
          </div>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">-- Select --</option>
            {(items || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.title || p.name || p.slug || p._id}
              </option>
            ))}
          </select>
        </label>

        {itemsStatus === "loading" && (
          <div className="mt-2 text-sm text-slate-600">Loading products…</div>
        )}

        {itemsStatus === "failed" && (
          <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {itemsError?.message || "Failed to load products"}
          </div>
        )}
      </div>

      {/* Selected product info + toggle */}
      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {selectedProduct ? (selectedProduct.title || selectedProduct.name) : "No product selected"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedId ? `ID: ${selectedId}` : "Pick a product to enable the toggle."}
            </div>
            {selectedId && (
              <div className="mt-2 text-sm text-slate-600">
                Status:{" "}
                <span className="font-medium text-slate-900">
                  {enabled ? "Unlimited Enabled" : "Unlimited Disabled"}
                </span>
              </div>
            )}
          </div>

          {/* Toggle */}
          <button
            type="button"
            onClick={onToggle}
            disabled={!selectedId || isToggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
              enabled ? "bg-emerald-600" : "bg-slate-300"
            }`}
            aria-pressed={enabled}
            aria-label="Toggle unlimited pricing"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {!selectedId && (
          <div className="mt-3 text-sm text-slate-500">
            Select a product above to enable the toggle.
          </div>
        )}
      </div>
    </div>
  );
}
