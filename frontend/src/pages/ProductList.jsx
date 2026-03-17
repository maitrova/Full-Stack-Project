// client/src/pages/UnifiedProductHub.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
  Zap,
  Shield,
  Truck,
  Eye,
  Heart,
  ShoppingCart,
  Loader2,
  SlidersHorizontal,
  CheckCircle,
  Clock,
  Trophy,
  Flame,
  TrendingDown,
  Filter,
  BadgeCheck,
  Award,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Settings,
  Grid3x3
} from "lucide-react";

// Import actions from different slices
import { fetchProducts, fetchProductCategories } from "../redux/slices/productsSlice.js";

// Import common saved data slice
import { 
  fetchCommonSavedData,
  selectCommonSavedData,
  selectCommonSavedDataLoading,
  selectCommonSavedDataError,
  updateFilters as updateCommonFilters,
  resetCommonSavedData
} from "../redux/slices/commonproducts.js";

// Import cart actions
import { 
  addToCart, 
  selectCartItems,
  selectCartLoading,
  selectCartError,
  selectCartSuccess,
  clearError,
  clearSuccess 
} from "../redux/slices/Cartslice.js";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";

// Modern professional color palette
const MODERN_COLORS = {
  primary: {
    DEFAULT: 'rgb(37 99 235)',
    light: 'rgb(59 130 246)',
    dark: 'rgb(29 78 216)'
  },
  secondary: {
    DEFAULT: 'rgb(168 85 247)',
    light: 'rgb(192 132 252)',
    dark: 'rgb(147 51 234)'
  },
  accent: {
    success: 'rgb(16 185 129)',
    warning: 'rgb(245 158 11)',
    error: 'rgb(239 68 68)',
    info: 'rgb(14 165 233)'
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

// Product type definitions - Only two types
const PRODUCT_TYPES = [
  { 
    id: 'custom', 
    name: 'Custom Products', 
    icon: Settings,
    color: MODERN_COLORS.primary.DEFAULT,
    description: 'Design your own personalized products',
    gradient: 'from-blue-600 to-indigo-600'
  },
  { 
    id: 'all', 
    name: 'All Products', 
    icon: Grid3x3,
    color: MODERN_COLORS.secondary.DEFAULT,
    description: 'Browse designs, ready-made & more',
    gradient: 'from-purple-600 to-pink-600'
  }
];

// Sort options
const SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Sparkles },
  { id: 'newest', name: 'New Arrivals', icon: Clock },
  { id: 'best-sellers', name: 'Best Sellers', icon: Trophy },
  { id: 'trending', name: 'Trending', icon: Flame },
  { id: 'best-rated', name: 'Best Rated', icon: Star },
  { id: 'price-low', name: 'Price: Low to High', icon: TrendingDown },
  { id: 'price-high', name: 'Price: High to Low', icon: TrendingUp }
];

// Price ranges for quick selection
const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2500', min: 1000, max: 2500 },
  { label: '₹2500 - ₹5000', min: 2500, max: 5000 },
  { label: '₹5000+', min: 5000, max: 10000 }
];

// Default placeholder image - Higher quality
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop&q=80";

