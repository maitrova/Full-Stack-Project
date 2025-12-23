// client/src/pages/UnifiedProductHub.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { 
  Grid, 
  List, 
  Search, 
  Filter, 
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
  RefreshCw,
  Eye,
  Heart,
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
  SlidersHorizontal,
  CheckCircle
} from "lucide-react";

// Import actions from different slices
import { fetchProducts } from "../redux/slices/productsSlice.js";
import { fetchReadymadeProducts } from "../redux/slices/predesignedslice.js";
// Import cart actions
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

// Common filter categories for custom products
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
  { id: 'price-low', name: 'Price: Low to High', icon: TrendingUp },
  { id: 'price-high', name: 'Price: High to Low', icon: TrendingUp },
  { id: 'avg-customer-review', name: 'Best Rated', icon: Star },
  { id: 'newest', name: 'Newest Arrivals', icon: TrendingUp }
];

// Default placeholder image
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";

export default function UnifiedProductHub() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
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
  
  // Image slideshow states for each product
  const [imageIndices, setImageIndices] = useState({});
  const [autoSlideIntervals, setAutoSlideIntervals] = useState({});
  
  // Custom products state
  const { items: customProducts, itemsStatus: customStatus, itemsError: customError } = useSelector(
    (state) => state.products
  );
  
  // Readymade products state
  const { products: readymadeProducts, loading: readymadeLoading, error: readymadeError } = useSelector(
    (state) => state.readymadeproducts
  );
  
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
  
  // Additional filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch data based on active product type
  useEffect(() => {
    if (activeProductType === 'custom') {
      dispatch(fetchProducts());
    } else if (activeProductType === 'readymade') {
      dispatch(fetchReadymadeProducts());
    } else if (activeProductType === 'design') {
      fetchCatalogueDesigns();
    }
    
    // Clean up auto slide intervals when product type changes
    return () => {
      Object.values(autoSlideIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [activeProductType, dispatch]);

  // Show cart success message
  useEffect(() => {
    if (cartSuccess) {
      setShowCartSuccess(true);
      setTimeout(() => {
        setShowCartSuccess(false);
        dispatch(clearSuccess());
      }, 3000);
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
      
      console.log("Catalogue API Response:", data); // Debug log
      
      if (!res.ok) throw new Error(data.error || "Failed to load catalogue");
      
      // DON'T filter - show all designs for now
      setDesigns(data);
      
      console.log("Designs set:", data.length, "items"); // Debug log
    } catch (err) {
      console.error("Error fetching designs:", err); // Debug log
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

  // Get image URL helper function - FIXED
  const getImageUrl = (imagePath) => {
    if (!imagePath) return DEFAULT_PRODUCT_IMAGE;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // For relative paths, use your API_URL
    const baseUrl = API_URL.replace('/backend', '');
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  // Get product price - NEW HELPER FUNCTION
  const getProductPrice = (product, type) => {
    if (type === 'design') {
      // For designs, use salePrice first, then product.basePrice
      return product.salePrice || product.product?.basePrice || 0;
    } else if (type === 'readymade') {
      // For readymade products
      return product.price || product.basePrice || 0;
    } else {
      // For custom products
      return product.basePrice || product.price || 0;
    }
  };

  // Start auto slideshow for a product
  const startAutoSlideshow = (productId, images) => {
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
    }, 1000); // Change image every 1 second
    
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

  // Manual navigation for images
  const handleImageNav = (productId, direction, images) => {
    stopAutoSlideshow(productId);
    
    setImageIndices(prev => {
      const currentIndex = prev[productId] || 0;
      let newIndex;
      
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % images.length;
      } else {
        newIndex = (currentIndex - 1 + images.length) % images.length;
      }
      
      return { ...prev, [productId]: newIndex };
    });
    
    // Restart auto slideshow after 3 seconds of inactivity
    setTimeout(() => {
      startAutoSlideshow(productId, images);
    }, 3000);
  };

  // Cart handlers
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
          // Ensure kind is properly set
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
            kind: normalizedKind  // This should match CataloguePage
          };
          setLocalCartItems(prev => ({ ...prev, [product._id]: 1 }));
          break;
          
        case 'readymade':
          cartData = {
            kind: "READYMADE",
            qty: 1,
            readymadeProductId: product._id
          };
          break;
          
        case 'custom':
          // Custom product add to cart logic
          return;
      }

      await dispatch(addToCart(cartData)).unwrap();
      
      // Set success message
      setAddedProductName(product.name || product.title || product.productName);
      
      // Clear local state after successful update
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
    setSelectedSizes([]);
    setSelectedColors([]);
    setCategoryFilter('');
  };

  // Get active products based on product type
  const getActiveProducts = () => {
    switch (activeProductType) {
      case 'custom':
        return customProducts || [];
      case 'design':
        return designs || [];
      case 'readymade':
        return readymadeProducts || [];
      default:
        return [];
    }
  };

  // Filter products based on active filters
  const filteredProducts = useMemo(() => {
    let products = [...getActiveProducts()];
    
    // Apply search filter
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
    
    // Apply category filter for custom products
    if (activeProductType === 'custom' && selectedCategory !== 'all') {
      products = products.filter(product => {
        const name = product.name?.toLowerCase() || '';
        const category = product.category?.toLowerCase() || '';
        
        switch (selectedCategory) {
          case 'hoodie':
            return name.includes('hoodie') || category.includes('hoodie');
          case 'sweatshirt':
            return name.includes('sweat') || category.includes('sweat');
          case 'womens':
            return name.includes('women') || name.includes('womens') || 
                   category.includes('women') || category.includes('womens');
          case 'tshirts':
            return name.includes('t-shirt') || name.includes('tshirt');
          case 'polos':
            return name.includes('polo') || category.includes('polo');
          case 'oversized':
            return name.includes('oversized') || category.includes('oversized');
          case 'classic':
            return name.includes('classic') || category.includes('classic');
          default:
            return true;
        }
      });
    }
    
    // Apply category filter for readymade
    if (activeProductType === 'readymade' && categoryFilter) {
      products = products.filter(product => product.category === categoryFilter);
    }
    
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
        case 'avg-customer-review':
          return ratingB - ratingA;
        case 'newest':
          return dateB - dateA;
        case 'featured':
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });
    
    console.log("Filtered products:", products.length); // Debug log
    return products;
  }, [
    activeProductType, 
    getActiveProducts(), 
    searchQuery, 
    sortOption, 
    priceRange, 
    selectedCategory, 
    categoryFilter
  ]);

  // Get unique categories for readymade products
  const getReadymadeCategories = () => {
    if (!Array.isArray(readymadeProducts)) return [];
    const categories = new Set();
    readymadeProducts.forEach(product => {
      if (product?.category) categories.add(product.category);
    });
    return Array.from(categories);
  };

  // Loading state
  const isLoading = () => {
    switch (activeProductType) {
      case 'custom': return customStatus === 'loading';
      case 'design': return designsLoading;
      case 'readymade': return readymadeLoading;
      default: return false;
    }
  };

  // Error state
  const getError = () => {
    switch (activeProductType) {
      case 'custom': return customError;
      case 'design': return designsError;
      case 'readymade': return readymadeError;
      default: return null;
    }
  };

  // Render product card based on type - FIXED VERSION
  const renderProductCard = (product) => {
    const isDesign = activeProductType === 'design';
    const isReadymade = activeProductType === 'readymade';
    const isCustom = activeProductType === 'custom';
    
    console.log("Rendering product:", product._id, product.title || product.name); // Debug log
    
    // Get correct price using helper function
    const basePrice = getProductPrice(product, activeProductType);
    const originalPrice = isDesign 
      ? product.product?.basePrice 
      : product.originalPrice;
    
    const name = product.name || product.title || product.productName || 'Unnamed Product';
    const description = product.description || '';
    const category = product.category || '';
    
    const isInWishlist = wishlist.includes(product._id || product.slug);
    
    // Get cart quantity
    const cartQuantity = isDesign 
      ? getCartQuantityForDesign(product._id) 
      : isReadymade 
      ? getCartQuantityForReadymade(product._id)
      : 0;
    
    const isInCart = cartQuantity > 0;
    const isAdding = addingToCartId === product._id;
    
    // Get images based on product type - FIXED
    const getProductImages = () => {
      if (isDesign) {
        // For designs: Use previewImage and views
        const images = [];
        
        // Add main preview image
        if (product.previewImage) {
          const mainImageUrl = getImageUrl(product.previewImage);
          images.push(mainImageUrl);
        }
        
        // Add views images
        if (product.views && Array.isArray(product.views)) {
          product.views.forEach(view => {
            if (view.previewImage) {
              const viewImageUrl = getImageUrl(view.previewImage);
              images.push(viewImageUrl);
            }
          });
        }
        
        // If no images found, use default
        return images.length > 0 ? images : [DEFAULT_PRODUCT_IMAGE];
      } else if (isReadymade) {
        // For readymade products: Use images array
        if (product.images && Array.isArray(product.images)) {
          return product.images.map(img => getImageUrl(img));
        }
        return [DEFAULT_PRODUCT_IMAGE];
      } else {
        // For custom products
        const image = product.imageUrl || product.image;
        return image ? [getImageUrl(image)] : [DEFAULT_PRODUCT_IMAGE];
      }
    };

    const images = getProductImages();
    const currentImageIndex = imageIndices[product._id] || 0;
    const currentImage = images[currentImageIndex];
    const hasMultipleImages = images.length > 1;
    const hasViews = isDesign && product.views && product.views.length > 0;
    
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
        {/* Image Container with Slideshow */}
        <div className="relative h-64 bg-gradient-to-br from-neutral-50 to-white overflow-hidden">
          {/* Main Image */}
          {currentImage ? (
            <>
              <img
                src={currentImage}
                alt={name}
                className="w-full h-full object-contain p-4 transition-all duration-500 group-hover:scale-105"
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
          
          {/* Kind Badge - Similar to CataloguePage */}
          {isDesign && product.kind && (
            <div className="absolute top-4 left-4 z-10">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
                product.kind.toUpperCase() === "DESIGN" 
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {product.kind.toUpperCase() === "DESIGN" ? (
                  <>
                    <Palette className="w-3 h-3" />
                    DESIGN
                  </>
                ) : (
                  <>
                    <Package className="w-3 h-3" />
                    READYMADE
                  </>
                )}
              </span>
            </div>
          )}
          
          {/* Navigation Arrows (only for multiple images) */}
          {hasMultipleImages && (isDesign || isReadymade) && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageNav(product._id, 'prev', images);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-700" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageNav(product._id, 'next', images);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 hover:bg-white"
              >
                <ChevronRight className="w-4 h-4 text-neutral-700" />
              </button>
            </>
          )}
          
          {/* Image Dots Indicator */}
          {hasMultipleImages && images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    stopAutoSlideshow(product._id);
                    setImageIndices(prev => ({ ...prev, [product._id]: index }));
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    index === currentImageIndex 
                      ? 'bg-white w-4' 
                      : 'bg-white/60 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Product Type Badge (for non-design products) */}
          {!isDesign && (
            <div className="absolute top-4 left-4 z-10">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                isCustom 
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {isCustom ? 'CUSTOM' : 'READYMADE'}
              </span>
            </div>
          )}
          
          {/* Wishlist Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setWishlist(prev => 
                prev.includes(product._id || product.slug)
                  ? prev.filter(id => id !== (product._id || product.slug))
                  : [...prev, product._id || product.slug]
              );
            }}
            className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110 z-10"
          >
            <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-neutral-400 hover:text-red-500'}`} />
          </button>
          
          {/* Popular Badge for designs */}
          {isDesign && basePrice > 5000 && (
            <div className="absolute top-4 right-16 z-10">
              <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Popular
              </span>
            </div>
          )}
          
          {/* In Cart Badge */}
          {(isDesign || isReadymade) && isInCart && (
            <div className="absolute bottom-4 left-4 z-10">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                In Cart ({cartQuantity})
              </span>
            </div>
          )}
        </div>

        {/* Side Previews for Designs (similar to CataloguePage) */}
        {isDesign && hasViews && product.views.some(v => v.previewImage) && (
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Views</p>
            <div className="grid grid-cols-4 gap-2">
              {product.views.slice(0, 4).map((v) =>
                v.previewImage ? (
                  <div key={v.code} className="relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden group-hover:border-gray-300 transition-colors">
                    <img
                      src={getImageUrl(v.previewImage)}
                      alt={v.code}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center">
                            <Eye className="w-4 h-4 text-gray-300" />
                          </div>
                        `;
                      }}
                    />
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* Product Info */}
        <div className="p-5">
          {/* Category */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
              {category || 'Uncategorized'}
            </span>
            {product.isNew && (
              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded">
                NEW
              </span>
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
                  <span className="text-sm text-neutral-400 line-through">
                    ₹{originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {isCustom ? (
                // Custom product: Only Customize button
                <Link
                  to={`/products/${product.slug}/customize`}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm"
                >
                  Customize
                </Link>
              ) : (
                // Design & Readymade products: Two buttons
                <div className="flex items-center gap-2">
                  {/* View Details Button */}
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
                  
                  {/* Add to Cart Button */}
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

  console.log("Active product type:", activeProductType); // Debug log
  console.log("Designs:", designs); // Debug log
  console.log("Filtered products:", filteredProducts); // Debug log

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
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Error Loading Products</h3>
          <p className="text-neutral-600 mb-6">{error}</p>
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
                  onClick={() => setActiveProductType(type.id)}
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
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
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
                <div className="text-2xl font-bold text-neutral-900">{filteredProducts.length}</div>
                <div className="text-sm text-neutral-500">Products Found</div>
              </div>
              <div className="hidden md:block w-px h-8 bg-neutral-200"></div>
              <div className="hidden md:block text-center">
                <div className="text-2xl font-bold text-neutral-900">{getActiveProducts().length}</div>
                <div className="text-sm text-neutral-500">Total in Category</div>
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

                {/* Price Range - Common for all */}
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

                {/* Sort Options - Common for all */}
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

                {/* Type-specific filters */}
                {activeProductType === 'custom' && (
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
                )}

                {activeProductType === 'readymade' && getReadymadeCategories().length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-neutral-700 mb-4">Categories</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => setCategoryFilter('')}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${!categoryFilter ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                      >
                        <span className={`font-medium ${!categoryFilter ? 'text-indigo-700' : 'text-neutral-700'}`}>
                          All Categories
                        </span>
                      </button>
                      {getReadymadeCategories().map((category) => (
                        <button
                          key={category}
                          onClick={() => setCategoryFilter(category)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${categoryFilter === category ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100' : 'hover:bg-neutral-50'}`}
                        >
                          <Tag className={`w-4 h-4 ${categoryFilter === category ? 'text-indigo-600' : 'text-neutral-400'}`} />
                          <span className={`font-medium ${categoryFilter === category ? 'text-indigo-700' : 'text-neutral-700'}`}>
                            {category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                {activeProductType === 'custom' && selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-sm font-medium">
                    {FILTER_CATEGORIES.find(c => c.id === selectedCategory)?.name}
                    <button onClick={() => setSelectedCategory('all')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {activeProductType === 'readymade' && categoryFilter && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm font-medium">
                    Category: {categoryFilter}
                    <button onClick={() => setCategoryFilter('')}>
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
                {filteredProducts.map((product) => renderProductCard(product))}
              </div>
            ) : (
              /* List View */
              <div className="space-y-4">
                {filteredProducts.map((product) => (
                  <div 
                    key={product._id || product.slug} 
                    className="group bg-white rounded-xl border border-neutral-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 p-4"
                  >
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="relative w-32 h-32 bg-gradient-to-br from-neutral-50 to-white rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={getImageUrl(product.previewImage || product.imageUrl || product.image || product.images?.[0])}
                          alt={product.name || product.title}
                          className="w-full h-full object-contain p-2"
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
                              {product.featured && (
                                <span className="text-xs font-medium px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                  FEATURED
                                </span>
                              )}
                            </div>
                            
                            <h3 className="font-bold text-neutral-900 mb-1">
                              {product.name || product.title || product.productName}
                            </h3>
                            
                            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
                              {product.description}
                            </p>
                            
                            {/* Price */}
                            <div className="mb-4">
                              <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                ₹{getProductPrice(product, activeProductType).toLocaleString()}
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
                              ? `/products/${product._id}`
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