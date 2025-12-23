// components/Readymade/ProductList.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchReadymadeProducts } from '../redux/slices/predesignedslice.js';
import { 
  addToCart, 
  selectCartItems, 
  selectCartLoading, 
  selectCartSuccess,
  selectCartError,
  clearError,
  clearSuccess,
  getItemQuantity 
} from '../redux/slices/Cartslice.js'; // Adjust path as needed

const ReadymadeProductList = () => {
  const dispatch = useDispatch();
  const { products, loading, error } = useSelector((state) => state.readymadeproducts);
  
  // Cart state selectors
  const cartItems = useSelector(selectCartItems);
  const cartLoading = useSelector(selectCartLoading);
  const cartSuccess = useSelector(selectCartSuccess);
  const cartError = useSelector(selectCartError);
  
  console.log("Products in ReadymadeProductList:", products);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [hasError, setHasError] = useState(false);
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const slideInterval = useRef({});

  useEffect(() => {
    try {
      dispatch(fetchReadymadeProducts());
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setHasError(true);
    }
  }, [dispatch]);

  // Clear notifications after 3 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Clear cart notifications
  useEffect(() => {
    if (cartSuccess) {
      setNotification({
        show: true,
        message: 'Product added to cart successfully!',
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

  // Initialize slideshow for each product
  useEffect(() => {
    if (!products || !Array.isArray(products)) return;

    products.forEach(product => {
      if (product.images && product.images.length > 1) {
        startSlideshow(product._id, product.images.length);
      }
    });

    return () => {
      // Cleanup intervals
      Object.values(slideInterval.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [products]);

  const startSlideshow = (productId, imageCount) => {
    // Clear existing interval for this product
    if (slideInterval.current[productId]) {
      clearInterval(slideInterval.current[productId]);
    }

    // Start new interval
    slideInterval.current[productId] = setInterval(() => {
      setCurrentImageIndex(prev => ({
        ...prev,
        [productId]: ((prev[productId] || 0) + 1) % imageCount
      }));
    }, 3000);
  };

  const handleImageNav = (productId, direction, imageCount, e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => {
      const currentIndex = prev[productId] || 0;
      let newIndex;
      
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % imageCount;
      } else {
        newIndex = (currentIndex - 1 + imageCount) % imageCount;
      }

      // Restart slideshow after manual navigation
      if (slideInterval.current[productId]) {
        clearInterval(slideInterval.current[productId]);
        startSlideshow(productId, imageCount);
      }

      return { ...prev, [productId]: newIndex };
    });
  };

  const handleMouseEnter = (productId, imageCount) => {
    // Pause slideshow on hover
    if (slideInterval.current[productId]) {
      clearInterval(slideInterval.current[productId]);
    }
  };

  const handleMouseLeave = (productId, imageCount) => {
    // Resume slideshow when mouse leaves
    if (imageCount > 1) {
      startSlideshow(productId, imageCount);
    }
  };

  // Add to cart handler
  const handleAddToCart = async (product) => {
    if (!product?._id || product?.stock <= 0 || !product?.isActive) {
      setNotification({
        show: true,
        message: 'Product is out of stock or unavailable',
        type: 'error'
      });
      return;
    }

    try {
      setAddingToCartId(product._id);
      
      const cartData = {
        kind: "READYMADE",
        qty: 1,
        readymadeProductId: product._id
      };

      console.log('Adding to cart:', cartData);
      await dispatch(addToCart(cartData)).unwrap();
      
      // Success notification is handled by the useEffect above
      
    } catch (error) {
      console.error('Add to cart failed:', error);
      setNotification({
        show: true,
        message: error.message || 'Failed to add to cart',
        type: 'error'
      });
    } finally {
      setAddingToCartId(null);
    }
  };

  // Check if item is in cart (alternative approach)
  const isItemInCart = (productId) => {
    return cartItems.some(item => 
      item.kind === "READYMADE" && 
      item.readymadeProduct?._id === productId
    );
  };

  // Get item quantity in cart
  const getCartQuantity = (productId) => {
    const item = cartItems.find(item => 
      item.kind === "READYMADE" && 
      item.readymadeProduct?._id === productId
    );
    return item ? item.qty : 0;
  };

  // Safe product filtering
  const getFilteredProducts = () => {
    try {
      if (!products || !Array.isArray(products)) return [];
      
      return products.filter(product => {
        if (!product) return false;
        
        const matchesSearch = 
          (product.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        
        const matchesCategory = !categoryFilter || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
      });
    } catch (err) {
      console.error('Error filtering products:', err);
      return [];
    }
  };

  // Safe product sorting
  const getSortedProducts = () => {
    try {
      const filtered = getFilteredProducts();
      return [...filtered].sort((a, b) => {
        if (!a || !b) return 0;
        
        switch (sortBy) {
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
    } catch (err) {
      console.error('Error sorting products:', err);
      return [];
    }
  };

  // Safe image URL construction
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    // Handle both relative and absolute URLs
    if (imagePath.startsWith('http')) {
      return imagePath;
    } else if (imagePath.startsWith('/')) {
      return `http://localhost:5000${imagePath}`;
    } else {
      return `http://localhost:5000/${imagePath}`;
    }
  };

  // Safe category extraction
  const getCategories = () => {
    if (!products || !Array.isArray(products)) return [];
    
    const categories = new Set();
    products.forEach(product => {
      if (product?.category) {
        categories.add(product.category);
      }
    });
    return Array.from(categories);
  };

  const sortedProducts = getSortedProducts();
  const categories = getCategories();

  // Error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong</h2>
          <p className="text-gray-600 mb-6">Failed to load products. Please try again later.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down">
          <div className={`rounded-lg shadow-lg p-4 max-w-sm ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${notification.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Ready-made Collection</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Discover our exclusive collection of high-quality products, carefully crafted for your style and comfort.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>Error: {error}</span>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="w-full md:w-2/5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                />
                <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex space-x-4 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 w-full md:w-48"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 w-full md:w-48"
              >
                <option value="newest">New Arrivals</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {sortedProducts.map((product) => {
            const currentIndex = currentImageIndex[product?._id] || 0;
            const productImages = product?.images || [];
            const hasMultipleImages = productImages.length > 1;
            const mainImage = productImages[currentIndex];
            const imageUrl = getImageUrl(mainImage);
            const isInCart = isItemInCart(product?._id);
            const cartQuantity = getCartQuantity(product?._id);
            const isOutOfStock = !product?.isActive || product?.stock <= 0;
            const isLowStock = product?.stock > 0 && product?.stock < 5;
            const isAdding = addingToCartId === product?._id;
            
            return (
              <div 
                key={product?._id || Math.random()} 
                className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 transform hover:-translate-y-1"
                onMouseEnter={() => handleMouseEnter(product?._id, productImages.length)}
                onMouseLeave={() => handleMouseLeave(product?._id, productImages.length)}
              >
                {/* Product Image with Slideshow */}
                <div className="relative h-64 bg-gray-100 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product?.title || 'Product image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNFNUU1RTUiLz48cGF0aCBkPSJNNTAgNzVMMTAwIDEyNUwxNTAgNzUiIHN0cm9rZT0iI0I4QjhCOCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTUwIDEyNUwxMDAgNzVMMTUwIDEyNSIgc3Ryb2tlPSIjQjhCOEI4IiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Image Navigation Arrows */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={(e) => handleImageNav(product._id, 'prev', productImages.length, e)}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleImageNav(product._id, 'next', productImages.length, e)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                  
                  {/* Image Dots Indicator */}
                  {hasMultipleImages && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2">
                      {productImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(prev => ({ ...prev, [product._id]: index }));
                            if (slideInterval.current[product._id]) {
                              clearInterval(slideInterval.current[product._id]);
                              startSlideshow(product._id, productImages.length);
                            }
                          }}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Product Badges */}
                  <div className="absolute top-4 left-4 flex flex-col space-y-2">
                    {isOutOfStock && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Sold Out
                      </span>
                    )}
                    {isLowStock && !isOutOfStock && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        Low Stock
                      </span>
                    )}
                    {isInCart && !isOutOfStock && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        In Cart ({cartQuantity})
                      </span>
                    )}
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate">
                        {product?.title || 'Unnamed Product'}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {product?.category || 'Uncategorized'}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-blue-600 ml-4">
                      {product?.currency === 'INR' ? '₹' : '$'}{product?.price || '0.00'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product?.description || 'No description available.'}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className={isOutOfStock ? 'text-red-500' : ''}>
                        {isOutOfStock ? 'Out of Stock' : `${product?.stock || 0} in stock`}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <Link
                      to={`/products/${product?._id}`}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-center transition-all duration-200 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
                    >
                      View Details
                    </Link>
                    
                    {!isOutOfStock && (
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isAdding || cartLoading}
                        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] min-w-[120px] ${
                          isInCart 
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg' 
                            : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                        } ${isAdding ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isAdding ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 mr-2 text-current" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding...
                          </span>
                        ) : isInCart ? (
                          <span className="flex items-center justify-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Added ({cartQuantity})
                          </span>
                        ) : (
                          'Add to Cart'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 rounded-full mb-6">
              <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No products found</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              {searchTerm || categoryFilter 
                ? 'No products match your search criteria. Try adjusting your filters.' 
                : 'Our collection is currently empty. Check back soon!'}
            </p>
            {(searchTerm || categoryFilter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                }}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadymadeProductList;