// DropproductAdmin.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getAllDropproducts,
  createDropproduct,
  updateDropproduct,
  deleteDropproduct,
  getDropproductById,
  clearCurrentProduct,
  clearError,
  resetOperationState,
  selectAllProducts,
  selectCurrentProduct,
  selectLoading,
  selectError,
  selectSuccess,
  selectTotalProducts,
} from '../redux/slices/dropproducts.js';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Save,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash,
} from 'lucide-react';
const imageBaseUrl = import.meta.env.VITE_IMAGE_URL || "https://maitrova.in/backend";; 
const DropproductAdmin = () => {
  const dispatch = useDispatch();
  const products = useSelector(selectAllProducts);
  const currentProduct = useSelector(selectCurrentProduct);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const success = useSelector(selectSuccess);
  const totalProducts = useSelector(selectTotalProducts);

  // State for form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSubCategories, setAvailableSubCategories] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [removeThumbnailFlag, setRemoveThumbnailFlag] = useState(false);
  // Form states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  
  // Variants (sizes, price, stock)
  const [variants, setVariants] = useState([
    { size: 'XS', price: '', stock: '', sku: '' }
  ]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    images: [],
  });

  // State for filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Fetch products on component mount
  useEffect(() => {
    dispatch(getAllDropproducts());
  }, [dispatch]);

  // Extract unique categories and subcategories from existing products
  useEffect(() => {
    const categoriesSet = new Set();
    const subCategoriesSet = new Set();
    
    products.forEach(product => {
      if (product.category) categoriesSet.add(product.category);
      if (product.subCategory) subCategoriesSet.add(product.subCategory);
    });
    
    setAvailableCategories(Array.from(categoriesSet));
    setAvailableSubCategories(Array.from(subCategoriesSet));
  }, [products]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      resetForm();
    }
  }, [isModalOpen]);

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(resetOperationState());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, dispatch]);

  // Populate form when currentProduct changes (for edit mode)
  useEffect(() => {
    if (currentProduct && isEditMode) {
      setFormData({
        name: currentProduct.name || '',
        description: currentProduct.description || '',
        images: [],
      });
      if (currentProduct.thumbnail) {
  setThumbnail(null); // no new file yet
  setRemoveThumbnailFlag(false);
  setThumbnailPreview(`${imageBaseUrl}${currentProduct.thumbnail}`);
} else {
  setThumbnail(null);
  setThumbnailPreview(null);
  setRemoveThumbnailFlag(false);
}
      // Set category and subcategory
      if (currentProduct.category) {
        setSelectedCategory(currentProduct.category);
        setNewCategory('');
      }
      if (currentProduct.subCategory) {
        setSelectedSubCategory(currentProduct.subCategory);
        setNewSubCategory('');
      }
      
      // Set variants if they exist
      if (currentProduct.variants && currentProduct.variants.length > 0) {
        setVariants(currentProduct.variants.map(v => ({
          size: v.size || '',
          price: v.price || '',
          stock: v.stock || '',
          sku: v.sku || ''
        })));
      } else {
        setVariants([{ size: 'XS', price: '', stock: '', sku: '' }]);
      }
      
      // Set preview images from existing product
      const existingPreviews = (currentProduct.images || []).map(image => ({
        url: image,
        preview: image,
        isNew: false,
      }));
      setPreviewImages(existingPreviews);
    }
  }, [currentProduct, isEditMode]);

  // Get unique categories for filter
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name?.localeCompare(b.name);
        case 'price-low':
          return (a.minPrice || 0) - (b.minPrice || 0);
        case 'price-high':
          return (b.maxPrice || 0) - (a.maxPrice || 0);
        case 'stock':
          return (b.totalStock || 0) - (a.totalStock || 0);
        default: // newest
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle variant changes
  const handleVariantChange = (index, field, value) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: value
    };
    setVariants(updatedVariants);
  };

  // Add new variant row
  const addVariant = () => {
    if (variants.length >= 6) {
      alert('Maximum 6 size variants allowed');
      return;
    }
    setVariants([...variants, { size: '', price: '', stock: '', sku: '' }]);
  };

  // Remove variant row
  const removeVariant = (index) => {
    if (variants.length > 1) {
      const updatedVariants = variants.filter((_, i) => i !== index);
      setVariants(updatedVariants);
    } else {
      alert('At least one variant is required');
    }
  };

const handleThumbnailChange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Only image files are allowed for thumbnail");
    return;
  }

  // Optional size validation (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("Thumbnail must be less than 5MB");
    return;
  }

  // If replacing existing thumbnail in edit mode, clear remove flag
  setRemoveThumbnailFlag(false);

  // Cleanup old object URL if it was a blob preview
  if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
    URL.revokeObjectURL(thumbnailPreview);
  }

  setThumbnail(file);
  setThumbnailPreview(URL.createObjectURL(file));
};

