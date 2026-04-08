import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import {
  selectCurrentToken,
  selectCurrentUser,
} from "../redux/slices/Userslice.js";

const API_BASE = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];
const DEFAULT_COLORS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#000000", label: "Black" },
  { value: "#FF6B6B", label: "Coral" },
  { value: "#4ECDC4", label: "Mint" },
];
const DEFAULT_IMAGE_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: "", price: 100 },
];
const DEFAULT_TEXT_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: "", price: 100 },
];

const createEmptyColor = () => ({ label: "", value: "#FFFFFF" });
const createEmptySizeRow = () => ({ size: "M", price: 0, stock: 0 });
const createEmptyImagePriceRule = () => ({ maxSideInches: "", price: 0 });
const createEmptyTextPriceRule = () => ({ maxSideInches: "", price: 0 });

const normalizeColors = (colors = []) =>
  Array.isArray(colors) && colors.length > 0
    ? colors.map((entry) => ({
        label: entry?.label || "",
        value: entry?.value || "#FFFFFF",
      }))
    : DEFAULT_COLORS;

const normalizeSizePricing = (sizePricing = []) =>
  Array.isArray(sizePricing) && sizePricing.length > 0
    ? sizePricing.map((entry) => ({
        size: entry?.size || "M",
        price: Number(entry?.price || 0),
        stock: Number(entry?.stock || 0),
      }))
    : [createEmptySizeRow()];

const normalizeImagePriceRules = (rules = []) =>
  Array.isArray(rules) && rules.length > 0
    ? rules.map((entry) => ({
        maxSideInches:
          entry?.maxSideInches === null || entry?.maxSideInches === undefined
            ? ""
            : String(entry.maxSideInches),
        price: Number(entry?.price || 0),
      }))
    : DEFAULT_IMAGE_PRICE_RULES;

const formatImageSlabSize = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "";
  return `${numericValue} x ${numericValue} inches`;
};

const describeImagePriceRule = (rules = [], index = 0) => {
  const rule = rules[index];
  const currentSize = formatImageSlabSize(rule?.maxSideInches);

  if (currentSize) {
    return `This rule applies to each uploaded image up to ${currentSize}.`;
  }

  const previousRule = rules[index - 1];
  const previousSize = formatImageSlabSize(previousRule?.maxSideInches);

  if (previousSize) {
    return `This final rule applies to each uploaded image larger than ${previousSize}.`;
  }

  return "This rule applies to each uploaded image that does not match an earlier slab.";
};

const mapProductToForm = (product) => ({
  _id: product?._id || "",
  name: product?.name || "",
  slug: product?.slug || "",
  category: product?.category || "",
  subCategory: product?.subCategory || "",
  currency: product?.currency || "INR",
  basePrice: Number(product?.basePrice || 0),
  pricingMode: product?.pricingMode || "normal",
  colors: normalizeColors(product?.colors),
  sizePricing: normalizeSizePricing(product?.sizePricing),
  unlimitedPricing: {
    enabled: Boolean(product?.unlimitedPricing?.enabled),
    flatCharge: Number(product?.unlimitedPricing?.flatCharge || 0),
    label: product?.unlimitedPricing?.label || "Unlimited Design",
    description:
      product?.unlimitedPricing?.description ||
      "Design as much as you want at a fixed price",
  },
  normalPricing: {
    fixedSizeInches: Number(product?.normalPricing?.fixedSizeInches || 4),
    pricePerSqInch: Number(product?.normalPricing?.pricePerSqInch || 6),
    sleevePrice: Number(product?.normalPricing?.sleevePrice || 30),
    imagePriceRules: normalizeImagePriceRules(product?.normalPricing?.imagePriceRules),
    textPriceRules: normalizeImagePriceRules(
      product?.normalPricing?.textPriceRules || product?.normalPricing?.imagePriceRules || DEFAULT_TEXT_PRICE_RULES
    ),
  },
  views: Array.isArray(product?.views) ? product.views : [],
});

