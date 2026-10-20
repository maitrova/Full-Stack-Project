// src/pages/CatalogueDetailPage.jsx
import React, { useEffect, useState } from "react";
import ExpandableDescription from "../components/ExpandableDescription.jsx";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CreditCard } from "lucide-react";

// Import cart actions and selectors
import { 
  addToCart, 
  updateCartItemQty,
  removeCartItem,
  selectCartItems,
  selectCartLoading,
  selectCartError,
  selectCartSuccess,
  resetCartState,
  clearError,
  clearSuccess
} from "../redux/slices/Cartslice.js";

// Import user selector for login check
import { selectCurrentToken } from "../redux/slices/Userslice.js";

// Import product size selection slice actions and selectors
import {
  fetchProductPrice,
  selectSize,
  setDesignId,
  calculatePriceLocally,
  clearError as clearPriceError,
  selectPriceDetails,
  selectIsLoading as selectPriceLoading,
  selectError as selectPriceError,
  selectIsSizeSelected,
  resetProductSizeSelection
} from "../redux/slices/productsizeselection.js";
import ProductImageLightbox from "../components/ProductImageLightbox.jsx";
import { getResponsiveImageProps } from "../utils/responsiveImage.js";
import ProductGallery from "../components/product/ProductGallery.jsx";
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
  ProductNotFound,
  ProductPage,
  ProductPageSkeleton,
  ProductToast,
  ProductTopBar,
  QuantityStepper,
  SecondaryPurchaseButton,
  SizePicker,
  TrustRow,
} from "../components/product/ProductPageParts.jsx";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

