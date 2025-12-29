// client/src/store/productsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Create axios instance specifically for products API
const productsAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://narifighter.online/backend",
});

// Thunk: fetch all products for listing with optional filtering
export const fetchProducts = createAsyncThunk(
  "products/fetchAll",
  async (filters = {}, thunkAPI) => {
    try {
      // Extract filters (category, subCategory, etc.)
      const { category, subCategory, ...otherParams } = filters;
      
      const params = {};
      if (category && category !== 'all') params.category = category;
      if (subCategory && subCategory !== 'all') params.subCategory = subCategory;
      
      const res = await productsAPI.get("/api/products", { params });
      return res.data;
    } catch (err) {
      return thunkAPI.rejectWithValue({
        message: err.response?.data?.error || "Failed to fetch products",
        details: err.response?.data?.details || err.message
      });
    }
  }
);

// Thunk: fetch product categories and subcategories
export const fetchProductCategories = createAsyncThunk(
  "products/fetchCategories",
  async (_, thunkAPI) => {
    try {
      const res = await productsAPI.get("/api/products/categories");
      return res.data; // { categories: [{category, subCategories: []}], allSubCategories: [] }
    } catch (err) {
      return thunkAPI.rejectWithValue({
        message: err.response?.data?.error || "Failed to fetch categories",
        details: err.response?.data?.details || err.message
      });
    }
  }
);

// Thunk: fetch single product by slug for customizer
export const fetchProductBySlug = createAsyncThunk(
  "products/fetchBySlug",
  async (slug, thunkAPI) => {
    try {
      const res = await productsAPI.get(`/api/products/${slug}`);
      return res.data;
    } catch (err) {
      return thunkAPI.rejectWithValue({
        message: err.response?.data?.error || "Failed to fetch product",
        details: err.response?.data?.details || err.message
      });
    }
  }
);

const initialState = {
  items: [],
  itemsStatus: "idle",
  itemsError: null,
  
  current: null,
  currentStatus: "idle",
  currentError: null,
  
  // Categories state
  categories: [], // Array of {category, subCategories: []}
  allSubCategories: [],
  categoriesStatus: "idle",
  categoriesError: null,
  
  filters: {
    category: null,
    subCategory: null,
  }
};

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    clearCurrentProduct(state) {
      state.current = null;
      state.currentStatus = "idle";
      state.currentError = null;
    },
    clearProductsError(state) {
      state.itemsError = null;
      state.currentError = null;
      state.categoriesError = null;
    },
    setFilters(state, action) {
      state.filters = action.payload;
    }
  },
  extraReducers: (builder) => {
    // fetchProducts
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.itemsStatus = "loading";
        state.itemsError = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.itemsStatus = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.itemsStatus = "failed";
        state.itemsError = action.payload;
      });

    // fetchProductCategories
    builder
      .addCase(fetchProductCategories.pending, (state) => {
        state.categoriesStatus = "loading";
        state.categoriesError = null;
      })
      .addCase(fetchProductCategories.fulfilled, (state, action) => {
        state.categoriesStatus = "succeeded";
        state.categories = action.payload.categories || [];
        state.allSubCategories = action.payload.allSubCategories || [];
      })
      .addCase(fetchProductCategories.rejected, (state, action) => {
        state.categoriesStatus = "failed";
        state.categoriesError = action.payload;
      });

    // fetchProductBySlug
    builder
      .addCase(fetchProductBySlug.pending, (state) => {
        state.currentStatus = "loading";
        state.currentError = null;
      })
      .addCase(fetchProductBySlug.fulfilled, (state, action) => {
        state.currentStatus = "succeeded";
        state.current = action.payload;
      })
      .addCase(fetchProductBySlug.rejected, (state, action) => {
        state.currentStatus = "failed";
        state.currentError = action.payload;
      });
  },
});

export const { clearCurrentProduct, clearProductsError, setFilters } = productsSlice.actions;
export default productsSlice.reducer;