// homeCategoryTilesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// API base URL
const API_BASE_URL =  `${import.meta.env.VITE_API_URL}/readymadeproducts`;

// Async thunk for fetching home category tiles
export const fetchHomeCategoryTiles = createAsyncThunk(
  'homeCategoryTiles/fetchHomeCategoryTiles',
  async ({ onlyActive = true, limit = 12 } = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/categorylist`, {
        params: {
          onlyActive,
          limit
        }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch category tiles');
    }
  }
);

const initialState = {
  categories: [],
  loading: false,
  error: null,
  lastFetched: null,
  filters: {
    onlyActive: true,
    limit: 12
  }
};

const homeCategoryTilesSlice = createSlice({
  name: 'homeCategoryTiles',
  initialState,
  reducers: {
    // Action to manually set categories (if needed)
    setCategories: (state, action) => {
      state.categories = action.payload;
      state.error = null;
    },
    
    // Action to clear categories
    clearCategories: (state) => {
      state.categories = [];
      state.error = null;
    },
    
    // Action to update filters
    updateFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    // Action to clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Action to reset slice state
    reset: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Handle pending state
      .addCase(fetchHomeCategoryTiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // Handle fulfilled state
      .addCase(fetchHomeCategoryTiles.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload.data || [];
        state.lastFetched = Date.now();
      })
      // Handle rejected state
      .addCase(fetchHomeCategoryTiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch category tiles';
      });
  }
});

// Export actions
export const { 
  setCategories, 
  clearCategories, 
  updateFilters, 
  clearError,
  reset 
} = homeCategoryTilesSlice.actions;

// Selectors
export const selectAllCategories = (state) => state.homeCategoryTiles.categories;
export const selectCategoriesLoading = (state) => state.homeCategoryTiles.loading;
export const selectCategoriesError = (state) => state.homeCategoryTiles.error;
export const selectLastFetched = (state) => state.homeCategoryTiles.lastFetched;
export const selectCategoryFilters = (state) => state.homeCategoryTiles.filters;
export const selectCategoriesCount = (state) => state.homeCategoryTiles.categories.length;

// Selector to get category by name
export const selectCategoryByName = (state, categoryName) => 
  state.homeCategoryTiles.categories.find(cat => cat.category === categoryName);

// Selector to get categories with images
export const selectCategoriesWithImages = (state) => 
  state.homeCategoryTiles.categories.filter(cat => cat.image);

export default homeCategoryTilesSlice.reducer;