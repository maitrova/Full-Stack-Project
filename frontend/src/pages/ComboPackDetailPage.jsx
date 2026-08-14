import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import { 
  Check, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  ShoppingCart, 
  Package,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, getCart, selectCartLoading } from "../redux/slices/Cartslice.js";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";

const API_URL = import.meta.env.VITE_API_URL;

const formatPrice = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getProductImage = (product) => {
  if (product?.thumbnail) return product.thumbnail;
  const first = product?.images?.[0];
  return typeof first === "string" ? first : first?.url || "";
};

const getProductImages = (product) => {
  const images = [];
  if (product?.thumbnail) images.push(product.thumbnail);
  for (const image of product?.images || []) {
    const imageUrl = typeof image === "string" ? image : image?.url;
    if (imageUrl) images.push(imageUrl);
  }
  return [...new Set(images.filter(Boolean))];
};

const getProductPrice = (product) =>
  Number(
    product?.pricing?.effectivePrice ||
      product?.effectivePrice ||
      product?.offerPrice ||
      product?.salePrice ||
      product?.price ||
      product?.basePrice ||
      0
  );

const getProductDetailsPath = (product) =>
  buildReadymadeProductPath({
    ...product,
    category: product?.category?.name || product?.category,
    subCategory: product?.subCategory?.name || product?.subCategory,
  }) || `/readymade/${product?._id}`;

const stripHtml = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const getVariantStock = (product, size) => {
  if (!Array.isArray(product?.variants) || !product.variants.length) {
    return Number(product?.stock || 0);
  }
  const variant = product.variants.find(
    (entry) => String(entry.size || "").toUpperCase() === String(size || "").toUpperCase()
  );
  return Number(variant?.stock || 0);
};

