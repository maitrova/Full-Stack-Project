// client/src/store/productsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// If you want a base URL, you can set it once:
axios.defaults.baseURL =
  import.meta.env.VITE_API_URL || "https://narifighter.online/backend";

// Thunk: fetch all products for listing
export const fetchProducts = createAsyncThunk(
  "products/fetchAll",
  async (_, thunkAPI) => {
    try {
      const res = await axios.get("/api/products");
      return res.data; // array of products
    } catch (err) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.error || "Failed to fetch products"
      );
    }
  }
);

// Thunk: fetch single product by slug for customizer
export const fetchProductBySlug = createAsyncThunk(
  "products/fetchBySlug",
  async (slug, thunkAPI) => {
    try {
      const res = await axios.get(`/api/products/${slug}`);
      return res.data; // one product with views[]
    } catch (err) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.error || "Failed to fetch product"
      );
    }
  }
);

const initialState = {
  items: [],          // all products for listing
  itemsStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  itemsError: null,

  current: null,       // selected product for /products/:slug/customize
  currentStatus: "idle",
  currentError: null,
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
        state.itemsError = action.payload || "Failed to fetch products";
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
        state.currentError = action.payload || "Failed to fetch product";
      });
  },
});

export const { clearCurrentProduct } = productsSlice.actions;
export default productsSlice.reducer;
