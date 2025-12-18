// client/src/pages/ProductList.jsx
import { useEffect, useCallback, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { fetchProducts } from "../redux/slices/productsSlice.js";
import {
  Search,
  Filter,
  X,
  Star,
  ShoppingBag,
  Heart,
  Eye,
  Truck,
  Shield,
  RefreshCw,
  ChevronRight,
  Grid,
  List,
  Sparkles,
  TrendingUp,
  Zap,
  Tag,
  SortAsc,
  SlidersHorizontal
} from "lucide-react";

// Modern color palette
const MODERN_COLORS = {
  primary: {
    DEFAULT: 'rgb(79 70 229)',
    light: 'rgb(99 102 241)',
    dark: 'rgb(67 56 202)'
  },
  secondary: {
    DEFAULT: 'rgb(168 85 247)',
    light: 'rgb(192 132 252)',
    dark: 'rgb(147 51 234)'
  },
  accent: {
    success: 'rgb(34 197 94)',
    warning: 'rgb(245 158 11)',
    error: 'rgb(239 68 68)',
    info: 'rgb(59 130 246)'
  },
  neutral: {
    50: 'rgb(250 250 250)',
    100: 'rgb(245 245 245)',
    200: 'rgb(229 229 229)',
    300: 'rgb(212 212 212)',
    400: 'rgb(163 163 163)',
    500: 'rgb(115 115 115)',
    600: 'rgb(82 82 82)',
    700: 'rgb(64 64 64)',
    800: 'rgb(38 38 38)',
    900: 'rgb(23 23 23)'
  }
};

// Default placeholder image
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";

// Filter categories
const FILTER_CATEGORIES = [
  { id: 'all', name: 'All Products', icon: Grid, color: MODERN_COLORS.primary.DEFAULT },
  { id: 'hoodie', name: 'Hoodies', icon: ShoppingBag, color: MODERN_COLORS.accent.info },
  { id: 'sweatshirt', name: 'Sweatshirts', icon: ShoppingBag, color: MODERN_COLORS.secondary.DEFAULT },
  { id: 'womens', name: "Women's", icon: Sparkles, color: MODERN_COLORS.accent.success },
  { id: 'tshirts', name: 'T-Shirts', icon: Tag, color: MODERN_COLORS.accent.warning },
  { id: 'polos', name: 'Polos', icon: TrendingUp, color: MODERN_COLORS.accent.error },
  { id: 'oversized', name: 'Oversized', icon: Zap, color: MODERN_COLORS.secondary.light },
  { id: 'classic', name: 'Classic', icon: Shield, color: MODERN_COLORS.neutral[600] }
];

// Sort options
const SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Sparkles },
  { id: 'price-low', name: 'Price: Low to High', icon: SortAsc },
  { id: 'price-high', name: 'Price: High to Low', icon: SortAsc },
  { id: 'avg-customer-review', name: 'Best Rated', icon: Star },
  { id: 'newest', name: 'Newest Arrivals', icon: TrendingUp }
];

