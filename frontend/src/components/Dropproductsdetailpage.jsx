// DropProductDetailsPage.jsx - Individual product page (FIXED)
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import DOMPurify from "dompurify";
import {
  getDropproductById,
  selectCurrentProduct,
  selectLoading,
  clearCurrentProduct,
} from "../redux/slices/dropproducts.js";
import {
  addToCart,
  selectCartLoading,
  selectCartError,
  selectCartSuccess,
  clearError as clearCartError,
} from "../redux/slices/Cartslice.js";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Star,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Truck,
  Shield,
  RotateCw,
  Check,
  ArrowLeft,
  Minus,
  Plus,
  Instagram,
  Facebook,
  Twitter,
  Package,
  AlertCircle,
} from "lucide-react";
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";
import ProductImageLightbox from "./ProductImageLightbox.jsx";
import ProductReviews from "./ProductReviews.jsx";

const DropProductDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const product = useSelector(selectCurrentProduct);
  const loading = useSelector(selectLoading);

  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState({});
  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const mainImageRef = useRef(null);
  const thumbnailContainerRef = useRef(null);
  const assetUrl = (path) => buildImageUrl(path);
  const normalizedGalleryImages = useMemo(() => {
    const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    if (images.length > 0) return images;
    if (product?.thumbnail) return [product.thumbnail];
    return [];
  }, [product?.images, product?.thumbnail]);

  const galleryItems = normalizedGalleryImages.map((image, index) => {
    const imageProps = getResponsiveImageProps(image, {
      sizes: "(max-width: 768px) 100vw, 1200px",
      loading: index === 0 ? "eager" : "lazy",
    });

    return {
      src: imageProps.src || assetUrl(image),
      thumbSrc: assetUrl(image),
      alt: `${product?.name || "Product"} - ${index + 1}`,
      label: `Image ${index + 1}`,
    };
  });

  useEffect(() => {
    if (id) dispatch(getDropproductById(id));
    return () => dispatch(clearCurrentProduct());
  }, [id, dispatch]);

  // Clear cart error after timeout
  useEffect(() => {
    if (!cartError) return;
    const timer = setTimeout(() => dispatch(clearCartError()), 5000);
    return () => clearTimeout(timer);
  }, [cartError, dispatch]);

  useEffect(() => {
    if (!cartSuccess) return;
    setShowCartSuccess(true);
    const timer = setTimeout(() => setShowCartSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [cartSuccess]);

  // ✅ Normalize variants + selection
  const variants = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);
  const normalizedSelectedSize = String(selectedSize || "").toUpperCase();

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    const found = variants.find((v) => String(v.size || "").toUpperCase() === normalizedSelectedSize);
    return found || variants[0] || null;
  }, [variants, normalizedSelectedSize]);

  const saleActive = useMemo(() => {
    const mrp = Number(product?.minPrice || 0);
    const sale = Number(product?.salePrice || 0);
    if (!(mrp > 0) || !(sale > 0) || !(sale < mrp)) return false;
    const now = new Date();
    const start = product?.saleStartAt ? new Date(product.saleStartAt) : null;
    const end = product?.saleEndAt ? new Date(product.saleEndAt) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  }, [product]);
  const originalPrice = selectedVariant?.price ?? 0;
  const currentPrice = useMemo(() => {
    if (!saleActive || !selectedVariant?.price || !product?.minPrice) {
      return selectedVariant?.price ?? 0;
    }
    const ratio = Number(product.salePrice) / Number(product.minPrice);
    return Math.round(selectedVariant.price * ratio * 100) / 100;
  }, [product, saleActive, selectedVariant]);
  const currentStock = selectedVariant?.stock ?? 0;
  const productMetaLine = useMemo(
    () => [product?.category, product?.subCategory].filter(Boolean).join(" • "),
    [product?.category, product?.subCategory]
  );
  const productHighlights = useMemo(
    () =>
      [
        selectedVariant?.sku ? `SKU: ${selectedVariant.sku}` : null,
        variants.length ? `${variants.length} size option${variants.length > 1 ? "s" : ""}` : null,
        product?.sizeChart ? "Size chart available" : null,
      ].filter(Boolean),
    [product?.sizeChart, selectedVariant?.sku, variants.length]
  );

  // ✅ Keep size default when product loads
  useEffect(() => {
    if (!product?._id) return;
    if (!variants.length) return;

    const stillValid = variants.some((v) => String(v.size || "").toUpperCase() === normalizedSelectedSize);
    const defaultSize = stillValid ? selectedSize : variants[0].size;

    setSelectedSize(defaultSize || "");
    setQuantity(1);
  }, [product?._id]); // intentionally only when product changes

  useEffect(() => {
    setSelectedImageIndex(0);
    setLoadedImages({});
    setImageLoading(true);
  }, [product?._id]);

  useEffect(() => {
    if (!normalizedGalleryImages.length) {
      setSelectedImageIndex(0);
      return;
    }

    if (selectedImageIndex >= normalizedGalleryImages.length) {
      setSelectedImageIndex(0);
    }
  }, [normalizedGalleryImages, selectedImageIndex]);

  // Auto-rotate images
  useEffect(() => {
    if (normalizedGalleryImages.length <= 1) return;
    const interval = setInterval(() => nextImage(), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedGalleryImages, selectedImageIndex]);

  const scrollToImage = (index) => {
    setSelectedImageIndex(index);
    setImageLoading(!loadedImages[index]);

    if (thumbnailContainerRef.current) {
      const thumbnailWidth = 80; // width + gap
      const containerWidth = thumbnailContainerRef.current.clientWidth;
      const thumbnailsCount = normalizedGalleryImages.length;
      const maxScroll = thumbnailsCount * thumbnailWidth - containerWidth;
      const scrollPosition = index * thumbnailWidth - containerWidth / 2 + thumbnailWidth / 2;

      thumbnailContainerRef.current.scrollTo({
        left: Math.max(0, Math.min(maxScroll, scrollPosition)),
        behavior: "smooth",
      });
    }
  };

  const nextImage = () => {
    const nextIndex = (selectedImageIndex + 1) % (normalizedGalleryImages.length || 1);
    scrollToImage(nextIndex);
  };

  const prevImage = () => {
    const prevIndex =
      (selectedImageIndex - 1 + (normalizedGalleryImages.length || 1)) %
      (normalizedGalleryImages.length || 1);
    scrollToImage(prevIndex);
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= currentStock) setQuantity(newQuantity);
  };

  // ✅ INR formatting (you were formatting USD before)
  const formatPrice = (price) => {
    const p = typeof price === "number" ? price : Number(price || 0);
    return `₹${p.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const calculateDiscount = (original, current) => {
    if (original > current) return Math.round(((original - current) / original) * 100);
    return 0;
  };

  // ✅ Use currentPrice for discount, not product.price
  const discount = calculateDiscount(originalPrice, currentPrice);
  const canPurchase = currentStock > 0 && !!selectedVariant;

  const trackMetaAddToCart = () => {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;

    window.fbq("track", "AddToCart", {
      content_ids: [String(product?._id || "")],
      content_name: product?.name || product?.title || "Drop Product",
      content_type: "product",
      contents: [
        {
          id: String(product?._id || ""),
          quantity,
          item_price: Number(currentPrice || 0),
        },
      ],
      currency: "INR",
      value: Number(currentPrice || 0) * Number(quantity || 1),
    });
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    setQuantity(1);
  };

  const SizeSelection = () => (
    <div className="space-y-2 sm:space-y-3" id="drop-size-selection">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 sm:text-lg">Select Size</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const variantSize = String(variant.size || "").toUpperCase();
          const isSelected = variantSize === normalizedSelectedSize;
          const isDisabled = Number(variant.stock || 0) <= 0;
          const stockStatus = isDisabled ? "Out of stock" : `${variant.stock} available`;

          return (
            <button
              key={variant.size}
              type="button"
              onClick={() => !isDisabled && handleSizeSelect(variant.size)}
              disabled={isDisabled}
              title={stockStatus}
              className={`
                relative min-w-[52px] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all duration-200 sm:min-w-[70px] sm:border-2 sm:px-4 sm:py-3 sm:text-base
                ${isSelected
                  ? "border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-200"
                  : isDisabled
                    ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through"
                    : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"}
              `}
            >
              <span className="block">{variant.size}</span>
              {!isDisabled ? (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-green-500 sm:-right-2 sm:-top-2 sm:h-4 sm:w-4 sm:border-2"></span>
              ) : null}
            </button>
          );
        })}
      </div>

      {null}
    </div>
  );

  // ✅ Signature should NOT rely on variant._id (your variant objects may not have _id)
  const generateSignature = () => {
    const sku = selectedVariant?.sku ? String(selectedVariant.sku) : "";
    return `READYMADE_DROP_${product?._id || ""}_${String(selectedSize || "").toUpperCase()}_${sku}`;
  };

  // ✅ Add to cart (FIX: send dropproductId + dropproductName for CartPage display)
  const handleAddToCart = async () => {
    if (!selectedVariant) {
      alert("Please select a size first");
      return;
    }
    if (currentStock === 0) {
      alert("This product is out of stock");
      return;
    }
    if (quantity > currentStock) {
      alert(`Only ${currentStock} units available`);
      return;
    }

    const cartData = {
      kind: "READYMADE",
      dropproductId: product._id, // ✅ correct id for drop product
      size: selectedSize,
      qty: quantity,
      unitPrice: currentPrice,
      currency: "INR",
      previewImage: product?.images?.[0] || "",
      signature: generateSignature(),

      // ✅ these fields help you show correct name even if backend doesn't populate dropproduct object
      dropproductName: product?.name || product?.title || "Drop Product",
      name: product?.name || product?.title || "Drop Product",

      // Optional metadata
      category: product?.category,
      variantSku: selectedVariant?.sku,
      variantSize: selectedVariant?.size,
      maxStock: currentStock,
    };

    try {
      await dispatch(addToCart(cartData)).unwrap();
      trackMetaAddToCart();
    } catch (err) {
      console.error("Failed to add to cart:", err);
    }
  };

  // ✅ Buy now should use SAME dropproductId (your earlier code used readymadeProduct incorrectly)
  const handleBuyNow = async () => {
    if (!selectedVariant) {
      alert("Please select a size first");
      return;
    }
    if (currentStock === 0) {
      alert("This product is out of stock");
      return;
    }
    if (quantity > currentStock) {
      alert(`Only ${currentStock} units available`);
      return;
    }

    const cartData = {
      kind: "READYMADE",
      dropproductId: product._id,
      size: selectedSize,
      qty: quantity,
      unitPrice: currentPrice,
      currency: "INR",
      previewImage: product?.images?.[0] || "",
      signature: generateSignature(),
      dropproductName: product?.name || product?.title || "Drop Product",
      name: product?.name || product?.title || "Drop Product",
      category: product?.category,
      variantSku: selectedVariant?.sku,
      variantSize: selectedVariant?.size,
      maxStock: currentStock,
    };

    try {
      await dispatch(addToCart(cartData)).unwrap();
      navigate("/checkout");
    } catch (err) {
      console.error("Failed to add to cart:", err);
    }
  };

  const handleShare = (platform) => {
    const shareUrl = window.location.href;
    const text = `Check out ${product?.name} - ${formatPrice(currentPrice)}`;

    switch (platform) {
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
            shareUrl
          )}`,
          "_blank"
        );
        break;
      case "instagram":
        navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard! Paste it in Instagram.");
        break;
      default:
        if (navigator.share) {
          navigator.share({ title: product?.name, text, url: shareUrl });
        } else {
          navigator.clipboard.writeText(shareUrl);
          alert("Link copied to clipboard!");
        }
    }
    setShowShareOptions(false);
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Cart Success Notification */}
      {showCartSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-50 border border-green-200 rounded-xl shadow-lg p-4 max-w-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Added to cart successfully!</h3>
                <p className="mt-1 text-sm text-green-700">
                  {quantity} × {product.name} ({selectedVariant?.size})
                </p>
                <div className="mt-2">
                  <button
                    onClick={() => navigate("/cart")}
                    className="text-sm font-medium text-green-700 hover:text-green-800 underline"
                  >
                    View Cart →
                  </button>
                </div>
              </div>
              <button onClick={() => setShowCartSuccess(false)} className="ml-auto pl-3">
                <span className="sr-only">Close</span>
                <span className="text-green-500 hover:text-green-700">×</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Error Notification */}
      {cartError && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-lg p-4 max-w-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Cart Error</h3>
                <p className="mt-1 text-sm text-red-700">{cartError}</p>
              </div>
              <button onClick={() => dispatch(clearCartError())} className="ml-auto pl-3">
                <span className="sr-only">Close</span>
                <span className="text-red-500 hover:text-red-700">×</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Products
        </button>
      </div>

      {/* Product Details Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-[17rem] lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 xl:gap-16">
          {/* Left Column - Images */}
          <div className="space-y-6 lg:col-span-2">
            {/* Main Image */}
            <div className="relative rounded-3xl shadow-xl overflow-hidden group bg-gradient-to-br from-slate-100 via-white to-slate-100">
              <div className="relative h-[500px] md:h-[600px] overflow-hidden">
                {normalizedGalleryImages.map((image, index) => {
                  const imageProps = getResponsiveImageProps(image, {
                    sizes: "(max-width: 1024px) 100vw, 50vw",
                    loading: index === 0 ? "eager" : "lazy",
                  });

                  return (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === selectedImageIndex ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {imageLoading && <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>}

                    <img
                      ref={mainImageRef}
                      src={imageProps.src}
                      srcSet={imageProps.srcSet}
                      sizes={imageProps.sizes}
                      alt={`${product.name} - ${index + 1}`}
                      className={`w-full h-full object-contain p-4 transition-transform duration-700 ${
                        imageLoading ? "opacity-0" : "opacity-100"
                      }`}
                      onClick={() => setIsImageViewerOpen(true)}
                      style={
                        imageProps.placeholder
                          ? {
                              backgroundImage: `url(${imageProps.placeholder})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }
                          : undefined
                      }
                      onLoad={() => {
                        setLoadedImages((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
                        if (index === selectedImageIndex) {
                          setImageLoading(false);
                        }
                      }}
                      onError={() => {
                        setLoadedImages((prev) => ({ ...prev, [index]: true }));
                        if (index === selectedImageIndex) {
                          setImageLoading(false);
                        }
                      }}
                      loading={imageProps.loading}
                      decoding={imageProps.decoding}
                      fetchPriority={imageProps.fetchPriority}
                    />
                  </div>
                  );
                })}

                {!!normalizedGalleryImages.length && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                    <span className="rounded-full bg-black/65 px-4 py-2 text-xs font-semibold tracking-tight text-white shadow-lg backdrop-blur-sm">
                      Tap image for full screen
                    </span>
                  </div>
                )}

                {/* Nav overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={prevImage}
                    type="button"
                    className="pointer-events-auto absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl transition-all hover:scale-110"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    type="button"
                    className="pointer-events-auto absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl transition-all hover:scale-110"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Counter */}
                <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full">
                  {selectedImageIndex + 1} / {normalizedGalleryImages.length}
                </div>

                {/* Discount */}
                {discount > 0 && (
                  <div className="absolute top-6 left-6 px-4 py-2 bg-red-500 text-white font-bold rounded-lg shadow-lg">
                    -{discount}%
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            <div className="relative">
              <div
                ref={thumbnailContainerRef}
                className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {normalizedGalleryImages.map((image, index) => {
                  const thumbProps = getResponsiveImageProps(image, {
                    sizes: "80px",
                  });

                  return (
                  <button
                    key={index}
                    onClick={() => scrollToImage(index)}
                    className={`flex-none w-20 h-20 rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                      index === selectedImageIndex
                        ? "border-blue-500 ring-4 ring-blue-100 scale-105"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={thumbProps.src}
                      srcSet={thumbProps.srcSet}
                      sizes={thumbProps.sizes}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading={thumbProps.loading}
                      decoding={thumbProps.decoding}
                      fetchPriority={thumbProps.fetchPriority}
                    />
                  </button>
                  );
                })}
              </div>

              {normalizedGalleryImages.length > 5 && (
                <>
                  <button
                    onClick={() => thumbnailContainerRef.current?.scrollBy({ left: -100, behavior: "smooth" })}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2 p-2 bg-white rounded-full shadow-lg hover:shadow-xl"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => thumbnailContainerRef.current?.scrollBy({ left: 100, behavior: "smooth" })}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-2 p-2 bg-white rounded-full shadow-lg hover:shadow-xl"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Product Info */}
          <div className="space-y-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-4 py-1.5 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                  {product.category}
                </span>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`p-2.5 rounded-full transition-all hover:scale-110 ${
                      isFavorite ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowShareOptions(!showShareOptions)}
                      className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all hover:scale-110"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>

                    {showShareOptions && (
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border py-2 z-50 min-w-[200px]">
                        <button
                          onClick={() => handleShare("facebook")}
                          className="flex items-center w-full px-4 py-3 hover:bg-blue-50 text-gray-700"
                        >
                          <Facebook className="w-5 h-5 mr-3 text-blue-600" />
                          Share on Facebook
                        </button>
                        <button
                          onClick={() => handleShare("twitter")}
                          className="flex items-center w-full px-4 py-3 hover:bg-blue-50 text-gray-700"
                        >
                          <Twitter className="w-5 h-5 mr-3 text-blue-500" />
                          Share on Twitter
                        </button>
                        <button
                          onClick={() => handleShare("instagram")}
                          className="flex items-center w-full px-4 py-3 hover:bg-pink-50 text-gray-700"
                        >
                          <Instagram className="w-5 h-5 mr-3 text-pink-600" />
                          Share on Instagram
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 mb-3">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                {productMetaLine && (
                  <span className="text-base font-medium text-gray-600">{productMetaLine}</span>
                )}
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{Number(product?.rating || 0).toFixed(1)}</span>
                  <span className="text-amber-600/80">({Number(product?.reviewCount || 0)})</span>
                </div>
                <span
                  className={`font-bold text-lg ${
                    currentStock > 10 ? "text-green-600" : currentStock > 0 ? "text-yellow-600" : "text-red-600"
                  }`}
                >
                  {currentStock > 0 ? `${currentStock} in stock` : "Out of stock"}
                </span>
                {selectedVariant?.sku && (
                  <span className="text-sm font-medium text-gray-500">SKU {selectedVariant.sku}</span>
                )}
              </div>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Price</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {formatPrice(currentPrice)}
                  </span>
                  {discount > 0 ? (
                    <span className="text-lg text-gray-400 line-through">
                      {formatPrice(originalPrice)}
                    </span>
                  ) : null}
                </div>
                {discount > 0 ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      {discount}% OFF
                    </span>
                    <span className="text-emerald-700">
                      MRP {formatPrice(originalPrice)}
                    </span>
                  </div>
                ) : null}
                <p className="mt-2 text-sm text-gray-500">Inclusive of all taxes</p>
              </div>
            </div>

            {/* Size Selector */}
            {variants.length > 0 && (
              <div className="hidden space-y-4 border-t pt-8 lg:block">
                <SizeSelection />
                <h3 className="hidden text-lg font-semibold text-gray-900">Select Size</h3>
                <div className="hidden flex-wrap gap-3">
                  {variants.map((v) => {
                    const isSelected = String(v.size || "").toUpperCase() === normalizedSelectedSize;
                    const isOut = (v.stock ?? 0) === 0;

                    return (
                      <button
                        key={v.size}
                        type="button"
                        onClick={() => {
                          setSelectedSize(v.size);
                          setQuantity(1);
                        }}
                        disabled={isOut}
                        className={`px-5 py-3 rounded-xl border font-semibold transition-all
                          ${isSelected ? "border-blue-500 ring-4 ring-blue-100" : "border-gray-200 hover:border-gray-300"}
                          ${isOut ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}
                        `}
                      >
                        {v.size}
                        <span className="ml-2 text-sm text-gray-500">({v.stock} left)</span>
                      </button>
                    );
                  })}
                </div>

                {selectedVariant && (
                  <div className="hidden text-gray-600">
                    <span className="font-semibold text-gray-900">Price:</span> {formatPrice(currentPrice)}
                    <span className="mx-2">•</span>
                    <span className="font-semibold text-gray-900">Stock:</span> {currentStock}
                  </div>
                )}
              </div>
            )}

            {product?.sizeChart && (
              <div className="space-y-4 border-t pt-8">
                <h3 className="text-xl font-semibold text-gray-900">Size Chart</h3>
                <img
                  src={assetUrl(product.sizeChart)}
                  alt={`${product.name} size chart`}
                  className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white"
                />
              </div>
            )}

            {/* Quantity */}
            <div className="hidden space-y-4 border-t pt-8 lg:block">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Quantity</h3>
                <span className="text-sm text-gray-600">{currentStock} available</span>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="px-5 py-3 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="px-8 py-3 text-xl font-bold border-x border-gray-300">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= currentStock}
                    className="px-5 py-3 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <span className="text-gray-600">{currentStock} units available</span>
              </div>
            </div>

            {/* Actions */}
            <div className="hidden space-y-4 border-t pt-8 lg:block">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  id="dropproduct-add-to-cart-desktop"
                  aria-label="Add to cart"
                  data-meta-track="add-to-cart"
                  onClick={handleAddToCart}
                  disabled={!canPurchase || cartLoading}
                  className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                    !canPurchase
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90"
                  } ${cartLoading ? "opacity-70 cursor-wait" : ""}`}
                >
                  {cartLoading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Add to Cart
                    </>
                  )}
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={!canPurchase || cartLoading}
                  className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                    !canPurchase
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  Buy Now
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t">
              <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Shipping Ready</p>
                  <p className="text-sm text-gray-600">
                    {currentStock > 0 ? "Available for checkout now" : "Currently unavailable"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-xl">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Secure Checkout</p>
                  <p className="text-sm text-gray-600">Protected payment flow</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="prose max-w-none border-t pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <div
                className="text-gray-700 leading-relaxed text-base mb-6"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || "") }}
              />
              {productHighlights.length > 0 && (
                <div className="space-y-3">
                  {productHighlights.map((highlight) => (
                    <div key={highlight} className="flex items-center text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {product?._id ? (
        <div className="pb-[17rem] lg:pb-0">
          <ProductReviews
            kind="DROPPRODUCT"
            targetId={product._id}
            initialRating={product?.rating}
            initialReviewCount={product?.reviewCount}
            initialBreakdown={product?.ratingBreakdown}
          />
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-lg lg:hidden">
        <div className="max-h-[45vh] overflow-y-auto space-y-3 p-3">
          {variants.length > 0 ? <SizeSelection /> : null}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Qty</span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1 || !canPurchase}
                className={`flex h-9 w-9 items-center justify-center rounded-l-lg border border-gray-300 ${
                  quantity <= 1 || !canPurchase ? "cursor-not-allowed opacity-50" : "hover:bg-gray-50"
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex h-9 w-12 items-center justify-center border-y border-gray-300">
                <span className="text-sm font-medium">{quantity}</span>
              </div>
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= currentStock || !canPurchase}
                className={`flex h-9 w-9 items-center justify-center rounded-r-lg border border-gray-300 ${
                  quantity >= currentStock || !canPurchase ? "cursor-not-allowed opacity-50" : "hover:bg-gray-50"
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              id="dropproduct-add-to-cart-mobile"
              aria-label="Add to cart"
              data-meta-track="add-to-cart"
              onClick={handleAddToCart}
              disabled={!canPurchase || cartLoading}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                !canPurchase
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90"
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add to Cart
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!canPurchase || cartLoading}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                !canPurchase
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Buy Now
            </button>
          </div>
        </div>
      </div>

      <ProductImageLightbox
        isOpen={isImageViewerOpen}
        items={galleryItems}
        initialIndex={selectedImageIndex}
        title={product?.name || "Product gallery"}
        onClose={() => setIsImageViewerOpen(false)}
        onIndexChange={setSelectedImageIndex}
      />
    </div>
  );
};

export default DropProductDetailsPage;
