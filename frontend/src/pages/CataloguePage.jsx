// src/pages/CataloguePage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Loader2, 
  Grid3x3, 
  Filter,
  Search,
  TrendingUp,
  Sparkles,
  Eye
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

export default function CataloguePage() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDesigns, setFilteredDesigns] = useState([]);

  useEffect(() => {
    const fetchCatalogue = async () => {
      try {
        const res = await fetch(`${API_URL}/savedata/catalogue`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load catalogue");
        setDesigns(data);
        setFilteredDesigns(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogue();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredDesigns(designs);
    } else {
      const filtered = designs.filter(d => 
        d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDesigns(filtered);
    }
  }, [searchTerm, designs]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Loading catalogue...</p>
        <p className="text-sm text-gray-400 mt-1">Fetching the latest designs</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Catalogue</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Grid3x3 className="w-6 h-6 text-indigo-600" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Design Catalogue
                </h1>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  {filteredDesigns.length} designs
                </span>
              </div>
              <p className="text-gray-500">Browse and explore our collection of premium designs</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search designs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <button className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                <Filter className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Catalogue Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No designs found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search terms</p>
            <button 
              onClick={() => setSearchTerm("")}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDesigns.map((d) => (
              <div 
                key={d._id}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
              >
                <Link to={`/catalogue/${d._id}`} className="block">
                  {/* Main Preview */}
                  <div className="relative h-64 bg-gradient-to-br from-gray-50 to-white overflow-hidden">
                    {d.previewImage ? (
                      <>
                        <img
                          src={d.previewImage}
                          alt={d.title || d.productName}
                          className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = `
                              <div class="flex items-center justify-center h-full">
                                <div class="text-center">
                                  <Sparkles class="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                  <p class="text-sm text-gray-400">Preview unavailable</p>
                                </div>
                              </div>
                            `;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">No preview</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Popular Badge */}
                    {d.salePrice > 5000 && (
                      <div className="absolute top-3 right-3">
                        <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Popular
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Side Previews */}
                  {d.views && d.views.some(v => v.previewImage) && (
                    <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 font-medium mb-2">Views</p>
                      <div className="grid grid-cols-4 gap-2">
                        {d.views.slice(0, 4).map((v) =>
                          v.previewImage ? (
                            <div key={v.code} className="relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden group-hover:border-gray-300 transition-colors">
                              <img
                                src={v.previewImage}
                                alt={v.code}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-5">
                    <div className="mb-3">
                      <h2 className="font-bold text-gray-900 line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
                        {d.title || d.productName}
                      </h2>
                      <p className="text-sm text-gray-500 line-clamp-1">{d.productName}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          ₹{d.salePrice || d.product?.basePrice || 0}
                        </span>
                        {d.product?.basePrice && d.salePrice < d.product.basePrice && (
                          <span className="ml-2 text-sm text-gray-400 line-through">
                            ₹{d.product.basePrice}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-indigo-600 font-medium text-sm group-hover:gap-2 transition-all">
                        View Details
                        <Eye className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Footer Stats */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Showing <span className="font-semibold text-gray-700">{filteredDesigns.length}</span> of{" "}
              <span className="font-semibold text-gray-700">{designs.length}</span> designs
            </p>
            <p className="text-gray-400 text-xs mt-2">
              All designs are curated and quality-checked
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}