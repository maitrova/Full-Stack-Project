// components/DesignUploadsManager.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFolders,
  createFolder,
  fetchImages,
  uploadImages,
  deleteImage,
  deleteFolder,
  clearError,
  clearSuccess,
  setCurrentFolder,
  clearCurrentFolder,
} from '../redux/slices/admindesignuploads.js';

const DesignUploadsManager = () => {
  const dispatch = useDispatch();
  const {
    folders,
    images,
    currentFolder,
    loading,
    uploading,
    error,
    success,
  } = useSelector((state) => state.designUploads);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Fetch folders on mount
  useEffect(() => {
    dispatch(fetchFolders());
  }, [dispatch]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(timer);
    }
    if (success) {
      const timer = setTimeout(() => dispatch(clearSuccess()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success, dispatch]);

  // Handle folder creation
  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      dispatch(createFolder(newFolderName.trim()));
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  };

  // Handle folder selection
  const handleSelectFolder = (folder) => {
    dispatch(setCurrentFolder(folder));
    dispatch(fetchImages(folder));
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedFiles(imageFiles);
  };

  // Handle upload
  const handleUpload = () => {
    if (currentFolder && selectedFiles.length > 0) {
      dispatch(uploadImages({ folder: currentFolder, images: selectedFiles }));
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle image deletion
  const handleDeleteImage = (filename) => {
    if (currentFolder && filename && window.confirm('Are you sure you want to delete this image?')) {
      dispatch(deleteImage({ folder: currentFolder, filename }));
    }
  };

  // Handle folder deletion
  const handleDeleteFolder = (folder, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the folder "${folder}"? This action cannot be undone.`)) {
      dispatch(deleteFolder(folder));
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Simple SVG Icons
  const FolderIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  const FolderPlusIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );

  const UploadIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  );

  const TrashIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const ImageIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const ChevronRightIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const CheckIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const XIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const ExclamationIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );

  const GalleryIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Design Uploads Manager</h1>
        <p className="text-gray-600 mt-2">Manage design folders and upload images</p>
      </div>

      {/* Notifications */}
      <div className="space-y-3 mb-6">
        {error && (
          <div className="flex items-center justify-between bg-red-50 text-red-800 px-4 py-3 rounded-lg border border-red-200">
            <div className="flex items-center">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => dispatch(clearError())}
              className="text-red-600 hover:text-red-800"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        {success && (
          <div className="flex items-center justify-between bg-green-50 text-green-800 px-4 py-3 rounded-lg border border-green-200">
            <div className="flex items-center">
              <CheckIcon className="h-5 w-5 mr-2" />
              <span>{success}</span>
            </div>
            <button
              onClick={() => dispatch(clearSuccess())}
              className="text-green-600 hover:text-green-800"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Folders */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Folders</h2>
              <button
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FolderPlusIcon className="h-5 w-5 mr-1" />
                New Folder
              </button>
            </div>

            {/* Create Folder Form */}
            {showCreateFolder && (
              <form onSubmit={handleCreateFolder} className="mb-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateFolder(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Folders List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {loading && !folders.length ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No folders created yet</p>
                </div>
              ) : (
                folders.map((folder) => (
                  <div
                    key={folder}
                    onClick={() => handleSelectFolder(folder)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      currentFolder === folder
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center flex-1">
                      <FolderIcon className={`h-5 w-5 mr-3 ${
                        currentFolder === folder ? 'text-indigo-600' : 'text-gray-400'
                      }`} />
                      <span className="font-medium text-gray-800">{folder}</span>
                      {currentFolder === folder && (
                        <ChevronRightIcon className="h-4 w-4 ml-2 text-indigo-500" />
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteFolder(folder, e)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Content */}
        <div className="lg:col-span-2">
          {currentFolder ? (
            <div className="space-y-6">
              {/* Folder Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center">
                      <FolderIcon className="h-6 w-6 text-indigo-600 mr-2" />
                      <h2 className="text-xl font-semibold text-gray-800">{currentFolder}</h2>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {images.length} image{images.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => dispatch(clearCurrentFolder())}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Back to All Folders
                  </button>
                </div>

                {/* Upload Section */}
                <div
                  ref={dropZoneRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  <UploadIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 mb-2">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected`
                      : 'Drag & drop images here or click to browse'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <div className="flex items-center justify-center space-x-4">
                    <label
                      htmlFor="file-upload"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                    >
                      Browse Files
                    </label>
                    {selectedFiles.length > 0 && (
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-600">
                          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} ready to upload
                        </span>
                        <button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {uploading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <UploadIcon className="h-4 w-4 mr-2" />
                              Upload All
                            </>
                          )}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                          >
                            <div className="flex items-center">
                              <ImageIcon className="h-5 w-5 text-gray-400 mr-3" />
                              <div>
                                <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {file.type.split('/')[1].toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Images Grid */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Images</h3>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-500 mt-4">Loading images...</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-12">
                    <GalleryIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No images in this folder yet</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Upload some images to get started
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div
                        key={image.filename}
                        className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="relative aspect-video bg-gray-100">
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjJGMkYyIi8+CjxwYXRoIGQ9Ik0xMjAgODBMMTAwIDEwME04MCAxMjBMNjAgMTQwIiBzdHJva2U9IiNEN0Q3RDciIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjMwIiBzdHJva2U9IiNEN0Q3RDciIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4=';
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(image.filename)}
                            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-800 truncate mb-1">
                            {image.filename}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{formatFileSize(image.size)}</span>
                            <span>{formatDate(image.modifiedAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Welcome/Empty State */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <FolderPlusIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to Design Uploads</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Select a folder from the left panel to view and manage images, or create a new folder to get started.
              </p>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FolderPlusIcon className="h-5 w-5 mr-2" />
                Create Your First Folder
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Folders</p>
            <p className="text-2xl font-bold text-gray-900">{folders.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Current Folder Images</p>
            <p className="text-2xl font-bold text-gray-900">{images.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-medium text-gray-900">
              {loading ? 'Loading...' : uploading ? 'Uploading...' : 'Ready'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignUploadsManager;