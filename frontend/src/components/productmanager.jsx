// ReadymadeProductsManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReadymadeProducts,
  fetchReadymadeProductById,
  createReadymadeProduct,
  updateReadymadeProduct,
  deleteReadymadeProduct,
  clearCurrentReadymadeProduct,
  clearReadymadeError,
  clearReadymadeSuccess
} from '../redux/slices/predesignedslice.js';
import BlogRichTextEditor from './admin/BlogRichTextEditor.jsx';

const IMAGE_URL = import.meta.env.VITE_IMAGE_URL;
// Carousel Component
const ProductCarousel = ({ images, title }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  }, [images.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  }, [images.length]);

  const goToSlide = useCallback((index) => {
    if (index >= 0 && index < images.length) {
      setCurrentSlide(index);
    }
  }, [images.length]);

  // Auto slide effect
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 3000); // Auto slide every 3 seconds

    return () => clearInterval(interval);
  }, [images.length, nextSlide, isPaused]);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div 
      className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slides Container */}
      <div className="relative w-full h-full overflow-hidden">
        {images.map((image, imgIndex) => (
          <div
            key={imgIndex}
            className={`absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out ${
              imgIndex === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img 
              src={`${IMAGE_URL}/${image}`} 
              alt={`${title} - Image ${imgIndex + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `
                  <div class="w-full h-full bg-gray-100 flex items-center justify-center">
                    <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                `;
              }}
            />
          </div>
        ))}
      </div>
      
      {/* Navigation Arrows - Only show if more than 1 image */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70 z-10"
            aria-label="Previous image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70 z-10"
            aria-label="Next image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
      
      {/* Slide Indicators/Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(index);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'bg-white scale-125' 
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Slide Counter */}
      {images.length > 1 && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded z-10">
          {`${currentSlide + 1} / ${images.length}`}
        </div>
      )}
    </div>
  );
};

