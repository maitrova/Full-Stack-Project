import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProductById, clearProduct } from '../redux/slices/productsearchDetailsSlice.js';

const ProductSearch = () => {
  const [productId, setProductId] = useState('');
  const dispatch = useDispatch();
  
  // Get product data from Redux store
  const { product, productType, loading, error } = useSelector(
    (state) => state.productDetails
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (productId.trim()) {
      dispatch(fetchProductById(productId.trim()));
    }
  };

  const handleClear = () => {
    setProductId('');
    dispatch(clearProduct());
  };

  // Function to get full image URL
  const getImageUrl = (path) => {
    if (!path) return '';
    
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Combine base URL with image path
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`;
  };

  // Function to handle image error
  const handleImageError = (e) => {
    e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
    e.target.onerror = null; // Prevent infinite loop
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)] p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-normal text-mt-text mb-2">
            Product Search
          </h1>
          <p className="text-mt-muted">
            Search for products by their unique ID
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-mt-surface rounded-xl shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="productId" className="block text-sm font-medium text-mt-muted mb-2">
                Product ID
              </label>
              <input
                type="text"
                id="productId"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Enter product ID (e.g., 697bdebc95c50849f5d7da1f)"
                className="w-full px-4 py-3 border border-mt-line-strong rounded-lg focus:ring-2 focus:ring-mt-text focus:border-mt-text transition-colors"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading || !productId.trim()}
                className="px-6 py-3 bg-mt-btn text-mt-btn-text font-medium rounded-lg hover:bg-mt-btn-hover focus:outline-none focus:ring-2 focus:ring-mt-text focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching...
                  </span>
                ) : 'Search Product'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-3 bg-mt-line text-mt-muted font-medium rounded-lg hover:bg-mt-tint/20 focus:outline-none focus:ring-2 focus:ring-mt-text focus:ring-offset-2 transition-colors"
              >
                Clear
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-mt-danger/10 border border-mt-danger/30 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-mt-danger mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-mt-danger font-medium">Error: {error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Product Details */}
        {product && (
          <div className="bg-mt-surface rounded-xl shadow-md overflow-hidden">
            {/* Product Header */}
            <div className="border-b border-mt-line p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      productType === 'drop' 
                        ? 'bg-mt-tint/10 text-mt-text'
                        : 'bg-mt-success/10 text-mt-success'
                    }`}>
                      {productType?.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      product.isActive
                        ? 'bg-mt-success/10 text-mt-success'
                        : 'bg-mt-danger/10 text-mt-danger'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {productType === 'readymade' && product.bestSeller && (
                      <span className="px-3 py-1 bg-amber-400/10 text-mt-warning rounded-full text-sm font-medium">
                        Best Seller
                      </span>
                    )}
                    {productType === 'readymade' && product.newArrival && (
                      <span className="px-3 py-1 bg-mt-tint/10 text-mt-text rounded-full text-sm font-medium">
                        New Arrival
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-normal text-mt-text">
                    {product.name || product.title}
                  </h2>
                  <p className="text-mt-muted mt-2">{product.description}</p>
                </div>
                <div className="mt-4 md:mt-0">
                  <p className="text-3xl font-bold text-mt-text">
                    ₹{productType === 'drop' ? product.minPrice : product.price}
                    {productType === 'readymade' && product.variants?.length > 1 && (
                      <span className="text-lg text-mt-subtle"> - ₹{Math.max(...product.variants.map(v => v.price))}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Product Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Images */}
                <div>
                  {/* Debug: Show image URLs */}
                  {/* {import.meta.env.DEV && (
                    <div className="mb-4 p-3 bg-mt-surface-raised rounded-lg">
                      <p className="text-xs text-mt-muted font-mono">
                        <strong>API Base URL:</strong> {import.meta.env.VITE_API_URL}
                      </p>
                      <p className="text-xs text-mt-muted font-mono">
                        <strong>Thumbnail Path:</strong> {product.thumbnail}
                      </p>
                      <p className="text-xs text-mt-muted font-mono">
                        <strong>Full Thumbnail URL:</strong> {getImageUrl(product.thumbnail)}
                      </p>
                    </div>
                  )} */}

                  {/* Main Image */}
                  {product.thumbnail && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-mt-muted mb-4">Main Image</h3>
                      <div className="bg-mt-photo rounded-lg overflow-hidden h-96 flex items-center justify-center">
                        <img
                          src={getImageUrl(product.thumbnail)}
                          alt={product.name || product.title}
                          className="w-full h-full object-contain"
                          onError={handleImageError}
                        />
                      </div>
                    </div>
                  )}

                  {/* Additional Images */}
                  {product.images && product.images.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-mt-muted mb-4">
                        Gallery Images ({product.images.length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {product.images.map((img, index) => (
                          <div key={index} className="bg-mt-photo rounded-lg overflow-hidden h-40 flex items-center justify-center">
                            <img
                              src={getImageUrl(img)}
                              alt={`${product.name || product.title} ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={handleImageError}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video */}
                  {product.video && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-mt-muted mb-4">Product Video</h3>
                      <div className="bg-mt-surface-raised rounded-lg overflow-hidden">
                        <video
                          src={getImageUrl(product.video)}
                          controls
                          className="w-full"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Details */}
                <div>
                  {/* Product Info */}
                  <div className="space-y-6">
                    {/* Stock Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-mt-muted mb-3">Stock Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-mt-bg p-4 rounded-lg">
                          <p className="text-sm text-mt-subtle">Total Stock</p>
                          <p className="text-2xl font-bold text-mt-text">
                            {product.totalStock || product.stock || 0}
                          </p>
                        </div>
                        <div className="bg-mt-bg p-4 rounded-lg">
                          <p className="text-sm text-mt-subtle">Variants</p>
                          <p className="text-2xl font-bold text-mt-text">
                            {product.variants?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Variants Table */}
                    {product.variants && product.variants.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-mt-muted mb-3">Variants</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-mt-line">
                            <thead>
                              <tr className="bg-mt-bg">
                                <th className="px-4 py-3 text-left text-xs font-medium text-mt-subtle uppercase tracking-wider">
                                  Size
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-mt-subtle uppercase tracking-wider">
                                  Price (₹)
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-mt-subtle uppercase tracking-wider">
                                  Stock
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-mt-subtle uppercase tracking-wider">
                                  SKU
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-mt-surface divide-y divide-mt-line">
                              {product.variants.map((variant, index) => (
                                <tr key={index} className="hover:bg-mt-tint/5">
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="px-3 py-1 bg-mt-tint/10 text-mt-text rounded-full text-sm font-medium">
                                      {variant.size}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-mt-text font-medium">
                                    ₹{variant.price}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                      variant.stock > 10
                                        ? 'bg-mt-success/10 text-mt-success'
                                        : variant.stock > 0
                                        ? 'bg-amber-400/10 text-mt-warning'
                                        : 'bg-mt-danger/10 text-mt-danger'
                                    }`}>
                                      {variant.stock} units
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {variant.sku ? (
                                      <span className="font-mono text-sm bg-mt-surface-raised px-2 py-1 rounded">
                                        {variant.sku}
                                      </span>
                                    ) : (
                                      <span className="text-mt-subtle italic">Not set</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Additional Details */}
                    <div>
                      <h3 className="text-lg font-semibold text-mt-muted mb-3">Product Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-mt-line">
                          <span className="text-mt-muted">Product Type</span>
                          <span className="font-medium text-mt-text capitalize">
                            {productType}
                          </span>
                        </div>
                        
                        {product.category && (
                          <div className="flex justify-between items-center py-2 border-b border-mt-line">
                            <span className="text-mt-muted">Category</span>
                            <span className="font-medium text-mt-text">
                              {typeof product.category === 'string' ? product.category : 'Category ID'}
                            </span>
                          </div>
                        )}
                        
                        {product.subCategory && (
                          <div className="flex justify-between items-center py-2 border-b border-mt-line">
                            <span className="text-mt-muted">Sub Category</span>
                            <span className="font-medium text-mt-text">
                              {typeof product.subCategory === 'string' ? product.subCategory : 'Sub-category ID'}
                            </span>
                          </div>
                        )}
                        
                        {product.brand && (
                          <div className="flex justify-between items-center py-2 border-b border-mt-line">
                            <span className="text-mt-muted">Brand</span>
                            <span className="font-medium text-mt-text">{product.brand}</span>
                          </div>
                        )}
                        
                        {product.currency && (
                          <div className="flex justify-between items-center py-2 border-b border-mt-line">
                            <span className="text-mt-muted">Currency</span>
                            <span className="font-medium text-mt-text">{product.currency}</span>
                          </div>
                        )}
                        
                        {productType === 'drop' && product.minPrice === product.maxPrice ? (
                          <div className="flex justify-between items-center py-2 border-b border-mt-line">
                            <span className="text-mt-muted">Price</span>
                            <span className="font-medium text-mt-text">₹{product.minPrice}</span>
                          </div>
                        ) : (
                          <>
                            {productType === 'drop' && (
                              <>
                                <div className="flex justify-between items-center py-2 border-b border-mt-line">
                                  <span className="text-mt-muted">Min Price</span>
                                  <span className="font-medium text-mt-text">₹{product.minPrice}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-mt-line">
                                  <span className="text-mt-muted">Max Price</span>
                                  <span className="font-medium text-mt-text">₹{product.maxPrice}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="pt-4 border-t border-mt-line">
                      <h4 className="text-lg font-semibold text-mt-muted mb-3">Timestamps</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-mt-bg p-4 rounded-lg">
                          <p className="text-sm text-mt-subtle">Created At</p>
                          <p className="font-medium text-mt-text">
                            {formatDate(product.createdAt)}
                          </p>
                        </div>
                        <div className="bg-mt-bg p-4 rounded-lg">
                          <p className="text-sm text-mt-subtle">Updated At</p>
                          <p className="font-medium text-mt-text">
                            {formatDate(product.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-mt-line p-6 bg-mt-bg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="text-sm text-mt-muted">
                    Product ID: <span className="font-mono text-mt-text">{product._id}</span>
                  </p>
                  <p className="text-sm text-mt-muted mt-1">
                    API Version: <span className="font-mono text-mt-text">v{product.__v}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(product._id)}
                    className="px-4 py-2 text-sm font-medium text-mt-muted bg-mt-surface border border-mt-line-strong rounded-lg hover:bg-mt-tint/5 transition-colors"
                  >
                    Copy ID
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 text-sm font-medium text-mt-muted hover:text-mt-text"
                  >
                    Clear Results
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!product && !loading && !error && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 text-mt-line-strong mb-4">
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-mt-text mb-2">Search for a product</h3>
            <p className="text-mt-subtle max-w-md mx-auto">
              Enter a product ID in the search field above to view detailed information about the product.
            </p>
            <div className="mt-4 text-sm text-mt-subtle">
              <p>Example IDs:</p>
              <p className="font-mono text-xs mt-1">697bdebc95c50849f5d7da1f (Drop product)</p>
              <p className="font-mono text-xs">6989efdc8f2374c19b0b3fd0 (Readymade product)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSearch;