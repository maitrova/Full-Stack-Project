// client/src/components/admin/HomepageAdmin.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  // New Arrivals specific actions/selectors
  fetchEligibleNewArrivals,
  setHomepageNewArrivals,
  fetchHomepageNewArrivals,
  
  // Best Sellers specific actions/selectors
  fetchEligibleBestSellers,
  setHomepageBestSellers,
  fetchHomepageBestSellers,
  
  // Common actions
  toggleItemSelection,
  clearSelection,
  resetOperationStatus,
  
  // New Arrivals selectors
  selectNewArrivalsEligibleItems,
  selectNewArrivalsSelectedItemIds,
  selectNewArrivalsSelectedItemsFull,
  selectNewArrivalsEligibleLoading,
  selectNewArrivalsSelectedLoading,
  selectNewArrivalsSettingLoading,
  selectNewArrivalsEligibleError,
  selectNewArrivalsSelectedError,
  selectNewArrivalsSettingError,
  selectNewArrivalsCanSubmitSelection,
  
  // Best Sellers selectors
  selectBestSellersEligibleItems,
  selectBestSellersSelectedItemIds,
  selectBestSellersSelectedItemsFull,
  selectBestSellersEligibleLoading,
  selectBestSellersSelectedLoading,
  selectBestSellersSettingLoading,
  selectBestSellersEligibleError,
  selectBestSellersSelectedError,
  selectBestSellersSettingError,
  selectBestSellersCanSubmitSelection,
  
  // Common selectors
  selectOperationStatus,
} from '../../redux/slices/HomepageSlice.js';