const ComboPackDetailPage = () => {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cartLoading = useSelector(selectCartLoading);
  const [combo, setCombo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState({});
  const [activeSelectionGroupIndex, setActiveSelectionGroupIndex] = useState(0);
  const [productImageIndexes, setProductImageIndexes] = useState({});
  const [adding, setAdding] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    const loadCombo = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(`${API_URL}/combo-packs/slug/${slug}`);
        setCombo(response.data.data);
        setSelections({});
        setActiveSelectionGroupIndex(0);
        setProductImageIndexes({});
        setQuantity(1);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load combo pack");
      } finally {
        setLoading(false);
      }
    };
    loadCombo();
  }, [slug]);

  const updateSelection = (index, field, value) => {
    setSelections((current) => ({
      ...current,
      [index]: {
        ...(current[index] || {}),
        [field]: value,
      },
    }));
  };

  const shiftProductImage = (event, product, direction) => {
    event.stopPropagation();
    const productId = product?._id;
    const images = getProductImages(product);
    if (!productId || images.length <= 1) return;

    setProductImageIndexes((current) => {
      const currentIndex = current[productId] || 0;
      const nextIndex = (currentIndex + direction + images.length) % images.length;
      return { ...current, [productId]: nextIndex };
    });
  };

  const selectGroupProduct = (index, productId) => {
    setSelections((current) => ({
      ...current,
      [index]: { productId, size: "", color: "" },
    }));
  };

  const selectionGroups = useMemo(
    () => (combo?.selectionGroups?.length ? [...combo.selectionGroups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) : []),
    [combo]
  );

  useEffect(() => {
    if (activeSelectionGroupIndex >= selectionGroups.length) {
      setActiveSelectionGroupIndex(0);
    }
  }, [activeSelectionGroupIndex, selectionGroups.length]);

  const selectedComboProducts = useMemo(() => {
    if (selectionGroups.length) {
      return selectionGroups.map((group, index) => {
        const selectedProductId = selections[index]?.productId;
        return (group.eligibleProducts || []).find((product) => product._id === selectedProductId) || null;
      });
    }
    return (combo?.items || []).map((item) => item.product).filter(Boolean);
  }, [combo, selectionGroups, selections]);

  const dynamicOriginalPrice = useMemo(
    () => selectedComboProducts.reduce((sum, product) => sum + getProductPrice(product), 0),
    [selectedComboProducts]
  );

  const dynamicComboPrice = useMemo(() => {
    if (!selectionGroups.length) return Number(combo?.comboPrice || 0);
    return Number(combo?.comboPrice || 0);
  }, [combo, selectionGroups.length]);

  const validation = useMemo(() => {
    if (selectionGroups.length) {
      for (let index = 0; index < selectionGroups.length; index += 1) {
        const group = selectionGroups[index];
        const selection = selections[index] || {};
        const product = (group.eligibleProducts || []).find((entry) => entry._id === selection.productId);
        if (!product) {
          return { complete: false, message: `Select a product for ${group.label || group.category?.name || "combo category"}` };
        }
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const colors = Array.isArray(product?.colors) ? product.colors : [];

        if (variants.length && !selection.size) {
          return { complete: false, message: `Select size for ${product?.title || "combo item"}` };
        }
        if (colors.length && !selection.color) {
          return { complete: false, message: `Select color for ${product?.title || "combo item"}` };
        }
        if (getVariantStock(product, selection.size) < quantity) {
          return {
            complete: false,
            message: `${product?.title || "Combo item"} is out of stock for the selected variant`,
          };
        }
      }

      return { complete: true, message: "" };
    }

    if (!combo?.items?.length) return { complete: false, message: "Combo is unavailable" };

    for (let index = 0; index < combo.items.length; index += 1) {
      const product = combo.items[index].product;
      const selection = selections[index] || {};
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const colors = Array.isArray(product?.colors) ? product.colors : [];

      if (variants.length && !selection.size) {
        return { complete: false, message: `Select size for ${product?.title || "combo item"}` };
      }
      if (colors.length && !selection.color) {
        return { complete: false, message: `Select color for ${product?.title || "combo item"}` };
      }
      if (getVariantStock(product, selection.size) < quantity) {
        return {
          complete: false,
          message: `${product?.title || "Combo item"} is out of stock for the selected variant`,
        };
      }
    }

    return { complete: true, message: "" };
  }, [combo, quantity, selectionGroups, selections]);

  const maxQuantity = useMemo(() => {
    if (selectionGroups.length) {
      const stocks = selectedComboProducts.map((product, index) => {
        const selection = selections[index] || {};
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        if (!product) return 1;
        if (variants.length && !selection.size) return 1;
        return getVariantStock(product, selection.size);
      });
      return Math.max(1, Math.min(...stocks.filter((stock) => Number.isFinite(stock))));
    }

    if (!combo?.items?.length) return 1;
    const stocks = combo.items.map((item, index) => {
      const product = item.product;
      const selection = selections[index] || {};
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length && !selection.size) return 1;
      return getVariantStock(product, selection.size);
    });
    return Math.max(1, Math.min(...stocks.filter((stock) => Number.isFinite(stock))));
  }, [combo, selectionGroups.length, selectedComboProducts, selections]);

  const addComboToCart = async () => {
    if (!combo || !validation.complete) return false;
    setAdding(true);
    setNotice("");
    setError("");
    try {
      const comboSelections = (combo.items || []).map((item, index) => ({
        productId: item.product._id,
        size: selections[index]?.size || "",
        color: selections[index]?.color || "",
      }));
      const groupSelections = selectionGroups.map((group, index) => ({
        groupId: group._id,
        categoryId: group.category?._id || group.category,
        productId: selections[index]?.productId || "",
        size: selections[index]?.size || "",
        color: selections[index]?.color || "",
      }));

      await dispatch(
        addToCart({
          kind: "COMBO",
          comboPackId: combo._id,
          comboSelections: selectionGroups.length ? groupSelections : comboSelections,
          qty: quantity,
        })
      ).unwrap();
      await dispatch(getCart());
      setNotice("Combo pack added to cart");
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      return true;
    } catch (err) {
      setError(err.message || "Failed to add combo pack to cart");
      return false;
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Loading amazing combo...</p>
        </div>
      </div>
    );
  }

  if (error && !combo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😔</div>
          <p className="text-red-600 text-lg font-medium mb-4">{error}</p>
          <Link 
            to="/combo-packs" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-all font-medium"
          >
            <ChevronLeft size={18} />
            Back to combo packs
          </Link>
        </div>
      </div>
    );
  }

  const originalPrice = selectionGroups.length && dynamicOriginalPrice > 0
    ? dynamicOriginalPrice
    : Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
  const displayComboPrice = selectionGroups.length && dynamicOriginalPrice > 0 ? dynamicComboPrice : Number(combo.comboPrice || 0);
  const savings = Math.max(originalPrice - displayComboPrice, 0);
  const discount = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  const completedSelectionCount = selectionGroups.length
    ? selectedComboProducts.filter(Boolean).length
    : combo.items?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-violet-50">
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl transform animate-bounce">
            <div className="text-center">
              <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
              <p className="text-xl font-bold text-gray-900">Added to Cart!</p>
              <p className="text-gray-500 mt-2">Your combo pack is ready</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-8">
        {/* Back Navigation */}
        <button
          type="button"
          onClick={() => navigate("/combo-packs")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-violet-600 transition-colors group"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Explore More Combo Packs</span>
        </button>

        {/* Notifications */}
        {(notice || error) && (
          <div
            className={`mb-6 rounded-2xl border-2 p-4 text-sm font-medium animate-slideDown ${
              error 
                ? "border-red-200 bg-red-50 text-red-700" 
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {error ? "⚠️" : "✅"} {error || notice}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-7xl space-y-4">
          {/* Main Content */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Products Selection Area */}
            <div className="space-y-4 lg:col-span-2">
              {/* Progress Card */}
             

              {/* Product Selection Grid */}
              <div className="space-y-4">
                {selectionGroups.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {selectionGroups.map((group, index) => {
                        const selectedProductId = selections[index]?.productId || "";
                        const selectedProduct = (group.eligibleProducts || []).find((product) => product._id === selectedProductId);
                        const slotName = group.label || group.category?.name || `Slot ${index + 1}`;
                        const active = activeSelectionGroupIndex === index;

                        return (
                          <button
                            key={group._id || index}
                            type="button"
                            onClick={() => setActiveSelectionGroupIndex(index)}
                            className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border-2 px-2.5 py-3 text-left transition-all sm:gap-3 sm:px-4 ${
                              active
                                ? "border-violet-600 bg-violet-50 shadow-sm"
                                : selectedProduct
                                  ? "border-green-200 bg-white hover:border-green-300"
                                  : "border-gray-200 bg-white hover:border-violet-300"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold sm:h-9 sm:w-9 ${
                                selectedProduct ? "bg-green-600 text-white" : "bg-violet-600 text-white"
                              }`}>
                                {selectedProduct ? <Check size={18} /> : index + 1}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Slot {index + 1}
                                </span>
                                <span className="block truncate text-xs font-bold text-gray-900 sm:text-sm">
                                  {slotName}
                                </span>
                                {selectedProduct && (
                                  <span className="block truncate text-xs text-gray-500">
                                    {selectedProduct.title}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${
                              selectedProduct ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                            }`}>
                              {selectedProduct ? "Selected" : "Pick 1"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                  const index = activeSelectionGroupIndex;
                  const group = selectionGroups[index];
                  if (!group) return null;
                  const selectedProductId = selections[index]?.productId || "";
                  const selectedProduct = (group.eligibleProducts || []).find((product) => product._id === selectedProductId);
                  const slotName = group.label || group.category?.name || `Slot ${index + 1}`;
                  const products = group.eligibleProducts || [];
                  const selectedProductIds = Object.entries(selections)
                    .filter(([slotIndex]) => Number(slotIndex) !== index)
                    .map(([, selection]) => selection.productId)
                    .filter(Boolean);

                  return (
                    <section
                      key={group._id || index}
                      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                        selectedProduct ? "border-green-200" : "border-violet-200"
                      }`}
                    >
                      <div className="border-b border-gray-100 bg-white px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                              selectedProduct ? "bg-green-600 text-white" : "bg-violet-600 text-white"
                            }`}>
                              {selectedProduct ? <Check size={20} /> : index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Slot {index + 1} of {selectionGroups.length}
                              </p>
                              <h3 className="text-base font-bold text-gray-900">
                                Pick 1 {slotName}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {products.length} option{products.length === 1 ? "" : "s"} available. Select exactly one for this slot.
                              </p>
                            </div>
                          </div>
                          {selectedProduct ? (
                            <div className="inline-flex items-center gap-2 self-start rounded-full bg-green-100 px-3 py-1 text-green-700 sm:self-auto">
                              <CheckCircle2 size={16} />
                              <span className="text-xs font-semibold">Slot complete</span>
                            </div>
                          ) : (
                            <span className="inline-flex self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 sm:self-auto">
                              Needs 1 product
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 sm:p-4">
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                          {products.map((product) => {
                            const active = selectedProductId === product._id;
                            const disabled = !combo.allowDuplicateProducts && selectedProductIds.includes(product._id);
                            const productImages = getProductImages(product);
                            const imageIndex = productImageIndexes[product._id] || 0;
                            const activeProductImage = productImages[imageIndex] || getProductImage(product);
                            const categoryName = product?.category?.name || (typeof product?.category === "string" ? product.category : "Product");
                            const subCategoryName = product?.subCategory?.name || (typeof product?.subCategory === "string" ? product.subCategory : "");
                            const productVariants = Array.isArray(product?.variants) ? product.variants : [];
                            const productColors = Array.isArray(product?.colors) ? product.colors : [];
                            const selectedSize = selections[index]?.size || "";
                            const selectedStock = active ? getVariantStock(product, selectedSize) : 0;
                            
                            return (
                              <div
                                key={product._id}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                aria-disabled={disabled}
                                onClick={() => {
                                  if (disabled) return;
                                  selectGroupProduct(index, product._id);
                                }}
                                onKeyDown={(event) => {
                                  if (disabled || !["Enter", " "].includes(event.key)) return;
                                  event.preventDefault();
                                  selectGroupProduct(index, product._id);
                                }}
                                className={`group relative overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 ${
                                  active
                                    ? "border-violet-600 shadow-lg"
                                    : disabled
                                      ? "cursor-not-allowed border-gray-200 opacity-60"
                                      : "cursor-pointer border-gray-200 hover:border-violet-300 hover:shadow-lg"
                                }`}
                              >
                                <div className="relative aspect-square overflow-hidden bg-gray-50">
                                  {activeProductImage ? (
                                    <img
                                      src={buildImageUrl(activeProductImage)}
                                      alt={product.title}
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                                      <Package size={34} />
                                    </div>
                                  )}
                                  
                                  {productImages.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(event) => shiftProductImage(event, product, -1)}
                                        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 opacity-0 shadow-lg transition-all hover:bg-white group-hover:opacity-100"
                                      >
                                        <ChevronLeft size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => shiftProductImage(event, product, 1)}
                                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 opacity-0 shadow-lg transition-all hover:bg-white group-hover:opacity-100"
                                      >
                                        <ChevronRight size={16} />
                                      </button>
                                      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium">
                                        {imageIndex + 1}/{productImages.length}
                                      </span>
                                    </>
                                  )}
                                  
                                  <div className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                                    active 
                                      ? "bg-violet-600 border-violet-600" 
                                      : "bg-white border-gray-300"
                                  }`}>
                                    {active && <Check size={16} className="text-white" />}
                                  </div>
                                </div>

                                <div className="p-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs text-gray-500">
                                      {categoryName}
                                      {subCategoryName ? <span className="text-gray-300"> / </span> : null}
                                      {subCategoryName}
                                    </p>
                                    <h4 className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900">{product.title}</h4>
                                  </div>
                                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                                    {stripHtml(product.description) || "Premium catalog product"}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-base font-bold text-gray-900">
                                      {formatPrice(getProductPrice(product), combo.currency)}
                                    </span>
                                    <Link
                                      to={getProductDetailsPath(product)}
                                      onClick={(event) => event.stopPropagation()}
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                                    >
                                      <Eye size={14} />
                                      Details
                                    </Link>
                                  </div>

                                  {active && (productColors.length > 0 || productVariants.length > 0) && (
                                    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-2">
                                      {productColors.length > 0 && (
                                        <div>
                                          <p className="mb-1 text-[11px] font-semibold text-gray-600">Color</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {productColors.map((color) => {
                                              const colorValue = color.value || color.label || color;
                                              const colorLabel = color.label || colorValue;
                                              const colorActive = selections[index]?.color === colorValue;
                                              return (
                                                <button
                                                  key={colorValue}
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    updateSelection(index, "color", colorValue);
                                                  }}
                                                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                                                    colorActive
                                                      ? "border-violet-600 bg-violet-600 text-white"
                                                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-300"
                                                  }`}
                                                >
                                                  <span
                                                    className="h-3.5 w-3.5 rounded-full border border-white shadow-inner"
                                                    style={{ backgroundColor: colorValue }}
                                                  />
                                                  <span className="max-w-16 truncate">{colorLabel}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {productVariants.length > 0 && (
                                        <div>
                                          <div className="mb-1 flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-semibold text-gray-600">Size</p>
                                            {selectedSize && (
                                              <span className={`text-[11px] font-semibold ${
                                                selectedStock <= 0 ? "text-red-600" : "text-green-600"
                                              }`}>
                                                {selectedStock <= 0 ? "Out of stock" : `${selectedStock} left`}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap gap-1.5">
                                            {productVariants.map((variant) => {
                                              const sizeActive = selectedSize === variant.size;
                                              const sizeDisabled = Number(variant.stock || 0) <= 0;
                                              return (
                                                <button
                                                  key={variant.size}
                                                  type="button"
                                                  disabled={sizeDisabled}
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    updateSelection(index, "size", variant.size);
                                                  }}
                                                  className={`min-w-8 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                                                    sizeActive
                                                      ? "border-violet-600 bg-violet-600 text-white"
                                                      : sizeDisabled
                                                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through"
                                                        : "border-gray-200 bg-white text-gray-700 hover:border-violet-300"
                                                  }`}
                                                >
                                                  {variant.size}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (disabled) return;
                                      selectGroupProduct(index, product._id);
                                    }}
                                    className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                                      active
                                        ? "bg-violet-600 text-white"
                                        : disabled
                                          ? "bg-gray-100 text-gray-400"
                                          : "bg-gray-900 text-white hover:bg-black"
                                    }`}
                                  >
                                    {active && <Check size={16} />}
                                    {active ? "Selected" : "Select"}
                                  </button>

                                  {disabled && (
                                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                                      Already selected in another group
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  );
                    })()}
                  </>
                ) : combo.items.map((item, index) => {
                  const product = item.product;
                  const variants = Array.isArray(product?.variants) ? product.variants : [];
                  const colors = Array.isArray(product?.colors) ? product.colors : [];
                  const selectedSize = selections[index]?.size || "";
                  const selectedStock = getVariantStock(product, selectedSize);
                  const outOfStock = variants.length ? selectedSize && selectedStock <= 0 : selectedStock <= 0;

                  return (
                    <div key={`${product._id}-${index}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                      <div className="flex gap-4">
                        <div className="relative">
                          <img
                            src={buildImageUrl(getProductImage(product))}
                            alt={product.title}
                            className="w-24 h-24 rounded-xl object-cover shadow-md"
                          />
                          <div className="absolute -top-2 -left-2 w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-medium text-violet-600">Item {index + 1}</p>
                              <h3 className="font-bold text-gray-900">{product.title}</h3>
                            </div>
                            <span className="text-lg font-bold text-violet-600">
                              {formatPrice(getProductPrice(product), combo.currency)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {stripHtml(product.description) || "Premium product"}
                          </p>
                          {selectedSize && (
                            <p className={`text-xs font-medium mt-1 ${outOfStock ? "text-red-600" : "text-green-600"}`}>
                              {outOfStock ? "Out of Stock" : `${selectedStock} available`}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Color Selection */}
                      {colors.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Color</p>
                          <div className="flex flex-wrap gap-2">
                            {colors.map((color) => {
                              const colorValue = color.value || color.label || color;
                              const active = selections[index]?.color === colorValue;
                              return (
                                <button
                                  key={colorValue}
                                  type="button"
                                  onClick={() => updateSelection(index, "color", colorValue)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    active 
                                      ? "bg-violet-600 text-white" 
                                      : "bg-gray-50 text-gray-700 border border-gray-200 hover:border-violet-300"
                                  }`}
                                >
                                  <span 
                                    className="w-4 h-4 rounded-full border border-gray-300" 
                                    style={{ backgroundColor: colorValue }} 
                                  />
                                  {color.label || colorValue}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Size Selection */}
                      {variants.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Size</p>
                          <div className="flex flex-wrap gap-2">
                            {variants.map((variant) => {
                              const active = selectedSize === variant.size;
                              const disabled = Number(variant.stock || 0) <= 0;
                              return (
                                <button
                                  key={variant.size}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => updateSelection(index, "size", variant.size)}
                                  className={`min-w-[3rem] px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    active
                                      ? "bg-violet-600 text-white shadow-md"
                                      : disabled
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed line-through"
                                        : "bg-white text-gray-700 border border-gray-200 hover:border-violet-300"
                                  }`}
                                >
                                  {variant.size}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar - Price Summary & Actions */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                {/* Price Card */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 border-b border-gray-100 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      Combo Details
                    </p>
                    <h1 className="mt-1 text-xl font-bold leading-tight text-gray-900">{combo.name}</h1>
                    {(combo.fullDescription || combo.shortDescription) && (
                      <div
                        className="prose prose-sm mt-2 max-w-none text-sm text-gray-600"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(combo.fullDescription || combo.shortDescription || ""),
                        }}
                      />
                    )}
                  </div>
                  <h3 className="mb-3 text-sm font-bold text-gray-900">Price Summary</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Original Price</span>
                      <span className="text-gray-400 line-through text-lg">
                        {formatPrice(originalPrice, combo.currency)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Combo Discount</span>
                      <span className="text-green-600 font-semibold">
                        -{discount}%
                      </span>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-semibold">Combo Price</span>
                        <span className="text-2xl font-bold text-violet-600">
                          {formatPrice(displayComboPrice, combo.currency)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                      <div className="flex justify-between items-center">
                        <span className="text-green-700 font-semibold">You Save</span>
                        <span className="font-bold text-green-600">
                          {formatPrice(savings, combo.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantity Selector Card */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-gray-900">Quantity</h3>
                  
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-700 transition-all hover:bg-violet-50 hover:text-violet-600"
                    >
                      -
                    </button>
                    
                    <div className="flex h-9 w-12 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-sm font-bold text-violet-600">
                      {quantity}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                      disabled={quantity >= maxQuantity}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-700 transition-all hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Total</span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPrice(displayComboPrice * quantity, combo.currency)}
                      </span>
                    </div>
                    {savings > 0 && (
                      <p className="text-sm text-green-600 font-medium text-center">
                        Total savings: {formatPrice(savings * quantity, combo.currency)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Validation Message */}
                {!validation.complete && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500">⚠️</span>
                      <p className="text-sm font-medium text-amber-800">{validation.message}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="hidden grid-cols-2 gap-2 lg:grid">
                  <button
                    type="button"
                    onClick={addComboToCart}
                    disabled={!validation.complete || adding || cartLoading}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-600 bg-white px-3 text-sm font-semibold text-violet-600 transition-all hover:bg-violet-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {adding || cartLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} />
                        Add to Cart
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={async () => {
                      const added = await addComboToCart();
                      if (added) navigate("/cart");
                    }}
                    disabled={!validation.complete || adding || cartLoading}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    <Zap size={16} />
                    Buy Now
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-lg lg:hidden">
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-500">{combo.name}</p>
              <p className="text-lg font-bold text-gray-900">
                {formatPrice(displayComboPrice * quantity, combo.currency)}
              </p>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-l-lg border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50"
              >
                -
              </button>
              <div className="flex h-8 w-10 items-center justify-center border-y border-gray-300 text-sm font-semibold text-gray-900">
                {quantity}
              </div>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                disabled={quantity >= maxQuantity}
                className="flex h-8 w-8 items-center justify-center rounded-r-lg border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {!validation.complete && (
            <p className="truncate rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              {validation.message}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addComboToCart}
              disabled={!validation.complete || adding || cartLoading}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 text-sm font-semibold text-white transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {adding || cartLoading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={15} />
                  Add to Cart
                </>
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                const added = await addComboToCart();
                if (added) navigate("/cart");
              }}
              disabled={!validation.complete || adding || cartLoading}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-sm font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              <Zap size={15} />
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboPackDetailPage;
   
