import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMyPaidOrders,
  fetchMyPaidOrderById,
  selectMyPaidOrders,
  selectMyPaidOrdersLoading,
  selectMyPaidOrdersError,
  selectMyPaidOrder,
  selectMyPaidOrderLoading,
  clearOrderErrors,
  clearMyPaidOrder
} from '../redux/slices/orderSlice.js';

const UserOrders = () => {
  const dispatch = useDispatch();
  const orders = useSelector(selectMyPaidOrders);
  const loading = useSelector(selectMyPaidOrdersLoading);
  const error = useSelector(selectMyPaidOrdersError);
  const selectedOrder = useSelector(selectMyPaidOrder);
  const selectedOrderLoading = useSelector(selectMyPaidOrderLoading);
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Get base URL from environment variables
  const BASE_URL = import.meta.env.VITE_IMAGE_URL || 'http://localhost:5000';

  useEffect(() => {
    dispatch(fetchMyPaidOrders());
    return () => {
      dispatch(clearOrderErrors());
      dispatch(clearMyPaidOrder());
    };
  }, [dispatch]);

  useEffect(() => {
    if (selectedOrderId) {
      dispatch(fetchMyPaidOrderById(selectedOrderId));
    }
  }, [selectedOrderId, dispatch]);

  const handleViewDetails = (orderId) => {
    setSelectedOrderId(orderId);
    setShowOrderModal(true);
  };

  const closeModal = () => {
    setShowOrderModal(false);
    setSelectedOrderId(null);
    dispatch(clearMyPaidOrder());
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-200',
      READY: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      SHIPPED: 'bg-purple-100 text-purple-800 border border-purple-200',
      DELIVERED: 'bg-green-100 text-green-800 border border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      PAID: 'bg-green-100 text-green-800 border border-green-200',
      PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      FAILED: 'bg-red-100 text-red-800 border border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const calculateTotal = (order) => {
    if (!order?.items) return '0.00';
    return order.items.reduce((total, item) => {
      return total + (item.unitPrice * item.qty);
    }, 0).toFixed(2);
  };

  const getItemName = (item) => {
    if (item.kind === "READYMADE" && item.readymadeProduct?.title) {
      return item.readymadeProduct.title;
    } else if (item.kind === "DESIGN" && item.design?.name) {
      return item.design.name;
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
        return 'User Designed Product';
      case 'DROPPRODUCT':
        return 'Drop Product';
      default:
        return 'Product';
    }
  };

  const getProductDetails = (item) => {
    if (item.kind === "READYMADE" && item.readymadeProduct) {
      return {
        isUserDesigned: false,
        category: item.readymadeProduct.category,
        subCategory: item.readymadeProduct.subCategory,
        brand: item.readymadeProduct.brand,
        description: item.readymadeProduct.description
      };
    } else if (item.kind === "DESIGN" && item.design) {
      return {
        isUserDesigned: true,
        category: 'Custom Design',
        subCategory: 'User Created',
        brand: 'Your Design',
        description: 'This is a custom design created by you'
      };
    } else if (item.dropproduct) {
      return {
        isUserDesigned: false,
        category: item.dropproduct.category || 'Drop Product',
        subCategory: item.dropproduct.subCategory || '',
        brand: item.dropproduct.brand || '',
        description: item.dropproduct.description || ''
      };
    } else if (item.product) {
      return {
        isUserDesigned: false,
        category: item.product.category || 'Product',
        subCategory: item.product.subCategory || '',
        brand: item.product.brand || '',
        description: item.product.description || ''
      };
    }
    
    return {
      isUserDesigned: false,
      category: '',
      subCategory: '',
      brand: '',
      description: ''
    };
  };

  const getItemImage = (item) => {
    // Check previewImage first (from order item)
    if (item.previewImage) {
      return `${BASE_URL}/${item.previewImage}`;
    }
    
    // Check for product images based on kind
    if (item.kind === "READYMADE" && item.readymadeProduct) {
      if (item.readymadeProduct.thumbnail) {
        return `${BASE_URL}/${item.readymadeProduct.thumbnail}`;
      }
      if (item.readymadeProduct.images && item.readymadeProduct.images.length > 0) {
        return `${BASE_URL}/${item.readymadeProduct.images[0]}`;
      }
    } else if (item.kind === "DESIGN" && item.design) {
      if (item.design.previewImage) {
        return `${BASE_URL}/${item.design.previewImage}`;
      }
      if (item.design.thumbnail) {
        return `${BASE_URL}/${item.design.thumbnail}`;
      }
    } else if (item.dropproduct) {
      if (item.dropproduct.thumbnail) {
        return `${BASE_URL}/${item.dropproduct.thumbnail}`;
      }
      if (item.dropproduct.images && item.dropproduct.images.length > 0) {
        return `${BASE_URL}/${item.dropproduct.images[0]}`;
      }
    } else if (item.product) {
      if (item.product.thumbnail) {
        return `${BASE_URL}/${item.product.thumbnail}`;
      }
      if (item.product.images && item.product.images.length > 0) {
        return `${BASE_URL}/${item.product.images[0]}`;
      }
    }
    
    // Return a placeholder image if no image found
    return 'https://via.placeholder.com/100x100?text=No+Image';
  };

  const getFullImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/100x100?text=No+Image';
    if (path.startsWith('http')) return path;
    return `${BASE_URL}/${path}`;
  };

  const getOrderStatusProgress = (orderStatus) => {
    const statusOrder = ['PROCESSING', 'READY', 'SHIPPED', 'DELIVERED'];
    const currentIndex = statusOrder.indexOf(orderStatus);
    return {
      processing: currentIndex >= 0,
      ready: currentIndex >= 1,
      shipped: currentIndex >= 2,
      delivered: currentIndex >= 3
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading orders</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => dispatch(fetchMyPaidOrders())}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">View and track your purchase history</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.2 6.5 10.266a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            Showing only paid orders
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {!orders || orders.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
              <p className="mt-1 text-sm text-gray-500">Start shopping to see your orders here.</p>
              <div className="mt-6">
                <button
                  onClick={() => window.location.href = '/products'}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Browse Products
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {orders.map((order) => {
                const progress = getOrderStatusProgress(order.orderStatus);
                return (
                  <li key={order._id} className="p-6 hover:bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              Order #{order._id.slice(-8).toUpperCase()}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Placed on {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.orderStatus)}`}>
                              {order.orderStatus}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(order.status)}`}>
                              {order.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        {/* Order Progress */}
                        <div className="mt-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${progress.processing ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.ready ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.ready ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.shipped ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.shipped ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.delivered ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.delivered ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Processing</span>
                            <span>Ready</span>
                            <span>Shipped</span>
                            <span>Delivered</span>
                          </div>
                        </div>
                        
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Delivery Address</h4>
                            {order.deliveryAddress ? (
                              <div className="text-sm text-gray-600">
                                <p className="font-medium">{order.deliveryAddress.fullName}</p>
                                <p className="mt-1">{order.deliveryAddress.completeAddress}</p>
                                <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.pincode}</p>
                                <p className="mt-1">Phone: {order.deliveryAddress.mobileNumber}</p>
                                {order.deliveryAddress.landmark && (
                                  <p className="text-xs text-gray-500">Landmark: {order.deliveryAddress.landmark}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">Not specified</p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Order Items ({order.items?.length || 0})</h4>
                            <div className="space-y-3">
                              {order.items?.slice(0, 2).map((item, index) => {
                                const productDetails = getProductDetails(item);
                                return (
                                  <div key={index} className="flex items-center space-x-3">
                                    <img
                                      src={getItemImage(item)}
                                      alt={getItemName(item)}
                                      className="h-12 w-12 object-cover rounded"
                                      onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/100x100?text=No+Image';
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {getItemName(item)}
                                      </p>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                          {getItemType(item)}
                                        </span>
                                        {productDetails.isUserDesigned && (
                                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                            Custom Design
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {item.qty} × ₹{item.unitPrice?.toFixed(2)} = ₹{(item.unitPrice * item.qty).toFixed(2)}
                                      </p>
                                      {item.size && (
                                        <p className="text-xs text-gray-500">Size: {item.size}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {order.items?.length > 2 && (
                                <p className="text-sm text-gray-500">
                                  +{order.items.length - 2} more item{order.items.length - 2 !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Summary</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="text-gray-900">₹{order.subtotal?.toFixed(2) || calculateTotal(order)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shipping:</span>
                                <span className="text-gray-900">₹0.00</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                                <span className="font-medium text-gray-900">Total:</span>
                                <span className="text-xl font-bold text-gray-900">₹{order.total?.toFixed(2) || calculateTotal(order)}</span>
                              </div>
                              {order.payment?.razorpayPaymentId && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Payment ID: {order.payment.razorpayPaymentId.slice(-8)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 md:mt-0 md:ml-6 flex flex-col space-y-3">
                        <button
                          onClick={() => handleViewDetails(order._id)}
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        {order.payment?.razorpayPaymentId && (
                          <a
                            href={`${BASE_URL}/api/orders/${order._id}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Invoice
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Order Details #{selectedOrder?._id?.slice(-8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Placed on {formatDate(selectedOrder?.createdAt)}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {selectedOrderLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : selectedOrder ? (
                <div className="space-y-8">
                  {/* Order Status */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">Order Status</h4>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedOrder.orderStatus)}`}>
                            {selectedOrder.orderStatus}
                          </span>
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getPaymentStatusColor(selectedOrder.status)}`}>
                            {selectedOrder.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Last updated: {formatDate(selectedOrder.updatedAt)}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-6">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'PROCESSING' || selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <div className="text-center">
                          <div className="font-medium">Processing</div>
                          <div className="text-xs">Order confirmed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Ready</div>
                          <div className="text-xs">Preparing to ship</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Shipped</div>
                          <div className="text-xs">On the way</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Delivered</div>
                          <div className="text-xs">Order received</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Order Items ({selectedOrder.items?.length || 0})</h4>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="divide-y divide-gray-200">
                        {selectedOrder.items?.map((item, index) => {
                          const productDetails = getProductDetails(item);
                          return (
                            <div key={index} className="p-4">
                              <div className="flex items-start space-x-4">
                                <img
                                  src={getItemImage(item)}
                                  alt={getItemName(item)}
                                  className="h-20 w-20 object-cover rounded-lg"
                                  onError={(e) => {
                                    e.target.src = 'https://via.placeholder.com/100x100?text=No+Image';
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex justify-between">
                                    <div>
                                      <h5 className="text-sm font-medium text-gray-900">
                                        {getItemName(item)}
                                      </h5>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                          {getItemType(item)}
                                        </span>
                                        {productDetails.isUserDesigned && (
                                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                            Your Custom Design
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-2">
                                        Type: {item.kind}
                                        {item.size && ` • Size: ${item.size}`}
                                        {item.signature && ` • Signature: ${item.signature}`}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-gray-900">
                                        ₹{(item.unitPrice * item.qty).toFixed(2)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {item.qty} × ₹{item.unitPrice?.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Product Details */}
                                  <div className="mt-3">
                                    {productDetails.category && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {productDetails.isUserDesigned ? (
                                          <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs font-medium text-purple-700">Custom Design Created by You</span>
                                          </div>
                                        ) : (
                                          <>
                                            {productDetails.category && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                                </svg>
                                                {productDetails.category}
                                              </span>
                                            )}
                                            {productDetails.subCategory && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                </svg>
                                                {productDetails.subCategory}
                                              </span>
                                            )}
                                            {productDetails.brand && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                                {productDetails.brand}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                    {productDetails.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
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

                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">₹{selectedOrder.subtotal?.toFixed(2) || calculateTotal(selectedOrder)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="text-gray-900">₹0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900">₹0.00</span>
                      </div>
                      <div className="border-t border-gray-300 pt-3">
                        <div className="flex justify-between">
                          <span className="text-lg font-medium text-gray-900">Total</span>
                          <span className="text-2xl font-bold text-gray-900">₹{selectedOrder.total?.toFixed(2) || calculateTotal(selectedOrder)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {selectedOrder.payment && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
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
                      </div>
                    </div>
                  )}
                </div>
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
                <div>
                  <p className="text-sm text-gray-500">
                    Need help with this order? <a href="/contact" className="text-indigo-600 hover:text-indigo-500">Contact Support</a>
                  </p>
                </div>
                <div className="flex space-x-3">
                  {selectedOrder?.payment?.razorpayPaymentId && (
                    <a
                      href={`${BASE_URL}/api/orders/${selectedOrder?._id}/invoice`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Download Invoice
                    </a>
                  )}
                  <button
                    onClick={closeModal}
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

export default UserOrders;