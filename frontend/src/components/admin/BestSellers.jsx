// components/admin/BestSellers.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Edit2, X, Check, Plus, ChevronLeft, ChevronRight, Search, Package } from 'lucide-react';
import {
  getBestSellerProducts,
  updateProductList,
  removeProductFromList,
  fetchAllProducts,
  toggleProductSelection,
  selectAllProducts,
  deselectAllProducts,
  setCurrentCategory,
  setCurrentSubCategory,
  
} from '../../redux/slices/productList.js';
// import ProductCard from './ProductCard.jsx';
import {setIsEditing} from '../../redux/slices/adminSlice.js';
const BestSellers = ({ 
  filters, 
  currentCategory, 
  currentSubCategory,
  setCurrentCategory: setGlobalCategory,
  setCurrentSubCategory: setGlobalSubCategory,
  onViewProduct,
  onEditProduct,
  onToggleStatus,
  onAddProduct
}) => {
  const dispatch = useDispatch();
  const {
    products,
    availableProducts,
    selectedProductIds,
    loading,
    pagination
  } = useSelector((state) => state.productList);
  const { isEditing } = useSelector((state) => state.admin);

  const [searchTerm, setSearchTerm] = useState('');
  const [localCategory, setLocalCategory] = useState(currentCategory);
  const [localSubCategory, setLocalSubCategory] = useState(currentSubCategory);

  useEffect(() => {
    loadBestSellers();
  }, [pagination.page, currentCategory, currentSubCategory, dispatch]);

  const loadBestSellers = () => {
    dispatch(getBestSellerProducts({
      page: pagination.page,
      limit: pagination.limit,
    }));
  };

  const handleEditClick = () => {
    dispatch(setIsEditing(true));
    dispatch(setCurrentCategory(''));
    dispatch(setCurrentSubCategory(''));
    dispatch(deselectAllProducts());
    setLocalCategory('');
    setLocalSubCategory('');
    
    dispatch(fetchAllProducts({
      category: '',
      subCategory: '',
      limit: 100,
    }));
  };

  const handleSave = async () => {
    if (selectedProductIds.length === 0) {
      return;
    }

    try {
      await dispatch(updateProductList({
        productIds: selectedProductIds,
        action: 'setBestSeller',
        value: true,
      })).unwrap();
      
      dispatch(setIsEditing(false));
      loadBestSellers();
    } catch (error) {
      console.error('Failed to update best sellers:', error);
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      await dispatch(removeProductFromList({
        productId,
        action: 'removeBestSeller',
      })).unwrap();
      loadBestSellers();
    } catch (error) {
      console.error('Failed to remove product:', error);
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

  const handleCategoryChange = (category) => {
    setLocalCategory(category);
    setGlobalCategory(category);
    setLocalSubCategory('');
    setGlobalSubCategory('');
  };

  const handleSubCategoryChange = (subCategory) => {
    setLocalSubCategory(subCategory);
    setGlobalSubCategory(subCategory);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      dispatch(getBestSellerProducts({
        page: newPage,
        limit: pagination.limit,
      }));
    }
  };

  const getFilteredSubCategories = () => {
    if (!localCategory || !Array.isArray(filters.subCategories)) {
      return [];
    }
    
    return filters.subCategories
      .filter(sub => typeof sub === 'string' && sub.includes(localCategory))
      .map(sub => {
        if (typeof sub === 'string' && sub.includes(':')) {
          return sub.split(':')[1];
        }
        return sub;
      })
      .filter(sub => sub && sub.trim() !== '');
  };

  const ProductGridCard = ({ product }) => (
    <div
      onClick={() => handleProductSelect(product._id)}
      className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
        selectedProductIds.includes(product._id)
          ? 'border-blue-500 ring-2 ring-blue-100'
          : 'border-gray-200'
      }`}
    >
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

      <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0].startsWith('http') ? product.images[0] : `${import.meta.env.VITE_IMAGE_URL}/${product.images[0]}`}
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

      <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
        {product.title}
      </h4>
      
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-gray-600">
            {product.variants?.map(v => v.size).join(', ') || 'Single variant'}
          </p>
          <p className="text-lg font-bold text-blue-600">
            ₹{product.variants?.length ? Math.min(...product.variants.map(v => v.price)) : product.price}+
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Total stock: {product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || product.stock || 0} units
        </p>
      </div>
      
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 truncate">
          {product.category} › {product.subCategory}
        </p>
        <span className={`px-2 py-1 text-xs rounded-full ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {product.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add to Best Sellers</h2>
            <p className="text-gray-600">Select products from your catalog</p>
          </div>
          <button
            onClick={() => dispatch(setIsEditing(false))}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

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
              {filters.categories?.map(cat => (
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
              <p className="text-xs text-gray-500 mt-1">Please select a category first</p>
            )}
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-500">
              {availableProducts.length} products found
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Select Products</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {selectedProductIds.length} selected
            </span>
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
            >
              {selectedProductIds.length === availableProducts.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-h-[500px] overflow-y-auto p-2">
              {availableProducts.map(product => (
                <ProductGridCard key={product._id} product={product} />
              ))}
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                onClick={() => dispatch(setIsEditing(false))}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedProductIds.length === 0}
                className={`px-6 py-3 rounded-lg font-medium ${
                  selectedProductIds.length === 0
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Set as Best Sellers
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
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search best sellers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleEditClick}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              <Edit2 className="w-5 h-5" />
              <span>Edit List</span>
            </button>
            <button 
              onClick={onAddProduct}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <Package className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No best sellers found
          </h3>
          <p className="text-gray-600 mb-6">
            Click "Edit List" to add products to Best Sellers
          </p>
          <button
            onClick={handleEditClick}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            <Edit2 className="w-5 h-5" />
            <span>Edit List</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {products.map(product => (
              <div key={product._id} className="bg-white border rounded-xl p-4">
                <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0].startsWith('http') ? product.images[0] : `${import.meta.env.VITE_IMAGE_URL}/${product.images[0]}`}
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

                <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
                  {product.title}
                </h4>
                
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600">
                      {product.variants?.map(v => v.size).join(', ') || 'Single variant'}
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      ₹{product.variants?.length ? Math.min(...product.variants.map(v => v.price)) : product.price}+
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Total stock: {product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || product.stock || 0} units
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 truncate">
                    {product.category} › {product.subCategory}
                  </p>
                  <span className={`px-2 py-1 text-xs rounded-full ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => onViewProduct(product)}
                    className="flex-1 text-blue-600 hover:text-blue-900"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEditProduct(product)}
                    className="flex-1 text-green-600 hover:text-green-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onToggleStatus(product._id)}
                    className={`flex-1 ${product.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                  >
                    {product.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleRemoveProduct(product._id)}
                    className="flex-1 text-red-600 hover:text-red-900"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

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
  );
};

export default BestSellers;