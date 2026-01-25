// components/admin/Designs.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Palette, Eye, Edit2, EyeOff, Trash2, Upload, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  listCatalogueDesigns,
  updateDesignDetails,
  deleteDesign
} from '../../redux/slices/Designslice.js';

const Designs = ({ onPublishDesign, onEditDesign }) => {
  const dispatch = useDispatch();
  const {
    catalogueDesigns,
    loading,
    pagination
  } = useSelector((state) => state.designs);

  const [designSearchTerm, setDesignSearchTerm] = useState('');
  const [filteredDesigns, setFilteredDesigns] = useState([]);

  useEffect(() => {
    loadDesigns();
  }, [pagination.page, dispatch]);

  useEffect(() => {
    if (designSearchTerm.trim()) {
      const filtered = catalogueDesigns.filter(design => 
        design.title?.toLowerCase().includes(designSearchTerm.toLowerCase()) ||
        design.description?.toLowerCase().includes(designSearchTerm.toLowerCase())
      );
      setFilteredDesigns(filtered);
    } else {
      setFilteredDesigns(catalogueDesigns);
    }
  }, [catalogueDesigns, designSearchTerm]);

  const loadDesigns = () => {
    dispatch(listCatalogueDesigns({
      page: pagination.page,
      limit: pagination.limit,
    }));
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const baseUrl = import.meta.env.VITE_IMAGE_URL; 
    return `${baseUrl}/${imagePath.replace(/^\/+/, '')}`;
  };

  const handleToggleDesignStatus = async (design) => {
    try {
      const updatedStatus = !design.isActive;
      await dispatch(updateDesignDetails({
        id: design._id,
        designData: { isActive: updatedStatus }
      })).unwrap();
      
      loadDesigns();
    } catch (error) {
      console.error('Failed to update design status:', error);
    }
  };

  const handleDeleteDesign = async (design) => {
    try {
      await dispatch(deleteDesign(design._id)).unwrap();
      loadDesigns();
    } catch (error) {
      console.error('Failed to delete design:', error);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      dispatch(listCatalogueDesigns({
        page: newPage,
        limit: pagination.limit,
      }));
    }
  };

  const handleSearch = () => {
    loadDesigns();
  };

  const designsToDisplay = designSearchTerm.trim() ? filteredDesigns : catalogueDesigns;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search designs by title or description..."
                value={designSearchTerm}
                onChange={(e) => setDesignSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Search Designs
            </button>
            <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium">
              <Download className="w-5 h-5" />
              <span>Export Designs</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : designsToDisplay.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <Palette className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            {designSearchTerm.trim() ? 'No matching designs found' : 'No designs found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {designSearchTerm.trim() 
              ? 'Try a different search term'
              : 'User-created designs will appear here once they are saved.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Design
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category / Sub Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price / Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status / Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {designsToDisplay.map(design => (
                  <tr key={design._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="h-10 w-10 flex-shrink-0">
                        {design.canvasData?.thumbnail ? (
                          <img
                            src={getImageUrl(design.canvasData.thumbnail)}
                            alt={design.title || 'Design'}
                            className="h-10 w-10 rounded object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/40x40?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded flex items-center justify-center">
                            <Palette className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {design.title || 'Untitled Design'}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {design.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {design.category || 'Uncategorized'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {design.subCategory || 'No sub-category'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">
                        ₹{design.calculatedPrice || '0'}
                      </div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (design.stock || 0) > 10 
                          ? 'bg-green-100 text-green-800'
                          : (design.stock || 0) > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {design.stock || 0} units
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          design.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {design.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex space-x-1">
                          {design.newArrivals && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              New Arrival
                            </span>
                          )}
                          {design.bestSellers && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                              Best Seller
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        {design.isPublished ? (
                          <button
                            onClick={() => onEditDesign(design)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit Details"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onPublishDesign(design)}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Publish"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleDesignStatus(design)}
                          className={`${
                            design.isActive
                              ? 'text-yellow-600 hover:text-yellow-900'
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={design.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {design.isActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteDesign(design)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && !designSearchTerm.trim() && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-700">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    pagination.page === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </button>
                <div className="flex space-x-1">
                  {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg ${
                          pagination.page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    pagination.page === pagination.pages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Designs;