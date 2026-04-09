import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
  adminBulkUpdateOrderStatus,
  adminFetchOrderById,
  selectAdminOrders,
  selectAdminOrdersLoading,
  selectAdminOrdersError,
  selectAdminOrder,
  selectAdminOrderLoading,
  selectUpdateStatusLoading,
  selectBulkUpdateLoading,
  selectLastBulkResult,
  clearOrderErrors,
  clearAdminOrder
} from '../../redux/slices/orderSlice.js';
import { updateOrderStatus, resetOrderStatusState } from '../../redux/slices/orderStatusSlice.js';
import { exportOrders, resetExportState } from '../../redux/slices/exportorders.js';

const AdminOrders = () => {
  const dispatch = useDispatch();
  const orders = useSelector(selectAdminOrders);
  const loading = useSelector(selectAdminOrdersLoading);
  const error = useSelector(selectAdminOrdersError);
  const selectedOrder = useSelector(selectAdminOrder);
  const selectedOrderLoading = useSelector(selectAdminOrderLoading);
  const updateLoading = useSelector(selectUpdateStatusLoading);
  const bulkUpdateLoading = useSelector(selectBulkUpdateLoading);
  const lastBulkResult = useSelector(selectLastBulkResult);
  
  // Get order status slice state
  const orderStatusState = useSelector((state) => state.orderStatus);
  const orderStatusLoading = orderStatusState.loading;
  const orderStatusError = orderStatusState.error;
  const orderStatusSuccess = orderStatusState.success;
  const orderStatusSummary = orderStatusState.summary;
  
  // Get export slice state
  const exportState = useSelector((state) => state.exportOrders || { loading: false, success: false, error: null });
  const exportLoading = exportState.loading;
  const exportError = exportState.error;
  const exportSuccess = exportState.success;
  
  const [filters, setFilters] = useState({
    paymentStatus: '',
    orderStatus: '',
    userId: '',
    dateFrom: '',
    dateTo: ''
  });
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [showDesignViewerModal, setShowDesignViewerModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('READY');
  const [editOrderId, setEditOrderId] = useState(null);
  const [editOrderStatus, setEditOrderStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showExportNotification, setShowExportNotification] = useState(false);

  // Get base URL from environment variables
  const API_BASE_URL = (
    import.meta.env.VITE_IMAGE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000'
  ).replace(/\/+$/, '');
  const ORIGIN_BASE_URL = API_BASE_URL.replace(/\/api$/i, '');
  const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
  const SPECIAL_URL_RE = /^(?:data:|blob:)/i;
  const FALLBACK_THUMBNAIL =
    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' dominant-baseline='middle' text-anchor='middle' font-family='Arial%2Csans-serif' font-size='12' fill='%239ca3af'%3ENo Image%3C/text%3E%3C/svg%3E";
  const FALLBACK_PREVIEW =
    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Ctext x='200' y='200' dominant-baseline='middle' text-anchor='middle' font-family='Arial%2Csans-serif' font-size='24' fill='%239ca3af'%3ENo Preview%3C/text%3E%3C/svg%3E";

  useEffect(() => {
    dispatch(adminFetchOrders(filters));
    dispatch(resetOrderStatusState());
    dispatch(resetExportState());
    return () => {
      dispatch(clearOrderErrors());
      dispatch(clearAdminOrder());
      dispatch(resetOrderStatusState());
      dispatch(resetExportState());
    };
  }, [dispatch, filters]);

  useEffect(() => {
    if (editOrderId) {
      dispatch(adminFetchOrderById(editOrderId));
    }
  }, [editOrderId, dispatch]);

  // Effect to show success notification
  useEffect(() => {
    if (orderStatusSuccess && orderStatusSummary) {
      dispatch(adminFetchOrders(filters));
      setShowSuccessNotification(true);
      if (selectedOrders.length > 0) {
        setSelectedOrders([]);
      }
      const timer = setTimeout(() => {
        setShowSuccessNotification(false);
        dispatch(resetOrderStatusState());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [orderStatusSuccess, orderStatusSummary, dispatch, filters, selectedOrders.length]);

  // Effect to show export success notification
  useEffect(() => {
    if (exportSuccess) {
      setShowExportNotification(true);
      const timer = setTimeout(() => {
        setShowExportNotification(false);
        dispatch(resetExportState());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [exportSuccess, dispatch]);

  // Close modals when order status update is successful
  useEffect(() => {
    if (orderStatusSuccess) {
      setShowBulkUpdateModal(false);
    }
  }, [orderStatusSuccess]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    dispatch(adminFetchOrders(filters));
  };

  const handleResetFilters = () => {
    setFilters({
      paymentStatus: '',
      orderStatus: '',
      userId: '',
      dateFrom: '',
      dateTo: ''
    });
    dispatch(adminFetchOrders({}));
  };

  const handleOrderSelect = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(order => order._id));
    }
  };

  const handleExportOrders = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select at least one order to export');
      return;
    }
    
    try {
      await dispatch(exportOrders(selectedOrders)).unwrap();
      // Don't clear selection automatically - let user decide
    } catch (err) {
      console.error('Failed to export orders:', err);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await dispatch(updateOrderStatus({ 
        orderId, 
        orderStatus: newStatus 
      })).unwrap();
      dispatch(adminFetchOrders(filters));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleIndividualEdit = (orderId, currentStatus) => {
    setEditOrderId(orderId);
    setEditOrderStatus(currentStatus);
    setShowOrderDetailModal(true);
    setActiveTab('details');
  };

  const handleSaveIndividualEdit = async () => {
    if (!editOrderId || !editOrderStatus) return;
    
    try {
      await dispatch(updateOrderStatus({ 
        orderId: editOrderId, 
        orderStatus: editOrderStatus 
      })).unwrap();
      dispatch(adminFetchOrders(filters));
      setShowOrderDetailModal(false);
      setEditOrderId(null);
      setEditOrderStatus('');
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.length === 0) return;
    
    try {
      await dispatch(updateOrderStatus({
        orderIds: selectedOrders,
        orderStatus: bulkStatus
      })).unwrap();
      dispatch(adminFetchOrders(filters));
      setSelectedOrders([]);
      setShowBulkUpdateModal(false);
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  };

  const handleViewDesign = (orderId, itemIndex = 0, viewIndex = 0) => {
    setEditOrderId(orderId);
    setSelectedItemIndex(itemIndex);
    setSelectedViewIndex(viewIndex);
    setActiveTab('design');
    setShowOrderDetailModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      PAID: 'bg-green-100 text-green-800 border border-green-200',
      FAILED: 'bg-red-100 text-red-800 border border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border border-gray-200',
      PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-200',
      READY: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      SHIPPED: 'bg-purple-100 text-purple-800 border border-purple-200',
      DELIVERED: 'bg-gray-100 text-gray-800 border border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getItemName = (item) => {
    if (item.kind === "READYMADE" && item.readymadeProduct?.title) {
      return item.readymadeProduct.title;
    } else if (item.kind === "DESIGN" && item.design) {
      return item.design.title || item.product?.name || 'Custom Design';
    } else if (item.dropproduct?.name) {
      return item.dropproduct.name;
    } else if (item.product?.name) {
      return item.product.name;
    }
    return 'Product';
  };

  const getItemType = (item) => {
    switch (item.kind) {
      case 'READYMADE':
        return 'Ready-made Product';
      case 'DESIGN':
        return 'Custom Design';
      case 'DROPPRODUCT':
        return 'Drop Product';
      default:
        return 'Product';
    }
  };

  const getProductDetails = (item) => {
  let result;

  if (item.kind === "READYMADE" && item.readymadeProduct) {
    result = {
      isDesign: false,
      category: item.readymadeProduct.category,
      subCategory: item.readymadeProduct.subCategory,
      brand: item.readymadeProduct.brand,
      description: item.readymadeProduct.description
    };
  } else if (item.kind === "DESIGN" && item.design) {
    result = {
      isDesign: true,
      category: item.product?.category || 'Custom Design',
      subCategory: item.product?.subCategory || 'User Designed',
      brand: 'Custom Design',
      description: item.design.description || 'User custom design'
    };
  } else if (item.dropproduct) {
    result = {
      isDesign: false,
      category: item.dropproduct.category || 'Drop Product',
      subCategory: item.dropproduct.subCategory || '',
      brand: item.dropproduct.brand || '',
      description: item.dropproduct.description || ''
    };
  } else if (item.product) {
    result = {
      isDesign: false,
      category: item.product.category || 'Product',
      subCategory: item.product.subCategory || '',
      brand: item.product.brand || '',
      description: item.product.description || ''
    };
  } else {
    result = {
      isDesign: false,
      category: '',
      subCategory: '',
      brand: '',
      description: ''
    };
  }

  console.log("Product Details:", result);
  return result;
};


  const resolveImageUrl = (path, fallback = FALLBACK_THUMBNAIL) => {
    if (!path) return fallback;

    const rawPath = String(path).trim();
    if (!rawPath) return fallback;
    if (ABSOLUTE_URL_RE.test(rawPath) || SPECIAL_URL_RE.test(rawPath)) {
      return rawPath;
    }

    const normalizedPath = rawPath.replace(/\\/g, '/');

    if (normalizedPath.startsWith('/api/')) {
      return `${ORIGIN_BASE_URL}${normalizedPath}`;
    }
    if (normalizedPath.startsWith('api/')) {
      return `${ORIGIN_BASE_URL}/${normalizedPath}`;
    }
    if (normalizedPath.startsWith('/outputs/')) {
      return `${ORIGIN_BASE_URL}/api${normalizedPath}`;
    }
    if (normalizedPath.startsWith('outputs/')) {
      return `${ORIGIN_BASE_URL}/api/${normalizedPath}`;
    }

    return `${API_BASE_URL}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  };

  const handleImageError = (event, fallback = FALLBACK_THUMBNAIL) => {
    if (!event?.target) return;
    event.target.onerror = null;
    event.target.src = fallback;
  };

  const getItemImage = (item) => {
    if (item.previewImage) {
      return resolveImageUrl(item.previewImage);
    }

    if (item.kind === "READYMADE" && item.readymadeProduct) {
      if (item.readymadeProduct.thumbnail) {
        return resolveImageUrl(item.readymadeProduct.thumbnail);
      }
      if (item.readymadeProduct.images && item.readymadeProduct.images.length > 0) {
        return resolveImageUrl(item.readymadeProduct.images[0]);
      }
    } else if (item.kind === "DESIGN" && item.design) {
      if (item.design.previewImage) {
        return resolveImageUrl(item.design.previewImage);
      }
      if (item.design.views && item.design.views.length > 0) {
        return resolveImageUrl(item.design.views[0]?.previewImage);
      }
    }

    return FALLBACK_THUMBNAIL;
  };

  const getViewImage = (view) => resolveImageUrl(view?.previewImage, FALLBACK_PREVIEW);

  const downloadImage = (url, filename) => {
    const resolvedUrl = resolveImageUrl(url, '');
    if (!resolvedUrl) {
      alert('No image available to download');
      return;
    }

    fetch(resolvedUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Image download failed with status ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'design-layer.png';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      })
      .catch(err => {
        console.error('Error downloading image:', err);
        alert('Failed to download image');
      });
  };

  const calculateTotal = (order) => {
    if (!order?.items) return '0.00';
    return order.items.reduce((total, item) => {
      return total + (item.unitPrice * item.qty);
    }, 0).toFixed(2);
  };

  const getOrderStatusSummaryText = (summary) => {
    if (!summary) return '';
    if (typeof summary === 'string') return summary;

    const totalProcessed = Number(summary.totalProcessed || 0);
    const updated = Number(summary.updated || 0);
    const skipped = Number(summary.skipped || 0);

    return `${updated} updated, ${skipped} skipped, ${totalProcessed} processed`;
  };

  const getPriceBreakdown = (item) => {
    if (item.kind === "DESIGN" && item.design?.priceBreakdown) {
      return item.design.priceBreakdown;
    }
    return null;
  };

  const filteredOrders = orders.filter(order =>
    searchTerm === '' ||
    order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.deliveryAddress?.completeAddress?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: orders.length,
    paid: orders.filter(o => o.status === 'PAID').length,
    pending: orders.filter(o => o.status === 'PENDING_PAYMENT').length,
    processing: orders.filter(o => o.orderStatus === 'PROCESSING').length,
    ready: orders.filter(o => o.orderStatus === 'READY').length,
    shipped: orders.filter(o => o.orderStatus === 'SHIPPED').length,
    delivered: orders.filter(o => o.orderStatus === 'DELIVERED').length
  };

  const getProductId = (item) => {
    return (
      item.readymadeProduct?._id ||
      item.dropproduct?._id ||
      item.design?._id ||
      item.product?._id ||
      "N/A"
    );
  };

  const getDesignColor = (item) => {
    if (item.kind !== "DESIGN") return null;
    return (
      item.design?.productColorName ||
      item.design?.productColor ||
      item.color ||
      "N/A"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            {/* Left Section */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Order Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage and update customer orders
              </p>
            </div>

            {/* Right Section */}
            <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
              {/* Export Button */}
              <button
                onClick={handleExportOrders}
                disabled={selectedOrders.length === 0 || exportLoading}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white 
                  ${selectedOrders.length > 0 && !exportLoading
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-gray-400 cursor-not-allowed'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 transition`}
              >
                {exportLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to Excel ({selectedOrders.length})
                  </>
                )}
              </button>

              {selectedOrders.length > 0 && (
                <>
                  <span className="text-sm text-gray-600">
                    {selectedOrders.length} order
                    {selectedOrders.length !== 1 ? "s" : ""} selected
                  </span>

                  <button
                    onClick={() => setShowBulkUpdateModal(true)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
                  >
                    Bulk Update Status
                  </button>

                  <button
                    onClick={() => setSelectedOrders([])}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Success Notification */}
        {showSuccessNotification && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  ✅ Order status updated successfully! {getOrderStatusSummaryText(orderStatusSummary)}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => {
                    setShowSuccessNotification(false);
                    dispatch(resetOrderStatusState());
                  }}
                  className="text-green-700 hover:text-green-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Success Notification */}
        {showExportNotification && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  ✅ Orders exported successfully! Your download should start shortly.
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => {
                    setShowExportNotification(false);
                    dispatch(resetExportState());
                  }}
                  className="text-green-700 hover:text-green-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Error Notification */}
        {exportError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  ❌ Export failed: {exportError}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => dispatch(resetExportState())}
                  className="text-red-700 hover:text-red-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Total Orders</h4>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Paid Orders</h4>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.paid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Processing</h4>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.processing}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Delivered</h4>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.delivered}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            <button
              onClick={handleResetFilters}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Reset Filters
            </button>
          </div>
          <form onSubmit={handleApplyFilters} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label htmlFor="paymentStatus" className="block text-sm font-medium text-gray-700">
                  Payment Status
                </label>
                <select
                  id="paymentStatus"
                  name="paymentStatus"
                  value={filters.paymentStatus}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">All Payment Status</option>
                  <option value="PENDING_PAYMENT">Pending Payment</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label htmlFor="orderStatus" className="block text-sm font-medium text-gray-700">
                  Order Status
                </label>
                <select
                  id="orderStatus"
                  name="orderStatus"
                  value={filters.orderStatus}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">All Order Status</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="READY">Ready</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>

              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                  User ID
                </label>
                <input
                  type="text"
                  id="userId"
                  name="userId"
                  value={filters.userId}
                  onChange={handleFilterChange}
                  placeholder="Enter user ID"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
                  From Date
                </label>
                <input
                  type="date"
                  id="dateFrom"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  max={filters.dateTo || undefined}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">
                  To Date
                </label>
                <input
                  type="date"
                  id="dateTo"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                  min={filters.dateFrom || undefined}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reset
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Filters
              </button>
            </div>
          </form>
        </div>

        {/* Search and Actions */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search orders by ID, name, email, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Status Error Display */}
        {orderStatusError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{orderStatusError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Legacy Bulk Result Notification */}
        {lastBulkResult && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Successfully updated {lastBulkResult.modified} of {lastBulkResult.matched} orders to {lastBulkResult.orderStatus}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr 
                    key={order._id} 
                    className={`hover:bg-gray-50 ${selectedOrders.includes(order._id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order._id)}
                        onChange={() => handleOrderSelect(order._id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{order._id.slice(-8).toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {order._id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.user?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{order.user?.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.items?.length || 0} items</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {order.items?.map((item, idx) => (
                          <span key={idx}>
                            {getItemName(item)} ({getItemType(item)})
                            {idx < order.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{order.total?.toFixed(2) || calculateTotal(order)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <select
                          value={order.orderStatus}
                          onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                          disabled={orderStatusLoading || updateLoading}
                          className="block w-32 pl-3 pr-8 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md disabled:opacity-50"
                        >
                          <option value="PROCESSING">Processing</option>
                          <option value="READY">Ready</option>
                          <option value="SHIPPED">Shipped</option>
                          <option value="DELIVERED">Delivered</option>
                        </select>
                        <button
                          onClick={() => handleIndividualEdit(order._id, order.orderStatus)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search term.</p>
              <div className="mt-6">
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Info */}
        {filteredOrders.length > 0 && (
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-gray-700">
            <div>
              Showing {filteredOrders.length} orders
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-600">
                {selectedOrders.length} selected
              </span>
              {selectedOrders.length > 0 && (
                <>
                  <button
                    onClick={handleExportOrders}
                    disabled={exportLoading}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {exportLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      'Export Excel'
                    )}
                  </button>
                  <button
                    onClick={() => setShowBulkUpdateModal(true)}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Bulk Update
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Update Order Status</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Update <span className="font-semibold">{selectedOrders.length}</span> selected orders to:
              </p>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="PROCESSING">PROCESSING</option>
                <option value="READY">READY</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Note: Only orders with "PAID" payment status will be updated.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={orderStatusLoading || bulkUpdateLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {orderStatusLoading || bulkUpdateLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  'Update Orders'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail/Edit Modal */}
      {showOrderDetailModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Order Details #{selectedOrder?._id?.slice(-8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Placed on {formatDate(selectedOrder?.createdAt)} • Customer: {selectedOrder?.user?.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowOrderDetailModal(false);
                    setEditOrderId(null);
                    setEditOrderStatus('');
                    setActiveTab('details');
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Tabs */}
              <div className="mt-4 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'details'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Order Details
                  </button>
                  <button
                    onClick={() => setActiveTab('design')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'design'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Design View
                  </button>
                  <button
                    onClick={() => setActiveTab('price')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'price'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Price Breakdown
                  </button>
                </nav>
              </div>
            </div>

            <div className="p-6">
              {selectedOrderLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : selectedOrder ? (
                <>
                  {/* Order Details Tab */}
                  {activeTab === 'details' && (
                    <div className="space-y-6">
                      {/* Order Status Edit Section */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Update Order Status</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Current Status
                            </label>
                            <div className={`px-3 py-2 rounded-md ${getStatusColor(selectedOrder.orderStatus)}`}>
                              {selectedOrder.orderStatus}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              New Status
                            </label>
                            <select
                              value={editOrderStatus}
                              onChange={(e) => setEditOrderStatus(e.target.value)}
                              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                              <option value="">Select status</option>
                              <option value="PROCESSING">PROCESSING</option>
                              <option value="READY">READY</option>
                              <option value="SHIPPED">SHIPPED</option>
                              <option value="DELIVERED">DELIVERED</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSaveIndividualEdit}
                            disabled={!editOrderStatus || orderStatusLoading || updateLoading}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {orderStatusLoading || updateLoading ? 'Updating...' : 'Update Status'}
                          </button>
                        </div>
                      </div>

                      {/* Order Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Order Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Order ID:</span>
                              <span className="font-medium text-gray-900">{selectedOrder._id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Created:</span>
                              <span className="font-medium text-gray-900">{formatDate(selectedOrder.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Last Updated:</span>
                              <span className="font-medium text-gray-900">{formatDate(selectedOrder.updatedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Payment Status:</span>
                              <span className={`font-medium ${selectedOrder.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                                {selectedOrder.status}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Amount:</span>
                              <span className="font-medium text-gray-900">₹{selectedOrder.total?.toFixed(2) || calculateTotal(selectedOrder)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Name:</span>
                              <span className="font-medium text-gray-900">{selectedOrder.user?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-medium text-gray-900">{selectedOrder.user?.email || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">User ID:</span>
                              <span className="font-medium text-gray-900">{selectedOrder.user?._id || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-3">Order Items ({selectedOrder.items?.length || 0})</h4>
                        <div className="space-y-4">
                          {selectedOrder.items?.map((item, idx) => {
                            const productDetails = getProductDetails(item);
                            return (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-4">
                                  <img
                                    src={getItemImage(item)}
                                    alt={getItemName(item)}
                                    className="h-20 w-20 object-cover rounded-lg"
                                    onError={(e) => {
                                      handleImageError(e);
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="flex justify-between">
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-900">
                                          {getItemName(item)}
                                        </h5>

                                        <p className="text-xs text-gray-500 mt-1 break-all">
                                          Product ID: {getProductId(item)}
                                        </p>

                                      {item.kind === "DESIGN" && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        <span className="font-medium text-gray-600">Color:</span>{" "}
                                        {getDesignColor(item)}
                                      </p>
                                      )}

                                        <div className="flex items-center space-x-2 mt-1">
                                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                            {getItemType(item)}
                                          </span>
                                          {productDetails.isDesign && (
                                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                              Custom Design
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                          Size: {item.size || 'N/A'} • Qty: {item.qty}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          Unit Price: ₹{item.unitPrice?.toFixed(2)} • Total: ₹{(item.unitPrice * item.qty).toFixed(2)}
                                        </p>
                                      </div>
                                      {productDetails.isDesign && (
                                        <button
                                          onClick={() => handleViewDesign(selectedOrder._id, idx, 0)}
                                          className="text-sm text-indigo-600 hover:text-indigo-800"
                                        >
                                          View Design
                                        </button>
                                      )}
                                    </div>
                                    
                                    {/* Product Details */}
                                    <div className="mt-3">
                                      {productDetails.category && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                          {productDetails.category && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                              {productDetails.category}
                                            </span>
                                          )}
                                          {productDetails.subCategory && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                              {productDetails.subCategory}
                                            </span>
                                          )}
                                          {productDetails.brand && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                              {productDetails.brand}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {productDetails.description && (
                                        <p className="text-xs text-gray-600">
                                          {productDetails.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Address Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Delivery Address</h4>
                          {selectedOrder.deliveryAddress ? (
                            <div className="text-sm text-gray-600">
                              <p className="font-medium">{selectedOrder.deliveryAddress.fullName}</p>
                              <p className="mt-2">{selectedOrder.deliveryAddress.completeAddress}</p>
                              <p className="mt-1">
                                {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} {selectedOrder.deliveryAddress.pincode}
                              </p>
                              <div className="mt-3 space-y-1">
                                <p className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                  </svg>
                                  {selectedOrder.deliveryAddress.mobileNumber}
                                </p>
                                {selectedOrder.deliveryAddress.landmark && (
                                  <p className="flex items-center">
                                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    {selectedOrder.deliveryAddress.landmark}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No delivery address specified</p>
                          )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-3">Billing Address</h4>
                          {selectedOrder.billingAddress ? (
                            <div className="text-sm text-gray-600">
                              <p className="font-medium">{selectedOrder.billingAddress.fullName}</p>
                              <p className="mt-2">{selectedOrder.billingAddress.completeAddress}</p>
                              <p className="mt-1">
                                {selectedOrder.billingAddress.city}, {selectedOrder.billingAddress.state} {selectedOrder.billingAddress.pincode}
                              </p>
                              <div className="mt-3 space-y-1">
                                <p className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                  </svg>
                                  {selectedOrder.billingAddress.mobileNumber}
                                </p>
                                {selectedOrder.billingAddress.landmark && (
                                  <p className="flex items-center">
                                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    {selectedOrder.billingAddress.landmark}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Same as delivery address</p>
                          )}
                        </div>
                      </div>

                      {/* Payment Details */}
                      {selectedOrder.payment && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-4">Payment Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm text-gray-600">Payment Status</p>
                              <p className={`mt-1 text-sm font-semibold ${selectedOrder.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                                {selectedOrder.payment.status}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Currency</p>
                              <p className="mt-1 text-sm font-medium text-gray-900">{selectedOrder.currency}</p>
                            </div>
                            {selectedOrder.payment.razorpayPaymentId && (
                              <div>
                                <p className="text-sm text-gray-600">Payment ID</p>
                                <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                                  {selectedOrder.payment.razorpayPaymentId}
                                </p>
                              </div>
                            )}
                            {selectedOrder.payment.razorpayOrderId && (
                              <div>
                                <p className="text-sm text-gray-600">Order ID</p>
                                <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                                  {selectedOrder.payment.razorpayOrderId}
                                </p>
                              </div>
                            )}
                            {selectedOrder.payment.razorpaySignature && (
                              <div className="col-span-2">
                                <p className="text-sm text-gray-600">Signature</p>
                                <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                                  {selectedOrder.payment.razorpaySignature}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Design View Tab */}
                  {activeTab === 'design' && selectedOrder.items?.[selectedItemIndex]?.kind === 'DESIGN' && (
                    <div className="space-y-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">Design Viewer</h4>
                            <p className="text-sm text-gray-600">
                              Item {selectedItemIndex + 1} of {selectedOrder.items?.length} • {selectedOrder.items?.[selectedItemIndex]?.design?.productName || 'Custom Design'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            {selectedOrder.items?.[selectedItemIndex]?.design?.views?.map((view, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedViewIndex(idx)}
                                className={`px-3 py-1 text-sm rounded ${
                                  selectedViewIndex === idx
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {view.code.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Design View */}
                        {selectedOrder.items?.[selectedItemIndex]?.design?.views?.[selectedViewIndex] && (
                          <div className="mt-4">
                            <div className="flex justify-center mb-4">
                              <img
                                src={getViewImage(selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex])}
                                alt={`${selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex].code} view`}
                                className="max-w-full h-auto max-h-96 object-contain rounded-lg border border-gray-300"
                                onError={(e) => {
                                  handleImageError(e, FALLBACK_PREVIEW);
                                }}
                              />
                            </div>

                            {/* Design Layers */}
                            {selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex].designLayers?.length > 0 && (
                              <div className="mt-6">
                                <h5 className="text-md font-medium text-gray-900 mb-3">Design Layers</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex].designLayers.map((layer, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-3">
                                      <div className="flex items-start space-x-3">
                                        <img
                                          src={resolveImageUrl(layer.imageUrl)}
                                          alt={`Design layer ${idx + 1}`}
                                          className="h-16 w-16 object-cover rounded"
                                          onError={(e) => {
                                            handleImageError(e);
                                          }}
                                        />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">Layer {idx + 1}</p>
                                          <p className="text-xs text-gray-500">Zone: {layer.zone}</p>
                                          <p className="text-xs text-gray-500">Size: {layer.widthInches}" × {layer.heightInches}"</p>
                                          <p className="text-xs text-gray-500">Area: {layer.areaInches?.toFixed(2) || '0.00'}"²</p>
                                          <button
                                            onClick={() => downloadImage(layer.imageUrl, `design-layer-${idx + 1}.png`)}
                                            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
                                          >
                                            Download Image
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Text Layers */}
                            {selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex].textLayers?.length > 0 && (
                              <div className="mt-6">
                                <h5 className="text-md font-medium text-gray-900 mb-3">Text Layers</h5>
                                <div className="space-y-2">
                                  {selectedOrder.items[selectedItemIndex].design.views[selectedViewIndex].textLayers.map((text, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-3">
                                      <p className="text-sm font-medium text-gray-900">"{text.text}"</p>
                                      <p className="text-xs text-gray-500">
                                        Font: {text.fontFamily} • Size: {text.fontSize} • Color: {text.color}
                                      </p>
                                      <p className="text-xs text-gray-500">Position: ({text.x}, {text.y}) • Rotation: {text.rotation}°</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price Breakdown Tab */}
                  {activeTab === 'price' && (
                    <div className="space-y-6">
                      {selectedOrder.items?.map((item, idx) => {
                        const priceBreakdown = getPriceBreakdown(item);
                        if (!priceBreakdown) return null;

                        return (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="text-lg font-medium text-gray-900 mb-4">
                              Price Breakdown: {getItemName(item)}
                            </h4>
                            
                            <div className="space-y-4">
                              {/* Base Price */}
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Base Price</p>
                                  <p className="text-xs text-gray-500">Product base price</p>
                                </div>
                                <p className="text-sm font-medium text-gray-900">₹{priceBreakdown.basePrice?.toFixed(2) || '0.00'}</p>
                              </div>

                              {/* Design Layers */}
                              {priceBreakdown.designLayers?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-900 mb-2">Design Layers</p>
                                  <div className="space-y-2 pl-4">
                                    {priceBreakdown.designLayers.map((layer, layerIdx) => (
                                      <div key={layerIdx} className="flex justify-between text-sm">
                                        <div>
                                          <span className="text-gray-600">Layer {layerIdx + 1}: {layer.zone}</span>
                                          <span className="text-xs text-gray-500 block">
                                            {layer.widthInches}" × {layer.heightInches}" • {layer.pricingRule}
                                          </span>
                                        </div>
                                        <span className="text-gray-900">₹{layer.price?.toFixed(2) || '0.00'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Text Layers */}
                              {priceBreakdown.textLayers?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-900 mb-2">Text Layers</p>
                                  <div className="space-y-2 pl-4">
                                    {priceBreakdown.textLayers.map((text, textIdx) => (
                                      <div key={textIdx} className="flex justify-between text-sm">
                                        <span className="text-gray-600">Text {textIdx + 1}</span>
                                        <span className="text-gray-900">₹{text.price?.toFixed(2) || '0.00'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Sleeves */}
                              {priceBreakdown.sleeves && priceBreakdown.sleeves.total > 0 && (
                                <div className="flex justify-between text-sm">
                                  <div>
                                    <span className="text-gray-600">Sleeves</span>
                                    <span className="text-xs text-gray-500 block">
                                      {priceBreakdown.sleeves.count} sleeves
                                    </span>
                                  </div>
                                  <span className="text-gray-900">₹{priceBreakdown.sleeves.total?.toFixed(2) || '0.00'}</span>
                                </div>
                              )}

                              {/* Minimum Design Charges */}
                              {priceBreakdown.minimumDesignCharges > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Minimum Design Charges</span>
                                  <span className="text-gray-900">₹{priceBreakdown.minimumDesignCharges?.toFixed(2)}</span>
                                </div>
                              )}

                              {/* Total Price */}
                              <div className="border-t border-gray-300 pt-3">
                                <div className="flex justify-between text-lg font-medium">
                                  <span className="text-gray-900">Total Price</span>
                                  <span className="text-indigo-600">₹{priceBreakdown.totalPrice?.toFixed(2) || '0.00'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Order not found</h3>
                  <p className="mt-1 text-sm text-gray-500">Unable to load order details.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-3">
                  {activeTab === 'details' && selectedOrder?.items?.some(item => item.kind === 'DESIGN') && (
                    <button
                      onClick={() => setActiveTab('design')}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      View Designs
                    </button>
                  )}
                  {activeTab === 'design' && (
                    <button
                      onClick={() => setActiveTab('details')}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Back to Details
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowOrderDetailModal(false);
                      setEditOrderId(null);
                      setEditOrderStatus('');
                      setActiveTab('details');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
