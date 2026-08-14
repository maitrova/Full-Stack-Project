import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Eye,
  Image,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;
const IMAGE_URL = import.meta.env.VITE_IMAGE_URL || API_URL;

const emptyForm = {
  name: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  comboPrice: "",
  originalPrice: "",
  status: "INACTIVE",
  seoTitle: "",
  seoDescription: "",
  allowDuplicateProducts: false,
  imageMode: "PRODUCT_IMAGES",
  featuredImage: null,
  existingFeaturedImage: "",
  galleryImages: [],
  bannerImage: null,
  items: [],
  paymentOptions: ["COD", "ONLINE"],
  discountPercentage: "",
  selectionGroups: [],
};

const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const buildImageSrc = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${IMAGE_URL}/${String(path).replace(/^\/+/, "")}`;
};

const getProductImage = (product) => {
  if (product?.thumbnail) return product.thumbnail;
  const first = product?.images?.[0];
  return typeof first === "string" ? first : first?.url || "";
};

const getProductPrice = (product) => {
  if (product?.pricing?.effectivePrice) return Number(product.pricing.effectivePrice);
  if (product?.effectivePrice) return Number(product.effectivePrice);
  if (product?.offerPrice) return Number(product.offerPrice);
  if (product?.salePrice) return Number(product.salePrice);
  if (Array.isArray(product?.variants) && product.variants.length) {
    const prices = product.variants
      .map((variant) => Number(variant.effectivePrice || variant.salePrice || variant.price || 0))
      .filter(Boolean);
    return prices.length ? Math.min(...prices) : Number(product.price || 0);
  }
  return Number(product?.price || 0);
};

const productLabel = (product) => {
  const brand = typeof product?.brand === "object" ? product.brand?.name : product?.brand;
  return brand ? `${product.title} - ${brand}` : product?.title || "Untitled product";
};

const getCategoryName = (category) =>
  typeof category === "object" ? category?.name || "Category" : "Category";

const getGroupProducts = (group) => group?.eligibleProducts || group?.products || [];

const getGroupPreviewPrice = (group) => {
  const prices = getGroupProducts(group).map(getProductPrice).filter((price) => price > 0);
  return prices.length ? Math.min(...prices) : 0;
};

const getPaymentLabel = (options = []) => {
  const normalized = Array.isArray(options) && options.length ? options : ["COD", "ONLINE"];
  const allowsCod = normalized.includes("COD");
  const allowsOnline = normalized.includes("ONLINE");

  if (allowsCod && allowsOnline) return "COD + Online";
  if (allowsCod) return "COD only";
  if (allowsOnline) return "Online only";
  return "Payment unavailable";
};

const ComboPacksManager = () => {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", dateFrom: "", dateTo: "" });
  const [productFilters, setProductFilters] = useState({ q: "", category: "", brand: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingCombo, setViewingCombo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const calculatedOriginalPrice = form.selectionGroups.reduce(
    (sum, group) => sum + getGroupPreviewPrice(group),
    0
  );
  const effectiveOriginalPrice = Number(form.originalPrice || 0) || calculatedOriginalPrice;
  const computedComboPrice = Number(form.comboPrice || 0);
  const savingsAmount = Math.max(effectiveOriginalPrice - computedComboPrice, 0);
  const discountPercentage =
    effectiveOriginalPrice > 0 && computedComboPrice > 0 && computedComboPrice < effectiveOriginalPrice
      ? Math.round((savingsAmount / effectiveOriginalPrice) * 100)
      : 0;

  const selectedProductIds = useMemo(
    () => form.selectionGroups.flatMap((group) => getGroupProducts(group).map((product) => String(product?._id || product))),
    [form.selectionGroups]
  );

  const loadCombos = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_URL}/combo-packs`, { params: filters });
      setCombos(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load combo packs");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/combo-packs/products/search`, {
        params: productFilters,
      });
      setProducts(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products");
    }
  };

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 250);
    return () => clearTimeout(timer);
  }, [productFilters]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [categoryResponse, brandResponse] = await Promise.all([
          axios.get(`${API_URL}/admin-category/category`),
          axios.get(`${API_URL}/brands/brand`),
        ]);
        setCategories(categoryResponse.data.data || []);
        setBrands(brandResponse.data.data || []);
      } catch {
        setCategories([]);
        setBrands([]);
      }
    };
    loadReferenceData();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
    setMessage("");
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updatePaymentOption = (option, checked) => {
    setForm((current) => {
      const currentOptions = Array.isArray(current.paymentOptions)
        ? current.paymentOptions
        : ["COD", "ONLINE"];
      const paymentOptions = checked
        ? [...new Set([...currentOptions, option])]
        : currentOptions.filter((entry) => entry !== option);

      return { ...current, paymentOptions };
    });
  };

  const addSelectionGroup = (categoryId = "") => {
    const category = categories.find((entry) => String(entry._id) === String(categoryId)) || null;
    setForm((current) => ({
      ...current,
      selectionGroups: [
        ...current.selectionGroups,
        {
          category: category || categoryId,
          label: category?.name || "",
          eligibleProducts: [],
          sortOrder: current.selectionGroups.length,
        },
      ],
    }));
    setActiveGroupIndex(form.selectionGroups.length);
    if (categoryId) setProductFilters((current) => ({ ...current, category: categoryId }));
  };

  const updateSelectionGroup = (index, updates) => {
    setForm((current) => ({
      ...current,
      selectionGroups: current.selectionGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...updates } : group
      ),
    }));
  };

  const removeSelectionGroup = (index) => {
    setForm((current) => ({
      ...current,
      selectionGroups: current.selectionGroups.filter((_, groupIndex) => groupIndex !== index),
    }));
    setActiveGroupIndex((current) => Math.max(0, Math.min(current, form.selectionGroups.length - 2)));
  };

  const addProduct = (product) => {
    const activeGroup = form.selectionGroups[activeGroupIndex];
    if (!activeGroup) {
      setError("Add a combo category before selecting eligible products");
      return;
    }
    const groupCategoryId = String(activeGroup.category?._id || activeGroup.category || "");
    const productCategoryId = String(product.category?._id || product.category || "");
    if (groupCategoryId && productCategoryId && groupCategoryId !== productCategoryId) {
      setError("This product does not belong to the active combo category");
      return;
    }
    const productId = String(product._id);
    const activeGroupProductIds = getGroupProducts(activeGroup).map((entry) => String(entry?._id || entry));
    if (activeGroupProductIds.includes(productId)) {
      setError("This product is already eligible for the active category");
      return;
    }
    if (!form.allowDuplicateProducts && selectedProductIds.includes(productId)) {
      setError("Enable duplicate products before reusing the same product in another category slot");
      return;
    }

    setError("");
    setForm((current) => ({
      ...current,
      selectionGroups: current.selectionGroups.map((group, groupIndex) =>
        groupIndex === activeGroupIndex
          ? { ...group, eligibleProducts: [...getGroupProducts(group), product] }
          : group
      ),
    }));
  };

  const removeProduct = (groupIndex, productIndex) => {
    setForm((current) => ({
      ...current,
      selectionGroups: current.selectionGroups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              eligibleProducts: getGroupProducts(group).filter((_, itemIndex) => itemIndex !== productIndex),
            }
          : group
      ),
    }));
  };

  const startCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setActiveGroupIndex(0);
    setShowForm(true);
    setViewingCombo(null);
  };

  const startEdit = (combo) => {
    setForm({
      ...emptyForm,
      name: combo.name || "",
      slug: combo.slug || "",
      shortDescription: combo.shortDescription || "",
      fullDescription: combo.fullDescription || "",
      comboPrice: combo.comboPrice || "",
      originalPrice: combo.originalPriceOverride || "",
      status: combo.status || "INACTIVE",
      seoTitle: combo.seoTitle || "",
      seoDescription: combo.seoDescription || "",
      allowDuplicateProducts: Boolean(combo.allowDuplicateProducts),
      imageMode: combo.imageMode || "PRODUCT_IMAGES",
      existingFeaturedImage: combo.featuredImage || "",
      paymentOptions: Array.isArray(combo.paymentOptions) && combo.paymentOptions.length
        ? combo.paymentOptions
        : ["COD", "ONLINE"],
      discountPercentage: combo.discountPercentage || combo.pricing?.discountPercentage || "",
      selectionGroups: (combo.selectionGroups?.length ? combo.selectionGroups : []).map((group, index) => ({
        category: group.category,
        label: group.label || group.category?.name || "",
        eligibleProducts: group.eligibleProducts || [],
        sortOrder: group.sortOrder ?? index,
      })),
      items: [],
    });
    setEditingId(combo._id);
    setActiveGroupIndex(0);
    setShowForm(true);
    setViewingCombo(null);
  };

  const submitCombo = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.selectionGroups.length < 2) {
      setError("Select at least two combo categories");
      return;
    }
    if (form.selectionGroups.some((group) => !group.category || !getGroupProducts(group).length)) {
      setError("Each combo category must have at least one eligible product");
      return;
    }
    if (!(computedComboPrice > 0)) {
      setError("Enter a combo offer price");
      return;
    }
    if (computedComboPrice > effectiveOriginalPrice) {
      setError("Combo offer price cannot be more than the combined eligible product price");
      return;
    }
    if (!Array.isArray(form.paymentOptions) || form.paymentOptions.length === 0) {
      setError("Select COD, online, or both payment options");
      return;
    }

    const payload = new FormData();
    [
      "name",
      "slug",
      "shortDescription",
      "fullDescription",
      "originalPrice",
      "status",
      "seoTitle",
      "seoDescription",
      "imageMode",
    ].forEach((field) => payload.append(field, form[field] ?? ""));

    payload.append("allowDuplicateProducts", String(form.allowDuplicateProducts));
    payload.append("paymentOptions", JSON.stringify(form.paymentOptions));
    payload.append("discountPercentage", String(discountPercentage));
    payload.append("comboPrice", String(computedComboPrice));
    payload.append(
      "selectionGroups",
      JSON.stringify(
        form.selectionGroups.map((group, index) => ({
          category: group.category?._id || group.category,
          label: group.label || "",
          eligibleProducts: getGroupProducts(group).map((product) => product._id || product),
          sortOrder: index,
        }))
      )
    );
    if (form.featuredImage) payload.append("featuredImage", form.featuredImage);
    if (form.bannerImage) payload.append("bannerImage", form.bannerImage);
    form.galleryImages.forEach((file) => payload.append("galleryImages", file));

    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${API_URL}/combo-packs/${editingId}`, payload);
        setMessage("Combo pack updated");
      } else {
        await axios.post(`${API_URL}/combo-packs`, payload);
        setMessage("Combo pack created");
      }
      resetForm();
      await loadCombos();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save combo pack");
    } finally {
      setLoading(false);
    }
  };

  const deleteCombo = async (comboId) => {
    if (!window.confirm("Delete this combo pack?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/combo-packs/${comboId}`);
      setMessage("Combo pack deleted");
      await loadCombos();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete combo pack");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">Combo Packs</h1>
            <p className="mt-1 text-sm text-gray-600">
              Build virtual product bundles from existing catalog products.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus size={18} />
            Create Combo
          </button>
        </div>

        {(message || error) && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-5">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Search combos"
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-gray-950 focus:outline-none"
            />
          </label>
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-950 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="REVIEW">Review</option>
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-950 focus:outline-none"
          />
          <button
            type="button"
            onClick={loadCombos}
            className="rounded-md border border-gray-950 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gray-100"
          >
            Apply Filters
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitCombo} className="space-y-6 rounded-md border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-lg font-semibold text-gray-950">
                {editingId ? "Edit Combo Pack" : "Create Combo Pack"}
              </h2>
              <button type="button" onClick={resetForm} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Combo name"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                placeholder="Slug"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={form.shortDescription}
                onChange={(event) => updateForm("shortDescription", event.target.value)}
                placeholder="Short description"
                rows={3}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={form.fullDescription}
                onChange={(event) => updateForm("fullDescription", event.target.value)}
                placeholder="Full description"
                rows={3}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {/* <label className="grid gap-1 text-sm">
                <span className="font-medium text-gray-700">Original price override</span>
                <input
                  type="number"
                  min="0"
                  value={form.originalPrice}
                  onChange={(event) => updateForm("originalPrice", event.target.value)}
                  placeholder={`Auto total: ${money(calculatedOriginalPrice)}`}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label> */}
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-gray-700">Combo offer price</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.comboPrice}
                  onChange={(event) => updateForm("comboPrice", event.target.value)}
                  placeholder="Example: 3500"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="REVIEW">Review</option>
              </select>
              <label className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.allowDuplicateProducts}
                  onChange={(event) => updateForm("allowDuplicateProducts", event.target.checked)}
                />
                Allow duplicate products
              </label>
              <div className="grid gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 md:col-span-2">
                <span className="font-medium text-gray-700">Payment options</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(form.paymentOptions || []).includes("COD")}
                      onChange={(event) => updatePaymentOption("COD", event.target.checked)}
                    />
                    Cash on Delivery
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(form.paymentOptions || []).includes("ONLINE")}
                      onChange={(event) => updatePaymentOption("ONLINE", event.target.checked)}
                    />
                    Online Payment
                  </label>
                </div>
              </div>
              <input
                value={form.seoTitle}
                onChange={(event) => updateForm("seoTitle", event.target.value)}
                placeholder="SEO title"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={form.seoDescription}
                onChange={(event) => updateForm("seoDescription", event.target.value)}
                placeholder="SEO description"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div className="space-y-4">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-gray-950">Combo Categories</h3>
                      <p className="text-xs text-gray-500">Add one slot for each product the customer must choose.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addSelectionGroup(categories[0]?._id || "")}
                      className="rounded-md bg-gray-950 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Add Category
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.selectionGroups.map((group, index) => {
                      const categoryId = group.category?._id || group.category || "";
                      const active = activeGroupIndex === index;
                      return (
                        <div
                          key={`${categoryId}-${index}`}
                          className={`rounded-md border p-3 ${active ? "border-gray-950 bg-white" : "border-gray-200 bg-white"}`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveGroupIndex(index);
                                setProductFilters((current) => ({ ...current, category: categoryId }));
                              }}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700"
                            >
                              Select
                            </button>
                            <select
                              value={categoryId}
                              onChange={(event) => {
                                const nextCategory = categories.find((category) => category._id === event.target.value);
                                updateSelectionGroup(index, {
                                  category: nextCategory || event.target.value,
                                  label: nextCategory?.name || "",
                                  eligibleProducts: [],
                                });
                                setActiveGroupIndex(index);
                                setProductFilters((current) => ({ ...current, category: event.target.value }));
                              }}
                              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="">Choose category</option>
                              {categories.map((category) => (
                                <option key={category._id} value={category._id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeSelectionGroup(index)}
                              className="rounded p-2 text-red-600 hover:bg-red-50"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            {getGroupProducts(group).length} eligible products
                            {active ? " - active product target" : ""}
                          </div>
                        </div>
                      );
                    })}
                    {!form.selectionGroups.length && (
                      <div className="rounded-md border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                        Add at least two category slots, for example Hoodie + T Shirt.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={productFilters.q}
                    onChange={(event) => setProductFilters({ ...productFilters, q: event.target.value })}
                    placeholder="Search product or SKU"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={productFilters.category}
                    onChange={(event) => setProductFilters({ ...productFilters, category: event.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All categories</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={productFilters.brand}
                    onChange={(event) => setProductFilters({ ...productFilters, brand: event.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All brands</option>
                    {brands.map((brand) => (
                      <option key={brand._id} value={brand._id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-gray-500">
                  Products added here become eligible choices for the active combo category.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {products.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex items-center gap-3 rounded-md border border-gray-200 p-3 text-left hover:border-gray-950"
                    >
                      <img
                        src={buildImageSrc(getProductImage(product))}
                        alt=""
                        className="h-14 w-14 rounded-md bg-gray-100 object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-950">
                          {productLabel(product)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {money(getProductPrice(product), product.currency)}
                        </span>
                      </span>
                      <PackagePlus className="text-gray-500" size={18} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium text-gray-950">Eligible Products</h3>
                    <span className="text-sm text-gray-500">{form.selectionGroups.length} slots</span>
                  </div>
                  <div className="space-y-2">
                    {form.selectionGroups.map((group, groupIndex) => (
                      <div key={`eligible-${groupIndex}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-semibold text-gray-950">
                            Slot {groupIndex + 1}: {group.label || getCategoryName(group.category)}
                          </span>
                          <span className="text-xs text-gray-500">
                            From {money(getGroupPreviewPrice(group))}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {getGroupProducts(group).map((product, productIndex) => (
                            <div key={`${product?._id || product}-${productIndex}`} className="flex items-center gap-2 rounded-md bg-white p-2">
                              <img
                                src={buildImageSrc(getProductImage(product))}
                                alt=""
                                className="h-10 w-10 rounded bg-gray-100 object-cover"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-gray-800">{productLabel(product)}</span>
                                <span className="block text-xs text-gray-500">{money(getProductPrice(product), product.currency)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeProduct(groupIndex, productIndex)}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                          {!getGroupProducts(group).length && (
                            <div className="rounded-md border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
                              Select this slot, then add eligible products.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {!form.selectionGroups.length && (
                      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        Add combo categories to start.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4 text-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-emerald-100 pb-3">
                    <div>
                      <h3 className="font-semibold text-gray-950">Offer Price Calculation</h3>
                      <p className="text-xs text-gray-600">
                        Preview uses the lowest eligible product from each category slot.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Auto calculated
                    </span>
                  </div>

                  <div className="space-y-2">
                    {form.selectionGroups.map((group, index) => (
                      <div
                        key={`price-${group.category?._id || group.category}-${index}`}
                        className="flex items-center justify-between gap-3 text-gray-700"
                      >
                        <span className="min-w-0 truncate">
                          {index + 1}. {group.label || getCategoryName(group.category)}
                        </span>
                        <span className="font-semibold text-gray-950">
                          {money(getGroupPreviewPrice(group))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2 border-t border-emerald-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total original price</span>
                      <strong className="text-gray-950">{money(effectiveOriginalPrice)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Admin combo price</span>
                      <strong className="text-gray-950">{money(computedComboPrice)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="font-semibold">Customer savings</span>
                      <strong>{money(savingsAmount)} ({discountPercentage}%)</strong>
                    </div>
                  </div>

                  <p className="mt-4 rounded-md bg-white px-3 py-2 text-xs text-gray-600">
                    Enter the final combo price. The discount percentage is calculated from the selected products' combined offer price.
                  </p>
                </div>

                <div className="rounded-md border border-gray-200 p-4">
                  <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm">
                    <Upload size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-800">Combo thumbnail</span>
                      <span className="block truncate text-xs text-gray-500">
                        {form.featuredImage?.name ||
                          (form.existingFeaturedImage
                            ? String(form.existingFeaturedImage).split("/").pop()
                            : "No thumbnail selected")}
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => updateForm("featuredImage", event.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-md bg-gray-950 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    {editingId ? "Update Combo" : "Create Combo"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Combo Image</th>
                  <th className="px-4 py-3">Combo Name</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Combo Price</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {combos.map((combo) => (
                  <tr key={combo._id} className="align-middle">
                    <td className="px-4 py-3">
                      {combo.displayImage ? (
                        <img
                          src={buildImageSrc(combo.displayImage)}
                          alt=""
                          className="h-14 w-14 rounded-md bg-gray-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gray-100">
                          <Image size={18} className="text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-950">{combo.name}</div>
                      <div className="text-xs text-gray-500">{combo.slug}</div>
                      {combo.needsReview && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle size={13} />
                          Review required
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{combo.includedProductsCount}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{money(combo.comboPrice, combo.currency)}</div>
                      <div className="text-xs text-gray-500">
                        Save {money(combo.pricing?.savingsAmount, combo.currency)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                        {getPaymentLabel(combo.paymentOptions)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          combo.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : combo.status === "REVIEW"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {combo.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {combo.createdAt ? new Date(combo.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingCombo(combo)}
                          className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(combo)}
                          className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCombo(combo._id)}
                          className="rounded-md border border-red-200 p-2 text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!combos.length && (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                      {loading ? "Loading combo packs..." : "No combo packs found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewingCombo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-950">{viewingCombo.name}</h2>
              <button type="button" onClick={() => setViewingCombo(null)} className="rounded-md p-2 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">{viewingCombo.shortDescription}</p>
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-4 text-sm md:grid-cols-4">
              <div>
                <span className="block text-gray-500">Original</span>
                <strong>{money(viewingCombo.pricing?.originalPrice, viewingCombo.currency)}</strong>
              </div>
              <div>
                <span className="block text-gray-500">Combo</span>
                <strong>{money(viewingCombo.comboPrice, viewingCombo.currency)}</strong>
              </div>
              <div>
                <span className="block text-gray-500">Discount</span>
                <strong>{viewingCombo.pricing?.discountPercentage || 0}%</strong>
              </div>
              <div>
                <span className="block text-gray-500">Payment</span>
                <strong>{getPaymentLabel(viewingCombo.paymentOptions)}</strong>
              </div>
            </div>
            {viewingCombo.reviewIssues?.length > 0 && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {viewingCombo.reviewIssues.join(", ")}
              </div>
            )}
            <div className="space-y-2">
              {(viewingCombo.items || []).map((item, index) => (
                <div key={`${item.product?._id}-${index}`} className="flex items-center gap-3 rounded-md border border-gray-200 p-3">
                  <img
                    src={buildImageSrc(getProductImage(item.product))}
                    alt=""
                    className="h-12 w-12 rounded-md bg-gray-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-950">
                      {productLabel(item.product)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Sizes, colors, variants, SKU, stock and availability are synced from this product.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboPacksManager;