const buildPayload = (form) => ({
  name: form.name.trim(),
  slug: form.slug.trim(),
  category: form.category.trim(),
  subCategory: form.subCategory.trim(),
  currency: form.currency.trim().toUpperCase(),
  basePrice: Number(form.basePrice || 0),
  pricingMode: form.pricingMode,
  colors: form.colors
    .map((entry) => ({
      label: String(entry.label || "").trim(),
      value: String(entry.value || "").trim().toUpperCase(),
    }))
    .filter((entry) => entry.label && entry.value),
  sizePricing: form.sizePricing.map((entry) => ({
    size: String(entry.size || "").trim().toUpperCase(),
    price: Number(entry.price || 0),
    stock: Number(entry.stock || 0),
  })),
  unlimitedPricing: {
    enabled: Boolean(form.unlimitedPricing.enabled),
    flatCharge: Number(form.unlimitedPricing.flatCharge || 0),
    label: form.unlimitedPricing.label.trim(),
    description: form.unlimitedPricing.description.trim(),
  },
  normalPricing: {
    fixedSizeInches: Number(form.normalPricing.fixedSizeInches || 0),
    pricePerSqInch: Number(form.normalPricing.pricePerSqInch || 0),
    sleevePrice: Number(form.normalPricing.sleevePrice || 0),
    imagePriceRules: form.normalPricing.imagePriceRules.map((entry) => ({
      maxSideInches:
        entry.maxSideInches === "" || entry.maxSideInches === null || entry.maxSideInches === undefined
          ? null
          : Number(entry.maxSideInches),
      price: Number(entry.price || 0),
    })),
    textPriceRules: form.normalPricing.textPriceRules.map((entry) => ({
      maxSideInches:
        entry.maxSideInches === "" || entry.maxSideInches === null || entry.maxSideInches === undefined
          ? null
          : Number(entry.maxSideInches),
      price: Number(entry.price || 0),
    })),
  },
});

