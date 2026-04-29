// client/src/pages/AllProductsHub.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import {
  Grid,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  Star,
  ShoppingBag,
  Palette,
  Package,
  Loader2,
  SlidersHorizontal,
  CheckCircle,
  Clock,
  Trophy,
  Flame,
  TrendingDown,
  Tag,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Filter
} from "lucide-react";

import { 
  fetchCommonSavedData,
  selectCommonSavedData,
  selectCommonSavedDataLoading,
  selectCommonSavedDataError
} from "../redux/slices/commonproducts.js";
import { 
  addToCart, 
  selectCartItems,
  selectCartLoading 
} from "../redux/slices/Cartslice.js";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";

// All products specific color palette - More muted, professional colors
const ALL_PRODUCTS_COLORS = {
  primary: {
    DEFAULT: 'rgb(79 70 229)',
    light: 'rgb(129 140 248)',
    dark: 'rgb(67 56 202)'
  }
};

// Sort options for all products
const ALL_PRODUCTS_SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Sparkles },
  { id: 'newest', name: 'New Arrivals', icon: Clock },
  { id: 'best-sellers', name: 'Best Sellers', icon: Trophy },
  { id: 'trending', name: 'Trending', icon: Flame },
  { id: 'best-rated', name: 'Best Rated', icon: Star },
  { id: 'price-low', name: 'Price: Low to High', icon: TrendingDown },
  { id: 'price-high', name: 'Price: High to Low', icon: TrendingUp }
];

// Price ranges for all products
const ALL_PRODUCTS_PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2500', min: 1000, max: 2500 },
  { label: '₹2500 - ₹5000', min: 2500, max: 5000 },
  { label: '₹5000+', min: 5000, max: 10000 }
];

