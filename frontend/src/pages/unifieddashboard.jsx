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
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";
import { buildCatalogueDesignPath } from "../utils/catalogueDesignRoutes.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

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

  const getDefaultReadymadeSize = (item) => {
    const variantSize =
      item?.variants?.[0]?.size ||
      item?.raw?.variants?.[0]?.size;

    if (typeof variantSize === "string" && variantSize.trim()) {
      return variantSize.trim().toUpperCase();
    }

    return "M";
  };

  const handleAddToCart = async (item, type) => {
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
          readymadeProductId: item._id,
          size: getDefaultReadymadeSize(item),
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
      <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-mt-text mx-auto mb-4" />
          <p className="text-mt-muted font-medium">Loading {TABS.find(t => t.id === activeTab)?.name}...</p>
        </div>
      </div>
    );
  }

  const errorMessage = getErrorMessage();
  if (errorMessage) {
    return (
      <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-mt-surface rounded-2xl shadow-lg border border-mt-line">
          <div className="w-16 h-16 bg-mt-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-mt-text mb-2">Unable to Load Data</h3>
          <p className="text-mt-muted mb-4">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-mt-btn text-mt-btn-text rounded-lg hover:bg-mt-btn-hover transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-mt-surface/90 backdrop-blur-sm border-b border-mt-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <LayoutDashboard className="w-6 h-6 text-mt-text" />
                <h1 className="text-3xl font-normal text-mt-text">
                  Unified Dashboard
                </h1>
                <span className="px-3 py-1 bg-mt-tint/10 text-mt-text rounded-full text-sm font-medium">
                  {filteredItems.length} items
                </span>
              </div>
              <p className="text-mt-subtle">Browse all collections in one place</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-mt-subtle" />
                <input
                  type="text"
                  placeholder={`Search ${TABS.find(t => t.id === activeTab)?.name.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-mt-bg border border-mt-line rounded-xl focus:outline-none focus:ring-2 focus:ring-mt-text focus:border-transparent transition"
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
                      ? "bg-mt-btn text-mt-btn-text"
                      : "bg-mt-surface text-mt-muted hover:bg-mt-tint/5 border border-mt-line"
                    }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-semibold">{tab.name}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${activeTab === tab.id
                      ? "bg-mt-tint/20"
                      : "bg-mt-surface-raised text-mt-muted"
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
                <div className="flex items-center gap-3 bg-mt-bg rounded-xl p-2">
                  <span className="text-sm font-medium text-mt-muted">Filter by kind:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleKindFilterChange("All")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedKind === "All"
                          ? "bg-mt-btn text-mt-btn-text shadow-md"
                          : "bg-mt-surface text-mt-muted hover:bg-mt-tint/10"
                        }`}
                    >
                      All ({designs.length})
                    </button>
                    <button
                      onClick={() => handleKindFilterChange("DESIGN")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedKind === "DESIGN"
                          ? "text-mt-btn-text shadow-md bg-mt-btn"
                          : "bg-mt-surface text-mt-muted hover:bg-mt-tint/10"
                        }`}
                    >
                      <Palette className="w-4 h-4" />
                      DESIGN ({kindStats.designCount})
                    </button>
                    <button
                      onClick={() => handleKindFilterChange("READYMADE")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedKind === "READYMADE"
                          ? "text-mt-btn-text shadow-md bg-mt-btn"
                          : "bg-mt-surface text-mt-muted hover:bg-mt-tint/10"
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
                  className="px-4 py-2 bg-mt-surface border border-mt-line rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {FILTER_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="px-4 py-2 bg-mt-surface border border-mt-line rounded-lg text-sm"
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
            <div className="bg-mt-danger/10 border border-mt-danger/30 text-mt-danger px-4 py-3 rounded-xl flex justify-between items-center">
              <span>{cartError}</span>
              <button
                onClick={clearCartNotifications}
                className="text-mt-danger hover:text-mt-danger"
              >
                ✕
              </button>
            </div>
          )}
          {cartSuccess && (
            <div className="bg-mt-success/10 border border-mt-success/30 text-mt-success px-4 py-3 rounded-xl flex justify-between items-center">
              <span>✓ Item added to cart successfully!</span>
              <button
                onClick={clearCartNotifications}
                className="text-mt-success hover:text-mt-success"
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
            <div className="w-24 h-24 bg-mt-surface-raised rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-mt-subtle" />
            </div>
            <h3 className="text-xl font-semibold text-mt-muted mb-2">
              No items found
            </h3>
            <p className="text-mt-subtle mb-6">
              Try adjusting your search terms or filters
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedKind("All");
              }}
              className="px-6 py-2.5 bg-mt-surface-raised text-mt-muted rounded-lg hover:bg-mt-tint/15 transition-colors font-medium"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Results Summary */}
            <div className="mb-6 px-2">
              <p className="text-sm text-mt-subtle">
                Showing <span className="font-semibold text-mt-muted">{filteredItems.length}</span> items
                {searchTerm && (
                  <>
                    {" "}matching "<span className="font-semibold text-mt-text">{searchTerm}</span>"
                  </>
                )}
              </p>
            </div>

            {/* Items Grid - Unified Layout */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
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
                    className="group bg-mt-surface rounded-xl sm:rounded-2xl shadow-sm border border-mt-line hover:shadow-xl hover:border-mt-line-strong transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    <div className="relative">
                      {/* Kind/Badge */}
                      {isDesign && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${normalizedKind === "DESIGN"
                              ? "bg-mt-tint/10 text-mt-text"
                              : "bg-mt-success/10 text-mt-success"
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
                      <div className="relative h-44 sm:h-64 bg-mt-photo overflow-hidden">
                        {isDesign ? (
                          item.previewImage ? (
                            <img
                              src={item.previewImage}
                              alt={item.title || item.productName}
                              className="w-full h-full object-contain p-2 sm:p-4 transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Sparkles className="w-12 h-12 text-mt-line-strong mx-auto mb-2" />
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
                              <Package className="w-12 h-12 text-mt-line-strong mx-auto mb-2" />
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
                              <ShoppingBag className="w-12 h-12 text-mt-line-strong mx-auto mb-2" />
                            </div>
                          )
                        )}

                        {/* Cart Button */}
                        <div className="absolute bottom-3 right-3">
                          <div className="flex items-center gap-2">
                            {inCart ? (
                              <>
                                <div className="flex items-center bg-mt-surface/90 backdrop-blur-sm rounded-full shadow-lg">
                                  <button
                                    onClick={() => isDesign ? handleDecrement(item, "design") : handleDecrement(item, "readymade")}
                                    disabled={isUpdating}
                                    className="p-2 text-mt-muted hover:bg-mt-tint/10 rounded-l-full disabled:opacity-50 transition-colors"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="px-3 py-1 text-sm font-medium">
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={() => isDesign ? handleIncrement(item, "design") : handleIncrement(item, "readymade")}
                                    disabled={isUpdating}
                                    className="p-2 text-mt-muted hover:bg-mt-tint/10 rounded-r-full disabled:opacity-50 transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                {isUpdating && (
                                  <Loader2 className="w-4 h-4 animate-spin text-mt-text" />
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => isDesign ? handleAddToCart(item, "design") : handleAddToCart(item, "readymade")}
                                disabled={isUpdating || !token}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${token
                                    ? 'bg-mt-btn hover:bg-mt-btn-hover text-mt-btn-text'
                                    : 'bg-mt-line text-mt-subtle cursor-not-allowed'
                                  } ${isUpdating ? 'opacity-50' : ''}`}
                              >
                                {isUpdating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ShoppingCart className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">
                                  {'Add to Cart'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Popular Badge */}
                        {((isDesign && item.salePrice > 5000) || (isReadymade && item.price > 5000)) && (
                          <div className="absolute top-3 right-3">
                            <span className="px-3 py-1 text-mt-btn-text text-xs font-semibold rounded-full flex items-center gap-1 bg-mt-btn">
                              <TrendingUp className="w-3 h-3" />
                              Popular
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Side Previews for Designs */}
                      {isDesign && item.views && item.views.some(v => v.previewImage) && (
                        <div className="hidden sm:block px-4 py-3 bg-mt-surface-raised/50 border-t border-mt-line">
                          <p className="text-xs text-mt-subtle font-medium mb-2">Views</p>
                          <div className="grid grid-cols-4 gap-2">
                            {item.views.slice(0, 4).map((v) =>
                              v.previewImage ? (
                                <div key={v.code} className="relative aspect-square bg-mt-photo rounded-lg border border-mt-line overflow-hidden">
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
                        <div className="mb-3">
                          <h2 className="font-normal text-mt-text line-clamp-1 mb-1 group-hover:text-mt-text transition-colors">
                            {isDesign ? item.title || item.productName :
                              isReadymade ? item.title : item.name}
                          </h2>
                          <p className="text-sm text-mt-subtle line-clamp-1">
                            {isDesign ? item.productName :
                              isReadymade ? item.category : item.category}
                          </p>
                          {isReadymade && item.description && (
                            <p className="text-sm text-mt-muted mt-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-mt-line">
                          <div>
                            <span className="text-2xl font-bold text-mt-text">
                              {isDesign ? `₹${item.salePrice || item.product?.basePrice || 0}` :
                                isReadymade ? `₹${item.price || 0}` : `₹${item.basePrice || 0}`}
                            </span>
                            {isDesign && item.product?.basePrice && item.salePrice < item.product.basePrice && (
                              <span className="ml-2 text-sm text-mt-subtle line-through">
                                ₹{item.product.basePrice}
                              </span>
                            )}
                          </div>
                          <Link
                            to={
                              isDesign
                                ? (buildCatalogueDesignPath(item) || `/catalogue/${item._id}`)
                                : isReadymade
                                ? (buildReadymadeProductPath(item) || `/readymade/${item._id}`)
                                : `/product/${item.slug}`
                            }
                            className="inline-flex items-center gap-1.5 text-mt-text font-medium text-sm group-hover:gap-2 transition-all"
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
        <div className="mt-12 pt-8 border-t border-mt-line">
          <div className="text-center">
            <p className="text-mt-subtle text-sm">
              Showing <span className="font-semibold text-mt-muted">{filteredItems.length}</span> of{" "}
              <span className="font-semibold text-mt-muted">
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
                      ? "bg-mt-tint/10 text-mt-text"
                      : "text-mt-subtle hover:text-mt-text"
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
