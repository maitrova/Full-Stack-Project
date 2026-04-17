// client/src/components/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Settings,
  BarChart3,
  Palette,
  Grid,
  Tag,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Home
} from 'lucide-react';

import { fetchFilters } from '../../redux/slices/productList.js';
import { 
  addNotification, 
  removeNotification,
  setActiveTab 
} from '../../redux/slices/adminSlice.js';

// Import all components
import Dashboard from './Dashboard.jsx';
import AllProducts from './AllProducts.jsx';
import Designs from './Designs.jsx';
import NewArrivals from './NewArrivals.jsx';
import BestSellers from './BestSellers.jsx';
import HomepageAdmin from './HomepageAdmin.jsx'; // Add this
import ReturnManagement from './ReturnManagement.jsx';

// Import modals
import ProductFormModal from '../newproductadding.jsx';
import DesignPublishModal from '../DesignPublishModal.jsx';

const AdminDashboard = () => {
  const dispatch = useDispatch();
  
  const { filters } = useSelector((state) => state.productList);
  const { notifications } = useSelector((state) => state.admin);
  const { activeTab } = useSelector((state) => state.admin); // Get activeTab from Redux
  
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentSubCategory, setCurrentSubCategory] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showDesignPublishModal, setShowDesignPublishModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingDesign, setEditingDesign] = useState(null);

  useEffect(() => {
    dispatch(fetchFilters());
  }, [dispatch]);

  const handleTabChange = (tab) => {
    dispatch(setActiveTab(tab));
    setCurrentCategory('');
    setCurrentSubCategory('');
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
    setEditingDesign(design);
    setShowDesignPublishModal(true);
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    // You might want to implement a product details modal
    console.log('View product:', product);
  };

  const handleToggleStatus = async (productId) => {
    // Implementation depends on your Redux actions
    console.log('Toggle status for:', productId);
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
    { id: 'homepage', label: 'Homepage', icon: <Home className="w-5 h-5" /> }, // Add this
    { id: 'allProducts', label: 'All Products', icon: <Package className="w-5 h-5" /> },
    { id: 'designs', label: 'Designs', icon: <Palette className="w-5 h-5" /> },
    { id: 'newArrival', label: 'New Arrivals', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'bestSeller', label: 'Best Sellers', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'returns', label: 'Returns', icon: <Package className="w-5 h-5" /> },
    { id: 'prices', label: 'Prices', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'homepage': // Add this case
        return <HomepageAdmin />;
      case 'allProducts':
        return (
          <AllProducts
            filters={filters}
            currentCategory={currentCategory}
            currentSubCategory={currentSubCategory}
            setCurrentCategory={setCurrentCategory}
            setCurrentSubCategory={setCurrentSubCategory}
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onToggleStatus={handleToggleStatus}
            onAddProduct={handleAddProduct}
          />
        );
      case 'designs':
        return (
          <Designs
            onPublishDesign={handlePublishDesign}
            onEditDesign={handleEditDesign}
          />
        );
      case 'newArrival':
        return (
          <NewArrivals
            filters={filters}
            currentCategory={currentCategory}
            currentSubCategory={currentSubCategory}
            setCurrentCategory={setCurrentCategory}
            setCurrentSubCategory={setCurrentSubCategory}
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onToggleStatus={handleToggleStatus}
            onAddProduct={handleAddProduct}
          />
        );
      case 'bestSeller':
        return (
          <BestSellers
            filters={filters}
            currentCategory={currentCategory}
            currentSubCategory={currentSubCategory}
            setCurrentCategory={setCurrentCategory}
            setCurrentSubCategory={setCurrentSubCategory}
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onToggleStatus={handleToggleStatus}
            onAddProduct={handleAddProduct}
          />
        );
      case 'returns':
        return <ReturnManagement />;
      default:
        return <Dashboard />;
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'homepage': return 'Homepage Management';
      case 'allProducts': return 'All Products';
      case 'designs': return 'Designs';
      case 'newArrival': return 'New Arrivals';
      case 'bestSeller': return 'Best Sellers';
      case 'returns': return 'Return Management';
      case 'prices': return 'Price Management';
      case 'users': return 'User Management';
      case 'analytics': return 'Analytics';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const getHeaderDescription = () => {
    switch (activeTab) {
      case 'dashboard': return 'Overview of your store performance';
      case 'homepage': return 'Manage featured content displayed on the homepage';
      case 'allProducts': return 'Manage all products in your store';
      case 'designs': return 'Manage user-created designs';
      case 'newArrival': return 'Manage new arrival products';
      case 'bestSeller': return 'Manage best selling products';
      case 'returns': return 'Review customer return requests and refund details';
      case 'prices': return 'Manage product pricing and discounts';
      case 'users': return 'Manage customers and administrators';
      case 'analytics': return 'View sales and performance analytics';
      case 'settings': return 'Configure store settings';
      default: return 'Overview of your store performance';
    }
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

      {/* Modals */}
      <ProductFormModal
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        isEdit={!!editingProduct}
      />

      <DesignPublishModal
        isOpen={showDesignPublishModal}
        onClose={() => {
          setShowDesignPublishModal(false);
          setSelectedDesign(null);
          setEditingDesign(null);
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
                  activeTab === item.id
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
                {getHeaderTitle()}
              </h1>
              <p className="text-gray-600 mt-2">
                {getHeaderDescription()}
              </p>
            </div>
          </div>

          {/* Main Content */}
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