export default function UnifiedProductHub() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read URL parameters
  const urlFilter = searchParams.get('filter');
  const urlCategory = searchParams.get('category');
  const urlSubCategory = searchParams.get('subCategory');
  const urlPriceMin = searchParams.get('price_min');
  const urlPriceMax = searchParams.get('price_max');
  const urlSort = searchParams.get('sort');
  const urlType = searchParams.get('type');
  const urlRating = searchParams.get('rating');
  const urlSearch = searchParams.get('search');
  
  // Product type state - initialize from URL if present
  const [activeProductType, setActiveProductType] = useState(
    urlFilter || urlType || urlCategory ? 'all' : 'custom'
  );
  
  // Common UI states - initialize from URL if present
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
  const [viewMode, setViewMode] = useState('grid');
  const [wishlist, setWishlist] = useState([]);
  const [localCartItems, setLocalCartItems] = useState({});
  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [addedProductName, setAddedProductName] = useState('');
  const [addingToCartId, setAddingToCartId] = useState(null);
  
  // Image slideshow states
  const [imageIndices, setImageIndices] = useState({});
  const [autoSlideIntervals, setAutoSlideIntervals] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  const [visibleCount, setVisibleCount] = useState(12);
  
  // Custom products state
  const { 
    items: customProducts, 
    itemsStatus: customStatus, 
    itemsError: customError,
    categories: backendCategories,
    allSubCategories: backendAllSubCategories,
    categoriesStatus: categoriesStatus,
    categoriesError: categoriesError
  } = useSelector((state) => state.products);
  
  // Common saved data state
  const commonSavedData = useSelector(selectCommonSavedData);
  const commonLoading = useSelector(selectCommonSavedDataLoading);
  const commonError = useSelector(selectCommonSavedDataError);
  
  // Cart state
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);
  
  // Filter states - initialize from URL if present
  const [selectedCategory, setSelectedCategory] = useState(
    activeProductType === 'custom' && urlCategory ? urlCategory : 'all'
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState(
    activeProductType === 'custom' && urlSubCategory ? urlSubCategory : 'all'
  );
  const [productTypeFilter, setProductTypeFilter] = useState(
    urlType === 'design' ? 'design' :
    urlType === 'readymade' ? 'readymade' : 'all'
  );
  const [ratingFilter, setRatingFilter] = useState(
    urlRating ? parseInt(urlRating) : 0
  );
  const [selectedCommonCategory, setSelectedCommonCategory] = useState(
    activeProductType === 'all' && urlCategory ? urlCategory : 'all'
  );
  const [selectedCommonSubCategory, setSelectedCommonSubCategory] = useState(
    activeProductType === 'all' && urlSubCategory ? urlSubCategory : 'all'
  );
  const [quickPriceRange, setQuickPriceRange] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [urlSortOption, setUrlSortOption] = useState(sortOption);

  // State for subcategories of selected category
  const [currentSubcategories, setCurrentSubcategories] = useState([]);

  // State to prevent unnecessary re-fetches
  const [lastFilters, setLastFilters] = useState({});

  // Update URL when filters change
  const updateURLParams = useCallback((newParams = {}) => {
    const params = new URLSearchParams(searchParams);
    
    // Update filter
    if (newParams.filter !== undefined) {
      if (newParams.filter) {
        params.set('filter', newParams.filter);
      } else {
        params.delete('filter');
      }
    }
    
    // Update sort
    if (newParams.sort !== undefined) {
      if (newParams.sort && newParams.sort !== 'featured') {
        params.set('sort', newParams.sort);
      } else {
        params.delete('sort');
      }
    }
    
    // Update category
    if (newParams.category !== undefined) {
      if (newParams.category && newParams.category !== 'all') {
        params.set('category', newParams.category);
      } else {
        params.delete('category');
      }
    }
    
    // Update subCategory
    if (newParams.subCategory !== undefined) {
      if (newParams.subCategory && newParams.subCategory !== 'all') {
        params.set('subCategory', newParams.subCategory);
      } else {
        params.delete('subCategory');
      }
    }
    
    // Update type
    if (newParams.type !== undefined) {
      if (newParams.type && newParams.type !== 'all') {
        params.set('type', newParams.type);
      } else {
        params.delete('type');
      }
    }
    
    // Update price range
    if (newParams.priceRange !== undefined) {
      const [min, max] = newParams.priceRange;
      if (min > 0 || max < 10000) {
        params.set('price_min', min);
        params.set('price_max', max);
      } else {
        params.delete('price_min');
        params.delete('price_max');
      }
    }
    
    // Update rating
    if (newParams.rating !== undefined) {
      if (newParams.rating > 0) {
        params.set('rating', newParams.rating);
      } else {
        params.delete('rating');
      }
    }
    
    // Update search
    if (newParams.search !== undefined) {
      if (newParams.search) {
        params.set('search', newParams.search);
      } else {
        params.delete('search');
      }
    }
    
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Get image URL helper function
  const getImageUrl = useCallback((imagePath) => {
    return buildImageUrl(imagePath) || DEFAULT_PRODUCT_IMAGE;
  }, []);

  // Helper function to extract all images from design views
  const extractDesignImages = useCallback((design) => {
    const images = [];
    
    if (!design) return images;
    
    // Add main preview image from design
    if (design.previewImage) {
      const imgUrl = getImageUrl(design.previewImage);
      if (imgUrl !== DEFAULT_PRODUCT_IMAGE && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }
    
    // Extract images from views array
    if (design.views && Array.isArray(design.views)) {
      design.views.forEach(view => {
        if (view.previewImage) {
          const imgUrl = getImageUrl(view.previewImage);
          if (imgUrl !== DEFAULT_PRODUCT_IMAGE && !images.includes(imgUrl)) {
            images.push(imgUrl);
          }
        }
      });
    }
    
    if (images.length === 0) {
      return [DEFAULT_PRODUCT_IMAGE];
    }
    
    return images;
  }, [getImageUrl]);

  // Helper function to extract images from readymade products
  const extractReadymadeImages = useCallback((product) => {
    const images = [];
    
    if (!product) return images;

    const preferredPreview =
      product.thumbnail ||
      product.previewImage ||
      null;

    if (preferredPreview) {
      if (!images.includes(preferredPreview)) {
        images.push(preferredPreview);
      }
    }
    
    // Add images from images array
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        const rawImagePath = typeof img === "object" ? img.url : img;
        if (rawImagePath && !images.includes(rawImagePath)) {
          images.push(rawImagePath);
        }
      });
    }
    
    if (images.length === 0) {
      return [DEFAULT_PRODUCT_IMAGE];
    }
    
    return images;
  }, [getImageUrl]);

  // Get product images based on type
  const getProductImages = useCallback((product, type) => {
    if (type === 'custom') {
      const image = product.imageUrl || product.image;
      return image ? [getImageUrl(image)] : [DEFAULT_PRODUCT_IMAGE];
    } else {
      const itemType = product.type || 'common';
      
      if (itemType === 'design' && product.raw) {
        return extractDesignImages(product.raw);
      } else if (itemType === 'readymade' && product.raw) {
        return extractReadymadeImages(product.raw);
      }
      
      // Fallback
      const images = [];
      if (product.previewImage) {
        const imgUrl = getImageUrl(product.previewImage);
        if (imgUrl !== DEFAULT_PRODUCT_IMAGE) {
          images.push(imgUrl);
        }
      }
      
      return images.length > 0 ? images : [DEFAULT_PRODUCT_IMAGE];
    }
  }, [getImageUrl, extractDesignImages, extractReadymadeImages]);

  // Fetch data based on active product type
  useEffect(() => {
    console.log("Fetching data for product type:", activeProductType);
    
    if (activeProductType === 'custom') {
      // Always fetch categories when switching to custom
      dispatch(fetchProductCategories());
      
      const filters = {};
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedSubCategory !== 'all') filters.subCategory = selectedSubCategory;
      
      // Check if filters have actually changed before fetching
      const filterKey = JSON.stringify(filters);
      if (filterKey !== lastFilters.custom) {
        console.log("Fetching custom products with filters:", filters);
        dispatch(fetchProducts(filters));
        setLastFilters(prev => ({ ...prev, custom: filterKey }));
      }
    } else if (activeProductType === 'all') {
      console.log("Fetching common saved data");
      dispatch(fetchCommonSavedData({ page: 1 }));
    }
    
    if (isFirstLoad) {
      setIsFirstLoad(false);
    }
    
    // Clean up auto slide intervals
    return () => {
      Object.values(autoSlideIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [activeProductType, dispatch, isFirstLoad, selectedCategory, selectedSubCategory]);

  // Update subcategories when category changes for custom products
  useEffect(() => {
    if (activeProductType === 'custom' && selectedCategory !== 'all') {
      const categoryData = backendCategories?.find(cat => cat.category === selectedCategory);
      if (categoryData) {
        setCurrentSubcategories(categoryData.subCategories || []);
        console.log("Updated subcategories for category", selectedCategory, ":", categoryData.subCategories);
      } else {
        setCurrentSubcategories([]);
        console.log("No category data found for", selectedCategory);
      }
    } else {
      setCurrentSubcategories([]);
    }
  }, [selectedCategory, backendCategories, activeProductType]);

  // Update URL when sort option changes
  useEffect(() => {
    if (sortOption !== urlSortOption) {
      let filterParam = '';
      switch(sortOption) {
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
          filterParam = '';
      }
      
      if (filterParam) {
        updateURLParams({ filter: filterParam, sort: sortOption });
      } else {
        updateURLParams({ filter: '', sort: sortOption });
      }
      
      setUrlSortOption(sortOption);
    }
  }, [sortOption, updateURLParams, urlSortOption]);

  // Update URL when product type filter changes
  useEffect(() => {
    if (activeProductType === 'all') {
      updateURLParams({ type: productTypeFilter });
    }
  }, [productTypeFilter, activeProductType, updateURLParams]);

  // Update URL when category changes
  useEffect(() => {
    if (activeProductType === 'all') {
      updateURLParams({ 
        category: selectedCommonCategory,
        subCategory: selectedCommonCategory !== 'all' ? selectedCommonSubCategory : 'all'
      });
    } else if (activeProductType === 'custom') {
      updateURLParams({ 
        category: selectedCategory,
        subCategory: selectedCategory !== 'all' ? selectedSubCategory : 'all'
      });
    }
  }, [selectedCommonCategory, selectedCommonSubCategory, selectedCategory, selectedSubCategory, activeProductType, updateURLParams]);

  // Update URL when price range changes
  useEffect(() => {
    updateURLParams({ priceRange });
  }, [priceRange, updateURLParams]);

  // Update URL when rating filter changes
  useEffect(() => {
    updateURLParams({ rating: ratingFilter });
  }, [ratingFilter, updateURLParams]);

  // Update URL when search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      updateURLParams({ search: searchQuery });
    }, 500); // Debounce search
    
    return () => clearTimeout(timer);
  }, [searchQuery, updateURLParams]);

  // Handle common saved data filtering with URL support
  const filteredCommonData = useMemo(() => {
    if (activeProductType === 'custom') return [];
    
    let filtered = [...commonSavedData];
    
    // Priority 1: URL filter (if present)
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
      if (productTypeFilter === 'design') {
        filtered = filtered.filter(item => item.type === 'design');
      } else if (productTypeFilter === 'readymade') {
        filtered = filtered.filter(item => item.type === 'readymade');
      }
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
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      const salesA = a.totalSales || 0;
      const salesB = b.totalSales || 0;
      
      // Check for newArrival flag in raw data if not in main object
      const isNewArrivalA = a.newArrival || a.raw?.newArrival || a.raw?.newArrivals || false;
      const isNewArrivalB = b.newArrival || b.raw?.newArrival || b.raw?.newArrivals || false;
      
      // Check for bestSeller flag in raw data if not in main object
      const isBestSellerA = a.bestSeller || a.raw?.bestSeller || a.raw?.bestSellers || false;
      const isBestSellerB = b.bestSeller || b.raw?.bestSeller || b.raw?.bestSellers || false;
      
      // Check for featured flag
      const isFeaturedA = a.featured || a.raw?.featured || false;
      const isFeaturedB = b.featured || b.raw?.featured || false;
      
      // Check for trending flag
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
          // Prioritize new arrivals, then by date
          if (isNewArrivalA && !isNewArrivalB) return -1;
          if (!isNewArrivalA && isNewArrivalB) return 1;
          return dateB - dateA;
        case 'best-sellers':
          // Prioritize best sellers, then by sales count
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
    activeProductType,
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

  // Show cart success message
  useEffect(() => {
    if (cartSuccess) {
      setShowCartSuccess(true);
      const timer = setTimeout(() => {
        setShowCartSuccess(false);
        dispatch(clearSuccess());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [cartSuccess, dispatch]);

  // Clear cart error
  useEffect(() => {
    if (cartError) {
      alert(cartError);
      dispatch(clearError());
    }
  }, [cartError, dispatch]);

  // Get cart quantity for common saved data
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

  // Get product price for common saved data
  const getCommonItemPrice = (item) => {
    return item.price || 0;
  };

  // Calculate discount percentage for common saved data
  const getCommonItemDiscount = (item) => {
    if (item.type === 'readymade' && item.raw) {
      const price = item.price || 0;
      const originalPrice = item.raw.originalPrice || item.raw.mrp || 0;
      if (originalPrice > price) {
        return Math.round(((originalPrice - price) / originalPrice) * 100);
      }
    }
    return 0;
  };

  // Start auto slideshow for a product
  const startAutoSlideshow = useCallback((productId, images) => {
    if (images.length <= 1) return;
    
    // Clear existing interval
    if (autoSlideIntervals[productId]) {
      clearInterval(autoSlideIntervals[productId]);
    }
    
    const interval = setInterval(() => {
      setImageIndices(prev => ({
        ...prev,
        [productId]: ((prev[productId] || 0) + 1) % images.length
      }));
    }, 4000); // 4 seconds interval
    
    setAutoSlideIntervals(prev => ({
      ...prev,
      [productId]: interval
    }));
  }, [autoSlideIntervals]);

  // Stop auto slideshow for a product
  const stopAutoSlideshow = useCallback((productId) => {
    if (autoSlideIntervals[productId]) {
      clearInterval(autoSlideIntervals[productId]);
      setAutoSlideIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[productId];
        return newIntervals;
      });
    }
  }, [autoSlideIntervals]);

  // Cart handler for common saved data
  const handleAddCommonToCart = async (item) => {
    if (!token) {
      alert("Please login to add items to cart");
      return;
    }

    try {
      setAddingToCartId(item._id);
      let cartData;
      
      if (item.type === 'design') {
        cartData = {
          designId: item._id,
          productId: item.raw?.product?._id || item.raw?.productId,
          title: item.title || item.raw?.productName,
          unitPrice: item.price || item.raw?.salePrice || 0,
          basePrice: item.raw?.basePrice || item.price || 0,
          qty: 1,
          previewImage: item.previewImage || null,
          signature: `${item._id}-${item.raw?.product?._id || item.raw?.productId}`,
          views: item.raw?.views || [],
          kind: "DESIGN"
        };
        setLocalCartItems(prev => ({ ...prev, [item._id]: 1 }));
      } else if (item.type === 'readymade') {
        cartData = {
          kind: "READYMADE",
          qty: 1,
          readymadeProductId: item._id,
          title: item.title,
          unitPrice: item.price || 0,
          basePrice: item.raw?.originalPrice || item.raw?.mrp || item.price || 0,
          previewImage: item.previewImage || null,
          size: item.raw?.sizes?.[0] || 'M',
          color: item.raw?.colors?.[0] || 'Black'
        };
      }
      
      await dispatch(addToCart(cartData)).unwrap();
      setAddedProductName(item.title);
      
      if (item.type === 'design') {
        setTimeout(() => {
          setLocalCartItems(prev => {
            const newState = { ...prev };
            delete newState[item._id];
            return newState;
          });
        }, 2000);
      }
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert(`Failed to add to cart: ${error.message || 'Please try again'}`);
      if (item.type === 'design') {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[item._id];
          return newState;
        });
      }
    } finally {
      setAddingToCartId(null);
    }
  };

  // Get unique categories from common saved data
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

  // Get unique subcategories from common saved data
  const getCommonSubcategories = useMemo(() => {
    if (selectedCommonCategory === 'all') return [];
    
    const subcategories = new Map();
    commonSavedData.forEach(item => {
      if (item.category === selectedCommonCategory && item.subCategory) {
        const count = subcategories.get(item.subCategory) || 0;
        subcategories.set(item.subCategory, count + 1);
      }
    });
    return Array.from(subcategories.entries()).map(([name, count]) => ({ name, count }));
  }, [commonSavedData, selectedCommonCategory]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSortOption('featured');
    setPriceRange([0, 10000]);
    setSelectedCategory('all');
    setSelectedSubCategory('all');
    setProductTypeFilter('all');
    setSelectedCommonCategory('all');
    setSelectedCommonSubCategory('all');
    setRatingFilter(0);
    setQuickPriceRange(null);
    setExpandedCategories({});
    setLastFilters({});
    updateURLParams({}); // Clear all URL params
  };

  // Get unique categories for custom products from backend
  const getCustomCategories = () => {
    return Array.isArray(backendCategories) ? backendCategories : [];
  };

  // Handle category change for custom products
  const handleCategoryChange = (category) => {
    console.log("Category changed to:", category);
    setSelectedCategory(category);
    setSelectedSubCategory('all');
    
    if (category === 'all') {
      setCurrentSubcategories([]);
    }
  };

  // Handle subcategory change for custom products
  const handleSubCategoryChange = (subCategory) => {
    console.log("Subcategory changed to:", subCategory);
    setSelectedSubCategory(subCategory);
  };

  // Toggle category expansion
  const toggleCategoryExpansion = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Refresh custom products only when Apply Filters is clicked or product type changes
  const handleApplyCustomFilters = () => {
    if (activeProductType === 'custom') {
      const filters = {};
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedSubCategory !== 'all') filters.subCategory = selectedSubCategory;
      
      const filterKey = JSON.stringify(filters);
      if (filterKey !== lastFilters.custom) {
        console.log("Applying custom filters:", filters);
        dispatch(fetchProducts(filters));
        setLastFilters(prev => ({ ...prev, custom: filterKey }));
      }
    }
  };

  // Apply quick price range
  const applyQuickPriceRange = (range) => {
    setQuickPriceRange(range.label);
    setPriceRange([range.min, range.max]);
  };

  // Get active products based on product type
  const getActiveProducts = () => {
    switch (activeProductType) {
      case 'custom':
        return Array.isArray(customProducts) ? customProducts : [];
      case 'all':
        return filteredCommonData;
      default:
        return [];
    }
  };

  // Get product price based on type
  const getProductPrice = (product, type) => {
    if (type === 'custom') {
      return product.basePrice || product.price || 0;
    } else {
      return getCommonItemPrice(product);
    }
  };

  // Filter products based on active filters
  const filteredProducts = useMemo(() => {
    if (activeProductType === 'all') {
      return filteredCommonData;
    }

    let products = [...getActiveProducts()];
    
    // Apply search filter for custom (client-side only)
    if (searchQuery) {
      products = products.filter(product => {
        const name = product.name || product.title || product.productName || '';
        const desc = product.description || '';
        const category = product.category || '';
        
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
               category.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
    
    // Apply price range filter (client-side only)
    products = products.filter(product => {
      const price = getProductPrice(product, activeProductType);
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Apply rating filter (client-side only)
    if (ratingFilter > 0) {
      products = products.filter(product => {
        const rating = product.rating || 0;
        return rating >= ratingFilter;
      });
    }
    
    // Apply sorting (client-side only)
    products.sort((a, b) => {
      const priceA = getProductPrice(a, activeProductType);
      const priceB = getProductPrice(b, activeProductType);
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      const salesA = a.totalSales || 0;
      const salesB = b.totalSales || 0;
      
      // Check for flags in custom products
      const isNewArrivalA = a.newArrival || a.isNew || false;
      const isNewArrivalB = b.newArrival || b.isNew || false;
      
      const isBestSellerA = a.bestSeller || a.topSelling || false;
      const isBestSellerB = b.bestSeller || b.topSelling || false;
      
      const isFeaturedA = a.featured || a.isFeatured || false;
      const isFeaturedB = b.featured || b.isFeatured || false;
      
      const isTrendingA = a.trending || false;
      const isTrendingB = b.trending || false;
      
      switch (sortOption) {
        case 'price-low':
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'best-rated':
          return ratingB - ratingA;
        case 'newest':
          // Prioritize new arrivals, then by date
          if (isNewArrivalA && !isNewArrivalB) return -1;
          if (!isNewArrivalA && isNewArrivalB) return 1;
          return dateB - dateA;
        case 'best-sellers':
          // Prioritize best sellers, then by sales count
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
    
    return products;
  }, [
    activeProductType,
    customProducts,
    filteredCommonData,
    searchQuery,
    sortOption,
    priceRange,
    ratingFilter
  ]);

  useEffect(() => {
    setVisibleCount(12);
  }, [
    activeProductType,
    searchQuery,
    sortOption,
    priceRange,
    ratingFilter,
    selectedCategory,
    selectedSubCategory,
    selectedCommonCategory,
    selectedCommonSubCategory,
    productTypeFilter,
    urlFilter,
  ]);

  // Loading state
  const isLoading = () => {
    switch (activeProductType) {
      case 'custom': return customStatus === 'loading' || categoriesStatus === 'loading';
      case 'all': return commonLoading;
      default: return false;
    }
  };

  // Error state
  const getError = () => {
    switch (activeProductType) {
      case 'custom': return customError || categoriesError;
      case 'all': return commonError;
      default: return null;
    }
  };

  // Handle image loading
  const handleImageLoad = (productId) => {
    setImageLoading(prev => ({ ...prev, [productId]: false }));
  };

  const handleImageError = (productId) => {
    setImageLoading(prev => ({ ...prev, [productId]: false }));
  };

  // Render product card - Professional version with improved images
  const renderProductCard = (product) => {
    const isCustom = activeProductType === "custom";
    const type = isCustom ? "custom" : product.type || "common";

    const basePrice = getProductPrice(product, activeProductType);
    const originalPrice =
      !isCustom && type === "readymade"
        ? Number(product.raw?.originalPrice || product.raw?.mrp || 0)
        : 0;
    const name = product.title || product.name || product.productName || "Unnamed Product";
    const description = product.description || "";
    const category = product.category || "";
    const subCategory = product.subCategory || "";

    const keyId = product._id || product.slug;
    const isInWishlist = wishlist.includes(keyId);

    const cartQuantity = !isCustom ? getCartQuantityForCommon(product) : 0;
    const isInCart = cartQuantity > 0;
    const isAdding = addingToCartId === product._id;

    const images = getProductImages(product, activeProductType);
    const currentImageIndex = imageIndices[product._id] || 0;
    const currentImage = images[currentImageIndex];
    const imageProps = getResponsiveImageProps(currentImage, {
      sizes: "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw",
    });
    const hasMultipleImages = images.length > 1;
    const isLoadingImage = imageLoading[product._id] !== false;

    // Check flags in both main object and raw object
    const isNewArrival = product.newArrival || product.raw?.newArrival || product.raw?.newArrivals || product.isNew;
    const isBestSeller = product.bestSeller || product.raw?.bestSeller || product.raw?.bestSellers || product.topSelling;
    const isTrending = product.trending || product.raw?.trending;
    const rating = product.rating || product.raw?.rating || 0;
    const discountPercent = !isCustom && type === "readymade" ? getCommonItemDiscount(product) : 0;

    const viewDetailsLink = isCustom
      ? `/products/${product.slug}`
      : type === "readymade"
      ? `/readymade/${product._id}`
      : type === "design"
      ? `/catalogue/${product._id}`
      : "#";

    return (
      <div
        key={product._id}
        className="group bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 overflow-hidden"
        onMouseEnter={() => {
          if (hasMultipleImages) startAutoSlideshow(product._id, images);
        }}
        onMouseLeave={() => {
          if (hasMultipleImages) stopAutoSlideshow(product._id);
        }}
      >
        {/* Image */}
        <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
          {/* Badges */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
            {discountPercent > 0 && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white tracking-wide">
                {discountPercent}% OFF
              </span>
            )}
            {isNewArrival && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-600 text-white tracking-wide">
                NEW
              </span>
            )}
            {isBestSeller && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-wide">
                BEST
              </span>
            )}
            {isTrending && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-pink-600 text-white tracking-wide">
                TREND
              </span>
            )}
          </div>

          {discountPercent > 0 && (
            <span className="absolute top-2 right-2 z-10 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white tracking-wide shadow-sm">
              {discountPercent}% OFF
            </span>
          )}

          {/* Loader */}
          {isLoadingImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            </div>
          )}

          {/* Image */}
          {currentImage ? (
            <>
              <img
                src={imageProps.src || DEFAULT_PRODUCT_IMAGE}
                srcSet={imageProps.srcSet}
                sizes={imageProps.sizes}
                alt={name}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${
                  isLoadingImage ? "opacity-0" : "opacity-100"
                }`}
                style={
                  imageProps.placeholder
                    ? {
                        backgroundImage: `url(${imageProps.placeholder})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }
                    : undefined
                }
                onLoad={() => handleImageLoad(product._id)}
                onError={() => handleImageError(product._id)}
                loading={imageProps.loading}
                decoding={imageProps.decoding}
                fetchPriority={imageProps.fetchPriority}
              />

              {/* Arrows */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopAutoSlideshow(product._id);
                      setImageIndices((prev) => ({
                        ...prev,
                        [product._id]: ((prev[product._id] || 0) - 1 + images.length) % images.length,
                      }));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition bg-white/90 border border-gray-200 rounded-full p-2"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopAutoSlideshow(product._id);
                      setImageIndices((prev) => ({
                        ...prev,
                        [product._id]: ((prev[product._id] || 0) + 1) % images.length,
                      }));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition bg-white/90 border border-gray-200 rounded-full p-2"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </>
              )}

              {/* Dots */}
              {hasMultipleImages && images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        stopAutoSlideshow(product._id);
                        setImageIndices((prev) => ({ ...prev, [product._id]: idx }));
                      }}
                      className={`w-2 h-2 rounded-full transition ${
                        idx === currentImageIndex ? "bg-gray-900" : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">No preview</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          {/* Category + Rating */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">
                {category || "Uncategorized"}
                {subCategory ? <span className="text-gray-300"> • </span> : null}
                {subCategory ? subCategory : null}
              </p>

              <h3 className="mt-1 text-sm font-semibold text-gray-900 line-clamp-1">
                {name}
              </h3>
            </div>

            {rating > 0 && (
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full shrink-0">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
              </div>
            )}
          </div>

          {/* Price + CTA */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-gray-900">
                  ₹{Number(basePrice || 0).toLocaleString()}
                </span>

                {!isCustom &&
                  type === "readymade" &&
                  originalPrice > basePrice && (
                    <span className="text-xs text-gray-400 line-through">
                      ₹{product.raw.originalPrice.toLocaleString()}
                    </span>
                  )}
              </div>
              <p className="text-[11px] text-gray-500">Incl. taxes</p>
            </div>

            {isCustom ? (
              <Link
                to={`/products/${product.slug}/customize`}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition"
              >
                Customize
              </Link>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddCommonToCart(product);
                }}
                disabled={isAdding || cartLoading}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                  isInCart
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-900 text-white hover:bg-black"
                } ${isAdding ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding
                  </>
                ) : isInCart ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Added
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Add
                  </>
                )}
              </button>
            )}
          </div>

          {/* View Details */}
          <div className="mt-3">
            <Link
              to={viewDetailsLink}
              className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              View Details
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Skeleton loader
  const ProductSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="h-72 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg mb-4"></div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="h-6 bg-gray-100 rounded-full w-20"></div>
          <div className="h-6 bg-gray-100 rounded-full w-24"></div>
        </div>
        <div className="h-5 bg-gray-100 rounded w-3/4"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
        <div className="h-8 bg-gray-100 rounded w-1/4"></div>
      </div>
    </div>
  );

  if (isLoading()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-100 rounded-lg w-1/4 mb-8"></div>
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

  const error = getError();
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white font-bold">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Error Loading Products</h3>
          <p className="text-gray-600 mb-6">{error.message || error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-all font-semibold shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const productsToDisplay = filteredProducts;
  const visibleProducts = productsToDisplay.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Cart Success Notification */}
      {showCartSuccess && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-xl shadow-2xl max-w-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold">Added to Cart!</p>
              <p className="text-sm text-emerald-700 mt-1">"{addedProductName}" has been added to your cart</p>
            </div>
            <button
              onClick={() => setShowCartSuccess(false)}
              className="text-emerald-500 hover:text-emerald-700 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex justify-center py-4 px-4">
        <div className="max-w-2xl w-full relative">
          <div className="relative bg-gray-100 border border-gray-300 rounded-2xl overflow-hidden">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />

            <input
              type="text"
              placeholder={`Search ${activeProductType === 'custom' ? 'custom products' : 'all products'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-4 lg:py-6">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
          {/* Sidebar Filters */}
          <div
            className={`${
              showSidebar ? "block" : "hidden lg:block"
            } lg:w-[300px] xl:w-[320px] shrink-0`}
          >
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6 sticky top-5 max-h-[calc(100vh-2.5rem)] overflow-hidden">
              {/* Scrollable sidebar content */}
              <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {/* Header with Product Type Switcher */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Browse Products
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setActiveProductType(type.id);
                          handleClearFilters();
                        }}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                          activeProductType === type.id
                            ? `bg-gradient-to-r ${type.gradient} text-white border-transparent shadow-sm`
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <type.icon
                          className={`w-4 h-4 transition ${
                            activeProductType === type.id
                              ? "text-white"
                              : "text-gray-500 group-hover:text-gray-700"
                          }`}
                        />
                        <span className="truncate">{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Type Filters (for 'all' view) */}
                {activeProductType === "all" && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Filter by Type
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => setProductTypeFilter("all")}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                          productTypeFilter === "all"
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Grid3x3
                            className={`w-4 h-4 ${
                              productTypeFilter === "all"
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              productTypeFilter === "all"
                                ? "text-blue-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            All Products
                          </span>
                        </div>
                        <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {commonSavedData.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setProductTypeFilter("design")}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                          productTypeFilter === "design"
                            ? "bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Palette
                            className={`w-4 h-4 ${
                              productTypeFilter === "design"
                                ? "text-purple-600"
                                : "text-gray-400"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              productTypeFilter === "design"
                                ? "text-purple-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            Designs Only
                          </span>
                        </div>
                        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {commonSavedData.filter((p) => p.type === "design").length}
                        </span>
                      </button>

                      <button
                        onClick={() => setProductTypeFilter("readymade")}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                          productTypeFilter === "readymade"
                            ? "bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Package
                            className={`w-4 h-4 ${
                              productTypeFilter === "readymade"
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              productTypeFilter === "readymade"
                                ? "text-blue-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            Readymade Only
                          </span>
                        </div>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {commonSavedData.filter((p) => p.type === "readymade").length}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Filter */}
                {(activeProductType === "all" || activeProductType === "custom") && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      {activeProductType === "all"
                        ? "Categories"
                        : "Custom Categories"}
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {/* All Categories Button */}
                      <button
                        onClick={() => {
                          if (activeProductType === "all") {
                            setSelectedCommonCategory("all");
                            setSelectedCommonSubCategory("all");
                          } else {
                            handleCategoryChange("all");
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-sm ${
                          (activeProductType === "all" &&
                            selectedCommonCategory === "all") ||
                          (activeProductType === "custom" &&
                            selectedCategory === "all")
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium"
                            : "hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Grid3x3 className="w-4 h-4" />
                          <span>All Categories</span>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {activeProductType === "all"
                            ? commonSavedData.length
                            : Array.isArray(customProducts)
                            ? customProducts.length
                            : 0}
                        </span>
                      </button>

                      {/* Categories List */}
                      {(activeProductType === "all"
                        ? getCommonCategories
                        : getCustomCategories()
                      ).map((category) => {
                        const categoryName =
                          activeProductType === "all"
                            ? category.name
                            : category.category;
                        const categoryCount =
                          activeProductType === "all"
                            ? category.count
                            : category.subCategories?.length || 0;
                        const isSelected =
                          activeProductType === "all"
                            ? selectedCommonCategory === categoryName
                            : selectedCategory === categoryName;
                        const isExpanded = expandedCategories[categoryName];
                        const hasSubcategories =
                          ((activeProductType === "all"
                            ? getCommonSubcategories.length > 0
                            : category.subCategories && category.subCategories.length > 0) &&
                            isSelected);

                        return (
                          <div key={categoryName} className="ml-2">
                            <button
                              onClick={() => {
                                if (activeProductType === "all") {
                                  setSelectedCommonCategory(categoryName);
                                  setSelectedCommonSubCategory("all");
                                  toggleCategoryExpansion(categoryName);
                                } else {
                                  handleCategoryChange(categoryName);
                                  toggleCategoryExpansion(categoryName);
                                }
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-sm ${
                                isSelected
                                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium"
                                  : "hover:bg-gray-50 text-gray-600"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4" />
                                <span className="text-left">{categoryName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {categoryCount}
                                </span>
                                {hasSubcategories &&
                                  (isExpanded ? (
                                    <ChevronUp className="w-3 h-3 text-blue-600" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-gray-400" />
                                  ))}
                              </div>
                            </button>

                            {/* Subcategories */}
                            {hasSubcategories && isExpanded && (
                              <div className="ml-4 mt-1 space-y-1">
                                <button
                                  onClick={() => {
                                    if (activeProductType === "all") {
                                      setSelectedCommonSubCategory("all");
                                    } else {
                                      handleSubCategoryChange("all");
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between p-1.5 rounded transition-all text-xs ${
                                    (activeProductType === "all" &&
                                      selectedCommonSubCategory === "all") ||
                                    (activeProductType === "custom" &&
                                      selectedSubCategory === "all")
                                      ? "bg-blue-100 text-blue-700 font-medium"
                                      : "hover:bg-gray-50 text-gray-500"
                                  }`}
                                >
                                  <span>All Subcategories</span>
                                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {activeProductType === "all"
                                      ? getCommonSubcategories.length
                                      : category.subCategories?.length || 0}
                                  </span>
                                </button>

                                {(activeProductType === "all"
                                  ? getCommonSubcategories
                                  : category.subCategories || []
                                ).map((subCat) => {
                                  const subCatName =
                                    activeProductType === "all"
                                      ? subCat.name
                                      : subCat;
                                  const subCatCount =
                                    activeProductType === "all" ? subCat.count : 1;
                                  const isSubSelected =
                                    activeProductType === "all"
                                      ? selectedCommonSubCategory === subCatName
                                      : selectedSubCategory === subCatName;

                                  return (
                                    <button
                                      key={subCatName}
                                      onClick={() => {
                                        if (activeProductType === "all") {
                                          setSelectedCommonSubCategory(subCatName);
                                        } else {
                                          handleSubCategoryChange(subCatName);
                                        }
                                      }}
                                      className={`w-full flex items-center justify-between p-1.5 rounded transition-all text-xs ${
                                        isSubSelected
                                          ? "bg-blue-100 text-blue-700 font-medium"
                                          : "hover:bg-gray-50 text-gray-500"
                                      }`}
                                    >
                                      <span>{subCatName}</span>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {subCatCount}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Price Range
                  </h3>

                  {/* Quick Price Ranges */}
                  <div className="space-y-2 mb-4">
                    {PRICE_RANGES.map((range) => (
                      <button
                        key={range.label}
                        onClick={() => applyQuickPriceRange(range)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-sm ${
                          quickPriceRange === range.label
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium"
                            : "hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span>{range.label}</span>
                        {quickPriceRange === range.label && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Range Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-600">
                        Custom Range
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        ₹{priceRange[0].toLocaleString()} - ₹
                        {priceRange[1].toLocaleString()}
                      </span>
                    </div>
                    <div className="px-1">
                      <input
                        type="range"
                        min="0"
                        max="10000"
                        step="100"
                        value={priceRange[1]}
                        onChange={(e) => {
                          setQuickPriceRange(null);
                          setPriceRange([priceRange[0], parseInt(e.target.value)]);
                        }}
                        className="w-full h-1.5 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow"
                      />
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>₹0</span>
                        <span>₹2,500</span>
                        <span>₹5,000</span>
                        <span>₹7,500</span>
                        <span>₹10k</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sort Options */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Sort By
                  </h3>
                  <div className="space-y-2">
                    {SORT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setSortOption(option.id)}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-sm ${
                            sortOption === option.id
                              ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium"
                              : "hover:bg-gray-50 text-gray-600"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 ${
                              sortOption === option.id
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          />
                          <span>{option.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Apply Filters Button for Custom Products */}
                {activeProductType === "custom" && (
                  <button
                    onClick={handleApplyCustomFilters}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-all mb-4"
                  >
                    Apply Filters
                  </button>
                )}

                {/* Clear Filters Button */}
                <button
                  onClick={handleClearFilters}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
                >
                  Clear All Filters
                </button>

                {/* Mobile close button */}
                <button
                  onClick={() => setShowSidebar(false)}
                  className="lg:hidden w-full mt-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Results Header */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5 mb-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {activeProductType === "custom" ? "Custom Products" : "All Products"}
                    <span className="text-blue-600 ml-2">
                      ({productsToDisplay.length})
                    </span>
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeProductType === "all" && productTypeFilter !== "all" && (
                      <>
                        Showing{" "}
                        {productTypeFilter === "design"
                          ? "designs"
                          : "readymade products"}{" "}
                        only
                      </>
                    )}
                    {activeProductType === "custom" && (
                      <span className="text-blue-600">
                        {selectedCategory !== "all" && ` • Category: ${selectedCategory}`}
                        {selectedSubCategory !== "all" &&
                          ` • Subcategory: ${selectedSubCategory}`}
                      </span>
                    )}
                    {urlFilter && (
                      <span className="text-green-600 font-medium ml-2">
                        • Filtered by: {urlFilter === 'newArrivals' ? 'New Arrivals' : 
                        urlFilter === 'bestSellers' ? 'Best Sellers' : 
                        urlFilter === 'trending' ? 'Trending' : urlFilter}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Mobile Filter Button */}
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-all"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </button>

                  {/* View Toggle */}
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded transition-all ${
                        viewMode === "grid"
                          ? "bg-white shadow-sm text-blue-600"
                          : "hover:bg-white/50 text-gray-500"
                      }`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filters */}
              {(selectedCategory !== "all" ||
                selectedSubCategory !== "all" ||
                selectedCommonCategory !== "all" ||
                selectedCommonSubCategory !== "all" ||
                searchQuery ||
                productTypeFilter !== "all" ||
                ratingFilter > 0 ||
                priceRange[1] < 10000 ||
                quickPriceRange ||
                urlFilter) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-gray-600 mr-2">
                      Active:
                    </span>

                    {urlFilter && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        {urlFilter === 'newArrivals' ? 'New Arrivals' : 
                         urlFilter === 'bestSellers' ? 'Best Sellers' : 
                         urlFilter === 'trending' ? 'Trending' : urlFilter}
                        <button onClick={() => {
                          updateURLParams({ filter: '' });
                          setSortOption('featured');
                        }}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {activeProductType === "all" && productTypeFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {productTypeFilter === "design"
                          ? "Designs Only"
                          : "Readymade Only"}
                        <button onClick={() => setProductTypeFilter("all")}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {activeProductType === "all" && selectedCommonCategory !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Cat: {selectedCommonCategory}
                        <button onClick={() => setSelectedCommonCategory("all")}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {activeProductType === "all" &&
                      selectedCommonSubCategory !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          Sub: {selectedCommonSubCategory}
                          <button onClick={() => setSelectedCommonSubCategory("all")}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                    {activeProductType === "custom" && selectedCategory !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        Cat: {selectedCategory}
                        <button onClick={() => handleCategoryChange("all")}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {activeProductType === "custom" &&
                      selectedSubCategory !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          Sub: {selectedSubCategory}
                          <button onClick={() => handleSubCategoryChange("all")}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        Search: "{searchQuery}"
                        <button onClick={() => setSearchQuery("")}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {quickPriceRange ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        Price: {quickPriceRange}
                        <button
                          onClick={() => {
                            setQuickPriceRange(null);
                            setPriceRange([0, 10000]);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : (
                      priceRange[1] < 10000 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          Price: Up to ₹{priceRange[1].toLocaleString()}
                          <button onClick={() => setPriceRange([0, 10000])}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    )}

                    {ratingFilter > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                        Rating: {ratingFilter}+
                        <button onClick={() => setRatingFilter(0)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Products Grid */}
            {!Array.isArray(productsToDisplay) || productsToDisplay.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {isLoading() ? "Loading products..." : "No products found"}
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
                  {isLoading()
                    ? "Please wait while we load the products..."
                    : "Try adjusting your search or filter criteria to find what you're looking for."}
                </p>
                {!isLoading() && (
                  <button
                    onClick={handleClearFilters}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm shadow"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
                  {visibleProducts.map((product) => renderProductCard(product))}
                </div>
                {productsToDisplay.length > visibleProducts.length && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setVisibleCount((count) => count + 12)}
                      className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Load More Products
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add some custom animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
