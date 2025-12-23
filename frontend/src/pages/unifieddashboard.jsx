// src/pages/UnifiedDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Package,
  ShoppingBag,
  X,
  Star,
  Heart,
  Truck,
  Shield,
  RefreshCw,
  ChevronRight,
  Grid,
  List,
  Zap,
  Tag,
  SortAsc,
  SlidersHorizontal,
  LayoutDashboard,
  Database,
  Box,
  Layers,
  Home
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

// Import product slices
import { fetchProducts } from "../redux/slices/productsSlice.js";
import { fetchReadymadeProducts } from "../redux/slices/predesignedslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

export default function UnifiedDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // State for Designs (Catalogue)
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [designsError, setDesignsError] = useState("");

  // State for Products
  const { items: products, itemsStatus: productsStatus, itemsError: productsError } = useSelector(
    (state) => state.products
  );

  // State for Readymade Products
  const { products: readymadeProducts, loading: readymadeLoading, error: readymadeError } = useSelector(
    (state) => state.readymadeproducts
  );

  // Common state
  const [activeTab, setActiveTab] = useState("designs"); // designs, products, readymade
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [localCartItems, setLocalCartItems] = useState({});
  const [selectedKind, setSelectedKind] = useState("DESIGN");
  const [viewMode, setViewMode] = useState("grid");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOption, setSortOption] = useState("featured");

  // Redux selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);

  // Tab configurations
  const TABS = [
    {
      id: "designs",
      name: "Design Catalogue",
      icon: Palette,
      description: "Customizable designs with multiple views",
      color: "from-indigo-600 to-purple-600",
      count: designs.length
    },
    {
      id: "products",
      name: "Products Grid",
      icon: ShoppingBag,
      description: "Browse all products by category",
      color: "from-blue-600 to-cyan-600",
      count: products.length
    },
    {
      id: "readymade",
      name: "Ready-made Collection",
      icon: Package,
      description: "Pre-designed products ready to ship",
      color: "from-emerald-600 to-teal-600",
      count: readymadeProducts.length
    }
  ];

  // Filter categories for products
  const FILTER_CATEGORIES = [
    { id: 'all', name: 'All Products', icon: Grid, color: '#4f46e5' },
    { id: 'hoodie', name: 'Hoodies', icon: ShoppingBag, color: '#3b82f6' },
    { id: 'sweatshirt', name: 'Sweatshirts', icon: ShoppingBag, color: '#8b5cf6' },
    { id: 'womens', name: "Women's", icon: Sparkles, color: '#10b981' },
    { id: 'tshirts', name: 'T-Shirts', icon: Tag, color: '#f59e0b' },
    { id: 'polos', name: 'Polos', icon: TrendingUp, color: '#ef4444' },
    { id: 'oversized', name: 'Oversized', icon: Zap, color: '#a855f7' },
    { id: 'classic', name: 'Classic', icon: Shield, color: '#525252' }
  ];

  // Sort options
  const SORT_OPTIONS = [
    { id: 'featured', name: 'Featured', icon: Sparkles },
    { id: 'price-low', name: 'Price: Low to High', icon: SortAsc },
    { id: 'price-high', name: 'Price: High to Low', icon: SortAsc },
    { id: 'avg-customer-review', name: 'Best Rated', icon: Star },
    { id: 'newest', name: 'Newest Arrivals', icon: TrendingUp }
  ];

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      switch (activeTab) {
        case "designs":
          await fetchDesigns();
          break;
        case "products":
          if (productsStatus === "idle") {
            dispatch(fetchProducts());
          }
          break;
        case "readymade":
          if (!readymadeProducts.length) {
            dispatch(fetchReadymadeProducts());
          }
          break;
      }
    };
    fetchData();
  }, [activeTab, dispatch, productsStatus, readymadeProducts.length]);

  // Fetch designs
  const fetchDesigns = async () => {
    try {
      const res = await fetch(`${API_URL}/savedata/catalogue`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load catalogue");
      setDesigns(data);
      // Filter designs by kind = "DESIGN" initially
      const designOnly = data.filter(d => d.kind && d.kind.toUpperCase() === "DESIGN");
      setFilteredItems(designOnly);
    } catch (err) {
      setDesignsError(err.message);
    } finally {
      setDesignsLoading(false);
    }
  };

  // Apply filters based on active tab
  useEffect(() => {
    let items = [];
    let filtered = [];

    switch (activeTab) {
      case "designs":
        items = designs;
        // Apply kind filter
        if (selectedKind !== "All") {
          filtered = items.filter(d =>
            d.kind && d.kind.toUpperCase() === selectedKind.toUpperCase()
          );
        } else {
          filtered = items;
        }
        break;

      case "products":
        items = products;
        filtered = [...items];

        // Apply category filter
        if (selectedCategory !== 'all') {
          filtered = filtered.filter(product => {
            const productName = product.name?.toLowerCase() || '';
            const productCategory = product.category?.toLowerCase() || '';
            
            switch (selectedCategory) {
              case 'hoodie':
                return productName.includes('hoodie') || productCategory.includes('hoodie');
              case 'sweatshirt':
                return productName.includes('sweat') || productCategory.includes('sweat');
              case 'womens':
                return productName.includes('women') || productName.includes('womens') ||
                       productCategory.includes('women') || productCategory.includes('womens');
              case 'tshirts':
                return productName.includes('t-shirt') || productName.includes('tshirt');
              case 'polos':
                return productName.includes('polo') || productCategory.includes('polo');
              case 'oversized':
                return productName.includes('oversized') || productCategory.includes('oversized');
              case 'classic':
                return productName.includes('classic') || productCategory.includes('classic');
              default:
                return true;
            }
          });
        }

        // Apply price range filter
        filtered = filtered.filter(product =>
          product.basePrice >= priceRange[0] && product.basePrice <= priceRange[1]
        );

        // Apply sorting
        filtered.sort((a, b) => {
          switch (sortOption) {
            case 'price-low':
              return (a.basePrice || 0) - (b.basePrice || 0);
            case 'price-high':
              return (b.basePrice || 0) - (a.basePrice || 0);
            case 'avg-customer-review':
              return (b.rating || 0) - (a.rating || 0);
            case 'newest':
              return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            case 'featured':
            default:
              return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
          }
        });
        break;

      case "readymade":
        items = Array.isArray(readymadeProducts) ? readymadeProducts : [];
        filtered = items.filter(product => {
          if (!product) return false;
          
          const matchesSearch =
            (product.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
          
          const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.category === selectedCategory;
          return matchesSearch && matchesCategory;
        });

        // Apply sorting
        filtered.sort((a, b) => {
          switch (sortOption) {
            case 'price-low':
              return (a.price || 0) - (b.price || 0);
            case 'price-high':
              return (b.price || 0) - (a.price || 0);
            case 'name':
              return (a.title || '').localeCompare(b.title || '');
            case 'stock':
              return (b.stock || 0) - (a.stock || 0);
            default:
              return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }
        });
        break;
    }

    // Apply search filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(item => {
        if (activeTab === "designs") {
          return (
            item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        } else if (activeTab === "products") {
          return (
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        } else if (activeTab === "readymade") {
          return (
            item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        return true;
      });
    }

    setFilteredItems(filtered);
  }, [activeTab, designs, products, readymadeProducts, searchTerm, selectedKind, selectedCategory, priceRange, sortOption]);

  // Cart functions
  const getCartQuantityForDesign = (designId) => {
    if (localCartItems[designId] !== undefined) {
      return localCartItems[designId];
    }
    const item = cartItems.find(item => item.designId === designId);
    return item ? item.qty : 0;
  };

  const isDesignInCart = (designId) => {
    return getCartQuantityForDesign(designId) > 0;
  };

  const isReadymadeInCart = (productId) => {
    return cartItems.some(item =>
      item.kind === "READYMADE" &&
      item.readymadeProduct?._id === productId
    );
  };

  const getReadymadeCartQuantity = (productId) => {
    const item = cartItems.find(item =>
      item.kind === "READYMADE" &&
      item.readymadeProduct?._id === productId
    );
    return item ? item.qty : 0;
  };

  const handleAddToCart = async (item, type) => {
    if (!token) {
      alert("Please login to add items to cart");
      return;
    }

    try {
      let cartData;
      
      if (type === "design") {
        const designKind = item.kind || "DESIGN";
        const kind = designKind.toUpperCase() === "READYMADE" ? "READYMADE" : "DESIGN";
        
        cartData = {
          designId: item._id,
          productId: item.product?._id || item.productId,
          title: item.title || item.productName,
          unitPrice: item.salePrice || item.product?.basePrice || 0,
          basePrice: item.product?.basePrice || item.salePrice || 0,
          qty: 1,
          previewImage: item.previewImage || item.views?.[0]?.previewImage || null,
          signature: `${item._id}-${item.product?._id || item.productId}`,
          views: item.views || [],
          kind: kind
        };

        // Optimistic update
        setLocalCartItems(prev => ({
          ...prev,
          [item._id]: (prev[item._id] || 0) + 1
        }));

      } else if (type === "readymade") {
        cartData = {
          kind: "READYMADE",
          qty: 1,
          readymadeProductId: item._id
        };

        // Optimistic update
        setLocalCartItems(prev => ({
          ...prev,
          [item._id]: (prev[item._id] || 0) + 1
        }));
      }

      await dispatch(addToCart(cartData)).unwrap();
      
      // Clear local state after successful update
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[item._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      // Revert optimistic update on error
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[item._id];
        return newState;
      });
    }
  };

  const handleIncrement = async (item, type) => {
    if (!token) return alert("Please login to update cart");

    const currentQty = type === "design" 
      ? getCartQuantityForDesign(item._id)
      : getReadymadeCartQuantity(item._id);
    
    const cartItem = cartItems.find(cartItem => 
      type === "design" 
        ? cartItem.designId === item._id
        : cartItem.readymadeProduct?._id === item._id
    );

    if (!cartItem) {
      handleAddToCart(item, type);
      return;
    }

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [item._id]: currentQty + 1
      }));

      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty + 1
      })).unwrap();
      
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[item._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[item._id];
        return newState;
      });
    }
  };

  const handleDecrement = async (item, type) => {
    if (!token) return alert("Please login to update cart");

    const currentQty = type === "design" 
      ? getCartQuantityForDesign(item._id)
      : getReadymadeCartQuantity(item._id);
    
    const cartItem = cartItems.find(cartItem => 
      type === "design" 
        ? cartItem.designId === item._id
        : cartItem.readymadeProduct?._id === item._id
    );

    if (!cartItem || currentQty <= 1) {
      handleRemoveFromCart(item, type);
      return;
    }

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [item._id]: currentQty - 1
      }));

      await dispatch(updateCartItemQty({
        itemId: cartItem._id,
        qty: currentQty - 1
      })).unwrap();
      
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[item._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to update quantity:", error);
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[item._id];
        return newState;
      });
    }
  };

  const handleRemoveFromCart = async (item, type) => {
    if (!token) return alert("Please login to update cart");

    const cartItem = cartItems.find(cartItem => 
      type === "design" 
        ? cartItem.designId === item._id
        : cartItem.readymadeProduct?._id === item._id
    );
    
    if (!cartItem) return;

    try {
      // Optimistic update
      setLocalCartItems(prev => ({
        ...prev,
        [item._id]: 0
      }));

      await dispatch(removeCartItem(cartItem._id)).unwrap();
      
      setTimeout(() => {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[item._id];
          return newState;
        });
      }, 2000);
      
    } catch (error) {
      console.error("Failed to remove from cart:", error);
      setLocalCartItems(prev => {
        const newState = { ...prev };
        delete newState[item._id];
        return newState;
      });
    }
  };

  const handleKindFilterChange = (kind) => {
    setSelectedKind(kind);
  };

  const clearCartNotifications = () => {
    dispatch(clearError());
    dispatch(clearSuccess());
  };

  useEffect(() => {
    return () => {
      dispatch(resetCartState());
    };
  }, [dispatch]);

  const getKindStats = () => {
    const designCount = designs.filter(d => d.kind && d.kind.toUpperCase() === "DESIGN").length;
    const readyMadeCount = designs.filter(d => d.kind && d.kind.toUpperCase() === "READYMADE").length;
    return { designCount, readyMadeCount };
  };

  const kindStats = getKindStats();

  const isLoading = () => {
    switch (activeTab) {
      case "designs":
        return designsLoading;
      case "products":
        return productsStatus === "loading";
      case "readymade":
        return readymadeLoading;
      default:
        return false;
    }
  };

  const getErrorMessage = () => {
    switch (activeTab) {
      case "designs":
        return designsError;
      case "products":
        return productsError;
      case "readymade":
        return readymadeError;
      default:
        return "";
    }
  };

  if (isLoading()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading {TABS.find(t => t.id === activeTab)?.name}...</p>
        </div>
      </div>
    );
  }

  const errorMessage = getErrorMessage();
  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Data</h3>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <LayoutDashboard className="w-6 h-6 text-indigo-600" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Unified Dashboard
                </h1>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  {filteredItems.length} items
                </span>
              </div>
              <p className="text-gray-500">Browse all collections in one place</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${TABS.find(t => t.id === activeTab)?.name.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Dashboard Tabs */}
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchTerm("");
                    setSelectedCategory("all");
                    setSelectedKind("DESIGN");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all ${activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                    }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-semibold">{tab.name}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${activeTab === tab.id
                      ? "bg-white/20"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab Filters */}
          <div className="mt-6">
            {activeTab === "designs" && (
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
                  <span className="text-sm font-medium text-gray-600">Filter by kind:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleKindFilterChange("All")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedKind === "All"
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      All ({designs.length})
                    </button>
                    <button
                      onClick={() => handleKindFilterChange("DESIGN")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedKind === "DESIGN"
                          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                          : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      <Palette className="w-4 h-4" />
                      DESIGN ({kindStats.designCount})
                    </button>
                    <button
                      onClick={() => handleKindFilterChange("READYMADE")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedKind === "READYMADE"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                          : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      <Package className="w-4 h-4" />
                      READYMADE ({kindStats.readyMadeCount})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === "products" || activeTab === "readymade") && (
              <div className="flex flex-wrap gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {FILTER_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
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

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No items found
            </h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search terms or filters
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedKind("All");
              }}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Results Summary */}
            <div className="mb-6 px-2">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{filteredItems.length}</span> items
                {searchTerm && (
                  <>
                    {" "}matching "<span className="font-semibold text-gray-700">{searchTerm}</span>"
                  </>
                )}
              </p>
            </div>

            {/* Items Grid - Unified Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                // Common props for all item types
                const isDesign = activeTab === "designs";
                const isReadymade = activeTab === "readymade";
                const itemId = item._id;
                
                // Determine cart state
                let inCart = false;
                let quantity = 0;
                
                if (isDesign) {
                  inCart = isDesignInCart(itemId);
                  quantity = getCartQuantityForDesign(itemId);
                } else if (isReadymade) {
                  inCart = isReadymadeInCart(itemId);
                  quantity = getReadymadeCartQuantity(itemId);
                }
                
                const isUpdating = cartLoading && localCartItems[itemId] !== undefined;
                const designKind = item.kind || "DESIGN";
                const normalizedKind = designKind.toUpperCase();

                return (
                  <div
                    key={itemId}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    <div className="relative">
                      {/* Kind/Badge */}
                      {isDesign && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${normalizedKind === "DESIGN"
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

                      {/* Main Image */}
                      <div className="relative h-64 bg-gradient-to-br from-gray-50 to-white overflow-hidden">
                        {isDesign ? (
                          item.previewImage ? (
                            <img
                              src={item.previewImage}
                              alt={item.title || item.productName}
                              className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            </div>
                          )
                        ) : isReadymade ? (
                          item.images?.[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            </div>
                          )
                        ) : (
                          // Products tab
                          item.imageUrl || item.image ? (
                            <img
                              src={item.imageUrl || item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            </div>
                          )
                        )}

                        {/* Cart Button */}
                        <div className="absolute bottom-3 right-3">
                          <div className="flex items-center gap-2">
                            {inCart ? (
                              <>
                                <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg">
                                  <button
                                    onClick={() => isDesign ? handleDecrement(item, "design") : handleDecrement(item, "readymade")}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-full disabled:opacity-50 transition-colors"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="px-3 py-1 text-sm font-medium">
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={() => isDesign ? handleIncrement(item, "design") : handleIncrement(item, "readymade")}
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
                                onClick={() => isDesign ? handleAddToCart(item, "design") : handleAddToCart(item, "readymade")}
                                disabled={isUpdating || !token}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${token
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
                        {((isDesign && item.salePrice > 5000) || (isReadymade && item.price > 5000)) && (
                          <div className="absolute top-3 right-3">
                            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Popular
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Side Previews for Designs */}
                      {isDesign && item.views && item.views.some(v => v.previewImage) && (
                        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                          <p className="text-xs text-gray-500 font-medium mb-2">Views</p>
                          <div className="grid grid-cols-4 gap-2">
                            {item.views.slice(0, 4).map((v) =>
                              v.previewImage ? (
                                <div key={v.code} className="relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      <div className="p-5">
                        <div className="mb-3">
                          <h2 className="font-bold text-gray-900 line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
                            {isDesign ? item.title || item.productName :
                              isReadymade ? item.title : item.name}
                          </h2>
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {isDesign ? item.productName :
                              isReadymade ? item.category : item.category}
                          </p>
                          {isReadymade && item.description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                              {isDesign ? `₹${item.salePrice || item.product?.basePrice || 0}` :
                                isReadymade ? `₹${item.price || 0}` : `₹${item.basePrice || 0}`}
                            </span>
                            {isDesign && item.product?.basePrice && item.salePrice < item.product.basePrice && (
                              <span className="ml-2 text-sm text-gray-400 line-through">
                                ₹{item.product.basePrice}
                              </span>
                            )}
                          </div>
                          <Link
                            to={isDesign ? `/catalogue/${item._id}` :
                              isReadymade ? `/products/${item._id}` : `/products/${item.slug}`}
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
              Showing <span className="font-semibold text-gray-700">{filteredItems.length}</span> of{" "}
              <span className="font-semibold text-gray-700">
                {activeTab === "designs" ? designs.length :
                  activeTab === "products" ? products.length :
                    readymadeProducts.length}
              </span> items in {TABS.find(t => t.id === activeTab)?.name}
            </p>
            <div className="flex justify-center gap-6 mt-4">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {tab.name}: {tab.count}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}