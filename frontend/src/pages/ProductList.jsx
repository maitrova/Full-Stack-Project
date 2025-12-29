// client/src/pages/UnifiedProductHub.jsx
import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { 
  Grid, 
  List, 
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
  Tag,
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
  Layers,
  Filter
} from "lucide-react";

// Import actions from different slices
import { fetchProducts, fetchProductCategories } from "../redux/slices/productsSlice.js";

// Import readymade product actions and selectors
import { 
  fetchAllProducts,
  fetchFilters,
  selectReadymadeProducts,
  selectAllReadymadeProducts,
  selectProductFilters,
  selectProductLoading,
  selectProductError
} from "../redux/slices/productList.js";

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

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

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

// Product type definitions
const PRODUCT_TYPES = [
  { 
    id: 'custom', 
    name: 'Custom Products', 
    icon: ShoppingBag,
    color: MODERN_COLORS.primary.DEFAULT,
    description: 'Design your own custom products'
  },
  { 
    id: 'design', 
    name: 'Design Catalogue', 
    icon: Palette,
    color: MODERN_COLORS.secondary.DEFAULT,
    description: 'Browse pre-designed templates'
  },
  { 
    id: 'readymade', 
    name: 'Ready-made', 
    icon: Package,
    color: MODERN_COLORS.accent.success,
    description: 'Ready to ship products'
  }
];

// Sort options
const SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Sparkles },
  { id: 'price-low', name: 'Price: Low to High', icon: TrendingDown },
  { id: 'price-high', name: 'Price: High to Low', icon: TrendingUp },
  { id: 'best-rated', name: 'Best Rated', icon: Star },
  { id: 'newest', name: 'Newest Arrivals', icon: Clock },
  { id: 'best-sellers', name: 'Best Sellers', icon: Trophy }
];

// Readymade specific filters
const READYMADE_FILTERS = [
  { id: 'all', name: 'All Products', icon: Grid },
  { id: 'new-arrival', name: 'New Arrivals', icon: Clock, color: MODERN_COLORS.accent.success },
  { id: 'best-seller', name: 'Best Sellers', icon: Trophy, color: MODERN_COLORS.accent.warning },
  { id: 'featured', name: 'Featured', icon: Sparkles, color: MODERN_COLORS.primary.DEFAULT },
  { id: 'trending', name: 'Trending', icon: Flame, color: MODERN_COLORS.accent.error }
];

// Default placeholder image
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";

