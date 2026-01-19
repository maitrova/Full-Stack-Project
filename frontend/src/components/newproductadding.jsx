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
  Layers,
  Hash,
  Grid,
  Minus,
  ChevronRight,
  ChevronLeft
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
  
  // Step state for sequential flow
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { id: 1, name: 'Category', description: 'Select product category' },
    { id: 2, name: 'Sub-category', description: 'Select sub-category' },
    { id: 3, name: 'Details', description: 'Add product details' },
  ];
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    currency: 'INR',
    category: '',
    subCategory: '',
    brand: '',
    isActive: true,
    bestSeller: false,
    newArrival: false,
  });
  
  // Variants state
  const [variants, setVariants] = useState([
    { size: '', price: '', stock: '', sku: '' }
  ]);
  
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

  // Size options
  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Base URL for image paths
  const baseUrl = import.meta.env.VITE_IMAGE_URL;

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
        const existingSubs = filters.subCategories
          .filter(sub => {
            if (typeof sub === 'string') {
              return sub.startsWith(`${formData.category}:`);
            }
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
        currency: product.currency || 'INR',
        category: product.category || '',
        subCategory: product.subCategory || '',
        brand: product.brand || '',
        isActive: product.isActive ?? true,
        bestSeller: product.bestSeller || false,
        newArrival: product.newArrival || false,
      });
      
      // Populate variants if they exist
      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants.map(v => ({
          size: v.size || '',
          price: v.price?.toString() || '',
          stock: v.stock?.toString() || '',
          sku: v.sku || ''
        })));
      } else {
        // Fallback to old structure if variants don't exist
        setVariants([
          {
            size: '',
            price: product.price?.toString() || '',
            stock: product.stock?.toString() || '',
            sku: ''
          }
        ]);
      }
      
      // Set image previews with full URLs in edit mode
      if (product.images && product.images.length > 0) {
        const previews = product.images.map(image => {
          // Check if image already has a full URL
          if (image.startsWith('http')) {
            return image;
          }
          // Add base URL if it's a relative path
          return `${baseUrl}${image.startsWith('/') ? image : '/' + image}`;
        });
        setImagePreviews(previews);
      }
      
      if (product.video) {
        // Add base URL for video if it's a relative path
        const videoUrl = product.video.startsWith('http') 
          ? product.video 
          : `${baseUrl}${product.video.startsWith('/') ? product.video : '/' + product.video}`;
        setVideoPreview(videoUrl);
      }
      
      // If editing, start at step 3 (details)
      setCurrentStep(3);
    } else {
      // Reset form for new product
      setFormData({
        title: '',
        description: '',
        currency: 'INR',
        category: '',
        subCategory: '',
        brand: '',
        isActive: true,
        bestSeller: false,
        newArrival: false,
      });
      setVariants([{ size: '', price: '', stock: '', sku: '' }]);
      setImages([]);
      setVideo(null);
      setImagePreviews([]);
      setVideoPreview(null);
      setErrors({});
      setNewCategoryName('');
      setNewSubCategoryName('');
      setShowNewCategory(false);
      setShowNewSubCategory(false);
      setCurrentStep(1); // Start from step 1 for new product
    }
  }, [product, isEdit]);

  // Step navigation handlers
  const goToNextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!formData.category) {
        setErrors({ category: 'Please select a category' });
        return;
      }
    } else if (currentStep === 2) {
      // Sub-category is optional, but we should validate if needed
    }
    
    setCurrentStep(prev => Math.min(prev + 1, steps.length));
    setErrors({}); // Clear errors when moving to next step
  };

  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
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

  // Handle variant changes
  const handleVariantChange = (index, field, value) => {
    const updatedVariants = [...variants];
    updatedVariants[index][field] = value;
    setVariants(updatedVariants);
    
    // Clear variant errors
    if (errors.variants) {
      setErrors(prev => ({ ...prev, variants: null }));
    }
  };

  const addVariant = () => {
    if (variants.length < 6) {
      setVariants([...variants, { size: '', price: '', stock: '', sku: '' }]);
    }
  };

  const removeVariant = (index) => {
    if (variants.length > 1) {
      const updatedVariants = [...variants];
      updatedVariants.splice(index, 1);
      setVariants(updatedVariants);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > 4) {
      setErrors(prev => ({
        ...prev,
        images: 'Maximum 4 images allowed'
      }));
      return;
    }
    
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const maxSize = 5 * 1024 * 1024;
      
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
    
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const maxSize = 50 * 1024 * 1024;
    
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
      
      setFormData(prev => ({
        ...prev,
        category: categoryName,
        subCategory: ''
      }));
      
      if (!customCategories.includes(categoryName) && 
          !filters.categories?.includes(categoryName)) {
        setCustomCategories(prev => [...prev, categoryName]);
      }
      
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
      
      // Auto-proceed to next step after adding category
      setTimeout(() => goToNextStep(), 500);
    }
  };

  const handleAddNewSubCategory = (e) => {
    e.preventDefault();
    if (newSubCategoryName.trim() && formData.category) {
      const subCategoryName = newSubCategoryName.trim();
      
      setFormData(prev => ({
        ...prev,
        subCategory: subCategoryName
      }));
      
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
      
      // Auto-proceed to next step after adding sub-category
      setTimeout(() => goToNextStep(), 500);
    }
  };

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

  const getAllCategories = () => {
    const existingCategories = filters.categories || [];
    const allCategories = [...new Set([...existingCategories, ...customCategories])];
    return allCategories.sort();
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.category) newErrors.category = 'Category is required';
    
    // Validate variants
    const variantErrors = [];
    const usedSizes = new Set();
    
    variants.forEach((variant, index) => {
      if (!variant.size) {
        variantErrors.push(`Size is required for variant ${index + 1}`);
      } else if (!sizeOptions.includes(variant.size)) {
        variantErrors.push(`Invalid size "${variant.size}" for variant ${index + 1}`);
      } else if (usedSizes.has(variant.size)) {
        variantErrors.push(`Duplicate size "${variant.size}" found`);
      } else {
        usedSizes.add(variant.size);
      }
      
      if (!variant.price || isNaN(variant.price) || Number(variant.price) <= 0) {
        variantErrors.push(`Valid price is required for size ${variant.size || index + 1}`);
      }
      
      if (variant.stock === '' || isNaN(variant.stock) || Number(variant.stock) < 0) {
        variantErrors.push(`Valid stock is required for size ${variant.size || index + 1}`);
      }
    });
    
    if (variantErrors.length > 0) {
      newErrors.variants = variantErrors;
    }
    
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
      
      // Add variants as JSON string
      const normalizedVariants = variants.map(v => ({
        size: v.size,
        price: Number(v.price),
        stock: Number(v.stock || 0),
        sku: v.sku || ''
      }));
      
      data.append('variants', JSON.stringify(normalizedVariants));
      
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

  // Render step indicator
  const renderStepIndicator = () => (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} flex-1`}>
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep > step.id 
                  ? 'bg-green-600' 
                  : currentStep === step.id 
                  ? 'bg-blue-600 border-2 border-blue-600' 
                  : 'bg-gray-200'
              }`}>
                <span className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-white' : 'text-gray-500'
                }`}>
                  {step.id}
                </span>
              </div>
              <div className="ml-4 min-w-0 flex flex-col">
                <span className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                <span className="text-sm text-gray-500 hidden sm:block">
                  {step.description}
                </span>
              </div>
            </div>
            {stepIdx !== steps.length - 1 && (
              <div className="absolute top-5 right-0 hidden w-full sm:block">
                <div className={`h-0.5 w-full ${
                  currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <FolderPlus className="mx-auto h-16 w-16 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900">Select Product Category</h3>
              <p className="text-gray-600 mt-2">Choose a category for your product or create a new one</p>
            </div>
            
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                {!showNewCategory ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Category *
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.category ? 'border-red-500' : 'border-gray-300'
                        }`}
                        disabled={loading}
                      >
                        <option value="">Choose a category</option>
                        {getAllCategories().map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {errors.category && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.category}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center"
                        disabled={loading}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Category
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 justify-center">
                      <FolderPlus className="w-6 h-6 text-green-600" />
                      <span className="text-lg font-medium text-green-700">New Category</span>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'category')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Enter new category name"
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        disabled={!newCategoryName.trim()}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Create & Continue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Layers className="mx-auto h-16 w-16 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900">Select Sub-category</h3>
              <p className="text-gray-600 mt-2">
                Choose a sub-category for your product under{' '}
                <span className="font-semibold text-blue-600">{formData.category}</span>
              </p>
            </div>
            
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                {!showNewSubCategory ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Sub-category (Optional)
                      </label>
                      <select
                        name="subCategory"
                        value={formData.subCategory}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading || !formData.category}
                      >
                        <option value="">Select sub-category (optional)</option>
                        <option value="">No sub-category</option>
                        {subCategoriesForCategory.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      {!formData.category && (
                        <p className="mt-1 text-xs text-gray-500">
                          Please select a category first
                        </p>
                      )}
                    </div>
                    
                    <div className="flex justify-center pt-4 space-x-4">
                      <button
                        type="button"
                        onClick={() => setShowNewSubCategory(true)}
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center"
                        disabled={loading || !formData.category}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Sub-category
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 justify-center">
                      <Layers className="w-6 h-6 text-blue-600" />
                      <span className="text-lg font-medium text-blue-700">
                        New Sub-category for: <span className="font-bold">{formData.category}</span>
                      </span>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newSubCategoryName}
                        onChange={(e) => setNewSubCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'subcategory')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter new sub-category name"
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={handleAddNewSubCategory}
                        disabled={!newSubCategoryName.trim() || !formData.category}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Create & Continue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewSubCategory(false);
                          setNewSubCategoryName('');
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Category Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Product Category</h4>
                  <div className="mt-1 flex items-center">
                    <span className="text-lg font-semibold text-blue-700">{formData.category}</span>
                    {formData.subCategory && (
                      <>
                        <ChevronRight className="w-4 h-4 text-blue-500 mx-2" />
                        <span className="text-lg font-medium text-blue-600">{formData.subCategory}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Product Details Form */}
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

            {/* Variants Section */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Grid className="w-5 h-5 mr-2 text-blue-600" />
                    Size-wise Pricing & Stock *
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Add price and stock for each available size
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addVariant}
                  disabled={loading || variants.length >= 6}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Size
                </button>
              </div>

              {errors.variants && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</p>
                  <ul className="text-sm text-red-700 list-disc pl-5">
                    {Array.isArray(errors.variants) ? errors.variants.map((error, index) => (
                      <li key={index}>{error}</li>
                    )) : <li>{errors.variants}</li>}
                  </ul>
                </div>
              )}

              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-4 border border-gray-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Size *
                      </label>
                      <select
                        value={variant.size}
                        onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      >
                        <option value="">Select Size</option>
                        {sizeOptions.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (₹) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                          step="0.01"
                          min="0"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock *
                      </label>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => handleVariantChange(index, 'stock', e.target.value)}
                          min="0"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SKU (Optional)
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="SKU-001"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        disabled={loading || variants.length === 1}
                        className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Remove this size"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>Note: Each size can only be added once. Total stock will be calculated automatically.</p>
              </div>
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
                          {/* Show image path in edit mode */}
                          {isEdit && product && product.images && product.images[index] && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 truncate">
                              {product.images[index]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Show all image paths in edit mode */}
                    {isEdit && product && product.images && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Image Paths:</h5>
                        <div className="space-y-1">
                          {product.images.map((path, index) => (
                            <div key={index} className="text-xs text-gray-600 font-mono truncate">
                              {index + 1}. {baseUrl}{path.startsWith('/') ? path : '/' + path}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    {/* Show video path in edit mode */}
                    {isEdit && product && product.video && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-600 font-mono truncate">
                          Path: {baseUrl}{product.video.startsWith('/') ? product.video : '/' + product.video}
                        </div>
                      </div>
                    )}
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
          </div>
        );

      default:
        return null;
    }
  };

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

        {/* Step Indicator */}
        {!isEdit && renderStepIndicator()}

        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex justify-between space-x-4 pt-6 border-t mt-6">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center"
                disabled={loading}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </button>
            )}
            
            <div className="flex-1"></div>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              
              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                  disabled={loading}
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    loading
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-green-600 hover:bg-green-700 text-white'
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
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;