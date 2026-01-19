// DropProductDetailsPage.jsx - Individual product page
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  getDropproductById,
  selectCurrentProduct,
  selectLoading,
  clearCurrentProduct,
} from '../redux/slices/dropproducts.js';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Star,
  ShoppingBag,
  Truck,
  Shield,
  RotateCw,
  Check,
  ArrowLeft,
  Minus,
  Plus,
  Instagram,
  Facebook,
  Twitter,
  Package,
} from 'lucide-react';

const DropProductDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const product = useSelector(selectCurrentProduct);
  const loading = useSelector(selectLoading);
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const mainImageRef = useRef(null);
  const thumbnailContainerRef = useRef(null);

  const IMAGE_URL = import.meta.env.VITE_IMAGE_URL || "https://narifighter.online/backend";

  useEffect(() => {
    if (id) {
      dispatch(getDropproductById(id));
    }

    return () => {
      dispatch(clearCurrentProduct());
    };
  }, [id, dispatch]);

  // Auto-rotate images
  useEffect(() => {
    if (!product?.images || product.images.length <= 1) return;

    const interval = setInterval(() => {
      nextImage();
    }, 5000);

    return () => clearInterval(interval);
  }, [product?.images, selectedImageIndex]);

  const scrollToImage = (index) => {
    setSelectedImageIndex(index);
    setImageLoading(true);
    
    // Scroll thumbnails container to show the selected thumbnail
    if (thumbnailContainerRef.current) {
      const thumbnailWidth = 80; // thumbnail width + gap
      const containerWidth = thumbnailContainerRef.current.clientWidth;
      const thumbnailsCount = product?.images?.length || 0;
      const maxScroll = (thumbnailsCount * thumbnailWidth) - containerWidth;
      const scrollPosition = index * thumbnailWidth - containerWidth / 2 + thumbnailWidth / 2;
      
      thumbnailContainerRef.current.scrollTo({
        left: Math.max(0, Math.min(maxScroll, scrollPosition)),
        behavior: 'smooth'
      });
    }
  };

  const nextImage = () => {
    const nextIndex = (selectedImageIndex + 1) % (product?.images?.length || 1);
    scrollToImage(nextIndex);
  };

  const prevImage = () => {
    const prevIndex = (selectedImageIndex - 1 + (product?.images?.length || 1)) % (product?.images?.length || 1);
    scrollToImage(prevIndex);
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= (product?.stock || 0)) {
      setQuantity(newQuantity);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const calculateDiscount = (original, current) => {
    if (original > current) {
      const discount = ((original - current) / original) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  const handleAddToCart = () => {
    // Add to cart logic here
    alert(`Added ${quantity} ${product?.name} to cart!`);
  };

  const handleShare = (platform) => {
    const shareUrl = window.location.href;
    const text = `Check out ${product?.name} - ${formatPrice(product?.price || 0)}`;
    
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'instagram':
        // Instagram doesn't support direct sharing via web
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard! Paste it in Instagram.');
        break;
      default:
        if (navigator.share) {
          navigator.share({
            title: product?.name,
            text: text,
            url: shareUrl,
          });
        } else {
          navigator.clipboard.writeText(shareUrl);
          alert('Link copied to clipboard!');
        }
    }
    setShowShareOptions(false);
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  const discount = calculateDiscount(product.originalPrice || product.price * 1.2, product.price);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Back Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Products
        </button>
      </div>

      {/* Product Details Container */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16">
          {/* Left Column - Images */}
          <div className="space-y-6">
            {/* Main Image with Horizontal Navigation */}
            <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden group">
              {/* Main Image Container */}
              <div className="relative h-[500px] md:h-[600px] overflow-hidden">
                {product.images?.map((image, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === selectedImageIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {imageLoading && (
                      <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
                    )}
                    <img
                      ref={mainImageRef}
                      src={`${IMAGE_URL}${image}`}
                      alt={`${product.name} - ${index + 1}`}
                      className={`w-full h-full object-contain p-4 transition-transform duration-700 ${
                        imageLoading ? 'opacity-0' : 'opacity-100'
                      }`}
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                  </div>
                ))}
                
                {/* Navigation Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl transition-all hover:scale-110"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl transition-all hover:scale-110"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Image Counter */}
                <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full">
                  {selectedImageIndex + 1} / {product.images?.length}
                </div>

                {/* Discount Badge */}
                {discount > 0 && (
                  <div className="absolute top-6 left-6 px-4 py-2 bg-red-500 text-white font-bold rounded-lg shadow-lg">
                    -{discount}%
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Strip - Horizontal Scroll */}
            <div className="relative">
              <div
                ref={thumbnailContainerRef}
                className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {product.images?.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => scrollToImage(index)}
                    className={`flex-none w-20 h-20 rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                      index === selectedImageIndex
                        ? 'border-blue-500 ring-4 ring-blue-100 scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={`${IMAGE_URL}${image}`}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              
              {/* Thumbnail Scroll Arrows */}
              {product.images?.length > 5 && (
                <>
                  <button
                    onClick={() => {
                      if (thumbnailContainerRef.current) {
                        thumbnailContainerRef.current.scrollBy({ left: -100, behavior: 'smooth' });
                      }
                    }}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2 p-2 bg-white rounded-full shadow-lg hover:shadow-xl"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (thumbnailContainerRef.current) {
                        thumbnailContainerRef.current.scrollBy({ left: 100, behavior: 'smooth' });
                      }
                    }}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-2 p-2 bg-white rounded-full shadow-lg hover:shadow-xl"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Product Info */}
          <div className="space-y-8">
            {/* Product Header */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-4 py-1.5 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                  {product.category}
                </span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`p-2.5 rounded-full transition-all hover:scale-110 ${
                      isFavorite
                        ? 'bg-red-50 text-red-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowShareOptions(!showShareOptions)}
                      className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all hover:scale-110"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    
                    {/* Share Dropdown */}
                    {showShareOptions && (
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border py-2 z-50 min-w-[200px]">
                        <button
                          onClick={() => handleShare('facebook')}
                          className="flex items-center w-full px-4 py-3 hover:bg-blue-50 text-gray-700"
                        >
                          <Facebook className="w-5 h-5 mr-3 text-blue-600" />
                          Share on Facebook
                        </button>
                        <button
                          onClick={() => handleShare('twitter')}
                          className="flex items-center w-full px-4 py-3 hover:bg-blue-50 text-gray-700"
                        >
                          <Twitter className="w-5 h-5 mr-3 text-blue-500" />
                          Share on Twitter
                        </button>
                        <button
                          onClick={() => handleShare('instagram')}
                          className="flex items-center w-full px-4 py-3 hover:bg-pink-50 text-gray-700"
                        >
                          <Instagram className="w-5 h-5 mr-3 text-pink-600" />
                          Share on Instagram
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                {product.name}
              </h1>
              
              <div className="flex items-center space-x-6 mb-6">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= 4.5 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-3 text-gray-600 font-medium">4.5 (128 reviews)</span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <span className={`font-bold text-lg ${
                  product.stock > 10 ? 'text-green-600' :
                  product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-bold text-blue-600 mr-4">
                  {formatPrice(product.price)}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-2xl text-gray-400 line-through mr-4">
                      {formatPrice(product.originalPrice || product.price * 1.2)}
                    </span>
                    <span className="px-3 py-1 bg-red-100 text-red-600 font-bold rounded-full">
                      Save {discount}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Product Description */}
            <div className="prose max-w-none border-t pt-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Product Details</h3>
              <p className="text-gray-700 leading-relaxed text-lg mb-8">
                {product.description}
              </p>
              
              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>Premium quality materials</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>30-day money-back guarantee</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>Free lifetime updates</span>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-4 border-t pt-8">
              <h3 className="text-xl font-semibold text-gray-900">Quantity</h3>
              <div className="flex items-center space-x-6">
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="px-5 py-3 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="px-8 py-3 text-xl font-bold border-x border-gray-300">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stock}
                    className="px-5 py-3 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <span className="text-gray-600">
                  {product.stock} units available
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 border-t pt-8">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center ${
                  product.stock === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-xl active:scale-95'
                }`}
              >
                <ShoppingBag className="w-6 h-6 mr-3" />
                {product.stock === 0 ? 'Out of Stock' : `Add to Cart - ${formatPrice(product.price * quantity)}`}
              </button>
              
              <button
                disabled={product.stock === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  product.stock === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-xl active:scale-95'
                }`}
              >
                {product.stock === 0 ? 'Unavailable' : `Buy Now - ${formatPrice(product.price * quantity)}`}
              </button>
            </div>

            {/* Product Features */}
            <div className="grid grid-cols-2 gap-6 pt-8 border-t">
              <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Free Shipping</p>
                  <p className="text-sm text-gray-600">Delivery in 3-5 days</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-xl">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">2-Year Warranty</p>
                  <p className="text-sm text-gray-600">Free repairs included</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-purple-50 rounded-xl">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <RotateCw className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Easy Returns</p>
                  <p className="text-sm text-gray-600">30-day return policy</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-amber-50 rounded-xl">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">In Stock</p>
                  <p className="text-sm text-gray-600">Ready to ship</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        <div className="mt-20 pt-12 border-t">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">You Might Also Like</h2>
          
          <div className="relative">
            <div className="flex overflow-x-auto space-x-6 pb-6 scrollbar-hide">
              {/* Add related products here */}
              <div className="flex-none w-64">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="h-40 bg-gray-200 animate-pulse"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute right-0 top-0 transform -translate-y-1/2">
              <Link
                to="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg transition-all"
              >
                Explore More Products
                <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropProductDetailsPage;