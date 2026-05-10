// slices/designUploadsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_URL}/designuploads`;

// Async thunks
export const createFolder = createAsyncThunk(
  'designUploads/createFolder',
  async (folderName, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE}/folders`, { name: folderName });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const fetchFolders = createAsyncThunk(
  'designUploads/fetchFolders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/folders`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const uploadImages = createAsyncThunk(
  'designUploads/uploadImages',
  async ({ folder, images }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      images.forEach((image) => {
        formData.append('images', image);
      });

      const response = await axios.post(
        `${API_BASE}/${folder}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const fetchImages = createAsyncThunk(
  'designUploads/fetchImages',
  async (folder, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/${folder}/files`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const deleteImage = createAsyncThunk(
  'designUploads/deleteImage',
  async ({ folder, filename }, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_BASE}/${folder}/files/${filename}`);
      return { ...response.data, folder, filename };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const deleteFolder = createAsyncThunk(
  'designUploads/deleteFolder',
  async (folder, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_BASE}/folders/${folder}`);
      return { ...response.data, folder };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

const initialState = {
  folders: [],
  currentFolder: null,
  images: [],
  loading: false,
  uploading: false,
  error: null,
  success: null,
};

const designUploadsSlice = createSlice({
  name: 'designUploads',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = null;
    },
    setCurrentFolder: (state, action) => {
      state.currentFolder = action.payload;
    },
    clearCurrentFolder: (state) => {
      state.currentFolder = null;
      state.images = [];
    },
    // Optional: For real-time updates without refetching
    addImageLocally: (state, action) => {
      state.images.unshift(action.payload);
    },
    removeImageLocally: (state, action) => {
      state.images = state.images.filter(img => img.filename !== action.payload);
    },
    addFolderLocally: (state, action) => {
      if (!state.folders.includes(action.payload)) {
        state.folders.push(action.payload);
        state.folders.sort((a, b) => a.localeCompare(b));
      }
    },
    removeFolderLocally: (state, action) => {
      state.folders = state.folders.filter(folder => folder !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Folder
      .addCase(createFolder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createFolder.fulfilled, (state, action) => {
        state.loading = false;
        state.success = action.payload.message || 'Folder created successfully';
        if (!state.folders.includes(action.payload.folder)) {
          state.folders.push(action.payload.folder);
          state.folders.sort((a, b) => a.localeCompare(b));
        }
      })
      .addCase(createFolder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create folder';
      })

      // Fetch Folders
      .addCase(fetchFolders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFolders.fulfilled, (state, action) => {
        state.loading = false;
        state.folders = action.payload.folders || [];
      })
      .addCase(fetchFolders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch folders';
      })

      // Upload Images
      .addCase(uploadImages.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(uploadImages.fulfilled, (state, action) => {
        state.uploading = false;
        state.success = `Uploaded ${action.payload.files?.length || 0} images successfully`;
        
        // Update images list if we're in the same folder
        if (state.currentFolder === action.payload.folder) {
          const newImages = action.payload.files || [];
          state.images = [...newImages, ...state.images];
        }
      })
      .addCase(uploadImages.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || 'Failed to upload images';
      })

      // Fetch Images
      .addCase(fetchImages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchImages.fulfilled, (state, action) => {
        state.loading = false;
        state.images = action.payload.files || [];
        state.currentFolder = action.payload.folder;
      })
      .addCase(fetchImages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch images';
      })

      // Delete Image
      .addCase(deleteImage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteImage.fulfilled, (state, action) => {
        state.loading = false;
        state.success = action.payload.message || 'Image deleted successfully';
        state.images = state.images.filter(img => img.filename !== action.payload.filename);
      })
      .addCase(deleteImage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete image';
      })

      // Delete Folder
      .addCase(deleteFolder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteFolder.fulfilled, (state, action) => {
        state.loading = false;
        state.success = action.payload.message || 'Folder deleted successfully';
        state.folders = state.folders.filter(folder => folder !== action.payload.folder);
        
        // Clear current folder if it was deleted
        if (state.currentFolder === action.payload.folder) {
          state.currentFolder = null;
          state.images = [];
        }
      })
      .addCase(deleteFolder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete folder';
      });
  },
});

export const {
  clearError,
  clearSuccess,
  setCurrentFolder,
  clearCurrentFolder,
  addImageLocally,
  removeImageLocally,
  addFolderLocally,
  removeFolderLocally,
} = designUploadsSlice.actions;

export default designUploadsSlice.reducer;