export default function ProductPricingManager() {
  const token = useSelector(selectCurrentToken);
  const user = useSelector(selectCurrentUser);
  const isAdmin =
    user?.role === "admin" || user?.role === "superuser" || user?.isAdmin === true;

  const api = useMemo(
    () =>
      axios.create({
        baseURL: `${API_BASE}/products/admin`,
        headers: {
          Accept: "application/json",
        },
      }),
    []
  );

  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProduct = products.find((product) => product._id === selectedId) || null;
  const totalStock = (form?.sizePricing || []).reduce(
    (sum, row) => sum + Number(row.stock || 0),
    0
  );

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(""), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!token || !isAdmin) return;

    const loadProducts = async () => {
      try {
        setLoadingList(true);
        setError("");
        const response = await api.get("/list", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const productList = response.data?.data || [];
        setProducts(productList);

        if (!selectedId && productList.length > 0) {
          setSelectedId(productList[0]._id);
        }
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load customization products");
      } finally {
        setLoadingList(false);
      }
    };

    loadProducts();
  }, [api, isAdmin, selectedId, token]);

  useEffect(() => {
    if (!token || !selectedId || !isAdmin) return;

    const loadProduct = async () => {
      try {
        setLoadingProduct(true);
        setError("");
        const response = await api.get(`/${selectedId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForm(mapProductToForm(response.data?.data));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load product details");
      } finally {
        setLoadingProduct(false);
      }
    };

    loadProduct();
  }, [api, isAdmin, selectedId, token]);

  const updateFormField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateNestedField = (section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const updateColor = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const updateSizeRow = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      sizePricing: prev.sizePricing.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const updateImagePriceRule = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        imagePriceRules: prev.normalPricing.imagePriceRules.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, [field]: value } : entry
        ),
      },
    }));
  };

  const updateTextPriceRule = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        textPriceRules: prev.normalPricing.textPriceRules.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, [field]: value } : entry
        ),
      },
    }));
  };

  const addColorRow = () => {
    setForm((prev) => ({
      ...prev,
      colors: [...prev.colors, createEmptyColor()],
    }));
  };

  const removeColorRow = (index) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const addSizeRow = () => {
    setForm((prev) => ({
      ...prev,
      sizePricing: [...prev.sizePricing, createEmptySizeRow()],
    }));
  };

  const addImagePriceRule = () => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        imagePriceRules: [...prev.normalPricing.imagePriceRules, createEmptyImagePriceRule()],
      },
    }));
  };

  const addTextPriceRule = () => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        textPriceRules: [...prev.normalPricing.textPriceRules, createEmptyTextPriceRule()],
      },
    }));
  };

  const removeSizeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      sizePricing: prev.sizePricing.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const removeImagePriceRule = (index) => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        imagePriceRules: prev.normalPricing.imagePriceRules.filter((_, entryIndex) => entryIndex !== index),
      },
    }));
  };

  const removeTextPriceRule = (index) => {
    setForm((prev) => ({
      ...prev,
      normalPricing: {
        ...prev.normalPricing,
        textPriceRules: prev.normalPricing.textPriceRules.filter((_, entryIndex) => entryIndex !== index),
      },
    }));
  };

  const handleSave = async () => {
    if (!form || !selectedId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put(`/${selectedId}`, buildPayload(form), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updatedProduct = response.data?.data;
      setForm(mapProductToForm(updatedProduct));
      setProducts((prev) =>
        prev.map((product) => (product._id === updatedProduct._id ? updatedProduct : product))
      );
      setSuccess(response.data?.message || "Customization product updated");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Please log in as admin to manage customization products.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          This page is restricted to admin users.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Customization Product Manager</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage product colors, sizes, stock, and slab-based image and text customization charges for seeded products.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Products</h2>
            {loadingList && <span className="text-xs text-slate-500">Loading...</span>}
          </div>

          <div className="space-y-2">
            {products.map((product) => {
              const productStock = (product.sizePricing || []).reduce(
                (sum, row) => sum + Number(row.stock || 0),
                0
              );

              return (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => setSelectedId(product._id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedId === product._id
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{product.slug}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Sizes: {(product.sizePricing || []).length}</span>
                    <span>Stock: {productStock}</span>
                  </div>
                </button>
              );
            })}

            {!loadingList && products.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No customization products found.
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {loadingProduct || !form ? (
            <div className="py-16 text-center text-sm text-slate-500">
              {loadingProduct ? "Loading product details..." : "Select a product to edit"}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{form.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {form.slug} • {selectedProduct?.category || form.category || "Uncategorized"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Total stock: <span className="font-semibold text-slate-900">{totalStock}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateFormField("name", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Slug</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => updateFormField("slug", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => updateFormField("category", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Subcategory</span>
                  <input
                    type="text"
                    value={form.subCategory}
                    onChange={(e) => updateFormField("subCategory", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Base Price</span>
                  <input
                    type="number"
                    min="0"
                    value={form.basePrice}
                    onChange={(e) => updateFormField("basePrice", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => updateFormField("currency", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-sky-500"
                  />
                </label>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Product Colors</h3>
                  <button
                    type="button"
                    onClick={addColorRow}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Add Color
                  </button>
                </div>

                <div className="space-y-3">
                  {form.colors.map((color, index) => (
                    <div
                      key={`${color.value}-${index}`}
                      className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_160px_48px]"
                    >
                      <input
                        type="text"
                        value={color.label}
                        onChange={(e) => updateColor(index, "label", e.target.value)}
                        placeholder="Color label"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                      <input
                        type="color"
                        value={color.value}
                        onChange={(e) => updateColor(index, "value", e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeColorRow(index)}
                        disabled={form.colors.length === 1}
                        className="rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Sizes, Prices and Stock</h3>
                  <button
                    type="button"
                    onClick={addSizeRow}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Add Size
                  </button>
                </div>

                <div className="space-y-3">
                  {form.sizePricing.map((row, index) => (
                    <div
                      key={`${row.size}-${index}`}
                      className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_48px]"
                    >
                      <select
                        value={row.size}
                        onChange={(e) => updateSizeRow(index, "size", e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      >
                        {SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={row.price}
                        onChange={(e) => updateSizeRow(index, "price", e.target.value)}
                        placeholder="Price"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                      <input
                        type="number"
                        min="0"
                        value={row.stock}
                        onChange={(e) => updateSizeRow(index, "stock", e.target.value)}
                        placeholder="Stock"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeSizeRow(index)}
                        disabled={form.sizePricing.length === 1}
                        className="rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Pricing Mode</h3>
                    <select
                      value={form.pricingMode}
                      onChange={(e) => updateFormField("pricingMode", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Flat Charge</span>
                      <input
                        type="number"
                        min="0"
                        value={form.unlimitedPricing.flatCharge}
                        onChange={(e) =>
                          updateNestedField("unlimitedPricing", "flatCharge", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Label</span>
                      <input
                        type="text"
                        value={form.unlimitedPricing.label}
                        onChange={(e) =>
                          updateNestedField("unlimitedPricing", "label", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
                      <textarea
                        value={form.unlimitedPricing.description}
                        onChange={(e) =>
                          updateNestedField("unlimitedPricing", "description", e.target.value)
                        }
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Per-Image Pricing Rules</h3>
                    <button
                      type="button"
                      onClick={addImagePriceRule}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Image Rule
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                      Upload charges are applied per image. Example: set `4 -&gt; 40` and a final empty slab `100`
                      to charge `₹40` for images up to `4 x 4` inches and `₹100` for anything above `4 x 4`.
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      <p className="font-semibold">How admins should read this section</p>
                      <p className="mt-1">
                        Each uploaded image is charged separately. The system checks the image size in inches, picks the
                        first matching slab below, and applies that slab price once for that image.
                      </p>
                      <p className="mt-2">
                        Example: if 3 images are uploaded and all 3 fall into the same slab, that slab charge is added 3
                        times.
                      </p>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Sleeve Price</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.normalPricing.sleevePrice}
                        onChange={(e) =>
                          updateNestedField("normalPricing", "sleevePrice", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                      />
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2">
                        <p className="text-sm font-medium text-slate-700">Image Price Slabs</p>
                        <p className="text-xs text-slate-500">
                          Add slabs from smaller image sizes to larger image sizes. Leave the size empty only in the last
                          slab, so it works as the final rule for anything above the previous slab.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {form.normalPricing.imagePriceRules.map((rule, index) => (
                          <div
                            key={`${rule.maxSideInches}-${index}`}
                            className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]"
                          >
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-600">
                                {rule.maxSideInches === "" ? "Final rule: above previous slab" : `Rule ${index + 1}: up to this image size`}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={rule.maxSideInches}
                                onChange={(e) => updateImagePriceRule(index, "maxSideInches", e.target.value)}
                                placeholder="Example: 4, leave empty only for final rule"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                              <span className="mt-1 block text-[11px] text-slate-500">
                                {rule.maxSideInches === ""
                                  ? "This row is used for any image larger than the slab above."
                                  : "Example: 4 means this price applies up to 4 x 4 inches."}
                              </span>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Charge per image (Rs.)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={rule.price}
                                onChange={(e) => updateImagePriceRule(index, "price", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeImagePriceRule(index)}
                              disabled={form.normalPricing.imagePriceRules.length === 1}
                              className="rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              x
                            </button>
                            <div className="sm:col-span-2">
                              <p className="text-xs text-slate-500">
                                {describeImagePriceRule(form.normalPricing.imagePriceRules, index)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Per-Text Pricing Rules</h3>
                    <button
                      type="button"
                      onClick={addTextPriceRule}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Text Rule
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                      Text charges are also applied per text layer. The same slab logic is used: up to a size limit gets
                      one price, and the final empty slab covers anything larger.
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      <p className="font-semibold">How admins should read this section</p>
                      <p className="mt-1">
                        Each text layer is measured by its printed width and height in inches, then the first matching slab
                        is applied once for that text layer.
                      </p>
                      <p className="mt-2">
                        Example: if a customer adds 2 separate text layers, the matching text charge is added 2 times.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2">
                        <p className="text-sm font-medium text-slate-700">Text Price Slabs</p>
                        <p className="text-xs text-slate-500">
                          Add slabs from smaller text sizes to larger text sizes. Leave the size empty only in the last
                          slab, so it works as the final rule for anything above the previous slab.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {form.normalPricing.textPriceRules.map((rule, index) => (
                          <div
                            key={`${rule.maxSideInches}-${index}-text`}
                            className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]"
                          >
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-600">
                                {rule.maxSideInches === "" ? "Final rule: above previous slab" : `Rule ${index + 1}: up to this text size`}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={rule.maxSideInches}
                                onChange={(e) => updateTextPriceRule(index, "maxSideInches", e.target.value)}
                                placeholder="Example: 4, leave empty only for final rule"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                              <span className="mt-1 block text-[11px] text-slate-500">
                                {rule.maxSideInches === ""
                                  ? "This row is used for any text layer larger than the slab above."
                                  : "Example: 4 means this price applies up to 4 x 4 inches."}
                              </span>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Charge per text layer (Rs.)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={rule.price}
                                onChange={(e) => updateTextPriceRule(index, "price", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeTextPriceRule(index)}
                              disabled={form.normalPricing.textPriceRules.length === 1}
                              className="rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              x
                            </button>
                            <div className="sm:col-span-2">
                              <p className="text-xs text-slate-500">
                                {describeImagePriceRule(form.normalPricing.textPriceRules, index)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">Configured Views</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {form.views.length > 0 ? (
                    form.views.map((view) => (
                      <div key={view.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-sm font-semibold text-slate-900">{view.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{view.code}</div>
                        <div className="mt-3 text-[11px] text-slate-500">
                          <div>Mockup: {view.mockupUrl || "Not set"}</div>
                          <div className="mt-1">Mask: {view.maskUrl || "Not set"}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No views configured for this product.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
