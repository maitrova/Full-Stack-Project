// DropProductDetailsPage.jsx - Individual product page (FIXED)
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import DOMPurify from "dompurify";
import ExpandableDescription from "./ExpandableDescription.jsx";
import {
  getDropproductById,
  getDropproductBySlug,
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
import { CreditCard, Ruler } from "lucide-react";
import { buildImageUrl, getImageAltText, getResponsiveImageProps } from "../utils/responsiveImage.js";
import { buildDropProductPath } from "../utils/dropProductRoutes.js";
import ProductImageLightbox from "./ProductImageLightbox.jsx";
import ProductReviews from "./ProductReviews.jsx";
import ProductGallery from "./product/ProductGallery.jsx";
import {
  DetailList,
  DetailSection,
  InfoSection,
  InfoSections,
  MobilePurchaseBar,
  PriceBlock,
  PrimaryPurchaseButton,
  ProductHeading,
  ProductLayout,
  ProductPage,
  ProductPageSkeleton,
  ProductToast,
  ProductTopBar,
  QuantityStepper,
  SecondaryPurchaseButton,
  SizePicker,
  TrustRow,
} from "./product/ProductPageParts.jsx";

const imageLikeFilePattern = /\.(avif|bmp|gif|heic|heif|ico|jpe?g|jfif|png|svg|tiff?|webp)$/i;

const DropProductDetailsPage = () => {
  const { id, slug } = useParams();
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
  const sizeChartImageProps = getResponsiveImageProps(product?.sizeChart, {
    sizes: "100vw",
  });
  const sizeChartUrl = sizeChartImageProps.src;
  const videoUrl = buildImageUrl(product?.video);
  const isSizeChartImage = imageLikeFilePattern.test(String(product?.sizeChart || ""));
  const galleryMedia = useMemo(() => {
    const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    const normalizedImages =
      images.length > 0 ? images : product?.thumbnail ? [product.thumbnail] : [];
    const mediaItems = normalizedImages.map((image, index) => {
      const imageProps = getResponsiveImageProps(image, {
        sizes: "(max-width: 768px) 100vw, 1200px",
        loading: index === 0 ? "eager" : "lazy",
      });

      return {
        type: "image",
        source: image,
        src: imageProps.src || assetUrl(image),
        thumbSrc: assetUrl(image),
        alt: getImageAltText(image, `${product?.name || "Product"} - ${index + 1}`),
        label: `Image ${index + 1}`,
        imageProps,
      };
    });

    if (videoUrl) {
      mediaItems.push({
        type: "video",
        source: product?.video,
        src: videoUrl,
        thumbSrc: mediaItems[0]?.thumbSrc || undefined,
        alt: `${product?.name || "Product"} video`,
        label: "Video",
      });
    }

    return mediaItems;
  }, [assetUrl, product?.images, product?.name, product?.thumbnail, product?.video, videoUrl]);

  const galleryItems = galleryMedia.map((item) => ({
    src: item.src,
    thumbSrc: item.thumbSrc,
    alt: item.alt,
    label: item.label,
    type: item.type,
  }));

  const canonicalPath = useMemo(() => buildDropProductPath(product), [product]);

  useEffect(() => {
    if (!slug || !product?._id || !canonicalPath) return;
    if (window.location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [canonicalPath, navigate, product?._id, slug]);

  useEffect(() => {
    if (slug) {
      dispatch(getDropproductBySlug(slug));
    } else if (id) {
      dispatch(getDropproductById(id));
    }
    return () => dispatch(clearCurrentProduct());
  }, [dispatch, id, slug]);

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
        product?.video ? "Product video available" : null,
      ].filter(Boolean),
    [product?.sizeChart, product?.video, selectedVariant?.sku, variants.length]
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
    if (!galleryMedia.length) {
      setSelectedImageIndex(0);
      return;
    }

    if (selectedImageIndex >= galleryMedia.length) {
      setSelectedImageIndex(0);
    }
  }, [galleryMedia, selectedImageIndex]);

  const scrollToImage = (index) => {
    setSelectedImageIndex(index);
    setImageLoading(galleryMedia[index]?.type === "image" ? !loadedImages[index] : false);

    if (thumbnailContainerRef.current) {
      const thumbnailWidth = 80; // width + gap
      const containerWidth = thumbnailContainerRef.current.clientWidth;
      const thumbnailsCount = galleryMedia.length;
      const maxScroll = thumbnailsCount * thumbnailWidth - containerWidth;
      const scrollPosition = index * thumbnailWidth - containerWidth / 2 + thumbnailWidth / 2;

      thumbnailContainerRef.current.scrollTo({
        left: Math.max(0, Math.min(maxScroll, scrollPosition)),
        behavior: "smooth",
      });
    }
  };

  const nextImage = () => {
    const nextIndex = (selectedImageIndex + 1) % (galleryMedia.length || 1);
    scrollToImage(nextIndex);
  };

  const prevImage = () => {
    const prevIndex =
      (selectedImageIndex - 1 + (galleryMedia.length || 1)) %
      (galleryMedia.length || 1);
    scrollToImage(prevIndex);
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= currentStock) setQuantity(newQuantity);
  };

  // ✅ INR formatting (you were formatting USD before)
  const formatPrice = (price) => {
    const p = typeof price === "number" ? price : Number(price || 0);
    return `₹${p.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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
    return <ProductPageSkeleton label="Loading product details…" />;
  }

  const productTitle = product.name || product.title || "Product";
  const busy = Boolean(cartLoading);
  const lowStock = currentStock > 0 && currentStock < 5;
  const allSoldOut = variants.length
    ? variants.every((variant) => Number(variant.stock || 0) <= 0)
    : currentStock === 0;
  const purchaseLabel = busy ? "Adding…" : canPurchase ? "Add to cart" : allSoldOut ? "Sold out" : "Choose another size";
  const sizeGuideOpen = () => {
    const guide = document.getElementById("size-guide");
    if (guide) guide.open = true;
  };
  const detailRows = [
    { label: "Category", value: productMetaLine.replace(/ • /g, " / ") },
    { label: "Sizes", value: variants.length ? variants.map((v) => v.size).join(", ") : "" },
  ].filter((row) => row.value);

  const galleryMediaForView = galleryMedia.map((item) => ({
    type: item.type,
    src: item.src,
    thumbSrc: item.thumbSrc,
    alt: item.alt,
    srcSet: item.imageProps?.srcSet,
    sizes: item.imageProps?.sizes,
  }));

  return (
    <ProductPage>
      <ProductToast
        show={showCartSuccess}
        type="success"
        message={`${quantity} × ${productTitle}${selectedVariant?.size ? ` (${selectedVariant.size})` : ""} added to cart`}
        showCartLink
        onClose={() => setShowCartSuccess(false)}
      />
      <ProductToast
        show={Boolean(cartError) && !showCartSuccess}
        type="error"
        message={typeof cartError === "string" ? cartError : "Could not add to cart"}
        onClose={() => dispatch(clearCartError())}
      />

      <ProductTopBar
        onBack={() => navigate(-1)}
        backLabel={product.subCategory || product.category || "trending"}
        shareMenu={[
          { label: "Share…", onClick: () => handleShare("native") },
          { label: "Facebook", onClick: () => handleShare("facebook") },
          { label: "X (Twitter)", onClick: () => handleShare("twitter") },
          { label: "Instagram (copy link)", onClick: () => handleShare("instagram") },
        ]}
        shareMenuOpen={showShareOptions}
        onShareMenuOpenChange={setShowShareOptions}
        favorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
      />

      <ProductLayout
        gallery={
          <div ref={mainImageRef}>
          <ProductGallery
            media={galleryMediaForView}
            index={selectedImageIndex}
            onIndexChange={scrollToImage}
            onPrev={prevImage}
            onNext={nextImage}
            onOpenViewer={() => setIsImageViewerOpen(true)}
            loading={imageLoading && galleryMedia[selectedImageIndex]?.type === "image" && !loadedImages[selectedImageIndex]}
            onImageLoad={() => {
              setLoadedImages((prev) => (prev[selectedImageIndex] ? prev : { ...prev, [selectedImageIndex]: true }));
              setImageLoading(false);
            }}
            onImageError={() => {
              setLoadedImages((prev) => ({ ...prev, [selectedImageIndex]: true }));
              setImageLoading(false);
            }}
            badges={
              <>
                {allSoldOut && (
                  <span className="rounded-mt-btn bg-black/80 px-2.5 py-1 text-xs font-medium text-white">Sold out</span>
                )}
                {discount > 0 && !allSoldOut && (
                  <span className="rounded-mt-btn bg-black/80 px-2.5 py-1 text-xs font-medium text-white">{discount}% off</span>
                )}
              </>
            }
          />
          </div>
        }
      >
        <ProductHeading
          eyebrow={productMetaLine.replace(/ • /g, " · ") || "Trending"}
          title={productTitle}
          rating={product.rating}
          reviewCount={Number(product.reviewCount || 0)}
          onReviewsClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />

        <PriceBlock
          price={formatPrice(currentPrice)}
          compareAt={discount > 0 ? formatPrice(originalPrice) : null}
          saving={discount > 0 ? `Save ${formatPrice(originalPrice - currentPrice)} (${discount}%)` : null}
        />

        {variants.length > 0 && (
          <DetailSection>
            <SizePicker
              id="drop-size-selection"
              sizes={variants.map((variant) => ({
                value: variant.size,
                disabled: Number(variant.stock || 0) <= 0,
                title: Number(variant.stock || 0) <= 0 ? "Out of stock" : `${variant.stock} available`,
              }))}
              selected={selectedVariant ? selectedSize : ""}
              onSelect={handleSizeSelect}
              hint={
                selectedVariant
                  ? currentStock === 0
                    ? `Size ${selectedVariant.size} is out of stock`
                    : lowStock
                      ? `Only ${currentStock} left in size ${selectedVariant.size}`
                      : `In stock in size ${selectedVariant.size}`
                  : null
              }
              sizeGuideHref={sizeChartUrl ? "#size-guide" : null}
              onSizeGuide={sizeGuideOpen}
            />
          </DetailSection>
        )}

        <DetailSection className="space-y-3">
          <div className="flex gap-3">
            <QuantityStepper
              value={quantity}
              onDecrease={() => handleQuantityChange(-1)}
              onIncrease={() => handleQuantityChange(1)}
              decreaseDisabled={quantity <= 1 || !canPurchase}
              increaseDisabled={quantity >= currentStock || !canPurchase}
            />
            <PrimaryPurchaseButton
              onClick={handleAddToCart}
              disabled={!canPurchase || busy}
              busy={busy}
              aria-label="Add to cart"
              data-meta-track="add-to-cart"
              className="flex-1"
            >
              {purchaseLabel}
            </PrimaryPurchaseButton>
          </div>
          <SecondaryPurchaseButton onClick={handleBuyNow} disabled={!canPurchase || busy} icon={CreditCard}>
            Buy now
          </SecondaryPurchaseButton>
        </DetailSection>

        <TrustRow />

        <InfoSections>
          <InfoSection title="Description" defaultOpen>
            <ExpandableDescription
              description={product.description}
              html
              limit={260}
              className="text-sm leading-relaxed text-mt-muted [&_p]:mb-3 [&_strong]:font-medium [&_strong]:text-mt-text [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
            />
          </InfoSection>

          {(detailRows.length > 0 || productHighlights.length > 0) && (
            <InfoSection title="Product details">
              <DetailList rows={detailRows} />
              {productHighlights.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-mt-muted">
                  {productHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}
            </InfoSection>
          )}

          {sizeChartUrl && (
            <InfoSection id="size-guide" title="Size guide">
              {isSizeChartImage ? (
                <button
                  type="button"
                  onClick={() => window.open(sizeChartUrl, "_blank")}
                  className="block w-full cursor-zoom-in overflow-hidden rounded-mt-btn bg-white"
                  aria-label="Open size chart in a new tab"
                >
                  <img
                    src={sizeChartUrl}
                    srcSet={sizeChartImageProps.srcSet}
                    sizes={sizeChartImageProps.sizes}
                    alt={`${productTitle} size chart`}
                    className="w-full"
                    loading="lazy"
                    decoding={sizeChartImageProps.decoding}
                  />
                </button>
              ) : (
                <a
                  href={sizeChartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-mt-text underline underline-offset-4"
                >
                  <Ruler className="h-4 w-4" aria-hidden="true" />
                  Open the size chart
                </a>
              )}
            </InfoSection>
          )}
        </InfoSections>
      </ProductLayout>

      <MobilePurchaseBar
        price={formatPrice(currentPrice)}
        compareAt={discount > 0 ? formatPrice(originalPrice) : null}
        caption={
          canPurchase
            ? `${selectedVariant?.size ? `Size ${selectedVariant.size} · ` : ""}Qty ${quantity}`
            : allSoldOut
              ? "Out of stock"
              : `Size ${selectedVariant?.size || ""} is out of stock`
        }
      >
        <PrimaryPurchaseButton
          onClick={handleAddToCart}
          disabled={!canPurchase || busy}
          busy={busy}
          aria-label="Add to cart"
          data-meta-track="add-to-cart"
          className="min-w-[150px]"
        >
          {purchaseLabel}
        </PrimaryPurchaseButton>
      </MobilePurchaseBar>

      {product?._id ? (
        <div id="reviews" className="scroll-mt-40">
          <ProductReviews
            kind="DROPPRODUCT"
            targetId={product._id}
            initialRating={product?.rating}
            initialReviewCount={product?.reviewCount}
            initialBreakdown={product?.ratingBreakdown}
          />
        </div>
      ) : null}

      <ProductImageLightbox
        isOpen={isImageViewerOpen}
        items={galleryItems}
        initialIndex={selectedImageIndex}
        title={productTitle}
        onClose={() => setIsImageViewerOpen(false)}
        onIndexChange={setSelectedImageIndex}
      />
    </ProductPage>
  );
};

export default DropProductDetailsPage;