export default function ProductList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, itemsStatus, itemsError } = useSelector(
    (state) => state.products
  );
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('featured');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  const loadProducts = useCallback(() => {
    if (itemsStatus === "idle" || refreshing) {
      dispatch(fetchProducts());
      setRefreshing(false);
    }
  }, [itemsStatus, dispatch, refreshing]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...items];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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

    // Apply size filter
    if (selectedSizes.length > 0) {
      filtered = filtered.filter(product => 
        product.sizes?.some(size => selectedSizes.includes(size))
      );
    }

    // Apply color filter
    if (selectedColors.length > 0) {
      filtered = filtered.filter(product => 
        product.colors?.some(color => selectedColors.includes(color))
      );
    }

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

    return filtered;
  }, [items, selectedCategory, searchQuery, sortOption, priceRange, selectedSizes, selectedColors]);

  const handleRetry = () => {
    setRefreshing(true);
    dispatch(fetchProducts());
  };

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setSortOption('featured');
    setPriceRange([0, 10000]);
    setSelectedSizes([]);
    setSelectedColors([]);
  };

  const toggleWishlist = (productId) => {
    setWishlist(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Skeleton Loader Component
  const ProductSkeleton = () => (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 animate-pulse">
      <div className="h-48 bg-neutral-100 rounded-lg mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-neutral-100 rounded w-3/4"></div>
        <div className="h-4 bg-neutral-100 rounded w-1/2"></div>
        <div className="h-6 bg-neutral-100 rounded w-1/4"></div>
      </div>
    </div>
  );

  if (itemsStatus === "loading" || refreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-100 rounded-lg w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (itemsStatus === "failed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Connection Error</h3>
          <p className="text-neutral-600 mb-6">
            {itemsError || "Unable to load products. Please check your connection."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-white border-2 border-neutral-200 text-neutral-700 rounded-xl hover:border-neutral-300 transition-all font-medium"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (itemsStatus === "succeeded" && items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Catalog Empty</h3>
          <p className="text-neutral-600 mb-6">
            Our collection is being updated. Check back soon for amazing products!
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
          >
            Explore Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">Premium Collection</h1>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Discover expertly crafted products with premium customization options
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products, categories, or features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900">{filteredProducts.length}</div>
                <div className="text-sm text-neutral-500">Products</div>
              </div>
              <div className="hidden md:block w-px h-8 bg-neutral-200"></div>
              <div className="hidden md:block text-center">
                <div className="text-2xl font-bold text-neutral-900">{items.length}</div>
                <div className="text-sm text-neutral-500">Total Items</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="hidden sm:flex items-center bg-neutral-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              {/* Mobile Filter Button */}
              <button
                onClick={() => setShowSidebar(true)}
                className="sm:hidden flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className={`${showSidebar ? 'fixed inset-0 z-50' : 'hidden lg:block'} lg:relative lg:w-80`}>
            {/* Overlay for mobile */}
            {showSidebar && (
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setShowSidebar(false)}
              />
            )}
            
            {/* Sidebar Content */}
            <div className={`fixed lg:relative top-0 left-0 h-full lg:h-auto w-full lg:w-80 bg-white lg:bg-transparent z-50 lg:z-auto overflow-y-auto lg:overflow-visible`}>
              <div className="h-full lg:h-auto bg-white rounded-xl border border-neutral-100 p-6 lg:sticky lg:top-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-neutral-900">Filters</h2>
                  <div className="flex items-center gap-2">
                    {Object.keys({ selectedCategory, searchQuery, sortOption, priceRange, selectedSizes, selectedColors }).some(key => {
                      const value = eval(key);
                      if (Array.isArray(value)) return value.length > 0;
                      if (typeof value === 'object') return value[0] !== 0 || value[1] !== 10000;
                      return value !== 'all' && value !== '' && value !== 'featured';
                    }) && (
                      <button
                        onClick={handleClearFilters}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-4">Categories</h3>
                  <div className="space-y-2">
                    {FILTER_CATEGORIES.map((category) => {
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${selectedCategory === category.id ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ backgroundColor: category.color + '20' }}>
                            <Icon className="w-4 h-4" style={{ color: category.color }} />
                          </div>
                          <span className={`font-medium ${selectedCategory === category.id ? 'text-indigo-700' : 'text-neutral-700'}`}>
                            {category.name}
                          </span>
                          {selectedCategory === category.id && (
                            <ChevronRight className="w-4 h-4 text-indigo-600 ml-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Range */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-neutral-700">Price Range</h3>
                    <span className="text-sm text-neutral-600">
                      ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                    </span>
                  </div>
                  <div className="px-2">
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="100"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="w-full h-2 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:shadow-lg"
                    />
                    <div className="flex justify-between mt-2 text-xs text-neutral-500">
                      <span>₹0</span>
                      <span>₹5,000</span>
                      <span>₹10,000</span>
                    </div>
                  </div>
                </div>

                {/* Sort Options */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-4">Sort By</h3>
                  <div className="space-y-2">
                    {SORT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setSortOption(option.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${sortOption === option.id ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                        >
                          <Icon className={`w-4 h-4 ${sortOption === option.id ? 'text-indigo-600' : 'text-neutral-400'}`} />
                          <span className={`font-medium ${sortOption === option.id ? 'text-indigo-700' : 'text-neutral-700'}`}>
                            {option.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="p-4 bg-gradient-to-br from-neutral-50 to-white rounded-xl border border-neutral-100">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-neutral-800">Quality Guaranteed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-neutral-800">Fast Delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Active Filters */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-sm font-medium">
                    {FILTER_CATEGORIES.find(c => c.id === selectedCategory)?.name}
                    <button onClick={() => setSelectedCategory('all')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm font-medium">
                    Search: "{searchQuery}"
                    <button onClick={() => setSearchQuery('')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {priceRange[1] < 10000 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm font-medium">
                    Price: Up to ₹{priceRange[1].toLocaleString()}
                    <button onClick={() => setPriceRange([0, 10000])}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Results Grid/List */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-100 p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-neutral-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-800 mb-3">No products found</h3>
                <p className="text-neutral-600 mb-8 max-w-md mx-auto">
                  Try adjusting your search or filter criteria to find what you're looking for.
                </p>
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => {
                  const productImage = product.imageUrl || product.image || DEFAULT_PRODUCT_IMAGE;
                  const isInWishlist = wishlist.includes(product.slug);
                  
                  return (
                    <div 
                      key={product.slug} 
                      className="group bg-white rounded-2xl border border-neutral-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                    >
                      {/* Image Container */}
                      <div className="relative h-64 bg-gradient-to-br from-neutral-50 to-white overflow-hidden">
                        <img
                          src={productImage}
                          alt={product.name}
                          className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                        
                        {/* Badges */}
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                          {product.featured && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                              <Sparkles className="w-3 h-3" />
                              FEATURED
                            </span>
                          )}
                          {product.discountPercentage && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full">
                              SALE {product.discountPercentage}%
                            </span>
                          )}
                        </div>
                        
                        {/* Wishlist Button */}
                        <button
                          onClick={() => toggleWishlist(product.slug)}
                          className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
                        >
                          <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-neutral-400 hover:text-red-500'}`} />
                        </button>
                      </div>

                      {/* Product Info */}
                      <div className="p-5">
                        {/* Category */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-medium px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                            {product.category}
                          </span>
                          {product.isNew && (
                            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded">
                              NEW
                            </span>
                          )}
                        </div>
                        
                        {/* Name */}
                        <h3 className="font-bold text-neutral-900 mb-2 line-clamp-1">
                          {product.name}
                        </h3>
                        
                        {/* Description */}
                        <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                          {product.description}
                        </p>
                        
                        {/* Rating */}
                        {product.rating && (
                          <div className="flex items-center gap-2 mb-4">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-neutral-700">
                              {product.rating.toFixed(1)}
                            </span>
                            {product.reviewCount && (
                              <span className="text-sm text-neutral-500">
                                ({product.reviewCount})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Price & Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                ₹{product.basePrice?.toLocaleString()}
                              </span>
                              {product.originalPrice && product.originalPrice > product.basePrice && (
                                <span className="text-sm text-neutral-400 line-through">
                                  ₹{product.originalPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {product.discountPercentage && (
                              <span className="text-xs text-green-600 font-medium">
                                Save ₹{(product.originalPrice - product.basePrice).toLocaleString()}
                              </span>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/products/${product.slug}`)}
                              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                              title="Quick View"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <Link
                              to={`/products/${product.slug}/customize`}
                              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm"
                            >
                              Customize
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="space-y-4">
                {filteredProducts.map((product) => {
                  const productImage = product.imageUrl || product.image || DEFAULT_PRODUCT_IMAGE;
                  const isInWishlist = wishlist.includes(product.slug);
                  
                  return (
                    <div 
                      key={product.slug} 
                      className="group bg-white rounded-xl border border-neutral-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 p-4"
                    >
                      <div className="flex gap-4">
                        {/* Image */}
                        <div className="relative w-32 h-32 bg-gradient-to-br from-neutral-50 to-white rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={productImage}
                            alt={product.name}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                                  {product.category}
                                </span>
                                {product.featured && (
                                  <span className="text-xs font-medium px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                    FEATURED
                                  </span>
                                )}
                              </div>
                              
                              <h3 className="font-bold text-neutral-900 mb-1">
                                {product.name}
                              </h3>
                              
                              <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
                                {product.description}
                              </p>
                              
                              {/* Features */}
                              {product.features && product.features.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {product.features.slice(0, 3).map((feature, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                                      ✓ {feature}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Price & Wishlist */}
                            <div className="text-right">
                              <button
                                onClick={() => toggleWishlist(product.slug)}
                                className="p-2 mb-4 hover:bg-neutral-100 rounded-lg"
                              >
                                <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-neutral-400'}`} />
                              </button>
                              
                              <div className="mb-4">
                                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                  ₹{product.basePrice?.toLocaleString()}
                                </div>
                                {product.originalPrice && product.originalPrice > product.basePrice && (
                                  <div className="text-sm text-neutral-400 line-through">
                                    ₹{product.originalPrice.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Footer Actions */}
                          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => navigate(`/products/${product.slug}`)}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                View Details
                              </button>
                              <button className="text-sm text-neutral-600 hover:text-neutral-800">
                                Compare
                              </button>
                            </div>
                            
                            <Link
                              to={`/products/${product.slug}/customize`}
                              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium"
                            >
                              Customize Product
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between">
                  <button
                    className="px-4 py-2 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    disabled
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(page => (
                      <button
                        key={page}
                        className={`w-10 h-10 rounded-lg font-medium ${page === 1 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <span className="mx-2 text-neutral-400">...</span>
                    <button className="w-10 h-10 rounded-lg text-neutral-700 hover:bg-neutral-100">
                      10
                    </button>
                  </div>
                  <button className="px-4 py-2 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}