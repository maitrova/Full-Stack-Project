// src/pages/CataloguePage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { 
  Loader2, 
  Grid3x3, 
  Filter,
  Search,
  TrendingUp,
  Sparkles,
  Eye,
  ShoppingCart,
  Check,
  Plus,
  Minus,
  Palette,
  Package
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

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

export default function CataloguePage() {
  const dispatch = useDispatch();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDesigns, setFilteredDesigns] = useState([]);
  const [localCartItems, setLocalCartItems] = useState({});
  const [selectedKind, setSelectedKind] = useState("DESIGN"); // Default to DESIGN as requested
  
  // Redux selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);
  
  // Get cart quantities for each design
  const getCartQuantityForDesign = (designId) => {
    // First check local state (for optimistic updates)
    if (localCartItems[designId] !== undefined) {
      return localCartItems[designId];
    }
    
    // Then check Redux store
    const item = cartItems.find(item => item.designId === designId);
    return item ? item.qty : 0;
  };
  
  // Check if design is in cart
  const isDesignInCart = (designId) => {
    return getCartQuantityForDesign(designId) > 0;
  };

  useEffect(() => {
    const fetchCatalogue = async () => {
      try {
        const res = await fetch(`${API_URL}/savedata/catalogue`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load catalogue");
        setDesigns(data);
        
        // Filter designs by kind = "DESIGN" initially
        const designOnly = data.filter(d => d.kind && d.kind.toUpperCase() === "DESIGN");
        setFilteredDesigns(designOnly);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogue();
  }, []);

  // Apply filters whenever search term or kind selection changes
  useEffect(() => {
    let filtered = designs;
    
    // Apply kind filter
    if (selectedKind !== "All") {
      filtered = filtered.filter(d => 
        d.kind && d.kind.toUpperCase() === selectedKind.toUpperCase()
      );
    }
    
    // Apply search filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(d => 
        d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredDesigns(filtered);
  }, [searchTerm, selectedKind, designs]);

  // Handle add to cart
  const handleAddToCart = async (design) => {
    if (!token) {
      alert("Please login to add items to cart");
      return;
    }

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
      setLocalCartItems(prev => ({
        ...prev,
        [design._id]: (prev[design._id] || 0) + 1
      }));

      await dispatch(addToCart(cartData)).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[design._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      // Revert optimistic update on error
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[design._id];
        return newState;
      });
    }
  };

  // Handle increment quantity
  const handleIncrement = async (design) => {
    if (!token) {
      alert("Please login to update cart");
      return;
    }

    const currentQty = getCartQuantityForDesign(design._id);
    const cartItem = cartItems.find(item => item.designId === design._id);
    
    if (!cartItem) {
      handleAddToCart(design);
      return;
    }

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [design._id]: currentQty + 1
      }));

      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty + 1
      })).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[design._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      // Revert optimistic update on error
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[design._id];
        return newState;
      });
    }
  };

  // Handle decrement quantity
  const handleDecrement = async (design) => {
    if (!token) {
      alert("Please login to update cart");
      return;
    }

    const currentQty = getCartQuantityForDesign(design._id);
    const cartItem = cartItems.find(item => item.designId === design._id);
    
    if (!cartItem || currentQty <= 1) {
      // If quantity is 1, remove from cart
      handleRemoveFromCart(design);
      return;
    }

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [design._id]: currentQty - 1
      }));

      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty - 1
      })).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[design._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      // Revert optimistic update on error
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[design._id];
        return newState;
      });
    }
  };

  // Handle remove from cart
  const handleRemoveFromCart = async (design) => {
    if (!token) {
      alert("Please login to update cart");
      return;
    }

    const cartItem = cartItems.find(item => item.designId === design._id);
    if (!cartItem) return;

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [design._id]: 0
      }));

      await dispatch(removeCartItem(cartItem._id)).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[design._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to remove from cart:", error);
      // Revert optimistic update on error
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[design._id];
        return newState;
      });
    }
  };

  // Handle kind filter change
  const handleKindFilterChange = (kind) => {
    setSelectedKind(kind);
  };

  // Clear cart notifications
  const clearCartNotifications = () => {
    dispatch(clearError());
    dispatch(clearSuccess());
  };

  // Reset cart state on unmount
  useEffect(() => {
    return () => {
      dispatch(resetCartState());
    };
  }, [dispatch]);

  // Get count statistics
  const getKindStats = () => {
    const designCount = designs.filter(d => d.kind && d.kind.toUpperCase() === "DESIGN").length;
    const readyMadeCount = designs.filter(d => d.kind && d.kind.toUpperCase() === "READYMADE").length;
    return { designCount, readyMadeCount };
  };

  const kindStats = getKindStats();

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Loading catalogue...</p>
        <p className="text-sm text-gray-400 mt-1">Fetching the latest designs</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to white flex items-center justify-center">
      <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Catalogue</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Grid3x3 className="w-6 h-6 text-indigo-600" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Design Catalogue
                </h1>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  {filteredDesigns.length} designs
                </span>
              </div>
              <p className="text-gray-500">Browse and explore our collection of premium designs</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search designs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Kind Filter Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
              <span className="text-sm font-medium text-gray-600">Filter by kind:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleKindFilterChange("All")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedKind === "All" 
                      ? "bg-indigo-600 text-white shadow-md" 
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  All ({designs.length})
                </button>
                <button
                  onClick={() => handleKindFilterChange("DESIGN")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedKind === "DESIGN" 
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md" 
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  DESIGN ({kindStats.designCount})
                </button>
                <button
                  onClick={() => handleKindFilterChange("READYMADE")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedKind === "READYMADE" 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md" 
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Package className="w-4 h-4" />
                  READYMADE ({kindStats.readyMadeCount})
                </button>
              </div>
            </div>

            {/* Active Filter Badge */}
            {selectedKind !== "All" && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2">
                <span className="text-sm font-medium text-gray-600">Showing:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedKind === "DESIGN" 
                    ? "bg-indigo-100 text-indigo-700" 
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {selectedKind === "DESIGN" ? (
                    <span className="flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      DESIGN Only
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      READYMADE Only
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleKindFilterChange("All")}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Notifications */}
      {(cartError || cartSuccess) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {cartError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex justify-between items-center">
              <span>{cartError}</span>
              <button 
                onClick={clearCartNotifications}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          )}
          {cartSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex justify-between items-center">
              <span>✓ Item added to cart successfully!</span>
              <button 
                onClick={clearCartNotifications}
                className="text-green-500 hover:text-green-700"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Catalogue Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {selectedKind === "All" ? "No designs found" : `No ${selectedKind} designs found`}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : `Try switching to a different category or check back later for new ${selectedKind} designs`}
            </p>
            <div className="flex gap-3 justify-center">
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Clear Search
                </button>
              )}
              {selectedKind !== "All" && (
                <button 
                  onClick={() => handleKindFilterChange("All")}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Show All Designs
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Results Summary */}
            <div className="mb-6 px-2">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{filteredDesigns.length}</span> {selectedKind.toLowerCase()} designs
                {searchTerm && (
                  <>
                    {" "}matching "<span className="font-semibold text-gray-700">{searchTerm}</span>"
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {filteredDesigns.map((d) => {
                const inCart = isDesignInCart(d._id);
                const quantity = getCartQuantityForDesign(d._id);
                const isUpdating = cartLoading && localCartItems[d._id] !== undefined;
                const designKind = d.kind || "DESIGN";
                const normalizedKind = designKind.toUpperCase();
                
                return (
                  <div 
                    key={d._id}
                    className="group bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    <div className="relative">
                      {/* Kind Badge */}
                      {designKind && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            normalizedKind === "DESIGN" 
                              ? "bg-indigo-100 text-indigo-700" 
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {normalizedKind === "DESIGN" ? (
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
                      
                      {/* Main Preview */}
                      <div className="relative h-44 sm:h-64 bg-white sm:bg-gradient-to-br sm:from-gray-50 sm:to-white overflow-hidden">
                        {d.previewImage ? (
                          <>
                            <img
                              src={d.previewImage}
                              alt={d.title || d.productName}
                              className="w-full h-full object-contain p-2 sm:p-4 transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `
                                  <div class="flex items-center justify-center h-full">
                                    <div class="text-center">
                                      <Sparkles class="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                      <p class="text-sm text-gray-400">Preview unavailable</p>
                                    </div>
                                  </div>
                                `;
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-400">No preview</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Cart Button - Floating */}
                        <div className="absolute bottom-3 right-3">
                          <div className="flex items-center gap-2">
                            {inCart ? (
                              <>
                                <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg">
                                  <button
                                    onClick={() => handleDecrement(d)}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-full disabled:opacity-50 transition-colors"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="px-3 py-1 text-sm font-medium">
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={() => handleIncrement(d)}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-r-full disabled:opacity-50 transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                {isUpdating && (
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(d)}
                                disabled={isUpdating || !token}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
                                  token 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                } ${isUpdating ? 'opacity-50' : ''}`}
                              >
                                {isUpdating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ShoppingCart className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">
                                  {token ? 'Add to Cart' : 'Login to Cart'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Popular Badge */}
                        {d.salePrice > 5000 && (
                          <div className="absolute top-3 right-3">
                            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Popular
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Side Previews */}
                      {d.views && d.views.some(v => v.previewImage) && (
                        <div className="hidden sm:block px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                          <p className="text-xs text-gray-500 font-medium mb-2">Views</p>
                          <div className="grid grid-cols-4 gap-2">
                            {d.views.slice(0, 4).map((v) =>
                              v.previewImage ? (
                                <div key={v.code} className="relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden group-hover:border-gray-300 transition-colors">
                                  <img
                                    src={v.previewImage}
                                    alt={v.code}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}

                      {/* Info */}
                      <div className="p-3 sm:p-5">
                        <Link to={`/catalogue/${d._id}`} className="block">
                          <div className="mb-3">
                            <h2 className="font-bold text-gray-900 line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
                              {d.title || d.productName}
                            </h2>
                            <p className="text-sm text-gray-500 line-clamp-1">{d.productName}</p>
                          </div>
                        </Link>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                              ₹{d.salePrice || d.product?.basePrice || 0}
                            </span>
                            {d.product?.basePrice && d.salePrice < d.product.basePrice && (
                              <span className="ml-2 text-sm text-gray-400 line-through">
                                ₹{d.product.basePrice}
                              </span>
                            )}
                          </div>
                          <Link 
                            to={`/catalogue/${d._id}`}
                            className="inline-flex items-center gap-1.5 text-indigo-600 font-medium text-sm group-hover:gap-2 transition-all"
                          >
                            View Details
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer Stats */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              {selectedKind === "All" ? (
                <>
                  Showing <span className="font-semibold text-gray-700">{filteredDesigns.length}</span> of{" "}
                  <span className="font-semibold text-gray-700">{designs.length}</span> designs
                </>
              ) : (
                <>
                  Showing <span className="font-semibold text-gray-700">{filteredDesigns.length}</span> {selectedKind} designs of{" "}
                  <span className="font-semibold text-gray-700">{kindStats[selectedKind === "DESIGN" ? "designCount" : "readyMadeCount"]}</span> total
                </>
              )}
            </p>
            <p className="text-gray-400 text-xs mt-2">
              All designs are curated and quality-checked
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
