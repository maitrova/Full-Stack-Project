import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  saveCompanyDocument,
  fetchCompanyDocuments,
  fetchCompanyDocumentByName,
  clearUploadState,
  clearCurrentDocument,
  selectAllDocuments,
  selectCurrentDocument,
  selectLoading,
  selectUploading,
  selectUploadError,
  selectUploadSuccess,
  selectError,
} from '../../redux/slices/companyPdfSlice.js';
import PolicyRichTextEditor from './PolicyRichTextEditor.jsx';
import PolicyContent from '../policies/PolicyContent.jsx';

const CompanyDocumentManager = () => {
  const dispatch = useDispatch();
  const [documentName, setDocumentName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentType, setDocumentType] = useState('html');
  const [searchName, setSearchName] = useState('');

  const documents = useSelector(selectAllDocuments);
  const currentDocument = useSelector(selectCurrentDocument);
  const loading = useSelector(selectLoading);
  const uploading = useSelector(selectUploading);
  const uploadError = useSelector(selectUploadError);
  const uploadSuccess = useSelector(selectUploadSuccess);
  const error = useSelector(selectError);

  useEffect(() => {
    dispatch(fetchCompanyDocuments());
  }, [dispatch]);

  useEffect(() => {
    if (!currentDocument) {
      return;
    }

    setDocumentName(currentDocument.name || '');
    setDocumentContent(currentDocument.content || '');
    setDocumentType(currentDocument.contentType || 'html');
  }, [currentDocument]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (!documentName.trim() || !documentContent.trim()) {
      alert('Please enter a policy name and content');
      return;
    }

    const result = await dispatch(
      saveCompanyDocument({
        name: documentName.trim(),
        content: documentContent,
      })
    );

    if (!result.error) {
      setSearchName(documentName.trim());
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();

    if (searchName.trim()) {
      dispatch(fetchCompanyDocumentByName(searchName.trim()));
    }
  };

  const handleClearMessages = () => {
    dispatch(clearUploadState());
  };

  const handleEditDocument = (doc) => {
    setDocumentName(doc.name || '');
    setDocumentContent(doc.content || '');
    setDocumentType(doc.contentType || 'html');
    setSearchName(doc.name || '');
  };

  const handleNewDocument = () => {
    setDocumentName('');
    setDocumentContent('');
    setDocumentType('html');
    setSearchName('');
    dispatch(clearCurrentDocument());
    dispatch(clearUploadState());
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Policy Manager</h1>
          <p className="mt-2 text-gray-600">
            Create or update company policies with styled text. Pasted formatting is kept in the rendered policy view.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewDocument}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          New Policy
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold text-gray-900">Create Or Update Policy</h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Policy Name
              </label>
              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-sky-500"
                placeholder="privacy-policy"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                Use the same name that your public route uses, for example `privacy-policy`.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Policy Content
                </label>
                <span className="text-xs text-gray-500">
                  Type directly or paste formatted text here
                </span>
              </div>
              <PolicyRichTextEditor
                value={documentContent}
                onChange={setDocumentContent}
                error={Boolean(uploadError)}
              />
            </div>

            {documentType === 'pdf' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This policy currently exists as a PDF. Saving here will replace the public PDF view with rich text content.
              </div>
            )}

            {uploadError && (
              <div className="rounded-xl bg-red-100 p-3 text-red-700">
                {uploadError}
                <button
                  type="button"
                  onClick={handleClearMessages}
                  className="ml-2 text-sm underline"
                >
                  Clear
                </button>
              </div>
            )}

            {uploadSuccess && (
              <div className="rounded-xl bg-green-100 p-3 text-green-700">
                {uploadSuccess}
                <button
                  type="button"
                  onClick={handleClearMessages}
                  className="ml-2 text-sm underline"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={uploading}
                className={`rounded-xl px-5 py-3 font-medium text-white ${
                  uploading
                    ? 'cursor-not-allowed bg-gray-400'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {uploading ? 'Saving...' : 'Save Policy'}
              </button>
              <button
                type="button"
                onClick={handleNewDocument}
                className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset Editor
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Load Policy</h2>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-sky-500"
                placeholder="Enter policy name"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
              >
                Load
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Live Preview</h2>
            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-5">
              {documentContent.trim() ? (
                <PolicyContent content={documentContent} />
              ) : (
                <p className="text-sm text-gray-500">
                  The saved policy preview will appear here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">All Policies</h2>

        {loading && <div className="py-4 text-center">Loading...</div>}

        {error && (
          <div className="mb-4 rounded-xl bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="py-4 text-center text-gray-500">
            No documents found
          </div>
        )}

        {!loading && documents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id} className="border-t">
                    <td className="p-3 font-medium text-gray-900">{doc.name}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        doc.contentType === 'html'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {doc.contentType === 'html' ? 'Rich Text' : 'PDF'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">
                      {new Date(doc.updatedAt || doc.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleEditDocument(doc)}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        Edit
                      </button>
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
