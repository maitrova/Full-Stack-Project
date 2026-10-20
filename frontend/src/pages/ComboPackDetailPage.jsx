import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import { AlertCircle, Check, ChevronLeft, ChevronRight, CreditCard, Eye, Package, Undo2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, getCart, selectCartLoading } from "../redux/slices/Cartslice.js";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";
import {
  DetailSection,
  InfoSection,
  InfoSections,
  MobilePurchaseBar,
  PriceBlock,
  PrimaryPurchaseButton,
  ProductHeading,
  ProductNotFound,
  ProductPage,
  ProductPageSkeleton,
  ProductToast,
  ProductTopBar,
  QuantityStepper,
  SecondaryPurchaseButton,
  TrustRow,
} from "../components/product/ProductPageParts.jsx";

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
  const location = useLocation();
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
      [index]:
        current[index]?.productId === productId
          ? current[index]
          : { productId, size: "", color: "" },
    }));
  };

  const undoGroupSelection = (index) => {
    setSelections((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const hasSelectedRequiredSize = (product, selection = {}) => {
    if (!product) return false;
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.length === 0 || Boolean(selection.size);
  };

  const hasSelectedRequiredOptions = (product, selection = {}) => {
    if (!hasSelectedRequiredSize(product, selection)) return false;
    const colors = Array.isArray(product?.colors) ? product.colors : [];
    return colors.length === 0 || Boolean(selection.color);
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
    return <ProductPageSkeleton label="Loading combo pack…" />;
  }

  if (error && !combo) {
    return (
      <ProductNotFound
        title="Combo pack not found"
        message={error}
        onBack={() => navigate(-1)}
        browseLabel="Browse combo packs"
        onBrowse={() => navigate("/combo-packs")}
      />
    );
  }

  const originalPrice = selectionGroups.length && dynamicOriginalPrice > 0
    ? dynamicOriginalPrice
    : Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
  const displayComboPrice = selectionGroups.length && dynamicOriginalPrice > 0 ? dynamicComboPrice : Number(combo.comboPrice || 0);
  const savings = Math.max(originalPrice - displayComboPrice, 0);
  const discount = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  const completedSelectionCount = selectionGroups.length
    ? selectionGroups.reduce((count, group, index) => {
        const selection = selections[index] || {};
        const product = (group.eligibleProducts || []).find((entry) => entry._id === selection.productId);
        return count + (hasSelectedRequiredSize(product, selection) ? 1 : 0);
      }, 0)
    : combo.items?.length || 0;

  const totalSlots = selectionGroups.length || combo.items?.length || 0;
  const busy = adding || cartLoading;
  const canBuy = validation.complete && !busy;
  const currency = combo.currency;
  const buyNow = async () => {
    const added = await addComboToCart();
    if (added) navigate("/cart");
  };
  const includedLines = selectionGroups.length
    ? selectionGroups.map((group, index) => {
        const chosen = selectedComboProducts[index];
        const slotName = group.label || group.category?.name || `Slot ${index + 1}`;
        return { key: group._id || index, label: `1 × ${slotName}`, value: chosen?.title || "Not chosen yet" };
      })
    : (combo.items || []).map((item, index) => ({
        key: `${item.product?._id}-${index}`,
        label: `Item ${index + 1}`,
        value: item.product?.title || "Product",
      }));

  // Size + colour chips for one product inside the builder.
  const renderOptionPickers = (product, index, { compact = false } = {}) => {
    const productVariants = Array.isArray(product?.variants) ? product.variants : [];
    const productColors = Array.isArray(product?.colors) ? product.colors : [];
    const selectedSize = selections[index]?.size || "";
    const selectedStock = getVariantStock(product, selectedSize);
    if (!productVariants.length && !productColors.length) return null;

    return (
      <div className={compact ? "mt-3 space-y-3 border-t border-mt-line pt-3" : "mt-4 space-y-4"} onClick={(event) => event.stopPropagation()}>
        {productColors.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-mt-muted">
              Colour{selections[index]?.color ? <span className="text-mt-text">: {selections[index].color}</span> : null}
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Colour for ${product.title}`}>
              {productColors.map((color) => {
                const colorValue = color.value || color.label || color;
                const colorLabel = color.label || colorValue;
                const colorActive = selections[index]?.color === colorValue;
                return (
                  <button
                    key={colorValue}
                    type="button"
                    role="radio"
                    aria-checked={colorActive}
                    aria-label={colorLabel}
                    title={colorLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateSelection(index, "color", colorValue);
                    }}
                    className={`h-8 w-8 rounded-full border border-mt-tint/25 transition-shadow ${
                      colorActive ? "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-surface" : "hover:ring-1 hover:ring-mt-line-strong hover:ring-offset-2 hover:ring-offset-mt-surface"
                    }`}
                    style={{ backgroundColor: colorValue }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {productVariants.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-mt-muted">
                Size{selectedSize ? <span className="text-mt-text">: {selectedSize}</span> : null}
              </p>
              {selectedSize && (
                <span className={`text-[11px] ${selectedStock <= 0 ? "text-mt-danger" : selectedStock < 5 ? "text-mt-warning" : "text-mt-subtle"}`}>
                  {selectedStock <= 0 ? "Out of stock" : selectedStock < 5 ? `Only ${selectedStock} left` : "In stock"}
                </span>
              )}
            </div>
            <div className={`grid gap-1.5 ${compact ? "grid-cols-4" : "grid-cols-5 sm:grid-cols-6"}`}>
              {productVariants.map((variant) => {
                const sizeActive = selectedSize === variant.size;
                const sizeDisabled = Number(variant.stock || 0) <= 0;
                return (
                  <button
                    key={variant.size}
                    type="button"
                    disabled={sizeDisabled}
                    aria-pressed={sizeActive}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateSelection(index, "size", variant.size);
                    }}
                    className={`h-9 rounded-mt-btn border text-xs transition-colors ${
                      sizeActive
                        ? "border-mt-text bg-mt-btn font-medium text-mt-btn-text"
                        : sizeDisabled
                          ? "cursor-not-allowed border-mt-line text-mt-subtle line-through"
                          : "border-mt-line-strong text-mt-text hover:border-mt-text"
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
  };

  const purchasePanel = (
    <div className="space-y-3">
      <div className="flex gap-3">
        <QuantityStepper
          value={quantity}
          onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
          decreaseDisabled={quantity <= 1}
          increaseDisabled={quantity >= maxQuantity}
        />
        <PrimaryPurchaseButton onClick={addComboToCart} disabled={!canBuy} busy={busy} className="flex-1">
          {busy ? "Adding…" : "Add to cart"}
        </PrimaryPurchaseButton>
      </div>
      <SecondaryPurchaseButton onClick={buyNow} disabled={!canBuy} icon={CreditCard}>
        Buy now
      </SecondaryPurchaseButton>
      {!validation.complete && (
        <p className="flex items-start gap-2 text-xs text-mt-warning" role="status">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {validation.message}
        </p>
      )}
      {quantity > 1 && (
        <p className="text-xs text-mt-muted">
          {quantity} combos · {formatPrice(displayComboPrice * quantity, currency)}
          {savings > 0 ? ` · you save ${formatPrice(savings * quantity, currency)}` : ""}
        </p>
      )}
    </div>
  );

  return (
    <ProductPage>
      <ProductToast
        show={Boolean(showSuccessAnimation || notice) && !error}
        type="success"
        message={notice || "Combo pack added to cart"}
        showCartLink
        onClose={() => {
          setShowSuccessAnimation(false);
          setNotice("");
        }}
      />
      <ProductToast show={Boolean(error)} type="error" message={error} onClose={() => setError("")} />

      <ProductTopBar onBack={() => navigate("/combo-packs")} backLabel="combo packs" />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-3 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-20">
        {/* Summary (first on phones, right column on desktop) */}
        <section aria-label="Combo summary" className="lg:order-2 lg:col-span-5">
          <div className="lg:sticky lg:top-40">
            <ProductHeading eyebrow="Combo pack" title={combo.name} />
            <PriceBlock
              price={formatPrice(displayComboPrice, currency)}
              compareAt={savings > 0 ? formatPrice(originalPrice, currency) : null}
              saving={savings > 0 ? `Save ${formatPrice(savings, currency)} (${discount}%)` : null}
            />

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-mt-muted">
                <span>Your selection</span>
                <span className="tabular-nums text-mt-text">
                  {completedSelectionCount} of {totalSlots}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-mt-line" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-mt-btn transition-all duration-300"
                  style={{ width: `${totalSlots ? Math.min(100, (completedSelectionCount / totalSlots) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="hidden lg:block">
              <DetailSection>{purchasePanel}</DetailSection>
            </div>

            <TrustRow />

            <InfoSections>
              {(combo.fullDescription || combo.shortDescription) && (
                <InfoSection title="About this combo" defaultOpen>
                  <div
                    className="text-sm leading-relaxed text-mt-muted [&_p]:mb-3 [&_strong]:font-medium [&_strong]:text-mt-text [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(combo.fullDescription || combo.shortDescription || ""),
                    }}
                  />
                </InfoSection>
              )}
              <InfoSection title="What's included">
                <ul className="space-y-2 text-sm">
                  {includedLines.map((line) => (
                    <li key={line.key} className="flex justify-between gap-4">
                      <span className="text-mt-subtle">{line.label}</span>
                      <span className="truncate text-right text-mt-text">{line.value}</span>
                    </li>
                  ))}
                </ul>
              </InfoSection>
            </InfoSections>
          </div>
        </section>

        {/* Builder */}
        <section aria-label="Build your combo" className="lg:order-1 lg:col-span-7">
          {selectionGroups.length ? (
            <>
              <h2 className="text-lg font-medium text-mt-text">Build your combo</h2>
              <p className="mt-1 text-sm text-mt-muted">Pick one item for each slot, then choose its size.</p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="Combo slots">
                {selectionGroups.map((group, index) => {
                  const selectedProductId = selections[index]?.productId || "";
                  const selectedProduct = (group.eligibleProducts || []).find((product) => product._id === selectedProductId);
                  const selectedSizeReady = hasSelectedRequiredSize(selectedProduct, selections[index]);
                  const selectedOptionsReady = hasSelectedRequiredOptions(selectedProduct, selections[index]);
                  const slotName = group.label || group.category?.name || `Slot ${index + 1}`;
                  const active = activeSelectionGroupIndex === index;

                  return (
                    <button
                      key={group._id || index}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveSelectionGroupIndex(index)}
                      className={`flex min-w-0 items-center gap-3 rounded-mt-card border px-3 py-3 text-left transition-colors ${
                        active ? "border-mt-text bg-mt-surface" : "border-mt-line hover:border-mt-line-strong"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                          selectedSizeReady ? "bg-mt-success text-white" : active ? "bg-mt-btn text-mt-btn-text" : "border border-mt-line-strong text-mt-muted"
                        }`}
                      >
                        {selectedSizeReady ? <Check size={14} aria-hidden="true" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-mt-text">{slotName}</span>
                        <span className={`block truncate text-[11px] ${selectedOptionsReady ? "text-mt-success" : "text-mt-subtle"}`}>
                          {selectedOptionsReady ? selectedProduct?.title : selectedSizeReady ? "Choose colour" : selectedProduct ? "Choose size" : "Pick 1"}
                        </span>
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
                const selectedSizeReady = hasSelectedRequiredSize(selectedProduct, selections[index]);
                const slotName = group.label || group.category?.name || `Slot ${index + 1}`;
                const products = group.eligibleProducts || [];
                const selectedProductIds = Object.entries(selections)
                  .filter(([slotIndex]) => Number(slotIndex) !== index)
                  .map(([, selection]) => selection.productId)
                  .filter(Boolean);

                return (
                  <div key={group._id || index} className="mt-8" role="tabpanel">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">
                          Slot {index + 1} of {selectionGroups.length}
                        </p>
                        <h3 className="mt-1 text-base text-mt-text">Pick 1 {slotName}</h3>
                        <p className="text-xs text-mt-subtle">
                          {products.length} option{products.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      {selectedProduct && (
                        <button
                          type="button"
                          onClick={() => undoGroupSelection(index)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-mt-line px-3 text-xs text-mt-muted transition-colors hover:border-mt-line-strong hover:text-mt-text"
                        >
                          <Undo2 size={14} aria-hidden="true" />
                          Change
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                      {products.map((product) => {
                        const active = selectedProductId === product._id;
                        const productImages = getProductImages(product);
                        const imageIndex = productImageIndexes[product._id] || 0;
                        const activeProductImage = productImages[imageIndex] || getProductImage(product);
                        const activeSizeReady = active && hasSelectedRequiredSize(product, selections[index]);
                        const slotLocked = Boolean(selectedProduct && selectedSizeReady);
                        const duplicateDisabled = !combo.allowDuplicateProducts && selectedProductIds.includes(product._id);
                        const slotProductDisabled = slotLocked && !active;
                        const disabled = duplicateDisabled || slotProductDisabled;

                        return (
                          <div
                            key={product._id}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            aria-disabled={disabled}
                            aria-pressed={active}
                            onClick={() => {
                              if (disabled) return;
                              selectGroupProduct(index, product._id);
                            }}
                            onKeyDown={(event) => {
                              if (disabled || !["Enter", " "].includes(event.key)) return;
                              event.preventDefault();
                              selectGroupProduct(index, product._id);
                            }}
                            className={`group flex flex-col rounded-mt-card border p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text ${
                              active
                                ? "border-mt-text bg-mt-surface"
                                : disabled
                                  ? "cursor-not-allowed border-mt-line opacity-50"
                                  : "cursor-pointer border-mt-line hover:border-mt-line-strong"
                            }`}
                          >
                            <div className="relative aspect-[4/5] overflow-hidden rounded-mt-btn bg-mt-photo">
                              {activeProductImage ? (
                                <img
                                  src={buildImageUrl(activeProductImage)}
                                  alt={product.title}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-mt-subtle">
                                  <Package size={30} aria-hidden="true" />
                                </div>
                              )}

                              {productImages.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(event) => shiftProductImage(event, product, -1)}
                                    aria-label="Previous photo"
                                    className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                                  >
                                    <ChevronLeft size={16} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => shiftProductImage(event, product, 1)}
                                    aria-label="Next photo"
                                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                                  >
                                    <ChevronRight size={16} aria-hidden="true" />
                                  </button>
                                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                                    {imageIndex + 1}/{productImages.length}
                                  </span>
                                </>
                              )}

                              <span
                                className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                                  activeSizeReady
                                    ? "border-mt-success bg-mt-success text-white"
                                    : active
                                      ? "border-white bg-white text-black"
                                      : "border-white/70 bg-black/30"
                                }`}
                                aria-hidden="true"
                              >
                                {(activeSizeReady || active) && <Check size={14} />}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
                              <p className="line-clamp-1 text-sm text-mt-text">{product.title}</p>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <span className="text-sm text-mt-muted">{formatPrice(getProductPrice(product), currency)}</span>
                                <Link
                                  to={getProductDetailsPath(product)}
                                  state={{
                                    returnTo: `${location.pathname}${location.search || ""}`,
                                    returnLabel: "combo offer",
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-mt-subtle underline-offset-4 hover:text-mt-text hover:underline"
                                >
                                  <Eye size={13} aria-hidden="true" />
                                  Details
                                </Link>
                              </div>

                              {active && renderOptionPickers(product, index, { compact: true })}

                              {disabled && (
                                <p className="mt-2 text-[11px] text-mt-subtle">
                                  {slotProductDisabled ? "Another item is chosen for this slot" : "Already chosen in another slot"}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <h2 className="text-lg font-medium text-mt-text">What's in the box</h2>
              <p className="mt-1 text-sm text-mt-muted">Choose a size{combo.items?.some((item) => item.product?.colors?.length) ? " and colour" : ""} for each item.</p>
              <div className="mt-5 space-y-3">
                {combo.items.map((item, index) => {
                  const product = item.product;
                  return (
                    <div key={`${product._id}-${index}`} className="rounded-mt-card border border-mt-line p-3 sm:p-4">
                      <div className="flex gap-4">
                        <Link
                          to={getProductDetailsPath(product)}
                          state={{
                            returnTo: `${location.pathname}${location.search || ""}`,
                            returnLabel: "combo offer",
                          }}
                          title={`View ${product.title || "product"} details`}
                          className="h-28 w-24 shrink-0 overflow-hidden rounded-mt-btn bg-mt-photo"
                        >
                          <img
                            src={buildImageUrl(getProductImage(product))}
                            alt={product.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">Item {index + 1}</p>
                          <h3 className="mt-1 text-sm text-mt-text sm:text-base">{product.title}</h3>
                          <p className="mt-0.5 text-sm text-mt-muted">{formatPrice(getProductPrice(product), currency)}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-mt-subtle">
                            {stripHtml(product.description) || "Premium product"}
                          </p>
                        </div>
                      </div>
                      {renderOptionPickers(product, index)}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Full purchase controls on phones (the bottom bar keeps a quick Add) */}
        <div className="lg:hidden">
          <DetailSection>{purchasePanel}</DetailSection>
        </div>
      </div>

      <MobilePurchaseBar
        price={formatPrice(displayComboPrice * quantity, currency)}
        compareAt={savings > 0 ? formatPrice(originalPrice * quantity, currency) : null}
        caption={validation.complete ? `${quantity} combo${quantity > 1 ? "s" : ""} · ${completedSelectionCount} of ${totalSlots} ready` : validation.message}
      >
        <div className="flex items-center gap-2">
          <QuantityStepper
            value={quantity}
            onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
            onIncrease={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            decreaseDisabled={quantity <= 1}
            increaseDisabled={quantity >= maxQuantity}
          />
          <PrimaryPurchaseButton onClick={addComboToCart} disabled={!canBuy} busy={busy} className="px-4">
            {busy ? "Adding…" : "Add"}
          </PrimaryPurchaseButton>
        </div>
      </MobilePurchaseBar>
    </ProductPage>
  );
};

export default ComboPackDetailPage;
