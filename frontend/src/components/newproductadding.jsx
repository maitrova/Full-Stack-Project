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
  ChevronLeft,
  Edit3,
  Save,
  Tag
} from 'lucide-react';

import { 
  createProduct,
  updateProduct
} from '../redux/slices/productList.js';
import { addNotification } from '../redux/slices/adminSlice.js';
import { 
  fetchCategories, 
  fetchSubCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory 
} from '../redux/slices/category.js';
import { 
  fetchBrands,
  fetchBrandsBySubCategory,
  createBrand,
  updateBrand,
  deleteBrand,
  clearBrands
} from '../redux/slices/brandSlice.js';
import RichTextEditor from './RichTextEditor.jsx';

const ProductFormModal = ({ 
  isOpen, 
  onClose, 
  product = null,
  isEdit = false 
}) => {
  const dispatch = useDispatch();
  
  const { categories, subCategories } = useSelector((state) => ({
    categories: state.category?.categories || [],
    subCategories: state.category?.subCategories || []
  }));
  
  const { brands, loading: brandsLoading } = useSelector((state) => ({
    brands: state.brand?.brands || [],
    loading: state.brand?.loading || false
  }));
  
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [subCategoryLoading, setSubCategoryLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  
  // Step state for sequential flow
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { id: 1, name: 'Category', description: 'Select product category' },
    { id: 2, name: 'Sub-category', description: 'Select sub-category' },
    { id: 3, name: 'Brand', description: 'Select brand' },
    { id: 4, name: 'Details', description: 'Add product details' },
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
  const [sizeChart, setSizeChart] = useState(null);
  const [sizeChartPreview, setSizeChartPreview] = useState(null);
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  
  
  // New/Edit category/sub-category/brand state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);
  const [showNewBrand, setShowNewBrand] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubCategory, setEditingSubCategory] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryAltText, setNewCategoryAltText] = useState('');

  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newSubCategoryAltText, setNewSubCategoryAltText] = useState('');

  const [newBrandName, setNewBrandName] = useState('');
  
  const [newCategoryThumbnail, setNewCategoryThumbnail] = useState(null);
  const [newCategoryThumbnailPreview, setNewCategoryThumbnailPreview] = useState(null);
  const [newSubCategoryThumbnail, setNewSubCategoryThumbnail] = useState(null);
  const [newSubCategoryThumbnailPreview, setNewSubCategoryThumbnailPreview] = useState(null);
  
  const [subCategoriesForCategory, setSubCategoriesForCategory] = useState([]);
  const [brandsForSubCategory, setBrandsForSubCategory] = useState([]);
  
  const [categoryErrors, setCategoryErrors] = useState({});
  const [subCategoryErrors, setSubCategoryErrors] = useState({});
  const [brandErrors, setBrandErrors] = useState({});
  
  const [showCategoryActions, setShowCategoryActions] = useState(null);
  const [showSubCategoryActions, setShowSubCategoryActions] = useState(null);
  const [showBrandActions, setShowBrandActions] = useState(null);

  // Size options
  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Base URL for image paths
  const baseUrl = import.meta.env.VITE_IMAGE_URL || '';

  // Load categories and subcategories when modal opens
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        dispatch(fetchCategories()),
        dispatch(fetchSubCategories()),
        dispatch(fetchBrands())
      ]).catch(error => {
        console.error('Error fetching data:', error);
      });
    }
    
    return () => {
      dispatch(clearBrands());
    };
  }, [dispatch, isOpen]);

  // Fetch brands when subcategory changes
  useEffect(() => {
    if (formData.subCategory) {
      dispatch(fetchBrandsBySubCategory(formData.subCategory));
    } else {
      dispatch(clearBrands());
    }
  }, [dispatch, formData.subCategory]);

  // Update subcategories when category changes
  useEffect(() => {
    if (formData.category) {
      const categoryId = String(formData.category);
      
      const filteredSubs = subCategories.filter(sub => {
        let subCategoryId = null;
        if (sub.category && typeof sub.category === 'object') {
          subCategoryId = sub.category._id;
        } else {
          subCategoryId = sub.category;
        }
        return subCategoryId && String(subCategoryId) === categoryId;
      });
      
      const uniqueSubCategories = filteredSubs
        .filter((sub, index, self) =>
          index === self.findIndex(s => s._id === sub._id)
        )
        .map(sub => ({
          _id: sub._id,
          id: sub._id,
          name: sub.name,
          thumbnail: sub.thumbnail,
          category: sub.category
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setSubCategoriesForCategory(uniqueSubCategories);
    } else {
      setSubCategoriesForCategory([]);
    }
  }, [formData.category, subCategories]);

  // Update brands list when brands change
  useEffect(() => {
    if (formData.subCategory) {
      const filteredBrands = brands
        .filter(brand => {
          let brandSubCategoryId = null;
          if (brand.subCategory && typeof brand.subCategory === 'object') {
            brandSubCategoryId = brand.subCategory._id;
          } else {
            brandSubCategoryId = brand.subCategory;
          }
          return brandSubCategoryId && String(brandSubCategoryId) === String(formData.subCategory);
        })
        .map(brand => ({
          _id: brand._id,
          id: brand._id,
          name: brand.name,
          subCategory: brand.subCategory
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setBrandsForSubCategory(filteredBrands);
    } else {
      setBrandsForSubCategory([]);
    }
  }, [brands, formData.subCategory]);

  // Populate form for editing
  useEffect(() => {
  if (isEdit && product) {

    setFormData({
      title: product.title || '',
      description: product.description || '',
      currency: product.currency || 'INR',
      category: product.category?._id || product.category || '',
      subCategory: product.subCategory?._id || product.subCategory || '',
      brand: product.brand?._id || product.brand || '',
      isActive: product.isActive ?? true,
      bestSeller: product.bestSeller || false,
      newArrival: product.newArrival || false,
    });

    // ✅ Variants
    if (product.variants && product.variants.length > 0) {
      setVariants(
        product.variants.map(v => ({
          size: v.size || '',
          price: v.price?.toString() || '',
          stock: v.stock?.toString() || '',
          sku: v.sku || ''
        }))
      );
    } else {
      setVariants([
        {
          size: '',
          price: product.price?.toString() || '',
          stock: product.stock?.toString() || '',
          sku: ''
        }
      ]);
    }

    // ✅ Images preview
    if (product.images && product.images.length > 0) {

      const previews = product.images.map(image => {

        const imageUrl =
          typeof image === "string"
            ? image
            : image.url || "";

        if (!imageUrl) return "";

        if (imageUrl.startsWith("http")) return imageUrl;

        return `${baseUrl}${imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl}`;

      });

      setImagePreviews(previews);

      // preserve altText
      const imageObjects = product.images.map(image => ({
        file: null,
        altText: typeof image === "object" ? image.altText || "" : ""
      }));

      setImages(imageObjects);
    }

    // ✅ Video preview
    if (product.video) {

      const videoUrl = product.video.startsWith("http")
        ? product.video
        : `${baseUrl}${product.video.startsWith("/") ? product.video : "/" + product.video}`;

      setVideoPreview(videoUrl);
    }

    // ✅ NEW: Size Chart preview
    if (product.sizeChart) {

      const sizeChartUrl = product.sizeChart.startsWith("http")
        ? product.sizeChart
        : `${baseUrl}${product.sizeChart.startsWith("/") ? product.sizeChart : "/" + product.sizeChart}`;

      setSizeChartPreview(sizeChartUrl);

    }

    setCurrentStep(4);

  } else {

    resetForm();

  }

}, [product, isEdit, baseUrl]);

  const resetForm = () => {
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
      
      // ✅ NEW
    });
    setVariants([{ size: '', price: '', stock: '', sku: '' }]);
    setImages([]);
    setVideo(null);
    setImagePreviews([]);
    setVideoPreview(null);
    
    setErrors({});
    resetCategoryForm();
    resetSubCategoryForm();
    resetBrandForm();
    setEditingCategory(null);
    setEditingSubCategory(null);
    setEditingBrand(null);
    setShowNewCategory(false);
    setShowNewSubCategory(false);
    setShowNewBrand(false);
    setShowCategoryActions(null);
    setShowSubCategoryActions(null);
    setShowBrandActions(null);
    setCurrentStep(1);
    setSizeChart(null);
    setSizeChartPreview(null);
  };

  const resetCategoryForm = () => {
  setNewCategoryName('');
  setNewCategoryAltText(''); // ✅ add
  setNewCategoryThumbnail(null);
  setNewCategoryThumbnailPreview(null);
  setCategoryErrors({});
  setEditingCategory(null);
};


  const resetSubCategoryForm = () => {
  setNewSubCategoryName('');
  setNewSubCategoryAltText(''); // ✅ add
  setNewSubCategoryThumbnail(null);
  setNewSubCategoryThumbnailPreview(null);
  setSubCategoryErrors({});
  setEditingSubCategory(null);
};


  const resetBrandForm = () => {
    setNewBrandName('');
    setBrandErrors({});
    setEditingBrand(null);
  };
const handleSizeChartUpload = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  const maxSize = 5 * 1024 * 1024;

  if (!validTypes.includes(file.type)) {
    setErrors(prev => ({
      ...prev,
      sizeChart: "Only JPG, PNG, WebP allowed",
    }));
    return;
  }

  if (file.size > maxSize) {
    setErrors(prev => ({
      ...prev,
      sizeChart: "Size chart must be under 5MB",
    }));
    return;
  }

  setSizeChart(file);

  const reader = new FileReader();
  reader.onloadend = () => setSizeChartPreview(reader.result);
  reader.readAsDataURL(file);
};


const removeSizeChart = () => {
  setSizeChart(null);
  setSizeChartPreview(null);
};
  // Step navigation handlers
  const goToNextStep = () => {
    if (currentStep === 1) {
      if (!formData.category) {
        setErrors({ category: 'Please select a category' });
        return;
      }
    } else if (currentStep === 2) {
      // Sub-category is optional, no validation needed
    } else if (currentStep === 3) {
      // Brand is optional, no validation needed
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length));
    setErrors({});
  };

  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'category') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        subCategory: '',
        brand: ''
      }));
    } else if (name === 'subCategory') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        brand: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
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

  // Handle category thumbnail upload
  const handleCategoryThumbnailUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setCategoryErrors(prev => ({ ...prev, thumbnail: 'Only JPG, PNG, and WebP images are allowed' }));
      return;
    }

    if (file.size > maxSize) {
      setCategoryErrors(prev => ({ ...prev, thumbnail: 'Thumbnail size should be less than 5MB' }));
      return;
    }

    setNewCategoryThumbnail(file);

    const reader = new FileReader();
    reader.onloadend = () => setNewCategoryThumbnailPreview(reader.result);
    reader.readAsDataURL(file);

    if (categoryErrors.thumbnail) {
      setCategoryErrors(prev => ({ ...prev, thumbnail: null }));
    }
  };

  const removeCategoryThumbnail = () => {
    setNewCategoryThumbnail(null);
    setNewCategoryThumbnailPreview(null);
  };

  // Handle subcategory thumbnail upload
  const handleSubCategoryThumbnailUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setSubCategoryErrors(prev => ({ ...prev, thumbnail: 'Only JPG, PNG, and WebP images are allowed' }));
      return;
    }

    if (file.size > maxSize) {
      setSubCategoryErrors(prev => ({ ...prev, thumbnail: 'Thumbnail size should be less than 5MB' }));
      return;
    }

    setNewSubCategoryThumbnail(file);

    const reader = new FileReader();
    reader.onloadend = () => setNewSubCategoryThumbnailPreview(reader.result);
    reader.readAsDataURL(file);

    if (subCategoryErrors.thumbnail) {
      setSubCategoryErrors(prev => ({ ...prev, thumbnail: null }));
    }
  };

  const removeSubCategoryThumbnail = () => {
    setNewSubCategoryThumbnail(null);
    setNewSubCategoryThumbnailPreview(null);
  };

  // const handleThumbnailUpload = (e) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  //   const maxSize = 5 * 1024 * 1024;

  //   if (!validTypes.includes(file.type)) {
  //     setErrors(prev => ({ ...prev, thumbnail: 'Only JPG, PNG, and WebP images are allowed' }));
  //     return;
  //   }

  //   if (file.size > maxSize) {
  //     setErrors(prev => ({ ...prev, thumbnail: 'Thumbnail size should be less than 5MB' }));
  //     return;
  //   }

  //   setThumbnail(file);

  //   const reader = new FileReader();
  //   reader.onloadend = () => setThumbnailPreview(reader.result);
  //   reader.readAsDataURL(file);

  //   if (errors.thumbnail) {
  //     setErrors(prev => ({ ...prev, thumbnail: null }));
  //   }
  // };

  // const removeThumbnail = () => {
  //   setThumbnail(null);
  //   setThumbnailPreview(null);
  // };

  const handleImageUpload = (e) => {
  const files = Array.from(e.target.files);

  if (images.length + files.length > 4) {
    setErrors(prev => ({
      ...prev,
      images: "Maximum 4 images allowed",
    }));
    return;
  }

  const validFiles = files.filter(file => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) return false;
    if (file.size > maxSize) return false;

    return true;
  });

  const newImages = validFiles.map(file => ({
    file,
    altText: "",
  }));

  setImages(prev => [...prev, ...newImages]);

  validFiles.forEach(file => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => [...prev, reader.result]);
    };
    reader.readAsDataURL(file);
  });
};


  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));

    setImagePreviews(prev => prev.filter((_, i) => i !== index));
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

  const removeVideo = () => {
    setVideo(null);
    setVideoPreview(null);
  };

  // ============= CATEGORY MANAGEMENT FUNCTIONS =============

  const startEditCategory = (category) => {
    if (!category || !category._id) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid category data',
      }));
      return;
    }
    
    setEditingCategory(category);
    setNewCategoryName(category.name || '');
    setNewCategoryAltText(category.altText || '');

    setNewCategoryThumbnail(null);
    
    if (category.thumbnail) {
      const thumbnailUrl = category.thumbnail.startsWith('http') 
        ? category.thumbnail 
        : `${baseUrl}${category.thumbnail.startsWith('/') ? category.thumbnail : '/' + category.thumbnail}`;
      setNewCategoryThumbnailPreview(thumbnailUrl);
    } else {
      setNewCategoryThumbnailPreview(null);
    }
    
    setShowNewCategory(true);
    setCategoryErrors({});
  };

  const handleAddNewCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      setCategoryErrors({ name: 'Category name is required' });
      return;
    }
    
    if (!newCategoryThumbnail) {
      setCategoryErrors({ thumbnail: 'Category thumbnail is required' });
      return;
    }
    
    setCategoryLoading(true);
    
    try {
      const categoryFormData = new FormData();
      categoryFormData.append('name', newCategoryName.trim());
      categoryFormData.append('altText', newCategoryAltText.trim());

      categoryFormData.append('thumbnail', newCategoryThumbnail);
      
      const newCategory = await dispatch(createCategory(categoryFormData)).unwrap();
      
      await dispatch(fetchCategories()).unwrap();
      
      setFormData(prev => ({
        ...prev,
        category: newCategory._id,
        subCategory: '',
        brand: ''
      }));
      
      resetCategoryForm();
      setShowNewCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `New category "${newCategory.name}" created successfully!`,
      }));
      
      setTimeout(() => goToNextStep(), 500);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          error?.response?.data?.message || 
                          'Failed to create category';
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      setCategoryErrors({ name: 'Category name is required' });
      return;
    }
    
    if (!newCategoryThumbnail && !editingCategory?.thumbnail) {
      setCategoryErrors({ thumbnail: 'Category thumbnail is required' });
      return;
    }
    
    if (!editingCategory || !editingCategory._id) {
      setCategoryErrors({ general: 'Invalid category data. Please try again.' });
      return;
    }
    
    setCategoryLoading(true);
    
    try {
      const categoryFormData = new FormData();
      categoryFormData.append('name', newCategoryName.trim());
      categoryFormData.append('altText', newCategoryAltText.trim());

      if (newCategoryThumbnail) {
        categoryFormData.append('thumbnail', newCategoryThumbnail);
      }
      
      const categoryId = editingCategory._id;
      
      const updatedCategory = await dispatch(updateCategory({
        id: categoryId,
        formData: categoryFormData
      })).unwrap();
      
      await dispatch(fetchCategories()).unwrap();
      
      if (formData.category === categoryId) {
        setFormData(prev => ({ 
          ...prev, 
          category: updatedCategory._id 
        }));
      }
      
      resetCategoryForm();
      setEditingCategory(null);
      setShowNewCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `Category "${updatedCategory.name}" updated successfully!`,
      }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          error?.response?.data?.message || 
                          'Failed to update category';
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
      
      setCategoryErrors({ 
        general: errorMessage 
      });
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!categoryId) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid category ID',
      }));
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }
    
    setCategoryLoading(true);
    
    try {
      await dispatch(deleteCategory(categoryId)).unwrap();
      
      await dispatch(fetchCategories()).unwrap();
      
      if (formData.category === categoryId) {
        setFormData(prev => ({
          ...prev,
          category: '',
          subCategory: '',
          brand: ''
        }));
      }
      
      setShowCategoryActions(null);
      
      dispatch(addNotification({
        type: 'success',
        message: 'Category deleted successfully!',
      }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          error?.response?.data?.message || 
                          'Failed to delete category';
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      setCategoryLoading(false);
    }
  };

  // ============= SUBCATEGORY MANAGEMENT FUNCTIONS =============

  const startEditSubCategory = (subCategory) => {
    if (!subCategory || !subCategory._id) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid sub-category data',
      }));
      return;
    }
    
    setEditingSubCategory(subCategory);
    setNewSubCategoryName(subCategory.name || '');
    setNewSubCategoryAltText(subCategory.altText || '');

    setNewSubCategoryThumbnail(null);
    
    if (subCategory.thumbnail) {
      const thumbnailUrl = subCategory.thumbnail.startsWith('http') 
        ? subCategory.thumbnail 
        : `${baseUrl}${subCategory.thumbnail.startsWith('/') ? subCategory.thumbnail : '/' + subCategory.thumbnail}`;
      setNewSubCategoryThumbnailPreview(thumbnailUrl);
    } else {
      setNewSubCategoryThumbnailPreview(null);
    }
    
    setShowNewSubCategory(true);
    setSubCategoryErrors({});
  };

  const handleAddNewSubCategory = async (e) => {
    e.preventDefault();
    
    if (!newSubCategoryName.trim()) {
      setSubCategoryErrors({ name: 'Sub-category name is required' });
      return;
    }
    
    if (!newSubCategoryThumbnail) {
      setSubCategoryErrors({ thumbnail: 'Sub-category thumbnail is required' });
      return;
    }
    
    if (!formData.category) {
      setSubCategoryErrors({ category: 'Please select a category first' });
      return;
    }

    let categoryId = formData.category;
    
    if (categoryId && typeof categoryId === 'object') {
      categoryId = categoryId._id || categoryId.id;
    }
    
    categoryId = String(categoryId);
    
    if (!categoryId || categoryId === 'undefined' || categoryId === '[object Object]') {
      setSubCategoryErrors({ 
        category: 'Invalid category selected. Please try selecting the category again.' 
      });
      return;
    }
    
    setSubCategoryLoading(true);
    
    try {
      const subCategoryFormData = new FormData();
      subCategoryFormData.append('name', newSubCategoryName.trim());
      subCategoryFormData.append('altText', newSubCategoryAltText.trim());

      subCategoryFormData.append('category', categoryId);
      subCategoryFormData.append('thumbnail', newSubCategoryThumbnail);
      
      const newSubCategory = await dispatch(createSubCategory(subCategoryFormData)).unwrap();
      
      await dispatch(fetchSubCategories()).unwrap();
      
      setFormData(prev => ({
        ...prev,
        subCategory: newSubCategory._id
      }));
      
      resetSubCategoryForm();
      setShowNewSubCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `New sub-category "${newSubCategory.name}" created successfully!`,
      }));
      
      setTimeout(() => goToNextStep(), 500);
    } catch (error) {
      let errorMessage = 'Failed to create sub-category';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      if (errorMessage.includes('category') || errorMessage.includes('ObjectId')) {
        errorMessage = 'Invalid category selected. Please try selecting the category again.';
        dispatch(fetchCategories());
      }
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
      
      setSubCategoryErrors({ 
        general: errorMessage 
      });
    } finally {
      setSubCategoryLoading(false);
    }
  };

  const handleUpdateSubCategory = async (e) => {
    e.preventDefault();
    
    if (!newSubCategoryName.trim()) {
      setSubCategoryErrors({ name: 'Sub-category name is required' });
      return;
    }
    
    if (!newSubCategoryThumbnail && !editingSubCategory?.thumbnail) {
      setSubCategoryErrors({ thumbnail: 'Sub-category thumbnail is required' });
      return;
    }
    
    if (!editingSubCategory || !editingSubCategory._id) {
      setSubCategoryErrors({ general: 'Invalid sub-category data. Please try again.' });
      return;
    }
    
    setSubCategoryLoading(true);
    
    try {
      const subCategoryFormData = new FormData();
      subCategoryFormData.append('name', newSubCategoryName.trim());
      subCategoryFormData.append('altText', newSubCategoryAltText.trim());

      let categoryId = null;
      
      if (editingSubCategory.category) {
        if (typeof editingSubCategory.category === 'object') {
          categoryId = editingSubCategory.category._id || editingSubCategory.category.id;
        } else {
          categoryId = editingSubCategory.category;
        }
      }
      
      if (!categoryId && formData.category) {
        if (typeof formData.category === 'object') {
          categoryId = formData.category._id || formData.category.id;
        } else {
          categoryId = formData.category;
        }
      }
      
      categoryId = categoryId ? String(categoryId) : null;
      
      if (!categoryId || categoryId === 'undefined' || categoryId === '[object Object]') {
        throw new Error('Valid category ID is required for subcategory');
      }
      
      subCategoryFormData.append('category', categoryId);
      
      if (newSubCategoryThumbnail) {
        subCategoryFormData.append('thumbnail', newSubCategoryThumbnail);
      }
      
      const subCategoryId = editingSubCategory._id;
      
      const updatedSubCategory = await dispatch(updateSubCategory({
        id: subCategoryId,
        formData: subCategoryFormData
      })).unwrap();
      
      await dispatch(fetchSubCategories()).unwrap();
      
      if (formData.subCategory === subCategoryId) {
        setFormData(prev => ({ 
          ...prev, 
          subCategory: updatedSubCategory._id 
        }));
      }
      
      resetSubCategoryForm();
      setEditingSubCategory(null);
      setShowNewSubCategory(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `Sub-category "${updatedSubCategory.name}" updated successfully!`,
      }));
    } catch (error) {
      let errorMessage = 'Failed to update sub-category';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
      
      setSubCategoryErrors({ 
        general: errorMessage 
      });
    } finally {
      setSubCategoryLoading(false);
    }
  };

  const handleDeleteSubCategory = async (subCategoryId) => {
    if (!subCategoryId) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid sub-category ID',
      }));
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this sub-category? This action cannot be undone.')) {
      return;
    }
    
    setSubCategoryLoading(true);
    
    try {
      await dispatch(deleteSubCategory(subCategoryId)).unwrap();
      
      await dispatch(fetchSubCategories()).unwrap();
      
      if (formData.subCategory === subCategoryId) {
        setFormData(prev => ({ 
          ...prev, 
          subCategory: '',
          brand: '' 
        }));
      }
      
      setShowSubCategoryActions(null);
      
      dispatch(addNotification({
        type: 'success',
        message: 'Sub-category deleted successfully!',
      }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          error?.response?.data?.message || 
                          'Failed to delete sub-category';
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      setSubCategoryLoading(false);
    }
  };

  // ============= BRAND MANAGEMENT FUNCTIONS =============

  const startEditBrand = (brand) => {
    if (!brand || !brand._id) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid brand data',
      }));
      return;
    }
    
    setEditingBrand(brand);
    setNewBrandName(brand.name || '');
    setShowNewBrand(true);
    setBrandErrors({});
  };

  const handleAddNewBrand = async (e) => {
    e.preventDefault();
    
    if (!newBrandName.trim()) {
      setBrandErrors({ name: 'Brand name is required' });
      return;
    }
    
    if (!formData.subCategory) {
      setBrandErrors({ subCategory: 'Please select a sub-category first' });
      return;
    }

    let subCategoryId = formData.subCategory;
    
    if (subCategoryId && typeof subCategoryId === 'object') {
      subCategoryId = subCategoryId._id || subCategoryId.id;
    }
    
    subCategoryId = String(subCategoryId);
    
    if (!subCategoryId || subCategoryId === 'undefined' || subCategoryId === '[object Object]') {
      setBrandErrors({ 
        subCategory: 'Invalid sub-category selected. Please try selecting the sub-category again.' 
      });
      return;
    }
    
    setBrandLoading(true);
    
    try {
      const brandData = {
        name: newBrandName.trim(),
        subCategory: subCategoryId
      };
      
      const newBrand = await dispatch(createBrand(brandData)).unwrap();
      
      await dispatch(fetchBrandsBySubCategory(formData.subCategory)).unwrap();
      
      setFormData(prev => ({
        ...prev,
        brand: newBrand._id
      }));
      
      resetBrandForm();
      setShowNewBrand(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `New brand "${newBrand.name}" created successfully!`,
      }));
      
      setTimeout(() => goToNextStep(), 500);
    } catch (error) {
      let errorMessage = 'Failed to create brand';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
      
      setBrandErrors({ 
        general: errorMessage 
      });
    } finally {
      setBrandLoading(false);
    }
  };

  const handleUpdateBrand = async (e) => {
    e.preventDefault();
    
    if (!newBrandName.trim()) {
      setBrandErrors({ name: 'Brand name is required' });
      return;
    }
    
    if (!editingBrand || !editingBrand._id) {
      setBrandErrors({ general: 'Invalid brand data. Please try again.' });
      return;
    }
    
    setBrandLoading(true);
    
    try {
      let subCategoryId = formData.subCategory;
      
      if (!subCategoryId && editingBrand.subCategory) {
        if (typeof editingBrand.subCategory === 'object') {
          subCategoryId = editingBrand.subCategory._id || editingBrand.subCategory.id;
        } else {
          subCategoryId = editingBrand.subCategory;
        }
      }
      
      subCategoryId = subCategoryId ? String(subCategoryId) : null;
      
      if (!subCategoryId) {
        throw new Error('Valid sub-category ID is required for brand');
      }
      
      const brandData = {
        name: newBrandName.trim(),
        subCategory: subCategoryId
      };
      
      const brandId = editingBrand._id;
      
      const updatedBrand = await dispatch(updateBrand({
        id: brandId,
        data: brandData
      })).unwrap();
      
      await dispatch(fetchBrandsBySubCategory(formData.subCategory)).unwrap();
      
      if (formData.brand === brandId) {
        setFormData(prev => ({ 
          ...prev, 
          brand: updatedBrand._id 
        }));
      }
      
      resetBrandForm();
      setEditingBrand(null);
      setShowNewBrand(false);
      
      dispatch(addNotification({
        type: 'success',
        message: `Brand "${updatedBrand.name}" updated successfully!`,
      }));
    } catch (error) {
      let errorMessage = 'Failed to update brand';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
      
      setBrandErrors({ 
        general: errorMessage 
      });
    } finally {
      setBrandLoading(false);
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!brandId) {
      dispatch(addNotification({
        type: 'error',
        message: 'Invalid brand ID',
      }));
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this brand? This action cannot be undone.')) {
      return;
    }
    
    setBrandLoading(true);
    
    try {
      await dispatch(deleteBrand(brandId)).unwrap();
      
      await dispatch(fetchBrandsBySubCategory(formData.subCategory)).unwrap();
      
      if (formData.brand === brandId) {
        setFormData(prev => ({ 
          ...prev, 
          brand: '' 
        }));
      }
      
      setShowBrandActions(null);
      
      dispatch(addNotification({
        type: 'success',
        message: 'Brand deleted successfully!',
      }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          error?.response?.data?.message || 
                          'Failed to delete brand';
      
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      setBrandLoading(false);
    }
  };

  const cancelCategoryAction = () => {
    setShowNewCategory(false);
    setEditingCategory(null);
    resetCategoryForm();
  };

  const cancelSubCategoryAction = () => {
    setShowNewSubCategory(false);
    setEditingSubCategory(null);
    resetSubCategoryForm();
  };

  const cancelBrandAction = () => {
    setShowNewBrand(false);
    setEditingBrand(null);
    resetBrandForm();
  };

  const handleKeyPress = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'category') {
        if (editingCategory) {
          handleUpdateCategory(e);
        } else {
          handleAddNewCategory(e);
        }
      } else if (type === 'subcategory') {
        if (editingSubCategory) {
          handleUpdateSubCategory(e);
        } else {
          handleAddNewSubCategory(e);
        }
      } else if (type === 'brand') {
        if (editingBrand) {
          handleUpdateBrand(e);
        } else {
          handleAddNewBrand(e);
        }
      }
    }
  };

  const getAllCategories = () => {
    return categories
      .map(cat => ({
        _id: cat._id,
        id: cat._id,
        name: cat.name,
        thumbnail: cat.thumbnail
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

const validateForm = () => {
  const newErrors = {};   // ✅ define it FIRST

  const isRichTextEmpty = (html) => {
    const text = (html || "")
      .replace(/<(.|\n)*?>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    return text.length === 0;
  };

  // Title validation
  if (!formData.title.trim()) {
    newErrors.title = "Title is required";
  }

  // Rich text description validation
  if (isRichTextEmpty(formData.description)) {
    newErrors.description = "Description is required";
  }

  // Category validation
  if (!formData.category) {
    newErrors.category = "Category is required";
  }

  // Keep your existing variant validation below this
  const variantErrors = [];
  const usedSizes = new Set();

  variants.forEach((variant, index) => {
    if (!variant.size) {
      variantErrors.push(`Size is required for variant ${index + 1}`);
    } else if (usedSizes.has(variant.size)) {
      variantErrors.push(`Duplicate size "${variant.size}" found`);
    } else {
      usedSizes.add(variant.size);
    }

    if (!variant.price || isNaN(variant.price) || Number(variant.price) <= 0) {
      variantErrors.push(`Valid price is required for size ${variant.size || index + 1}`);
    }

    if (variant.stock === "" || isNaN(variant.stock) || Number(variant.stock) < 0) {
      variantErrors.push(`Valid stock is required for size ${variant.size || index + 1}`);
    }
  });

  if (variantErrors.length > 0) {
    newErrors.variants = variantErrors;
  }

  if (!isEdit && images.length === 0) {
    newErrors.images = "At least one image is required";
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
      
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          data.append(key, formData[key]);
        }
      });
      
      const normalizedVariants = variants.map(v => ({
        size: v.size,
        price: Number(v.price),
        stock: Number(v.stock || 0),
        sku: v.sku || ''
      }));
      
      const overallPrice = Math.min(...normalizedVariants.map(v => v.price));
      const totalStock = normalizedVariants.reduce((sum, v) => sum + v.stock, 0);
      
      data.append('price', overallPrice);
      data.append('stock', totalStock);
      data.append('variants', JSON.stringify(normalizedVariants));
      
      images.forEach((img) => {
        data.append("images", img.file);
      });

      data.append(
        "imageAltTexts",
        JSON.stringify(images.map(img => img.altText || ""))
      );

      
      

      if (video) {
        data.append('video', video);
      }

      if (sizeChart) {
        data.append("sizeChart", sizeChart);
      }
      
      if (isEdit && product) {
        await dispatch(updateProduct({
          id: product._id,
          formData: data
        })).unwrap();
        
        dispatch(addNotification({
          type: 'success',
          message: 'Product updated successfully!',
        }));
      } else {
        await dispatch(createProduct(data)).unwrap();
        
        dispatch(addNotification({
          type: 'success',
          message: 'Product created successfully!',
        }));
      }
      
      onClose();
      resetForm();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to save product';
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  const getCategoryName = () => {
    if (!formData.category) return '';
    const cat = categories.find(c => c._id === formData.category);
    return cat?.name || '';
  };

  const getSubCategoryName = () => {
    if (!formData.subCategory) return '';
    const sub = subCategories.find(s => s._id === formData.subCategory);
    return sub?.name || '';
  };

  const getBrandName = () => {
    if (!formData.brand) return '';
    const brand = brands.find(b => b._id === formData.brand);
    return brand?.name || '';
  };

  const getCategoryById = (id) => {
    if (!id) return null;
    return categories.find(c => c._id === id);
  };

  const getSubCategoryById = (id) => {
    if (!id) return null;
    return subCategories.find(s => s._id === id);
  };

  const getBrandById = (id) => {
    if (!id) return null;
    return brands.find(b => b._id === id);
  };

  // ============= RENDER FUNCTIONS =============

  const renderCategoryActions = (category) => {
    if (!category || !category._id) {
      return null;
    }
    
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowCategoryActions(showCategoryActions === category._id ? null : category._id)}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {showCategoryActions === category._id && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  startEditCategory(category);
                  setShowCategoryActions(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryActions(null);
                  handleDeleteCategory(category._id);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Category
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSubCategoryActions = (subCategory) => {
    if (!subCategory || !subCategory._id) {
      return null;
    }
    
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowSubCategoryActions(showSubCategoryActions === subCategory._id ? null : subCategory._id)}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {showSubCategoryActions === subCategory._id && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  startEditSubCategory(subCategory);
                  setShowSubCategoryActions(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Sub-category
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubCategoryActions(null);
                  handleDeleteSubCategory(subCategory._id);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Sub-category
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBrandActions = (brand) => {
    if (!brand || !brand._id) {
      return null;
    }
    
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowBrandActions(showBrandActions === brand._id ? null : brand._id)}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {showBrandActions === brand._id && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  startEditBrand(brand);
                  setShowBrandActions(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Brand
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBrandActions(null);
                  handleDeleteBrand(brand._id);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Brand
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCategoryList = () => (
    <div className="mt-4 border rounded-lg divide-y">
      <div className="px-4 py-2 bg-gray-50 rounded-t-lg">
        <h4 className="text-sm font-medium text-gray-700">Manage Categories</h4>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {getAllCategories().map(cat => (
          <div key={cat._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-lg overflow-hidden">
                {cat.thumbnail ? (
                  <img 
                    src={`${baseUrl}${cat.thumbnail.startsWith('/') ? cat.thumbnail : '/' + cat.thumbnail}`}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 m-2 text-gray-400" />
                )}
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">{cat.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => startEditCategory(cat)}
                className="p-1 text-blue-600 hover:text-blue-800"
                title="Edit Category"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCategory(cat._id)}
                className="p-1 text-red-600 hover:text-red-800"
                title="Delete Category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSubCategoryList = () => (
    <div className="mt-4 border rounded-lg divide-y">
      <div className="px-4 py-2 bg-gray-50 rounded-t-lg">
        <h4 className="text-sm font-medium text-gray-700">Manage Sub-categories</h4>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {subCategoriesForCategory.map(sub => (
          <div key={sub._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-lg overflow-hidden">
                {sub.thumbnail ? (
                  <img 
                    src={`${baseUrl}${sub.thumbnail.startsWith('/') ? sub.thumbnail : '/' + sub.thumbnail}`}
                    alt={sub.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 m-2 text-gray-400" />
                )}
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">{sub.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const fullSubCategory = subCategories.find(s => s._id === sub._id);
                  if (fullSubCategory) {
                    startEditSubCategory(fullSubCategory);
                  }
                }}
                className="p-1 text-blue-600 hover:text-blue-800"
                title="Edit Sub-category"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSubCategory(sub._id)}
                className="p-1 text-red-600 hover:text-red-800"
                title="Delete Sub-category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBrandList = () => (
    <div className="mt-4 border rounded-lg divide-y">
      <div className="px-4 py-2 bg-gray-50 rounded-t-lg">
        <h4 className="text-sm font-medium text-gray-700">Manage Brands</h4>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {brandsForSubCategory.map(brand => (
          <div key={brand._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                <Tag className="w-4 h-4 text-gray-500" />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">{brand.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const fullBrand = brands.find(b => b._id === brand._id);
                  if (fullBrand) {
                    startEditBrand(fullBrand);
                  }
                }}
                className="p-1 text-blue-600 hover:text-blue-800"
                title="Edit Brand"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBrand(brand._id)}
                className="p-1 text-red-600 hover:text-red-800"
                title="Delete Brand"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
                      <div className="relative">
                        <select
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            errors.category ? 'border-red-500' : 'border-gray-300'
                          }`}
                          disabled={loading || categoryLoading}
                        >
                          <option value="">Choose a category</option>
                          {getAllCategories().map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                          ))}
                        </select>
                        
                        {formData.category && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            {renderCategoryActions(getCategoryById(formData.category))}
                          </div>
                        )}
                      </div>
                      {errors.category && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.category}
                        </p>
                      )}
                    </div>
                    
                    {renderCategoryList()}
                    
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetCategoryForm();
                          setShowNewCategory(true);
                        }}
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center"
                        disabled={loading || categoryLoading}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Category
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 justify-center">
                      {editingCategory ? (
                        <>
                          <Edit3 className="w-6 h-6 text-blue-600" />
                          <span className="text-lg font-medium text-blue-700">Edit Category</span>
                        </>
                      ) : (
                        <>
                          <FolderPlus className="w-6 h-6 text-green-600" />
                          <span className="text-lg font-medium text-green-700">Create New Category</span>
                        </>
                      )}
                    </div>
                    
                    {categoryErrors.general && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {categoryErrors.general}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category Name *
                      </label>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'category')}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 ${
                          editingCategory 
                            ? 'focus:ring-blue-500 focus:border-blue-500' 
                            : 'focus:ring-green-500 focus:border-green-500'
                        } ${categoryErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Enter category name"
                        disabled={categoryLoading}
                        autoFocus
                      />
                      {categoryErrors.name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {categoryErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Alt Text *
        </label>

        <input
          type="text"
          value={newCategoryAltText}
          onChange={(e) => setNewCategoryAltText(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          placeholder="Example: Hoodie category thumbnail"
          disabled={categoryLoading}
        />

        <p className="text-xs text-gray-500 mt-1">
          Describe the category thumbnail image for SEO & accessibility.
        </p>
                    </div>

                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category Thumbnail *
                        <span className="text-xs text-gray-500 ml-2">(Max 5MB)</span>
                      </label>
                      <div className={`border-2 border-dashed rounded-lg p-4 ${
                        categoryErrors.thumbnail ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}>
                        {newCategoryThumbnailPreview ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">Thumbnail Preview</h4>
                              <button
                                type="button"
                                onClick={removeCategoryThumbnail}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                disabled={categoryLoading}
                              >
                                Remove
                              </button>
                            </div>
                            <img
                              src={newCategoryThumbnailPreview}
                              alt="Category Thumbnail Preview"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ) : editingCategory?.thumbnail ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">Current Thumbnail</h4>
                              <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleCategoryThumbnailUpload}
                                  className="hidden"
                                  disabled={categoryLoading}
                                />
                              </label>
                            </div>
                            <img
                              src={newCategoryThumbnailPreview || `${baseUrl}${editingCategory.thumbnail}`}
                              alt="Current Category Thumbnail"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-10 w-10 text-gray-400" />
                            <div className="mt-2">
                              <label className="cursor-pointer">
                                <span className={`mt-2 px-3 py-1.5 text-white rounded-lg hover:bg-opacity-90 font-medium inline-flex items-center text-sm ${
                                  editingCategory ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                                }`}>
                                  <Upload className="w-3 h-3 mr-1" />
                                  {editingCategory ? 'Upload New Thumbnail' : 'Upload Thumbnail'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleCategoryThumbnailUpload}
                                  className="hidden"
                                  disabled={categoryLoading}
                                />
                              </label>
                              <p className="text-xs text-gray-500 mt-1">
                                PNG, JPG, WebP up to 5MB
                              </p>
                            </div>
                          </div>
                        )}
                        {categoryErrors.thumbnail && (
                          <p className="mt-1 text-sm text-red-600 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {categoryErrors.thumbnail}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={editingCategory ? handleUpdateCategory : handleAddNewCategory}
                        disabled={
                          !newCategoryName.trim() || 
                          (!newCategoryThumbnail && !editingCategory?.thumbnail) || 
                          categoryLoading
                        }
                        className={`flex-1 px-4 py-3 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center ${
                          editingCategory 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {categoryLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {editingCategory ? 'Updating...' : 'Creating...'}
                          </span>
                        ) : (
                          <span className="flex items-center">
                            {editingCategory ? (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Update Category
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create & Continue
                              </>
                            )}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelCategoryAction}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={categoryLoading}
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
                <span className="font-semibold text-blue-600">{getCategoryName()}</span>
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
                      <div className="relative">
                        <select
                          name="subCategory"
                          value={formData.subCategory}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading || !formData.category || subCategoryLoading}
                        >
                          <option value="">No sub-category</option>
                          {subCategoriesForCategory.map(sub => (
                            <option key={sub._id} value={sub._id}>{sub.name}</option>
                          ))}
                        </select>
                        
                        {formData.subCategory && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            {renderSubCategoryActions(getSubCategoryById(formData.subCategory))}
                          </div>
                        )}
                      </div>
                      {!formData.category && (
                        <p className="mt-1 text-xs text-gray-500">
                          Please select a category first
                        </p>
                      )}
                    </div>
                    
                    {formData.category && subCategoriesForCategory.length > 0 && renderSubCategoryList()}
                    
                    {formData.category && (
                      <div className="flex justify-center pt-4 space-x-4">
                        <button
                          type="button"
                          onClick={() => {
                            resetSubCategoryForm();
                            setShowNewSubCategory(true);
                          }}
                          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center"
                          disabled={loading || subCategoryLoading}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Sub-category
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 justify-center">
                      {editingSubCategory ? (
                        <>
                          <Edit3 className="w-6 h-6 text-blue-600" />
                          <span className="text-lg font-medium text-blue-700">
                            Edit Sub-category for: <span className="font-bold">{getCategoryName()}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-6 h-6 text-blue-600" />
                          <span className="text-lg font-medium text-blue-700">
                            New Sub-category for: <span className="font-bold">{getCategoryName()}</span>
                          </span>
                        </>
                      )}
                    </div>
                    
                    {subCategoryErrors.general && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {subCategoryErrors.general}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sub-category Name *
                      </label>
                      <input
                        type="text"
                        value={newSubCategoryName}
                        onChange={(e) => setNewSubCategoryName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'subcategory')}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          subCategoryErrors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter sub-category name"
                        disabled={subCategoryLoading}
                        autoFocus
                      />
                      {subCategoryErrors.name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {subCategoryErrors.name}
                        </p>
                      )}
                    </div>
                    
                    

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Alt Text *
                      </label>

                      <input
                        type="text"
                        value={newSubCategoryAltText}
                        onChange={(e) => setNewSubCategoryAltText(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                        placeholder="Example: Oversized hoodie subcategory thumbnail"
                        disabled={subCategoryLoading}
                      />

                      <p className="text-xs text-gray-500 mt-1">
                        Describe the sub-category thumbnail image.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sub-category Thumbnail *
                        <span className="text-xs text-gray-500 ml-2">(Max 5MB)</span>
                      </label>
                      <div className={`border-2 border-dashed rounded-lg p-4 ${
                        subCategoryErrors.thumbnail ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}>
                        {newSubCategoryThumbnailPreview ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">Thumbnail Preview</h4>
                              <button
                                type="button"
                                onClick={removeSubCategoryThumbnail}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                disabled={subCategoryLoading}
                              >
                                Remove
                              </button>
                            </div>
                            <img
                              src={newSubCategoryThumbnailPreview}
                              alt="Sub-category Thumbnail Preview"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ) : editingSubCategory?.thumbnail ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">Current Thumbnail</h4>
                              <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSubCategoryThumbnailUpload}
                                  className="hidden"
                                  disabled={subCategoryLoading}
                                />
                              </label>
                            </div>
                            <img
                              src={newSubCategoryThumbnailPreview || `${baseUrl}${editingSubCategory.thumbnail}`}
                              alt="Current Sub-category Thumbnail"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-10 w-10 text-gray-400" />
                            <div className="mt-2">
                              <label className="cursor-pointer">
                                <span className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center text-sm">
                                  <Upload className="w-3 h-3 mr-1" />
                                  {editingSubCategory ? 'Upload New Thumbnail' : 'Upload Thumbnail'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSubCategoryThumbnailUpload}
                                  className="hidden"
                                  disabled={subCategoryLoading}
                                />
                              </label>
                              <p className="text-xs text-gray-500 mt-1">
                                PNG, JPG, WebP up to 5MB
                              </p>
                            </div>
                          </div>
                        )}
                        {subCategoryErrors.thumbnail && (
                          <p className="mt-1 text-sm text-red-600 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {subCategoryErrors.thumbnail}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={editingSubCategory ? handleUpdateSubCategory : handleAddNewSubCategory}
                        disabled={
                          !newSubCategoryName.trim() || 
                          (!newSubCategoryThumbnail && !editingSubCategory?.thumbnail) || 
                          !formData.category || 
                          subCategoryLoading
                        }
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {subCategoryLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {editingSubCategory ? 'Updating...' : 'Creating...'}
                          </span>
                        ) : (
                          <span className="flex items-center">
                            {editingSubCategory ? (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Update Sub-category
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create & Continue
                              </>
                            )}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelSubCategoryAction}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={subCategoryLoading}
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
            <div className="text-center py-8">
              <Tag className="mx-auto h-16 w-16 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900">Select Brand</h3>
              <p className="text-gray-600 mt-2">
                {formData.subCategory ? (
                  <>Choose a brand for your product under{' '}
                    <span className="font-semibold text-blue-600">{getSubCategoryName()}</span>
                  </>
                ) : (
                  'Select a sub-category first to see available brands'
                )}
              </p>
            </div>
            
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                {!showNewBrand ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Brand (Optional)
                      </label>
                      <div className="relative">
                        <select
                          name="brand"
                          value={formData.brand}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading || !formData.subCategory || brandsLoading || brandLoading}
                        >
                          <option value="">No brand</option>
                          {brandsForSubCategory.map(brand => (
                            <option key={brand._id} value={brand._id}>{brand.name}</option>
                          ))}
                        </select>
                        
                        {formData.brand && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            {renderBrandActions(getBrandById(formData.brand))}
                          </div>
                        )}
                      </div>
                      {!formData.subCategory && (
                        <p className="mt-1 text-xs text-gray-500">
                          Please select a sub-category first
                        </p>
                      )}
                    </div>
                    
                    {formData.subCategory && brandsForSubCategory.length > 0 && renderBrandList()}
                    
                    {formData.subCategory && (
                      <div className="flex justify-center pt-4 space-x-4">
                        <button
                          type="button"
                          onClick={() => {
                            resetBrandForm();
                            setShowNewBrand(true);
                          }}
                          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center"
                          disabled={loading || brandLoading}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Brand
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 justify-center">
                      {editingBrand ? (
                        <>
                          <Edit3 className="w-6 h-6 text-blue-600" />
                          <span className="text-lg font-medium text-blue-700">
                            Edit Brand for: <span className="font-bold">{getSubCategoryName()}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <Tag className="w-6 h-6 text-blue-600" />
                          <span className="text-lg font-medium text-blue-700">
                            New Brand for: <span className="font-bold">{getSubCategoryName()}</span>
                          </span>
                        </>
                      )}
                    </div>
                    
                    {brandErrors.general && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {brandErrors.general}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, 'brand')}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          brandErrors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter brand name"
                        disabled={brandLoading}
                        autoFocus
                      />
                      {brandErrors.name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {brandErrors.name}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={editingBrand ? handleUpdateBrand : handleAddNewBrand}
                        disabled={
                          !newBrandName.trim() || 
                          !formData.subCategory || 
                          brandLoading
                        }
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {brandLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {editingBrand ? 'Updating...' : 'Creating...'}
                          </span>
                        ) : (
                          <span className="flex items-center">
                            {editingBrand ? (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Update Brand
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create & Continue
                              </>
                            )}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelBrandAction}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={brandLoading}
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

      case 4:
        return (
          <div className="space-y-6">
            {/* Category Summary with Edit Option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Product Details</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-blue-700">{getCategoryName()}</span>
                    {formData.subCategory && (
                      <>
                        <ChevronRight className="w-4 h-4 text-blue-500" />
                        <span className="text-lg font-medium text-blue-600">{getSubCategoryName()}</span>
                      </>
                    )}
                    {formData.brand && (
                      <>
                        <ChevronRight className="w-4 h-4 text-blue-500" />
                        <span className="text-lg font-medium text-blue-600">{getBrandName()}</span>
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
            </div>


{/* Alt Text Field */}
           



           <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Description *
  </label>

  <RichTextEditor
    value={formData.description}
    onChange={(html) => {
      setFormData((prev) => ({ ...prev, description: html }));
      if (errors.description) setErrors((p) => ({ ...p, description: null }));
    }}
    error={errors.description}
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

            {/* Thumbnail Upload */}
           

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
                
                {imagePreviews.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Uploaded Images ({imagePreviews.length}/4)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {imagePreviews.map((preview, index) => (
  <div key={index} className="relative group border rounded-lg p-2">
    
    <img
      src={preview}
      alt={`Preview ${index + 1}`}
      className="w-full h-32 object-cover rounded-lg"
    />

    {/* REMOVE BUTTON */}
    <button
      type="button"
      onClick={() => removeImage(index)}
      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"
    >
      <Trash2 className="w-4 h-4" />
    </button>

    {/* ALT TEXT INPUT */}
    <input
      type="text"
      placeholder="Enter alt text"
      value={images[index]?.altText || ""}
      onChange={(e) => {
        const updated = [...images];
        updated[index].altText = e.target.value;
        setImages(updated);
      }}
      className="mt-2 w-full px-2 py-1 border rounded text-sm"
    />

  </div>
                      ))}

                    </div>
                  </div>
                )}
              </div>
            </div>

              {/* Size Chart Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Chart
                  <span className="text-xs text-gray-500 ml-2">(Optional, max 5MB)</span>
                </label>

                <div className={`border-2 border-dashed rounded-lg p-6 ${
                  errors.sizeChart ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}>

                  {sizeChartPreview ? (
                    <div>

                      <div className="flex justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">
                          Size Chart Preview
                        </h4>

                        <button
                          type="button"
                          onClick={removeSizeChart}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>

                      </div>

                      <img
                        src={sizeChartPreview}
                        alt="Size Chart Preview"
                        className="w-full max-w-md rounded-lg border"
                      />

                    </div>
                  ) : (

                    <div className="text-center">

                      <Upload className="mx-auto h-12 w-12 text-gray-400" />

                      <label className="cursor-pointer">

                        <span className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg inline-flex items-center">
                          Upload Size Chart
                        </span>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSizeChartUpload}
                          className="hidden"
                        />

                      </label>

                    </div>

                  )}

                  {errors.sizeChart && (
                    <p className="text-red-600 text-sm mt-2">{errors.sizeChart}</p>
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
            disabled={loading || categoryLoading || subCategoryLoading || brandLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!isEdit && renderStepIndicator()}

        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          <div className="flex justify-between space-x-4 pt-6 border-t mt-6">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center"
                disabled={loading || categoryLoading || subCategoryLoading || brandLoading}
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
                disabled={loading || categoryLoading || subCategoryLoading || brandLoading}
              >
                Cancel
              </button>
              
              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                  disabled={loading || categoryLoading || subCategoryLoading || brandLoading}
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