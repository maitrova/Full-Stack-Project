import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { X, Check, Plus, Tag, DollarSign, Package, TrendingUp, BarChart3 } from 'lucide-react';
import { publishDesign, updateDesignDetails } from '../redux/slices/Designslice.js';
import { addNotification } from '../redux/slices/adminSlice.js';

const DesignPublishModal = ({ isOpen, onClose, design, isEdit = false }) => {
  const dispatch = useDispatch();
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    newCategory: '',
    newSubCategory: '',
    calculatedPrice: '',
    stock: '',
    description: '',
    newArrivals: false,
    bestSellers: false,
    isActive: true,
  });
  
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingSubCategory, setIsCreatingSubCategory] = useState(false);

  // Initialize form with design data
  useEffect(() => {
    if (design) {
      setFormData({
        category: design.category || '',
        subCategory: design.subCategory || '',
        newCategory: '',
        newSubCategory: '',
        calculatedPrice: design.calculatedPrice || '',
        stock: design.stock || '',
        description: design.description || '',
        newArrivals: design.newArrivals || false,
        bestSellers: design.bestSellers || false,
        isActive: design.isActive !== undefined ? design.isActive : true,
      });
    }
    
    // Load existing categories and subcategories
    // You would typically fetch these from your API
    setCategories(['T-Shirts', 'Hoodies', 'Mugs', 'Posters', 'Phone Cases']);
    if (design?.category) {
      setSubCategories(getSubCategoriesForCategory(design.category));
    }
  }, [design]);

  const getSubCategoriesForCategory = (category) => {
    const subCategoryMap = {
      'T-Shirts': ['Graphic Tees', 'Plain Tees', 'Oversized'],
      'Hoodies': ['Pullover', 'Zip-up', 'Graphic Hoodies'],
      'Mugs': ['Ceramic', 'Travel', 'Novelty'],
      'Posters': ['Art Prints', 'Photography', 'Inspirational'],
      'Phone Cases': ['Hard Case', 'Soft Case', 'Clear Case'],
    };
    return subCategoryMap[category] || [];
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setFormData(prev => ({
      ...prev,
      category,
      subCategory: '', // Reset subcategory when category changes
    }));
    
    if (category && category !== 'new') {
      setSubCategories(getSubCategoriesForCategory(category));
    } else if (category === 'new') {
      setIsCreatingCategory(true);
    }
  };

  const handleSubCategoryChange = (e) => {
    const subCategory = e.target.value;
    setFormData(prev => ({
      ...prev,
      subCategory,
    }));
    
    if (subCategory === 'new') {
      setIsCreatingSubCategory(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Prepare data
      const submitData = {
        ...formData,
        category: isCreatingCategory ? formData.newCategory : formData.category,
        subCategory: isCreatingSubCategory ? formData.newSubCategory : formData.subCategory,
        stock: parseInt(formData.stock) || 0,
        calculatedPrice: parseFloat(formData.calculatedPrice) || 0,
        isPublished: true,
      };
      
      // Remove temporary fields
      delete submitData.newCategory;
      delete submitData.newSubCategory;

      if (isEdit) {
        await dispatch(updateDesignDetails({
          id: design._id,
          designData: submitData,
        })).unwrap();
      } else {
        await dispatch(publishDesign({
          id: design._id,
          designData: submitData,
        })).unwrap();
      }

      dispatch(addNotification({
        type: 'success',
        message: isEdit ? 'Design updated successfully!' : 'Design published successfully!',
      }));
      
      onClose();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to process design',
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Design Details' : 'Publish Design'}
            </h3>
            <p className="text-gray-600 mt-1">
              {design?.title || 'Untitled Design'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Category Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                {isCreatingCategory ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      name="newCategory"
                      value={formData.newCategory}
                      onChange={handleInputChange}
                      placeholder="Enter new category"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleCategoryChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ Create New Category</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Category
                </label>
                {isCreatingSubCategory ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      name="newSubCategory"
                      value={formData.newSubCategory}
                      onChange={handleInputChange}
                      placeholder="Enter new sub-category"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubCategory(false)}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <select
                    name="subCategory"
                    value={formData.subCategory}
                    onChange={handleSubCategoryChange}
                    disabled={!formData.category}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Sub Category</option>
                    {subCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="new">+ Create New Sub Category</option>
                  </select>
                )}
                {!formData.category && (
                  <p className="text-xs text-gray-500 mt-1">
                    Select a category first
                  </p>
                )}
              </div>
            </div>

            {/* Price and Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  Price (₹)
                </label>
                <input
                  type="number"
                  name="calculatedPrice"
                  value={formData.calculatedPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="inline w-4 h-4 mr-1" />
                  Stock Quantity
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter product description..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Tag className="inline w-4 h-4 mr-1" />
                Tags
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="newArrivals"
                    name="newArrivals"
                    checked={formData.newArrivals}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="newArrivals" className="ml-2 flex items-center text-gray-700">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Mark as New Arrival
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="bestSellers"
                    name="bestSellers"
                    checked={formData.bestSellers}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="bestSellers" className="ml-2 flex items-center text-gray-700">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Mark as Best Seller
                  </label>
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-gray-700">
                  {formData.isActive ? 'Active (Visible to customers)' : 'Inactive (Hidden from customers)'}
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center"
            >
              <Check className="w-5 h-5 mr-2" />
              {isEdit ? 'Update Design' : 'Publish Design'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DesignPublishModal;