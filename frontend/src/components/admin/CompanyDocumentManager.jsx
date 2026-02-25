// components/CompanyDocumentManager.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  uploadCompanyPdf,
  fetchCompanyDocuments,
  fetchCompanyDocumentByName,
  clearUploadState,
  clearError,
  selectAllDocuments,
  selectLoading,
  selectUploading,
  selectUploadError,
  selectUploadSuccess,
  selectError,
} from '../../redux/slices/companyPdfSlice.js';

const CompanyDocumentManager = () => {
  const dispatch = useDispatch();
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [searchName, setSearchName] = useState('');
  const API_URL = import.meta.env.VITE_API_URL;

  // Redux state
  const documents = useSelector(selectAllDocuments);
  const loading = useSelector(selectLoading);
  const uploading = useSelector(selectUploading);
  const uploadError = useSelector(selectUploadError);
  const uploadSuccess = useSelector(selectUploadSuccess);
  const error = useSelector(selectError);

  // Fetch documents on component mount
  useEffect(() => {
    dispatch(fetchCompanyDocuments());
  }, [dispatch]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Please select a PDF file');
      e.target.value = null;
    }
  };

  // Handle upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !documentName) {
      alert('Please select a file and enter a document name');
      return;
    }

    const result = await dispatch(
      uploadCompanyPdf({
        file: selectedFile,
        name: documentName,
      })
    );

    if (!result.error) {
      setSelectedFile(null);
      setDocumentName('');
      // Reset file input
      document.getElementById('file-input').value = '';
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchName.trim()) {
      dispatch(fetchCompanyDocumentByName(searchName));
    }
  };

  // Clear upload messages
  const handleClearMessages = () => {
    dispatch(clearUploadState());
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Company Document Manager</h1>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload PDF Document</h2>
        
        <form onSubmit={handleUpload}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Document Name
            </label>
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Enter document name"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Select PDF File
            </label>
            <input
              id="file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full"
              required
            />
          </div>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {uploadError}
              <button
                onClick={handleClearMessages}
                className="ml-2 text-sm underline"
              >
                Clear
              </button>
            </div>
          )}

          {uploadSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
              {uploadSuccess}
              <button
                onClick={handleClearMessages}
                className="ml-2 text-sm underline"
              >
                Clear
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className={`px-4 py-2 rounded text-white ${
              uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Search Document</h2>
        
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Enter document name"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Search
          </button>
        </form>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">All Documents</h2>
        
        {loading && <div className="text-center py-4">Loading...</div>}
        
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded mb-4">
            {error}
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No documents found
          </div>
        )}

        {!loading && documents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">File Path</th>
                  <th className="p-3 text-left">Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id} className="border-t">
                    <td className="p-3">{doc.name}</td>
                    <td className="p-3">
                      <a
                        href={`${API_URL}/${doc.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        View PDF
                      </a>
                    </td>
                    <td className="p-3">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDocumentManager;