// src/pages/ProductDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getProductById as fetchReadymadeProductById } from '../redux/slices/productList.js';
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
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";

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
  Ruler,
  LogIn
} from 'lucide-react';
import Footer from './Footer.jsx';

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";
const IMAGE_URL = import.meta.env.VITE_IMAGE_URL;

export default function ProductDetailPage() {
  const { id, type = 'product' } = useParams();
  const navigate = useNavigate();
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
  const [showLoginPrompt, setShowLoginPrompt] = useState(false); // New state for login prompt

  // Redux state
  const token = useSelector(selectCurrentToken);
  const isLoggedIn = !!token;
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartSuccess = useSelector(selectCartSuccess);
  const cartError = useSelector(selectCartError);
  
  const { currentProduct: product } = useSelector((state) => state.productList);
  const isReadymade = type === 'product';
  
  const hasVariants = isReadymade &&
    Array.isArray(itemData?.variants) &&
    itemData.variants.length > 0;

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
          await dispatch(fetchReadymadeProductById(id)).unwrap();
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

    if (id) {
      fetchData();
    }
  }, [id, type, dispatch, token, isReadymade]);

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

  // New function to handle login prompt
  const handleLoginPrompt = () => {
    setShowLoginPrompt(true);
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowLoginPrompt(false);
    }, 5000);
  };

  const handleAddToCart = async () => {
    if (!itemData) {
      setNotification({
        show: true,
        message: 'Item data not available',
        type: 'error'
      });
      return;
    }

    if (!isLoggedIn) {
      // Show login prompt modal instead of just a notification
      handleLoginPrompt();
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
      await dispatch(getCart());
      
    } catch (error) {
      console.error('Add to cart failed:', error);
      
      if (error.status === 401) {
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
    if (!isLoggedIn) {
      handleLoginPrompt();
      return;
    }

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
    if (isLoggedIn && itemData) {
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

  const getImageUrl = (imagePath) => {
    return buildImageUrl(imagePath);
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
  
  const formatPrice = (price, currency = 'INR') => {
    if (currency === 'INR') {
      return `₹${price.toFixed(2)}`;
    }
    return `$${price.toFixed(2)}`;
  };

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
        rating: itemData.rating || 4,
        reviewCount: itemData.reviewCount || 24,
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
    ...(itemData?.video
      ? [{
          type: "video",
          url: getVideoUrl(itemData.video),
        }]
      : []),
    ...images.map(img => ({
      type: "image",
      image: img.url,
      alt: img.altText
    }))
  ];
  
  const sizeChartImageProps = getResponsiveImageProps(itemData?.sizeChart, {
    sizes: "100vw",
  });
  const sizeChartUrl = sizeChartImageProps.src;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse absolute -top-2 -right-2" />
          </div>
          <p className="mt-6 text-gray-700 font-medium">
            Loading {isReadymade ? 'product' : 'design'} details...
          </p>
          <p className="text-sm text-gray-400 mt-1">Preparing an amazing view</p>
        </div>
      </div>
    );
  }

  if (error || !displayData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {isReadymade ? 'Product' : 'Design'} Not Found
          </h3>
          <p className="text-gray-600 mb-6">{error || 'The requested item is not available'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
            <button
              onClick={() => navigate(isReadymade ? '/readymade/products' : '/catalogue')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
            >
              Browse {isReadymade ? 'Products' : 'Catalogue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentMedia = media[selectedImageIndex];

  const isVideo = currentMedia?.type === "video";
  const currentMediaImageProps = !isVideo
    ? getResponsiveImageProps(currentMedia?.image, {
        sizes: "(max-width: 1024px) 100vw, 50vw",
        loading: selectedImageIndex === 0 ? "eager" : "lazy",
      })
    : null;
  const mediaUrl = isVideo ? currentMedia?.url : currentMediaImageProps?.src;
  const imageAlt = currentMedia?.alt || displayData.title;

  // Size Selection Component
  const SizeSelection = () => (
    <div className="space-y-2 sm:space-y-3" id="mobile-size-selection">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 sm:text-lg">Select Size</h3>
        {sizeError && (
          <span className="flex items-center gap-1 text-[11px] text-red-600 sm:text-sm">
            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {sizeError}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {itemData.variants.map((v) => {
          const isSelected = selectedSize === v.size;
          const isDisabled = Number(v.stock || 0) <= 0;
          const stockStatus = isDisabled ? 'Out of stock' : `${v.stock} available`;

          return (
            <button
              key={v.size}
              onClick={() => !isDisabled && handleSizeSelect(v.size)}
              disabled={isDisabled}
              className={`
                relative min-w-[52px] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all duration-200 sm:min-w-[70px] sm:border-2 sm:px-4 sm:py-3 sm:text-base
                ${isSelected 
                  ? 'border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-200' 
                  : isDisabled
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50 line-through'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                }
              `}
              title={stockStatus}
            >
              <span className="block">{v.size}</span>
              {!isDisabled && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-green-500 sm:-right-2 sm:-top-2 sm:h-4 sm:w-4 sm:border-2"></span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Selected Size Feedback */}
      {selectedSize && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2 sm:p-3">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="text-xs font-medium sm:text-sm">
              Selected: Size {selectedSize} • 
              Price: {formatPrice(Number(selectedVariant?.price || 0), displayData.currency)} • 
              Stock: {selectedVariant?.stock} available
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // Size Chart Component
  const SizeChart = () => {
    if (!sizeChartUrl) return null;
    
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Size Chart</h3>
          </div>
          <div 
            className="relative cursor-zoom-in group"
            onClick={() => window.open(sizeChartUrl, "_blank")}
          >
            <img
              src={sizeChartUrl}
              alt="Size Chart"
              className="w-full rounded-lg border border-gray-200 transition-transform group-hover:scale-[1.02]"
              srcSet={sizeChartImageProps.srcSet}
              sizes={sizeChartImageProps.sizes}
              loading={sizeChartImageProps.loading}
              decoding={sizeChartImageProps.decoding}
              fetchPriority={sizeChartImageProps.fetchPriority}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                Click to enlarge
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down">
          <div className={`rounded-lg shadow-lg p-4 max-w-sm ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${
                notification.type === 'success' ? 'text-green-400' :
                notification.type === 'error' ? 'text-red-400' :
                notification.type === 'warning' ? 'text-yellow-400' :
                'text-blue-400'
              }`}>
                {notification.type === 'success' ? (
                  <Check className="h-5 w-5" />
                ) : notification.type === 'error' ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Info className="h-5 w-5" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' :
                  notification.type === 'error' ? 'text-red-800' :
                  notification.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform animate-slide-up">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h3>
              <p className="text-gray-600 mb-6">
                Please login to your account to add items to cart and make purchases.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowLoginPrompt(false);
                    navigate('/login', { state: { from: window.location.pathname } });
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
                >
                  Login Now
                </button>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
                >
                  Continue Browsing
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="text-purple-600 font-medium hover:underline"
                  onClick={() => setShowLoginPrompt(false)}
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium hidden sm:inline">
                Back to {isReadymade ? 'Products' : 'Catalogue'}
              </span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-medium hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span className="font-medium hidden sm:inline">Share</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2 rounded-lg ${isFavorite ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <Link
                to="/cart"
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">Cart</span>
                {cartItems.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="hidden sm:flex mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link to="/" className="text-gray-600 hover:text-blue-600">
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                <Link 
                  to={isReadymade ? '/readymade/products' : '/catalogue'} 
                  className="text-gray-600 hover:text-blue-600 ml-1"
                >
                  {isReadymade ? 'Products' : 'Catalogue'}
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                <span className="text-gray-400 ml-1 truncate max-w-[200px]">{displayData.title}</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-6">
                {/* Header with badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-xs sm:text-sm text-gray-500">
                      {isReadymade ? 'SKU:' : 'Design ID:'} {displayData.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadymade && (
                      <>
                        <Star className="w-4 h-4 text-amber-400 fill-current" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Premium Design</span>
                      </>
                    )}
                    {isInCart && !isOutOfStock && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        In Cart ({cartQuantity})
                      </span>
                    )}
                  </div>
                </div>

                {/* Login required overlay for non-logged in users */}
                {!isLoggedIn && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-black/5 backdrop-blur-[2px] z-10 rounded-xl flex items-center justify-center">
                      <div className="bg-white/90 p-4 rounded-xl shadow-lg text-center max-w-xs mx-4">
                        <LogIn className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-gray-800 font-medium mb-3">Login to add items to cart</p>
                        <button
                          onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          Login Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Media Display */}
                <div className="relative h-[300px] sm:h-[400px] md:h-[500px] bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden">
                  {mediaUrl ? (
                    isVideo ? (
                      <video
                        key={mediaUrl}
                        src={mediaUrl}
                        className="w-full h-full object-contain"
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls={false}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `
                            <div class="flex items-center justify-center h-full">
                              <div class="text-center">
                                <p class="text-gray-400 font-medium">Video unavailable</p>
                              </div>
                            </div>
                          `;
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        srcSet={currentMediaImageProps?.srcSet}
                        sizes={currentMediaImageProps?.sizes}
                        alt={imageAlt}
                        className="w-full h-full object-contain"
                        style={
                          currentMediaImageProps?.placeholder
                            ? {
                                backgroundImage: `url(${currentMediaImageProps.placeholder})`,
                                backgroundPosition: "center",
                                backgroundSize: "cover",
                              }
                            : undefined
                        }
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `
                            <div class="flex items-center justify-center h-full">
                              <div class="text-center">
                                <p class="text-gray-400 font-medium">Preview unavailable</p>
                              </div>
                            </div>
                          `;
                        }}
                        loading={currentMediaImageProps?.loading}
                        decoding={currentMediaImageProps?.decoding}
                        fetchPriority={currentMediaImageProps?.fetchPriority}
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No preview available</p>
                      </div>
                    </div>
                  )}

                  {media.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImageIndex(prev => (prev - 1 + media.length) % media.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 rotate-180" />
                      </button>
                      <button
                        onClick={() => setSelectedImageIndex(prev => (prev + 1) % media.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                      </button>
                    </>
                  )}

                  <div className="absolute top-4 left-4 flex flex-col space-y-2">
                    {isOutOfStock && (
                      <span className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-red-100 text-red-800">
                        Sold Out
                      </span>
                    )}
                    {isReadymade && displayData.stock < 5 && !isOutOfStock && (
                      <span className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-orange-100 text-orange-800">
                        Only {displayData.stock} left!
                      </span>
                    )}
                  </div>

                  {offerTagDiscount > 0 && (
                    <span className="absolute top-4 right-4 z-10 rounded-full bg-red-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-lg">
                      {offerTagDiscount}% OFF
                    </span>
                  )}
                </div>

                {/* Media Thumbnails */}
                {media.length > 1 && (
                  <div className="mt-4 sm:mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                      {media.some(m => m.type === 'video') ? 'Photos & Videos' : 'Images'} ({media.length})
                    </p>
                    <div className="flex space-x-2 overflow-x-auto py-2">
                      {media.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 relative ${
                            selectedImageIndex === index ? 'border-blue-500' : 'border-gray-200'
                          }`}
                        >
                          {item.type === "video" ? (
                            <>
                              <video
                                src={item.url}
                                className="w-full h-full object-cover"
                                muted
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <span className="text-white text-xs">▶</span>
                              </div>
                            </>
                          ) : (
                            <img
                              src={getImageUrl(item.image)}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Thumbnails for designs */}
                {!isReadymade && displayData.views && displayData.views.length > 1 && (
                  <div className="mt-4 sm:mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                      All Views ({displayData.views.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                      {displayData.views.map((view, index) => (
                        <button
                          key={view.code}
                          onClick={() => {
                            setActiveView(index);
                            const previewIndex = images.findIndex(img => img === view.previewImage);
                            if (previewIndex !== -1) setSelectedImageIndex(previewIndex);
                          }}
                          className={`relative rounded-lg border overflow-hidden transition-all ${activeView === index ? 'ring-2 ring-indigo-500 ring-offset-2' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="aspect-square bg-gray-50">
                            {view.previewImage ? (
                              <img
                                src={view.previewImage}
                                alt={view.code}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded truncate">
                            {view.code?.toUpperCase() || `VIEW ${index + 1}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Size Chart - Positioned Below Images on Desktop */}
            {isReadymade && sizeChartUrl && (
              <div className="hidden lg:block">
                <SizeChart />
              </div>
            )}
          </div>

          {/* Right Column - Details - Desktop (lg and above) */}
          <div className="hidden lg:block space-y-6">
            {/* Product Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {displayData.title}
                </h1>
                <div className="flex items-center gap-2 text-gray-500">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">{displayData.category}</span>
                </div>
              </div>

              {/* Color Display (for designs) */}
              {!isReadymade && displayData.productColor && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Product Color</span>
                    <Palette className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg border-2 border-white shadow-lg"
                      style={{ backgroundColor: displayData.productColor }}
                    />
                    <span className="text-gray-600">{displayData.productColor}</span>
                  </div>
                </div>
              )}

              {/* Price Display */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Price</span>
                  <Tag className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {formatPrice(displayData.price, displayData.currency)}
                  </span>
                  {displayData.originalPrice && displayData.price < displayData.originalPrice && (
                    <span className="text-gray-400 line-through">
                      {formatPrice(displayData.originalPrice, displayData.currency)}
                    </span>
                  )}
                </div>
                {displayData.saleActive && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      {displayData.discountPercent}% OFF
                    </span>
                    <span className="text-emerald-700">Save {formatPrice(displayData.saveAmount, displayData.currency)}</span>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">Inclusive of all taxes</p>
                
                {isInCart && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">{cartQuantity} item(s)</span> in your cart • 
                      Total: <span className="font-semibold">{formatPrice(totalInCart, displayData.currency)}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Rating */}
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(displayData.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600">({displayData.reviewCount} reviews)</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <div
                  className="text-gray-600 leading-relaxed text-sm
                    [&_p]:mb-3
                    [&_strong]:font-semibold
                    [&_em]:italic
                    [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-700
                    [&_ul]:list-disc [&_ul]:pl-6
                    [&_ol]:list-decimal [&_ol]:pl-6
                    [&_li]:mb-1"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(displayData.description || ""),
                  }}
                />
              </div>

              {/* Size Selection (desktop) */}
              {isReadymade && hasVariants && <SizeSelection />}

              {/* Color Selection */}
              {isReadymade && itemData?.colors && itemData.colors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Color</h3>
                  <div className="flex flex-wrap gap-3">
                    {itemData.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={`flex items-center space-x-2 px-3 py-2 border-2 rounded-lg transition-all duration-200 ${
                          selectedColor === color
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-gray-300"
                          style={{ backgroundColor: color.toLowerCase() }}
                        />
                        <span className="font-medium text-gray-700">{color}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              {isReadymade && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Quantity</h3>
                    <span className="text-sm text-gray-600">{displayData.stock} available</span>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1 || !isLoggedIn}
                      className={`w-10 h-10 flex items-center justify-center border border-gray-300 rounded-l-lg ${
                        quantity <= 1 || !isLoggedIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">-</span>
                    </button>
                    <div className="w-12 h-10 flex items-center justify-center border-t border-b border-gray-300">
                      <span className="text-lg font-medium">{quantity}</span>
                    </div>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= displayData.stock || !isLoggedIn}
                      className={`w-10 h-10 flex items-center justify-center border border-gray-300 rounded-r-lg ${
                        quantity >= displayData.stock || !isLoggedIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">+</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Login required message for non-logged in users */}
              {!isLoggedIn && (
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                  <div className="flex items-start gap-3">
                    <LogIn className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-purple-800 font-medium mb-2">Login to purchase</p>
                      <p className="text-sm text-purple-600 mb-3">
                        You need to be logged in to add items to cart and make purchases.
                      </p>
                      <button
                        onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Login Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons (desktop) - Only show if logged in */}
              {isLoggedIn ? (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isAddingToCart || cartLoading || (hasVariants && !selectedSize)}
                    className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                      isOutOfStock || (hasVariants && !selectedSize)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isInCart
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90'
                    }`}
                  >
                    {isAddingToCart || cartLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        {isInCart ? 'Updating...' : 'Adding...'}
                      </>
                    ) : isInCart ? (
                      <>
                        <Check className="w-5 h-5" />
                        {isReadymade && cartQuantity === quantity ? 'In Cart' : `In Cart (${cartQuantity})`}
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
                    disabled={isOutOfStock || (hasVariants && !selectedSize)}
                    className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                      isOutOfStock || (hasVariants && !selectedSize)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Buy Now
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                    className="w-full h-14 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 transition-all flex items-center justify-center gap-3"
                  >
                    <LogIn className="w-5 h-5" />
                    Login to Add to Cart
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Action Bar - Fixed at bottom with Size Selection BEFORE Add to Cart */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-lg">
          <div className="space-y-2 p-2.5">
            {/* Size Selection (Mobile - First in order) */}
            {isReadymade && hasVariants && (
              <div className="mb-1">
                <SizeSelection />
              </div>
            )}

            {/* Login required message for mobile */}
            {!isLoggedIn && (
              <div className="mb-1 rounded-lg border border-purple-100 bg-purple-50 p-2">
                <p className="text-xs text-purple-700 text-center">
                  Please login to add items to cart
                </p>
              </div>
            )}

            {/* Quantity and Action Buttons (Mobile) */}
            <div className="space-y-2">
              {isReadymade && isLoggedIn && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Qty</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1 || (hasVariants && !selectedSize)}
                      className={`flex h-7 w-7 items-center justify-center rounded-l-lg border border-gray-300 ${
                        quantity <= 1 || (hasVariants && !selectedSize) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">-</span>
                    </button>
                    <div className="flex h-7 w-8 items-center justify-center border-b border-t border-gray-300">
                      <span className="text-sm font-medium">{quantity}</span>
                    </div>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= displayData.stock || (hasVariants && !selectedSize)}
                      className={`flex h-7 w-7 items-center justify-center rounded-r-lg border border-gray-300 ${
                        quantity >= displayData.stock || (hasVariants && !selectedSize) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">+</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || isAddingToCart || cartLoading || (hasVariants && !selectedSize)}
                      className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all ${
                        isOutOfStock || (hasVariants && !selectedSize)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : isInCart
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90'
                      }`}
                    >
                      {isAddingToCart || cartLoading ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white"></div>
                          <span className="text-xs">Adding...</span>
                        </>
                      ) : isInCart ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span className="text-xs">In Cart</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span className="text-xs">Add</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleBuyNow}
                      disabled={isOutOfStock || (hasVariants && !selectedSize)}
                      className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all ${
                        isOutOfStock || (hasVariants && !selectedSize)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span className="text-xs">Buy</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-sm font-semibold text-white transition-all hover:opacity-90"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="text-xs">Login to Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Product Info (Above the fixed bar) */}
        <div className="lg:hidden space-y-6 pb-24">
          {/* Product Title and Price */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {displayData.title}
            </h1>
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Package className="w-4 h-4" />
              <span className="text-sm font-medium">{displayData.category}</span>
            </div>
            
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {formatPrice(displayData.price, displayData.currency)}
                </span>
                {displayData.originalPrice && displayData.price < displayData.originalPrice && (
                  <span className="text-gray-400 line-through ml-2 text-sm">
                    {formatPrice(displayData.originalPrice, displayData.currency)}
                  </span>
                )}
                {displayData.saleActive && (
                  <div className="mt-1 text-xs font-medium text-emerald-700">
                    Save {formatPrice(displayData.saveAmount, displayData.currency)} • {displayData.discountPercent}% OFF
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm text-gray-600">{displayData.rating}</span>
              </div>
            </div>
            
            {isInCart && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">{cartQuantity} item(s)</span> in cart
                </p>
              </div>
            )}
          </div>

          {/* Color Selection (Mobile) */}
          {isReadymade && itemData?.colors && itemData.colors.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Color</h3>
              <div className="flex flex-wrap gap-2">
                {itemData.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`flex items-center space-x-2 px-2 py-1.5 border-2 rounded-lg transition-all duration-200 ${
                      selectedColor === color
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-gray-300"
                      style={{ backgroundColor: color.toLowerCase() }}
                    />
                    <span className="font-medium text-sm text-gray-700">{color}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description (Mobile) */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <div
              className="text-gray-600 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(displayData.description || ""),
              }}
            />
          </div>

          {/* Size Chart (Mobile) - Positioned After Description */}
          {isReadymade && sizeChartUrl && (
            <SizeChart />
          )}
        </div>
      </div>
      <Footer/>
    </div>
  );
}
