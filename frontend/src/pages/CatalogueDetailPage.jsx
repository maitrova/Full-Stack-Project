// src/pages/CatalogueDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
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
  Plus,
  Minus,
  Loader2,
  Truck,
  Shield,
  RefreshCw,
  MessageCircle,
  Phone,
  CreditCard,
  Layers,
  BookOpen,
  Info,
  CheckCircle,
  Clock,
  ShieldCheck,
  Award,
  Users,
  ThumbsUp
} from "lucide-react";

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

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

export default function CatalogueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localCartQuantity, setLocalCartQuantity] = useState(0);
  const [activeTab, setActiveTab] = useState("specifications");
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  
  // Redux selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        const res = await fetch(`${API_URL}/savedata/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load design");
        setDesign(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDesign();
  }, [id]);

  // Get cart quantity for this design
  const getCartQuantity = () => {
    // First check local state (for optimistic updates)
    if (localCartQuantity !== 0) {
      return localCartQuantity;
    }
    
    // Then check Redux store
    const item = cartItems.find(item => item.designId === id);
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

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to add items to cart',
        type: 'warning'
      });
      return;
    }

    if (!design) return;

    try {
      // Get the kind from design, default to "DESIGN" if not specified
      const designKind = design.kind || "DESIGN";
      
      // Ensure kind is either "READYMADE" or "DESIGN"
      const kind = designKind.toUpperCase() === "READYMADE" ? "READYMADE" : "DESIGN";
      
      const cartData = {
        designId: design._id,
        productId: design.product?._id || design.productId,
        title: design.title || design.productName,
        unitPrice: design.salePrice || design.product?.basePrice || 0,
        basePrice: design.product?.basePrice || design.salePrice || 0,
        qty: 1,
        previewImage: design.previewImage || design.views?.[0]?.previewImage || null,
        signature: `${design._id}-${design.product?._id || design.productId}`,
        views: design.views || [],
        kind: kind // Include kind in the request body
      };

      // Optimistic update: show item as added immediately
      setLocalCartQuantity(1);

      await dispatch(addToCart(cartData)).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      // Revert optimistic update on error
      setLocalCartQuantity(0);
    }
  };

  // Handle increment quantity
  const handleIncrement = async () => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to update cart',
        type: 'warning'
      });
      return;
    }

    if (!design) return;

    const currentQty = quantity;
    const cartItem = cartItems.find(item => item.designId === design._id);
    
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
      // Revert optimistic update on error
      setLocalCartQuantity(0);
    }
  };

  // Handle decrement quantity
  const handleDecrement = async () => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to update cart',
        type: 'warning'
      });
      return;
    }

    if (!design) return;

    const currentQty = quantity;
    const cartItem = cartItems.find(item => item.designId === design._id);
    
    if (!cartItem || currentQty <= 1) {
      // If quantity is 1, remove from cart
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
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      // Revert optimistic update on error
      setLocalCartQuantity(0);
    }
  };

  // Handle remove from cart
  const handleRemoveFromCart = async () => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to update cart',
        type: 'warning'
      });
      return;
    }

    if (!design) return;

    const cartItem = cartItems.find(item => item.designId === design._id);
    if (!cartItem) return;

    try {
      // Optimistic update
      setLocalCartQuantity(0);

      await dispatch(removeCartItem(cartItem._id)).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartQuantity(0);
      }, 2000);
      
    } catch (error) {
      console.error("Failed to remove from cart:", error);
      // Revert optimistic update on error
      setLocalCartQuantity(quantity); // Revert to previous quantity
    }
  };

  // Handle buy now
  const handleBuyNow = async () => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to proceed',
        type: 'warning'
      });
      return;
    }

    if (isInCart) {
      navigate('/cart');
    } else {
      await handleAddToCart();
      if (token) {
        setTimeout(() => navigate('/cart'), 500);
      }
    }
  };

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

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse absolute -top-2 -right-2" />
        </div>
        <p className="mt-6 text-gray-700 font-medium">Loading design details...</p>
        <p className="text-sm text-gray-400 mt-1">Preparing an amazing view</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-2xl text-white">!</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Design Not Found</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate("/catalogue")}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
          >
            Browse Catalogue
          </button>
        </div>
      </div>
    </div>
  );

  if (!design) return null;

  const views = design.views || [];
  const stats = {
    totalTextLayers: views.reduce((acc, view) => acc + (view.textLayers?.length || 0), 0),
    totalImageLayers: views.reduce((acc, view) => acc + (view.designLayers?.length || 0), 0),
    totalViews: views.length
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
              <span className="font-medium">Back to Catalogue</span>
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

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex" aria-label="Breadcrumb">
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
                  to="/catalogue" 
                  className="text-gray-600 hover:text-blue-600 ml-1"
                >
                  Catalogue
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                <span className="text-gray-400 ml-1">{design.title || design.productName}</span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Design ID: {design._id.slice(-8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-current" />
                    <span className="text-sm font-medium text-gray-700">Premium Design</span>
                    {isInCart && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        In Cart ({quantity})
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative h-[500px] bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden">
                  {views[activeView]?.previewImage ? (
                    <img
                      src={views[activeView].previewImage}
                      alt={views[activeView].code}
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

                  {/* Navigation Arrows */}
                  {views.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveView(prev => (prev - 1 + views.length) % views.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700 rotate-180" />
                      </button>
                      <button
                        onClick={() => setActiveView(prev => (prev + 1) % views.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>

                {/* View Thumbnails */}
                {views.length > 1 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">All Views ({views.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {views.map((view, index) => (
                        <button
                          key={view.code}
                          onClick={() => setActiveView(index)}
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
                            {view.code.toUpperCase()}
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
              {isInCart ? (
                <div className="flex items-center justify-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={handleDecrement}
                    disabled={isUpdating}
                    className="flex-1 p-4 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="flex-1 p-4 text-center">
                    <span className="text-lg font-semibold text-gray-900">{quantity}</span>
                    <span className="text-sm text-gray-500 block">in cart</span>
                  </div>
                  <button
                    onClick={handleIncrement}
                    disabled={isUpdating}
                    className="flex-1 p-4 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={isUpdating || !token}
                  className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group ${
                    token 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  } ${isUpdating ? 'opacity-50' : ''}`}
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                  {token ? 'Add to Cart' : 'Login to Cart'}
                  <span className={`${token ? 'text-indigo-200' : 'text-gray-400'}`}>
                    ₹{design.salePrice || 0}
                  </span>
                </button>
              )}
              
              <button
                onClick={handleBuyNow}
                disabled={isUpdating || !token}
                className={`h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                  token 
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <CreditCard className="w-5 h-5" />
                {token ? 'Buy Now' : 'Login to Buy'}
              </button>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Product Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {design.title || design.productName}
                </h1>
                <div className="flex items-center gap-2 text-gray-500">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">{design.productName}</span>
                </div>
                
                {/* Kind Badge */}
                {design.kind && (
                  <div className="mt-3 inline-block">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      design.kind.toUpperCase() === "DESIGN" 
                        ? "bg-indigo-100 text-indigo-700" 
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {design.kind.toUpperCase() === "DESIGN" ? (
                        <span className="flex items-center gap-1">
                          <Palette className="w-3 h-3" />
                          DESIGN
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          READYMADE
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Color Display */}
              {design.productColor && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Product Color</span>
                    <Palette className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg border-2 border-white shadow-lg"
                      style={{ backgroundColor: design.productColor }}
                    />
                    <span className="text-gray-600">{design.productColor}</span>
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
                    ₹{design.salePrice || 0}
                  </span>
                  {design.product?.basePrice && design.salePrice < design.product.basePrice && (
                    <span className="text-gray-400 line-through">₹{design.product.basePrice}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">Inclusive of all taxes</p>
                
                {/* Cart Summary */}
                {isInCart && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">{quantity} item(s)</span> in your cart • 
                      Total: <span className="font-semibold">₹{(quantity * (design.salePrice || 0)).toFixed(2)}</span>
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
                          i < 5
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600">(No reviews yet)</span>
                </div>
              </div>

              {/* Design Stats */}
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
                    <div className="text-2xl font-bold text-gray-900">{stats.totalTextLayers}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-600">Image Layers</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalImageLayers}</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Total Views</div>
                      <div className="text-xl font-bold text-gray-900">{stats.totalViews}</div>
                    </div>
                    <Eye className="w-8 h-8 text-indigo-400" />
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="font-semibold text-gray-700 mb-4">Quick Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Design Status</span>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Available
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">File Format</span>
                    <span className="font-medium">Vector & Raster</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Resolution</span>
                    <span className="font-medium">300 DPI</span>
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
                      <Clock className="w-5 h-5 text-blue-600" />
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
                    <p className="text-sm text-gray-600">Easy returns within 30 days</p>
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
                  onClick={() => setActiveTab('details')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors ${
                    activeTab === 'details' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Design Details
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
                    <h4 className="font-semibold text-gray-900 mb-4">Design Specifications</h4>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Product Category</p>
                          <p className="font-medium">{design.productName || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Design Type</p>
                          <p className="font-medium">{design.kind || 'Custom Design'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Color Support</p>
                          <p className="font-medium">CMYK & RGB</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">File Formats</p>
                          <p className="font-medium">AI, EPS, PDF, PNG, JPG</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Resolution</p>
                          <p className="font-medium">300 DPI (Print Ready)</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Editable</p>
                          <p className="font-medium">Yes (Vector Files)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Quality Assurance</h4>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Print Ready</p>
                            <p className="text-sm text-gray-600">High-resolution files</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Quality Checked</p>
                            <p className="text-sm text-gray-600">Professional review</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Award className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Expert Design</p>
                            <p className="text-sm text-gray-600">Created by professionals</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Customer Support</p>
                            <p className="text-sm text-gray-600">24/7 assistance</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Design Composition</h4>
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Type className="w-6 h-6 text-indigo-600" />
                          </div>
                          <p className="font-semibold text-gray-900">{stats.totalTextLayers}</p>
                          <p className="text-sm text-gray-600">Text Layers</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ImageIcon className="w-6 h-6 text-purple-600" />
                          </div>
                          <p className="font-semibold text-gray-900">{stats.totalImageLayers}</p>
                          <p className="text-sm text-gray-600">Image Layers</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Eye className="w-6 h-6 text-pink-600" />
                          </div>
                          <p className="font-semibold text-gray-900">{stats.totalViews}</p>
                          <p className="text-sm text-gray-600">Different Views</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Design Features</h4>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Fully editable vector files</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>High-resolution PNG files</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Print-ready CMYK format</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Web-optimized RGB format</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Layered PSD files included</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Commercial usage rights</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Digital Delivery</h4>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <Download className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Instant Download</p>
                          <p className="text-sm text-gray-600">Access files immediately after purchase</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">24/7 Access</p>
                          <p className="text-sm text-gray-600">Download anytime from your account</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Secure Storage</p>
                          <p className="text-sm text-gray-600">Files stored securely for 1 year</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Return & Refund Policy</h4>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">100% Satisfaction Guarantee</p>
                          <p className="text-sm text-gray-600">Get a full refund if unsatisfied within 7 days</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Easy Refund Process</p>
                          <p className="text-sm text-gray-600">Refunds processed within 3 business days</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <ThumbsUp className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Modification Support</p>
                          <p className="text-sm text-gray-600">Free minor modifications if needed</p>
                        </div>
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