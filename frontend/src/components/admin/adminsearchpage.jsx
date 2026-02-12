import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  searchOrders, 
  clearSearchResults 
} from '../../redux/slices/adminSearchSlice.js';
import debounce from 'lodash/debounce';

const AdminOrderSearch = () => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  
  const { results, loading, error } = useSelector(
    (state) => state.adminSearch
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim().length >= 2) {
        dispatch(searchOrders(query));
        setIsOpen(true);
      } else if (query.trim().length === 0) {
        dispatch(clearSearchResults());
        setIsOpen(false);
      }
    }, 500),
    [dispatch]
  );

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    dispatch(clearSearchResults());
    setIsOpen(false);
    debouncedSearch.cancel();
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Format date helper
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get order type badge
  const getOrderTypeBadge = (item) => {
    if (item.kind === 'READYMADE') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
          Readymade
        </span>
      );
    } else if (item.kind === 'DESIGN') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
          Custom Design
        </span>
      );
    } else if (item.kind === 'DROPPRODUCT') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          Drop Product
        </span>
      );
    }
    return null;
  };

  // Get product name from item
  const getProductName = (item) => {
    if (item.kind === 'READYMADE' && item.readymadeProduct) {
      return item.readymadeProduct.title || 'Readymade Product';
    } else if (item.kind === 'DESIGN' && item.design) {
      return item.design.productName || 'Custom Design';
    } else if (item.kind === 'DROPPRODUCT' && item.dropproduct) {
      return item.dropproduct.name || 'Drop Product';
    }
    return 'Product';
  };

  return (
    <div className="w-full max-w-4xl mx-auto" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Search orders by Order ID, Customer name, Email, or Product..."
            className="w-full px-4 py-3 pl-12 pr-10 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Clear Button */}
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <svg
                className="w-5 h-5 text-gray-400 hover:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute right-12 top-3">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Search Results Dropdown */}
        {isOpen && results?.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {results.map((order) => (
              <div
                key={order._id}
                className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">
                        #{order._id.slice(-8)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'PAID' 
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'PENDING_PAYMENT'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.orderStatus === 'PROCESSING'
                          ? 'bg-blue-100 text-blue-800'
                          : order.orderStatus === 'SHIPPED'
                          ? 'bg-purple-100 text-purple-800'
                          : order.orderStatus === 'DELIVERED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.orderStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Order Date: {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ₹{order.total}
                    </p>
                    <p className="text-xs text-gray-500">{order.currency}</p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">
                      {order.user?.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.user?.email}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                        {item.previewImage ? (
                          <img
                            src={item.previewImage}
                            alt={getProductName(item)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {getProductName(item)}
                              </p>
                              {getOrderTypeBadge(item)}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>Size: {item.size || 'N/A'}</span>
                              <span>Qty: {item.qty}</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            ₹{item.unitPrice}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Address */}
                <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
                  <div className="flex items-start gap-1">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>
                      {order.deliveryAddress?.fullName}, {order.deliveryAddress?.completeAddress}, 
                      {order.deliveryAddress?.landmark && ` ${order.deliveryAddress.landmark},`}
                      {' '}{order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{order.deliveryAddress?.mobileNumber}</span>
                  </div>
                </div>

                {/* View Order Button */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      // Navigate to order details page
                      window.location.href = `/admin/orders/${order._id}`;
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    View Order Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {isOpen && searchTerm.length >= 2 && !loading && results?.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-gray-600 font-medium">No orders found</p>
            <p className="text-sm text-gray-500 mt-1">
              Try searching with different keywords
            </p>
          </div>
        )}

        {/* Initial State */}
        {!isOpen && !loading && searchTerm.length === 0 && (
          <div className="mt-2 p-4 text-center text-gray-500 text-sm">
            Type at least 2 characters to search orders...
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrderSearch;