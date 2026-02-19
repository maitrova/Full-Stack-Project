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
  ChevronLeft,
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
  ThumbsUp,
  Grid3x3,
  FileText,
  Zap,
  Globe,
  Cpu,
  BarChart3,
  AlertCircle
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
    if (!token) {
      setNotification({ show: true, message: "Please login to add items to cart", type: "warning" });
      return;
    }
    if (!design) return;

    if (!selectedSize) {
      setNotification({ show: true, message: "Please select a size before adding to cart", type: "warning" });
      return;
    }

    try {
      const designKind = design.kind || "DESIGN";
      const kind = designKind.toUpperCase() === "READYMADE" ? "READYMADE" : "DESIGN";

      const fd = new FormData();
      fd.append("designId", design._id);
      fd.append("productId", design.product?._id || design.productId || "");
      fd.append("title", design.title || design.productName || "");
      fd.append("unitPrice", String(currentPrice));
      fd.append("basePrice", String(design.product?.basePrice || currentPrice));
      fd.append("qty", "1");
      fd.append("previewImage", design.previewImage || design.views?.[0]?.previewImage || "");
      fd.append("signature", `${design._id}-${design.product?._id || design.productId || ""}-${selectedSize}`);
      fd.append("kind", kind);
      fd.append("size", selectedSize);
      fd.append("views", JSON.stringify(design.views || []));
      
      // Add price details if available
      if (priceDetails) {
        fd.append("priceDetails", JSON.stringify(priceDetails));
      }

      setLocalCartQuantity(1);
      await dispatch(addToCart(fd)).unwrap();
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
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to update cart',
        type: 'warning'
      });
      return;
    }

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

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-gray-100 border-t-gray-800 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Cpu className="w-8 h-8 text-gray-800 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-gray-800 font-medium tracking-tight">Loading design specifications</p>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Preparing professional assets</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center border border-gray-200 rounded-xl p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <span className="text-2xl text-gray-900 font-bold">!</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Design Not Found</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium tracking-tight flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate("/catalogue")}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-medium tracking-tight"
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
    <div className="min-h-screen bg-white">
      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down">
          <div className={`rounded-lg shadow-lg p-4 max-w-sm border ${
            notification.type === 'success' ? 'bg-green-50 border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border-red-200' :
            notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${
                notification.type === 'success' ? 'text-green-500' :
                notification.type === 'error' ? 'text-red-500' :
                notification.type === 'warning' ? 'text-yellow-500' :
                'text-blue-500'
              }`}>
                {notification.type === 'success' ? (
                  <Check className="h-5 w-5" />
                ) : notification.type === 'error' ? (
                  <span className="text-xl font-bold">!</span>
                ) : (
                  <span className="text-xl">⚠</span>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium tracking-tight ${
                  notification.type === 'success' ? 'text-gray-900' :
                  notification.type === 'error' ? 'text-gray-900' :
                  notification.type === 'warning' ? 'text-gray-900' :
                  'text-gray-900'
                }`}>
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors group"
            >
              <div className="w-8 h-8 border border-gray-300 rounded-lg flex items-center justify-center group-hover:border-gray-400 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium tracking-tight text-sm">BACK</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium tracking-tight"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>SHARE</span>
                  </>
                )}
              </button>
              
              <Link
                to="/cart"
                className="flex items-center gap-2 px-4 py-2 border border-gray-900 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium tracking-tight"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>CART</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-8">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2 text-sm">
              <li className="inline-flex items-center">
                <Link to="/" className="text-gray-500 hover:text-gray-900 transition-colors tracking-tight">
                  HOME
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                  <Link 
                    to="/catalogue" 
                    className="text-gray-500 hover:text-gray-900 transition-colors tracking-tight"
                  >
                    CATALOGUE
                  </Link>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                  <span className="text-gray-900 font-medium tracking-tight ml-1">
                    {design.title || design.productName}
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium tracking-tight">
                      ID: {design._id.slice(-8)}
                    </div>
                    {design.kind && (
                      <div className={`px-3 py-1 rounded-full text-xs font-medium tracking-tight ${
                        design.kind.toUpperCase() === "DESIGN" 
                          ? "bg-blue-50 text-blue-700" 
                          : "bg-green-50 text-green-700"
                      }`}>
                        {design.kind.toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {isInCart && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-700 tracking-tight">
                        IN CART • {quantity} ITEMS • SIZE: {selectedSize}
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative h-[500px] bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-lg overflow-hidden">
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
                              <Cpu class="w-16 h-16 text-gray-300 mx-auto mb-4" />
                              <p class="text-gray-400 font-medium tracking-tight">PREVIEW UNAVAILABLE</p>
                            </div>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Cpu className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium tracking-tight">NO PREVIEW AVAILABLE</p>
                      </div>
                    </div>
                  )}

                  {/* Navigation Arrows */}
                  {views.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveView(prev => (prev - 1 + views.length) % views.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => setActiveView(prev => (prev + 1) % views.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>

                {/* View Thumbnails */}
                {views.length > 1 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-gray-700 tracking-tight">VIEWS ({views.length})</p>
                      <div className="flex items-center gap-2 text-gray-500">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs tracking-tight">360° PERSPECTIVE</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {views.map((view, index) => (
                        <button
                          key={view.code}
                          onClick={() => setActiveView(index)}
                          className={`relative border rounded-lg overflow-hidden transition-all group ${
                            activeView === index 
                              ? 'border-gray-900 ring-1 ring-gray-900' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="aspect-square bg-gray-50">
                            {view.previewImage ? (
                              <img
                                src={view.previewImage}
                                alt={view.code}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Grid3x3 className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 py-2 text-xs font-medium tracking-tight text-center ${
                            activeView === index 
                              ? 'bg-gray-900 text-white' 
                              : 'bg-white/90 text-gray-700'
                          }`}>
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
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={handleDecrement}
                    disabled={isUpdating || priceLoading}
                    className="flex-1 p-4 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center border-r border-gray-300"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="flex-1 p-4 text-center">
                    <div>
                      <span className="text-lg font-semibold text-gray-900 tracking-tight">{quantity}</span>
                      <span className="text-xs text-gray-500 block tracking-tight">IN CART • SIZE: {selectedSize}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleIncrement}
                    disabled={isUpdating || priceLoading}
                    className="flex-1 p-4 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center border-l border-gray-300"
                  >
                    {isUpdating || priceLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={isUpdating || priceLoading || !token || !selectedSize}
                  className={`h-14 rounded-lg font-semibold tracking-tight transition-all flex items-center justify-center gap-3 border ${
                    token && selectedSize
                      ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800' 
                      : 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed'
                  } ${isUpdating || priceLoading ? 'opacity-50' : ''}`}
                >
                  {(isUpdating || priceLoading) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                  {token ? 'ADD TO CART' : 'LOGIN REQUIRED'}
                  <span className={`${token && selectedSize ? 'text-gray-300' : 'text-gray-400'}`}>
                    ₹{currentPrice}
                    {(priceLoading) && <span className="text-xs ml-1">(loading...)</span>}
                  </span>
                </button>
              )}
              
              <button
                onClick={handleBuyNow}
                disabled={isUpdating || priceLoading || !token || !selectedSize}
                className={`h-14 rounded-lg font-semibold tracking-tight transition-all flex items-center justify-center gap-3 border ${
                  token && selectedSize
                    ? 'border-gray-900 bg-white text-gray-900 hover:bg-gray-50' 
                    : 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed'
                } ${isUpdating || priceLoading ? 'opacity-50' : ''}`}
              >
                <CreditCard className="w-5 h-5" />
                {token ? 'BUY NOW' : 'LOGIN TO BUY'}
              </button>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Product Info Card */}
            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
                  {design.title || design.productName}
                </h1>
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-medium tracking-tight">{design.productName}</span>
                </div>
              </div>

              {/* Color Display */}
              {design.productColor && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 tracking-tight">PRODUCT COLOR</span>
                    <Palette className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg border border-gray-300 shadow-sm"
                      style={{ backgroundColor: design.productColor }}
                    />
                    <span className="text-gray-900 font-medium tracking-tight">
                      {design.productColorName || design.productColor}
                    </span>
                  </div>
                </div>
              )}

              {/* Size Selector */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 tracking-tight">SELECT SIZE</span>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-400" />
                    {priceLoading && selectedSize && (
                      <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
                    )}
                  </div>
                </div>

<div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 tracking-tight">Description</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 tracking-tight">{design.description}</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {SIZES.map((s) => {
                    const active = selectedSize === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSizeSelect(s)}
                        disabled={priceLoading}
                        className={`py-3 rounded-lg border text-sm font-medium tracking-tight transition-all ${
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        } ${priceLoading ? 'opacity-50' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>

                {!selectedSize && (
                  <p className="text-xs text-gray-500 mt-3 font-medium tracking-tight">
                    ⚠ Please select a size to continue
                  </p>
                )}
              </div>

              {/* Price Display */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 tracking-tight">PRICE</span>
                  <div className="flex items-center gap-2">
                    {selectedSize && (
                      <span className="text-xs text-gray-600 tracking-tight">SIZE: {selectedSize}</span>
                    )}
                    <Tag className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                
                {/* Price warning for local calculation */}
                {isLocalPrice && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-yellow-800 tracking-tight">
                          Using estimated price. Live price calculation temporarily unavailable.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-gray-900 tracking-tight">
                    ₹{currentPrice}
                    {priceLoading && selectedSize && (
                      <span className="text-sm font-normal text-gray-500 ml-2">(loading...)</span>
                    )}
                  </span>
                  {design.product?.basePrice && currentPrice < design.product.basePrice && (
                    <span className="text-gray-400 line-through text-sm">₹{design.product.basePrice}</span>
                  )}
                </div>
                
                {/* Price Breakdown (if available from API or local calculation) */}
                {(priceDetails?.priceBreakdown || priceDetails?.calculatedPrice > 0) && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600 tracking-tight">
                        Price breakdown for {selectedSize}:
                        {isLocalPrice && (
                          <span className="text-yellow-600 ml-1">(estimated)</span>
                        )}
                      </p>
                      {!isLocalPrice && priceDetails?.size === selectedSize && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600 tracking-tight">Live price</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Price:</span>
                        <span className="font-medium">₹{priceDetails.basePrice || design.salePrice || 0}</span>
                      </div>
                      {priceDetails.additionalCharges > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Size Adjustment:</span>
                          <span className="font-medium">+₹{priceDetails.additionalCharges}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-300 pt-1">
                        <span className="text-gray-900 font-semibold">Total:</span>
                        <span className="font-bold">₹{currentPrice}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2 tracking-tight">Inclusive of all taxes</p>
                <h2 class="bg-red-50 text-red-700 border-l-4 border-red-600 
                          p-4 rounded-md font-semibold text-lg my-4">
                  Customized Products Are Not Eligible for Return
                </h2>

                {/* Cart Summary */}
                {isInCart && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-900 font-medium tracking-tight">
                      <span className="font-bold">{quantity} item(s)</span> in cart • 
                      Size: <span className="font-bold">{selectedSize}</span> • 
                      Total: <span className="font-bold">₹{(quantity * currentPrice).toFixed(2)}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Design Stats */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-700 tracking-tight mb-4">DESIGN METRICS</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Type className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.totalTextLayers}</p>
                    <p className="text-xs text-gray-500 tracking-tight">TEXT</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ImageIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.totalImageLayers}</p>
                    <p className="text-xs text-gray-500 tracking-tight">LAYERS</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Eye className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.totalViews}</p>
                    <p className="text-xs text-gray-500 tracking-tight">VIEWS</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Card */}
            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <h4 className="text-sm font-medium text-gray-700 tracking-tight mb-4">KEY FEATURES</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900 tracking-tight">300 DPI Resolution</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900 tracking-tight">Vector & Raster Files</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900 tracking-tight">CMYK Print Ready</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900 tracking-tight">Commercial License</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8">
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Tabs Header */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('specifications')}
                  className={`px-8 py-4 text-sm font-medium tracking-tight border-b-2 transition-colors ${
                    activeTab === 'specifications' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  SPECIFICATIONS
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-8 py-4 text-sm font-medium tracking-tight border-b-2 transition-colors ${
                    activeTab === 'details' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  DESIGN DETAILS
                </button>
                <button
                  onClick={() => setActiveTab('shipping')}
                  className={`px-8 py-4 text-sm font-medium tracking-tight border-b-2 transition-colors ${
                    activeTab === 'shipping' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  SHIPPING & RETURNS
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {activeTab === 'specifications' && (
                <div className="space-y-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">TECHNICAL SPECIFICATIONS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">PRODUCT CATEGORY</p>
                          <p className="font-medium text-gray-900">{design.productName || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">DESIGN TYPE</p>
                          <p className="font-medium text-gray-900">{design.kind || 'Custom Design'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">COLOR MODE</p>
                          <p className="font-medium text-gray-900">CMYK & RGB</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">FILE FORMATS</p>
                          <p className="font-medium text-gray-900">AI, EPS, PDF, PNG, JPG</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">RESOLUTION</p>
                          <p className="font-medium text-gray-900">300 DPI (Print Ready)</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 tracking-tight mb-1">EDITABLE</p>
                          <p className="font-medium text-gray-900">Yes (Vector Files)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">QUALITY ASSURANCE</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Professional Review</p>
                          <p className="text-sm text-gray-600">All designs undergo expert quality control</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                        <Zap className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Instant Delivery</p>
                          <p className="text-sm text-gray-600">Access files immediately after purchase</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">DESIGN ARCHITECTURE</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Type className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{stats.totalTextLayers}</p>
                            <p className="text-xs text-gray-500 tracking-tight">TEXT LAYERS</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">Custom typography and text elements</p>
                      </div>
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{stats.totalImageLayers}</p>
                            <p className="text-xs text-gray-500 tracking-tight">IMAGE LAYERS</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">High-quality graphics and illustrations</p>
                      </div>
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Grid3x3 className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{stats.totalViews}</p>
                            <p className="text-xs text-gray-500 tracking-tight">PERSPECTIVES</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">Multiple viewing angles and variations</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">INCLUDED ASSETS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        "Vector files (AI, EPS)",
                        "High-resolution PNG",
                        "Print-ready PDF",
                        "Source PSD files",
                        "Color palettes",
                        "Font files"
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-900 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">DIGITAL DELIVERY</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <Download className="w-5 h-5 text-gray-900" />
                          <h5 className="font-medium text-gray-900">Instant Access</h5>
                        </div>
                        <p className="text-sm text-gray-600">Download immediately after purchase via your account dashboard.</p>
                      </div>
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <Clock className="w-5 h-5 text-gray-900" />
                          <h5 className="font-medium text-gray-900">24/7 Availability</h5>
                        </div>
                        <p className="text-sm text-gray-600">Files are accessible anytime from your secure account.</p>
                      </div>
                      <div className="p-6 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <Shield className="w-5 h-5 text-gray-900" />
                          <h5 className="font-medium text-gray-900">Secure Storage</h5>
                        </div>
                        <p className="text-sm text-gray-600">All files are securely stored for 12 months after purchase.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight mb-6">REFUND POLICY</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">7</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 mb-1">7-Day Satisfaction Guarantee</p>
                            <p className="text-sm text-gray-600">Full refund available within 7 days if unsatisfied with the design quality.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0">
                            <RefreshCw className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 mb-1">Easy Refund Process</p>
                            <p className="text-sm text-gray-600">Refunds processed within 3 business days via original payment method.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageCircle className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 mb-1">Modification Support</p>
                            <p className="text-sm text-gray-600">Free minor modifications available upon request within 14 days.</p>
                          </div>
                        </div>
                      </div>
                    </div>
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