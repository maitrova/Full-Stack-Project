// store/slices/companyPdfSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Async thunks
export const uploadCompanyPdf = createAsyncThunk(
  'companyPdf/upload',
  async ({ file, name }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);

      const response = await axios.post(`${API_URL}/company-pdfs/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchCompanyDocuments = createAsyncThunk(
  'companyPdf/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/company-pdfs/company-documents`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchCompanyDocumentByName = createAsyncThunk(
  'companyPdf/fetchByName',
  async (name, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/company-pdfs/company-documents/${name}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Initial state
const initialState = {
  documents: [],
  currentDocument: null,
  loading: false,
  uploading: false,
  error: null,
  uploadError: null,
  uploadSuccess: null,
};

// Slice
const companyPdfSlice = createSlice({
  name: 'companyPdf',
  initialState,
  reducers: {
    clearUploadState: (state) => {
      state.uploading = false;
      state.uploadError = null;
      state.uploadSuccess = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentDocument: (state) => {
      state.currentDocument = null;
    },
    resetState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Upload PDF cases
      .addCase(uploadCompanyPdf.pending, (state) => {
        state.uploading = true;
        state.uploadError = null;
        state.uploadSuccess = null;
      })
      .addCase(uploadCompanyPdf.fulfilled, (state, action) => {
        state.uploading = false;
        state.uploadSuccess = action.payload.message;
        state.documents = [action.payload.document, ...state.documents];
      })
      .addCase(uploadCompanyPdf.rejected, (state, action) => {
        state.uploading = false;
        state.uploadError = action.payload?.error || 'Upload failed';
      })

      // Fetch all documents cases
      .addCase(fetchCompanyDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanyDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload;
      })
      .addCase(fetchCompanyDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to fetch documents';
      })

      // Fetch document by name cases
      .addCase(fetchCompanyDocumentByName.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanyDocumentByName.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDocument = action.payload;
      })
      .addCase(fetchCompanyDocumentByName.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to fetch document';
      });
  },
});

// Export actions
export const {
  clearUploadState,
  clearError,
  clearCurrentDocument,
  resetState,
} = companyPdfSlice.actions;

// Selectors
export const selectAllDocuments = (state) => state.companyPdf.documents;
export const selectCurrentDocument = (state) => state.companyPdf.currentDocument;
export const selectLoading = (state) => state.companyPdf.loading;
export const selectUploading = (state) => state.companyPdf.uploading;
export const selectError = (state) => state.companyPdf.error;
export const selectUploadError = (state) => state.companyPdf.uploadError;
export const selectUploadSuccess = (state) => state.companyPdf.uploadSuccess;

export default companyPdfSlice.reducer;