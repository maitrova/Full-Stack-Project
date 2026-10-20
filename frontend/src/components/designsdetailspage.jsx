// src/pages/Designdetailspage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CreditCard, Edit, Trash2 } from "lucide-react";

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
  clearSuccess,
  getCart
} from "../redux/slices/Cartslice.js";

// Import user selector for login check
import { selectCurrentToken } from "../redux/slices/Userslice.js";
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
  ProductNotFound,
  ProductPage,
  ProductPageSkeleton,
  ProductToast,
  ProductTopBar,
  QuantityStepper,
  SecondaryPurchaseButton,
  SizePicker,
  TrustRow,
} from "./product/ProductPageParts.jsx";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

export default function Designdetailspage() {
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
  const [activeTab, setActiveTab] = useState("overview");
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    imageUrl: "",
    altText: "",
    title: ""
  });
  const [deleting, setDeleting] = useState(false);

  // Redux selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);
  useEffect(() => {
  setLocalCartQuantity(0);
  setSelectedSize("");
}, [id]);

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/savedata/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load design");
        setDesign(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchDesign();
    }
  }, [id, token]);

  // Get cart quantity for this design
  const getCartQuantity = () => {
    // First check local state (for optimistic updates)
    if (localCartQuantity !== 0) {
      return localCartQuantity;
    }
    
    // Then check Redux store
    const item = cartItems.find(item => 
      item.kind === "DESIGN" && 
      item.design?._id === id
    );
    return item ? item.qty : 0;
  };

  const quantity = getCartQuantity();
  const isInCart = quantity > 0;
  const isUpdating = cartLoading && localCartQuantity !== 0;

  // Handle notifications
  useEffect(() => {
    if (cartSuccess) {
      setNotification({
        show: true,
        message: 'Design added to cart successfully!',
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
  }, [cartSuccess, cartError, dispatch]);

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
    if (!selectedSize) {
  setNotification({
    show: true,
    message: "Please select a size before adding to cart",
    type: "warning",
  });
  return;
}

    if (!design) return;

    try {
      // Optimistic update
      setLocalCartQuantity(1);

      const cartData = {
  kind: "DESIGN",
  qty: 1,
  size: selectedSize, // ✅ ADD THIS
  designId: design._id,
  productId: design.product?._id || design.productId,
  title: design.productName || "Custom Design",
  unitPrice: design.salePrice || design.product?.basePrice || 0,
  basePrice: design.product?.basePrice || design.salePrice || 0,
  previewImage: design.previewImage || design.views?.[0]?.previewImage || null,
  views: design.views || [],
  productColor: design.productColor
};


      await dispatch(addToCart(cartData)).unwrap();
      
      // Refresh cart to get updated data
      await dispatch(getCart());
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      // Revert optimistic update on error
      setLocalCartQuantity(0);

      if (error.status === 401 && token) {
        setNotification({
          show: true,
          message: 'Session expired. Please login again.',
          type: 'error'
        });
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    }
  };

  // Handle increment quantity
  const handleIncrement = async () => {
    if (!design) return;

    const currentQty = quantity;
    const cartItem = cartItems.find(item => 
      item.kind === "DESIGN" && item.design?._id === design._id
    );
    
    if (!cartItem) {
      handleAddToCart();
      return;
    }

    try {
      // Optimistic update
      setLocalCartQuantity(currentQty + 1);

      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty + 1
      })).unwrap();
      
      // Clear local state after successful update
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
      item.kind === "DESIGN" && item.design?._id === design._id
    );
    
    if (!cartItem || currentQty <= 1) {
      handleRemoveFromCart();
      return;
    }

    try {
      // Optimistic update
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
      item.kind === "DESIGN" && item.design?._id === design._id
    );
    if (!cartItem) return;

    try {
      // Optimistic update
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
    if (!selectedSize) {
  setNotification({
    show: true,
    message: "Please select a size before proceeding",
    type: "warning",
  });
  return;
}

    if (isInCart) {
      navigate('/cart');
    } else {
      await handleAddToCart();
      setTimeout(() => navigate('/cart'), 500);
    }
  };

  // Handle edit design
  const handleEditDesign = () => {
    if (!design) return;
    navigate(`/products/${design.productSlug}/customize?edit=${design._id}`);
  };

  // Handle delete design
  const handleDeleteDesign = async () => {
    if (!window.confirm(`Are you sure you want to delete "${design?.productName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`${API_URL}/savedata/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete design");
      }

      setNotification({
        show: true,
        message: 'Design deleted successfully!',
        type: 'success'
      });

      setTimeout(() => {
        navigate('/admin/designs');
      }, 1500);
    } catch (err) {
      console.error("Delete design error:", err);
      setNotification({
        show: true,
        message: err.message || 'Failed to delete design',
        type: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  // Image modal handlers
  const openImageModal = (imageUrl, altText = "", title = "") => {
    setImageModal({
      isOpen: true,
      imageUrl,
      altText,
      title
    });
  };

  const closeImageModal = () => {
    setImageModal({
      isOpen: false,
      imageUrl: "",
      altText: "",
      title: ""
    });
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && imageModal.isOpen) {
        closeImageModal();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [imageModal.isOpen]);

  // Reset cart state on unmount
  useEffect(() => {
    return () => {
      dispatch(resetCartState());
    };
  }, [dispatch]);

  // Reset local cart quantity when design changes
  useEffect(() => {
    setLocalCartQuantity(0);
  }, [id]);

  if (loading) return <ProductPageSkeleton label="Loading design details…" />;

  if (error) return (
    <ProductNotFound
      title="Design not found"
      message={error}
      onBack={() => navigate(-1)}
      browseLabel="Browse designs"
      onBrowse={() => navigate("/admin/designs")}
    />
  );

  if (!design) return null;

  const views = design.views || [];
  const stats = {
    totalTextLayers: views.reduce((acc, view) => acc + (view.textLayers?.length || 0), 0),
    totalImageLayers: views.reduce((acc, view) => acc + (view.designLayers?.length || 0), 0),
    totalViews: views.length
  };

  const formatDateTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const money = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const designTitle = design.productName || design.title || "Custom design";
  const unitPrice = Number(design.salePrice || design.product?.basePrice || 0);
  const basePrice = Number(design.product?.basePrice || 0);
  const hasDiscount = basePrice > unitPrice && unitPrice > 0;
  const viewIndexes = views.reduce((acc, view, index) => {
    if (view?.previewImage) acc.push(index);
    return acc;
  }, []);
  const galleryMedia = viewIndexes.map((viewIndex) => {
    const view = views[viewIndex];
    return {
      type: "image",
      src: view.previewImage,
      thumbSrc: view.previewImage,
      alt: `${designTitle} – ${view.code || "view"}`,
    };
  });
  const currentGalleryIndex = Math.max(0, viewIndexes.indexOf(activeView));
  const currentView = views[viewIndexes[currentGalleryIndex]];
  const detailRows = [
    { label: "Product", value: design.productName },
    { label: "Colour", value: design.productColorName || design.productColor },
    { label: "Views", value: stats.totalViews ? `${stats.totalViews} (${views.map((v) => v.code).filter(Boolean).join(", ").toUpperCase()})` : "" },
    { label: "Text layers", value: String(stats.totalTextLayers) },
    { label: "Image layers", value: String(stats.totalImageLayers) },
    { label: "Created", value: formatDateTime(design.createdAt) },
    { label: "Updated", value: formatDateTime(design.updatedAt) },
    { label: "Design ID", value: design._id ? design._id.slice(-12) : "" },
  ].filter((row) => row.value && row.value !== "-");

  return (
    <ProductPage>
      <ProductToast
        show={notification.show}
        type={notification.type === "warning" ? "info" : notification.type}
        message={notification.message}
        showCartLink={notification.type === "success" && !deleting}
      />

      <ProductTopBar
        onBack={() => navigate(-1)}
        backLabel="designs"
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
            onIndexChange={(nextIndex) => {
              const nextViewIndex = viewIndexes[nextIndex];
              if (typeof nextViewIndex === "number") setActiveView(nextViewIndex);
            }}
            onOpenViewer={() =>
              currentView?.previewImage &&
              openImageModal(currentView.previewImage, `${designTitle} – ${currentView.code || "view"}`, (currentView.code || "Preview").toUpperCase())
            }
            badges={
              isInCart ? (
                <span className="rounded-mt-btn bg-white px-2.5 py-1 text-xs font-medium text-black">In cart · {quantity}</span>
              ) : null
            }
          />
        }
      >
        <ProductHeading eyebrow="Custom design" title={designTitle} />

        <PriceBlock
          price={money(unitPrice)}
          compareAt={hasDiscount ? money(basePrice) : null}
          saving={hasDiscount ? `Save ${money(basePrice - unitPrice)}` : null}
        />

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
            id="design-size-selection"
            sizes={SIZES.map((size) => ({ value: size }))}
            selected={selectedSize}
            onSelect={setSelectedSize}
            hint={!selectedSize ? "Select a size to continue" : null}
          />
        </DetailSection>

        <DetailSection className="space-y-3">
          <div className="flex gap-3">
            {isInCart && (
              <QuantityStepper
                value={quantity}
                onDecrease={handleDecrement}
                onIncrease={handleIncrement}
                decreaseDisabled={isUpdating}
                increaseDisabled={isUpdating}
              />
            )}
            <PrimaryPurchaseButton
              onClick={isInCart ? () => navigate("/cart") : handleAddToCart}
              disabled={isUpdating || (!isInCart && !selectedSize)}
              busy={isUpdating}
              done={isInCart}
              className="flex-1"
            >
              {isUpdating ? "Updating…" : isInCart ? "View cart" : "Add to cart"}
            </PrimaryPurchaseButton>
          </div>
          <SecondaryPurchaseButton onClick={handleBuyNow} disabled={isUpdating || !selectedSize} icon={CreditCard}>
            Buy now
          </SecondaryPurchaseButton>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleEditDesign}
              className="inline-flex h-10 items-center gap-2 text-sm text-mt-muted transition-colors hover:text-mt-text"
            >
              <Edit className="h-4 w-4" aria-hidden="true" />
              Edit design
            </button>
            <button
              type="button"
              onClick={handleDeleteDesign}
              disabled={deleting}
              className="inline-flex h-10 items-center gap-2 text-sm text-mt-danger transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </DetailSection>

        <TrustRow />

        <InfoSections>
          <InfoSection title="Design details" defaultOpen>
            <DetailList rows={detailRows} />
          </InfoSection>
        </InfoSections>
      </ProductLayout>

      <MobilePurchaseBar
        price={money(unitPrice)}
        compareAt={hasDiscount ? money(basePrice) : null}
        caption={!selectedSize ? "Select a size" : isInCart ? `${quantity} in cart · size ${selectedSize}` : `Size ${selectedSize}`}
      >
        <PrimaryPurchaseButton
          onClick={isInCart ? () => navigate("/cart") : handleAddToCart}
          disabled={isUpdating || (!isInCart && !selectedSize)}
          busy={isUpdating}
          done={isInCart}
          className="min-w-[150px]"
        >
          {isUpdating ? "Updating…" : isInCart ? "View cart" : "Add to cart"}
        </PrimaryPurchaseButton>
      </MobilePurchaseBar>

      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 font-brand backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={imageModal.title || "Image preview"}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeImageModal();
          }}
        >
          <div className="relative flex max-h-full w-full max-w-4xl flex-col">
            <div className="mb-3 flex items-center justify-between text-white">
              <p className="text-sm">{imageModal.title}</p>
              <button
                type="button"
                onClick={closeImageModal}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-mt-tint/10 transition-colors hover:bg-mt-tint/20"
              >
                ×
              </button>
            </div>
            <img src={imageModal.imageUrl} alt={imageModal.altText} className="max-h-[80vh] w-full rounded-mt-card bg-mt-photo object-contain" />
            {imageModal.altText && <p className="mt-3 text-center text-xs text-white/60">{imageModal.altText}</p>}
          </div>
        </div>
      )}
    </ProductPage>
  );
}