const removeThumbnail = () => {
  // cleanup blob preview
  if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
    URL.revokeObjectURL(thumbnailPreview);
  }

  setThumbnail(null);
  setThumbnailPreview(null);

  // ✅ for edit: tell backend to remove it
  if (isEditMode) setRemoveThumbnailFlag(true);
};


  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file count
    if (files.length + previewImages.length > 6) {
      alert('Maximum 6 images allowed');
      return;
    }

    // Validate file types
    const validFiles = files.filter(file => 
      file.type.startsWith('image/')
    );

    if (validFiles.length !== files.length) {
      alert('Only image files are allowed');
    }

    // Create preview URLs
    const newPreviews = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      isNew: true,
    }));

    setPreviewImages(prev => [...prev, ...newPreviews]);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles],
    }));
  };

  const removeImage = (index) => {
    const imageToRemove = previewImages[index];
    
    // Revoke object URL to prevent memory leak
    if (imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    const newPreviewImages = previewImages.filter((_, i) => i !== index);
    const newImages = formData.images.filter((_, i) => i !== index);

    setPreviewImages(newPreviewImages);
    setFormData(prev => ({
      ...prev,
      images: newImages,
    }));
  };

  const handleEdit = async (productId) => {
    try {
      await dispatch(getDropproductById(productId)).unwrap();
      setIsEditMode(true);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch product for edit:', error);
    }
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  // Basic validation
  if (!formData.name.trim()) {
    alert("Product name is required");
    return;
  }

  // Validate category
  const finalCategory = newCategory.trim() || selectedCategory;
  if (!finalCategory) {
    alert("Category is required");
    return;
  }

  // Validate subcategory
  const finalSubCategory = newSubCategory.trim() || selectedSubCategory;
  if (!finalSubCategory) {
    alert("Sub-category is required");
    return;
  }

  // Validate variants
  const validVariants = variants.filter(
    (v) => v.size.trim() && v.price !== "" && v.stock !== ""
  );

  if (validVariants.length === 0) {
    alert("At least one size variant is required");
    return;
  }

  // Check for duplicate sizes
  const sizes = validVariants.map((v) => v.size.toUpperCase());
  const uniqueSizes = new Set(sizes);
  if (uniqueSizes.size !== sizes.length) {
    alert("Duplicate sizes are not allowed");
    return;
  }

  // Validate all variant fields
  for (const variant of validVariants) {
    if (!variant.size.trim()) {
      alert("Size is required for all variants");
      return;
    }
    if (Number(variant.price) <= 0) {
      alert(`Valid price required for size ${variant.size}`);
      return;
    }
    if (Number(variant.stock) < 0) {
      alert(`Valid stock quantity required for size ${variant.size}`);
      return;
    }
  }

  // Require at least 1 image overall (existing + new)
  const existingCount = previewImages.filter((img) => img.isNew === false).length;
  if (formData.images.length + existingCount < 1) {
    alert("At least 1 image is required");
    return;
  }

  try {
    const productData = {
      name: formData.name,
      description: formData.description,
      category: finalCategory,
      subCategory: finalSubCategory,

      // ✅ new images (File objects)
      images: formData.images,

      // ✅ thumbnail File (or null)
      thumbnail: thumbnail || null,

      // ✅ in edit mode, if user removed existing thumbnail
      removeThumbnail: isEditMode ? !!removeThumbnailFlag : false,

      variants: validVariants.map((v) => ({
        size: v.size.toUpperCase(),
        price: Number(v.price),
        stock: Number(v.stock),
        sku:
          v.sku ||
          `SKU-${formData.name.substring(0, 3).toUpperCase()}-${v.size.toUpperCase()}`,
      })),
    };

    if (isEditMode && currentProduct) {
      await dispatch(
        updateDropproduct({
          id: currentProduct._id,
          productData,
        })
      ).unwrap();
    } else {
      await dispatch(createDropproduct(productData)).unwrap();
    }

    setIsModalOpen(false);
    resetForm();
  } catch (error) {
    console.error("Failed to save product:", error);
    const msg =
      error?.response?.data?.message ||
      error?.payload?.message ||
      error?.message ||
      "Failed to save product";
    alert(msg);
  }
};


  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await dispatch(deleteDropproduct(productId)).unwrap();
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      images: [],
    });
    setPreviewImages([]);
    setThumbnail(null);
    setThumbnailPreview(null);
    setRemoveThumbnailFlag(false);
    setSelectedCategory('');
    setNewCategory('');
    setSelectedSubCategory('');
    setNewSubCategory('');
    setVariants([{ size: 'XS', price: '', stock: '', sku: '' }]);
    setIsEditMode(false);
    dispatch(clearCurrentProduct());
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getStockStatus = (product) => {
    const totalStock = product.totalStock || product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
    return totalStock;
  };

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  // Allowed sizes for dropdown
  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dropproduct Management</h1>
            <p className="text-gray-600 mt-2">Manage your products inventory</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Product
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Total Products</p>
            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">In Stock</p>
            <p className="text-2xl font-bold text-green-600">
              {products.filter(p => (p.totalStock || 0) > 0).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600">
              {products.filter(p => (p.totalStock || 0) === 0).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Categories</p>
            <p className="text-2xl font-bold text-purple-600">
              {categories.length - 1}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="price-low">Price (Low to High)</option>
              <option value="price-high">Price (High to Low)</option>
              <option value="stock">Stock (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => dispatch(clearError())}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
          <span className="text-green-700">
            {isEditMode ? 'Product updated successfully!' : 'Product created successfully!'}
          </span>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => {
          const totalStock = getStockStatus(product);
          const minPrice = product.minPrice || 0;
          const maxPrice = product.maxPrice || 0;
          const priceRange = minPrice === maxPrice 
            ? formatPrice(minPrice) 
            : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;

          return (
            <div
              key={product._id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="relative h-48 overflow-hidden">
                {(product.thumbnail || product.images?.[0]) ? (
                <img
                  src={`${imageBaseUrl}${product.thumbnail || product.images[0]}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />


                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No Image</span>
                  </div>
                )}
                {/* Stock Badge */}
                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold ${
                  totalStock > 10 ? 'bg-green-500 text-white' :
                  totalStock > 0 ? 'bg-yellow-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                  <span className="font-bold text-lg text-blue-600">
                    {priceRange}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>
                <div className="space-y-2 mb-4">
                  <div className="text-sm">
                    <span className="text-gray-500">Category: </span>
                    <span className="font-medium">{product.category || 'Uncategorized'}</span>
                  </div>
                  {product.subCategory && (
                    <div className="text-sm">
                      <span className="text-gray-500">Sub-Category: </span>
                      <span className="font-medium">{product.subCategory}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-gray-500">Sizes: </span>
                    <span className="font-medium">
                      {product.variants?.map(v => v.size).join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {product.variants?.length || 0} variant(s)
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(product._id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Eye className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterCategory !== 'all' 
              ? 'Try adjusting your search or filter'
              : 'Get started by creating your first product'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Product
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditMode ? 'Edit Product' : 'Create New Product'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        placeholder="Enter product name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Category Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category *
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setNewCategory('');
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select existing category</option>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-1">Or create new category:</p>
                          <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => {
                              setNewCategory(e.target.value);
                              setSelectedCategory('');
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter new category name"
                          />
                        </div>
                      </div>

                      {/* Sub-Category Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sub-Category *
                        </label>
                        <select
                          value={selectedSubCategory}
                          onChange={(e) => {
                            setSelectedSubCategory(e.target.value);
                            setNewSubCategory('');
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select existing sub-category</option>
                          {availableSubCategories.map(subCat => (
                            <option key={subCat} value={subCat}>{subCat}</option>
                          ))}
                        </select>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-1">Or create new sub-category:</p>
                          <input
                            type="text"
                            value={newSubCategory}
                            onChange={(e) => {
                              setNewSubCategory(e.target.value);
                              setSelectedSubCategory('');
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter new sub-category name"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe your product..."
                      />
                    </div>
                  </div>
                </div>

                {/* Size Variants */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Size Variants *
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      (Add price and stock for each size)
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    {variants.map((variant, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg">
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Size
                          </label>
                          <select
                            value={variant.size}
                            onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            <option value="">Select size</option>
                            {sizeOptions.map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                            required
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) => handleVariantChange(index, 'stock', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                            required
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            SKU (Optional)
                          </label>
                          <input
                            type="text"
                            value={variant.sku}
                            onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="SKU"
                          />
                        </div>
                        
                        <div className="col-span-1 flex items-end">
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={variants.length <= 1}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addVariant}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={variants.length >= 6}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Another Size
                    </button>
                  </div>
                </div>

                {/* Thumbnail Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thumbnail Image
                    <span className="text-xs text-gray-500 ml-2">(Optional, 1 image)</span>
                  </label>

                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Thumbnail
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        className="hidden"
                      />
                    </label>

                    {thumbnailPreview && (
                      <div className="relative group">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail Preview"
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={removeThumbnail}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Remove thumbnail"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {!thumbnailPreview && isEditMode && currentProduct?.thumbnail && (
                      <div className="text-xs text-gray-500">
                        Current thumbnail will remain unless you upload/remove.
                      </div>
                    )}
                  </div>
                </div>


                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Images *
                    <span className="text-xs text-gray-500 ml-2">
                      (Minimum 1, Maximum 6 images)
                    </span>
                  </label>
                  
                  {/* Image Upload Area */}
                  <div className="mb-4">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Preview Images */}

                    {previewImages.length > 0 && (
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {previewImages.map((img, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={`${img.preview || img.url}`}  // Prepend base URL from .env
                              alt={`Preview ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {isEditMode ? 'Update Product' : 'Create Product'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropproductAdmin;