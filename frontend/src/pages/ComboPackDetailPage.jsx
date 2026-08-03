import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import { Check, ChevronLeft, Package, ShieldCheck, ShoppingCart, Tag } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, getCart, selectCartLoading } from "../redux/slices/Cartslice.js";
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";

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

const getProductPrice = (product) =>
  Number(product?.pricing?.mrp || product?.mrp || product?.price || 0);

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
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const loadCombo = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(`${API_URL}/combo-packs/slug/${slug}`);
        setCombo(response.data.data);
        setSelectedImage(0);
        setSelections({});
        setQuantity(1);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load combo pack");
      } finally {
        setLoading(false);
      }
    };
    loadCombo();
  }, [slug]);

  const gallery = useMemo(() => {
    if (!combo) return [];
    const customImages = [
      combo.featuredImage,
      ...(combo.galleryImages || []).map((image) => image.url),
      combo.bannerImage,
    ].filter(Boolean);
    const productImages = combo.productImages || [];
    return combo.imageMode === "CUSTOM_IMAGES" && customImages.length
      ? customImages
      : productImages;
  }, [combo]);

  const updateSelection = (index, field, value) => {
    setSelections((current) => ({
      ...current,
      [index]: {
        ...(current[index] || {}),
        [field]: value,
      },
    }));
  };

  const validation = useMemo(() => {
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
  }, [combo, quantity, selections]);

  const maxQuantity = useMemo(() => {
    if (!combo?.items?.length) return 1;
    const stocks = combo.items.map((item, index) => {
      const product = item.product;
      const selection = selections[index] || {};
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length && !selection.size) return 1;
      return getVariantStock(product, selection.size);
    });
    return Math.max(1, Math.min(...stocks.filter((stock) => Number.isFinite(stock))));
  }, [combo, selections]);

  const addComboToCart = async () => {
    if (!combo || !validation.complete) return false;
    setAdding(true);
    setNotice("");
    setError("");
    try {
      const comboSelections = combo.items.map((item, index) => ({
        productId: item.product._id,
        size: selections[index]?.size || "",
        color: selections[index]?.color || "",
      }));

      await dispatch(
        addToCart({
          kind: "COMBO",
          comboPackId: combo._id,
          comboSelections,
          qty: quantity,
        })
      ).unwrap();
      await dispatch(getCart());
      setNotice("Combo pack added to cart");
      return true;
    } catch (err) {
      setError(err.message || "Failed to add combo pack to cart");
      return false;
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8 text-center text-gray-600">Loading combo pack...</div>;
  }

  if (error && !combo) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/combo-packs" className="mt-4 inline-flex text-indigo-700">
          Back to combo packs
        </Link>
      </div>
    );
  }

  const activeImage = gallery[selectedImage] || combo.displayImage;
  const activeImageProps = getResponsiveImageProps(activeImage, {
    sizes: "(max-width: 1024px) 100vw, 50vw",
    loading: "eager",
  });
  const originalPrice = Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
  const savings = Number(combo.pricing?.savingsAmount || 0);
  const discount = Number(combo.pricing?.discountPercentage || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/combo-packs")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950"
        >
          <ChevronLeft size={18} />
          Combo Packs
        </button>

        {(notice || error) && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:items-start">
          <section className="lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Combo Gallery
                </p>
              </div>
              <div className="aspect-square bg-white">
              {activeImage ? (
                <img
                  src={activeImageProps.src || buildImageUrl(activeImage)}
                  srcSet={activeImageProps.srcSet}
                  sizes={activeImageProps.sizes}
                  alt={combo.name}
                    className="h-full w-full object-contain p-6"
                  loading={activeImageProps.loading}
                  decoding={activeImageProps.decoding}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="text-gray-400" size={42} />
                </div>
              )}
              </div>
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
                {gallery.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square rounded-md border bg-white p-1 transition ${
                      selectedImage === index
                        ? "border-gray-950 ring-2 ring-gray-950/10"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <img src={buildImageUrl(image)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    <Tag size={13} />
                    Combo Offer
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold leading-tight text-gray-950 sm:text-3xl">
                    {combo.name}
                  </h1>
                </div>
                {discount > 0 && (
                  <span className="rounded-full bg-gray-950 px-3 py-1.5 text-sm font-semibold text-white">
                    {discount}% OFF
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Original value</p>
                  <p className="mt-1 text-lg font-semibold text-gray-500 line-through">
                    {formatPrice(originalPrice, combo.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Combo price</p>
                  <p className="mt-1 text-3xl font-bold text-gray-950">
                    {formatPrice(combo.comboPrice, combo.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Savings</p>
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    {formatPrice(savings, combo.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-4 text-gray-700">
                  <span>Products total</span>
                  <span className="font-semibold text-gray-950">{formatPrice(originalPrice, combo.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-gray-700">
                  <span>Offer price</span>
                  <span className="font-semibold text-gray-950">{formatPrice(combo.comboPrice, combo.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-emerald-200 pt-2 font-semibold text-emerald-800">
                  <span>You save on this combo</span>
                  <span>{formatPrice(savings, combo.currency)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>Choose the required size and color for each included product before adding this combo to cart.</span>
              </div>

              {(combo.fullDescription || combo.shortDescription) && (
                <div
                  className="mt-4 text-sm leading-6 text-gray-600"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(combo.fullDescription || combo.shortDescription || ""),
                  }}
                />
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">Included Products</h2>
                  <p className="mt-1 text-sm text-gray-500">Select variants for each product in the combo.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  {combo.includedProductsCount} items
                </span>
              </div>

              <div className="space-y-3">
                {combo.items.map((item, index) => {
                  const product = item.product;
                  const variants = Array.isArray(product?.variants) ? product.variants : [];
                  const colors = Array.isArray(product?.colors) ? product.colors : [];
                  const selectedSize = selections[index]?.size || "";
                  const selectedStock = getVariantStock(product, selectedSize);
                  const outOfStock = variants.length ? selectedSize && selectedStock <= 0 : selectedStock <= 0;

                  return (
                    <div key={`${product._id}-${index}`} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex gap-3">
                        <img
                          src={buildImageUrl(getProductImage(product))}
                          alt=""
                          className="h-20 w-20 rounded-md bg-gray-100 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                Item {index + 1}
                              </p>
                              <h3 className="font-semibold text-gray-950">{product.title}</h3>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-gray-800">
                              {formatPrice(getProductPrice(product), combo.currency)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                            {stripHtml(product.description) || "Catalog product"}
                          </p>
                          {selectedSize && (
                            <p className={`mt-1 text-xs font-medium ${outOfStock ? "text-red-600" : "text-emerald-700"}`}>
                              {outOfStock ? "Out of Stock" : `${selectedStock} available`}
                            </p>
                          )}
                        </div>
                      </div>

                      {colors.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Color</p>
                          <div className="flex flex-wrap gap-2">
                            {colors.map((color) => {
                              const colorValue = color.value || color.label || color;
                              const active = selections[index]?.color === colorValue;
                              return (
                                <button
                                  key={colorValue}
                                  type="button"
                                  onClick={() => updateSelection(index, "color", colorValue)}
                                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                                    active ? "border-gray-950 bg-gray-950 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"
                                  }`}
                                >
                                  <span
                                    className="h-4 w-4 rounded-full border border-gray-300 bg-white"
                                    style={{ backgroundColor: colorValue }}
                                  />
                                  {color.label || colorValue}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {variants.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Size</p>
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
                                  className={`min-w-11 rounded-md border px-3 py-2 text-xs font-semibold ${
                                    active
                                      ? "border-gray-950 bg-gray-950 text-white"
                                      : disabled
                                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through"
                                        : "border-gray-300 bg-white text-gray-800 hover:border-gray-500"
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

            <div className="sticky bottom-0 z-30 rounded-lg border border-gray-200 bg-white p-4 shadow-xl lg:static">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity</p>
                  <div className="mt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="h-9 w-9 rounded-l-md border border-gray-300 text-lg hover:bg-gray-50"
                    >
                      -
                    </button>
                    <div className="flex h-9 w-11 items-center justify-center border-y border-gray-300 text-sm font-semibold">
                      {quantity}
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                      disabled={quantity >= maxQuantity}
                      className="h-9 w-9 rounded-r-md border border-gray-300 text-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-950">
                    {formatPrice(Number(combo.comboPrice || 0) * quantity, combo.currency)}
                  </p>
                  {savings > 0 && (
                    <p className="text-xs font-medium text-emerald-700">
                      Saving {formatPrice(savings * quantity, combo.currency)}
                    </p>
                  )}
                </div>
              </div>
              {!validation.complete && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {validation.message}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={addComboToCart}
                  disabled={!validation.complete || adding || cartLoading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-950 bg-white text-sm font-semibold text-gray-950 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {adding || cartLoading ? "Adding..." : "Add to Cart"}
                  {!adding && <ShoppingCart size={18} />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const added = await addComboToCart();
                    if (added) navigate("/cart");
                  }}
                  disabled={!validation.complete || adding || cartLoading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-gray-950 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  Buy Now
                  <Check size={18} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ComboPackDetailPage;