const ReadymadeProductsManager = () => {
  const dispatch = useDispatch();
  const {
    products,
    currentProduct,
    loading,
    error,
    success
  } = useSelector((state) => state.readymadeproducts);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    currency: 'USD',
    category: '',
    brand: '',
    stock: '',
    isActive: true,
    images: [],
    video: null
  });

  const [editingId, setEditingId] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  // Fetch products on mount
  useEffect(() => {
    dispatch(fetchReadymadeProducts());
  }, [dispatch]);

  // Reset form when editing changes
  useEffect(() => {
    if (editingId && currentProduct) {
      try {
        setFormData({
          title: currentProduct.title || '',
          description: currentProduct.description || '',
          price: currentProduct.price || '',
          currency: currentProduct.currency || 'USD',
          category: currentProduct.category || '',
          brand: currentProduct.brand || '',
          stock: currentProduct.stock || '',
          isActive: currentProduct.isActive !== false,
          images: [],
          video: null
        });
        setImagePreviews(currentProduct.images ? 
          currentProduct.images.map(img => `${IMAGE_URL}/${img}`) : 
          []);
        setVideoPreview(currentProduct.video ? 
          `${IMAGE_URL}/${currentProduct.video}` : 
          null);
        setIsFormOpen(true);
      } catch (err) {
        console.error('Error setting form data:', err);
      }
    }
  }, [editingId, currentProduct]);

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearReadymadeSuccess());
        if (!editingId) {
          handleResetForm();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, dispatch, editingId]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle image upload
  const handleImageUpload = useCallback((e) => {
    try {
      const files = Array.from(e.target.files);
      
      // Validate max 6 images
      if (formData.images.length + files.length > 6) {
        alert('Maximum 6 images allowed');
        return;
      }

      // Create previews
      const newPreviews = [];
      const newImages = [...formData.images];
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result);
          if (newPreviews.length === files.length) {
            setImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.onerror = () => {
          console.error('Error reading file:', file.name);
        };
        reader.readAsDataURL(file);
        
        // Add to images array
        newImages.push(file);
      });

      // Update form data
      setFormData(prev => ({
        ...prev,
        images: newImages
      }));
    } catch (err) {
      console.error('Error handling image upload:', err);
    }
  }, [formData.images]);

  // Handle video upload
  const handleVideoUpload = useCallback((e) => {
    try {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setVideoPreview(reader.result);
        };
        reader.onerror = () => {
          console.error('Error reading video file:', file.name);
        };
        reader.readAsDataURL(file);
        
        setFormData(prev => ({
          ...prev,
          video: file
        }));
      }
    } catch (err) {
      console.error('Error handling video upload:', err);
    }
  }, []);

  // Remove image
  const removeImage = useCallback((index) => {
    try {
      const newImages = [...formData.images];
      const newPreviews = [...imagePreviews];
      
      newImages.splice(index, 1);
      newPreviews.splice(index, 1);
      
      setFormData(prev => ({ ...prev, images: newImages }));
      setImagePreviews(newPreviews);
    } catch (err) {
      console.error('Error removing image:', err);
    }
  }, [formData.images, imagePreviews]);

  // Remove video
  const removeVideo = useCallback(() => {
    try {
      setVideoPreview(null);
      setFormData(prev => ({ ...prev, video: null }));
    } catch (err) {
      console.error('Error removing video:', err);
    }
  }, []);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!formData.title || !formData.description || !formData.price) {
        alert('Please fill in all required fields');
        return;
      }

      const productData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        currency: formData.currency,
        category: formData.category.trim(),
        brand: formData.brand.trim(),
        stock: Number(formData.stock) || 0,
        isActive: formData.isActive,
        images: formData.images,
        video: formData.video
      };

      if (editingId) {
        // Update existing product
        dispatch(updateReadymadeProduct({ 
          id: editingId, 
          updateData: productData 
        }));
      } else {
        // Create new product
        dispatch(createReadymadeProduct(productData));
      }
    } catch (err) {
      console.error('Error submitting form:', err);
    }
  };

  // Handle edit
  const handleEdit = useCallback(async (id) => {
    try {
      setEditingId(id);
      dispatch(fetchReadymadeProductById(id));
    } catch (err) {
      console.error('Error editing product:', err);
    }
  }, [dispatch]);

  // Handle delete confirmation
  const confirmDelete = useCallback(async (id) => {
    try {
      dispatch(deleteReadymadeProduct(id));
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  }, [dispatch]);

  // Reset form
  const handleResetForm = useCallback(() => {
    try {
      setFormData({
        title: '',
        description: '',
        price: '',
        currency: 'USD',
        category: '',
        brand: '',
        stock: '',
        isActive: true,
        images: [],
        video: null
      });
      setImagePreviews([]);
      setVideoPreview(null);
      setEditingId(null);
      setIsFormOpen(false);
      dispatch(clearCurrentReadymadeProduct());
    } catch (err) {
      console.error('Error resetting form:', err);
    }
  }, [dispatch]);

  // Clear error
  const handleClearError = useCallback(() => {
    dispatch(clearReadymadeError());
  }, [dispatch]);

  // Format price
  const formatPrice = useCallback((price, currency) => {
    try {
      if (!price) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
      }).format(price);
    } catch (err) {
      console.error('Error formatting price:', err);
      return `$${price}`;
    }
  }, []);

  // Simple SVG icons to avoid external dependencies
  const Icons = {
    Upload: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    Trash: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    Edit: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    Close: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    Check: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    Alert: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    Dollar: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Package: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    Tag: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    Building: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    Image: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    Video: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    Eye: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    EyeOff: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    )
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Readymade Products</h1>
            <p className="text-gray-600 mt-1">Manage your products inventory</p>
          </div>
          
          <button
            onClick={() => {
              handleResetForm();
              setIsFormOpen(true);
            }}
            className="mt-4 md:mt-0 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            <Icons.Upload />
            <span className="ml-2">{editingId ? 'Cancel Edit' : 'Add New Product'}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <Icons.Alert />
              <span className="ml-3 text-red-700">{error}</span>
            </div>
            <button 
              onClick={handleClearError}
              className="text-red-500 hover:text-red-700"
            >
              <Icons.Close />
            </button>
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <Icons.Check />
            <span className="ml-3 text-green-700">
              {editingId ? 'Product updated successfully!' : 'Product created successfully!'}
            </span>
          </div>
        )}

        {/* Product Form */}
        {isFormOpen && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Edit Product' : 'Create New Product'}
              </h2>
              <button
                onClick={handleResetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.Close />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Product title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price *
                  </label>
                  <div className="flex">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icons.Dollar />
                      </div>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="0.00"
                      />
                    </div>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="px-4 py-2 border border-l-0 border-gray-300 rounded-r-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Icons.Package />
                    </div>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleInputChange}
                      min="0"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Quantity"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Icons.Tag />
                    </div>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="e.g., Electronics"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Icons.Building />
                    </div>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Brand name"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                        disabled={loading}
                        className="sr-only"
                      />
                      <div className={`w-14 h-7 rounded-full ${formData.isActive ? 'bg-indigo-600' : 'bg-gray-300'} transition-colors ${loading ? 'opacity-50' : ''}`}>
                        <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform ${formData.isActive ? 'transform translate-x-7' : ''}`}></div>
                      </div>
                    </div>
                    <span className="ml-3 text-gray-700 flex items-center">
                      {formData.isActive ? (
                        <>
                          <Icons.Eye />
                          <span className="ml-2">Active</span>
                        </>
                      ) : (
                        <>
                          <Icons.EyeOff />
                          <span className="ml-2">Inactive</span>
                        </>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <BlogRichTextEditor
                  value={formData.description}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: html,
                    }))
                  }
                  error={Boolean(error)}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Images (Max 4)
                </label>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                          <img 
                            src={preview} 
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = `
                                <div class="w-full h-full bg-gray-100 flex items-center justify-center">
                                  <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              `;
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          disabled={loading}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <Icons.Close />
                        </button>
                      </div>
                    ))}
                    
                    {imagePreviews.length < 4 && (
                      <label className={`aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors flex flex-col items-center justify-center cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          disabled={loading || imagePreviews.length >= 4}
                          className="hidden"
                        />
                        <Icons.Image />
                        <span className="text-sm text-gray-600 mt-2">Add Image</span>
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Upload up to 6 images. Recommended size: 800x800px
                  </p>
                </div>
              </div>

              {/* Video Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Video
                </label>
                <div>
                  {videoPreview ? (
                    <div className="max-w-2xl">
                      <div className="relative rounded-lg overflow-hidden border border-gray-200">
                        <video 
                          controls 
                          className="w-full"
                          src={videoPreview}
                        >
                          Your browser does not support the video tag.
                        </video>
                        <button
                          type="button"
                          onClick={removeVideo}
                          disabled={loading}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <Icons.Close />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={`max-w-2xl block rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors p-8 text-center cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        disabled={loading}
                        className="hidden"
                      />
                      <Icons.Video />
                      <span className="text-gray-600 font-medium block mt-4">Upload Video</span>
                      <p className="text-sm text-gray-500 mt-2">
                        MP4, AVI, or MOV format (max 50MB)
                      </p>
                    </label>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : editingId ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Products ({products.length || 0})
              </h2>
              {loading && (
                <div className="flex items-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                  Loading...
                </div>
              )}
            </div>
          </div>

          {(!products || products.length === 0) && !loading ? (
            <div className="text-center py-12">
              <Icons.Package className="w-16 h-16 text-gray-300 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 mt-4 mb-2">No products yet</h3>
              <p className="text-gray-500 mb-6">Create your first product to get started</p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Create First Product
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {products && products.map((product) => (
                <div key={product._id || Math.random()} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Product Image Carousel */}
                    <div className="w-full md:w-48 flex-shrink-0">
                      <ProductCarousel 
                        images={product.images} 
                        title={product.title} 
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{product.title || 'Untitled Product'}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${product.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {product.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-gray-600">{product.description || 'No description'}</p>
                        </div>
                        
                        <div className="mt-4 md:mt-0">
                          <span className="text-2xl font-bold text-gray-900">
                            {formatPrice(product.price, product.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Product Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="flex items-center">
                          <Icons.Package />
                          <span className="text-sm text-gray-600 ml-2">Stock: <strong>{product.stock || 0}</strong></span>
                        </div>
                        {product.category && (
                          <div className="flex items-center">
                            <Icons.Tag />
                            <span className="text-sm text-gray-600 ml-2">{product.category}</span>
                          </div>
                        )}
                        {product.brand && (
                          <div className="flex items-center">
                            <Icons.Building />
                            <span className="text-sm text-gray-600 ml-2">{product.brand}</span>
                          </div>
                        )}
                        {product.video && (
                          <div className="flex items-center">
                            <Icons.Video />
                            <span className="text-sm text-gray-600 ml-2">Has Video</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(product._id)}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center disabled:opacity-50"
                        >
                          <Icons.Edit />
                          <span className="ml-2">Edit</span>
                        </button>
                        
                        <button
                          onClick={() => setShowConfirmDelete(product._id)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center disabled:opacity-50"
                        >
                          <Icons.Trash />
                          <span className="ml-2">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <Icons.Alert className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
                <p className="text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this product? All associated images and videos will also be removed.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(showConfirmDelete)}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icons.Trash />
                    <span className="ml-2">Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadymadeProductsManager;
