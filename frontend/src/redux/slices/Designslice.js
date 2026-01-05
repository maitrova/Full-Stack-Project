// designsSlice.js - CORRECTED VERSION
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Base URL for API calls
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/savedata`;

// Async Thunks (keep all your existing thunks...)
export const publishDesign = createAsyncThunk(
  'designs/publishDesign',
  async ({ id, designData }, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;

      const response = await axios.patch(
        `${API_URL}/${id}/publish`,
        designData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const listCatalogueDesigns = createAsyncThunk(
  'designs/listCatalogueDesigns',
  async ({ page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/catalogue`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateDesignDetails = createAsyncThunk(
  'designs/updateDesignDetails',
  async ({ id, designData }, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;

      const response = await axios.put(
        `${API_URL}/designdetails/${id}`,
        designData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getDesign = createAsyncThunk(
  'designs/getDesign',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const listDesigns = createAsyncThunk(
  'designs/listDesigns',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;

      const response = await axios.get(`${API_URL}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteDesign = createAsyncThunk(
  'designs/deleteDesign',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;

      const response = await axios.delete(`${API_URL}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return { id, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const saveDesign = createAsyncThunk(
  'designs/saveDesign',
  async (designData, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;

      const response = await axios.post(`${API_URL}/designs`, designData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateDesign = createAsyncThunk(
  'designs/updateDesign',
  async ({ id, designData }, { getState, rejectWithValue }) => {
    try {
      const { user } = getState(); 
      const token = user.userInfo?.token;
      const response = await axios.put(
        `${API_URL}/designs/${id}`,
        designData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Initial State
const initialState = {
  designs: [],
  catalogueDesigns: [],
  currentDesign: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
  success: false,
  operation: null, // Track current operation for specific loading states
};

// Slice - FIXED THE TYPO AND ADDED MISSING EXPORTS
const designsSlice = createSlice({
  name: 'designs',
  initialState,
  reducers: {  // FIXED: Changed from "redesignsducers" to "reducers"
    resetDesignState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.operation = null;
    },
    clearCurrentDesign: (state) => {
      state.currentDesign = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearDesignError: (state) => {  // ADDED: This is what you're trying to import
      state.error = null;
    },
    resetSuccess: (state) => {
      state.success = false;
    },
    resetDesignSuccess: (state) => {  // ADDED: This is what you're trying to import
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Publish Design
      .addCase(publishDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'publish';
      })
      .addCase(publishDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.operation = null;
        
        // Update the design in designs array if it exists
        const index = state.designs.findIndex(d => d._id === action.payload._id);
        if (index !== -1) {
          state.designs[index] = action.payload;
        }
        
        // Also update in catalogue designs if it exists there
        const catIndex = state.catalogueDesigns.findIndex(d => d._id === action.payload._id);
        if (catIndex !== -1) {
          state.catalogueDesigns[catIndex] = action.payload;
        }
      })
      .addCase(publishDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // List Catalogue Designs
      .addCase(listCatalogueDesigns.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.operation = 'listCatalogue';
      })
      .addCase(listCatalogueDesigns.fulfilled, (state, action) => {
        state.loading = false;
        state.catalogueDesigns = action.payload.data;
        state.pagination = action.payload.pagination;
        state.operation = null;
      })
      .addCase(listCatalogueDesigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // Update Design Details
      .addCase(updateDesignDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'updateDetails';
      })
      .addCase(updateDesignDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.operation = null;
        
        // Update in designs array
        const index = state.designs.findIndex(d => d._id === action.payload._id);
        if (index !== -1) {
          state.designs[index] = action.payload;
        }
        
        // Update in catalogue designs if published
        const catIndex = state.catalogueDesigns.findIndex(d => d._id === action.payload._id);
        if (catIndex !== -1) {
          state.catalogueDesigns[catIndex] = action.payload;
        }
        
        // Update current design if it's the one being viewed
        if (state.currentDesign?._id === action.payload._id) {
          state.currentDesign = action.payload;
        }
      })
      .addCase(updateDesignDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // Get Single Design
      .addCase(getDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.operation = 'getDesign';
      })
      .addCase(getDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDesign = action.payload;
        state.operation = null;
      })
      .addCase(getDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // List Designs (Admin/User specific)
      .addCase(listDesigns.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.operation = 'listDesigns';
      })
      .addCase(listDesigns.fulfilled, (state, action) => {
        state.loading = false;
        state.designs = action.payload;
        state.operation = null;
      })
      .addCase(listDesigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // Delete Design
      .addCase(deleteDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'deleteDesign';
      })
      .addCase(deleteDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.operation = null;
        
        // Remove from designs array
        state.designs = state.designs.filter(d => d._id !== action.payload.id);
        
        // Remove from catalogue designs if present
        state.catalogueDesigns = state.catalogueDesigns.filter(d => d._id !== action.payload.id);
        
        // Clear current design if it was the deleted one
        if (state.currentDesign?._id === action.payload.id) {
          state.currentDesign = null;
        }
      })
      .addCase(deleteDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // Save Design
      .addCase(saveDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'saveDesign';
      })
      .addCase(saveDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.designs.unshift(action.payload);
        state.operation = null;
      })
      .addCase(saveDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      })

      // Update Design
      .addCase(updateDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'updateDesign';
      })
      .addCase(updateDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.operation = null;
        
        // Update in designs array
        const index = state.designs.findIndex(d => d._id === action.payload._id);
        if (index !== -1) {
          state.designs[index] = action.payload;
        }
        
        // Update current design if it's the one being viewed
        if (state.currentDesign?._id === action.payload._id) {
          state.currentDesign = action.payload;
        }
      })
      .addCase(updateDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.operation = null;
      });
  },
});

// Export actions and reducer - ADDED THE MISSING EXPORTS
export const { 
  resetDesignState, 
  clearCurrentDesign, 
  clearError, 
  clearDesignError,  // ADDED
  resetSuccess,
  resetDesignSuccess  // ADDED
} = designsSlice.actions;

export const selectDesigns = (state) => state.designs.designs;
export const selectCurrentDesign = (state) => state.designs.currentDesign;
export const selectDesignsLoading = (state) => state.designs.loading;
export const selectDesignsError = (state) => state.designs.error;
export const selectDesignsSuccess = (state) => state.designs.success;
export const selectDesignsOperation = (state) => state.designs.operation;
export default designsSlice.reducer;