// src/pages/Designdetailspage.jsx
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
  ThumbsUp,
  Edit,
  Trash2,
  Printer,
  Grid,
  Maximize2,
  ZoomIn,
  Save,
  Upload,
  ExternalLink,
  FileText
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
  clearSuccess,
  getCart
} from "../redux/slices/Cartslice.js";

// Import user selector for login check
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

export default function Designdetailspage() {
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
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to add designs to cart',
        type: 'warning'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: `/admin/designs/${id}` } });
      }, 1500);
      return;
    }

    if (!design) return;

    try {
      // Optimistic update
      setLocalCartQuantity(1);

      const cartData = {
        kind: "DESIGN",
        qty: 1,
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
      
      // Handle 401 errors
      if (error.status === 401) {
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

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <Sparkles className="w-8 h-8 text-blue-500 animate-pulse absolute -top-2 -right-2" />
        </div>
        <p className="mt-6 text-gray-700 font-medium">Loading design details...</p>
        <p className="text-sm text-gray-400 mt-1">Fetching your saved design</p>
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
            onClick={() => navigate("/admin/designs")}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
          >
            Browse Designs
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

  const formatDateTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleString();
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
              onClick={() => navigate("/admin/designs")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">Back to Designs</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Admin View
              </div>
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
              <Link to="/admin" className="text-gray-600 hover:text-blue-600">
                Admin
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                <Link 
                  to="/admin/designs" 
                  className="text-gray-600 hover:text-blue-600 ml-1"
                >
                  Designs
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                <span className="text-gray-400 ml-1 truncate max-w-xs">
                  {design.productName || "Untitled Design"}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500 font-mono">ID: {design._id.slice(-8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      Updated: {formatDateTime(design.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Main Image */}
                <div className="relative h-[500px] bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden">
                  {design.previewImage ? (
                    <div className="relative w-full h-full">
                      <img
                        src={design.previewImage}
                        alt={design.productName}
                        className="w-full h-full object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => openImageModal(
                          design.previewImage,
                          "Main preview",
                          design.productName
                        )}
                      />
                      <button
                        onClick={() => openImageModal(
                          design.previewImage,
                          "Main preview",
                          design.productName
                        )}
                        className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
                      >
                        <Maximize2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  ) : views[activeView]?.previewImage ? (
                    <div className="relative w-full h-full">
                      <img
                        src={views[activeView].previewImage}
                        alt={views[activeView].code}
                        className="w-full h-full object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => openImageModal(
                          views[activeView].previewImage,
                          `${views[activeView].code} preview`,
                          design.productName
                        )}
                      />
                      <button
                        onClick={() => openImageModal(
                          views[activeView].previewImage,
                          `${views[activeView].code} preview`,
                          design.productName
                        )}
                        className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
                      >
                        <Maximize2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No preview available</p>
                        <p className="text-sm text-gray-300 mt-1">Add preview in editor</p>
                      </div>
                    </div>
                  )}

                  {/* Navigation Arrows for Views */}
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
                {views.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        Design Views ({views.length})
                      </p>
                      <span className="text-xs text-gray-500">
                        {activeView + 1} of {views.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {views.map((view, index) => (
                        <button
                          key={view.code}
                          onClick={() => setActiveView(index)}
                          className={`relative rounded-lg border overflow-hidden transition-all group ${
                            activeView === index 
                              ? 'ring-2 ring-blue-500 ring-offset-2 border-blue-500' 
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
                                <Eye className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className={`absolute bottom-1 left-1 right-1 px-2 py-1 rounded truncate text-xs font-medium ${
                            activeView === index 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-black/70 text-white'
                          }`}>
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {isInCart ? (
                <div className="col-span-2 flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  } ${isUpdating ? 'opacity-50' : ''}`}
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                  {token ? 'Add to Cart' : 'Login to Cart'}
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

              <button
                onClick={handleEditDesign}
                className="h-14 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-3"
              >
                <Edit className="w-5 h-5" />
                Edit Design
              </button>

              <button
                onClick={handleDeleteDesign}
                disabled={deleting}
                className="h-14 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Design Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {design.productName || "Untitled Design"}
                  </h1>
                  {isInCart && (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      In Cart ({quantity})
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-gray-500 mb-4">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">{design.productSlug || "No product slug"}</span>
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
                      <div>
                        <span className="text-gray-600">{design.productColor}</span>
                        <p className="text-xs text-gray-400 mt-1">Click to copy</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Design Stats */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Design Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Type className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-600">Text Layers</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{stats.totalTextLayers}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-gray-600">Image Layers</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{stats.totalImageLayers}</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Total Views</div>
                        <div className="text-xl font-bold text-gray-900">{stats.totalViews}</div>
                      </div>
                      <Layers className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-6 border-t border-gray-100">
                <h3 className="font-semibold text-gray-700 mb-4">Design Metadata</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="font-medium text-sm">{formatDateTime(design.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Updated</span>
                    <span className="font-medium text-sm">{formatDateTime(design.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Design ID</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {design._id.slice(-12)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {/* <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => window.print()}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-3"
                >
                  <Printer className="w-5 h-5" />
                  Print Details
                </button>
                <button
                  onClick={() => {
                    // Export design data
                    const dataStr = JSON.stringify(design, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${design.productName || 'design'}.json`;
                    link.click();
                  }}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-3"
                >
                  <Download className="w-5 h-5" />
                  Export JSON
                </button>
                <button
                  onClick={() => navigate(`/admin/designs`)}
                  className="w-full py-3 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-3"
                >
                  <Grid className="w-5 h-5" />
                  View All Designs
                </button>
              </div>
            </div> */}

            {/* Cart Summary */}
            {/* {isInCart && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Cart Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Quantity</span>
                    <span className="font-semibold">{quantity} items</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Unit Price</span>
                    <span className="font-semibold">₹{(design.salePrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="text-xl font-bold text-gray-900">
                        ₹{(quantity * (design.salePrice || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/cart')}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all"
                  >
                    View Cart & Checkout
                  </button>
                </div>
              </div>
            )} */}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'overview' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Overview
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'layers' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Layer Details
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('technical')}
                  className={`px-6 py-4 text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'technical' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Technical Specs
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Basic Information</h4>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Product Name</p>
                          <p className="font-medium">{design.productName || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Product Slug</p>
                          <p className="font-medium font-mono">{design.productSlug || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Design Type</p>
                          <p className="font-medium">Custom Design</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Saved
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Design Summary */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Design Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Type className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalTextLayers}</p>
                            <p className="text-sm text-gray-600">Text Layers</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalImageLayers}</p>
                            <p className="text-sm text-gray-600">Image Layers</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Eye className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalViews}</p>
                            <p className="text-sm text-gray-600">Design Views</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'layers' && (
                <div className="space-y-6">
                  {/* Views Detail */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Views & Layers</h4>
                    {views.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No view configuration stored for this design.</p>
                        <p className="text-sm text-gray-400 mt-1">Edit the design to add views.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {views.map((view, viewIndex) => (
                          <div key={view.code || viewIndex} className="bg-gray-50 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h5 className="font-semibold text-gray-900">
                                  View: {view.code?.toUpperCase() || `View ${viewIndex + 1}`}
                                </h5>
                                <p className="text-sm text-gray-500">
                                  {view.textLayers?.length || 0} text layers • {view.designLayers?.length || 0} image layers
                                </p>
                              </div>
                              {view.previewImage && (
                                <button
                                  onClick={() => openImageModal(
                                    view.previewImage,
                                    `${view.code} preview`,
                                    `${design.productName} - ${view.code} view`
                                  )}
                                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="text-sm">View Full Size</span>
                                </button>
                              )}
                            </div>

                            {/* Text Layers */}
                            {view.textLayers && view.textLayers.length > 0 && (
                              <div className="mb-6">
                                <h6 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Type className="w-4 h-4" />
                                  Text Layers ({view.textLayers.length})
                                </h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {view.textLayers.map((layer, idx) => (
                                    <div key={layer.id || idx} className="bg-white rounded-lg border border-gray-200 p-4">
                                      <div className="flex items-start justify-between mb-2">
                                        <span className="font-mono text-xs text-gray-500">ID: {layer.id || idx}</span>
                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                          {layer.fontSize}px
                                        </span>
                                      </div>
                                      <p className="font-medium text-gray-900 mb-2">"{layer.text}"</p>
                                      <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Position: ({layer.x}, {layer.y})</span>
                                        <span>Rotation: {layer.rotation || 0}°</span>
                                        <span className="flex items-center gap-1">
                                          Color: 
                                          <span 
                                            className="inline-block w-3 h-3 rounded-full border border-gray-200"
                                            style={{ backgroundColor: layer.color }}
                                          />
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Image Layers */}
                            {view.designLayers && view.designLayers.length > 0 && (
                              <div>
                                <h6 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <ImageIcon className="w-4 h-4" />
                                  Image Layers ({view.designLayers.length})
                                </h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {view.designLayers.map((layer, idx) => (
                                    <div key={layer.id || idx} className="bg-white rounded-lg border border-gray-200 p-4">
                                      <div className="flex gap-4">
                                        {layer.imageUrl && (
                                          <div className="flex-shrink-0">
                                            <div 
                                              className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-colors"
                                              onClick={() => openImageModal(
                                                layer.imageUrl,
                                                `Layer: ${layer.id || idx}`,
                                                `Zone: ${layer.zone || 'N/A'}`
                                              )}
                                            >
                                              <img
                                                src={layer.imageUrl}
                                                alt="Design layer"
                                                className="w-full h-full object-cover"
                                              />
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1">
                                          <div className="flex items-start justify-between mb-2">
                                            <span className="font-mono text-xs text-gray-500">ID: {layer.id || idx}</span>
                                            {layer.zone && (
                                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                                Zone: {layer.zone}
                                              </span>
                                            )}
                                          </div>
                                          <div className="space-y-1 text-xs text-gray-600">
                                            <div className="flex items-center gap-4">
                                              <span>Scale: {layer.scale || 1}x</span>
                                              <span>Rotation: {layer.rotation || 0}°</span>
                                            </div>
                                            <div>Position: ({layer.x}, {layer.y})</div>
                                            <div className="flex items-center gap-4">
                                              <span>BG Removed: {layer.hasBgRemoved ? 'Yes' : 'No'}</span>
                                              <span>Safe Area: {layer.insideSafeArea === false ? 'No' : 'Yes'}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'technical' && (
                <div className="space-y-6">
                  {/* Technical Specifications */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Technical Specifications</h4>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Design ID</p>
                          <p className="font-medium font-mono">{design._id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Created At</p>
                          <p className="font-medium">{formatDateTime(design.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Last Updated</p>
                          <p className="font-medium">{formatDateTime(design.updatedAt)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Data Version</p>
                          <p className="font-medium">v1.0</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Information */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">File Information</h4>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Preview Images</p>
                          <p className="font-medium">
                            {1 + views.filter(v => v.previewImage).length} images
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Layer Support</p>
                          <p className="font-medium">Full layer preservation</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Color Format</p>
                          <p className="font-medium">RGB & CMYK support</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Vector Support</p>
                          <p className="font-medium">Editable paths</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quality Assurance */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Quality Assurance</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Layer Integrity</p>
                          <p className="text-sm text-gray-600">All layers preserved</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
                        <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Data Validation</p>
                          <p className="text-sm text-gray-600">JSON structure verified</p>
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

      {/* IMAGE MODAL */}
      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeImageModal();
          }}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  {imageModal.title}
                </h3>
                {imageModal.altText && (
                  <p className="text-xs text-gray-500 mt-1">
                    {imageModal.altText}
                  </p>
                )}
              </div>
              <button
                onClick={closeImageModal}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal content - Image */}
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-100 overflow-auto">
              <div className="relative max-w-full max-h-full">
                <img
                  src={imageModal.imageUrl}
                  alt={imageModal.altText}
                  className="max-w-full max-h-[70vh] object-contain rounded border border-gray-200 bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
              <div className="text-xs text-gray-500">
                Click outside or press ESC to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}