import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Edit2, 
  X, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff,
  Search as SearchIcon,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Settings,
  BarChart3,
  Upload,
  Download,
  Palette,
  Grid,
  Tag,
  ShoppingBag,
  Home,
  Search
} from 'lucide-react';

// Import Redux actions
import {
  fetchProducts,
  fetchAllProducts,
  updateProductList,
  removeProductFromList,
  fetchFilters,
  setCurrentFilter,
  setCurrentCategory,
  setCurrentSubCategory,
  setSelectedProductIds,
  toggleProductSelection,
  selectAllProducts,
  deselectAllProducts,
  clearError,
  deleteProduct,
  toggleProductStatus,
  searchProducts,
  getBestSellerProducts,
  getNewArrivalProducts,
} from '../redux/slices/productList.js';

// Import Designs actions
import {
  listCatalogueDesigns,
  publishDesign,
  updateDesignDetails,
  getDesign,
  deleteDesign,
  clearDesignError,
  resetDesignSuccess,
} from '../redux/slices/Designslice.js';

import {
  setActiveTab,
  setIsEditing,
  addNotification,
  removeNotification,
} from '../redux/slices/adminSlice.js';

// Import the ProductFormModal
// Import the ProductFormModal
import ProductFormModal from '../components/newproductadding.jsx';
// Import DesignPublishModal
import DesignPublishModal from '../components/DesignPublishModal.jsx';
// Import DropproductAdmin
import DropproductAdmin from '../components/dropproducts.jsx';
// Import AdminOrders
import AdminOrders from '../components/admin/ordersmanagement.jsx';
// Import HomepageAdmin
import HomepageAdmin from '../pages/setHomepage.jsx';
// Import ProductSearch
import ProductSearch from '../components/searchproductdetail.jsx';

