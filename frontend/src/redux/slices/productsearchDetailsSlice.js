import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// ✅ Base URL from .env
const BASE_URL = `${import.meta.env.VITE_API_URL}/searchproduct`;

// 🔹 Async thunk to fetch product by ID
export const fetchProductById = createAsyncThunk(
  "productDetails/fetchProductById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${BASE_URL}/${id}`);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch product"
      );
    }
  }
);

const productDetailsSlice = createSlice({
  name: "productDetails",
  initialState: {
    product: null,
    productType: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearProduct: (state) => {
      state.product = null;
      state.productType = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 🔹 Pending
      .addCase(fetchProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      // 🔹 Success
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.product = action.payload.product;
        state.productType = action.payload.productType;
      })

      // 🔹 Error
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearProduct } = productDetailsSlice.actions;

export default productDetailsSlice.reducer;
