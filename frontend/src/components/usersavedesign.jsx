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

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

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

    // Check if design is published or owned by user
    const isOwner = design.user?.toString() === "user_id_here"; // You need to get current user ID
    const isPublic = design.isPublished === true;
    
    // if (!isOwner && !isPublic) {
    //   setNotification({
    //     show: true,
    //     message: 'This design is not available for purchase',
    //     type: 'error'
    //   });
    //   return;
    // }

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
      
      // Handle 401 errors (unauthorized) specifically
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
      
      // If the deleted design was selected, clear selection
      if (selectedDesignId === designId) {
        setSelectedDesignId(null);
        setSelectedDesign(null);
      }

      // Show success message
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
    return d.toLocaleString();
  };

  const handleSelectDesign = (id) => {
    setSelectedDesignId(id);
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-100 text-slate-900">
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

      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <div className="text-lg font-extrabold tracking-wide text-orange-500">
            MYPRINT
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link to="/" className="text-sky-700 hover:underline">
            Back to Designer
          </Link>
          <Link to="/cart" className="text-sky-700 hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            View Cart
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT: Designs list */}
        <aside className="w-96 border-r border-slate-200 bg-white flex flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Saved Designs ({designs.length})
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Click a design to view details, or use action buttons to edit/delete.
            </p>
          </div>

          {loadingList ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Loading designs…
            </div>
          ) : designs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              No designs saved yet.
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <ul className="divide-y divide-slate-100">
                {designs.map((d) => {
                  const isActive = d._id === selectedDesignId;
                  const isInCart = isDesignInCart(d._id);
                  const cartQuantity = getDesignCartQuantity(d._id);
                  
                  return (
                    <li
                      key={d._id}
                      className={`px-4 py-3 text-xs hover:bg-slate-50 ${
                        isActive ? "bg-sky-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSelectDesign(d._id)}
                        >
                          <div className="font-semibold text-slate-800 truncate">
                            {d.productName || "Untitled"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {d.productSlug || "-"}
                          </div>
                        </div>
                        <div
                          className="h-7 w-7 rounded border border-slate-200 shrink-0"
                          style={{ backgroundColor: d.productColor || "#fff" }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-[10px] text-slate-400">
                          {formatDateTime(d.createdAt)}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {/* Add to Cart Button */}
                          <button
                            onClick={() => handleAddToCart(d)}
                            disabled={addingToCartId === d._id || cartLoading}
                            className={`px-2 py-1 text-[10px] rounded transition-colors ${
                              isInCart
                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                            }`}
                            title={isInCart ? "Already in cart" : "Add to cart"}
                          >
                            {addingToCartId === d._id ? (
                              <span className="flex items-center">
                                <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Adding...
                              </span>
                            ) : isInCart ? (
                              `In Cart (${cartQuantity})`
                            ) : (
                              'Add to Cart'
                            )}
                          </button>
                          
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditDesign(d)}
                            className="px-2 py-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 rounded hover:bg-sky-100 transition-colors"
                            title="Edit this design"
                          >
                            Edit
                          </button>
                          <Link to={`/usersaveddesigns/${d._id}`}>
                            <button
                              className="px-2 py-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 rounded hover:bg-sky-100 transition-colors"
                            >
                            View Details
                          </button>
                          </Link>
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteDesign(d._id, d.productName || "Untitled")}
                            disabled={deletingId === d._id}
                            className="px-2 py-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete this design"
                          >
                            {deletingId === d._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <div className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              {error}
            </div>
          )}
          
          {deleteError && (
            <div className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              Delete error: {deleteError}
            </div>
          )}
        </aside>

        {/* RIGHT: Selected design details */}
        <main className="flex-1 min-w-0 p-4 overflow-auto">
          {!selectedDesign ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {loadingDetail ? "Loading design…" : "Select a design to view details."}
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-4">
              {/* Header with Action buttons */}
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h1 className="text-lg font-bold text-slate-900">
                        {selectedDesign.productName || "Untitled design"}
                      </h1>
                      <div className="flex gap-2">
                        {/* Add to Cart Button */}
                        <button
                          onClick={() => handleAddToCart(selectedDesign)}
                          disabled={addingToCartId === selectedDesign._id || cartLoading}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            isDesignInCart(selectedDesign._id)
                              ? 'bg-green-600 text-white border border-green-600 hover:bg-green-700'
                              : 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {addingToCartId === selectedDesign._id ? (
                            <span className="flex items-center">
                              <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Adding...
                            </span>
                          ) : isDesignInCart(selectedDesign._id) ? (
                            `Already in Cart (${getDesignCartQuantity(selectedDesign._id)})`
                          ) : (
                            'Add to Cart'
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleEditDesign(selectedDesign)}
                          className="px-3 py-1 text-xs bg-sky-600 text-white border border-sky-600 rounded hover:bg-sky-700 transition-colors"
                        >
                          Edit This Design
                        </button>
                        <button
                          onClick={() => handleDeleteDesign(selectedDesign._id, selectedDesign.productName || "Untitled")}
                          disabled={deletingId === selectedDesign._id}
                          className="px-3 py-1 text-xs bg-rose-600 text-white border border-rose-600 rounded hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === selectedDesign._id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    
                    <p className="mt-1 text-xs text-slate-500">
                      Slug:{" "}
                      <span className="font-mono">
                        {selectedDesign.productSlug || "-"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Design ID:{" "}
                      <span className="font-mono break-all">
                        {selectedDesign._id}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Created: {formatDateTime(selectedDesign.createdAt)} | Updated:{" "}
                      {formatDateTime(selectedDesign.updatedAt)}
                    </p>
                    
                  
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Product color</span>
                      <div
                        className="h-7 w-7 rounded border border-slate-300"
                        style={{
                          backgroundColor: selectedDesign.productColor || "#fff",
                        }}
                      />
                    </div>
                    {selectedDesign.previewImage && (
                      <div className="mt-2">
                        <div className="text-[11px] text-slate-500 text-right mb-1">
                          Main preview
                        </div>
                        <div 
                          className="cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openImageModal(
                            selectedDesign.previewImage,
                            "Main preview",
                            selectedDesign.productName || "Untitled design"
                          )}
                        >
                          <img
                            src={selectedDesign.previewImage}
                            alt="Main preview"
                            className="h-28 w-auto rounded border border-slate-200 bg-slate-50 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* View previews */}
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">
                  View Previews ({selectedDesign.views?.length || 0})
                </h2>
                {(!selectedDesign.views || selectedDesign.views.length === 0) ? (
                  <div className="text-xs text-slate-500">
                    No view configuration stored for this design.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedDesign.views.map((v) => (
                      <div
                        key={v.code}
                        className="rounded border border-slate-200 bg-slate-50 p-2 flex flex-col items-center gap-2"
                      >
                        <div className="text-xs font-medium text-slate-700">
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
                            <img
                              src={v.previewImage}
                              alt={`${v.code} preview`}
                              className="h-32 w-full rounded border border-slate-200 bg-white object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded bg-white">
                            No preview for this view
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500">
                          Text layers: {v.textLayers?.length || 0} | Images:{" "}
                          {v.designLayers?.length || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Layers detail */}
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">
                  Layers Detail
                </h2>

                {(!selectedDesign.views || selectedDesign.views.length === 0) ? (
                  <div className="text-xs text-slate-500">
                    No view/layer data available.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDesign.views.map((v) => (
                      <div
                        key={v.code}
                        className="rounded border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-slate-800">
                            View: {v.code || "(no code)"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Text: {v.textLayers?.length || 0} | Images:{" "}
                            {v.designLayers?.length || 0}
                          </div>
                        </div>

                        {/* Text layers */}
                        <div className="mb-2">
                          <div className="text-[11px] font-semibold text-slate-700 mb-1">
                            Text Layers
                          </div>
                          {v.textLayers && v.textLayers.length > 0 ? (
                            <div className="space-y-1">
                              {v.textLayers.map((t) => (
                                <div
                                  key={t.id}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] flex flex-wrap gap-x-3 gap-y-1"
                                >
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {t.id}
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    "{t.text}"
                                  </span>
                                  <span className="text-slate-500">
                                    pos{" "}
                                    <span className="font-mono">
                                      ({t.x?.toFixed?.(2) ?? t.x},{" "}
                                      {t.y?.toFixed?.(2) ?? t.y})
                                    </span>
                                  </span>
                                  <span className="text-slate-500">
                                    font {t.fontSize}px
                                  </span>
                                  <span className="text-slate-500">
                                    rot {t.rotation ?? 0}°
                                  </span>
                                  <span className="text-slate-500">
                                    color{" "}
                                    <span className="inline-flex items-center gap-1">
                                      <span>{t.color}</span>
                                      <span
                                        className="inline-block h-3 w-3 rounded border border-slate-300"
                                        style={{ backgroundColor: t.color }}
                                      />
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              No text layers.
                            </div>
                          )}
                        </div>

                        {/* Design/image layers */}
                        <div>
                          <div className="text-[11px] font-semibold text-slate-700 mb-1">
                            Design / Image Layers
                          </div>
                          {v.designLayers && v.designLayers.length > 0 ? (
                            <div className="space-y-2">
                              {v.designLayers.map((d, idx) => (
                                <div
                                  key={d.id || idx}
                                  className="rounded border border-slate-200 bg-white px-2 py-2 text-[11px] flex gap-3"
                                >
                                  {d.imageUrl ? (
                                    <div 
                                      className="h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-sky-300 transition-colors"
                                      onClick={() => openImageModal(
                                        d.imageUrl,
                                        `Design layer ${d.id || idx}`,
                                        `Zone: ${d.zone || "N/A"} | Scale: ${d.scale}`
                                      )}
                                    >
                                      <img
                                        src={d.imageUrl}
                                        alt="design layer"
                                        className="max-h-16 max-w-16 object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="h-16 w-16 shrink-0 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400">
                                      no image
                                    </div>
                                  )}

                                  <div className="flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-[10px] text-slate-500">
                                        {d.id || `layer-${idx}`}
                                      </span>
                                      {d.zone && (
                                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100">
                                          zone: {d.zone}
                                        </span>
                                      )}
                                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200">
                                        scale: {d.scale}
                                      </span>
                                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200">
                                        rot: {d.rotation ?? 0}°
                                      </span>
                                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200">
                                        pos: ({d.x?.toFixed?.(2) ?? d.x},{" "}
                                        {d.y?.toFixed?.(2) ?? d.y})
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      BG removed:{" "}
                                      <span className="font-semibold">
                                        {d.hasBgRemoved ? "Yes" : "No"}
                                      </span>{" "}
                                      | Inside safe area:{" "}
                                      <span className="font-semibold">
                                        {d.insideSafeArea === false
                                          ? "No"
                                          : "Yes"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              No design/image layers.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* IMAGE MODAL */}
      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleModalBackdropClick}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {imageModal.title}
                </h3>
                {imageModal.altText && (
                  <p className="text-xs text-slate-500 mt-1">
                    {imageModal.altText}
                  </p>
                )}
              </div>
              <button
                onClick={closeImageModal}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal content - Image */}
            <div className="flex-1 flex items-center justify-center p-4 bg-slate-100 overflow-auto">
              <div className="relative max-w-full max-h-full">
                <img
                  src={imageModal.imageUrl}
                  alt={imageModal.altText}
                  className="max-w-full max-h-[70vh] object-contain rounded border border-slate-200 bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
              <div className="text-xs text-slate-500">
                Click outside or press ESC to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}