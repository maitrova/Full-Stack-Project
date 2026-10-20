// src/pages/ProductDetailPage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getProductById as fetchReadymadeProductById, getProductByPath as fetchReadymadeProductByPath } from '../redux/slices/productList.js';
import DOMPurify from "dompurify";
import { 
  addToCart, 
  getCart,
  selectCartItems, 
  selectCartLoading,
  selectCartSuccess,
  selectCartError,
  clearError,
  clearSuccess,
} from '../redux/slices/Cartslice.js';
import { selectCurrentToken } from '../redux/slices/Userslice.js';
import { buildImageUrl, getRawImagePath, getResponsiveImageProps } from "../utils/responsiveImage.js";
import { buildProductsListingPath, buildReadymadeProductPath } from "../utils/readymadeRoutes.js";
import { trackViewItem } from "../utils/analytics.js";
import ProductImageLightbox from "./ProductImageLightbox.jsx";
import ProductReviews from "./ProductReviews.jsx";
import ExpandableDescription from "./ExpandableDescription.jsx";

// Lucide React icons
import { 
  ArrowLeft, 
  ShoppingCart, 
  Download, 
  Share2, 
  Heart, 
  Palette,
  Type,
  Image as ImageIcon,
  Check,
  Copy,
  Eye,
  Tag,
  Sparkles,
  Package,
  ChevronRight,
  Star,
  Truck,
  Shield,
  RefreshCw,
  MessageCircle,
  Phone,
  ArrowUpRight,
  Layers,
  CreditCard,
  X,
  AlertCircle,
  Info,
  Ruler
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";
const IMAGE_URL = import.meta.env.VITE_IMAGE_URL;

const getSiteUrl = () => {
  const configured =
    (import.meta.env.VITE_SITE_URL || "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "https://maitrova.in");
  return configured.replace(/\/+$/, "");
};

const setMetaTag = (name, content) => {
  if (typeof document === "undefined" || !content) return;
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const stripHtml = (value = "") => {
  if (typeof document === "undefined") {
    return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = DOMPurify.sanitize(value || "");
  return (container.textContent || container.innerText || "").replace(/\s+/g, " ").trim();
};

export default function ProductDetailPage() {
  const { id, type = 'product', categoryName, subCategoryName, productSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [selectedVariant, setSelectedVariant] = useState(null);

  // State
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [activeView, setActiveView] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('specifications');
  const [sizeError, setSizeError] = useState('');
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [comboOffers, setComboOffers] = useState([]);
  const [comboOffersLoading, setComboOffersLoading] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isMobileDescriptionExpanded, setIsMobileDescriptionExpanded] = useState(false);
  const viewTrackedRef = useRef('');

  // Redux state
  const token = useSelector(selectCurrentToken);
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartSuccess = useSelector(selectCartSuccess);
  const cartError = useSelector(selectCartError);
  
  const { currentProduct: product } = useSelector((state) => state.productList);
  const isReadymade = type === 'product';
  const categoryListingPath = isReadymade
    ? buildProductsListingPath(itemData?.category)
    : '/catalogue';
  const subCategoryListingPath = isReadymade
    ? buildProductsListingPath(itemData?.category, itemData?.subCategory)
    : '/catalogue';
  const returnTo = typeof location.state?.returnTo === "string" ? location.state.returnTo : "";
  const returnLabel = typeof location.state?.returnLabel === "string" ? location.state.returnLabel : "";
  
  const hasVariants = isReadymade &&
    Array.isArray(itemData?.variants) &&
    itemData.variants.length > 0;

  const trackMetaAddToCart = ({
    productId,
    productName,
    quantity: trackedQuantity,
    unitPrice,
    currency = 'INR',
  }) => {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
      return;
    }

    const normalizedQuantity = Number(trackedQuantity || 1);
    const normalizedUnitPrice = Number(unitPrice || 0);
    const normalizedProductId = productId ? String(productId) : '';

    window.fbq('track', 'AddToCart', {
      content_ids: normalizedProductId ? [normalizedProductId] : [],
      content_name: productName || 'Readymade Product',
      content_type: 'product',
      contents: normalizedProductId
        ? [{ id: normalizedProductId, quantity: normalizedQuantity, item_price: normalizedUnitPrice }]
        : [],
      currency,
      value: normalizedUnitPrice * normalizedQuantity,
    });
  };

  const getVariantBySize = (size) => {
    if (!itemData?.variants || !size) return null;
    return itemData.variants.find(
      (v) => String(v.size).toUpperCase() === String(size).toUpperCase()
    ) || null;
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        if (isReadymade) {
          if (categoryName && subCategoryName && productSlug) {
            await dispatch(
              fetchReadymadeProductByPath({
                category: categoryName,
                subCategory: subCategoryName,
                productSlug,
              })
            ).unwrap();
          } else {
            await dispatch(fetchReadymadeProductById(id)).unwrap();
          }
        } else {
          const res = await fetch(`${API_URL}/savedata/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          
          if (!res.ok) {
            throw new Error(data.error || 'Failed to load design');
          }
          
          setItemData(data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load item');
      } finally {
        setLoading(false);
      }
    };

    if (id || (categoryName && subCategoryName && productSlug)) {
      fetchData();
    }
  }, [id, type, dispatch, token, isReadymade, categoryName, subCategoryName, productSlug]);

  // Set item data for readymade products
  useEffect(() => {
    if (isReadymade && product) {
      setItemData(product);
      setSelectedImageIndex(0);
      setQuantity(1);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedVariant(null);
      setSizeError('');
    }
  }, [product, isReadymade]);

  const handleBackNavigation = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (!isReadymade) {
      navigate('/catalogue');
      return;
    }

    navigate(subCategoryListingPath || categoryListingPath || '/products');
  };

  useEffect(() => {
    if (!isReadymade || !itemData?._id) {
      setRelatedProducts([]);
      setRelatedLoading(false);
      return;
    }

    const controller = new AbortController();

    const normalizeMatchValue = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const loadPublicProducts = async (params) => {
      const query = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          query.append(key, value);
        }
      });

      const response = await fetch(`${API_URL}/readymadeproducts/public?${query.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load related products');
      }

      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.products)) return data.products;
      return [];
    };

    const fetchRelatedProducts = async () => {
      setRelatedLoading(true);

      try {
        const currentId = String(itemData._id);
        const currentCategory = normalizeMatchValue(itemData.category);
        const currentSubCategory = normalizeMatchValue(itemData.subCategory);
        const currentPrice = Number(itemData.effectivePrice ?? itemData.price ?? 0);

        const publicProducts = await loadPublicProducts({ limit: 48 });
        const rankedProducts = publicProducts
          .filter((relatedItem) => String(relatedItem._id) !== currentId)
          .map((relatedItem) => {
            const relatedCategory = normalizeMatchValue(relatedItem.category);
            const relatedSubCategory = normalizeMatchValue(relatedItem.subCategory);
            const relatedPrice = Number(
              relatedItem.effectivePrice ?? relatedItem.price ?? 0
            );

            let score = 0;

            if (currentCategory && relatedCategory === currentCategory) {
              score += 3;
            }

            if (currentSubCategory && relatedSubCategory === currentSubCategory) {
              score += 5;
            }

            if (currentPrice > 0 && relatedPrice > 0) {
              const priceGap = Math.abs(relatedPrice - currentPrice) / currentPrice;

              if (priceGap <= 0.15) score += 2;
              else if (priceGap <= 0.3) score += 1;
            }

            if (relatedItem.bestSeller) score += 1;
            if (relatedItem.newArrival) score += 1;

            return { ...relatedItem, _relatedScore: score };
          })
          .sort((a, b) => {
            if (b._relatedScore !== a._relatedScore) {
              return b._relatedScore - a._relatedScore;
            }

            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          })
          .slice(0, 4);

        setRelatedProducts(rankedProducts);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load related products:', err);
          setRelatedProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRelatedLoading(false);
        }
      }
    };

    fetchRelatedProducts();

    return () => {
      controller.abort();
    };
  }, [isReadymade, itemData?._id, itemData?.category, itemData?.subCategory]);

  useEffect(() => {
    if (!isReadymade || !itemData?._id) {
      setComboOffers([]);
      setComboOffersLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadComboOffers = async () => {
      setComboOffersLoading(true);
      try {
        const response = await fetch(`${API_URL}/combo-packs/product/${itemData._id}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load combo offers");
        }
        setComboOffers(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load combo offers:", err);
          setComboOffers([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setComboOffersLoading(false);
        }
      }
    };

    loadComboOffers();

    return () => controller.abort();
  }, [isReadymade, itemData?._id]);

  useEffect(() => {
    setIsMobileDescriptionExpanded(false);
  }, [itemData?._id]);

  // Handle notifications
  useEffect(() => {
    if (cartSuccess) {
      setNotification({
        show: true,
        message: 'Item added to cart successfully!',
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

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const updateCartItemDetails = () => {
    if (!itemData || !cartItems.length) return null;

    if (isReadymade) {
      const cartItem = cartItems.find(item => 
        item.kind === "READYMADE" && 
        item.readymadeProduct?._id === itemData._id
      );
      return cartItem ? {
        isInCart: true,
        quantity: cartItem.qty,
        total: cartItem.unitPrice * cartItem.qty
      } : null;
    } else {
      const cartItem = cartItems.find(item => 
        item.kind === "DESIGN" && 
        item.design?._id === itemData._id
      );
      return cartItem ? {
        isInCart: true,
        quantity: cartItem.qty,
        total: cartItem.unitPrice * cartItem.qty
      } : null;
    }
  };

  const cartItemDetails = updateCartItemDetails();
  const isInCart = cartItemDetails?.isInCart || false;
  const cartQuantity = cartItemDetails?.quantity || 0;
  const totalInCart = cartItemDetails?.total || 0;

  const handleAddToCart = async () => {
    if (!itemData) {
      setNotification({
        show: true,
        message: 'Item data not available',
        type: 'error'
      });
      return;
    }

    if (isReadymade) {
      if (hasVariants && !selectedSize) {
        setSizeError('Please select a size');
        setNotification({
          show: true,
          message: 'Please select a size',
          type: 'error',
        });
        
        // Scroll to size selection on mobile
        if (window.innerWidth < 768) {
          const sizeSection = document.getElementById('mobile-size-selection');
          if (sizeSection) {
            sizeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return;
      }

      const activeVariant = hasVariants ? getVariantBySize(selectedSize) : null;

      if (hasVariants && !activeVariant) {
        setNotification({
          show: true,
          message: 'Selected size is not available',
          type: 'error',
        });
        return;
      }

      const maxStock = hasVariants ? Number(activeVariant.stock || 0) : Number(itemData.stock || 0);

      if (maxStock <= 0) {
        setNotification({
          show: true,
          message: 'This size is out of stock',
          type: 'error',
        });
        return;
      }

      if (quantity > maxStock) {
        setNotification({
          show: true,
          message: `Only ${maxStock} items available in stock`,
          type: 'error',
        });
        return;
      }

      if (!itemData.isActive || itemData.stock === 0) {
        setNotification({
          show: true,
          message: 'This product is currently unavailable',
          type: 'error'
        });
        return;
      }
      
      if (itemData.colors && itemData.colors.length > 0 && !selectedColor) {
        setNotification({
          show: true,
          message: 'Please select a color',
          type: 'error'
        });
        return;
      }
    }

    try {
      setIsAddingToCart(true);
      setSizeError('');
      
      let cartData;
      if (isReadymade) {
        cartData = {
          kind: "READYMADE",
          qty: quantity,
          readymadeProductId: itemData._id,
          size: hasVariants ? selectedSize : undefined, 
        };
      } else {
        cartData = {
          kind: "DESIGN",
          qty: 1,
          designId: itemData._id
        };
      }

      console.log('Adding to cart:', cartData);
      await dispatch(addToCart(cartData)).unwrap();
      trackMetaAddToCart({
        productId: itemData?._id,
        productName: itemData?.title || itemData?.name,
        quantity: isReadymade ? quantity : 1,
        unitPrice: displayData?.price,
        currency: displayData?.currency || 'INR',
      });
      await dispatch(getCart());
      
    } catch (error) {
      console.error('Add to cart failed:', error);
      
      if (error.status === 401 && token) {
        setNotification({
          show: true,
          message: 'Session expired. Please login again.',
          type: 'error'
        });
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setNotification({
          show: true,
          message: error.message || 'Failed to add to cart',
          type: 'error'
        });
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (hasVariants && !selectedSize) {
      setSizeError('Please select a size');
      setNotification({
        show: true,
        message: 'Please select a size',
        type: 'error'
      });
      
      // Scroll to size selection on mobile
      if (window.innerWidth < 768) {
        const sizeSection = document.getElementById('mobile-size-selection');
        if (sizeSection) {
          sizeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }
    
    await handleAddToCart();
    if (itemData) {
      navigate('/cart');
    }
  };

  const handleQuantityChange = (change) => {
    if (!isReadymade) return;

    if (hasVariants && !selectedVariant) {
      setSizeError('Please select a size first');
      setNotification({
        show: true,
        message: 'Please select a size first',
        type: 'warning',
      });
      return;
    }

    const maxStock = hasVariants
      ? Number(selectedVariant?.stock || 0)
      : Number(itemData?.stock || 0);

    const newQuantity = quantity + change;

    if (newQuantity < 1) return;
    if (newQuantity > maxStock) {
      setNotification({
        show: true,
        message: `Only ${maxStock} items available in stock`,
        type: 'warning',
      });
      return;
    }

    setQuantity(newQuantity);
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    setSizeError('');
    const v = getVariantBySize(size);
    setSelectedVariant(v);
    setQuantity(1);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
  };

  const getVideoUrl = (videoPath) => {
    if (!videoPath) return '';

    if (videoPath.startsWith('http')) {
      return videoPath;
    } else if (videoPath.startsWith('/')) {
      return `${IMAGE_URL}${videoPath}`;
    } else {
      return `${IMAGE_URL}/${videoPath}`;
    }
  };
  
  const formatPrice = (price, currency = 'INR') =>
    new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency === 'INR' ? 'INR' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(price) || 0);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDisplayData = () => {
    if (!itemData) return null;

    if (isReadymade) {
      const activeVariant = selectedVariant || null;

      const resolvedPrice =
        activeVariant?.effectivePrice !== undefined && activeVariant?.effectivePrice !== null
          ? Number(activeVariant.effectivePrice)
          : Number((itemData.effectivePrice ?? itemData.price) || 0);
      const resolvedOriginalPrice =
        activeVariant?.mrp !== undefined && activeVariant?.mrp !== null
          ? Number(activeVariant.mrp)
          : Number((itemData.mrp ?? itemData.price) || 0);

      const resolvedStock =
        activeVariant?.stock !== undefined && activeVariant?.stock !== null
          ? Number(activeVariant.stock)
          : Number(itemData.stock || 0);

      return {
        title: itemData.title,
        description: itemData.description,
        price: resolvedPrice,
        originalPrice: resolvedOriginalPrice,
        saleActive: Boolean(activeVariant?.saleActive ?? itemData.saleActive),
        saveAmount: Number(activeVariant?.saveAmount ?? itemData.saveAmount ?? 0),
        discountPercent: Number(activeVariant?.discountPercent ?? itemData.discountPercent ?? 0),
        currency: itemData.currency || 'INR',
        images: Array.isArray(itemData.images) ? itemData.images : [],
        stock: resolvedStock,
        isActive: itemData.isActive,
        category: itemData.category,
        material: itemData.material,
        weight: itemData.weight,
        dimensions: itemData.dimensions,
        rating: Number(itemData.rating || 0),
        reviewCount: Number(itemData.reviewCount || 0),
        ratingBreakdown: itemData.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        sku: activeVariant?.sku || itemData.sku || 'N/A',
        specifications: itemData.specifications,
        manufacturer: itemData.manufacturer,
        warranty: itemData.warranty,
        careInstructions: itemData.careInstructions,
        isOutOfStock: !itemData.isActive || resolvedStock === 0,
        type: 'product',
        activeVariant,
      };
    } else {
      const views = itemData.views || [];
      const currentView = views[activeView] || {};
      
      return {
        title: itemData.title || itemData.productName,
        description: `Custom design for ${itemData.productName}`,
        price: itemData.salePrice || itemData.calculatedPrice || itemData.basePrice || 0,
        originalPrice: itemData.product?.basePrice,
        currency: 'INR',
        images: views.map(v => v.previewImage).filter(Boolean),
        stock: 1,
        isActive: true,
        category: 'Custom Design',
        material: 'Digital Design',
        productColor: itemData.productColor,
        rating: 5,
        reviewCount: 0,
        sku: itemData._id?.slice(-8) || 'N/A',
        views: views,
        currentView: currentView,
        stats: {
          totalTextLayers: views.reduce((acc, view) => acc + (view.textLayers?.length || 0), 0),
          totalImageLayers: views.reduce((acc, view) => acc + (view.designLayers?.length || 0), 0),
          totalViews: views.length
        },
        type: 'design'
      };
    }
  };

  const displayData = getDisplayData();
  const isOutOfStock = displayData?.isOutOfStock || false;
  const images = displayData?.images || [];
  const offerTagDiscount =
    displayData?.saleActive &&
    displayData?.originalPrice &&
    displayData?.price < displayData?.originalPrice
      ? Number(displayData.discountPercent || 0)
      : 0;

  const media = [
    ...images
      .map((img) => {
        const imagePath = getRawImagePath(img);
        if (!imagePath) return null;

        return {
          type: "image",
          image: imagePath,
          alt:
            (typeof img === "object" ? img.altText : "") ||
            displayData?.title ||
            "Product image",
        };
      })
      .filter(Boolean),
    ...(itemData?.video
      ? [{
          type: "video",
          url: getVideoUrl(itemData.video),
        }]
      : []),
  ];
  const imageMediaIndexes = media.reduce((acc, item, index) => {
    if (item?.type === "image") {
      acc.push(index);
    }
    return acc;
  }, []);
  const galleryItems = imageMediaIndexes.map((mediaIndex, index) => {
    const item = media[mediaIndex];
    const imageProps = getResponsiveImageProps(item?.image, {
      sizes: "(max-width: 768px) 100vw, 1200px",
      loading: index === 0 ? "eager" : "lazy",
    });

    return {
      src: imageProps.src || buildImageUrl(item?.image),
      thumbSrc: buildImageUrl(item?.image),
      alt: item?.alt || `${displayData?.title || "Product"} - ${index + 1}`,
      label: `Image ${index + 1}`,
    };
  });

  const ComboOfferBlock = ({ compact = false } = {}) => {
    if (!isReadymade) return null;

    if (comboOffersLoading) {
      return (
        <div className="rounded-mt-card border border-mt-line p-4">
          <div className="h-3 w-32 animate-pulse rounded bg-mt-surface-raised" />
          <div className="mt-3 h-16 animate-pulse rounded bg-mt-surface-raised" />
        </div>
      );
    }

    if (!comboOffers.length) return null;

    return (
      <div className="rounded-mt-card border border-mt-line bg-mt-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-mt-text" aria-hidden="true" />
          <p className="text-sm text-mt-text">Save more in a combo</p>
        </div>

        <div className="space-y-2">
          {comboOffers.slice(0, compact ? 1 : 2).map((combo) => {
            const imageProps = getResponsiveImageProps(combo.displayImage, {
              sizes: "64px",
            });
            const originalPrice = Number(combo.pricing?.originalPrice || combo.comboPrice || 0);
            const savings = Number(combo.pricing?.savingsAmount || 0);
            const discount = Number(combo.pricing?.discountPercentage || 0);

            return (
              <Link
                key={combo._id}
                to={`/combo-packs/${combo.slug}`}
                className="group flex items-center gap-3 rounded-mt-btn p-2 transition-colors hover:bg-mt-tint/5"
              >
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-mt-btn bg-mt-photo">
                  {combo.displayImage ? (
                    <img
                      src={imageProps.src || buildImageUrl(combo.displayImage)}
                      srcSet={imageProps.srcSet}
                      sizes={imageProps.sizes}
                      alt={combo.name}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="text-mt-subtle" size={18} aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-mt-text">{combo.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-mt-muted">
                    <span className="text-mt-text">
                      {formatPrice(Number(combo.comboPrice || 0), combo.currency || displayData.currency)}
                    </span>
                    {originalPrice > Number(combo.comboPrice || 0) && (
                      <span className="text-mt-subtle line-through">
                        {formatPrice(originalPrice, combo.currency || displayData.currency)}
                      </span>
                    )}
                    {savings > 0 ? (
                      <span className="text-mt-success">Save {formatPrice(savings, combo.currency || displayData.currency)}</span>
                    ) : discount > 0 ? (
                      <span className="text-mt-success">{discount}% off</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-mt-subtle">{combo.includedProductsCount} products included</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-mt-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>
    );
  };
  
  const sizeChartImageProps = getResponsiveImageProps(itemData?.sizeChart, {
    sizes: "100vw",
  });
  const sizeChartUrl = sizeChartImageProps.src;
  const shouldShowRelatedProducts = isReadymade && (relatedLoading || relatedProducts.length > 0);

  const productCanonicalUrl = useMemo(() => {
    if (!isReadymade || !itemData?._id) return "";
    const path = buildReadymadeProductPath(itemData) || (id ? `/readymade/${id}` : "");
    return path ? `${getSiteUrl()}${path}` : "";
  }, [id, isReadymade, itemData]);

  const productPlainDescription = useMemo(
    () => stripHtml(displayData?.description || "").slice(0, 5000),
    [displayData?.description]
  );

  const productSchema = useMemo(() => {
    if (!isReadymade || !itemData?._id || !displayData || !productCanonicalUrl) {
      return null;
    }

    const imageUrls = galleryItems.map((item) => item.src).filter(Boolean);
    const sku =
      displayData.sku && displayData.sku !== "N/A"
        ? displayData.sku
        : String(itemData._id);
    const price = Number(displayData.price || 0);
    const originalPrice = Number(displayData.originalPrice || 0);
    const currency = displayData.currency || "INR";
    const offer = {
      "@type": "Offer",
      url: productCanonicalUrl,
      price: price.toFixed(2),
      priceCurrency: currency,
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      sku,
    };

    if (displayData.saleActive && originalPrice > price) {
      offer.priceSpecification = {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/StrikethroughPrice",
        price: originalPrice.toFixed(2),
        priceCurrency: currency,
      };
    }

    return {
      "@context": "https://schema.org/",
      "@type": "Product",
      "@id": `${productCanonicalUrl}#product`,
      name: displayData.title,
      description: productPlainDescription || displayData.title,
      image: imageUrls,
      sku,
      brand: {
        "@type": "Brand",
        name: itemData.brand || "Maitrova",
      },
      category: [displayData.category, itemData.subCategory].filter(Boolean).join(" > ") || undefined,
      offers: offer,
      aggregateRating:
        displayData.reviewCount > 0 && displayData.rating > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(displayData.rating).toFixed(1),
              reviewCount: displayData.reviewCount,
            }
          : undefined,
    };
  }, [
    displayData,
    galleryItems,
    isOutOfStock,
    isReadymade,
    itemData,
    productCanonicalUrl,
    productPlainDescription,
  ]);

  useEffect(() => {
    if (!isReadymade || !displayData) return;

    document.title = `${displayData.title} | Maitrova`;
    setMetaTag("description", productPlainDescription || `${displayData.title} from Maitrova`);
    setMetaTag("robots", itemData?.isActive === false ? "noindex,follow" : "index,follow");
  }, [displayData, isReadymade, itemData?.isActive, productPlainDescription]);

  useEffect(() => {
    if (!itemData?._id || !displayData) return;

    const viewKey = String(itemData._id);
    if (viewTrackedRef.current === viewKey) return;

    viewTrackedRef.current = viewKey;
    trackViewItem({
      item: {
        ...itemData,
        unitPrice: displayData.price,
        currency: displayData.currency || 'INR',
        size: selectedSize,
      },
      value: displayData.price,
      currency: displayData.currency || 'INR',
    });
  }, [itemData?._id, displayData?.price, displayData?.currency, selectedSize]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]" aria-busy="true">
        <span className="sr-only">Loading {isReadymade ? 'product' : 'design'} details…</span>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-10">
          <div className="lg:col-span-7">
            <div className="aspect-[4/5] w-full animate-pulse rounded-mt-card bg-mt-surface-raised" />
          </div>
          <div className="space-y-4 lg:col-span-5">
            <div className="h-3 w-32 animate-pulse rounded bg-mt-surface-raised" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-mt-surface-raised" />
            <div className="h-6 w-40 animate-pulse rounded bg-mt-surface-raised" />
            <div className="h-px bg-mt-line" />
            <div className="h-12 w-full animate-pulse rounded bg-mt-surface-raised" />
            <div className="h-12 w-full animate-pulse rounded bg-mt-surface-raised" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !displayData) {
    return (
      <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-mt-surface-raised">
            <AlertCircle className="h-6 w-6 text-mt-muted" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-medium text-mt-text">
            {isReadymade ? 'Product' : 'Design'} not found
          </h1>
          <p className="mt-2 text-sm text-mt-muted">{error || 'The requested item is not available.'}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-mt-btn border border-mt-text px-5 text-sm font-medium text-mt-text transition-colors hover:bg-mt-tint/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </button>
            <button
              type="button"
              onClick={() => navigate(isReadymade ? '/products' : '/catalogue')}
              className="inline-flex h-11 items-center justify-center rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text transition-colors hover:bg-mt-btn-hover"
            >
              Browse {isReadymade ? 'products' : 'catalogue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentMedia = media[selectedImageIndex];
  const currentGalleryIndex = Math.max(0, imageMediaIndexes.indexOf(selectedImageIndex));

  const isVideo = currentMedia?.type === "video";
  const currentMediaImageProps = !isVideo
    ? getResponsiveImageProps(currentMedia?.image, {
        sizes: "(max-width: 1024px) 100vw, 58vw",
        loading: selectedImageIndex === 0 ? "eager" : "lazy",
      })
    : null;
  const mediaUrl = isVideo ? currentMedia?.url : currentMediaImageProps?.src;
  const imageAlt = currentMedia?.alt || displayData.title;

  const hasDiscount = Boolean(displayData.originalPrice && displayData.price < displayData.originalPrice);
  const needsSize = isReadymade && hasVariants && !selectedSize;

  const isBusy = isAddingToCart || cartLoading;
  const lowStock = isReadymade && !isOutOfStock && displayData.stock > 0 && displayData.stock < 5;
  const backLabel = returnLabel || (isReadymade ? (itemData?.subCategory || 'products') : 'catalogue');
  const productDetails = [
    { label: 'SKU', value: displayData.sku !== 'N/A' ? displayData.sku : '' },
    { label: 'Category', value: [displayData.category, itemData?.subCategory].filter(Boolean).join(' / ') },
    { label: 'Material', value: displayData.material },
    { label: 'Weight', value: displayData.weight },
    { label: 'Dimensions', value: displayData.dimensions },
    { label: 'Manufacturer', value: displayData.manufacturer },
    { label: 'Warranty', value: displayData.warranty },
  ].filter((row) => row.value && typeof row.value !== 'object');

  const scrollToReviews = () => {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderStars = (size = 'h-4 w-4') => (
    <span className="flex items-center" aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`${size} ${i < Math.round(displayData.rating) ? 'fill-current text-mt-text' : 'text-mt-line-strong'}`}
        />
      ))}
    </span>
  );

  const renderThumb = (item, index, className) => {
    const isActive = selectedImageIndex === index;
    return (
      <button
        key={index}
        type="button"
        onClick={() => setSelectedImageIndex(index)}
        aria-label={item.type === 'video' ? 'Show video' : `Show image ${index + 1}`}
        aria-current={isActive ? 'true' : undefined}
        className={`relative shrink-0 overflow-hidden rounded-mt-btn bg-mt-photo transition-opacity ${className} ${
          isActive ? 'ring-2 ring-mt-text ring-offset-2 ring-offset-mt-bg' : 'opacity-60 hover:opacity-100'
        }`}
      >
        {item.type === 'video' ? (
          <>
            <video src={item.url} className="h-full w-full object-cover" muted />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs text-white">▶</span>
          </>
        ) : (
          (() => {
            const thumbProps = getResponsiveImageProps(item.image, { sizes: '80px' });
            return (
              <img
                src={thumbProps.src || buildImageUrl(item.image)}
                srcSet={thumbProps.srcSet}
                sizes={thumbProps.sizes}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            );
          })()
        )}
      </button>
    );
  };

  // Size picker (single instance; the id is used to scroll here when no size is chosen)
  const SizeSelection = () => (
    <div id="mobile-size-selection" className="scroll-mt-40">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm text-mt-text">
          Size{selectedSize ? <span className="text-mt-muted">: {selectedSize}</span> : null}
        </h2>
        {sizeChartUrl && (
          <a
            href="#size-guide"
            onClick={() => {
              const guide = document.getElementById('size-guide');
              if (guide) guide.open = true;
            }}
            className="inline-flex items-center gap-1 text-xs text-mt-accent underline underline-offset-4 hover:text-mt-accent-strong"
          >
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            Size guide
          </a>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {itemData.variants.map((v) => {
          const isSelected = selectedSize === v.size;
          const isDisabled = Number(v.stock || 0) <= 0;
          return (
            <button
              key={v.size}
              type="button"
              onClick={() => !isDisabled && handleSizeSelect(v.size)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              title={isDisabled ? 'Out of stock' : `${v.stock} available`}
              className={`h-12 rounded-mt-btn border text-sm transition-colors ${
                isSelected
                  ? 'border-mt-text bg-mt-btn font-medium text-mt-btn-text'
                  : isDisabled
                    ? 'cursor-not-allowed border-mt-line text-mt-subtle line-through'
                    : 'border-mt-line-strong text-mt-text hover:border-mt-text'
              }`}
            >
              {v.size}
            </button>
          );
        })}
      </div>
      {sizeError ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-mt-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {sizeError}
        </p>
      ) : selectedVariant ? (
        <p className="mt-2 text-xs text-mt-muted">
          {Number(selectedVariant.stock || 0) < 5
            ? `Only ${selectedVariant.stock} left in size ${selectedSize}`
            : `In stock in size ${selectedSize}`}
        </p>
      ) : null}
    </div>
  );

  const addToCartLabel = isBusy
    ? (isInCart ? 'Updating…' : 'Adding…')
    : isOutOfStock
      ? 'Sold out'
      : isInCart
        ? (isReadymade && cartQuantity === quantity ? 'In cart' : `In cart (${cartQuantity})`)
        : 'Add to cart';

  return (
    <div className="min-h-screen bg-mt-bg pb-24 font-brand text-mt-text [color-scheme:var(--mt-scheme)] lg:pb-0">
      {productSchema ? (
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
      ) : null}

      {/* Toast */}
      {notification.show && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
          <div
            className={`flex max-w-sm items-center gap-3 rounded-mt-card border bg-mt-surface px-4 py-3 text-sm shadow-2xl shadow-mt-tint/10 ${
              notification.type === 'success'
                ? 'border-mt-success/40'
                : notification.type === 'error'
                  ? 'border-mt-danger/40'
                  : 'border-mt-line-strong'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0 text-mt-success" aria-hidden="true" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-mt-danger" aria-hidden="true" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-mt-muted" aria-hidden="true" />
            )}
            <span className="text-mt-text">{notification.message}</span>
            {notification.type === 'success' && (
              <Link to="/cart" className="ml-1 shrink-0 text-mt-accent underline underline-offset-4 hover:text-mt-accent-strong">
                View cart
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Utility row */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="inline-flex h-10 items-center gap-2 text-sm text-mt-muted transition-colors hover:text-mt-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="capitalize">Back to {backLabel}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyToClipboard}
            aria-label={copied ? 'Link copied' : 'Copy link to share'}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-mt-muted transition-colors hover:bg-mt-tint/10 hover:text-mt-text"
          >
            {copied ? <Check className="h-4 w-4 text-mt-success" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFavorite(!isFavorite)}
            aria-label={isFavorite ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={isFavorite}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-mt-muted transition-colors hover:bg-mt-tint/10 hover:text-mt-text"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current text-mt-text' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-3 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-20">
        {/* Gallery */}
        <section aria-label="Product images" className="lg:col-span-7">
          <div className="flex gap-3">
            {media.length > 1 && (
              <div className="hidden max-h-[680px] w-20 shrink-0 flex-col gap-3 overflow-y-auto lg:flex" style={{ scrollbarWidth: 'none' }}>
                {media.map((item, index) => renderThumb(item, index, 'h-24 w-20'))}
              </div>
            )}

            <div className="relative min-w-0 flex-1">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mt-card bg-mt-photo lg:max-h-[680px]">
                {mediaUrl ? (
                  isVideo ? (
                    <video
                      key={mediaUrl}
                      src={mediaUrl}
                      className="h-full w-full object-contain"
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls={false}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsImageViewerOpen(true)}
                      className="block h-full w-full cursor-zoom-in"
                      aria-label="Open image in full screen"
                    >
                      <img
                        src={mediaUrl}
                        srcSet={currentMediaImageProps?.srcSet}
                        sizes={currentMediaImageProps?.sizes}
                        alt={imageAlt}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                        loading={currentMediaImageProps?.loading}
                        decoding={currentMediaImageProps?.decoding}
                        fetchPriority={currentMediaImageProps?.fetchPriority}
                      />
                    </button>
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-mt-subtle">
                    <ImageIcon className="h-12 w-12" aria-hidden="true" />
                    <p className="mt-3 text-sm">No preview available</p>
                  </div>
                )}

                <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-2">
                  {isOutOfStock && (
                    <span className="rounded-mt-btn bg-black/80 px-2.5 py-1 text-xs font-medium text-white">Sold out</span>
                  )}
                  {offerTagDiscount > 0 && !isOutOfStock && (
                    <span className="rounded-mt-btn bg-black/80 px-2.5 py-1 text-xs font-medium text-white">{offerTagDiscount}% off</span>
                  )}
                  {isInCart && !isOutOfStock && (
                    <span className="rounded-mt-btn bg-white px-2.5 py-1 text-xs font-medium text-black">In cart · {cartQuantity}</span>
                  )}
                </div>

                {!isVideo && mediaUrl && (
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm" aria-hidden="true">
                    <Eye className="h-4 w-4" />
                  </span>
                )}

                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedImageIndex((prev) => (prev - 1 + media.length) % media.length)}
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                    >
                      <ChevronRight className="h-5 w-5 rotate-180" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedImageIndex((prev) => (prev + 1) % media.length)}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>

              {media.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" style={{ scrollbarWidth: 'none' }}>
                  {media.map((item, index) => renderThumb(item, index, 'h-16 w-14'))}
                </div>
              )}

              {/* Design views (custom designs only) */}
              {!isReadymade && displayData.views && displayData.views.length > 1 && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {displayData.views.map((view, index) => (
                    <button
                      key={view.code}
                      type="button"
                      onClick={() => {
                        setActiveView(index);
                        const previewIndex = images.findIndex((img) => img === view.previewImage);
                        if (previewIndex !== -1) setSelectedImageIndex(previewIndex);
                      }}
                      className={`relative aspect-square overflow-hidden rounded-mt-btn bg-mt-photo ${
                        activeView === index ? 'ring-2 ring-mt-text ring-offset-2 ring-offset-mt-bg' : ''
                      }`}
                    >
                      {view.previewImage ? (
                        <img src={buildImageUrl(view.previewImage)} alt={view.code} className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                      <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[10px] uppercase text-white">
                        {view.code || `View ${index + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Details */}
        <section aria-label="Product details" className="lg:col-span-5">
          <div className="lg:sticky lg:top-40">
            <p className="text-[11px] uppercase tracking-[0.24em] text-mt-subtle">
              {[displayData.category, itemData?.subCategory].filter(Boolean).join(' · ') || 'Maitrova'}
            </p>
            <h1 className="mt-2 text-2xl font-medium leading-tight text-mt-text sm:text-3xl">{displayData.title}</h1>

            {isReadymade && (
              <button
                type="button"
                onClick={scrollToReviews}
                className="mt-3 inline-flex items-center gap-2 text-sm text-mt-muted transition-colors hover:text-mt-text"
              >
                {renderStars()}
                {displayData.reviewCount > 0 ? (
                  <span>
                    {Number(displayData.rating).toFixed(1)} · {displayData.reviewCount} review{displayData.reviewCount === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span>No reviews yet</span>
                )}
              </button>
            )}

            {/* Price */}
            <div className="mt-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-medium text-mt-text sm:text-3xl">
                  {formatPrice(displayData.price, displayData.currency)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-mt-subtle line-through">
                    {formatPrice(displayData.originalPrice, displayData.currency)}
                  </span>
                )}
                {displayData.saleActive && displayData.discountPercent > 0 && (
                  <span className="text-sm font-medium text-mt-success">
                    Save {formatPrice(displayData.saveAmount, displayData.currency)} ({displayData.discountPercent}%)
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-mt-subtle">Inclusive of all taxes</p>
              {lowStock && !hasVariants && (
                <p className="mt-2 text-xs text-mt-warning">Only {displayData.stock} left in stock</p>
              )}
            </div>

            {/* Custom design colour */}
            {!isReadymade && displayData.productColor && (
              <div className="mt-6 flex items-center gap-3 border-t border-mt-line pt-6">
                <span className="h-8 w-8 rounded-full border border-mt-tint/25" style={{ backgroundColor: displayData.productColor }} />
                <span className="text-sm text-mt-muted">Garment colour</span>
              </div>
            )}

            {(isReadymade && (itemData?.colors?.length > 0 || hasVariants)) && (
              <div className="mt-6 space-y-6 border-t border-mt-line pt-6">
                {itemData?.colors?.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm text-mt-text">
                      Colour{selectedColor ? <span className="text-mt-muted">: {selectedColor}</span> : null}
                    </h2>
                    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
                      {itemData.colors.map((color) => {
                        const isSelected = selectedColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={color}
                            title={color}
                            onClick={() => handleColorSelect(color)}
                            className={`h-9 w-9 rounded-full border border-mt-tint/25 transition-shadow ${
                              isSelected ? 'ring-2 ring-mt-text ring-offset-2 ring-offset-mt-bg' : 'hover:ring-1 hover:ring-mt-line-strong hover:ring-offset-2 hover:ring-offset-mt-bg'
                            }`}
                            style={{ backgroundColor: color.toLowerCase() }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasVariants && <SizeSelection />}
              </div>
            )}

            {/* Purchase */}
            <div className="mt-6 space-y-3 border-t border-mt-line pt-6">
              <div className="flex gap-3">
                {isReadymade && (
                  <div className="flex h-12 items-center rounded-mt-btn border border-mt-line-strong" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="flex h-full w-11 items-center justify-center text-lg text-mt-text transition-colors hover:bg-mt-tint/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= displayData.stock}
                      aria-label="Increase quantity"
                      className="flex h-full w-11 items-center justify-center text-lg text-mt-text transition-colors hover:bg-mt-tint/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  id="readymade-add-to-cart-desktop"
                  onClick={handleAddToCart}
                  aria-label="Add to cart"
                  data-meta-track="add-to-cart"
                  disabled={isOutOfStock || isBusy}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text transition-colors hover:bg-mt-btn-hover disabled:cursor-not-allowed disabled:bg-mt-line-strong disabled:text-mt-subtle"
                >
                  {isBusy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
                  ) : isInCart ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  )}
                  {addToCartLabel}
                </button>
              </div>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-mt-btn border border-mt-accent text-sm font-medium text-mt-accent-strong transition-colors hover:bg-mt-accent/10 disabled:cursor-not-allowed disabled:border-mt-line disabled:text-mt-subtle"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Buy now
              </button>
              {isInCart && (
                <p className="text-center text-xs text-mt-muted">
                  {cartQuantity} in your cart · {formatPrice(totalInCart, displayData.currency)}{' '}
                  <Link to="/cart" className="text-mt-accent underline underline-offset-4 hover:text-mt-accent-strong">View cart</Link>
                </p>
              )}
            </div>

            {isReadymade && (
              <div className="mt-6">
                <ComboOfferBlock />
              </div>
            )}

            {/* Trust */}
            <ul className="mt-6 grid grid-cols-3 gap-2 border-y border-mt-line py-4 text-center text-[11px] text-mt-muted sm:text-xs">
              <li className="flex flex-col items-center gap-1.5">
                <Truck className="h-4 w-4 text-mt-text" aria-hidden="true" />
                Ships across India
              </li>
              <li className="flex flex-col items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-mt-text" aria-hidden="true" />
                <a href="/return-refund-policy" className="hover:text-mt-text">Easy returns</a>
              </li>
              <li className="flex flex-col items-center gap-1.5">
                <Shield className="h-4 w-4 text-mt-text" aria-hidden="true" />
                Secure checkout
              </li>
            </ul>

            {/* Information */}
            <div className="divide-y divide-mt-line border-b border-mt-line">
              <details className="group" open>
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
                  Description
                  <ChevronRight className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <ExpandableDescription
                  description={displayData.description}
                  html
                  limit={260}
                  className="pb-5 text-sm leading-relaxed text-mt-muted [&_p]:mb-3 [&_strong]:font-medium [&_strong]:text-mt-text [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                />
              </details>

              {productDetails.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
                    Product details
                    <ChevronRight className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pb-5 text-sm">
                    {productDetails.map((row) => (
                      <React.Fragment key={row.label}>
                        <dt className="text-mt-subtle">{row.label}</dt>
                        <dd className="text-mt-text">{row.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </details>
              )}

              {isReadymade && displayData.careInstructions && typeof displayData.careInstructions !== 'object' && (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
                    Care
                    <ChevronRight className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div
                    className="pb-5 text-sm leading-relaxed text-mt-muted [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(displayData.careInstructions)) }}
                  />
                </details>
              )}

              {isReadymade && sizeChartUrl && (
                <details id="size-guide" className="group scroll-mt-40">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm text-mt-text [&::-webkit-details-marker]:hidden">
                    Size guide
                    <ChevronRight className="h-4 w-4 text-mt-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <button
                    type="button"
                    onClick={() => window.open(sizeChartUrl, '_blank')}
                    className="mb-5 block w-full cursor-zoom-in overflow-hidden rounded-mt-btn bg-white"
                    aria-label="Open size chart in a new tab"
                  >
                    <img
                      src={sizeChartUrl}
                      alt="Size chart"
                      className="w-full"
                      srcSet={sizeChartImageProps.srcSet}
                      sizes={sizeChartImageProps.sizes}
                      loading="lazy"
                      decoding={sizeChartImageProps.decoding}
                    />
                  </button>
                </details>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Phone purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mt-line bg-mt-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium leading-tight text-mt-text">
              {formatPrice(displayData.price, displayData.currency)}
              {hasDiscount && (
                <span className="ml-2 text-xs font-normal text-mt-subtle line-through">
                  {formatPrice(displayData.originalPrice, displayData.currency)}
                </span>
              )}
            </p>
            <p className="truncate text-[11px] text-mt-subtle">
              {needsSize ? 'Select a size' : selectedSize ? `Size ${selectedSize} · Qty ${quantity}` : `Qty ${quantity}`}
            </p>
          </div>
          <button
            type="button"
            id="readymade-add-to-cart-mobile"
            onClick={handleAddToCart}
            aria-label="Add to cart"
            data-meta-track="add-to-cart"
            disabled={isOutOfStock || isBusy}
            className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-mt-btn bg-mt-btn px-5 text-sm font-medium text-mt-btn-text transition-colors hover:bg-mt-btn-hover disabled:cursor-not-allowed disabled:bg-mt-line-strong disabled:text-mt-subtle"
          >
            {isBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
            ) : isInCart ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            )}
            {addToCartLabel}
          </button>
        </div>
      </div>

      {shouldShowRelatedProducts && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-mt-text sm:text-2xl">You may also like</h2>
              {displayData?.category && (
                <p className="mt-1 text-sm text-mt-subtle">More in {displayData.category}</p>
              )}
            </div>
          </div>

          {relatedLoading ? (
            <div className="flex gap-3 overflow-hidden sm:gap-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="w-[44%] shrink-0 sm:w-[220px]">
                  <div className="aspect-[4/5] animate-pulse rounded-mt-btn bg-mt-surface-raised" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-mt-surface-raised" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-4" style={{ scrollbarWidth: 'none' }}>
              {relatedProducts.map((relatedItem) => {
                const relatedImage = Array.isArray(relatedItem.images)
                  ? relatedItem.images.find((image) => Boolean(getRawImagePath(image)))
                  : null;
                const relatedImageProps = getResponsiveImageProps(relatedImage, {
                  sizes: "(max-width: 640px) 44vw, 220px",
                  loading: "lazy",
                });
                const relatedPrice = Number(relatedItem.effectivePrice ?? relatedItem.price ?? 0);
                const relatedOriginalPrice = Number(relatedItem.mrp ?? relatedItem.price ?? relatedPrice);
                const showRelatedDiscount = relatedOriginalPrice > relatedPrice && relatedPrice > 0;

                return (
                  <Link
                    key={relatedItem._id}
                    to={buildReadymadeProductPath(relatedItem) || `/readymade/${relatedItem._id}`}
                    className="group w-[44%] shrink-0 snap-start sm:w-[220px]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-mt-btn bg-mt-photo">
                      {showRelatedDiscount && (
                        <span className="absolute left-2 top-2 z-10 rounded-mt-btn bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white">
                          {Math.round(((relatedOriginalPrice - relatedPrice) / relatedOriginalPrice) * 100)}% off
                        </span>
                      )}
                      <img
                        src={relatedImageProps.src || buildImageUrl(relatedImage)}
                        srcSet={relatedImageProps.srcSet}
                        sizes={relatedImageProps.sizes}
                        alt={relatedItem.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-mt-text">{relatedItem.title}</p>
                    <p className="mt-0.5 flex items-baseline gap-2 text-sm text-mt-muted">
                      {formatPrice(relatedPrice, relatedItem.currency || 'INR')}
                      {showRelatedDiscount && (
                        <span className="text-xs text-mt-subtle line-through">
                          {formatPrice(relatedOriginalPrice, relatedItem.currency || 'INR')}
                        </span>
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {isReadymade && itemData?._id ? (
        <div id="reviews" className="scroll-mt-40">
          <ProductReviews
            kind="READYMADE"
            targetId={itemData._id}
            initialRating={displayData?.rating}
            initialReviewCount={displayData?.reviewCount}
            initialBreakdown={displayData?.ratingBreakdown}
          />
        </div>
      ) : null}

      <ProductImageLightbox
        isOpen={isImageViewerOpen}
        items={galleryItems}
        initialIndex={currentGalleryIndex}
        title={displayData?.title || "Product gallery"}
        onClose={() => setIsImageViewerOpen(false)}
        onIndexChange={(nextGalleryIndex) => {
          const nextMediaIndex = imageMediaIndexes[nextGalleryIndex];
          if (typeof nextMediaIndex === "number") {
            setSelectedImageIndex(nextMediaIndex);
          }
        }}
      />
    </div>
  );
}
