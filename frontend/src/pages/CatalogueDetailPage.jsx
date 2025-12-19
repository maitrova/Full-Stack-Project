// src/pages/CatalogueDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Download, 
  Share2, 
  Heart, 
  Palette,
  Type,
  Image as ImageIcon,
  Check,
  Copy,
  Eye,
  Tag,
  Sparkles,
  Package,
  ChevronRight,
  Star
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

console.log("API_URL:", API_URL);

export default function CatalogueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        const res = await fetch(`${API_URL}/savedata/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load design");
        setDesign(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDesign();
  }, [id]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse absolute -top-2 -right-2" />
        </div>
        <p className="mt-6 text-gray-700 font-medium">Loading design details...</p>
        <p className="text-sm text-gray-400 mt-1">Preparing an amazing view</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-2xl text-white">!</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Design Not Found</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate("/catalogue")}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all font-medium"
          >
            Browse Catalogue
          </button>
        </div>
      </div>
    </div>
  );

  if (!design) return null;

  const views = design.views || [];
  const stats = {
    totalTextLayers: views.reduce((acc, view) => acc + (view.textLayers?.length || 0), 0),
    totalImageLayers: views.reduce((acc, view) => acc + (view.designLayers?.length || 0), 0),
    totalViews: views.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">Back to Catalogue</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span className="font-medium">Share</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2 rounded-lg ${isFavorite ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Design ID: {design._id.slice(-8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-current" />
                    <span className="text-sm font-medium text-gray-700">Premium Design</span>
                  </div>
                </div>

                <div className="relative h-[500px] bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden">
                  {views[activeView]?.previewImage ? (
                    <img
                      src={views[activeView].previewImage}
                      alt={views[activeView].code}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="flex items-center justify-center h-full">
                            <div class="text-center">
                              <ImageIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
                              <p class="text-gray-400 font-medium">Preview unavailable</p>
                            </div>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No preview available</p>
                      </div>
                    </div>
                  )}

                  {/* Navigation Arrows */}
                  {views.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveView(prev => (prev - 1 + views.length) % views.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700 rotate-180" />
                      </button>
                      <button
                        onClick={() => setActiveView(prev => (prev + 1) % views.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>

                {/* View Thumbnails */}
                {views.length > 1 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">All Views ({views.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {views.map((view, index) => (
                        <button
                          key={view.code}
                          onClick={() => setActiveView(index)}
                          className={`relative rounded-lg border overflow-hidden transition-all ${activeView === index ? 'ring-2 ring-indigo-500 ring-offset-2' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="aspect-square bg-gray-50">
                            {view.previewImage ? (
                              <img
                                src={view.previewImage}
                                alt={view.code}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Eye className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded truncate">
                            {view.code.toUpperCase()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button className="h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-3 group">
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
                <span className="text-indigo-200">₹{design.salePrice || 0}</span>
              </button>
              
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Product Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {design.title || design.productName}
                </h1>
                <div className="flex items-center gap-2 text-gray-500">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">{design.productName}</span>
                </div>
              </div>

              {/* Color Display */}
              {design.productColor && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Product Color</span>
                    <Palette className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg border-2 border-white shadow-lg"
                      style={{ backgroundColor: design.productColor }}
                    />
                    <span className="text-gray-600">{design.productColor}</span>
                  </div>
                </div>
              )}

              {/* Price Display */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Price</span>
                  <Tag className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    ₹{design.salePrice || 0}
                  </span>
                  {design.product?.basePrice && design.salePrice < design.product.basePrice && (
                    <span className="text-gray-400 line-through">₹{design.product.basePrice}</span>
                  )}
                </div>
              </div>

              {/* Design Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Design Statistics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Type className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm text-gray-600">Text Layers</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalTextLayers}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-600">Image Layers</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalImageLayers}</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Total Views</div>
                      <div className="text-xl font-bold text-gray-900">{stats.totalViews}</div>
                    </div>
                    <Eye className="w-8 h-8 text-indigo-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {/* <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-700 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                  <span className="font-medium text-gray-700">Customize Design</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                  <span className="font-medium text-gray-700">Request Modifications</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                  <span className="font-medium text-gray-700">View Similar Designs</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                </button>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}