export default function CatalogueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const SIZES = ["S", "M", "L", "XL", "XXL"];
  const [selectedSize, setSelectedSize] = useState("");
  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localCartQuantity, setLocalCartQuantity] = useState(0);
  const [activeTab, setActiveTab] = useState("specifications");
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  
  // Redux selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);
  
  // Product size selection selectors
  const priceDetails = useSelector(selectPriceDetails);
  const priceLoading = useSelector(selectPriceLoading);
  const priceError = useSelector(selectPriceError);
  const isSizeSelected = useSelector(selectIsSizeSelected);
  
  const canPurchase = !!token && !!selectedSize;

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        const res = await fetch(`${API_URL}/savedata/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load design");
        setDesign(data);
        
        // Set design ID in the size selection slice
        dispatch(setDesignId(data._id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDesign();
  }, [id, dispatch]);

  // Fetch price when size is selected
  useEffect(() => {
    if (selectedSize && design?._id) {
      console.log(`Fetching price for design ${design._id}, size ${selectedSize}`);
      dispatch(fetchProductPrice({ designId: design._id, selectedSize }))
        .unwrap()
        .catch((error) => {
          console.warn('Price API failed, using local calculation:', error);
          // If API fails, calculate price locally
          const basePrice = design.salePrice || design.product?.basePrice || 0;
          if (basePrice > 0) {
            dispatch(calculatePriceLocally({ basePrice, selectedSize }));
          }
        });
    }
  }, [selectedSize, design?._id, dispatch]);

  // Handle size selection
  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    dispatch(selectSize(size));
    dispatch(clearPriceError()); // Clear any previous errors
  };

  // Get the current price (either from API, local calculation, or fallback to design sale price)
  const getCurrentPrice = () => {
    // If we have calculated price from API or local calculation
    if (priceDetails?.calculatedPrice > 0) {
      return priceDetails.calculatedPrice;
    }
    
    // If we have base price from API
    if (priceDetails?.basePrice > 0) {
      return priceDetails.basePrice;
    }
    
    // Fallback to design sale price
    return design?.salePrice || design?.product?.basePrice || 0;
  };

  // Check if price is from API or local calculation
  const isLocalPrice = priceDetails?.calculatedPrice > 0 && priceError;

  // Get cart quantity for this design and size
  const getCartQuantity = () => {
    if (localCartQuantity !== 0) {
      return localCartQuantity;
    }
    
    const item = cartItems.find(item => 
      item.designId === id && 
      item.size === selectedSize
    );
    return item ? item.qty : 0;
  };

  const quantity = getCartQuantity();
  const isInCart = quantity > 0;
  const isUpdating = cartLoading && localCartQuantity !== 0;
  const currentPrice = getCurrentPrice();

  // Handle notifications
  useEffect(() => {
    if (cartSuccess) {
      setNotification({
        show: true,
        message: 'Added to cart successfully',
        type: 'success'
      });
      dispatch(clearSuccess());
    }
    
    if (cartError) {
      setNotification({
        show: true,
        message: cartError,
        type: 'error'
      });
      dispatch(clearError());
    }
    
    if (priceError) {
      console.log('Price error detected:', priceError);
      // Don't show notification for price errors if we have local calculation
      if (!priceDetails?.calculatedPrice) {
        setNotification({
          show: true,
          message: `Using estimated price for ${selectedSize}. API temporarily unavailable.`,
          type: 'warning'
        });
      }
    }
  }, [cartSuccess, cartError, priceError, dispatch, priceDetails, selectedSize]);

  // Clear notifications after 3 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!design) return;

    if (!selectedSize) {
      setNotification({ show: true, message: "Please select a size before adding to cart", type: "warning" });
      return;
    }

    try {
      const designKind = design.kind || "DESIGN";
      const kind = designKind.toUpperCase() === "READYMADE" ? "READYMADE" : "DESIGN";

      const cartData = {
        designId: design._id,
        productId: design.product?._id || design.productId || "",
        title: design.title || design.productName || "",
        unitPrice: currentPrice,
        basePrice: design.product?.basePrice || currentPrice,
        qty: 1,
        previewImage: design.previewImage || design.views?.[0]?.previewImage || "",
        signature: `${design._id}-${design.product?._id || design.productId || ""}-${selectedSize}`,
        kind,
        size: selectedSize,
        views: design.views || [],
        ...(priceDetails ? { priceDetails } : {}),
      };

      setLocalCartQuantity(1);
      await dispatch(addToCart(cartData)).unwrap();
      setTimeout(() => setLocalCartQuantity(0), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      setNotification({
        show: true,
        message: 'Failed to add to cart. Please try again.',
        type: 'error'
      });
      setLocalCartQuantity(0);
    }
  };

  // Handle increment quantity
  const handleIncrement = async () => {
    if (!design) return;

    const currentQty = quantity;
    const cartItem = cartItems.find(item => 
      item.designId === design._id && 
      item.size === selectedSize
    );
    
    if (!cartItem) {
      handleAddToCart();
      return;
    }

    try {
      setLocalCartQuantity(currentQty + 1);
      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty + 1
      })).unwrap();
      
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      setLocalCartQuantity(0);
    }
  };

  // Handle decrement quantity
  const handleDecrement = async () => {
    if (!design) return;

    const currentQty = quantity;
    const cartItem = cartItems.find(item => 
      item.designId === design._id && 
      item.size === selectedSize
    );
    
    if (!cartItem || currentQty <= 1) {
      handleRemoveFromCart();
      return;
    }

    try {
      setLocalCartQuantity(currentQty - 1);
      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty - 1
      })).unwrap();
      
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      setLocalCartQuantity(0);
    }
  };

  // Handle remove from cart
  const handleRemoveFromCart = async () => {
    if (!design) return;

    const cartItem = cartItems.find(item => 
      item.designId === design._id && 
      item.size === selectedSize
    );
    if (!cartItem) return;

    try {
      setLocalCartQuantity(0);
      await dispatch(removeCartItem(cartItem._id)).unwrap();
      
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to remove from cart:", error);
      setLocalCartQuantity(quantity);
    }
  };

  // Handle buy now
  const handleBuyNow = async () => {
    if (isInCart) {
      navigate('/cart');
    } else {
      await handleAddToCart();
      setTimeout(() => navigate('/cart'), 500);
    }
  };

  // Reset states on unmount
  useEffect(() => {
    return () => {
      dispatch(resetCartState());
      dispatch(resetProductSizeSelection());
    };
  }, [dispatch]);

  // Reset local cart quantity when design changes
  useEffect(() => {
    setLocalCartQuantity(0);
    setSelectedSize("");
  }, [id]);

  if (loading) return <ProductPageSkeleton label="Loading design…" />;

  if (error) return (
    <ProductNotFound
      title="Design not found"
      message={error}
      onBack={() => navigate(-1)}
      browseLabel="Browse catalogue"
      onBrowse={() => navigate("/catalogue")}
    />
  );

  if (!design) return null;

  const views = design.views || [];
  const sizeChartImageProps = getResponsiveImageProps(design.product?.sizeChart, {
    sizes: "100vw",
  });
  const sizeChartUrl = sizeChartImageProps.src;
  const galleryViewIndexes = views.reduce((acc, view, index) => {
    if (view?.previewImage) {
      acc.push(index);
    }
    return acc;
  }, []);
  const galleryItems = galleryViewIndexes.map((viewIndex, index) => {
    const view = views[viewIndex];
    return {
      src: view.previewImage,
      alt: view.code || `${design.title || design.productName} view ${index + 1}`,
      label: view.code?.toUpperCase() || `VIEW ${index + 1}`,
    };
  });
  const currentGalleryIndex = Math.max(0, galleryViewIndexes.indexOf(activeView));
  const stats = {
    totalTextLayers: views.reduce((acc, view) => acc + (view.textLayers?.length || 0), 0),
    totalImageLayers: views.reduce((acc, view) => acc + (view.designLayers?.length || 0), 0),
    totalViews: views.length
  };
  const hasPriceDiscount = Boolean(design.product?.basePrice && currentPrice < design.product.basePrice);
  const cartTotal = (quantity * currentPrice).toFixed(2);

  const money = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const designTitle = design.title || design.productName || "Design";
  const busy = Boolean(isUpdating || priceLoading);
  const showBreakdown = Boolean(selectedSize && (priceDetails?.priceBreakdown || priceDetails?.calculatedPrice > 0));
  const galleryMedia = galleryViewIndexes.map((viewIndex, index) => {
    const view = views[viewIndex];
    return {
      type: "image",
      src: view.previewImage,
      thumbSrc: view.previewImage,
      alt: `${designTitle} – ${view.code || `view ${index + 1}`}`,
    };
  });
  const detailRows = [
    { label: "Product", value: design.productName },
    { label: "Colour", value: design.productColorName || design.productColor },
    { label: "Design type", value: design.kind ? String(design.kind).toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "" },
    { label: "Views", value: stats.totalViews ? `${stats.totalViews} (${views.map((v) => v.code).filter(Boolean).join(", ").toUpperCase()})` : "" },
  ].filter((row) => row.value);
  const openSizeGuide = () => {
    const guide = document.getElementById("size-guide");
    if (guide) guide.open = true;
  };

  return (
    <ProductPage>
      <ProductToast
        show={notification.show}
        type={notification.type === "warning" ? "info" : notification.type}
        message={notification.message}
        showCartLink={notification.type === "success"}
      />

      <ProductTopBar
        onBack={() => navigate(-1)}
        backLabel="catalogue"
        onShare={copyToClipboard}
        copied={copied}
        favorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
      />

      <ProductLayout
        gallery={
          <ProductGallery
            media={galleryMedia}
            index={currentGalleryIndex}
            onIndexChange={(nextGalleryIndex) => {
              const nextViewIndex = galleryViewIndexes[nextGalleryIndex];
              if (typeof nextViewIndex === "number") setActiveView(nextViewIndex);
            }}
            onOpenViewer={() => setIsImageViewerOpen(true)}
            badges={
              isInCart ? (
                <span className="rounded-mt-btn bg-white px-2.5 py-1 text-xs font-medium text-black">
                  In cart · {quantity}
                </span>
              ) : null
            }
          />
        }
      >
        <ProductHeading eyebrow={design.productName || "Custom design"} title={designTitle} />

        <PriceBlock
          price={money(currentPrice)}
          compareAt={hasPriceDiscount ? money(design.product.basePrice) : null}
          note={selectedSize ? `Inclusive of all taxes · size ${selectedSize}` : "Inclusive of all taxes · price shown for the base size"}
        >
          {selectedSize && priceLoading && <p className="mt-2 text-xs text-mt-muted">Updating price…</p>}
          {isLocalPrice && <p className="mt-2 text-xs text-mt-warning">Estimated price — live pricing is temporarily unavailable.</p>}
          {showBreakdown && !priceLoading && (
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 rounded-mt-card border border-mt-line p-3 text-xs">
              <dt className="text-mt-subtle">Base price</dt>
              <dd className="text-right text-mt-text">{money(priceDetails.basePrice || design.salePrice || 0)}</dd>
              {priceDetails.additionalCharges > 0 && (
                <>
                  <dt className="text-mt-subtle">Printing</dt>
                  <dd className="text-right text-mt-text">+{money(priceDetails.additionalCharges)}</dd>
                </>
              )}
              <dt className="border-t border-mt-line pt-1 text-mt-text">Total{!isLocalPrice && priceDetails?.size === selectedSize ? <span className="ml-2 text-mt-success">· live price</span> : null}</dt>
              <dd className="border-t border-mt-line pt-1 text-right font-medium text-mt-text">{money(currentPrice)}</dd>
            </dl>
          )}
        </PriceBlock>

        {design.productColor && (
          <DetailSection>
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-full border border-mt-tint/25" style={{ backgroundColor: design.productColor }} aria-hidden="true" />
              <span className="text-sm text-mt-muted">
                Garment colour: <span className="text-mt-text">{design.productColorName || design.productColor}</span>
              </span>
            </div>
          </DetailSection>
        )}

        <DetailSection>
          <SizePicker
            id="catalogue-mobile-size-selection"
            sizes={SIZES.map((size) => ({ value: size }))}
            selected={selectedSize}
            onSelect={handleSizeSelect}
            locked={priceLoading}
            hint={!selectedSize ? "Select a size to continue" : null}
            sizeGuideHref={sizeChartUrl ? "#size-guide" : null}
            onSizeGuide={openSizeGuide}
          />
        </DetailSection>

        <DetailSection className="space-y-3">
          <div className="flex gap-3">
            {isInCart && (
              <QuantityStepper
                value={quantity}
                onDecrease={handleDecrement}
                onIncrease={handleIncrement}
                decreaseDisabled={busy}
                increaseDisabled={busy}
              />
            )}
            <PrimaryPurchaseButton
              onClick={isInCart ? () => navigate("/cart") : handleAddToCart}
              disabled={busy || !selectedSize}
              busy={busy}
              done={isInCart}
              className="flex-1"
            >
              {busy ? "Updating…" : isInCart ? "View cart" : "Add to cart"}
            </PrimaryPurchaseButton>
          </div>
          <SecondaryPurchaseButton onClick={handleBuyNow} disabled={busy || !selectedSize} icon={CreditCard}>
            Buy now
          </SecondaryPurchaseButton>
          {isInCart && (
            <p className="text-center text-xs text-mt-muted">
              {quantity} in your cart · size {selectedSize} · {money(cartTotal)}
            </p>
          )}
        </DetailSection>

        <TrustRow />

        <InfoSections>
          <InfoSection title="Description" defaultOpen>
            <ExpandableDescription
              description={design.description || `Custom design for ${design.productName}`}
              html
              limit={260}
              className="text-sm leading-relaxed text-mt-muted [&_p]:mb-3 [&_strong]:font-medium [&_strong]:text-mt-text [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
            />
          </InfoSection>
          {detailRows.length > 0 && (
            <InfoSection title="Product details">
              <DetailList rows={detailRows} />
            </InfoSection>
          )}
          {sizeChartUrl && (
            <InfoSection id="size-guide" title="Size guide">
              <button
                type="button"
                onClick={() => window.open(sizeChartUrl, "_blank", "noopener,noreferrer")}
                className="block w-full cursor-zoom-in overflow-hidden rounded-mt-btn bg-white"
                aria-label="Open size chart in a new tab"
              >
                <img
                  src={sizeChartUrl}
                  srcSet={sizeChartImageProps.srcSet}
                  sizes={sizeChartImageProps.sizes}
                  alt={`${design.productName || designTitle} size chart`}
                  className="w-full"
                  loading="lazy"
                  decoding={sizeChartImageProps.decoding}
                />
              </button>
            </InfoSection>
          )}
        </InfoSections>
      </ProductLayout>

      <MobilePurchaseBar
        price={money(currentPrice)}
        compareAt={hasPriceDiscount ? money(design.product.basePrice) : null}
        caption={!selectedSize ? "Select a size" : isInCart ? `${quantity} in cart · size ${selectedSize}` : `Size ${selectedSize}`}
      >
        <PrimaryPurchaseButton
          onClick={isInCart ? () => navigate("/cart") : handleAddToCart}
          disabled={busy || !selectedSize}
          busy={busy}
          done={isInCart}
          className="min-w-[150px]"
        >
          {busy ? "Updating…" : isInCart ? "View cart" : "Add to cart"}
        </PrimaryPurchaseButton>
      </MobilePurchaseBar>

      <ProductImageLightbox
        isOpen={isImageViewerOpen}
        items={galleryItems}
        initialIndex={currentGalleryIndex}
        title={design.title || design.productName || "Design gallery"}
        onClose={() => setIsImageViewerOpen(false)}
        onIndexChange={(nextGalleryIndex) => {
          const nextViewIndex = galleryViewIndexes[nextGalleryIndex];
          if (typeof nextViewIndex === "number") {
            setActiveView(nextViewIndex);
          }
        }}
      />
    </ProductPage>
  );
}
