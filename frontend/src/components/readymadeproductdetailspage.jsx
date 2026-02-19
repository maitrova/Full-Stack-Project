// src/pages/ProductDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getProductById as fetchReadymadeProductById } from '../redux/slices/productList.js';
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
  CreditCard
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";
const IMAGE_URL = import.meta.env.VITE_IMAGE_URL;
export default function ProductDetailPage() {
  const { id, type = 'product' } = useParams(); // type can be 'product' or 'design'
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Helpers
 

  // State for the combined page
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

  // Redux state
  const token = useSelector(selectCurrentToken);
  const isLoggedIn = !!token;
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartSuccess = useSelector(selectCartSuccess);
  const cartError = useSelector(selectCartError);
  
  // For readymade products
  const { currentProduct: product } = useSelector((state) => state.productList);
  const isReadymade = type === 'product';
  const hasVariants =
  isReadymade &&
  Array.isArray(itemData?.variants) &&
  itemData.variants.length > 0;

const getVariantBySize = (size) => {
  if (!itemData?.variants || !size) return null;
  return (
    itemData.variants.find(
      (v) => String(v.size).toUpperCase() === String(size).toUpperCase()
    ) || null
  );
};

  // Fetch data based on type
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        if (isReadymade) {
          // Fetch readymade product
          await dispatch(fetchReadymadeProductById(id)).unwrap();
        } else {
          // Fetch design
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
      // Reset state when product changes
      setSelectedImageIndex(0);
      setQuantity(1);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedVariant(null);
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

  // Clear notifications after 3 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Update cart item details (check if item is already in cart)
  const updateCartItemDetails = () => {
    if (!itemData || !cartItems.length) {
      return null;
    }

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

  // Add to cart handler for both types
  const handleAddToCart = async () => {
    if (!itemData) {
      setNotification({
        show: true,
        message: 'Item data not available',
        type: 'error'
      });
      return;
    }

    // Check if user is logged in
    if (!isLoggedIn) {
      setNotification({
        show: true,
        message: 'Please login to add items to cart',
        type: 'warning'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: window.location.pathname } });
      }, 1500);
      return;
    }

    // For readymade products: check stock and options
    if (isReadymade) {
      // ✅ If variants exist, size is mandatory
if (hasVariants && !selectedSize) {
  setNotification({
    show: true,
    message: 'Please select a size',
    type: 'error',
  });
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

// ✅ stock should be validated against variant stock when variants exist
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

      // Validate stock
      

      // Check size selection if sizes are available
      if (itemData.sizes && itemData.sizes.length > 0 && !selectedSize) {
        setNotification({
          show: true,
          message: 'Please select a size',
          type: 'error'
        });
        return;
      }
      
      // Check color selection if colors are available
      if (itemData.colors && itemData.colors.length > 0 && !selectedColor) {
        setNotification({
          show: true,
          message: 'Please select a color',
          type: 'error'
        });
        return;
      }
    } else {
      // For designs: check if design is published or owned by user
      const isOwner = itemData.user?.toString() === "user_id_here"; // You need to get current user ID
      const isPublic = itemData.isPublished === true;
      
      if (!isOwner && !isPublic) {
        setNotification({
          show: true,
          message: 'This design is not available for purchase',
          type: 'error'
        });
        return;
      }
    }

    try {
      setIsAddingToCart(true);
      
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
      
      // Refresh cart to get updated data
      await dispatch(getCart());
      
    } catch (error) {
      console.error('Add to cart failed:', error);
      
      // Handle 401 errors (unauthorized) specifically
      if (error.status === 401) {
        setNotification({
          show: true,
          message: 'Session expired. Please login again.',
          type: 'error'
        });
        // Redirect to login
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

  // Buy now handler
  const handleBuyNow = async () => {
    await handleAddToCart();
    if (isLoggedIn && itemData) {
      navigate('/cart');
    }
  };

  // Quantity change handler (only for readymade products)
  const handleQuantityChange = (change) => {
  if (!isReadymade) return;

  // ✅ if variants exist, require size to change qty properly
  if (hasVariants && !selectedVariant) {
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


  // Size selection handler (only for readymade products)
  const handleSizeSelect = (size) => {
  setSelectedSize(size);
  const v = getVariantBySize(size);
  setSelectedVariant(v);
  setQuantity(1); // reset qty when size changes (recommended)
};


  // Color selection handler (only for readymade products)
  const handleColorSelect = (color) => {
    setSelectedColor(color);
  };

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    } else if (imagePath.startsWith('/')) {
      return `${IMAGE_URL}${imagePath}`;
    } else {
      return `${IMAGE_URL}/${imagePath}`;
    }
  };

  // Format price
  const formatPrice = (price, currency = 'INR') => {
    if (currency === 'INR') {
      return `₹${price.toFixed(2)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get display data based on type
  const getDisplayData = () => {
    if (!itemData) return null;

    if (isReadymade) {
  const activeVariant = selectedVariant || null;

  const resolvedPrice =
    activeVariant?.price !== undefined && activeVariant?.price !== null
      ? Number(activeVariant.price)
      : Number(itemData.price || 0);

  const resolvedStock =
    activeVariant?.stock !== undefined && activeVariant?.stock !== null
      ? Number(activeVariant.stock)
      : Number(itemData.stock || 0);

  return {
    title: itemData.title,
    description: itemData.description,
    price: resolvedPrice,              // ✅ variant price after selection
    originalPrice: itemData.originalPrice,
    currency: itemData.currency || 'INR',
    images: Array.isArray(itemData.images) ? itemData.images : [],
    stock: resolvedStock,              // ✅ variant stock after selection
    isActive: itemData.isActive,
    category: itemData.category,
    material: itemData.material,
    weight: itemData.weight,
    dimensions: itemData.dimensions,
    rating: itemData.rating || 4,
    reviewCount: itemData.reviewCount || 24,
    sku: activeVariant?.sku || itemData.sku || 'N/A',   // ✅ variant sku if exists
    specifications: itemData.specifications,
    manufacturer: itemData.manufacturer,
    warranty: itemData.warranty,
    careInstructions: itemData.careInstructions,

    // ✅ important: out of stock depends on variant if variants exist
    isOutOfStock: !itemData.isActive || resolvedStock === 0,

    type: 'product',
    activeVariant, // optional, helpful
  };
}
 else {
      const views = itemData.views || [];
      const currentView = views[activeView] || {};
      
      return {
        title: itemData.title || itemData.productName,
        description: `Custom design for ${itemData.productName}`,
        price: itemData.salePrice || itemData.calculatedPrice || itemData.basePrice || 0,
        originalPrice: itemData.product?.basePrice,
        currency: 'INR',
        images: views.map(v => v.previewImage).filter(Boolean),
        stock: 1, // Designs are unique
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
  
  // Loading state
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

  // Error state
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

  const mainImage = images[selectedImageIndex];
  const imageUrl = getImageUrl(mainImage?.url);
  const imageAlt = mainImage?.altText || displayData.title;


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
                  <span className="text-xl">!</span>
                ) : (
                  <span className="text-xl">⚠</span>
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

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">
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
                    <span className="font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span className="font-medium">Share</span>
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
                <span className="font-medium">View Cart</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex mb-8" aria-label="Breadcrumb">
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
                <span className="text-gray-400 ml-1">{displayData.title}</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                {/* Header with badges */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {isReadymade ? 'SKU:' : 'Design ID:'} {displayData.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadymade && (
                      <>
                        <Star className="w-4 h-4 text-amber-400 fill-current" />
                        <span className="text-sm font-medium text-gray-700">Premium Design</span>
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

                {/* Main Image Display */}
                <div className="relative h-[500px] bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="flex items-center justify-center h-full">
                            <div class="text-center">
                              <ImageIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
                              <p class="text-gray-400 font-medium">Preview unavailable</p>
                            </div>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No preview available</p>
                      </div>
                    </div>
                  )}

                  {/* Navigation Arrows for multiple images */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImageIndex(prev => (prev - 1 + images.length) % images.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700 rotate-180" />
                      </button>
                      <button
                        onClick={() => setSelectedImageIndex(prev => (prev + 1) % images.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                    </>
                  )}

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-col space-y-2">
                    {isOutOfStock && (
                      <span className="px-4 py-2 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                        Sold Out
                      </span>
                    )}
                    {isReadymade && displayData.stock < 5 && !isOutOfStock && (
                      <span className="px-4 py-2 text-sm font-semibold rounded-full bg-orange-100 text-orange-800">
                        Only {displayData.stock} left!
                      </span>
                    )}
                  </div>
                </div>

                {/* Image Thumbnails */}
                {images.length > 1 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Images ({images.length})
                    </p>
                    <div className="flex space-x-2 overflow-x-auto py-2">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                            selectedImageIndex === index ? 'border-blue-500' : 'border-gray-200'
                          }`}
                        >
                          <img
                            src={getImageUrl(image.url)}
                            alt={image.altText || `${displayData.title} view ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Thumbnails for designs */}
                {!isReadymade && displayData.views && displayData.views.length > 1 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      All Views ({displayData.views.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                                <Eye className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded truncate">
                            {view.code?.toUpperCase() || `VIEW ${index + 1}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAddingToCart || cartLoading || !isLoggedIn || (hasVariants && !selectedSize)}
                className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group ${
                  isOutOfStock || !isLoggedIn
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
                    {isReadymade && cartQuantity === quantity ? 'Already in Cart' : `In Cart (${cartQuantity})`}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                    <span className="text-indigo-200">
                      {formatPrice(displayData.price, displayData.currency)}
                    </span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock || !isLoggedIn || (hasVariants && !selectedSize)}
                className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                  isOutOfStock || !isLoggedIn
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                {!isLoggedIn ? 'Login to Buy Now' : 'Buy Now'}
              </button>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
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
                <p className="text-sm text-gray-500 mt-2">Inclusive of all taxes</p>
                
                {/* Cart Summary */}
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
                <p className="text-gray-600 whitespace-pre-line">{displayData.description}</p>
              </div>

              {/* Size Selection (only for readymade products) */}
              {isReadymade && hasVariants && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Size</h3>
    <div className="flex flex-wrap gap-2">
      {itemData.variants.map((v) => {
        const isSelected = selectedSize === v.size;
        const isDisabled = Number(v.stock || 0) <= 0;

        return (
          <button
            key={v.size}
            onClick={() => !isDisabled && handleSizeSelect(v.size)}
            disabled={isDisabled}
            className={`px-4 py-2 border-2 rounded-lg font-medium transition-all duration-200 ${
              isSelected
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : isDisabled
                ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                : 'border-gray-300 hover:border-gray-400 text-gray-700'
            }`}
            title={isDisabled ? 'Out of stock' : `Price: ${formatPrice(Number(v.price || 0), displayData.currency)}`}
          >
            {v.size}
          </button>
        );
      })}
    </div>

    {!selectedSize && (
      <p className="text-sm text-gray-500 mt-2">
        Select a size to see the correct price and stock.
      </p>
    )}
  </div>
)}


              {/* Color Selection (only for readymade products) */}
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

              {/* Quantity (only for readymade products) */}
              {isReadymade && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Quantity</h3>
                    <span className="text-sm text-gray-600">{displayData.stock} available</span>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className={`w-10 h-10 flex items-center justify-center border border-gray-300 rounded-l-lg ${
                        quantity <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">-</span>
                    </button>
                    <div className="w-12 h-10 flex items-center justify-center border-t border-b border-gray-300">
                      <span className="text-lg font-medium">{quantity}</span>
                    </div>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= displayData.stock}
                      className={`w-10 h-10 flex items-center justify-center border border-gray-300 rounded-r-lg ${
                        quantity >= displayData.stock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">+</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Design Stats (only for designs) */}
              {!isReadymade && displayData.stats && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Design Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Type className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm text-gray-600">Text Layers</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{displayData.stats.totalTextLayers}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-gray-600">Image Layers</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{displayData.stats.totalImageLayers}</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Total Views</div>
                        <div className="text-xl font-bold text-gray-900">{displayData.stats.totalViews}</div>
                      </div>
                      <Eye className="w-8 h-8 text-indigo-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* Product Details */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-medium">{displayData.category || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Material</p>
                    <p className="font-medium">{displayData.material || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Weight</p>
                    <p className="font-medium">{displayData.weight || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dimensions</p>
                    <p className="font-medium">{displayData.dimensions || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping & Support */}
            <div className="space-y-6">
              {/* Shipping Info */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping & Delivery</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-green-100 p-2 rounded-lg mr-3">
                      <Truck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Free Shipping</p>
                      <p className="text-sm text-gray-600">On orders above ₹999</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <span className="text-lg">🚚</span>
                    </div>
                    <div>
                      <p className="font-medium">Estimated Delivery</p>
                      <p className="text-sm text-gray-600">3-5 business days</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Support Info */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
                <div className="space-y-4">
                  <button className="w-full py-3 px-4 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition duration-200 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Chat with Us
                  </button>
                  <button className="w-full py-3 px-4 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition duration-200 flex items-center justify-center">
                    <Phone className="w-5 h-5 mr-2" />
                    Call Support
                  </button>
                </div>
              </div>

              {/* Return Policy */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Return Policy</h3>
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">30-Day Returns</p>
                    <p className="text-sm text-gray-600">Easy returns within 30 days of purchase</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('specifications')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors ${
                    activeTab === 'specifications' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors ${
                    activeTab === 'reviews' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Reviews ({displayData.reviewCount})
                </button>
                <button
                  onClick={() => setActiveTab('shipping')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors ${
                    activeTab === 'shipping' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Shipping & Returns
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {activeTab === 'specifications' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Product Specifications</h4>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {displayData.specifications?.map((spec, index) => (
                          <div key={index}>
                            <p className="text-sm text-gray-500">{spec.key}</p>
                            <p className="font-medium">{spec.value}</p>
                          </div>
                        )) || (
                          <>
                            <div>
                              <p className="text-sm text-gray-500">Manufacturer</p>
                              <p className="font-medium">{displayData.manufacturer || 'Not specified'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Warranty</p>
                              <p className="font-medium">{displayData.warranty || 'Not specified'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Care Instructions</p>
                              <p className="font-medium">{displayData.careInstructions || 'Not specified'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Shipping Information</h4>
                    <div className="bg-blue-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center">
                          <div className="bg-blue-100 p-3 rounded-lg mr-4">
                            <Check className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Free Shipping</p>
                            <p className="text-sm text-gray-600">On orders over ₹999</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="bg-blue-100 p-3 rounded-lg mr-4">
                            <span className="text-lg">🚀</span>
                          </div>
                          <div>
                            <p className="font-medium">Fast Delivery</p>
                            <p className="text-sm text-gray-600">3-5 business days</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="bg-blue-100 p-3 rounded-lg mr-4">
                            <Shield className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Easy Returns</p>
                            <p className="text-sm text-gray-600">30-day return policy</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">Customer Reviews</h4>
                  <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Shipping Policy</h4>
                    <ul className="space-y-3 text-gray-600">
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Free standard shipping on orders over ₹999</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Express shipping available at additional cost</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Delivery within 3-5 business days for metro cities</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>International shipping available to select countries</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Return & Exchange Policy</h4>
                    <ul className="space-y-3 text-gray-600">
                      <li className="flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span>30-day return policy from date of delivery</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span>Products must be in original condition with tags</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span>Free return shipping for defective items</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span>Refunds processed within 5-7 business days</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}