export default function UnifiedProductHub() {
  const dispatch = useDispatch();
  
  // Product type state
  const [activeProductType, setActiveProductType] = useState('custom');
  
  // Common UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('featured');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [wishlist, setWishlist] = useState([]);
  const [localCartItems, setLocalCartItems] = useState({});
  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [addedProductName, setAddedProductName] = useState('');
  const [addingToCartId, setAddingToCartId] = useState(null);
  
  // Image slideshow states
  const [imageIndices, setImageIndices] = useState({});
  const [autoSlideIntervals, setAutoSlideIntervals] = useState({});
  
  // Custom products state - updated to include categories
  const { 
    items: customProducts, 
    itemsStatus: customStatus, 
    itemsError: customError,
    categories: backendCategories,
    allSubCategories: backendAllSubCategories,
    categoriesStatus: categoriesStatus,
    categoriesError: categoriesError
  } = useSelector((state) => state.products);
  
  // Readymade products state
  const readymadeProducts = useSelector(selectReadymadeProducts);
  const allReadymadeProducts = useSelector(selectAllReadymadeProducts);
  const readymadeFilters = useSelector(selectProductFilters);
  const readymadeLoading = useSelector(selectProductLoading);
  const readymadeError = useSelector(selectProductError);
  
  // Catalogue designs state
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [designsError, setDesignsError] = useState("");
  
  // Cart state
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartError = useSelector(selectCartError);
  const cartSuccess = useSelector(selectCartSuccess);
  const token = useSelector(selectCurrentToken);
  
  // Filter states - updated
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [readymadeCategoryFilter, setReadymadeCategoryFilter] = useState('');
  const [readymadeSortFilter, setReadymadeSortFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [filteredReadymadeProducts, setFilteredReadymadeProducts] = useState([]);

  // State for subcategories of selected category
  const [currentSubcategories, setCurrentSubcategories] = useState([]);

  // Fetch data based on active product type
  useEffect(() => {
    console.log("Active product type changed to:", activeProductType);
    
    if (activeProductType === 'custom') {
      // Fetch categories from backend
      dispatch(fetchProductCategories());
      
      // Fetch products with current filters
      const filters = {};
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedSubCategory !== 'all') filters.subCategory = selectedSubCategory;
      
      dispatch(fetchProducts(filters));
    } else if (activeProductType === 'readymade') {
      // Fetch initial readymade data
      console.log("Fetching readymade products...");
      dispatch(fetchAllProducts({ limit: 100 }));
      dispatch(fetchFilters());
    } else if (activeProductType === 'design') {
      fetchCatalogueDesigns();
    }
    
    // Clean up auto slide intervals
    return () => {
      Object.values(autoSlideIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [activeProductType, dispatch]);

  // Update subcategories when category changes
  useEffect(() => {
    if (activeProductType === 'custom' && selectedCategory !== 'all') {
      const categoryData = backendCategories.find(cat => cat.category === selectedCategory);
      if (categoryData) {
        setCurrentSubcategories(categoryData.subCategories || []);
      } else {
        setCurrentSubcategories([]);
      }
    } else {
      setCurrentSubcategories([]);
    }
  }, [selectedCategory, backendCategories, activeProductType]);

  // Handle readymade filter changes - Client-side filtering
  useEffect(() => {
    if (activeProductType === 'readymade') {
      // Use allReadymadeProducts as base for filtering
      let productsToFilter = Array.isArray(readymadeProducts) && readymadeProducts.length > 0 
        ? [...readymadeProducts] 
        : Array.isArray(allReadymadeProducts) 
          ? [...allReadymadeProducts] 
          : [];
      
      if (productsToFilter.length === 0) {
        setFilteredReadymadeProducts([]);
        return;
      }

      let filtered = [...productsToFilter];

      // Apply sort filter
      switch(readymadeSortFilter) {
        case 'new-arrival':
          filtered = filtered.filter(product => product.newArrival === true);
          break;
        case 'best-seller':
          filtered = filtered.filter(product => product.bestSeller === true);
          break;
        case 'featured':
          filtered = filtered.filter(product => product.featured === true);
          break;
        case 'trending':
          filtered = filtered.filter(product => product.views > 50 || product.sales > 10);
          break;
        default:
          break;
      }

      // Apply category filter
      if (readymadeCategoryFilter) {
        filtered = filtered.filter(product => product.category === readymadeCategoryFilter);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        filtered = filtered.filter(product => {
          const name = product.title || product.name || '';
          const description = product.description || '';
          const category = product.category || '';
          const brand = product.brand || '';
          
          const searchLower = searchQuery.toLowerCase();
          return name.toLowerCase().includes(searchLower) ||
                 description.toLowerCase().includes(searchLower) ||
                 category.toLowerCase().includes(searchLower) ||
                 brand.toLowerCase().includes(searchLower);
        });
      }

      // Apply price range filter
      filtered = filtered.filter(product => {
        const price = product.price || product.basePrice || 0;
        return price >= priceRange[0] && price <= priceRange[1];
      });

      // Apply rating filter
      if (ratingFilter > 0) {
        filtered = filtered.filter(product => {
          const rating = product.rating || product.averageRating || 0;
          return rating >= ratingFilter;
        });
      }

      // Apply sorting
      filtered.sort((a, b) => {
        const priceA = a.price || a.basePrice || 0;
        const priceB = b.price || b.basePrice || 0;
        const ratingA = a.rating || a.averageRating || 0;
        const ratingB = b.rating || b.averageRating || 0;
        const dateA = new Date(a.createdAt || a.createdDate || 0);
        const dateB = new Date(b.createdAt || b.createdDate || 0);
        const bestSellerA = a.bestSeller || false;
        const bestSellerB = b.bestSeller || false;
        const newArrivalA = a.newArrival || false;
        const newArrivalB = b.newArrival || false;

        switch (sortOption) {
          case 'price-low':
            return priceA - priceB;
          case 'price-high':
            return priceB - priceA;
          case 'best-rated':
            return ratingB - ratingA;
          case 'newest':
            return dateB - dateA;
          case 'best-sellers':
            return (bestSellerB ? 1 : 0) - (bestSellerA ? 1 : 0);
          case 'featured':
          default:
            const featuredA = newArrivalA || bestSellerA || a.featured;
            const featuredB = newArrivalB || bestSellerB || b.featured;
            return (featuredB ? 1 : 0) - (featuredA ? 1 : 0);
        }
      });

      setFilteredReadymadeProducts(filtered);
    }
  }, [
    activeProductType,
    readymadeProducts,
    allReadymadeProducts,
    readymadeSortFilter,
    readymadeCategoryFilter,
    searchQuery,
    priceRange,
    ratingFilter,
    sortOption
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

  const fetchCatalogueDesigns = async () => {
    try {
      setDesignsLoading(true);
      const res = await fetch(`${API_URL}/savedata/catalogue`);
      const data = await res.json();
      
      const designs = Array.isArray(data) ? data : data.data || [];

      if (designs.length === 0) {
        throw new Error("No designs found in the response");
      }

      const designsWithCategory = designs.map(design => ({
        ...design,
        category: design.category || 'Design Catalogue'
      }));

      setDesigns(designsWithCategory);
    } catch (err) {
      console.error("Error fetching designs:", err);
      setDesignsError(err.message);
    } finally {
      setDesignsLoading(false);
    }
  };

  // Get cart quantity for a design
  const getCartQuantityForDesign = (designId) => {
    if (localCartItems[designId] !== undefined) {
      return localCartItems[designId];
    }
    const item = cartItems.find(item => item.designId === designId);
    return item ? item.qty : 0;
  };

  // Get cart quantity for a readymade product
  const getCartQuantityForReadymade = (productId) => {
    const item = cartItems.find(item => 
      item.kind === "READYMADE" && 
      item.readymadeProduct?._id === productId
    );
    return item ? item.qty : 0;
  };

  // Get image URL helper function
  const getImageUrl = (imagePath) => {
    if (!imagePath) return DEFAULT_PRODUCT_IMAGE;

    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }

    const baseUrl = API_URL.replace('/backend', '');
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  // Get product price
  const getProductPrice = (product, type) => {
    if (type === 'design') {
      return product.salePrice || product.product?.basePrice || 0;
    } else if (type === 'readymade') {
      return product.price || product.basePrice || 0;
    } else {
      return product.basePrice || product.price || 0;
    }
  };

  // Calculate discount percentage
  const getDiscountPercentage = (product, type) => {
    if (type === 'readymade') {
      const price = product.price || product.basePrice || 0;
      const originalPrice = product.originalPrice || product.mrp || 0;
      if (originalPrice > price) {
        return Math.round(((originalPrice - price) / originalPrice) * 100);
      }
    }
    return 0;
  };

  // Start auto slideshow for a product
  const startAutoSlideshow = (productId, images) => {
    if (images.length <= 1) return;
    
    if (autoSlideIntervals[productId]) {
      clearInterval(autoSlideIntervals[productId]);
    }
    
    const interval = setInterval(() => {
      setImageIndices(prev => ({
        ...prev,
        [productId]: ((prev[productId] || 0) + 1) % images.length
      }));
    }, 3000);
    
    setAutoSlideIntervals(prev => ({
      ...prev,
      [productId]: interval
    }));
  };

  // Stop auto slideshow for a product
  const stopAutoSlideshow = (productId) => {
    if (autoSlideIntervals[productId]) {
      clearInterval(autoSlideIntervals[productId]);
      setAutoSlideIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[productId];
        return newIntervals;
      });
    }
  };

  // Cart handler
  const handleAddToCart = async (product, type) => {
    if (!token) {
      alert("Please login to add items to cart");
      return;
    }

    try {
      setAddingToCartId(product._id);
      let cartData;
      
      switch (type) {
        case 'design':
          const designKind = product.kind || "DESIGN";
          const normalizedKind = designKind.toUpperCase() === "READYMADE" ? "READYMADE" : "DESIGN";
          
          cartData = {
            designId: product._id,
            productId: product.product?._id || product.productId,
            title: product.title || product.productName,
            unitPrice: product.salePrice || product.product?.basePrice || 0,
            basePrice: product.product?.basePrice || product.salePrice || 0,
            qty: 1,
            previewImage: product.previewImage || product.views?.[0]?.previewImage || null,
            signature: `${product._id}-${product.product?._id || product.productId}`,
            views: product.views || [],
            kind: normalizedKind
          };
          setLocalCartItems(prev => ({ ...prev, [product._id]: 1 }));
          break;
          
        case 'readymade':
          cartData = {
            kind: "READYMADE",
            qty: 1,
            readymadeProductId: product._id,
            title: product.title || product.name,
            unitPrice: product.price || product.basePrice || 0,
            basePrice: product.originalPrice || product.mrp || product.price || 0,
            previewImage: product.images?.[0] || null,
            size: product.sizes?.[0] || 'M',
            color: product.colors?.[0] || 'Black'
          };
          break;
          
        case 'custom':
          return;
      }

      await dispatch(addToCart(cartData)).unwrap();
      
      setAddedProductName(product.title || product.name || product.productName);
      
      if (type === 'design') {
        setTimeout(() => {
          setLocalCartItems(prev => {
            const newState = { ...prev };
            delete newState[product._id];
            return newState;
          });
        }, 2000);
      }
      
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert(`Failed to add to cart: ${error.message || 'Please try again'}`);
      if (type === 'design') {
        setLocalCartItems(prev => {
          const newState = { ...prev };
          delete newState[product._id];
          return newState;
        });
      }
    } finally {
      setAddingToCartId(null);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSortOption('featured');
    setPriceRange([0, 10000]);
    setSelectedCategory('all');
    setSelectedSubCategory('all');
    setReadymadeCategoryFilter('');
    setReadymadeSortFilter('all');
    setRatingFilter(0);
  };

  // Get unique categories for custom products from backend
  const getCustomCategories = () => {
    return Array.isArray(backendCategories) ? backendCategories : [];
  };

  // Handle category change for custom products
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedSubCategory('all'); // Reset subcategory when main category changes
  };

  // Handle subcategory change for custom products
  const handleSubCategoryChange = (subCategory) => {
    setSelectedSubCategory(subCategory);
  };

  // Refresh products when filters change
  useEffect(() => {
    if (activeProductType === 'custom') {
      const filters = {};
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedSubCategory !== 'all') filters.subCategory = selectedSubCategory;
      
      dispatch(fetchProducts(filters));
    }
  }, [selectedCategory, selectedSubCategory, activeProductType, dispatch]);

  // Get active products based on product type
  const getActiveProducts = () => {
    switch (activeProductType) {
      case 'custom':
        return Array.isArray(customProducts) ? customProducts : [];
      case 'design':
        return Array.isArray(designs) ? designs : [];
      case 'readymade':
        return filteredReadymadeProducts.length > 0 
          ? filteredReadymadeProducts 
          : Array.isArray(readymadeProducts) && readymadeProducts.length > 0 
            ? readymadeProducts 
            : Array.isArray(allReadymadeProducts) 
              ? allReadymadeProducts 
              : [];
      default:
        return [];
    }
  };

  // Filter products based on active filters (for custom and design)
  const filteredProducts = useMemo(() => {
    if (activeProductType === 'readymade') {
      return getActiveProducts();
    }

    let products = [...getActiveProducts()];
    
    // Apply search filter for custom and design
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
    
    // Apply price range filter
    products = products.filter(product => {
      const price = getProductPrice(product, activeProductType);
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Apply sorting
    products.sort((a, b) => {
      const priceA = getProductPrice(a, activeProductType);
      const priceB = getProductPrice(b, activeProductType);
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      
      switch (sortOption) {
        case 'price-low':
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'best-rated':
          return ratingB - ratingA;
        case 'newest':
          return dateB - dateA;
        case 'best-sellers':
          return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
        case 'featured':
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });
    
    // Apply rating filter
    if (ratingFilter > 0) {
      products = products.filter(product => {
        const rating = product.rating || 0;
        return rating >= ratingFilter;
      });
    }
    
    return products;
  }, [
    activeProductType, 
    getActiveProducts(), 
    searchQuery, 
    sortOption, 
    priceRange,
    ratingFilter,
    filteredReadymadeProducts
  ]);

  // Get unique categories for readymade products
  const getReadymadeCategories = () => {
    return Array.isArray(readymadeFilters?.categories) ? readymadeFilters.categories : [];
  };

  // Loading state
  const isLoading = () => {
    switch (activeProductType) {
      case 'custom': return customStatus === 'loading' || categoriesStatus === 'loading';
      case 'design': return designsLoading;
      case 'readymade': return readymadeLoading;
      default: return false;
    }
  };

  // Error state
  const getError = () => {
    switch (activeProductType) {
      case 'custom': return customError || categoriesError;
      case 'design': return designsError;
      case 'readymade': return readymadeError;
      default: return null;
    }
  };

  // Render product card based on type
  const renderProductCard = (product) => {
    const isDesign = activeProductType === 'design';
    const isReadymade = activeProductType === 'readymade';
    const isCustom = activeProductType === 'custom';
    
    // Get correct price
    const basePrice = getProductPrice(product, activeProductType);
    const originalPrice = isReadymade 
      ? product.originalPrice || product.mrp
      : isDesign 
      ? product.product?.basePrice 
      : product.originalPrice;
    
    const discountPercent = isReadymade ? getDiscountPercentage(product, 'readymade') : 0;
    
    const name = product.title || product.name || product.productName || 'Unnamed Product';
    const description = product.description || '';
    const category = product.category || '';
    const subCategory = product.subCategory || '';
    
    const isInWishlist = wishlist.includes(product._id || product.slug);
    
    // Get cart quantity
    const cartQuantity = isDesign 
      ? getCartQuantityForDesign(product._id) 
      : isReadymade 
      ? getCartQuantityForReadymade(product._id)
      : 0;
    
    const isInCart = cartQuantity > 0;
    const isAdding = addingToCartId === product._id;
    
    // Get images
    const getProductImages = () => {
      if (isDesign) {
        const images = [];
        if (product.previewImage) images.push(product.previewImage);
        if (product.views && Array.isArray(product.views)) {
          product.views.forEach(view => {
            if (view.previewImage) images.push(view.previewImage);
          });
        }
        return images.length > 0 ? images : [DEFAULT_PRODUCT_IMAGE];
      } else if (isReadymade) {
        if (product.images && Array.isArray(product.images)) {
          return product.images.map(img => getImageUrl(img));
        }
        return [DEFAULT_PRODUCT_IMAGE];
      } else {
        const image = product.imageUrl || product.image;
        return image ? [getImageUrl(image)] : [DEFAULT_PRODUCT_IMAGE];
      }
    };

    const images = getProductImages();
    const currentImageIndex = imageIndices[product._id] || 0;
    const currentImage = images[currentImageIndex];
    const hasMultipleImages = images.length > 1;
    
    // Check if product is new arrival or best seller
    const isNewArrival = product.newArrival;
    const isBestSeller = product.bestSeller;
    const rating = product.rating || product.averageRating || 0;
    
    return (
      <div 
        key={product._id}
        className="group bg-white rounded-2xl border border-neutral-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
        onMouseEnter={() => {
          if (hasMultipleImages && (isDesign || isReadymade)) {
            startAutoSlideshow(product._id, images);
          }
        }}
        onMouseLeave={() => {
          if (hasMultipleImages && (isDesign || isReadymade)) {
            stopAutoSlideshow(product._id);
          }
        }}
      >
        {/* Image Container */}
        <div className="relative h-64 bg-gradient-to-br from-neutral-50 to-white overflow-hidden">
          {/* Badges */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            {isReadymade && discountPercent > 0 && (
              <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded">
                {discountPercent}% OFF
              </span>
            )}
            {isReadymade && isNewArrival && (
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                NEW
              </span>
            )}
            {isReadymade && isBestSeller && (
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                BEST SELLER
              </span>
            )}
          </div>
          
          {/* Main Image */}
          {currentImage ? (
            <>
              <img
                src={currentImage}
                alt={name}
                className="w-full h-full object-contain p-4 transition-all duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.target.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No preview</p>
              </div>
            </div>
          )}

          {/* Image Navigation */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopAutoSlideshow(product._id);
                  setImageIndices(prev => ({
                    ...prev,
                    [product._id]: ((prev[product._id] || 0) - 1 + images.length) % images.length
                  }));
                }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopAutoSlideshow(product._id);
                  setImageIndices(prev => ({
                    ...prev,
                    [product._id]: ((prev[product._id] || 0) + 1) % images.length
                  }));
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Image Dots */}
          {hasMultipleImages && images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full ${
                    idx === currentImageIndex ? 'bg-indigo-600' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-5">
          {/* Category and Rating */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                {category || 'Uncategorized'}
              </span>
              {(isReadymade || isCustom) && subCategory && (
                <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  {subCategory}
                </span>
              )}
            </div>
            
            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          {/* Name */}
          <h3 className="font-bold text-neutral-900 mb-2 line-clamp-1">
            {name}
          </h3>
          
          {/* Description */}
          <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
            {description}
          </p>
          
          {/* Price & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  ₹{basePrice.toLocaleString()}
                </span>
                {originalPrice && originalPrice > basePrice && (
                  <>
                    <span className="text-sm text-neutral-400 line-through">
                      ₹{originalPrice.toLocaleString()}
                    </span>
                    {discountPercent > 0 && (
                      <span className="text-xs font-bold text-green-600">
                        Save ₹{(originalPrice - basePrice).toLocaleString()}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {isCustom ? (
                <Link
                  to={`/products/${product.slug}/customize`}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm"
                >
                  Customize
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to={isDesign 
                      ? `/catalogue/${product._id}`
                      : `/products/${product._id}`
                    }
                    className="px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-all font-medium text-sm flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Details
                  </Link>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product, activeProductType);
                    }}
                    disabled={isAdding || cartLoading}
                    className={`px-3 py-2 rounded-lg transition-all font-medium text-sm flex items-center gap-1 ${
                      isInCart
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90'
                    } ${isAdding ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : isInCart ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Added
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Skeleton loader
  const ProductSkeleton = () => (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 animate-pulse">
      <div className="h-64 bg-neutral-100 rounded-lg mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-neutral-100 rounded w-3/4"></div>
        <div className="h-4 bg-neutral-100 rounded w-1/2"></div>
        <div className="h-6 bg-neutral-100 rounded w-1/4"></div>
      </div>
    </div>
  );

  if (isLoading()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-100 rounded-lg w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Error Loading Products</h3>
          <p className="text-neutral-600 mb-6">{error.message || error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const activeProducts = getActiveProducts();
  const productsToDisplay = activeProductType === 'readymade' ? filteredReadymadeProducts : filteredProducts;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Cart Success Notification */}
      {showCartSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl shadow-lg max-w-sm flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium">Added to Cart!</p>
              <p className="text-sm text-green-600">"{addedProductName}" has been added to your cart</p>
            </div>
            <button
              onClick={() => setShowCartSuccess(false)}
              className="ml-4 text-green-500 hover:text-green-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header with Product Type Switcher */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-4">Product Hub</h1>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Browse and customize from our extensive collection of products
            </p>
            
            {/* Product Type Switcher */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveProductType(type.id);
                    handleClearFilters();
                  }}
                  className={`flex flex-col items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300 ${
                    activeProductType === type.id
                      ? 'bg-white/20 backdrop-blur-sm border-2 border-white'
                      : 'bg-white/10 hover:bg-white/15 border-2 border-transparent'
                  }`}
                >
                  <type.icon className="w-6 h-6" />
                  <span className="font-semibold">{type.name}</span>
                  <span className="text-sm opacity-80">{type.description}</span>
                </button>
              ))}
            </div>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search ${PRODUCT_TYPES.find(t => t.id === activeProductType)?.name.toLowerCase()}...`}
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
                <div className="text-2xl font-bold text-neutral-900">{productsToDisplay.length}</div>
                <div className="text-sm text-neutral-500">Products Found</div>
              </div>
              <div className="hidden md:block w-px h-8 bg-neutral-200"></div>
              <div className="hidden md:block text-center">
                <div className="text-2xl font-bold text-neutral-900">{activeProducts.length}</div>
                <div className="text-sm text-neutral-500">Total in Category</div>
              </div>
              {activeProductType === 'readymade' && (
                <>
                  <div className="hidden md:block w-px h-8 bg-neutral-200"></div>
                  <div className="hidden md:block text-center">
                    <div className="text-2xl font-bold text-neutral-900">
                      {activeProducts.filter(p => p.newArrival).length}
                    </div>
                    <div className="text-sm text-neutral-500">New Arrivals</div>
                  </div>
                </>
              )}
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
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
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
                    <button
                      onClick={handleClearFilters}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Readymade Specific Filters */}
                {activeProductType === 'readymade' && (
                  <>
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-neutral-700 mb-3">Collections</h3>
                      <div className="space-y-2">
                        {READYMADE_FILTERS.map((filter) => {
                          const Icon = filter.icon;
                          return (
                            <button
                              key={filter.id}
                              onClick={() => setReadymadeSortFilter(filter.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${readymadeSortFilter === filter.id ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                            >
                              <Icon className={`w-4 h-4 ${readymadeSortFilter === filter.id ? 'text-indigo-600' : 'text-neutral-400'}`} />
                              <span className={`font-medium ${readymadeSortFilter === filter.id ? 'text-indigo-700' : 'text-neutral-700'}`}>
                                {filter.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {getReadymadeCategories().length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Categories</h3>
                        <div className="space-y-2">
                          <button
                            onClick={() => setReadymadeCategoryFilter('')}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${!readymadeCategoryFilter ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                          >
                            <Package className={`w-4 h-4 ${!readymadeCategoryFilter ? 'text-indigo-600' : 'text-neutral-400'}`} />
                            <span className={`font-medium ${!readymadeCategoryFilter ? 'text-indigo-700' : 'text-neutral-700'}`}>
                              All Categories
                            </span>
                          </button>
                          {getReadymadeCategories().map((category) => (
                            <button
                              key={category}
                              onClick={() => setReadymadeCategoryFilter(category)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${readymadeCategoryFilter === category ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                            >
                              <Tag className={`w-4 h-4 ${readymadeCategoryFilter === category ? 'text-indigo-600' : 'text-neutral-400'}`} />
                              <span className={`font-medium ${readymadeCategoryFilter === category ? 'text-indigo-700' : 'text-neutral-700'}`}>
                                {category}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Custom Product Categories */}
                {activeProductType === 'custom' && getCustomCategories().length > 0 && (
                  <>
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-neutral-700 mb-3">Categories</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleCategoryChange('all')}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${selectedCategory === 'all' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                        >
                          <Grid className={`w-4 h-4 ${selectedCategory === 'all' ? 'text-indigo-600' : 'text-neutral-400'}`} />
                          <span className={`font-medium ${selectedCategory === 'all' ? 'text-indigo-700' : 'text-neutral-700'}`}>
                            All Categories
                          </span>
                        </button>
                        {getCustomCategories().map((categoryData) => (
                          <button
                            key={categoryData.category}
                            onClick={() => handleCategoryChange(categoryData.category)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${selectedCategory === categoryData.category ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                          >
                            <ShoppingBag className={`w-4 h-4 ${selectedCategory === categoryData.category ? 'text-indigo-600' : 'text-neutral-400'}`} />
                            <span className={`font-medium ${selectedCategory === categoryData.category ? 'text-indigo-700' : 'text-neutral-700'}`}>
                              {categoryData.category}
                            </span>
                            {selectedCategory === categoryData.category && (
                              <ChevronRight className="w-4 h-4 text-indigo-600 ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subcategories for selected category */}
                    {selectedCategory !== 'all' && currentSubcategories.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Subcategories</h3>
                        <div className="space-y-2">
                          <button
                            onClick={() => handleSubCategoryChange('all')}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${selectedSubCategory === 'all' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                          >
                            <Layers className={`w-4 h-4 ${selectedSubCategory === 'all' ? 'text-indigo-600' : 'text-neutral-400'}`} />
                            <span className={`font-medium ${selectedSubCategory === 'all' ? 'text-indigo-700' : 'text-neutral-700'}`}>
                              All Subcategories
                            </span>
                          </button>
                          {currentSubcategories.map((subCategory) => (
                            <button
                              key={subCategory}
                              onClick={() => handleSubCategoryChange(subCategory)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${selectedSubCategory === subCategory ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                            >
                              <Filter className={`w-4 h-4 ${selectedSubCategory === subCategory ? 'text-indigo-600' : 'text-neutral-400'}`} />
                              <span className={`font-medium ${selectedSubCategory === subCategory ? 'text-indigo-700' : 'text-neutral-700'}`}>
                                {subCategory}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Price Range */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
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

                {/* Rating Filter */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Minimum Rating</h3>
                  <div className="flex items-center gap-2">
                    {[4, 3, 2, 1].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setRatingFilter(rating === ratingFilter ? 0 : rating)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${ratingFilter === rating ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                      >
                        <Star className={`w-4 h-4 ${ratingFilter >= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}`} />
                        <span className={`text-sm font-medium ${ratingFilter === rating ? 'text-amber-700' : 'text-neutral-600'}`}>
                          {rating}+
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Options */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Sort By</h3>
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
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                  {PRODUCT_TYPES.find(t => t.id === activeProductType)?.name}
                </span>
                
                {activeProductType === 'readymade' && readymadeSortFilter !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-sm font-medium">
                    {READYMADE_FILTERS.find(f => f.id === readymadeSortFilter)?.name}
                    <button onClick={() => setReadymadeSortFilter('all')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {activeProductType === 'readymade' && readymadeCategoryFilter && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm font-medium">
                    Category: {readymadeCategoryFilter}
                    <button onClick={() => setReadymadeCategoryFilter('')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {activeProductType === 'custom' && selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-sm font-medium">
                    Category: {selectedCategory}
                    <button onClick={() => handleCategoryChange('all')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {activeProductType === 'custom' && selectedSubCategory !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                    Subcategory: {selectedSubCategory}
                    <button onClick={() => handleSubCategoryChange('all')}>
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
                
                {ratingFilter > 0 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                    Rating: {ratingFilter}+
                    <button onClick={() => setRatingFilter(0)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Results Grid/List */}
            {!Array.isArray(productsToDisplay) || productsToDisplay.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-100 p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-neutral-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-800 mb-3">
                  {isLoading() ? 'Loading products...' : 'No products found'}
                </h3>
                <p className="text-neutral-600 mb-8 max-w-md mx-auto">
                  {isLoading() 
                    ? 'Please wait while we load the products...' 
                    : 'Try adjusting your search or filter criteria to find what you\'re looking for.'}
                </p>
                {!isLoading() && (
                  <button
                    onClick={handleClearFilters}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsToDisplay.map((product) => renderProductCard(product))}
              </div>
            ) : (
              /* List View */
              <div className="space-y-4">
                {productsToDisplay.map((product) => (
                  <div 
                    key={product._id || product.slug} 
                    className="group bg-white rounded-xl border border-neutral-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 p-4"
                  >
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="relative w-32 h-32 bg-gradient-to-br from-neutral-50 to-white rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={getImageUrl(product.previewImage || product.imageUrl || product.image || product.images?.[0])}
                          alt={product.title || product.name}
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            e.target.src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                                {product.category || 'Uncategorized'}
                              </span>
                              {product.subCategory && (
                                <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                  {product.subCategory}
                                </span>
                              )}
                              {activeProductType === 'readymade' && product.newArrival && (
                                <span className="text-xs font-medium px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded">
                                  NEW ARRIVAL
                                </span>
                              )}
                              {activeProductType === 'readymade' && product.bestSeller && (
                                <span className="text-xs font-medium px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                  BEST SELLER
                                </span>
                              )}
                            </div>
                            
                            <h3 className="font-bold text-neutral-900 mb-1">
                              {product.title || product.name || product.productName}
                            </h3>
                            
                            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
                              {product.description}
                            </p>
                            
                            {/* Price */}
                            <div className="mb-4">
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                  ₹{getProductPrice(product, activeProductType).toLocaleString()}
                                </span>
                                {activeProductType === 'readymade' && product.originalPrice && product.originalPrice > (product.price || product.basePrice) && (
                                  <>
                                    <span className="text-sm text-neutral-400 line-through">
                                      ₹{product.originalPrice.toLocaleString()}
                                    </span>
                                    <span className="text-xs font-bold text-green-600">
                                      Save ₹{(product.originalPrice - (product.price || product.basePrice)).toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Wishlist */}
                          <button
                            onClick={() => setWishlist(prev => 
                              prev.includes(product._id || product.slug)
                                ? prev.filter(id => id !== (product._id || product.slug))
                                : [...prev, product._id || product.slug]
                            )}
                            className="p-2 mb-4 hover:bg-neutral-100 rounded-lg"
                          >
                            <Heart className={`w-5 h-5 ${wishlist.includes(product._id || product.slug) ? 'fill-red-500 text-red-500' : 'text-neutral-400'}`} />
                          </button>
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                          <Link
                            to={activeProductType === 'custom' 
                              ? `/products/${product.slug}`
                              : activeProductType === 'readymade'
                              ? `/readymade/${product._id}`
                              : `/catalogue/${product._id}`
                            }
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            View Details
                          </Link>
                          
                          {activeProductType === 'custom' ? (
                            <Link
                              to={`/products/${product.slug}/customize`}
                              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium"
                            >
                              Customize
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAddToCart(product, activeProductType)}
                                disabled={cartLoading}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm flex items-center gap-2"
                              >
                                <ShoppingCart className="w-4 h-4" />
                                Add to Cart
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}