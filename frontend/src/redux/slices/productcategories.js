// productCategoriesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend"

// Async thunk for fetching product categories
export const fetchProductCategories = createAsyncThunk(
  'productCategories/fetchProductCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/categorylist`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch product categories'
      );
    }
  }
);

const initialState = {
  categories: [],
  loading: false,
  error: null,
  lastFetched: null
};

const productCategoriesSlice = createSlice({
  name: 'productCategories',
  initialState,
  reducers: {
    setCategories: (state, action) => {
      state.categories = action.payload;
      state.error = null;
    },
    clearCategories: (state) => {
      state.categories = [];
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    reset: () => initialState
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload || [];
        state.lastFetched = Date.now();
      })
      .addCase(fetchProductCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch categories';
      });
  }
});

// Export actions
export const {
  setCategories,
  clearCategories,
  clearError,
  reset
} = productCategoriesSlice.actions;

// Selectors
export const selectProductCategories = (state) => state.productCategories.categories;
export const selectCategoriesLoading = (state) => state.productCategories.loading;
export const selectCategoriesError = (state) => state.productCategories.error;
export const selectLastFetched = (state) => state.productCategories.lastFetched;
export const selectCategoriesCount = (state) => state.productCategories.categories.length;

// Selector to get category by name
export const selectProductCategoryByName = (state, categoryName) =>
  state.productCategories.categories.find(cat => cat.category === categoryName);

// Selector to get categories with images
export const selectCategoriesWithImages = (state) =>
  state.productCategories.categories.filter(cat => cat.image);

export default productCategoriesSlice.reducer;