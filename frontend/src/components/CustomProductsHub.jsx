// client/src/pages/CustomProductsHub.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  X,
  Filter,
  Grid,
  List,
  ChevronRight,
  Loader2,
  Sparkles,
  Tag,
  DollarSign,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import { fetchProducts, fetchProductCategories } from "../redux/slices/productsSlice.js";
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend";

// Sort options
const SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Sparkles },
  { id: 'newest', name: 'Newest' },
  { id: 'price-low', name: 'Price: Low to High', icon: DollarSign },
  { id: 'price-high', name: 'Price: High to Low', icon: DollarSign }
];

// Price ranges
const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2500', min: 1000, max: 2500 },
  { label: '₹2500+', min: 2500, max: 100000 }
];

export default function CustomProductsHub() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL parameters
  const urlCategory = searchParams.get('category');
  const urlSubCategory = searchParams.get('subCategory');
  const urlPriceMin = searchParams.get('price_min');
  const urlPriceMax = searchParams.get('price_max');
  const urlSort = searchParams.get('sort');
  const urlSearch = searchParams.get('search');
  
  // State
  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [sortOption, setSortOption] = useState(urlSort || 'featured');
  const [priceRange, setPriceRange] = useState([
    urlPriceMin ? parseInt(urlPriceMin) : 0,
    urlPriceMax ? parseInt(urlPriceMax) : 100000
  ]);
  const [selectedCategory, setSelectedCategory] = useState(urlCategory || 'all');
  const [selectedSubCategory, setSelectedSubCategory] = useState(urlSubCategory || 'all');
  const [activePriceFilter, setActivePriceFilter] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  
  // Redux state
  const { 
    items: products, 
    itemsStatus: status, 
    itemsError: error,
    categories: backendCategories
  } = useSelector((state) => state.products);
  
  const token = useSelector(selectCurrentToken);
  
  // Consolidated filter state for URL updates
  const [filters, setFilters] = useState({
    search: urlSearch || '',
    sort: urlSort || 'featured',
    category: urlCategory || 'all',
    subCategory: urlSubCategory || 'all',
    price_min: urlPriceMin ? parseInt(urlPriceMin) : 0,
    price_max: urlPriceMax ? parseInt(urlPriceMax) : 100000
  });
  
  // Debounced URL update function
  const updateURLParams = useCallback((newFilters = {}) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Single useEffect to handle URL updates with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      
      if (filters.category && filters.category !== 'all') {
        params.set('category', filters.category);
      }
      
      if (filters.category !== 'all' && filters.subCategory && filters.subCategory !== 'all') {
        params.set('subCategory', filters.subCategory);
      }
      
      if (filters.sort && filters.sort !== 'featured') {
        params.set('sort', filters.sort);
      }
      
      if (filters.price_min > 0 || filters.price_max < 100000) {
        params.set('price_min', filters.price_min);
        params.set('price_max', filters.price_max);
      }
      
      if (filters.search) {
        params.set('search', filters.search);
      }
      
      setSearchParams(params, { replace: true });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [filters, setSearchParams]);
  
  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          dispatch(fetchProductCategories()),
          dispatch(fetchProducts({
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            subCategory: selectedSubCategory !== 'all' ? selectedSubCategory : undefined
          }))
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [dispatch, selectedCategory, selectedSubCategory]);
  
  // Update local state when URL changes
  useEffect(() => {
    setSearchQuery(urlSearch || '');
    setSelectedCategory(urlCategory || 'all');
    setSelectedSubCategory(urlSubCategory || 'all');
    setSortOption(urlSort || 'featured');
    setPriceRange([
      urlPriceMin ? parseInt(urlPriceMin) : 0,
      urlPriceMax ? parseInt(urlPriceMax) : 100000
    ]);
    
    // Update active price filter
    if (urlPriceMin || urlPriceMax) {
      const matchingRange = PRICE_RANGES.find(range => 
        range.min === parseInt(urlPriceMin || 0) && 
        range.max === parseInt(urlPriceMax || 100000)
      );
      setActivePriceFilter(matchingRange?.label || null);
    }
    
    setFilters({
      search: urlSearch || '',
      sort: urlSort || 'featured',
      category: urlCategory || 'all',
      subCategory: urlSubCategory || 'all',
      price_min: urlPriceMin ? parseInt(urlPriceMin) : 0,
      price_max: urlPriceMax ? parseInt(urlPriceMax) : 100000
    });
  }, [urlCategory, urlSubCategory, urlPriceMin, urlPriceMax, urlSort, urlSearch]);
  
  // Get unique categories from backend
  const categories = useMemo(() => {
    return Array.isArray(backendCategories) 
      ? backendCategories.map(cat => ({
          name: cat.category,
          subcategories: cat.subCategories || []
        }))
      : [];
  }, [backendCategories]);
  
  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products.filter(product => {
      // Price filter
      const price = product.basePrice || product.price || 0;
      if (price < priceRange[0] || price > priceRange[1]) return false;
      
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          (product.name || '').toLowerCase().includes(searchLower) ||
          (product.description || '').toLowerCase().includes(searchLower) ||
          (product.category || '').toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
    
    // Apply sorting
    filtered.sort((a, b) => {
      const priceA = a.basePrice || a.price || 0;
      const priceB = b.basePrice || b.price || 0;
      
      switch (sortOption) {
        case 'price-low':
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'newest':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'featured':
        default:
          const scoreA = (a.featured ? 3 : 0) + (a.newArrival ? 2 : 0);
          const scoreB = (b.featured ? 3 : 0) + (b.newArrival ? 2 : 0);
          return scoreB - scoreA;
      }
    });
    
    return filtered;
  }, [products, searchQuery, sortOption, priceRange]);
  
  // Handlers
  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
    setSelectedSubCategory('all');
    updateURLParams({ category, subCategory: 'all' });
  }, [updateURLParams]);
  
  const handleSubCategorySelect = useCallback((subCategory) => {
    setSelectedSubCategory(subCategory);
    updateURLParams({ subCategory });
  }, [updateURLParams]);
  
  const handlePriceFilter = useCallback((range) => {
    setPriceRange([range.min, range.max]);
    setActivePriceFilter(range.label);
    updateURLParams({ price_min: range.min, price_max: range.max });
  }, [updateURLParams]);
  
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    updateURLParams({ search: value });
  };
  
  const handleSortChange = (value) => {
    setSortOption(value);
    updateURLParams({ sort: value });
  };
  
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedSubCategory('all');
    setPriceRange([0, 100000]);
    setActivePriceFilter(null);
    setSortOption('featured');
    setExpandedCategories({});
    
    updateURLParams({
      search: '',
      sort: 'featured',
      category: 'all',
      subCategory: 'all',
      price_min: 0,
      price_max: 100000
    });
  }, [updateURLParams]);
  
  const toggleCategoryExpansion = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };
  
  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
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
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">!</span>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Error Loading Products</h3>
          <p className="text-gray-600 mb-4">{error}</p>
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
      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-medium text-gray-900">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-1">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {/* Categories */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        handleCategorySelect('all');
                        setShowMobileFilters(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedCategory === 'all'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All Products
                    </button>
                    
                    {categories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => {
                          handleCategorySelect(category.name);
                          setShowMobileFilters(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedCategory === category.name
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Price Range</h3>
                  <div className="space-y-2">
                    {PRICE_RANGES.map((range) => (
                      <button
                        key={range.label}
                        onClick={() => {
                          handlePriceFilter(range);
                          setShowMobileFilters(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          activePriceFilter === range.label
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
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          handleSortChange(option.id);
                          setShowMobileFilters(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          sortOption === option.id
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                <button
                  onClick={() => {
                    clearFilters();
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
                placeholder="Search custom products..."
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
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  <button
                    onClick={() => handleCategorySelect('all')}
                    className={`w-full flex items-center justify-between p-2.5 rounded text-sm ${
                      selectedCategory === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>All Products</span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-100">
                      {products?.length || 0}
                    </span>
                  </button>
                  
                  {categories.map((category) => {
                    const isSelected = selectedCategory === category.name;
                    const isExpanded = expandedCategories[category.name];
                    const hasSubcategories = category.subcategories.length > 0 && isSelected;
                    
                    return (
                      <div key={category.name} className="ml-2">
                        <button
                          onClick={() => {
                            handleCategorySelect(category.name);
                            toggleCategoryExpansion(category.name);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded text-sm ${
                            isSelected
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            <span className="text-left">{category.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasSubcategories && (
                              isExpanded ? 
                                <ChevronUp className="w-3 h-3" /> : 
                                <ChevronDown className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        </button>
                        
                        {hasSubcategories && isExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            <button
                              onClick={() => handleSubCategorySelect('all')}
                              className={`w-full flex items-center justify-between p-1.5 rounded transition-all text-xs ${
                                selectedSubCategory === 'all'
                                  ? 'bg-gray-100 text-gray-900 font-medium'
                                  : 'hover:bg-gray-50 text-gray-500'
                              }`}
                            >
                              <span>All Subcategories</span>
                            </button>
                            
                            {category.subcategories.map((subCat) => (
                              <button
                                key={subCat}
                                onClick={() => handleSubCategorySelect(subCat)}
                                className={`w-full flex items-center justify-between p-1.5 rounded transition-all text-xs ${
                                  selectedSubCategory === subCat
                                    ? 'bg-gray-100 text-gray-900 font-medium'
                                    : 'hover:bg-gray-50 text-gray-500'
                                }`}
                              >
                                <span>{subCat}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Price Range */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Price Range</h3>
                <div className="space-y-2">
                  {PRICE_RANGES.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => handlePriceFilter(range)}
                      className={`w-full text-left p-2.5 rounded text-sm ${
                        activePriceFilter === range.label
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
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSortChange(option.id)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded text-sm ${
                        sortOption === option.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <button
                onClick={clearFilters}
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
                    {(selectedCategory !== 'all' || activePriceFilter) && (
                      <span className="w-2 h-2 bg-gray-900 rounded-full ml-1"></span>
                    )}
                  </button>
                  <div className="relative">
                    <select
                      value={sortOption}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                    >
                      {SORT_OPTIONS.map((option) => (
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
                <h1 className="text-2xl font-medium text-gray-900">Custom Products</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredProducts.length} products
                  {selectedCategory !== 'all' && (
                    <span className="ml-2">• {selectedCategory}</span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 mr-2">View:</span>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Active Filters */}
            {(selectedCategory !== 'all' || selectedSubCategory !== 'all' || 
              searchQuery || activePriceFilter) && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {selectedCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {selectedCategory}
                      <button onClick={() => handleCategorySelect('all')} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  
                  {selectedSubCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {selectedSubCategory}
                      <button onClick={() => handleSubCategorySelect('all')} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  
                  {activePriceFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      Price: {activePriceFilter}
                      <button onClick={() => {
                        setPriceRange([0, 100000]);
                        setActivePriceFilter(null);
                      }} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      Search: "{searchQuery}"
                      <button onClick={() => handleSearchChange('')} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Products Grid/List */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  onClick={clearFilters}
                  className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium text-sm"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View - Mobile: 2 cols, Tablet: 3 cols, Desktop: 3 cols
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => {
                  const productLink = product.slug 
                    ? `/products/${product.slug}/customize`
                    : `/products/${product._id}`;
                  
                  return (
                    <Link
                      key={product._id}
                      to={productLink}
                      className="group block bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all duration-200 overflow-hidden"
                    >
                      {/* Image Container - Compact for mobile */}
                      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                        <img
                          src={product.imageUrl || product.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop&q=80"}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        
                        {/* Badges */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          {product.newArrival && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-900 text-white">
                              NEW
                            </span>
                          )}
                          {product.featured && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-600 text-white">
                              FEATURED
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Product Info */}
                      <div className="p-3">
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">
                            {product.category || 'Custom Product'}
                          </p>
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                            {product.name || product.title || 'Unnamed Product'}
                          </h3>
                        </div>
                        
                        {/* Price and Action */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold text-gray-900">
                                ₹{(product.basePrice || product.price || 0).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">starting price</p>
                          </div>
                          
                          <span className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded">
                            Customize
                          </span>
                        </div>
                        
                        {/* View Details Link */}
                        {/* <div className="mt-3">
                          <Link
                            to={`/products/${product._id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
                          >
                            View Details
                            <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </div> */}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              // List View
              <div className="space-y-4">
                {filteredProducts.map((product) => {
                  const productLink = product.slug 
                    ? `/products/${product.slug}/customize`
                    : `/products/${product._id}`;
                  
                  return (
                    <Link
                      key={product._id}
                      to={productLink}
                      className="block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row">
                        <div className="md:w-48 h-48 bg-gray-100 overflow-hidden">
                          <img
                            src={product.imageUrl || product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="flex-1 p-4">
                          <div className="flex flex-col h-full">
                            <div className="mb-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                {product.category || 'Custom Product'}
                              </p>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {product.name || product.title || 'Unnamed Product'}
                              </h3>
                              <p className="text-gray-600 line-clamp-2">
                                {product.description || ''}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <div>
                                <span className="text-xl font-bold text-gray-900">
                                  ₹{(product.basePrice || product.price || 0).toLocaleString()}
                                </span>
                                <p className="text-xs text-gray-500">Starting price</p>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded">
                                  Customize Now
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Loading State for Filter Changes */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Applying filters...</p>
          </div>
        </div>
      )}
    </div>
  );
}
