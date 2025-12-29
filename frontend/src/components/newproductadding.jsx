import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  X, 
  Upload, 
  Image as ImageIcon,
  Video as VideoIcon,
  DollarSign,
  Package,
  AlertCircle,
  Trash2,
  Plus,
  FolderPlus,
  Layers
} from 'lucide-react';

import { 
  createProduct,
  updateProduct,
  fetchFilters
} from '../redux/slices/productList.js';
import { addNotification } from '../redux/slices/adminSlice.js';

const ProductFormModal = ({ 
  isOpen, 
  onClose, 
  product = null,
  isEdit = false 
}) => {
  const dispatch = useDispatch();
  const { filters } = useSelector((state) => state.productList);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    currency: 'INR',
    category: '',
    subCategory: '',
    brand: '',
    stock: '0',
    isActive: true,
    bestSeller: false,
    newArrival: false,
  });
  
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  
  // New category/sub-category state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [subCategoriesForCategory, setSubCategoriesForCategory] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [customSubCategories, setCustomSubCategories] = useState({});

  // Load filters
  useEffect(() => {
    dispatch(fetchFilters());
  }, [dispatch]);

  // Update subcategories when category changes
  useEffect(() => {
    if (formData.category) {
      let allSubCategories = [];
      
      // Get existing subcategories from filters
      if (filters.subCategories && Array.isArray(filters.subCategories)) {
        // If subCategories are stored as strings in "category:subCategory" format
        const existingSubs = filters.subCategories
          .filter(sub => {
            if (typeof sub === 'string') {
              return sub.startsWith(`${formData.category}:`);
            }
            // If subCategories are objects
            return sub.category === formData.category;
          })
          .map(sub => {
            if (typeof sub === 'string') {
              return sub.split(':')[1] || sub;
            }
            return sub.name || sub.subCategory;
          });
        
        allSubCategories = [...allSubCategories, ...existingSubs];
      }
      
      // Get custom subcategories for this category
      if (customSubCategories[formData.category]) {
        allSubCategories = [...allSubCategories, ...customSubCategories[formData.category]];
      }
      
      // Remove duplicates
      const uniqueSubCategories = [...new Set(allSubCategories.filter(Boolean))];
      setSubCategoriesForCategory(uniqueSubCategories.sort());
    } else {
      setSubCategoriesForCategory([]);
    }
  }, [formData.category, filters.subCategories, customSubCategories]);

  // Populate form for editing
  useEffect(() => {
    if (isEdit && product) {
      setFormData({
        title: product.title || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        currency: product.currency || 'INR',
        category: product.category || '',
        subCategory: product.subCategory || '',
        brand: product.brand || '',
        stock: product.stock?.toString() || '0',
        isActive: product.isActive ?? true,
        bestSeller: product.bestSeller || false,
        newArrival: product.newArrival || false,
      });
      
      if (product.images && product.images.length > 0) {
        setImagePreviews(product.images);
      }
      
      if (product.video) {
        setVideoPreview(product.video);
      }
    } else {
      // Reset form for new product
      setFormData({
        title: '',
        description: '',
        price: '',
        currency: 'INR',
        category: '',
        subCategory: '',
        brand: '',
        stock: '0',
        isActive: true,
        bestSeller: false,
        newArrival: false,
      });
      setImages([]);
      setVideo(null);
      setImagePreviews([]);
      setVideoPreview(null);
      setErrors({});
      setNewCategoryName('');
      setNewSubCategoryName('');
      setShowNewCategory(false);
      setShowNewSubCategory(false);
    }
  }, [product, isEdit]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTextareaChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate number of images
    if (images.length + files.length > 4) {
      setErrors(prev => ({
        ...prev,
        images: 'Maximum 4 images allowed'
      }));
      return;
    }
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({
          ...prev,
          images: 'Only JPG, PNG, and WebP images are allowed'
        }));
        return false;
      }
      
      if (file.size > maxSize) {
        setErrors(prev => ({
          ...prev,
          images: 'Image size should be less than 5MB'
        }));
        return false;
      }
      
      return true;
    });
    
    setImages(prev => [...prev, ...validFiles]);
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
    
    if (errors.images) {
      setErrors(prev => ({ ...prev, images: null }));
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validate video
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        video: 'Only MP4, WebM, and OGG videos are allowed'
      }));
      return;
    }
    
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        video: 'Video size should be less than 50MB'
      }));
      return;
    }
    
    setVideo(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoPreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    if (errors.video) {
      setErrors(prev => ({ ...prev, video: null }));
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoPreview(null);
  };

  const handleAddNewCategory = (e) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      const categoryName = newCategoryName.trim();
      
      // Update form data with new category
      setFormData(prev => ({
        ...prev,
        category: categoryName,
        subCategory: '' // Reset subcategory when category changes
      }));
      
      // Add to custom categories list
      if (!customCategories.includes(categoryName) && 
          !filters.categories?.includes(categoryName)) {
        setCustomCategories(prev => [...prev, categoryName]);
      }
      
      // Initialize empty sub-categories array for this category
      if (!customSubCategories[categoryName]) {
        setCustomSubCategories(prev => ({
          ...prev,
          [categoryName]: []
        }));
      }
      
      setNewCategoryName('');
      setShowNewCategory(false);
      setNewSubCategoryName('');
      setShowNewSubCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `New category "${categoryName}" added successfully!`,
      }));
    }
  };

  const handleAddNewSubCategory = (e) => {
    e.preventDefault();
    if (newSubCategoryName.trim() && formData.category) {
      const subCategoryName = newSubCategoryName.trim();
      
      // Update form data with new sub-category
      setFormData(prev => ({
        ...prev,
        subCategory: subCategoryName
      }));
      
      // Add to custom sub-categories for this category
      setCustomSubCategories(prev => {
        const currentSubs = prev[formData.category] || [];
        if (!currentSubs.includes(subCategoryName)) {
          return {
            ...prev,
            [formData.category]: [...currentSubs, subCategoryName]
          };
        }
        return prev;
      });
      
      setNewSubCategoryName('');
      setShowNewSubCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `New sub-category "${subCategoryName}" added to "${formData.category}" successfully!`,
      }));
    }
  };

  // Handle Enter key press for adding new category/sub-category
  const handleKeyPress = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'category') {
        handleAddNewCategory(e);
      } else if (type === 'subcategory') {
        handleAddNewSubCategory(e);
      }
    }
  };

  // Get all available categories (existing + custom)
  const getAllCategories = () => {
    const existingCategories = filters.categories || [];
    const allCategories = [...new Set([...existingCategories, ...customCategories])];
    return allCategories.sort();
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.price || isNaN(formData.price) || Number(formData.price) <= 0) {
      newErrors.price = 'Valid price is required';
    }
    if (!formData.category) newErrors.category = 'Category is required';
    
    // Image validation for new products
    if (!isEdit && images.length === 0) {
      newErrors.images = 'At least one image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const data = new FormData();
      
      // Add form data
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });
      
      // Add images
      images.forEach(image => {
        data.append('images', image);
      });
      
      // Add video
      if (video) {
        data.append('video', video);
      }
      
      if (isEdit && product) {
        // Update existing product
        await dispatch(updateProduct({
          id: product._id,
          formData: data
        })).unwrap();
        
        dispatch(addNotification({
          type: 'success',
          message: 'Product updated successfully!',
        }));
      } else {
        // Create new product
        await dispatch(createProduct(data)).unwrap();
        
        dispatch(addNotification({
          type: 'success',
          message: 'Product created successfully!',
        }));
      }
      
      onClose();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: error || 'Failed to save product',
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pt-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter product title"
                disabled={loading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (₹) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={loading}
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.price}
                </p>
              )}
            </div>

            {/* Category Field with Add New Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <div className="space-y-2">
                {!showNewCategory ? (
                  <div className="flex space-x-2">
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.category ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select Category</option>
                      {getAllCategories().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategory(true)}
                      className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
                      title="Add new category"
                      disabled={loading}
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <FolderPlus className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">New Category</span>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'category')}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Enter new category name"
                        disabled={loading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        disabled={!newCategoryName.trim()}
                        className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.category}
                  </p>
                )}
              </div>
            </div>

            {/* Sub Category Field with Add New Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub Category
              </label>
              
              <div className="space-y-2">
                {console.log("Sub category value:", formData)}
                {!showNewSubCategory ? (
                  <div className="flex space-x-2">
                    <select
                      name="subCategory"
                      value={formData.subCategory}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading || !formData.category}
                    >
                      <option value="">Select Sub Category</option>
                      <option value="">None</option>
                      {subCategoriesForCategory.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewSubCategory(true)}
                      className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
                      title="Add new sub-category"
                      disabled={loading || !formData.category}
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        New Sub-Category for: <span className="font-bold">{formData.category}</span>
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newSubCategoryName}
                        onChange={(e) => setNewSubCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'subcategory')}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter new sub-category name"
                        disabled={loading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewSubCategory}
                        disabled={!newSubCategoryName.trim() || !formData.category}
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewSubCategory(false);
                          setNewSubCategoryName('');
                        }}
                        className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {!formData.category && !showNewSubCategory && (
                  <p className="text-xs text-gray-500">
                    Please select a category first
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter brand name"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Quantity
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleTextareaChange}
              rows="4"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter product description"
              disabled={loading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images {!isEdit && '*'}
              <span className="text-xs text-gray-500 ml-2">(Max 4 images, 5MB each)</span>
            </label>
            <div className={`border-2 border-dashed rounded-lg p-6 ${
              errors.images ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}>
              <div className="text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Images
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={loading || imagePreviews.length >= 4}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG, WebP up to 5MB
                  </p>
                </div>
              </div>
              
              {errors.images && (
                <p className="mt-2 text-sm text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.images}
                </p>
              )}
              
              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Uploaded Images ({imagePreviews.length}/4)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Video Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Video
              <span className="text-xs text-gray-500 ml-2">(Optional, max 50MB)</span>
            </label>
            <div className={`border-2 border-dashed rounded-lg p-6 ${
              errors.video ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}>
              {videoPreview ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Video Preview</h4>
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                  <video
                    src={videoPreview}
                    controls
                    className="w-full rounded-lg"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <VideoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label className="cursor-pointer">
                      <span className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium inline-flex items-center">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Video
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                        disabled={loading}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      MP4, WebM, OGG up to 50MB
                    </p>
                  </div>
                </div>
              )}
              
              {errors.video && (
                <p className="mt-2 text-sm text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.video}
                </p>
              )}
            </div>
          </div>

          {/* Status Flags */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Active Product
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="newArrival"
                name="newArrival"
                checked={formData.newArrival}
                onChange={handleInputChange}
                className="h-4 w-4 text-green-600 rounded focus:ring-green-500"
                disabled={loading}
              />
              <label htmlFor="newArrival" className="ml-2 text-sm text-gray-700">
                Mark as New Arrival
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="bestSeller"
                name="bestSeller"
                checked={formData.bestSeller}
                onChange={handleInputChange}
                className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                disabled={loading}
              />
              <label htmlFor="bestSeller" className="ml-2 text-sm text-gray-700">
                Mark as Best Seller
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEdit ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                <span>{isEdit ? 'Update Product' : 'Create Product'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;