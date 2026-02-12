// pages/CartPage.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  getCart,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  selectCart,
  selectCartLoading,
  selectCartError,
  selectCartSummary,
  selectCartItems,
  selectCartItemCount,
  resetCartState,
  clearError,
  clearSuccess,
} from '../redux/slices/Cartslice.js';
import { selectCurrentToken } from '../redux/slices/Userslice.js';

// Constants
const API_BASE_URL = import.meta.env.VITE_IMAGE_URL || "https://narifighter.online/backend";

const ensureImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("data:")) return imagePath;
  if (imagePath.startsWith("blob:")) return imagePath;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  return `${API_BASE_URL}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
};

const getDropId = (item) => {
  if (!item) return null;
  if (typeof item.dropproduct === "string") return item.dropproduct;
  return item.dropproduct?._id || item.dropproductId || null;
};

const getDropName = (item) => {
  if (!item) return "Product";
  if (item.dropproduct && typeof item.dropproduct === "object") {
    return item.dropproduct.name || item.dropproduct.title || "Product";
  }
  return "Drop Product";
};

const CartPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const getMaxStock = (item) => {
    const p = item.dropproduct || item.readymadeProduct;
    if (!p) return null;
    if (Array.isArray(p.variants) && p.variants.length && item.size) {
      const v = p.variants.find(
        (x) => String(x.size).toUpperCase() === String(item.size).toUpperCase()
      );
      if (v && typeof v.stock === "number") return v.stock;
    }
    if (typeof p.stock === "number") return p.stock;
    if (typeof p.totalStock === "number") return p.totalStock;
    return null;
  };

  // Cart state
  const cart = useSelector(selectCart);
  const cartItems = useSelector(selectCartItems);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const cartSummary = useSelector(selectCartSummary);
  const cartItemCount = useSelector(selectCartItemCount);
  
  // User state
  const token = useSelector(selectCurrentToken);
  const isLoggedIn = !!token;
  
  const [updatingItem, setUpdatingItem] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState(false);

  // Fetch cart on component mount
  useEffect(() => {
    if (isLoggedIn) {
      dispatch(getCart());
    }
  }, [dispatch, isLoggedIn]);

  // Clear notifications after 3 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Get item name based on kind
  const getItemName = (item) => {
    if (item.kind === "READYMADE") {
      if (getDropId(item)) return getDropName(item);
      return (
        item.readymadeProduct?.title ||
        item.readymadeProduct?.name ||
        "Product"
      );
    }
    if (item.kind === "DESIGN") {
      return (
        item.design?.name ||
        item.design?.title ||
        item.design?.designName ||
        "Design"
      );
    }
    return item.product?.title || item.product?.name || "Product";
  };

  // Get main image URL
  const getImageUrl = (item) => {
    if (item.previewImage) return ensureImageUrl(item.previewImage);
    let imagePath = null;
    if (item.kind === "READYMADE") {
      if (item.dropproduct?.images?.length) imagePath = item.dropproduct.images[0];
      else if (item.readymadeProduct?.images?.length) imagePath = item.readymadeProduct.images[0];
    } else if (item.kind === "DESIGN") {
      if (item.design?.images?.length) imagePath = item.design.images[0];
      else if (item.design?.previewImage) imagePath = item.design.previewImage;
    } else if (item.product?.images?.length) {
      imagePath = item.product.images[0];
    }
    return imagePath ? ensureImageUrl(imagePath) : null;
  };

  // Get product type for display
  const getProductType = (item) => {
    if (item.kind === "READYMADE") return item.dropproduct ? "Drop Product" : "Readymade Product";
    if (item.kind === "DESIGN") return "Custom Design";
    return "Product";
  };

  // Get additional product info
  const getProductInfo = (item) => {
    if (item.kind === "READYMADE") {
      const product = item.dropproduct || item.readymadeProduct;
      if (!product) return {};
      return {
        description: product.description,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
        size: product.size,
        color: product.color,
      };
    }
    if (item.kind === "DESIGN" && item.design) {
      const design = item.design;
      return {
        description: design.description || design.designDescription,
        category: design.category,
        style: design.style,
        color: design.colorPalette || design.primaryColor,
      };
    }
    return {};
  };

  // Handle quantity updates
  const handleQuantityChange = async (itemId, newQty) => {
    if (!isLoggedIn) {
      setNotification({
        show: true,
        message: 'Please login to update cart',
        type: 'warning'
      });
      return;
    }
    if (newQty < 1) return;
    try {
      setUpdatingItem(itemId);
      await dispatch(updateCartItemQty({ itemId, qty: newQty })).unwrap();
      setNotification({
        show: true,
        message: 'Quantity updated successfully',
        type: 'success'
      });
    } catch (error) {
      setNotification({
        show: true,
        message: error.message || 'Failed to update quantity',
        type: 'error'
      });
    } finally {
      setUpdatingItem(null);
    }
  };

  // Handle item removal
  const handleRemoveItem = async (itemId) => {
    if (!isLoggedIn) return;
    try {
      setRemovingItem(itemId);
      await dispatch(removeCartItem(itemId)).unwrap();
      setNotification({
        show: true,
        message: 'Item removed from cart',
        type: 'success'
      });
    } catch (error) {
      setNotification({
        show: true,
        message: error.message || 'Failed to remove item',
        type: 'error'
      });
    } finally {
      setRemovingItem(null);
    }
  };

  // Handle clear cart
  const handleClearCart = async () => {
    if (!isLoggedIn || !cartItems.length) return;
    if (!window.confirm('Are you sure you want to clear your cart?')) return;
    try {
      await dispatch(clearCart()).unwrap();
      setNotification({
        show: true,
        message: 'Cart cleared successfully',
        type: 'success'
      });
    } catch (error) {
      setNotification({
        show: true,
        message: error.message || 'Failed to clear cart',
        type: 'error'
      });
    }
  };

  // Handle checkout
  const handleCheckout = () => {
    if (!isLoggedIn) {
      setNotification({
        show: true,
        message: 'Please login to checkout',
        type: 'warning'
      });
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    if (cartItems.length === 0) {
      setNotification({
        show: true,
        message: 'Your cart is empty',
        type: 'warning'
      });
      return;
    }
    setIsCheckoutLoading(true);
    setTimeout(() => {
      navigate('/checkout');
      setIsCheckoutLoading(false);
    }, 1000);
  };

  // Format price
  const formatPrice = (price, currency = 'INR') => {
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    if (currency === 'INR' || currency === '₹') {
      return `₹${numPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (currency === 'USD' || currency === '$') {
      return `$${numPrice.toFixed(2)}`;
    }
    try {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      });
      return formatter.format(numPrice);
    } catch (error) {
      return `${currency} ${numPrice.toFixed(2)}`;
    }
  };

  // Handle retry fetching cart
  const handleRetry = () => {
    dispatch(clearError());
    dispatch(getCart());
  };

  // Handle image click to navigate to details page
  const handleImageClick = (item) => {
    if (item.kind === "READYMADE") {
      const dropId = getDropId(item);
      if (dropId) return navigate(`/dropproducts/${dropId}`);
      if (item.readymadeProduct?._id) return navigate(`/readymade/${item.readymadeProduct._id}`);
    }
    if (item.kind === "DESIGN" && item.design?._id) {
      return navigate(`/catalogue/${item.design._id}`);
    }
    if (item.product?._id) {
      return navigate(`/products/${item.product._id}`);
    }
  };

  // Loading state
  if (loading && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your cart...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Failed to load cart</h2>
            <p className="text-gray-600 mb-6 px-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 rounded-full mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Login to view your cart</h2>
            <p className="text-gray-600 mb-6 px-4">Please login to view and manage your shopping cart</p>
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 px-4">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition duration-200 w-full sm:w-auto"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/readymade/products')}
                className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition duration-200 w-full sm:w-auto"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 rounded-full mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
            <p className="text-gray-600 mb-6 px-4">Looks like you haven't added any items to your cart yet</p>
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 px-4">
              <Link
                to="/allproducts"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition duration-200 w-full sm:w-auto text-center"
              >
                Browse Products
              </Link>
              <Link
                to="/designs"
                className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition duration-200 w-full sm:w-auto text-center"
              >
                Explore Designs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Notification Toast - Mobile Optimized */}
      {notification.show && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:right-4 z-50 animate-fade-in-down">
          <div className={`rounded-lg shadow-lg p-4 ${
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
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : notification.type === 'error' ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile Header */}
        <div className="py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {cartItemCount} item{cartItemCount !== 1 ? 's' : ''} in your cart
            </p>
          </div>
          
        </div>

        {/* Mobile Order Summary Toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setExpandedMobileMenu(!expandedMobileMenu)}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex justify-between items-center"
          >
            <span className="font-semibold text-gray-900">Order Summary</span>
            <div className="flex items-center">
              <span className="text-lg font-bold text-gray-900 mr-2">
                {formatPrice(cartSummary.total, 'INR')}
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expandedMobileMenu ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          
          {expandedMobileMenu && (
            <div className="mt-2 bg-white rounded-xl shadow-sm p-4">
              <OrderSummaryContent
                cartSummary={cartSummary}
                formatPrice={formatPrice}
                handleCheckout={handleCheckout}
                isCheckoutLoading={isCheckoutLoading}
                cartItems={cartItems}
              />
            </div>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Cart Items</h2>
              </div>

              <div className="divide-y divide-gray-200">
                {cartItems.map((item) => {
                  const isUpdating = updatingItem === item._id;
                  const isRemoving = removingItem === item._id;
                  const imageUrl = getImageUrl(item);
                  const itemTotal = (item.unitPrice || 0) * (item.qty || 0);
                  const itemName = getItemName(item);
                  const productType = getProductType(item);
                  const productInfo = getProductInfo(item);
                  const maxStock = getMaxStock(item);

                  return (
                    <div key={item._id} className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row">
                        {/* Product Image - Mobile Optimized */}
                        <div 
                          className="flex-shrink-0 w-full sm:w-32 mb-4 sm:mb-0 cursor-pointer"
                          onClick={() => handleImageClick(item)}
                        >
                          {imageUrl ? (
                            <div className="relative w-full h-48 sm:h-32 rounded-lg overflow-hidden group">
                              <img
                                src={imageUrl}
                                alt={itemName}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNFNUU1RTUiLz48L3N2Zz4=';
                                }}
                              />
                              {/* Mobile optimized overlay */}
                              <div className="absolute inset-0 bg-black/30 sm:bg-transparent sm:group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                <span className="text-white text-sm font-medium px-3 py-1.5 bg-black/70 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                                  View Details
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-48 sm:h-32 bg-gray-200 rounded-lg flex flex-col items-center justify-center">
                              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="mt-2 text-sm text-gray-600">No Image</span>
                            </div>
                          )}
                        </div>

                        {/* Product Details - Mobile Optimized */}
                        <div className="flex-1 sm:ml-6">
                          <div className="flex flex-col sm:flex-row justify-between">
                            <div className="flex-1">
                              <h3 
                                className="text-base sm:text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors duration-200 mb-1"
                                onClick={() => handleImageClick(item)}
                              >
                                {itemName}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 mb-2">
                                {productType} • {item.currency}
                              </p>
                              
                              {/* Size + Stock badges - Mobile Optimized */}
                              {item.size && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Size: {String(item.size).toUpperCase()}
                                  </span>
                                  {item.kind === "READYMADE" && typeof maxStock === "number" && maxStock > 0 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      Stock: {maxStock}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Price - Mobile */}
                              <div className="flex justify-between items-center sm:hidden mt-2">
                                <span className="text-sm text-gray-600">Price:</span>
                                <div className="text-right">
                                  <p className="text-base font-semibold text-gray-900">
                                    {formatPrice(itemTotal, item.currency)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatPrice(item.unitPrice, item.currency)} each
                                  </p>
                                </div>
                              </div>
                              
                              {/* Additional product info - Collapsible on mobile */}
                              {productInfo.description && (
                                <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                                  {productInfo.description}
                                </p>
                              )}
                              
                              {/* Category badges - Mobile Optimized */}
                              {(productInfo.category || productInfo.brand || productInfo.subCategory || productInfo.style || productInfo.color) && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {productInfo.category && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {productInfo.category}
                                    </span>
                                  )}
                                  {productInfo.subCategory && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                      {productInfo.subCategory}
                                    </span>
                                  )}
                                  {productInfo.brand && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      {productInfo.brand}
                                    </span>
                                  )}
                                  {productInfo.style && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      {productInfo.style}
                                    </span>
                                  )}
                                  {productInfo.color && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      {productInfo.color}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Price - Desktop */}
                            <div className="hidden sm:block text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {formatPrice(itemTotal, item.currency)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatPrice(item.unitPrice, item.currency)} each
                              </p>
                            </div>
                          </div>

                          {/* Quantity Controls and Remove - Mobile Optimized */}
                          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                            <div className="flex items-center justify-between sm:justify-start">
                              <span className="text-sm text-gray-600 sm:hidden mr-3">Qty:</span>
                              <div className="flex items-center">
                                <button
                                  onClick={() => handleQuantityChange(item._id, item.qty - 1)}
                                  disabled={item.qty <= 1 || isUpdating}
                                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 rounded-l-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                  </svg>
                                </button>
                                <div className="w-14 h-10 sm:w-12 sm:h-8 flex items-center justify-center border-t border-b border-gray-300">
                                  {isUpdating ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  ) : (
                                    <span className="text-sm font-medium">{item.qty}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleQuantityChange(item._id, item.qty + 1)}
                                  disabled={isUpdating}
                                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Remove Button - Mobile Optimized */}
                            <button
                              onClick={() => handleRemoveItem(item._id)}
                              disabled={isRemoving}
                              className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center sm:justify-start w-full sm:w-auto"
                            >
                              {isRemoving ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Removing...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Remove
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continue Shopping - Mobile Optimized */}
            <div className="mt-6">
              <Link
                to="/allproducts"
                className="inline-flex items-center justify-center sm:justify-start text-blue-600 hover:text-blue-800 w-full sm:w-auto"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Continue Shopping
              </Link>
            </div>
          </div>

          {/* Desktop Order Summary */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h2>
              <OrderSummaryContent
                cartSummary={cartSummary}
                formatPrice={formatPrice}
                handleCheckout={handleCheckout}
                isCheckoutLoading={isCheckoutLoading}
                cartItems={cartItems}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Separate component for Order Summary to avoid code duplication
const OrderSummaryContent = ({ cartSummary, formatPrice, handleCheckout, isCheckoutLoading, cartItems }) => (
  <>
    <div className="space-y-3 sm:space-y-4">
      <div className="flex justify-between">
        <span className="text-sm sm:text-base text-gray-600">Subtotal</span>
        <span className="text-sm sm:text-base font-medium">{formatPrice(cartSummary.subtotal, 'INR')}</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-sm sm:text-base text-gray-600">Shipping</span>
        <span className="text-sm sm:text-base font-medium">
          {cartSummary.shipping === 0 ? 'FREE' : formatPrice(cartSummary.shipping, 'INR')}
        </span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-sm sm:text-base text-gray-600">Tax (18% GST)</span>
        <span className="text-sm sm:text-base font-medium">{formatPrice(cartSummary.tax, 'INR')}</span>
      </div>
      
      <div className="border-t border-gray-200 pt-3 sm:pt-4">
        <div className="flex justify-between">
          <span className="text-base sm:text-lg font-semibold text-gray-900">Total</span>
          <span className="text-lg sm:text-xl font-bold text-gray-900">
            {formatPrice(cartSummary.total, 'INR')}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-2">Including all taxes</p>
      </div>
    </div>

    {/* Checkout Button */}
    <button
      onClick={handleCheckout}
      disabled={isCheckoutLoading || cartItems.length === 0}
      className="w-full mt-6 sm:mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
    >
      {isCheckoutLoading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-2 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
      ) : (
        'Proceed to Checkout'
      )}
    </button>

    {/* Additional Info - Mobile Optimized */}
    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
      <div className="flex items-center text-xs sm:text-sm text-gray-500">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Free shipping on orders over ₹500</span>
      </div>
      <div className="flex items-center text-xs sm:text-sm text-gray-500 mt-2">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Secure checkout</span>
      </div>
    </div>
  </>
);

export default CartPage;