export default function AllProductsHub() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL parameters
  const urlFilter = searchParams.get('filter');
  const urlCategory = searchParams.get('category');
  const urlSubCategory = searchParams.get('subCategory');
  const urlPriceMin = searchParams.get('price_min');
  const urlPriceMax = searchParams.get('price_max');
  const urlSort = searchParams.get('sort');
  const urlType = searchParams.get('type');
  const urlRating = searchParams.get('rating');
  const urlSearch = searchParams.get('search');
  
  // State
  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [sortOption, setSortOption] = useState(
    urlFilter === 'newArrivals' ? 'newest' :
    urlFilter === 'bestSellers' ? 'best-sellers' :
    urlFilter === 'trending' ? 'trending' :
    urlSort || 'featured'
  );
  const [priceRange, setPriceRange] = useState([
    urlPriceMin ? parseInt(urlPriceMin) : 0,
    urlPriceMax ? parseInt(urlPriceMax) : 10000
  ]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [productTypeFilter, setProductTypeFilter] = useState(
    urlType === 'design' ? 'design' :
    urlType === 'readymade' ? 'readymade' : 'all'
  );
  const [ratingFilter, setRatingFilter] = useState(
    urlRating ? parseInt(urlRating) : 0
  );
  const [selectedCommonCategory, setSelectedCommonCategory] = useState(urlCategory || 'all');
  const [selectedCommonSubCategory, setSelectedCommonSubCategory] = useState(urlSubCategory || 'all');
  const [quickPriceRange, setQuickPriceRange] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [addedProductName, setAddedProductName] = useState('');
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleProductCount, setVisibleProductCount] = useState(24);
  
  // Determine what to show
  const showCategoryTiles = 
    selectedCommonCategory === "all" &&
    selectedCommonSubCategory === "all" &&
    !searchQuery?.trim() &&
    !urlFilter;

  const showSubCategoryTiles =
    selectedCommonCategory !== "all" &&
    selectedCommonSubCategory === "all" &&
    !searchQuery?.trim() &&
    !urlFilter;

  // Redux state
  const commonSavedData = useSelector(selectCommonSavedData);
  const commonLoading = useSelector(selectCommonSavedDataLoading);
  const commonError = useSelector(selectCommonSavedDataError);
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const token = useSelector(selectCurrentToken);
  
  // Consolidated filter state for URL updates
  const [filters, setFilters] = useState({
    search: urlSearch || '',
    sort: urlSort || 'featured',
    type: urlType || 'all',
    category: urlCategory || 'all',
    subCategory: urlSubCategory || 'all',
    price_min: urlPriceMin ? parseInt(urlPriceMin) : 0,
    price_max: urlPriceMax ? parseInt(urlPriceMax) : 10000,
    rating: urlRating ? parseInt(urlRating) : 0,
    filter: urlFilter || ''
  });
  
  // Debounced URL update function
  const updateURLParams = useCallback((newFilters = {}) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Single useEffect to handle URL updates with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      
      // Set filter param based on sort option
      let filterParam = '';
      switch(filters.sort) {
        case 'newest':
          filterParam = 'newArrivals';
          break;
        case 'best-sellers':
          filterParam = 'bestSellers';
          break;
        case 'trending':
          filterParam = 'trending';
          break;
        default:
          filterParam = filters.filter;
      }
      
      // Add all parameters
      if (filterParam) params.set('filter', filterParam);
      
      if (filters.sort && filters.sort !== 'featured') {
        params.set('sort', filters.sort);
      }
      
      if (filters.category && filters.category !== 'all') {
        params.set('category', filters.category);
      }
      
      if (filters.category !== 'all' && filters.subCategory && filters.subCategory !== 'all') {
        params.set('subCategory', filters.subCategory);
      }
      
      if (filters.type && filters.type !== 'all') {
        params.set('type', filters.type);
      }
      
      if (filters.price_min > 0 || filters.price_max < 10000) {
        params.set('price_min', filters.price_min);
        params.set('price_max', filters.price_max);
      }
      
      if (filters.rating > 0) {
        params.set('rating', filters.rating);
      }
      
      if (filters.search) {
        params.set('search', filters.search);
      }
      
      setSearchParams(params, { replace: true });
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [filters, setSearchParams]);
  
  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchCommonSavedData({ page: 1 }));
  }, [dispatch]);
  
  // Update local state when URL changes
  useEffect(() => {
    setSearchQuery(urlSearch || '');
    setProductTypeFilter(urlType === 'design' ? 'design' : urlType === 'readymade' ? 'readymade' : 'all');
    setSelectedCommonCategory(urlCategory || 'all');
    setSelectedCommonSubCategory(urlSubCategory || 'all');
    setRatingFilter(urlRating ? parseInt(urlRating) : 0);
    setPriceRange([
      urlPriceMin ? parseInt(urlPriceMin) : 0,
      urlPriceMax ? parseInt(urlPriceMax) : 10000
    ]);
    
    // Determine sort option from URL
    let sortFromUrl = urlSort || 'featured';
    if (urlFilter === 'newArrivals') sortFromUrl = 'newest';
    if (urlFilter === 'bestSellers') sortFromUrl = 'best-sellers';
    if (urlFilter === 'trending') sortFromUrl = 'trending';
    setSortOption(sortFromUrl);
    
    // Update filters state
    setFilters({
      search: urlSearch || '',
      sort: sortFromUrl,
      type: urlType || 'all',
      category: urlCategory || 'all',
      subCategory: urlSubCategory || 'all',
      price_min: urlPriceMin ? parseInt(urlPriceMin) : 0,
      price_max: urlPriceMax ? parseInt(urlPriceMax) : 10000,
      rating: urlRating ? parseInt(urlRating) : 0,
      filter: urlFilter || ''
    });
  }, [urlFilter, urlCategory, urlSubCategory, urlPriceMin, urlPriceMax, urlSort, urlType, urlRating, urlSearch]);
  
  // Handle filter changes
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    updateURLParams({ search: value });
  };
  
  const handleSortChange = (value) => {
    setSortOption(value);
    updateURLParams({ sort: value });
  };
  
  const handleProductTypeChange = (value) => {
    setProductTypeFilter(value);
    updateURLParams({ type: value });
  };
  
  const handleCategoryChange = (value) => {
    setSelectedCommonCategory(value);
    setSelectedCommonSubCategory('all');
    updateURLParams({ category: value, subCategory: 'all' });
  };
  
  const handleSubCategoryChange = (value) => {
    setSelectedCommonSubCategory(value);
    updateURLParams({ subCategory: value });
  };
  
  const selectCategory = (value, closeMobile = false) => {
    handleCategoryChange(value);
    if (closeMobile) {
      setShowMobileFilters(false);
    }
  };

  const selectSubCategory = (value, closeMobile = false) => {
    handleSubCategoryChange(value);
    if (closeMobile) {
      setShowMobileFilters(false);
    }
  };

  const handlePriceRangeChange = (range) => {
    setPriceRange(range);
    updateURLParams({ price_min: range[0], price_max: range[1] });
  };
  
  const handleRatingChange = (value) => {
    setRatingFilter(value);
    updateURLParams({ rating: value });
  };
  
  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...commonSavedData];
    
    // Apply URL filter
    if (urlFilter) {
      filtered = filtered.filter(item => {
        const isNewArrival = item.newArrival || item.raw?.newArrival || item.raw?.newArrivals || false;
        const isBestSeller = item.bestSeller || item.raw?.bestSeller || item.raw?.bestSellers || false;
        const isTrending = item.trending || item.raw?.trending || false;
        
        switch(urlFilter) {
          case 'newArrivals':
            return isNewArrival;
          case 'bestSellers':
            return isBestSeller;
          case 'trending':
            return isTrending;
          default:
            return true;
        }
      });
    }
    
    // Apply product type filter
    if (productTypeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === productTypeFilter);
    }
    
    // Apply category filter
    if (selectedCommonCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCommonCategory);
    }
    
    // Apply subcategory filter
    if (selectedCommonSubCategory !== 'all') {
      filtered = filtered.filter(item => item.subCategory === selectedCommonSubCategory);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => {
        const name = item.title || '';
        const description = item.description || '';
        const category = item.category || '';
        const subCategory = item.subCategory || '';
        
        const searchLower = searchQuery.toLowerCase();
        return name.toLowerCase().includes(searchLower) ||
               description.toLowerCase().includes(searchLower) ||
               category.toLowerCase().includes(searchLower) ||
               subCategory.toLowerCase().includes(searchLower);
      });
    }
    
    // Apply price range filter
    filtered = filtered.filter(item => {
      const price = item.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Apply rating filter
    if (ratingFilter > 0) {
      filtered = filtered.filter(item => {
        const rating = item.rating || 0;
        return rating >= ratingFilter;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      const salesA = a.totalSales || 0;
      const salesB = b.totalSales || 0;
      
      const isNewArrivalA = a.newArrival || a.raw?.newArrival || a.raw?.newArrivals || false;
      const isNewArrivalB = b.newArrival || b.raw?.newArrival || b.raw?.newArrivals || false;
      
      const isBestSellerA = a.bestSeller || a.raw?.bestSeller || a.raw?.bestSellers || false;
      const isBestSellerB = b.bestSeller || b.raw?.bestSeller || b.raw?.bestSellers || false;
      
      const isFeaturedA = a.featured || a.raw?.featured || false;
      const isFeaturedB = b.featured || b.raw?.featured || false;
      
      const isTrendingA = a.trending || a.raw?.trending || false;
      const isTrendingB = b.trending || b.raw?.trending || false;
      
      switch (sortOption) {
        case 'price-low':
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'best-rated':
          return ratingB - ratingA;
        case 'newest':
          if (isNewArrivalA && !isNewArrivalB) return -1;
          if (!isNewArrivalA && isNewArrivalB) return 1;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'best-sellers':
          if (isBestSellerA && !isBestSellerB) return -1;
          if (!isBestSellerA && isBestSellerB) return 1;
          return salesB - salesA;
        case 'trending':
          const trendScoreA = (isTrendingA ? 5 : 0) + (isNewArrivalA ? 3 : 0) + salesA;
          const trendScoreB = (isTrendingB ? 5 : 0) + (isNewArrivalB ? 3 : 0) + salesB;
          return trendScoreB - trendScoreA;
        case 'featured':
        default:
          const featuredA = (isFeaturedA ? 5 : 0) + (isNewArrivalA ? 3 : 0) + (isBestSellerA ? 2 : 0);
          const featuredB = (isFeaturedB ? 5 : 0) + (isNewArrivalB ? 3 : 0) + (isBestSellerB ? 2 : 0);
          return featuredB - featuredA;
      }
    });
    
    return filtered;
  }, [
    commonSavedData,
    productTypeFilter,
    selectedCommonCategory,
    selectedCommonSubCategory,
    searchQuery,
    priceRange,
    ratingFilter,
    sortOption,
    urlFilter
  ]);
  
  // Helper functions
  const getImageUrl = useCallback(
    (imagePath) =>
      buildImageUrl(imagePath) ||
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    []
  );

  const getCardImageProps = useCallback(
    (image, sizes) =>
      getResponsiveImageProps(image, {
        sizes,
        loading: "lazy",
      }),
    []
  );

  // Get categories with thumbnails
  const getCategoriesWithThumbnails = useMemo(() => {
    const categoryMap = new Map();
    
    commonSavedData.forEach((item) => {
      if (item.category) {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, {
            name: item.category,
            count: 0,
            thumbnail: item.categoryThumbnail || item.raw?.categoryThumbnail || null,
            altText: item.categoryAltText || item.category,
          });
        }
        
        const entry = categoryMap.get(item.category);
        entry.count += 1;
        
        // Prefer first item's thumbnail if no category thumbnail exists
        if (!entry.thumbnail && (item.previewImage || item.raw?.images?.[0])) {
          entry.thumbnail = item.previewImage || item.raw?.images?.[0];
        }
      }
    });
    
    return Array.from(categoryMap.values());
  }, [commonSavedData]);
  
  const getCartQuantityForCommon = (item) => {
    if (item.type === 'design') {
      const cartItem = cartItems.find(cart => cart.designId === item._id);
      return cartItem ? cartItem.qty : 0;
    } else if (item.type === 'readymade') {
      const cartItem = cartItems.find(cart => 
        cart.kind === "READYMADE" && 
        cart.readymadeProduct?._id === item._id
      );
      return cartItem ? cartItem.qty : 0;
    }
    return 0;
  };
  
  const handleAddToCart = async (item) => {
    try {
      setAddingToCartId(item._id);
      let cartData;
      
      if (item.type === 'design') {
        cartData = {
          designId: item._id,
          productId: item.raw?.product?._id || item.raw?.productId,
          title: item.title || item.raw?.productName,
          unitPrice: item.price || item.raw?.salePrice || 0,
          qty: 1,
          previewImage: item.previewImage || null,
          signature: `${item._id}-${item.raw?.product?._id || item.raw?.productId}`,
          views: item.raw?.views || [],
          kind: "DESIGN"
        };
      } else if (item.type === 'readymade') {
        cartData = {
          kind: "READYMADE",
          qty: 1,
          readymadeProductId: item._id,
          title: item.title,
          unitPrice: item.price || 0,
          previewImage: item.previewImage || null,
          size: item.raw?.sizes?.[0] || 'M',
          color: item.raw?.colors?.[0] || 'Black'
        };
      }
      
      await dispatch(addToCart(cartData)).unwrap();
      setAddedProductName(item.title);
      setShowCartSuccess(true);
      
      setTimeout(() => {
        setShowCartSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert(`Failed to add to cart: ${error.message || 'Please try again'}`);
    } finally {
      setAddingToCartId(null);
    }
  };
  
  const getCommonCategories = useMemo(() => {
    const categories = new Map();
    commonSavedData.forEach(item => {
      if (item.category) {
        const count = categories.get(item.category) || 0;
        categories.set(item.category, count + 1);
      }
    });
    return Array.from(categories.entries()).map(([name, count]) => ({ name, count }));
  }, [commonSavedData]);
  
  const getCommonSubcategories = useMemo(() => {
    if (selectedCommonCategory === "all") return [];

    const map = new Map();

    commonSavedData.forEach((item) => {
      if (
        item.category === selectedCommonCategory &&
        item.subCategory
      ) {
        if (!map.has(item.subCategory)) {
          map.set(item.subCategory, {
            name: item.subCategory,
            count: 0,
            thumb: item.subCategoryThumbnail || null,
            altText: item.subCategoryAltText || item.subCategory || "",
          });
        }

        const entry = map.get(item.subCategory);
        entry.count += 1;
      }
    });

    return Array.from(map.values());
  }, [commonSavedData, selectedCommonCategory]);

  useEffect(() => {
    setVisibleProductCount(24);
  }, [
    searchQuery,
    sortOption,
    productTypeFilter,
    selectedCommonCategory,
    selectedCommonSubCategory,
    ratingFilter,
    priceRange,
    urlFilter,
  ]);

  const visibleProducts = filteredProducts.slice(0, visibleProductCount);
  
  const applyQuickPriceRange = (range) => {
    setQuickPriceRange(range.label);
    setPriceRange([range.min, range.max]);
    updateURLParams({ price_min: range.min, price_max: range.max });
  };
  
  const toggleCategoryExpansion = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  const handleClearFilters = () => {
    setSearchQuery('');
    setSortOption('featured');
    setPriceRange([0, 10000]);
    setProductTypeFilter('all');
    setSelectedCommonCategory('all');
    setSelectedCommonSubCategory('all');
    setRatingFilter(0);
    setQuickPriceRange(null);
    setExpandedCategories({});
    
    updateURLParams({
      search: '',
      sort: 'featured',
      type: 'all',
      category: 'all',
      subCategory: 'all',
      price_min: 0,
      price_max: 10000,
      rating: 0,
      filter: ''
    });
  };
  
  // Loading state
  if (commonLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (commonError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-lg text-white font-bold">!</span>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Error Loading Products</h3>
          <p className="text-gray-600 mb-4">{commonError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cart Success Notification */}
      {showCartSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg shadow-lg max-w-sm flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Added to Cart</p>
              <p className="text-xs text-gray-600 mt-0.5">"{addedProductName}"</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileFilters(false)}
          />

          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl">
            <div className="h-full flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-medium text-gray-900">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-1">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">

                {/* Category Filter */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Categories
                  </h3>

                  <div className="space-y-2">
                    <button
                      onClick={() => selectCategory('all', true)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm ${
                        selectedCommonCategory === 'all'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>All Categories</span>
                    </button>

                    {getCommonCategories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => selectCategory(category.name, true)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm ${
                          selectedCommonCategory === category.name
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{category.name}</span>
                      </button>
                    ))}
                  </div>

                  {selectedCommonCategory !== 'all' &&
                    getCommonSubcategories.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Subcategories
                        </p>

                        <div className="space-y-1">
                          <button
                            onClick={() => selectSubCategory('all', true)}
                            className={`w-full text-left px-3 py-2 rounded text-sm ${
                              selectedCommonSubCategory === 'all'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            All Subcategories
                          </button>

                          {getCommonSubcategories.map((sub) => (
                            <button
                              key={sub.name}
                              onClick={() => selectSubCategory(sub.name, true)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm ${
                                selectedCommonSubCategory === sub.name
                                  ? 'bg-gray-900 text-white'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span>{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Price Range
                  </h3>

                  <div className="space-y-2">
                    {ALL_PRODUCTS_PRICE_RANGES.map((range) => (
                      <button
                        key={range.label}
                        onClick={() => {
                          applyQuickPriceRange(range);
                          setShowMobileFilters(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          quickPriceRange === range.label
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                <button
                  onClick={() => {
                    handleClearFilters();
                    setShowMobileFilters(false);
                  }}
                  className="w-full py-2.5 border border-gray-300 text-gray-700 rounded font-medium text-sm hover:bg-gray-50"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="relative">
            <div className="relative bg-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search all products..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-transparent text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-6">
          {/* Sidebar Filters - Desktop */}
          <div className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-20">
              
              {/* Category Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => selectCategory('all')}
                    className={`w-full flex items-center justify-between p-2.5 rounded text-sm ${
                      selectedCommonCategory === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>All Categories</span>
                  </button>
                  {getCommonCategories.map((category) => (
                    <button
                      key={category.name}
                      onClick={() => selectCategory(category.name)}
                      className={`w-full flex items-center justify-between p-2.5 rounded text-sm ${
                        selectedCommonCategory === category.name
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>

                {selectedCommonCategory !== 'all' && getCommonSubcategories.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Subcategories</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => selectSubCategory('all')}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedCommonSubCategory === 'all'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All Subcategories
                      </button>
                      {getCommonSubcategories.map((sub) => (
                        <button
                          key={sub.name}
                          onClick={() => selectSubCategory(sub.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm ${
                            selectedCommonSubCategory === sub.name
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span>{sub.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Price Range</h3>
                <div className="space-y-2">
                  {ALL_PRODUCTS_PRICE_RANGES.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => applyQuickPriceRange(range)}
                      className={`w-full text-left p-2.5 rounded text-sm ${
                        quickPriceRange === range.label
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Sort Options */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sort By</h3>
                <div className="space-y-2">
                  {ALL_PRODUCTS_SORT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSortChange(option.id)}
                        className={`w-full flex items-center gap-2 p-2.5 rounded text-sm ${
                          sortOption === option.id
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{option.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <button
                onClick={handleClearFilters}
                className="w-full py-2.5 border border-gray-300 text-gray-700 rounded font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1">
            {/* Mobile Controls */}
            <div className="lg:hidden mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMobileFilters(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>
                  <div className="relative">
                    <select
                      value={sortOption}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                    >
                      {ALL_PRODUCTS_SORT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {filteredProducts.length} products
                </div>
              </div>
            </div>
            
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-medium text-gray-900">All Products</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredProducts.length} products
                  {productTypeFilter !== 'all' && (
                    <span className="ml-2">• {productTypeFilter === 'design' ? 'Designs Only' : 'Readymade Only'}</span>
                  )}
                </p>
              </div>
            </div>
            
            {/* Active Filters */}
            {(selectedCommonCategory !== 'all' || selectedCommonSubCategory !== 'all' || 
              searchQuery || productTypeFilter !== 'all' || ratingFilter > 0 || 
              priceRange[1] < 10000 || quickPriceRange || urlFilter) && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {urlFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {urlFilter === 'newArrivals' ? 'New Arrivals' : 
                       urlFilter === 'bestSellers' ? 'Best Sellers' : 
                       urlFilter === 'trending' ? 'Trending' : urlFilter}
                      <button onClick={() => handleSortChange('featured')} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  
                  {productTypeFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {productTypeFilter === 'design' ? 'Designs Only' : 'Readymade Only'}
                      <button onClick={() => handleProductTypeChange('all')} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  
                  {quickPriceRange && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      Price: {quickPriceRange}
                      <button onClick={() => {
                        setQuickPriceRange(null);
                        handlePriceRangeChange([0, 10000]);
                      }} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Products Grid OR Category Tiles OR Subcategory Tiles */}
            {showCategoryTiles ? (
              // Category tiles view (similar to subcategory tiles design)
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Browse Categories
                  </h2>
                  <p className="text-sm text-gray-600">
                    {getCategoriesWithThumbnails.length} categories
                  </p>
                </div>

                {getCategoriesWithThumbnails.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      No categories found
                    </h3>
                    <p className="text-sm text-gray-600">
                      Categories will appear here once products are added.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getCategoriesWithThumbnails.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => selectCategory(category.name)}
                        className="group bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all duration-200 overflow-hidden text-left"
                      >
                        <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden">
                          {(() => {
                            const imageProps = getCardImageProps(
                              category.thumbnail,
                              "(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                            );

                            return category.thumbnail ? (
                              <img
                                src={imageProps.src || getImageUrl(category.thumbnail)}
                                srcSet={imageProps.srcSet}
                                sizes={imageProps.sizes}
                                alt={category.altText || category.name}
                                loading={imageProps.loading}
                                decoding={imageProps.decoding}
                                fetchPriority={imageProps.fetchPriority}
                                className="max-h-[85%] max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-105"
                                style={
                                  imageProps.placeholder
                                    ? {
                                        backgroundImage: `url(${imageProps.placeholder})`,
                                        backgroundPosition: "center",
                                        backgroundSize: "cover",
                                      }
                                    : undefined
                                }
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                  const parent = e.target.parentElement;
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-full h-full flex items-center justify-center bg-gray-100';
                                  fallback.innerHTML = `<span class="text-4xl text-gray-400 font-medium">${category.name.charAt(0).toUpperCase()}</span>`;
                                  parent.appendChild(fallback);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                <span className="text-4xl text-gray-400 font-medium">
                                  {category.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            );
                          })()}
                          <div className="absolute inset-0 ring-1 ring-gray-200" />
                        </div>
                        <div className="p-3">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                            {category.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {category.count} products
                          </p>

                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-700 group-hover:text-gray-900">
                            Browse category
                            <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : showSubCategoryTiles ? (
              // Subcategory tiles view
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCommonCategory} Subcategories
                  </h2>
                  <p className="text-sm text-gray-600">
                    {getCommonSubcategories.length} subcategories
                  </p>
                </div>

                {getCommonSubcategories.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      No subcategories found
                    </h3>
                    <p className="text-sm text-gray-600">
                      This category does not have subcategories yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getCommonSubcategories.map((sub) => (
                      <button
                        key={sub.name}
                        onClick={() => selectSubCategory(sub.name)}
                        className="group bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all duration-200 overflow-hidden text-left"
                      >
                        <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden">
                          {(() => {
                            const imageProps = getCardImageProps(
                              sub.thumb,
                              "(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                            );

                            return sub.thumb ? (
                              <img
                                src={imageProps.src || getImageUrl(sub.thumb)}
                                srcSet={imageProps.srcSet}
                                sizes={imageProps.sizes}
                                alt={sub.altText || sub.name}
                                loading={imageProps.loading}
                                decoding={imageProps.decoding}
                                fetchPriority={imageProps.fetchPriority}
                                className="max-h-[85%] max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-105"
                                style={
                                  imageProps.placeholder
                                    ? {
                                        backgroundImage: `url(${imageProps.placeholder})`,
                                        backgroundPosition: "center",
                                        backgroundSize: "cover",
                                      }
                                    : undefined
                                }
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                  const parent = e.target.parentElement;
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-full h-full flex items-center justify-center bg-gray-100';
                                  fallback.innerHTML = `<span class="text-4xl text-gray-400 font-medium">${sub.name.charAt(0).toUpperCase()}</span>`;
                                  parent.appendChild(fallback);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                <span className="text-4xl text-gray-400 font-medium">
                                  {sub.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            );
                          })()}
                          <div className="absolute inset-0 ring-1 ring-gray-200" />
                        </div>
                        <div className="p-3">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                            {sub.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {sub.count} products
                          </p>

                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-700 group-hover:text-gray-900">
                            View products
                            <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Products view (your existing product list)
              filteredProducts.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No products found</h3>
                  <p className="text-gray-600 mb-6 text-sm">
                    Try adjusting your search or filter criteria
                  </p>
                  <button
                    onClick={handleClearFilters}
                    className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium text-sm"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleProducts.map((product) => {
                    const isInCart = getCartQuantityForCommon(product) > 0;
                    const currentPrice =
                      product.type === "readymade"
                        ? Number(product.raw?.effectivePrice ?? product.price ?? 0)
                        : Number(product.price || 0);
                    const originalPrice =
                      product.type === "readymade"
                        ? Number(product.raw?.mrp ?? product.raw?.originalPrice ?? product.price ?? 0)
                        : 0;
                    const discountPercent =
                      product.type === "readymade" && originalPrice > currentPrice
                        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
                        : 0;

                    const displayPrice = product.type === "readymade" ? currentPrice : Number(product.price || 0);
                    const displayOriginalPrice = product.type === "readymade" ? originalPrice : 0;
                    const previewImage = product.previewImage || product.raw?.images?.[0];
                    const imageProps = getCardImageProps(
                      previewImage,
                      "(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                    );
                    return (
                      <div
                        key={product._id}
                        className="group bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all duration-200 overflow-hidden"
                      >
                        <Link
                          to={
                            product.type === "readymade"
                              ? (buildReadymadeProductPath(product) || `/readymade/${product._id}`)
                              : `/catalogue/${product._id}`
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden rounded-t-xl">
                            <img
                              src={imageProps.src || getImageUrl(previewImage)}
                              srcSet={imageProps.srcSet}
                              sizes={imageProps.sizes}
                              alt={
                                product.raw?.images?.[0]?.altText ||
                                product.title ||
                                "Product image"
                              }
                              loading={imageProps.loading}
                              decoding={imageProps.decoding}
                              fetchPriority={imageProps.fetchPriority}
                              className="max-h-[85%] max-w-[85%] object-contain"
                              style={
                                imageProps.placeholder
                                  ? {
                                      backgroundImage: `url(${imageProps.placeholder})`,
                                      backgroundPosition: "center",
                                      backgroundSize: "cover",
                                    }
                                  : undefined
                              }
                            />

                            <div className="absolute inset-0 ring-1 ring-gray-200" />

                            <div className="absolute top-2 left-2 flex flex-col gap-2 z-10">
                              {product.bestSeller && (
                                <span className="px-2 py-1 text-[11px] font-semibold bg-orange-500 text-white rounded-md">
                                  Best Seller
                                </span>
                              )}

                              {product.customerFave && (
                                <span className="px-2 py-1 text-[11px] font-semibold bg-pink-500 text-white rounded-md">
                                  Customer Fave
                                </span>
                              )}

                              {product.staffPick && (
                                <span className="px-2 py-1 text-[11px] font-semibold bg-indigo-500 text-white rounded-md">
                                  Staff Pick
                                </span>
                              )}
                            </div>

                            {discountPercent > 0 && (
                              <span className="absolute top-2 right-2 z-10 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                                {discountPercent}% OFF
                              </span>
                            )}

                            {product.ecoFriendly && (
                              <span className="absolute bottom-2 right-2 px-2 py-1 text-[11px] font-medium bg-green-100 text-green-700 rounded-md">
                                🌿 Eco-friendly
                              </span>
                            )}
                          </div>
                        </Link>
                        <div className="p-3">
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">
                              {product.category || "Uncategorized"}
                            </p>
                            <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                              {product.title || "Unnamed Product"}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-gray-900">
                                  ₹{displayPrice.toLocaleString()}
                                </span>

                                {discountPercent > 0 && (
                                  <span className="text-xs text-gray-400 line-through">
                                    ₹{displayOriginalPrice.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {discountPercent > 0 && (
                                <p className="text-[10px] font-medium text-emerald-700 mt-0.5">
                                  {discountPercent}% OFF
                                </p>
                              )}
                              {/* <p className="text-[10px] text-gray-500 mt-0.5">
                                incl. taxes
                              </p> */}
                            </div>
                          </div>

                          <div className="mt-3">
                            <Link
                              to={
                                product.type === "readymade"
                                  ? (buildReadymadeProductPath(product) || `/readymade/${product._id}`)
                                  : `/catalogue/${product._id}`
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
                            >
                              View Details
                              <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  {filteredProducts.length > visibleProducts.length && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setVisibleProductCount((count) => count + 24)}
                        className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Load More Products
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
