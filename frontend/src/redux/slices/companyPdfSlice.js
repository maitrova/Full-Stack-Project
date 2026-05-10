import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
      return rejectWithValue(error.response?.data || { error: error.message });
    }
  }
);

export const saveCompanyDocument = createAsyncThunk(
  'companyPdf/saveDocument',
  async ({ name, content }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/company-pdfs/company-documents`, {
        name,
        content,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: error.message });
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
      return rejectWithValue(error.response?.data || { error: error.message });
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
      return rejectWithValue(error.response?.data || { error: error.message });
    }
  }
);

const initialState = {
  documents: [],
  currentDocument: null,
  loading: false,
  uploading: false,
  error: null,
  uploadError: null,
  uploadSuccess: null,
};

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
      .addCase(uploadCompanyPdf.pending, (state) => {
        state.uploading = true;
        state.uploadError = null;
        state.uploadSuccess = null;
      })
      .addCase(uploadCompanyPdf.fulfilled, (state, action) => {
        state.uploading = false;
        state.uploadSuccess = action.payload.message;
        state.currentDocument = action.payload.document;
        state.documents = [
          action.payload.document,
          ...state.documents.filter(
            (doc) =>
              doc._id !== action.payload.document._id &&
              doc.name !== action.payload.document.name
          ),
        ];
      })
      .addCase(uploadCompanyPdf.rejected, (state, action) => {
        state.uploading = false;
        state.uploadError = action.payload?.error || 'Upload failed';
      })
      .addCase(saveCompanyDocument.pending, (state) => {
        state.uploading = true;
        state.uploadError = null;
        state.uploadSuccess = null;
      })
      .addCase(saveCompanyDocument.fulfilled, (state, action) => {
        state.uploading = false;
        state.uploadSuccess = action.payload.message;
        state.currentDocument = action.payload.document;
        state.documents = [
          action.payload.document,
          ...state.documents.filter(
            (doc) =>
              doc._id !== action.payload.document._id &&
              doc.name !== action.payload.document.name
          ),
        ];
      })
      .addCase(saveCompanyDocument.rejected, (state, action) => {
        state.uploading = false;
        state.uploadError = action.payload?.error || 'Save failed';
      })
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
        state.currentDocument = null;
        state.error = action.payload?.error || 'Failed to fetch document';
      });
  },
});

export const {
  clearUploadState,
  clearError,
  clearCurrentDocument,
  resetState,
} = companyPdfSlice.actions;

export const selectAllDocuments = (state) => state.companyPdf.documents;
export const selectCurrentDocument = (state) => state.companyPdf.currentDocument;
export const selectLoading = (state) => state.companyPdf.loading;
export const selectUploading = (state) => state.companyPdf.uploading;
export const selectError = (state) => state.companyPdf.error;
export const selectUploadError = (state) => state.companyPdf.uploadError;
export const selectUploadSuccess = (state) => state.companyPdf.uploadSuccess;

export default companyPdfSlice.reducer;