const AdminDashboard = () => {
  const dispatch = useDispatch();
  
  // Redux state
  const {
    products,
    availableProducts,
    filters,
    pagination,
    selectedProductIds,
    loading: productsLoading,
    error: productsError,
    currentFilter,
    currentCategory,
    currentSubCategory,
  } = useSelector((state) => state.productList);
  

  console.log("Admin Dashboard - Products:", products);
  // Designs state
  const {
    designs,
    catalogueDesigns,
    currentDesign,
    loading: designsLoading,
    error: designsError,
    success: designsSuccess,
  } = useSelector((state) => state.designs);
  
  const {
    activeTab,
    isEditing,
    notifications,
  } = useSelector((state) => state.admin);
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [designSearchTerm, setDesignSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showDesignPublishModal, setShowDesignPublishModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingDesign, setEditingDesign] = useState(null);
  const [activeSidebarItem, setActiveSidebarItem] = useState('dashboard');
  const [localCategory, setLocalCategory] = useState('');
  const [localSubCategory, setLocalSubCategory] = useState('');
  const [viewMode, setViewMode] = useState('products'); // 'products', 'designs', 'dropproducts', 'orders', 'homepage', 'search'
  
  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    // Check if it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Prepend base URL for relative paths
    const baseUrl = import.meta.env.VITE_IMAGE_URL; 
    return `${baseUrl}/${imagePath.replace(/^\/+/, '')}`;
  };
  
  useEffect(() => {
    console.log("Products updated:", products);
  }, [products]);

  // Initialize on component mount
  useEffect(() => {
    dispatch(fetchFilters());
    loadProducts();
  }, [dispatch]);

  // Load products based on current filter
  useEffect(() => {
    if (!isEditing && 
        activeTab !== 'dashboard' && 
        activeTab !== 'dropproducts' && 
        activeTab !== 'orders' && 
        activeTab !== 'homepage' &&
        activeTab !== 'search') {
      loadProducts();
    }
  }, [currentFilter, pagination.page, currentCategory, currentSubCategory, activeTab]);

  // Handle errors
  useEffect(() => {
    if (productsError) {
      dispatch(addNotification({
        type: 'error',
        message: productsError,
      }));
      dispatch(clearError());
    }
    
    if (designsError) {
      dispatch(addNotification({
        type: 'error',
        message: designsError,
      }));
      dispatch(clearDesignError());
    }
  }, [productsError, designsError, dispatch]);

  // Handle design success
  useEffect(() => {
    if (designsSuccess) {
      dispatch(addNotification({
        type: 'success',
        message: 'Design operation completed successfully!',
      }));
      dispatch(resetDesignSuccess());
      loadDesigns();
    }
  }, [designsSuccess, dispatch]);

  // Sync local state with Redux state
  useEffect(() => {
    setLocalCategory(currentCategory);
    setLocalSubCategory(currentSubCategory);
  }, [currentCategory, currentSubCategory]);

  const loadProducts = () => {
    if (activeTab === 'newArrival') {
      dispatch(getNewArrivalProducts({
        page: pagination.page,
        limit: pagination.limit,
      }));
    } else if (activeTab === 'bestSeller') {
      dispatch(getBestSellerProducts({
        page: pagination.page,
        limit: pagination.limit,
      }));
    } else if (activeTab === 'allProducts') {
      dispatch(fetchProducts({
        filter: '',
        category: currentCategory,
        subCategory: currentSubCategory,
        page: pagination.page,
        limit: pagination.limit,
      }));
    }
  };

  const loadDesigns = () => {
    dispatch(listCatalogueDesigns({
      page: pagination.page,
      limit: pagination.limit,
    }));
  };

  const handleTabChange = (tab) => {
    setActiveSidebarItem(tab);
    dispatch(setActiveTab(tab));
    dispatch(setCurrentFilter(tab));
    dispatch(setCurrentCategory(''));
    dispatch(setCurrentSubCategory(''));
    dispatch(deselectAllProducts());
    setLocalCategory('');
    setLocalSubCategory('');
    
    if (tab === 'designs') {
      setViewMode('designs');
      loadDesigns();
    } else if (tab === 'dropproducts') {
      setViewMode('dropproducts');
    } else if (tab === 'orders') {
      setViewMode('orders');
    } else if (tab === 'homepage') {
      setViewMode('homepage');
    } else if (tab === 'search') {
      setViewMode('search');
    } else {
      setViewMode('products');
      loadProducts();
    }
  };

  const handleEditClick = () => {
    dispatch(setIsEditing(true));
    dispatch(setCurrentCategory(''));
    dispatch(setCurrentSubCategory(''));
    dispatch(setSelectedProductIds([]));
    setLocalCategory('');
    setLocalSubCategory('');
    
    dispatch(fetchAllProducts({
      category: '',
      subCategory: '',
      limit: 100,
    }));
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductForm(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handlePublishDesign = (design) => {
    setSelectedDesign(design);
    setShowDesignPublishModal(true);
  };

  const handleEditDesign = async (design) => {
    try {
      const result = await dispatch(getDesign(design._id)).unwrap();
      setEditingDesign(result);
      setShowDesignPublishModal(true);
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to load design details',
      }));
    }
  };

  const handleCategoryChange = (category) => {
    dispatch(setCurrentCategory(category));
    dispatch(setCurrentSubCategory(''));
    dispatch(setSelectedProductIds([]));
    setLocalCategory(category);
    setLocalSubCategory('');
    
    if (viewMode === 'products') {
      dispatch(fetchAllProducts({
        category,
        subCategory: '',
        limit: 100,
      }));
    }
  };

  const handleSubCategoryChange = (subCategory) => {
    dispatch(setCurrentSubCategory(subCategory));
    dispatch(setSelectedProductIds([]));
    setLocalSubCategory(subCategory);
    
    if (viewMode === 'products') {
      dispatch(fetchAllProducts({
        category: localCategory,
        subCategory,
        limit: 100,
      }));
    }
  };

  const handleProductSelect = (productId) => {
    dispatch(toggleProductSelection(productId));
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === availableProducts.length) {
      dispatch(deselectAllProducts());
    } else {
      dispatch(selectAllProducts());
    }
  };

  const handleSave = async () => {
    if (selectedProductIds.length === 0) {
      dispatch(addNotification({
        type: 'warning',
        message: 'Please select at least one product',
      }));
      return;
    }

    try {
      let action;
      let successMessage;
      
      if (activeTab === 'newArrival') {
        action = 'setNewArrival';
        successMessage = `${selectedProductIds.length} products added to New Arrivals successfully!`;
      } else if (activeTab === 'bestSeller') {
        action = 'setBestSeller';
        successMessage = `${selectedProductIds.length} products added to Best Sellers successfully!`;
      } else {
        action = 'setNewArrival';
        successMessage = `${selectedProductIds.length} products updated successfully!`;
      }
      
      await dispatch(updateProductList({
        productIds: selectedProductIds,
        action: action,
        value: true,
      })).unwrap();

      dispatch(addNotification({
        type: 'success',
        message: successMessage,
      }));
      
      dispatch(setIsEditing(false));
      loadProducts();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to update products',
      }));
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      const action = currentFilter === 'newArrival' ? 'removeNewArrival' : 'removeBestSeller';
      
      await dispatch(removeProductFromList({
        productId,
        action,
      })).unwrap();

      dispatch(addNotification({
        type: 'success',
        message: 'Product removed successfully!',
      }));
      
      loadProducts();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to remove product',
      }));
    }
  };

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDeleteDesign = async (design) => {
    try {
      await dispatch(deleteDesign(design._id)).unwrap();
      
      dispatch(addNotification({
        type: 'success',
        message: 'Design deleted successfully!',
      }));
      
      loadDesigns();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to delete design',
      }));
    }
  };

  const confirmDeleteProduct = async () => {
    if (productToDelete) {
      try {
        await dispatch(deleteProduct(productToDelete._id)).unwrap();
        
        dispatch(addNotification({
          type: 'success',
          message: 'Product deleted successfully!',
        }));
        
        setShowDeleteModal(false);
        setProductToDelete(null);
        loadProducts();
      } catch (error) {
        dispatch(addNotification({
          type: 'error',
          message: error || 'Failed to delete product',
        }));
      }
    }
  };

  const handleToggleStatus = async (productId) => {
    try {
      await dispatch(toggleProductStatus(productId)).unwrap();
      
      dispatch(addNotification({
        type: 'success',
        message: 'Product status updated successfully!',
      }));
      
      loadProducts();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to update product status',
      }));
    }
  };

  const handleToggleDesignStatus = async (design) => {
    try {
      const updatedStatus = !design.isActive;
      await dispatch(updateDesignDetails({
        id: design._id,
        designData: { isActive: updatedStatus }
      })).unwrap();

      dispatch(addNotification({
        type: 'success',
        message: `Design ${updatedStatus ? 'activated' : 'deactivated'} successfully!`,
      }));
      
      loadDesigns();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to update design status',
      }));
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      dispatch(searchProducts({
        searchTerm,
        page: 1,
        limit: pagination.limit,
      }));
    } else {
      loadProducts();
    }
  };

  const handleDesignSearch = () => {
    if (designSearchTerm.trim()) {
      // Filter designs locally or implement API search
      // For now, we'll filter locally
      const filtered = catalogueDesigns.filter(design => 
        design.title?.toLowerCase().includes(designSearchTerm.toLowerCase()) ||
        design.description?.toLowerCase().includes(designSearchTerm.toLowerCase())
      );
      // You would typically dispatch a search action here
    } else {
      loadDesigns();
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      if (viewMode === 'products') {
        dispatch(fetchProducts({
          filter: currentFilter,
          category: currentCategory,
          subCategory: currentSubCategory,
          page: newPage,
          limit: pagination.limit,
        }));
      } else if (viewMode === 'designs') {
        dispatch(listCatalogueDesigns({
          page: newPage,
          limit: pagination.limit,
        }));
      }
    }
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleViewDesign = (design) => {
    setSelectedDesign(design);
    // You can create a separate modal for design details if needed
    // For now, just log it
    console.log('View design:', design);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <XCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'allProducts', label: 'All Products', icon: <Package className="w-5 h-5" /> },
    { id: 'designs', label: 'Designs', icon: <Palette className="w-5 h-5" /> },
    { id: 'dropproducts', label: 'Drop Products', icon: <Tag className="w-5 h-5" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'homepage', label: 'Homepage', icon: <Home className="w-5 h-5" /> },
    { id: 'search', label: 'Product Search', icon: <Search className="w-5 h-5" /> },
    { id: 'newArrival', label: 'New Arrivals', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'bestSeller', label: 'Best Sellers', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'prices', label: 'Prices', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  // Dashboard Statistics
  const dashboardStats = [
    { label: 'Total Products', value: '1,245', change: '+12%', color: 'blue' },
    { label: 'Designs', value: designs?.length || '0', change: '+8%', color: 'green' },
    { label: 'Best Sellers', value: '89', change: '+23%', color: 'purple' },
    { label: 'Revenue', value: '$24,580', change: '+15%', color: 'orange' },
  ];

  // Helper function to extract sub-category name
  const extractSubCategoryName = (subCategory) => {
    if (typeof subCategory === 'string') {
      if (subCategory.includes(':')) {
        return subCategory.split(':')[1];
      }
      return subCategory;
    }
    return subCategory;
  };

  const getFilteredSubCategories = () => {
    if (!localCategory || !Array.isArray(filters.subCategories)) {
      return [];
    }
    
    return filters.subCategories
      .filter(sub => {
        if (typeof sub === 'string') {
          return sub.includes(localCategory);
        }
        return false;
      })
      .map(sub => extractSubCategoryName(sub))
      .filter(sub => sub && sub.trim() !== '');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-96">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg shadow-lg border-l-4 ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-800'
                : notification.type === 'error'
                ? 'bg-red-50 border-red-500 text-red-800'
                : notification.type === 'warning'
                ? 'bg-yellow-50 border-yellow-500 text-yellow-800'
                : 'bg-blue-50 border-blue-500 text-blue-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                {getNotificationIcon(notification.type)}
                <span className="font-medium">{notification.message}</span>
              </div>
              <button
                onClick={() => dispatch(removeNotification(notification.id))}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{productToDelete?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProduct}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal - Updated for Variants with Base URL */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Product Details</h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Images */}
              <div>
                <div className="mb-4">
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <img
                      src={getImageUrl(selectedProduct.images[0])}
                      alt={selectedProduct.title}
                      className="w-full h-64 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/400x400?text=No+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400">No Image</span>
                    </div>
                  )}
                </div>
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {selectedProduct.images.slice(1).map((img, index) => (
                      <img
                        key={index}
                        src={getImageUrl(img)}
                        alt={`${selectedProduct.title} ${index + 2}`}
                        className="w-full h-20 object-cover rounded"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/100x100?text=No+Image';
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div>
                <h4 className="text-2xl font-bold text-gray-900 mb-2">{selectedProduct.title}</h4>
                <p className="text-gray-600 mb-4">{selectedProduct.description}</p>
                
                {/* Variants Section */}
                <div className="mb-6">
                  <h5 className="text-lg font-semibold text-gray-900 mb-3">Size-wise Pricing & Stock</h5>
                  
                  {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4 mb-2 text-sm font-medium text-gray-500">
                        <div>Size</div>
                        <div>Price</div>
                        <div>Stock</div>
                      </div>
                      {selectedProduct.variants.map((variant, index) => (
                        <div key={index} className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 last:border-0">
                          <div className="font-medium text-gray-900">
                            {variant.size}
                            {variant.sku && (
                              <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                            )}
                          </div>
                          <div className="text-lg font-bold text-blue-600">
                            ₹{variant.price}
                          </div>
                          <div>
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              variant.stock > 10 
                                ? 'bg-green-100 text-green-800'
                                : variant.stock > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {variant.stock} units
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {/* Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-gray-600">Total Stock:</div>
                          <div className="font-bold text-gray-900">
                            {selectedProduct.variants.reduce((sum, v) => sum + (v.stock || 0), 0)} units
                          </div>
                          <div className="text-gray-600">Price Range:</div>
                          <div className="font-bold text-gray-900">
                            ₹{Math.min(...selectedProduct.variants.map(v => v.price))} - 
                            ₹{Math.max(...selectedProduct.variants.map(v => v.price))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Fallback for old products without variants
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-gray-500">Price</p>
                        <p className="text-xl font-bold text-blue-600">₹{selectedProduct.price}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Stock</p>
                        <p className="text-xl font-bold text-gray-900">{selectedProduct.stock || 0} units</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="font-medium text-gray-900">{selectedProduct.category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Sub Category</p>
                        <p className="font-medium text-gray-900">{selectedProduct.subCategory}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedProduct.newArrival && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      New Arrival
                    </span>
                  )}
                  {selectedProduct.bestSeller && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      Best Seller
                    </span>
                  )}
                  {selectedProduct.isActive ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleToggleStatus(selectedProduct._id)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedProduct.isActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {selectedProduct.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      setShowProductModal(false);
                      handleEditProduct(selectedProduct);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Edit Product
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(null);
          loadProducts();
        }}
        product={editingProduct}
        isEdit={!!editingProduct}
      />

      {/* Design Publish Modal */}
      <DesignPublishModal
        isOpen={showDesignPublishModal}
        onClose={() => {
          setShowDesignPublishModal(false);
          setSelectedDesign(null);
          setEditingDesign(null);
          loadDesigns();
        }}
        design={editingDesign || selectedDesign}
        isEdit={!!editingDesign}
      />

      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">Admin Panel</h2>
          <p className="text-gray-400 text-sm">Manage your e-commerce store</p>
        </div>
        
        <div className="flex-1 px-4">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  activeSidebarItem === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="font-bold">A</span>
            </div>
            <div>
              <p className="font-medium">Admin User</p>
              <p className="text-xs text-gray-400">Super Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {activeSidebarItem === 'dashboard' && 'Dashboard'}
                {activeSidebarItem === 'allProducts' && 'All Products'}
                {activeSidebarItem === 'designs' && 'Designs'}
                {activeSidebarItem === 'dropproducts' && 'Drop Products'}
                {activeSidebarItem === 'orders' && 'Order Management'}
                {activeSidebarItem === 'homepage' && 'Homepage Management'}
                {activeSidebarItem === 'search' && 'Product Search'}
                {activeSidebarItem === 'newArrival' && 'New Arrivals'}
                {activeSidebarItem === 'bestSeller' && 'Best Sellers'}
                {activeSidebarItem === 'prices' && 'Price Management'}
                {activeSidebarItem === 'users' && 'User Management'}
                {activeSidebarItem === 'analytics' && 'Analytics'}
                {activeSidebarItem === 'settings' && 'Settings'}
              </h1>
              <p className="text-gray-600 mt-2">
                {activeSidebarItem === 'dashboard' && 'Overview of your store performance'}
                {activeSidebarItem === 'allProducts' && 'Manage all products in your store'}
                {activeSidebarItem === 'designs' && 'Manage user-created designs'}
                {activeSidebarItem === 'dropproducts' && 'Manage drop products inventory'}
                {activeSidebarItem === 'orders' && 'Manage and update customer orders'}
                {activeSidebarItem === 'homepage' && 'Manage featured content displayed on the homepage'}
                {activeSidebarItem === 'search' && 'Search for products by their unique ID'}
                {activeSidebarItem === 'newArrival' && 'Manage new arrival products'}
                {activeSidebarItem === 'bestSeller' && 'Manage best selling products'}
                {activeSidebarItem === 'prices' && 'Manage product pricing and discounts'}
                {activeSidebarItem === 'users' && 'Manage customers and administrators'}
                {activeSidebarItem === 'analytics' && 'View sales and performance analytics'}
                {activeSidebarItem === 'settings' && 'Configure store settings'}
              </p>
            </div>
            
            {activeSidebarItem === 'designs' ? (
              <div className="flex space-x-3">
                <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  <Download className="w-5 h-5" />
                  <span>Export Designs</span>
                </button>
              </div>
            ) : activeSidebarItem === 'newArrival' || activeSidebarItem === 'bestSeller' ? (
              !isEditing ? (
                <div className="flex space-x-3">
                  <button
                    onClick={handleEditClick}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                    <span>Edit List</span>
                  </button>
                  <button 
                    onClick={handleAddProduct}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Product</span>
                  </button>
                </div>
              ) : null
            ) : activeSidebarItem === 'allProducts' && (
              <div className="flex space-x-3">
                <button 
                  onClick={handleAddProduct}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add New Product</span>
                </button>
                <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  <Download className="w-5 h-5" />
                  <span>Export</span>
                </button>
              </div>
            )}
          </div>

          {/* Dashboard Stats */}
          {activeSidebarItem === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {dashboardStats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      stat.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                      stat.color === 'green' ? 'bg-green-100 text-green-800' :
                      stat.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {stat.change}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          stat.color === 'blue' ? 'bg-blue-500' :
                          stat.color === 'green' ? 'bg-green-500' :
                          stat.color === 'purple' ? 'bg-purple-500' :
                          'bg-orange-500'
                        }`}
                        style={{ width: '75%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drop Products Component */}
          {activeSidebarItem === 'dropproducts' && (
            <DropproductAdmin />
          )}

          {/* Orders Component */}
          {activeSidebarItem === 'orders' && (
            <AdminOrders />
          )}

          {/* Homepage Component */}
          {activeSidebarItem === 'homepage' && (
            <HomepageAdmin />
          )}

          {/* Product Search Component */}
          {activeSidebarItem === 'search' && (
            <ProductSearch />
          )}

          {/* Search and Filters for Products */}
          {(activeSidebarItem === 'allProducts' || activeSidebarItem === 'newArrival' || activeSidebarItem === 'bestSeller') && !isEditing && viewMode === 'products' && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="text-gray-400 w-5 h-5" />
                    <select
                      value={currentCategory}
                      onChange={(e) => dispatch(setCurrentCategory(e.target.value))}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Categories</option>
                      {filters.categories && filters.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={handleSearch}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filters for Designs */}
          {activeSidebarItem === 'designs' && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search designs by title or description..."
                      value={designSearchTerm}
                      onChange={(e) => setDesignSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleDesignSearch()}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleDesignSearch}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Search Designs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          {isEditing && (activeSidebarItem === 'newArrival' || activeSidebarItem === 'bestSeller') && viewMode === 'products' ? (
            /* Edit Mode for Products */
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Add to {activeTab === 'newArrival' ? 'New Arrivals' : 'Best Sellers'}
                  </h2>
                  <p className="text-gray-600">Select products from your catalog</p>
                </div>
                <button
                  onClick={() => dispatch(setIsEditing(false))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={localCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {filters.categories && filters.categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub Category
                  </label>
                  <select
                    value={localSubCategory}
                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                    disabled={!localCategory}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">All Sub Categories</option>
                    {getFilteredSubCategories().map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  {!localCategory && (
                    <p className="text-xs text-gray-500 mt-1">
                      Please select a category first
                    </p>
                  )}
                </div>

                <div className="flex items-end">
                  <div className="text-sm text-gray-500">
                    {availableProducts.length} products found
                  </div>
                </div>
              </div>

              {/* Product Selection Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Select Products
                </h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {selectedProductIds.length} selected
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors text-sm font-medium"
                  >
                    {selectedProductIds.length === availableProducts.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              {productsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Edit Mode Products Grid - Updated for Variants with Base URL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-h-[500px] overflow-y-auto p-2">
                    {availableProducts.map(product => (
                      <div
                        key={product._id}
                        onClick={() => handleProductSelect(product._id)}
                        className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                          selectedProductIds.includes(product._id)
                            ? 'border-blue-500 ring-2 ring-blue-100'
                            : 'border-gray-200'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="absolute top-3 right-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            selectedProductIds.includes(product._id)
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          }`}>
                            {selectedProductIds.includes(product._id) && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>

                        {/* Product Image */}
                        <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 overflow-hidden">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={getImageUrl(product.images[0])}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/400x400?text=No+Image';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              No Image
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
                          {product.title}
                        </h4>
                        
                        {/* Variants Info */}
                        {product.variants && product.variants.length > 0 ? (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-gray-600">
                                {product.variants.map(v => v.size).join(', ')}
                              </p>
                              <p className="text-lg font-bold text-blue-600">
                                ₹{Math.min(...product.variants.map(v => v.price))}+
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">
                              Total stock: {product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)} units
                            </p>
                          </div>
                        ) : (
                          // Fallback for old products
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-600">Single variant</p>
                            <p className="text-lg font-bold text-blue-600">
                              ₹{product.price}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 truncate">
                            {product.category} › {product.subCategory}
                          </p>
                          {product.isActive ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <button
                      onClick={() => dispatch(setIsEditing(false))}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={selectedProductIds.length === 0}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        selectedProductIds.length === 0
                          ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      Set as {activeTab === 'newArrival' ? 'New Arrivals' : 'Best Sellers'}
                      {selectedProductIds.length > 0 && (
                        <span className="ml-2 bg-white/20 px-2 py-1 rounded text-sm">
                          {selectedProductIds.length}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : activeSidebarItem === 'dashboard' ? (
            /* Dashboard Content */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">New product added</p>
                        <p className="text-sm text-gray-500">2 hours ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Low Stock Products</span>
                    <span className="font-bold text-red-600">12</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Pending Orders</span>
                    <span className="font-bold text-yellow-600">8</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Today's Revenue</span>
                    <span className="font-bold text-green-600">$2,450</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeSidebarItem === 'designs' ? (
            /* Designs View Mode */
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {designsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : catalogueDesigns.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Palette className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    No designs found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    User-created designs will appear here once they are saved.
                  </p>
                </div>
              ) : (
                <>
                  {/* Designs Table with Base URL */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Design
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category / Sub Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price / Stock
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status / Tags
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {catalogueDesigns.map(design => (
                          <tr key={design._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="h-10 w-10 flex-shrink-0">
                                {design.canvasData?.thumbnail ? (
                                  <img
                                    src={getImageUrl(design.canvasData.thumbnail)}
                                    alt={design.title || 'Design'}
                                    className="h-10 w-10 rounded object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://via.placeholder.com/40x40?text=No+Image';
                                    }}
                                  />
                                ) : (
                                  <div className="h-10 w-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded flex items-center justify-center">
                                    <Palette className="w-5 h-5 text-purple-600" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">
                                {design.title || 'Untitled Design'}
                              </div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {design.description || 'No description'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {design.category || 'Uncategorized'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {design.subCategory || 'No sub-category'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 font-medium">
                                ₹{design.calculatedPrice || '0'}
                              </div>
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                (design.stock || 0) > 10 
                                  ? 'bg-green-100 text-green-800'
                                  : (design.stock || 0) > 0
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {design.stock || 0} units
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col space-y-1">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  design.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {design.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <div className="flex space-x-1">
                                  {design.newArrivals && (
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                      New Arrival
                                    </span>
                                  )}
                                  {design.bestSellers && (
                                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                      Best Seller
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleViewDesign(design)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="View"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                {design.isPublished ? (
                                  <button
                                    onClick={() => handleEditDesign(design)}
                                    className="text-green-600 hover:text-green-900"
                                    title="Edit Details"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePublishDesign(design)}
                                    className="text-yellow-600 hover:text-yellow-900"
                                    title="Publish"
                                  >
                                    <Upload className="w-5 h-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggleDesignStatus(design)}
                                  className={`${
                                    design.isActive
                                      ? 'text-yellow-600 hover:text-yellow-900'
                                      : 'text-green-600 hover:text-green-900'
                                  }`}
                                  title={design.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {design.isActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteDesign(design)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                      <div className="text-sm text-gray-700">
                        Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                            pagination.page === 1
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </button>
                        <div className="flex space-x-1">
                          {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                            let pageNum;
                            if (pagination.pages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.pages - 2) {
                              pageNum = pagination.pages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                  pagination.page === pageNum
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.pages}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                            pagination.page === pagination.pages
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : activeSidebarItem !== 'dropproducts' && activeSidebarItem !== 'orders' && activeSidebarItem !== 'homepage' && activeSidebarItem !== 'search' ? (
            /* View Mode for Products (excluding dropproducts, orders, homepage, and search) */
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {productsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Package className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    No products found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {activeSidebarItem === 'newArrival' || activeSidebarItem === 'bestSeller'
                      ? `Click "Edit List" to add products to ${activeSidebarItem === 'newArrival' ? 'New Arrivals' : 'Best Sellers'}`
                      : 'Add your first product to get started'}
                  </p>
                  {activeSidebarItem === 'newArrival' || activeSidebarItem === 'bestSeller' ? (
                    <button
                      onClick={handleEditClick}
                      className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                      <span>Edit List</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleAddProduct}
                      className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Product</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Products Table - Updated for Variants with Base URL */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sizes / Price Range
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Stock
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {products.map(product => {
                          return (
                            <tr key={product._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 flex-shrink-0">
                                    {product.images && product.images.length > 0 ? (
                                      <img
                                        src={getImageUrl(product.images[0])}
                                        alt={product.title}
                                        className="h-10 w-10 rounded object-cover"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = "https://via.placeholder.com/40x40?text=No+Image";
                                        }}
                                      />
                                    ) : (
                                      <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                                        <Package className="w-5 h-5 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {product.title}
                                    </div>
                                    <div className="flex space-x-2 mt-1">
                                      {product.newArrival && (
                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                          New
                                        </span>
                                      )}
                                      {product.bestSeller && (
                                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                          Best Seller
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">{product.category}</div>
                                <div className="text-sm text-gray-500">{product.subCategory}</div>
                              </td>

                              <td className="px-6 py-4">
                                {product.variants && product.variants.length > 0 ? (
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {product.variants.map((v) => v.size).join(", ")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      ₹{Math.min(...product.variants.map((v) => v.price))} - ₹
                                      {Math.max(...product.variants.map((v) => v.price))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm font-medium text-gray-900">
                                    ₹{product.price || 0}
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-4">
                                {product.variants && product.variants.length > 0 ? (
                                  <div>
                                    <span
                                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        product.variants.reduce(
                                          (sum, v) => sum + (v.stock || 0),
                                          0
                                        ) > 10
                                          ? "bg-green-100 text-green-800"
                                          : product.variants.reduce(
                                              (sum, v) => sum + (v.stock || 0),
                                              0
                                            ) > 0
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {product.variants.reduce(
                                        (sum, v) => sum + (v.stock || 0),
                                        0
                                      )}{" "}
                                      units
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {product.variants.filter((v) => v.stock > 0).length} sizes
                                      available
                                    </div>
                                  </div>
                                ) : (
                                  <span
                                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      product.stock > 10
                                        ? "bg-green-100 text-green-800"
                                        : product.stock > 0
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {product.stock || 0} units
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    product.isActive
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {product.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleViewProduct(product)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="View"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>

                                  <button
                                    onClick={() => handleEditProduct(product)}
                                    className="text-green-600 hover:text-green-900"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleStatus(product._id)}
                                    className={`${
                                      product.isActive
                                        ? "text-yellow-600 hover:text-yellow-900"
                                        : "text-green-600 hover:text-green-900"
                                    }`}
                                    title={product.isActive ? "Deactivate" : "Activate"}
                                  >
                                    {product.isActive ? (
                                      <EyeOff className="w-5 h-5" />
                                    ) : (
                                      <Eye className="w-5 h-5" />
                                    )}
                                  </button>

                                  {activeSidebarItem === "newArrival" ||
                                  activeSidebarItem === "bestSeller" ? (
                                    <button
                                      onClick={() => handleRemoveProduct(product._id)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteProduct(product)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                      <div className="text-sm text-gray-700">
                        Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                            pagination.page === 1
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </button>
                        <div className="flex space-x-1">
                          {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                            let pageNum;
                            if (pagination.pages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.pages - 2) {
                              pageNum = pagination.pages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                  pagination.page === pageNum
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.pages}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                            pagination.page === pagination.pages
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;