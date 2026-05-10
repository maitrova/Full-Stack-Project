import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createDropproduct,
  updateDropproduct,
  deleteDropproduct,
  getAllDropproducts,
  getDropproductById,
  clearCurrentProduct,
  clearError,
  resetOperationState,
  selectAllProducts,
  selectCurrentProduct,
  selectError,
  selectLoading,
  selectSuccess,
  selectTotalProducts,
} from '../redux/slices/dropproducts.js';
import RichTextEditor from './RichTextEditor.jsx';
import { AlertCircle, CheckCircle, Edit, Eye, Loader2, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { buildImageUrl } from '../utils/responsiveImage.js';

const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const emptyVariant = { size: '', price: '', stock: '', sku: '' };

const imageUrl = (path) => buildImageUrl(path);

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const offerActive = (product) => {
  const mrp = Number(product?.minPrice || 0);
  const sale = Number(product?.salePrice || 0);
  if (!(mrp > 0) || !(sale > 0) || !(sale < mrp)) return false;
  const now = new Date();
  const start = product?.saleStartAt ? new Date(product.saleStartAt) : null;
  const end = product?.saleEndAt ? new Date(product.saleEndAt) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

export default function DropproductAdmin() {
  const dispatch = useDispatch();
  const products = useSelector(selectAllProducts);
  const currentProduct = useSelector(selectCurrentProduct);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const success = useSelector(selectSuccess);
  const totalProducts = useSelector(selectTotalProducts);

  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({ name: '', description: '', salePrice: '', saleStartAt: '', saleEndAt: '', isActive: true, bestSeller: false, newArrival: false });
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [variants, setVariants] = useState([{ ...emptyVariant }]);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [sizeChart, setSizeChart] = useState(null);
  const [sizeChartPreview, setSizeChartPreview] = useState(null);
  const [removeSizeChart, setRemoveSizeChart] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => { dispatch(getAllDropproducts()); }, [dispatch]);
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => dispatch(resetOperationState()), 3000);
    return () => clearTimeout(t);
  }, [dispatch, success]);
  useEffect(() => { if (!open) resetForm(); }, [open]);
  useEffect(() => {
    if (!currentProduct || !editMode) return;
    setForm({
      name: currentProduct.name || '',
      description: currentProduct.description || '',
      salePrice: currentProduct.salePrice ?? '',
      saleStartAt: currentProduct.saleStartAt ? new Date(currentProduct.saleStartAt).toISOString().slice(0, 16) : '',
      saleEndAt: currentProduct.saleEndAt ? new Date(currentProduct.saleEndAt).toISOString().slice(0, 16) : '',
      isActive: currentProduct.isActive ?? true,
      bestSeller: currentProduct.bestSeller || false,
      newArrival: currentProduct.newArrival || false,
    });
    setCategory(currentProduct.category || '');
    setNewCategory('');
    setSubCategory(currentProduct.subCategory || '');
    setNewSubCategory('');
    setVariants(currentProduct.variants?.length ? currentProduct.variants.map((v) => ({ size: v.size || '', price: String(v.price ?? ''), stock: String(v.stock ?? ''), sku: v.sku || '' })) : [{ ...emptyVariant }]);
    setExistingImages(currentProduct.images || []);
    setImages([]);
    setImagePreviews([]);
    setThumbnail(null);
    setThumbnailPreview(imageUrl(currentProduct.thumbnail));
    setRemoveThumbnail(false);
    setSizeChart(null);
    setSizeChartPreview(imageUrl(currentProduct.sizeChart));
    setRemoveSizeChart(false);
    setErrors({});
  }, [currentProduct, editMode]);

  const resetForm = () => {
    setForm({ name: '', description: '', salePrice: '', saleStartAt: '', saleEndAt: '', isActive: true, bestSeller: false, newArrival: false });
    setCategory(''); setNewCategory(''); setSubCategory(''); setNewSubCategory('');
    setVariants([{ ...emptyVariant }]);
    setImages([]); setImagePreviews([]); setExistingImages([]);
    setThumbnail(null); setThumbnailPreview(null); setRemoveThumbnail(false);
    setSizeChart(null); setSizeChartPreview(null); setRemoveSizeChart(false);
    setErrors({}); setEditMode(false); dispatch(clearCurrentProduct());
  };

  const categories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const allCategories = categories.filter((item) => item !== 'all');
  const allSubCategories = [...new Set(products.map((p) => p.subCategory).filter(Boolean))];
  const filtered = products.filter((p) => {
    const text = `${p.name || ''} ${p.description || ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (categoryFilter === 'all' || p.category === categoryFilter);
  });

  const clearField = (field) => setErrors((prev) => ({ ...prev, [field]: null, general: null }));
  const onInput = (e) => { const { name, value, type, checked } = e.target; setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); clearField(name); };
  const onVariant = (index, field, value) => { setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))); clearField('variants'); };
  const addVariant = () => variants.length < sizeOptions.length && setVariants((prev) => [...prev, { ...emptyVariant }]);
  const dropVariant = (index) => variants.length > 1 && setVariants((prev) => prev.filter((_, i) => i !== index));

  const addFiles = (event, type) => {
    const file = type === 'single' ? event.target.files?.[0] : null;
    const files = type === 'multi' ? Array.from(event.target.files || []) : file ? [file] : [];
    const valid = files.filter((item) => item.type.startsWith('image/'));
    if (!valid.length) return;
    if (type === 'multi') {
      if (valid.length + images.length + existingImages.length > 6) return setErrors((prev) => ({ ...prev, images: 'Maximum 6 images allowed' }));
      setImages((prev) => [...prev, ...valid]);
      setImagePreviews((prev) => [...prev, ...valid.map((item) => URL.createObjectURL(item))]);
      clearField('images');
      return;
    }
    if (type === 'thumbnail') { setThumbnail(valid[0]); setThumbnailPreview(URL.createObjectURL(valid[0])); setRemoveThumbnail(false); clearField('thumbnail'); }
    if (type === 'sizeChart') { setSizeChart(valid[0]); setSizeChartPreview(URL.createObjectURL(valid[0])); setRemoveSizeChart(false); clearField('sizeChart'); }
  };

  const validate = () => {
    const next = {};
    const finalCategory = (newCategory || category).trim();
    const finalSub = (newSubCategory || subCategory).trim();
    const plainDescription = String(form.description || '').replace(/<(.|\n)*?>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!form.name.trim()) next.name = 'Product name is required';
    if (!plainDescription) next.description = 'Description is required';
    if (!finalCategory) next.category = 'Category is required';
    if (!finalSub) next.subCategory = 'Sub-category is required';
    const minVariantPrice = Math.min(...variants.map((v) => Number(v.price)).filter((price) => Number.isFinite(price) && price > 0));
    if (String(form.salePrice).trim() !== '') {
      const sale = Number(form.salePrice);
      if (!Number.isFinite(sale) || sale <= 0) next.salePrice = 'Offer price must be greater than 0';
      else if (Number.isFinite(minVariantPrice) && sale >= minVariantPrice) next.salePrice = 'Offer price must be lower than the lowest MRP';
    }
    if (form.saleStartAt && form.saleEndAt && new Date(form.saleStartAt) >= new Date(form.saleEndAt)) next.saleEndAt = 'Offer end date must be after start date';
    const variantErrors = []; const sizes = new Set();
    variants.forEach((v, i) => {
      const size = String(v.size || '').trim().toUpperCase();
      if (!size) variantErrors.push(`Size is required for variant ${i + 1}`); else if (sizes.has(size)) variantErrors.push(`Duplicate size "${size}" found`); else sizes.add(size);
      if (!Number.isFinite(Number(v.price)) || Number(v.price) <= 0) variantErrors.push(`Valid price is required for size ${size || i + 1}`);
      if (!Number.isFinite(Number(v.stock)) || Number(v.stock) < 0) variantErrors.push(`Valid stock is required for size ${size || i + 1}`);
    });
    if (variantErrors.length) next.variants = variantErrors;
    if (!editMode && existingImages.length + images.length === 0) next.images = 'At least one image is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openCreate = () => { dispatch(clearError()); setEditMode(false); setOpen(true); };
  const openEdit = async (id) => { dispatch(clearError()); await dispatch(getDropproductById(id)).unwrap(); setEditMode(true); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      category: (newCategory || category).trim(),
      subCategory: (newSubCategory || subCategory).trim(),
      images,
      thumbnail: thumbnail || null,
      sizeChart: sizeChart || null,
      removeThumbnail,
      removeSizeChart,
      variants: variants.map((v) => ({ size: v.size.toUpperCase(), price: Number(v.price), stock: Number(v.stock), sku: v.sku || `SKU-${form.name.substring(0, 3).toUpperCase()}-${v.size.toUpperCase()}` })),
    };
    try {
      if (editMode && currentProduct?._id) await dispatch(updateDropproduct({ id: currentProduct._id, productData: payload })).unwrap();
      else await dispatch(createDropproduct(payload)).unwrap();
      setOpen(false);
      resetForm();
    } catch (saveError) {
      setErrors({ general: saveError?.message || saveError?.payload || 'Failed to save drop product' });
      dispatch(clearError());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Drop Products</h1>
          <p className="text-gray-600 mt-2">Bring drop products closer to the readymade product workflow.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5 mr-2" />Add Drop Product</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Total Products</p><p className="text-2xl font-bold">{totalProducts}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">In Stock</p><p className="text-2xl font-bold text-green-600">{products.filter((p) => Number(p.totalStock || 0) > 0).length}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Out of Stock</p><p className="text-2xl font-bold text-red-600">{products.filter((p) => Number(p.totalStock || 0) === 0).length}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Categories</p><p className="text-2xl font-bold text-purple-600">{allCategories.length}</p></div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col md:flex-row gap-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drop products..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          {categories.map((item) => <option key={item} value={item}>{item === 'all' ? 'All Categories' : item}</option>)}
        </select>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center"><AlertCircle className="w-5 h-5 text-red-500 mr-3" /><span className="text-red-700">{error}</span><button onClick={() => dispatch(clearError())} className="ml-auto text-red-500"><X className="w-5 h-5" /></button></div>}
      {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-3" /><span className="text-green-700">{editMode ? 'Drop product updated successfully.' : 'Drop product created successfully.'}</span></div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((product) => {
          const active = offerActive(product);
          return <div key={product._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="relative h-52 bg-gray-100">{imageUrl(product.thumbnail || product.images?.[0]) ? <img src={imageUrl(product.thumbnail || product.images?.[0])} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Eye className="w-10 h-10" /></div>}
              <div className="absolute top-3 left-3 flex gap-2">{product.newArrival && <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold">New</span>}{product.bestSeller && <span className="px-2 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold">Best</span>}</div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2"><h3 className="font-semibold line-clamp-2">{product.name}</h3><div className="text-right"><div className="font-bold text-blue-600">{money(active ? product.salePrice : product.minPrice)}</div>{active && <div className="text-xs text-gray-400 line-through">{money(product.minPrice)}</div>}</div></div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{String(product.description || '').replace(/<(.|\n)*?>/g, '').trim() || 'No description'}</p>
              <div className="text-sm space-y-1 mb-4"><div><span className="text-gray-500">Category:</span> <span className="font-medium">{product.category || 'N/A'}</span></div><div><span className="text-gray-500">Sub-category:</span> <span className="font-medium">{product.subCategory || 'N/A'}</span></div><div><span className="text-gray-500">Sizes:</span> <span className="font-medium">{product.variants?.map((v) => v.size).join(', ') || 'N/A'}</span></div></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">{product.totalStock || 0} in stock</span><div className="flex gap-2"><button onClick={() => openEdit(product._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit className="w-4 h-4" /></button><button onClick={() => window.confirm('Delete this drop product?') && dispatch(deleteDropproduct(product._id))} className="p-2 text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4" /></button></div></div>
            </div>
          </div>;
        })}
      </div>

      {filtered.length === 0 && <div className="text-center py-12"><div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center"><Eye className="w-12 h-12 text-gray-400" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">No drop products found</h3><button onClick={openCreate} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5 mr-2" />Add Drop Product</button></div>}

      {open && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between"><h2 className="text-2xl font-bold text-gray-900">{editMode ? 'Edit Drop Product' : 'Add Drop Product'}</h2><button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div>
        <form onSubmit={save} className="p-6 space-y-6">
          {errors.general && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.general}</div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label><input name="name" value={form.name} onChange={onInput} className={`w-full px-4 py-3 border rounded-lg ${errors.name ? 'border-red-500' : 'border-gray-300'}`} placeholder="Enter product name" />{errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Category *</label><select value={category} onChange={(e) => { setCategory(e.target.value); setNewCategory(''); clearField('category'); }} className={`w-full px-4 py-3 border rounded-lg ${errors.category ? 'border-red-500' : 'border-gray-300'}`}><option value="">Select existing category</option>{allCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={newCategory} onChange={(e) => { setNewCategory(e.target.value); setCategory(''); clearField('category'); }} className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Or create a new category" />{errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Sub-category *</label><select value={subCategory} onChange={(e) => { setSubCategory(e.target.value); setNewSubCategory(''); clearField('subCategory'); }} className={`w-full px-4 py-3 border rounded-lg ${errors.subCategory ? 'border-red-500' : 'border-gray-300'}`}><option value="">Select existing sub-category</option>{allSubCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={newSubCategory} onChange={(e) => { setNewSubCategory(e.target.value); setSubCategory(''); clearField('subCategory'); }} className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Or create a new sub-category" />{errors.subCategory && <p className="mt-1 text-sm text-red-600">{errors.subCategory}</p>}</div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Description *</label><RichTextEditor value={form.description} onChange={(html) => { setForm((prev) => ({ ...prev, description: html })); clearField('description'); }} error={errors.description} />{errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-6"><div><label className="block text-sm font-medium text-gray-700 mb-2">Offer Price (Rs.)</label><input type="number" name="salePrice" value={form.salePrice} onChange={onInput} min="0" step="0.01" className={`w-full px-4 py-3 border rounded-lg ${errors.salePrice ? 'border-red-500' : 'border-gray-300'}`} placeholder="Optional offer price" />{errors.salePrice && <p className="mt-1 text-sm text-red-600">{errors.salePrice}</p>}</div><div><label className="block text-sm font-medium text-gray-700 mb-2">Offer Start</label><input type="datetime-local" name="saleStartAt" value={form.saleStartAt} onChange={onInput} className="w-full px-4 py-3 border border-gray-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Offer End</label><input type="datetime-local" name="saleEndAt" value={form.saleEndAt} onChange={onInput} className={`w-full px-4 py-3 border rounded-lg ${errors.saleEndAt ? 'border-red-500' : 'border-gray-300'}`} />{errors.saleEndAt && <p className="mt-1 text-sm text-red-600">{errors.saleEndAt}</p>}</div></div>
          <div className="border rounded-lg p-6"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">Size-wise Pricing and Stock *</h3><button type="button" onClick={addVariant} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300" disabled={variants.length >= sizeOptions.length}><Plus className="w-4 h-4 inline mr-1" />Add Size</button></div>{errors.variants && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{Array.isArray(errors.variants) ? errors.variants.join(' | ') : errors.variants}</div>}<div className="space-y-4">{variants.map((variant, index) => <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-4 border border-gray-200 rounded-lg"><div><label className="block text-sm font-medium text-gray-700 mb-2">Size *</label><select value={variant.size} onChange={(e) => onVariant(index, 'size', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select Size</option>{sizeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Price (Rs.) *</label><input type="number" value={variant.price} onChange={(e) => onVariant(index, 'price', e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Stock *</label><input type="number" value={variant.stock} onChange={(e) => onVariant(index, 'stock', e.target.value)} min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">SKU (Optional)</label><input type="text" value={variant.sku} onChange={(e) => onVariant(index, 'sku', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div><div className="flex justify-end"><button type="button" onClick={() => dropVariant(index)} disabled={variants.length === 1} className="p-2 text-red-600 disabled:text-gray-400"><Trash2 className="w-5 h-5" /></button></div></div>)}</div></div>
          <div className={`border-2 border-dashed rounded-lg p-6 ${errors.images ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}><div className="text-center"><Upload className="mx-auto h-12 w-12 text-gray-400" /><label className="cursor-pointer"><span className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg inline-flex items-center"><Upload className="w-4 h-4 mr-2" />Upload Images</span><input type="file" multiple accept="image/*" onChange={(e) => addFiles(e, 'multi')} className="hidden" /></label><p className="text-xs text-gray-500 mt-2">Maximum 6 images. Uploading new images replaces the current gallery in edit mode.</p></div>{errors.images && <p className="mt-2 text-sm text-red-600 text-center">{errors.images}</p>}{(existingImages.length > 0 || imagePreviews.length > 0) && <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">{existingImages.map((item, index) => <img key={`existing-${index}`} src={imageUrl(item)} alt={`Existing ${index + 1}`} className="w-full h-32 object-cover rounded-lg border" />)}{imagePreviews.map((preview, index) => <div key={`new-${index}`} className="relative group"><img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg border" /><button type="button" onClick={() => { setImages((prev) => prev.filter((_, i) => i !== index)); setImagePreviews((prev) => prev.filter((_, i) => i !== index)); clearField('images'); }} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button></div>)}</div>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">{thumbnailPreview ? <div><div className="flex justify-between mb-3"><h4 className="text-sm font-medium text-gray-700">Thumbnail Preview</h4><button type="button" onClick={() => { setThumbnail(null); setThumbnailPreview(null); setRemoveThumbnail(editMode); clearField('thumbnail'); }} className="text-red-600 text-sm font-medium">Remove</button></div><img src={thumbnailPreview} alt="Thumbnail preview" className="w-full max-w-xs rounded-lg border" /></div> : <div className="text-center"><label className="cursor-pointer"><span className="px-4 py-2 bg-indigo-600 text-white rounded-lg inline-flex items-center">Upload Thumbnail</span><input type="file" accept="image/*" onChange={(e) => addFiles(e, 'thumbnail')} className="hidden" /></label></div>}</div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">{sizeChartPreview ? <div><div className="flex justify-between mb-3"><h4 className="text-sm font-medium text-gray-700">Size Chart Preview</h4><button type="button" onClick={() => { setSizeChart(null); setSizeChartPreview(null); setRemoveSizeChart(editMode); clearField('sizeChart'); }} className="text-red-600 text-sm font-medium">Remove</button></div><img src={sizeChartPreview} alt="Size chart preview" className="w-full max-w-xs rounded-lg border" /></div> : <div className="text-center"><label className="cursor-pointer"><span className="px-4 py-2 bg-indigo-600 text-white rounded-lg inline-flex items-center">Upload Size Chart</span><input type="file" accept="image/*" onChange={(e) => addFiles(e, 'sizeChart')} className="hidden" /></label></div>}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><label className="flex items-center"><input type="checkbox" name="isActive" checked={form.isActive} onChange={onInput} className="h-4 w-4 text-blue-600 rounded" /><span className="ml-2 text-sm text-gray-700">Active Product</span></label><label className="flex items-center"><input type="checkbox" name="newArrival" checked={form.newArrival} onChange={onInput} className="h-4 w-4 text-green-600 rounded" /><span className="ml-2 text-sm text-gray-700">Mark as New Arrival</span></label><label className="flex items-center"><input type="checkbox" name="bestSeller" checked={form.bestSeller} onChange={onInput} className="h-4 w-4 text-amber-600 rounded" /><span className="ml-2 text-sm text-gray-700">Mark as Best Seller</span></label></div>
          <div className="flex justify-end space-x-3 pt-6 border-t"><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" disabled={loading} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving...</> : <><Save className="w-5 h-5 mr-2" />{editMode ? 'Update Product' : 'Create Product'}</>}</button></div>
        </form>
      </div></div>}
    </div>
  );
}
