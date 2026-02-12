// src/pages/AdminDesignsPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import {
  addToCart,
  selectCartItems,
  selectCartLoading,
  selectCartSuccess,
  selectCartError,
  clearError,
  clearSuccess,
  getCart,
} from "../redux/slices/Cartslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

export default function Usersaveddesigns() {
  const [designs, setDesigns] = useState([]);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    imageUrl: "",
    altText: "",
    title: ""
  });
  
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    previews: true,
    layers: true
  });
  const [expandedViews, setExpandedViews] = useState({});
  
  // Redux state
  const token = useSelector(selectCurrentToken);
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartSuccess = useSelector(selectCartSuccess);
  const cartError = useSelector(selectCartError);
  const dispatch = useDispatch();
  
  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  
  // Cart operation state
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const navigate = useNavigate();

  // Check mobile/tablet view on mount and resize
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      if (width < 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

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

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsMenu && !event.target.closest('.actions-menu')) {
        setShowActionsMenu(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showActionsMenu]);

  // ---------- FETCH ALL DESIGNS ----------
  useEffect(() => {
    const fetchDesigns = async () => {
      try {
        setLoadingList(true);
        setError("");

        const res = await fetch(`${API_URL}/savedata`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch designs");
        }

        setDesigns(data || []);
        if (data && data.length > 0) {
          setSelectedDesignId(data[0]._id);
        }
      } catch (err) {
        console.error("Admin fetch designs error:", err);
        setError(err.message || "Failed to fetch designs");
      } finally {
        setLoadingList(false);
      }
    };

    if (token) {
      fetchDesigns();
    }
  }, [token]);

  // ---------- FETCH SINGLE DESIGN DETAIL WHEN SELECTED ----------
  useEffect(() => {
    if (!selectedDesignId) {
      setSelectedDesign(null);
      return;
    }

    const fetchDesign = async () => {
      try {
        setLoadingDetail(true);
        setError("");

        const res = await fetch(`${API_URL}/savedata/${selectedDesignId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch design");
        }

        setSelectedDesign(data);
      } catch (err) {
        console.error("Admin fetch design detail error:", err);
        setError(err.message || "Failed to fetch design");
      } finally {
        setLoadingDetail(false);
      }
    };

    if (token) {
      fetchDesign();
    }
  }, [selectedDesignId, token]);

  // ---------- ADD TO CART FUNCTION ----------
  const handleAddToCart = async (design) => {
    if (!token) {
      setNotification({
        show: true,
        message: 'Please login to add designs to cart',
        type: 'warning'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: '/admin/designs' } });
      }, 1500);
      return;
    }

    try {
      setAddingToCartId(design._id);
      
      const cartData = {
        kind: "DESIGN",
        qty: 1,
        designId: design._id
      };

      console.log('Adding design to cart:', cartData);
      await dispatch(addToCart(cartData)).unwrap();
      
      // Refresh cart to get updated data
      await dispatch(getCart());
      
    } catch (error) {
      console.error('Add design to cart failed:', error);
      
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
          message: error.message || 'Failed to add design to cart',
          type: 'error'
        });
      }
    } finally {
      setAddingToCartId(null);
    }
  };

  // ---------- EDIT FUNCTION ----------
  const handleEditDesign = (design) => {
    navigate(`/products/${design.productSlug}/customize?edit=${design._id}`);
  };

  // ---------- DELETE FUNCTION ----------
  const handleDeleteDesign = async (designId, designName) => {
    if (!window.confirm(`Are you sure you want to delete "${designName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(designId);
      setDeleteError("");

      const res = await fetch(`${API_URL}/savedata/${designId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete design");
      }

      // Remove from local state
      setDesigns(prev => prev.filter(d => d._id !== designId));
      
      if (selectedDesignId === designId) {
        setSelectedDesignId(null);
        setSelectedDesign(null);
      }

      setNotification({
        show: true,
        message: 'Design deleted successfully!',
        type: 'success'
      });
    } catch (err) {
      console.error("Delete design error:", err);
      setDeleteError(err.message || "Failed to delete design");
      setNotification({
        show: true,
        message: err.message || 'Failed to delete design',
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- IMAGE MODAL HANDLERS ----------
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

  // Handle clicking outside the modal to close
  const handleModalBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeImageModal();
    }
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

  // Check if design is in cart
  const isDesignInCart = (designId) => {
    return cartItems.some(item => 
      item.kind === "DESIGN" && 
      item.design?._id === designId
    );
  };

  // Get design quantity in cart
  const getDesignCartQuantity = (designId) => {
    const item = cartItems.find(item => 
      item.kind === "DESIGN" && 
      item.design?._id === designId
    );
    return item ? item.qty : 0;
  };

  // ---------- RENDER HELPERS ----------
  const formatDateTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return isMobile 
      ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : d.toLocaleString();
  };

  const handleSelectDesign = (id) => {
    setSelectedDesignId(id);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  // Toggle view expansion
  const toggleView = (viewCode) => {
    setExpandedViews(prev => ({
      ...prev,
      [viewCode]: !prev[viewCode]
    }));
  };

  // Mobile Actions Menu Component
  const MobileActionsMenu = ({ design }) => {
    const isInCart = isDesignInCart(design._id);
    const cartQuantity = getDesignCartQuantity(design._id);
    
    return (
      <div className="actions-menu absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[200px] overflow-hidden">
        <div className="py-1">
          <button
            onClick={() => {
              handleEditDesign(design);
              setShowActionsMenu(null);
            }}
            className="w-full text-left px-4 py-3 text-sm text-sky-700 hover:bg-sky-50 flex items-center gap-3 border-b border-slate-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Design
          </button>
          
          <Link 
            to={`/catalogue/${design._id}`}
            className="block w-full text-left px-4 py-3 text-sm text-sky-700 hover:bg-sky-50 flex items-center gap-3 border-b border-slate-100"
            onClick={() => setShowActionsMenu(null)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </Link>
          
          <button
            onClick={() => {
              handleDeleteDesign(design._id, design.productName || "Untitled");
              setShowActionsMenu(null);
            }}
            disabled={deletingId === design._id}
            className="w-full text-left px-4 py-3 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-3 disabled:opacity-50"
          >
            {deletingId === design._id ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Design
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Bottom Action Bar for Mobile
  const MobileBottomActionBar = ({ design }) => {
    if (!design || !isMobile) return null;
    
    const isInCart = isDesignInCart(design._id);
    const cartQuantity = getDesignCartQuantity(design._id);
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-40 shadow-lg">
        <div className="flex gap-2">
          <Link
            to={`/catalogue/${design._id}`}
            className="flex-1 px-3 py-3 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>View</span>
          </Link>
          <button
            onClick={() => handleEditDesign(design)}
            className="flex-1 px-3 py-3 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit</span>
          </button>
          <button
            onClick={() => handleDeleteDesign(design._id, design.productName || "Untitled")}
            disabled={deletingId === design._id}
            className="flex-1 px-3 py-3 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {deletingId === design._id ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-100 text-slate-900">
      {/* Notification Toast - Mobile Optimized */}
      {notification.show && (
        <div className={`fixed z-50 animate-fade-in-down ${
          isMobile ? 'top-2 left-2 right-2' : 'top-4 right-4'
        }`}>
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
              <button
                onClick={() => setNotification({ show: false, message: '', type: '' })}
                className="ml-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar - Mobile Optimized */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="text-lg font-extrabold tracking-wide text-orange-500">
              MYPRINT
            </div>
          </Link>
          {isMobile && (
            <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
              Designs
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="text-sky-700 hover:bg-sky-50 p-2 rounded-lg transition-colors"
            aria-label="Back to Designer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
            {!isMobile && <span className="ml-1">Back to Designer</span>}
          </Link>
          <Link 
            to="/cart" 
            className="text-sky-700 hover:bg-sky-50 p-2 rounded-lg transition-colors flex items-center relative"
            aria-label="View Cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {!isMobile && <span className="ml-1">Cart</span>}
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {cartItems.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile Header Toggle - Improved */}
      {isMobile && (
        <div className="sticky top-14 z-30 bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shadow-sm">
          <button
            onClick={() => setShowSidebar(true)}
            className="flex items-center gap-2 text-sm text-sky-700 bg-sky-50 px-3 py-2 rounded-lg hover:bg-sky-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Browse Designs ({designs.length})
          </button>
          
          {selectedDesign && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-600 truncate max-w-[150px]">
                <span className="font-medium">{selectedDesign.productName || "Selected Design"}</span>
              </div>
              <div
                className="h-6 w-6 rounded border border-slate-200 shrink-0"
                style={{ backgroundColor: selectedDesign.productColor || "#fff" }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* LEFT: Designs list - Mobile Optimized Sidebar */}
        {showSidebar && (
          <>
            {isMobile && (
              <div 
                className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
                onClick={() => setShowSidebar(false)}
              />
            )}
            <aside className={`
              ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-[90vw] max-w-sm animate-slide-right' : 'w-80 lg:w-96'} 
              border-r border-slate-200 bg-white flex flex-col shadow-xl
            `}>
              <div className="border-b border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      Saved Designs
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {designs.length} {designs.length === 1 ? 'design' : 'designs'} available
                    </p>
                  </div>
                  {isMobile && (
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      aria-label="Close sidebar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {loadingList ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center">
                    <svg className="animate-spin h-10 w-10 text-sky-600 mx-auto mb-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-slate-500">Loading designs...</p>
                  </div>
                </div>
              ) : designs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-base font-medium text-slate-700 mb-2">No designs saved yet</p>
                    <p className="text-sm text-slate-500 mb-4">Create your first custom design</p>
                    <Link 
                      to="/" 
                      className="inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"
                    >
                      Create New Design
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <ul className="divide-y divide-slate-100">
                    {designs.map((d) => {
                      const isActive = d._id === selectedDesignId;
                      
                      return (
                        <li
                          key={d._id}
                          className={`
                            ${isActive ? "bg-sky-50 border-l-4 border-sky-500" : "hover:bg-slate-50 border-l-4 border-transparent"}
                            transition-colors
                          `}
                        >
                          <div className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {/* Color indicator */}
                              <div
                                className="h-12 w-12 rounded-lg border-2 border-slate-200 shrink-0"
                                style={{ backgroundColor: d.productColor || "#fff" }}
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => handleSelectDesign(d._id)}
                                >
                                  <h3 className="font-medium text-slate-800 truncate text-base mb-1">
                                    {d.productName || "Untitled Design"}
                                  </h3>
                                  <p className="text-xs text-slate-500 truncate mb-1">
                                    {d.productSlug || "No slug"}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {formatDateTime(d.createdAt)}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Mobile Actions Menu Trigger */}
                              {isMobile ? (
                                <div className="relative actions-menu">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowActionsMenu(showActionsMenu === d._id ? null : d._id);
                                    }}
                                    className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                  </button>
                                  {showActionsMenu === d._id && (
                                    <MobileActionsMenu design={d} />
                                  )}
                                </div>
                              ) : (
                                /* Desktop Actions */
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditDesign(d)}
                                    className="p-1.5 text-sky-700 hover:bg-sky-50 rounded transition-colors"
                                    title="Edit design"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <Link
                                    to={`/catalogue/${d._id}`}
                                    className="p-1.5 text-sky-700 hover:bg-sky-50 rounded transition-colors"
                                    title="View details"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteDesign(d._id, d.productName || "Untitled")}
                                    disabled={deletingId === d._id}
                                    className="p-1.5 text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                    title="Delete design"
                                  >
                                    {deletingId === d._id ? (
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {error && (
                <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </aside>
          </>
        )}

        {/* RIGHT: Selected design details - Mobile Optimized */}
        <main className={`flex-1 min-w-0 p-4 pb-24 lg:pb-4 overflow-auto ${!showSidebar && isMobile ? 'w-full' : ''}`}>
          {!selectedDesign ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-md mx-auto p-6">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-slate-700 mb-2">No Design Selected</p>
                <p className="text-sm text-slate-500 mb-6">
                  {isMobile ? 'Tap on "Browse Designs" to view your saved designs' : 'Select a design from the list to view details'}
                </p>
                {isMobile && !showSidebar && (
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-base font-medium w-full sm:w-auto"
                  >
                    Browse Designs
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-6xl mx-auto">
              {/* Header Card - Mobile Optimized */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  {/* Title and Actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate mb-1">
                        {selectedDesign.productName || "Untitled design"}
                      </h1>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="bg-slate-100 px-2 py-1 rounded">
                          {selectedDesign.productSlug || "no-slug"}
                        </span>
                        <span>•</span>
                        <span>{formatDateTime(selectedDesign.createdAt)}</span>
                      </div>
                    </div>
                    
                    {/* Color swatch - Mobile */}
                    <div className="flex flex-col items-end gap-2">
                      <div
                        className="h-10 w-10 rounded-lg border-2 border-slate-200"
                        style={{ backgroundColor: selectedDesign.productColor || "#fff" }}
                      />
                      <span className="text-xs text-slate-500">Color</span>
                    </div>
                  </div>

                  {/* Preview Image */}
                  {selectedDesign.previewImage && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Main Preview
                      </div>
                      <div 
                        className="relative aspect-video w-full bg-slate-100 rounded-lg overflow-hidden cursor-pointer border border-slate-200 hover:border-sky-400 transition-colors"
                        onClick={() => openImageModal(
                          selectedDesign.previewImage,
                          "Main preview",
                          selectedDesign.productName || "Untitled design"
                        )}
                      >
                        <img
                          src={selectedDesign.previewImage}
                          alt="Main preview"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium">
                            View Full Size
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* View Previews Section - Collapsible on Mobile */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, previews: !prev.previews }))}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    View Previews ({selectedDesign.views?.length || 0})
                  </h2>
                  <svg
                    className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${
                      expandedSections.previews ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedSections.previews && (
                  <>
                    {(!selectedDesign.views || selectedDesign.views.length === 0) ? (
                      <div className="text-sm text-slate-500 text-center py-6 mt-2">
                        No view configuration stored for this design.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                        {selectedDesign.views.map((v) => (
                          <div
                            key={v.code}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2"
                          >
                            <div className="text-sm font-medium text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                              {v.code?.toUpperCase() || "VIEW"}
                            </div>
                            {v.previewImage ? (
                              <div 
                                className="cursor-pointer hover:opacity-90 transition-opacity w-full"
                                onClick={() => openImageModal(
                                  v.previewImage,
                                  `${v.code} preview`,
                                  `${selectedDesign.productName || "Design"} - ${v.code} view`
                                )}
                              >
                                <div className="relative aspect-square w-full rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <img
                                    src={v.previewImage}
                                    alt={`${v.code} preview`}
                                    className="w-full h-full object-contain p-2"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                                No preview
                              </div>
                            )}
                            <div className="text-xs text-slate-500 text-center mt-1">
                              <span className="bg-slate-100 px-2 py-1 rounded">
                                Text: {v.textLayers?.length || 0}
                              </span>
                              <span className="ml-2 bg-slate-100 px-2 py-1 rounded">
                                Images: {v.designLayers?.length || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Layers Detail Section - Collapsible on Mobile */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, layers: !prev.layers }))}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Layers Detail
                  </h2>
                  <svg
                    className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${
                      expandedSections.layers ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedSections.layers && (
                  <>
                    {(!selectedDesign.views || selectedDesign.views.length === 0) ? (
                      <div className="text-sm text-slate-500 text-center py-6 mt-2">
                        No view/layer data available.
                      </div>
                    ) : (
                      <div className="space-y-4 mt-4">
                        {selectedDesign.views.map((v) => (
                          <div
                            key={v.code}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            {/* View Header - Toggle for mobile */}
                            <button
                              onClick={() => toggleView(v.code)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <div className="text-sm font-semibold text-slate-800">
                                  View: {v.code || "(no code)"}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                  <span className="bg-white px-2 py-1 rounded border border-slate-200">
                                    📝 {v.textLayers?.length || 0}
                                  </span>
                                  <span className="bg-white px-2 py-1 rounded border border-slate-200">
                                    🖼️ {v.designLayers?.length || 0}
                                  </span>
                                </div>
                              </div>
                              <svg
                                className={`w-5 h-5 text-slate-600 sm:hidden transition-transform duration-200 ${
                                  expandedViews[v.code] ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Content - Hidden on mobile when collapsed */}
                            <div className={`${isMobile && !expandedViews[v.code] ? 'hidden' : 'block'} mt-3`}>
                              {/* Text layers */}
                              <div className="mb-4">
                                <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                  <span>📝 Text Layers</span>
                                  <span className="bg-slate-200 text-xs px-2 py-0.5 rounded-full">
                                    {v.textLayers?.length || 0}
                                  </span>
                                </div>
                                {v.textLayers && v.textLayers.length > 0 ? (
                                  <div className="space-y-2">
                                    {v.textLayers.map((t) => (
                                      <div
                                        key={t.id}
                                        className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                                      >
                                        <div className="flex flex-wrap items-start gap-2 mb-2">
                                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                            {t.id}
                                          </span>
                                          <span className="font-medium text-slate-800 flex-1 break-words">
                                            "{t.text}"
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-xs text-slate-600">
                                          <span className="bg-slate-50 px-2 py-1 rounded">
                                            📍 {t.x?.toFixed?.(2) ?? t.x}, {t.y?.toFixed?.(2) ?? t.y}
                                          </span>
                                          <span className="bg-slate-50 px-2 py-1 rounded">
                                            📏 {t.fontSize}px
                                          </span>
                                          <span className="bg-slate-50 px-2 py-1 rounded">
                                            🔄 {t.rotation ?? 0}°
                                          </span>
                                          <span className="bg-slate-50 px-2 py-1 rounded flex items-center gap-1">
                                            🎨{" "}
                                            <span
                                              className="inline-block h-4 w-4 rounded border border-slate-300"
                                              style={{ backgroundColor: t.color }}
                                            />
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">
                                    No text layers
                                  </div>
                                )}
                              </div>

                              {/* Design/image layers */}
                              <div>
                                <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                  <span>🖼️ Design / Image Layers</span>
                                  <span className="bg-slate-200 text-xs px-2 py-0.5 rounded-full">
                                    {v.designLayers?.length || 0}
                                  </span>
                                </div>
                                {v.designLayers && v.designLayers.length > 0 ? (
                                  <div className="space-y-3">
                                    {v.designLayers.map((d, idx) => (
                                      <div
                                        key={d.id || idx}
                                        className="rounded-lg border border-slate-200 bg-white p-3"
                                      >
                                        <div className="flex flex-col sm:flex-row gap-3">
                                          {d.imageUrl ? (
                                            <div 
                                              className="h-24 w-full sm:w-24 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-sky-400 transition-colors overflow-hidden"
                                              onClick={() => openImageModal(
                                                d.imageUrl,
                                                `Design layer ${d.id || idx}`,
                                                `Zone: ${d.zone || "N/A"} | Scale: ${d.scale}`
                                              )}
                                            >
                                              <img
                                                src={d.imageUrl}
                                                alt="design layer"
                                                className="max-h-full max-w-full object-contain"
                                              />
                                            </div>
                                          ) : (
                                            <div className="h-24 w-full sm:w-24 shrink-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                                              no image
                                            </div>
                                          )}

                                          <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                {d.id || `layer-${idx}`}
                                              </span>
                                              {d.zone && (
                                                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-700 border border-sky-100">
                                                  zone: {d.zone}
                                                </span>
                                              )}
                                              <span className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-600 border border-slate-200">
                                                scale: {d.scale}
                                              </span>
                                              <span className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-600 border border-slate-200">
                                                rot: {d.rotation ?? 0}°
                                              </span>
                                            </div>
                                            <div className="text-xs text-slate-500 space-y-1">
                                              <div className="bg-slate-50 p-2 rounded">
                                                <span className="font-medium">Position:</span>{" "}
                                                <span className="font-mono">
                                                  ({d.x?.toFixed?.(2) ?? d.x}, {d.y?.toFixed?.(2) ?? d.y})
                                                </span>
                                              </div>
                                              <div className="flex flex-wrap gap-2">
                                                <span className="flex items-center gap-1">
                                                  <span className={`inline-block w-2 h-2 rounded-full ${d.hasBgRemoved ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                  BG removed: {d.hasBgRemoved ? "Yes" : "No"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                  <span className={`inline-block w-2 h-2 rounded-full ${d.insideSafeArea === false ? 'bg-rose-500' : 'bg-green-500'}`} />
                                                  Safe area: {d.insideSafeArea === false ? "No" : "Yes"}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">
                                    No design/image layers
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Action Bar */}
      {selectedDesign && <MobileBottomActionBar design={selectedDesign} />}

      {/* IMAGE MODAL - Fully Responsive */}
      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
          onClick={handleModalBackdropClick}
        >
          <div className="relative w-full max-w-6xl max-h-[95vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal header - Mobile Optimized */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-slate-800 truncate pr-2">
                  {imageModal.title}
                </h3>
                {imageModal.altText && (
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {imageModal.altText}
                  </p>
                )}
              </div>
              <button
                onClick={closeImageModal}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-200 w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal content - Image with pinch zoom support */}
            <div className="flex-1 flex items-center justify-center p-2 sm:p-4 bg-slate-100 overflow-auto">
              <div className="relative max-w-full max-h-full">
                <img
                  src={imageModal.imageUrl}
                  alt={imageModal.altText}
                  className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain rounded-lg border border-slate-200 bg-white shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Modal footer - Mobile Optimized */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-slate-500 text-center sm:text-left">
                  {isMobile ? 'Tap outside to close' : 'Click outside or press ESC to close'}
                </p>
                {isMobile && (
                  <button
                    onClick={closeImageModal}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add padding at bottom for mobile to account for bottom action bar */}
      {isMobile && selectedDesign && <div className="h-24" />}
    </div>
  );
}