// components/admin/AllProducts.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, ChevronLeft, ChevronRight, Search, Filter, Download, Package } from 'lucide-react';
import {
  fetchProducts,
  deleteProduct,
  toggleProductStatus,
  searchProducts,
  setCurrentCategory,
  setCurrentSubCategory
} from '../../redux/slices/productList.js';

const AllProducts = ({ 
  filters, 
  currentCategory, 
  currentSubCategory,
  setCurrentCategory: setGlobalCategory,
  setCurrentSubCategory: setGlobalSubCategory,
  onViewProduct,
  onEditProduct,
  onToggleStatus,
  onAddProduct,
  onDeleteProduct
}) => {
  const dispatch = useDispatch();
  const {
    products,
    loading,
    pagination
  } = useSelector((state) => state.productList);

  const [searchTerm, setSearchTerm] = useState('');
  const [localCategory, setLocalCategory] = useState(currentCategory);
  const [localSubCategory, setLocalSubCategory] = useState(currentSubCategory);

  useEffect(() => {
    loadProducts();
  }, [pagination.page, currentCategory, currentSubCategory, dispatch]);

  const loadProducts = () => {
    dispatch(fetchProducts({
      filter: '',
      category: currentCategory,
      subCategory: currentSubCategory,
      page: pagination.page,
      limit: pagination.limit,
    }));
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
      dispatch(fetchProducts({
        filter: '',
        category: currentCategory,
        subCategory: currentSubCategory,
        page: newPage,
        limit: pagination.limit,
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

  const handleDelete = async (product) => {
    if (window.confirm(`Are you sure you want to delete "${product.title}"?`)) {
      try {
        await dispatch(deleteProduct(product._id)).unwrap();
        loadProducts();
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const handleStatusToggle = async (productId) => {
    try {
      await dispatch(toggleProductStatus(productId)).unwrap();
      loadProducts();
    } catch (error) {
      console.error('Failed to toggle product status:', error);
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

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                value={localCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
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
            <button 
              onClick={onAddProduct}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Product</span>
            </button>
            <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium">
              <Download className="w-5 h-5" />
              <span>Export</span>
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
            No products found
          </h3>
          <p className="text-gray-600 mb-6">
            Add your first product to get started
          </p>
          <button 
            onClick={onAddProduct}
            className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Add Product</span>
          </button>
        </div>
      ) : (
        <>
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
                  const imageUrl = product.images && product.images.length > 0 
                    ? (product.images[0].startsWith('http') 
                        ? product.images[0] 
                        : `${import.meta.env.VITE_IMAGE_URL}/${product.images[0]}`)
                    : null;
                  
                  const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || product.stock || 0;
                  const minPrice = product.variants?.length 
                    ? Math.min(...product.variants.map(v => v.effectivePrice ?? v.price))
                    : product.effectivePrice || product.price || 0;
                  const maxPrice = product.variants?.length 
                    ? Math.max(...product.variants.map(v => v.effectivePrice ?? v.price))
                    : product.effectivePrice || product.price || 0;
                  const minMrp = product.variants?.length
                    ? Math.min(...product.variants.map(v => v.mrp ?? v.price))
                    : product.mrp || product.price || 0;
                  const maxMrp = product.variants?.length
                    ? Math.max(...product.variants.map(v => v.mrp ?? v.price))
                    : product.mrp || product.price || 0;

                  return (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={product.title}
                                className="h-10 w-10 rounded object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/40x40?text=No+Image';
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
                              {product.variants.map(v => v.size).join(', ')}
                            </div>
                            <div className="text-sm text-gray-600">
                              ₹{minPrice} - ₹{maxPrice}
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
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              totalStock > 10 
                                ? 'bg-green-100 text-green-800'
                                : totalStock > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {totalStock} units
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {product.variants.filter(v => v.stock > 0).length} sizes available
                            </div>
                          </div>
                        ) : (
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.stock > 10 
                              ? 'bg-green-100 text-green-800'
                              : product.stock > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.stock || 0} units
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => onViewProduct(product)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            View
                          </button>
                          <button
                            onClick={() => onEditProduct(product)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleStatusToggle(product._id)}
                            className={`${product.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                            title={product.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {product.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

export default AllProducts;