const HomepageAdmin = () => {
  const dispatch = useDispatch();
  const [activeSection, setActiveSection] = useState('newArrivals'); // 'newArrivals' or 'bestSellers'
  const [activeTab, setActiveTab] = useState('selection');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Operation status
  const operationStatus = useSelector(selectOperationStatus);
  
  // Get appropriate selectors based on active section
  const getSectionData = () => {
    if (activeSection === 'newArrivals') {
      return {
        // Selectors
        eligibleItems: useSelector(selectNewArrivalsEligibleItems),
        selectedItemIds: useSelector(selectNewArrivalsSelectedItemIds),
        selectedItemsFull: useSelector(selectNewArrivalsSelectedItemsFull),
        eligibleLoading: useSelector(selectNewArrivalsEligibleLoading),
        selectedLoading: useSelector(selectNewArrivalsSelectedLoading),
        settingLoading: useSelector(selectNewArrivalsSettingLoading),
        eligibleError: useSelector(selectNewArrivalsEligibleError),
        selectedError: useSelector(selectNewArrivalsSelectedError),
        settingError: useSelector(selectNewArrivalsSettingError),
        canSubmit: useSelector(selectNewArrivalsCanSubmitSelection),
        
        // Actions
        fetchEligible: fetchEligibleNewArrivals,
        fetchSelected: fetchHomepageNewArrivals,
        setItems: setHomepageNewArrivals,
        sectionLabel: 'New Arrivals',
        sectionDescription: 'Manage featured new arrivals displayed on the homepage',
      };
    } else {
      return {
        // Selectors
        eligibleItems: useSelector(selectBestSellersEligibleItems),
        selectedItemIds: useSelector(selectBestSellersSelectedItemIds),
        selectedItemsFull: useSelector(selectBestSellersSelectedItemsFull),
        eligibleLoading: useSelector(selectBestSellersEligibleLoading),
        selectedLoading: useSelector(selectBestSellersSelectedLoading),
        settingLoading: useSelector(selectBestSellersSettingLoading),
        eligibleError: useSelector(selectBestSellersEligibleError),
        selectedError: useSelector(selectBestSellersSelectedError),
        settingError: useSelector(selectBestSellersSettingError),
        canSubmit: useSelector(selectBestSellersCanSubmitSelection),
        
        // Actions
        fetchEligible: fetchEligibleBestSellers,
        fetchSelected: fetchHomepageBestSellers,
        setItems: setHomepageBestSellers,
        sectionLabel: 'Best Sellers',
        sectionDescription: 'Manage featured best sellers displayed on the homepage',
      };
    }
  };
  
  const sectionData = getSectionData();

  useEffect(() => {
    // Load data for active section
    dispatch(sectionData.fetchEligible());
    dispatch(sectionData.fetchSelected());
  }, [dispatch, activeSection]);

  useEffect(() => {
    // Show success notification when operation completes
    if (operationStatus.success === true && operationStatus.type === activeSection) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        dispatch(resetOperationStatus());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [operationStatus.success, operationStatus.type, activeSection, dispatch]);

  const handleToggleItem = (itemType, itemId) => {
    dispatch(toggleItemSelection({ section: activeSection, itemType, itemId }));
  };

  const handleClearSelection = () => {
    dispatch(clearSelection({ section: activeSection }));
  };

  const handleSubmit = () => {
    if (sectionData.canSubmit) {
      dispatch(sectionData.setItems(sectionData.selectedItemIds));
    }
  };

  const isSelected = (itemType, itemId) => {
    return sectionData.selectedItemIds.some(
      item => item.itemType === itemType && item.itemId === itemId
    );
  };

  // Helper to get full item details from ID
  const getItemDetails = (itemType, itemId) => {
    return sectionData.eligibleItems.find(
      item => item.type === itemType && item._id === itemId
    ) || sectionData.selectedItemsFull.find(
      item => item.type === itemType && item._id === itemId
    );
  };

  // For preview tab, use selectedItemsFull directly
  const itemsToDisplay = activeTab === 'preview' ? sectionData.selectedItemsFull : 
    sectionData.selectedItemIds.map(item => getItemDetails(item.itemType, item.itemId)).filter(Boolean);

  const formatPrice = (price, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      design: 'bg-purple-100 text-purple-800',
      readymade: 'bg-blue-100 text-blue-800',
      product: 'bg-green-100 text-green-800',
      collection: 'bg-amber-100 text-amber-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const renderItemCard = (item, isPreview = false) => {
    if (!item) return null;

    return (
      <div
        key={`${item.type}-${item._id}`}
        onClick={!isPreview ? () => handleToggleItem(item.type, item._id) : undefined}
        className={`relative group ${!isPreview ? 'cursor-pointer' : ''} border rounded-xl overflow-hidden transition-all duration-200 ${
          !isPreview && isSelected(item.type, item._id)
            ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        {/* Selection Indicator (only in selection mode) */}
        {!isPreview && (
          <div className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center ${
            isSelected(item.type, item._id)
              ? 'bg-blue-500 text-white'
              : 'bg-white/80 backdrop-blur-sm border border-gray-300'
          }`}>
            {isSelected(item.type, item._id) ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            )}
          </div>
        )}

        {/* Image */}
        <div className="aspect-square bg-gray-100 overflow-hidden">
          {item.previewImage || item.imageUrl ? (
            <img
              src={item.previewImage || item.imageUrl}
              alt={item.title || item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/400x400?text=No+Image';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(item.type)}`}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </span>
            {item.price && (
              <span className="text-sm font-semibold text-gray-900">
                {formatPrice(item.price, item.currency)}
              </span>
            )}
          </div>
          
          <h3 className="font-medium text-gray-900 truncate mb-1">{item.title || item.name}</h3>
          
          {item.description && (
            <p className="text-xs text-gray-500 truncate mb-2">{item.description}</p>
          )}
          
          <div className="flex items-center text-xs text-gray-500 mt-2">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(item.createdAt || item.createdDate).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  };

  const renderSelectionTab = () => (
    <>
      {/* Stats and Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gray-50 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">Selected Items</p>
              <p className="text-2xl font-bold">
                {sectionData.selectedItemIds.length}
              </p>
            </div>
            
            <div className="bg-gray-50 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">Eligible Items</p>
              <p className="text-2xl font-bold">{sectionData.eligibleItems.length}</p>
            </div>
          </div>
          
          <div className="flex space-x-3 mt-4 md:mt-0">
            <button
              onClick={handleClearSelection}
              disabled={sectionData.selectedItemIds.length === 0}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sectionData.selectedItemIds.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Clear All
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={!sectionData.canSubmit || sectionData.settingLoading}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                !sectionData.canSubmit || sectionData.settingLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {sectionData.settingLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save Selection'}
            </button>
          </div>
        </div>
        
        {/* Validation Message */}
        {!sectionData.canSubmit && sectionData.selectedItemIds.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              {sectionData.selectedItemIds.length < 2 
                ? `Select ${2 - sectionData.selectedItemIds.length} more item${2 - sectionData.selectedItemIds.length === 1 ? '' : 's'} to save`
                : ''
              }
            </p>
          </div>
        )}
      </div>

      {/* Eligible Items Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Eligible {sectionData.sectionLabel}</h2>
            <p className="text-sm text-gray-600">Select at least 2 items to display on homepage</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Filter:</span>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
              All ({sectionData.eligibleItems.length})
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
              Designs ({sectionData.eligibleItems.filter(i => i.type === 'design').length})
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
              Readymade ({sectionData.eligibleItems.filter(i => i.type === 'readymade').length})
            </button>
          </div>
        </div>

        {sectionData.eligibleLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : sectionData.eligibleError ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Error loading items</div>
            <p className="text-gray-600 mb-4">{sectionData.eligibleError}</p>
            <button
              onClick={() => dispatch(sectionData.fetchEligible())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : sectionData.eligibleItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No eligible items found</div>
            <p className="text-gray-600">
              {activeSection === 'newArrivals' 
                ? 'Mark some designs or readymade products as "New Arrivals" first'
                : 'Mark some designs or readymade products as "Best Sellers" first'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sectionData.eligibleItems.map((item) => renderItemCard(item, false))}
          </div>
        )}
      </div>
    </>
  );

  const renderPreviewTab = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Current Homepage Selection</h2>
          <p className="text-sm text-gray-600">Preview of what users see on the homepage</p>
        </div>
        
        <button
          onClick={() => dispatch(sectionData.fetchSelected())}
          disabled={sectionData.selectedLoading}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          {sectionData.selectedLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {sectionData.selectedLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : sectionData.selectedError ? (
        <div className="text-center py-12">
          <div className="text-red-600 mb-2">Error loading current selection</div>
          <p className="text-gray-600 mb-4">{sectionData.selectedError}</p>
          <button
            onClick={() => dispatch(sectionData.fetchSelected())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      ) : itemsToDisplay.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">No items selected for homepage</div>
          <p className="text-gray-600 mb-4">Select items from the "Selection" tab to display them on the homepage</p>
          <button
            onClick={() => setActiveTab('selection')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Selection
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {itemsToDisplay.map((item, index) => (
              <div key={`${item.type}-${item._id}`} className="relative">
                {renderItemCard(item, true)}
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-sm text-gray-500">
            {itemsToDisplay.length} item{itemsToDisplay.length !== 1 ? 's' : ''} currently displayed on homepage
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="p-6">
      {/* Success Toast Notification */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {operationStatus.message || `${sectionData.sectionLabel} updated successfully!`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  dispatch(resetOperationStatus());
                }}
                className="ml-auto -mx-1.5 -my-1.5 bg-green-50 text-green-500 rounded-lg p-1.5 hover:bg-green-100"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {sectionData.settingError && operationStatus.type === activeSection && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-800">{sectionData.settingError}</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Homepage Management</h1>
        <p className="text-gray-600 mt-1">Manage featured content displayed on the homepage</p>
      </div>

      {/* Section Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSection('newArrivals')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'newArrivals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              New Arrivals
            </span>
          </button>
          <button
            onClick={() => setActiveSection('bestSellers')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'bestSellers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Best Sellers
            </span>
          </button>
        </nav>
      </div>

      {/* Content Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('selection')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'selection'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Selection ({sectionData.selectedItemIds.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview ({itemsToDisplay.length})
            </span>
          </button>
        </nav>
      </div>

      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{sectionData.sectionLabel}</h2>
        <p className="text-gray-600">{sectionData.sectionDescription}</p>
      </div>

      {/* Main Content */}
      {activeTab === 'selection' ? renderSelectionTab() : renderPreviewTab()}
    </div>
  );
};

export default HomepageAdmin;
