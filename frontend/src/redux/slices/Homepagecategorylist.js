// homeCategoryTilesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// API base URL
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/readymadeproducts`;

// ✅ Category tiles
export const fetchHomeCategoryTiles = createAsyncThunk(
  "homeCategoryTiles/fetchHomeCategoryTiles",
  async ({ onlyActive = true, limit = 12 } = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/categorylist`, {
        params: { onlyActive, limit },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch category tiles"
      );
    }
  }
);

// ✅ SubCategory tiles (optionally filter by category)
export const fetchHomeSubCategoryTiles = createAsyncThunk(
  "homeCategoryTiles/fetchHomeSubCategoryTiles",
  async (
    { onlyActive = true, limit = 12, category = "" } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/subcategorylist`, {
        params: { onlyActive, limit, category },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch sub category tiles"
      );
    }
  }
);

const initialState = {
  // ✅ categories
  categories: [],
  loading: false,
  error: null,
  lastFetched: null,

  // ✅ sub categories
  subCategories: [],
  subLoading: false,
  subError: null,
  subLastFetched: null,

  filters: {
    onlyActive: true,
    limit: 12,
    category: "", // used for subCategory filter
  },
};

const homeCategoryTilesSlice = createSlice({
  name: "homeCategoryTiles",
  initialState,
  reducers: {
    // Category actions
    setCategories: (state, action) => {
      state.categories = action.payload;
      state.error = null;
    },
    clearCategories: (state) => {
      state.categories = [];
      state.error = null;
    },

    // SubCategory actions
    setSubCategories: (state, action) => {
      state.subCategories = action.payload;
      state.subError = null;
    },
    clearSubCategories: (state) => {
      state.subCategories = [];
      state.subError = null;
    },

    // Filters
    updateFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    // Errors
    clearError: (state) => {
      state.error = null;
    },
    clearSubError: (state) => {
      state.subError = null;
    },

    // Reset
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // =======================
      // CATEGORY TILES
      // =======================
      .addCase(fetchHomeCategoryTiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHomeCategoryTiles.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload.data || [];
        state.lastFetched = Date.now();
      })
      .addCase(fetchHomeCategoryTiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch category tiles";
      })

      // =======================
      // SUBCATEGORY TILES
      // =======================
      .addCase(fetchHomeSubCategoryTiles.pending, (state) => {
        state.subLoading = true;
        state.subError = null;
      })
      .addCase(fetchHomeSubCategoryTiles.fulfilled, (state, action) => {
        state.subLoading = false;
        state.subCategories = action.payload.data || [];
        state.subLastFetched = Date.now();
      })
      .addCase(fetchHomeSubCategoryTiles.rejected, (state, action) => {
        state.subLoading = false;
        state.subError = action.payload || "Failed to fetch sub category tiles";
      });
  },
});

// Export actions
export const {
  setCategories,
  clearCategories,
  setSubCategories,
  clearSubCategories,
  updateFilters,
  clearError,
  clearSubError,
  reset,
} = homeCategoryTilesSlice.actions;

// =======================
// SELECTORS - CATEGORY
// =======================
export const selectAllCategories = (state) => state.homeCategoryTiles.categories;
export const selectCategoriesLoading = (state) => state.homeCategoryTiles.loading;
export const selectCategoriesError = (state) => state.homeCategoryTiles.error;
export const selectLastFetched = (state) => state.homeCategoryTiles.lastFetched;
export const selectCategoryFilters = (state) => state.homeCategoryTiles.filters;
export const selectCategoriesCount = (state) =>
  state.homeCategoryTiles.categories.length;

export const selectCategoryByName = (state, categoryName) =>
  state.homeCategoryTiles.categories.find((cat) => cat.category === categoryName);

export const selectCategoriesWithImages = (state) =>
  state.homeCategoryTiles.categories.filter((cat) => cat.image || cat.thumbnail);

// =======================
// SELECTORS - SUBCATEGORY
// =======================
export const selectAllSubCategories = (state) =>
  state.homeCategoryTiles.subCategories;

export const selectSubCategoriesLoading = (state) =>
  state.homeCategoryTiles.subLoading;

export const selectSubCategoriesError = (state) =>
  state.homeCategoryTiles.subError;

export const selectSubLastFetched = (state) =>
  state.homeCategoryTiles.subLastFetched;

export const selectSubCategoriesCount = (state) =>
  state.homeCategoryTiles.subCategories.length;

export const selectSubCategoryByName = (state, subCategoryName) =>
  state.homeCategoryTiles.subCategories.find(
    (s) => s.subCategory === subCategoryName
  );

export const selectSubCategoriesWithImages = (state) =>
  state.homeCategoryTiles.subCategories.filter((s) => s.image || s.thumbnail);

export default homeCategoryTilesSlice.reducer;
