import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_API_URL}/brands`;

/* ==========================================
   BRAND THUNKS
========================================== */

// CREATE BRAND
export const createBrand = createAsyncThunk(
  "brand/createBrand",
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/brand`, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create brand"
      );
    }
  }
);

// GET ALL BRANDS
export const fetchBrands = createAsyncThunk(
  "brand/fetchBrands",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/brand`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch brands"
      );
    }
  }
);

// GET BRANDS BY SUBCATEGORY
export const fetchBrandsBySubCategory = createAsyncThunk(
  "brand/fetchBrandsBySubCategory",
  async (subCategoryId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/brand/subcategory/${subCategoryId}`
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          "Failed to fetch brands by subcategory"
      );
    }
  }
);

// UPDATE BRAND
export const updateBrand = createAsyncThunk(
  "brand/updateBrand",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${BASE_URL}/brand/${id}`, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update brand"
      );
    }
  }
);

// DELETE BRAND
export const deleteBrand = createAsyncThunk(
  "brand/deleteBrand",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE_URL}/brand/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete brand"
      );
    }
  }
);

/* ==========================================
   SLICE
========================================== */

const brandSlice = createSlice({
  name: "brand",
  initialState: {
    brands: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearBrands: (state) => {
      state.brands = [];
    },
  },
  extraReducers: (builder) => {
    builder

      /* ---------------- FETCH ALL ---------------- */
      .addCase(fetchBrands.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.loading = false;
        state.brands = action.payload;
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      /* -------- FETCH BY SUBCATEGORY -------- */
      .addCase(fetchBrandsBySubCategory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBrandsBySubCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.brands = action.payload;
      })
      .addCase(fetchBrandsBySubCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      /* ---------------- CREATE ---------------- */
      .addCase(createBrand.fulfilled, (state, action) => {
        state.brands.unshift(action.payload);
      })

      /* ---------------- UPDATE ---------------- */
      .addCase(updateBrand.fulfilled, (state, action) => {
        const index = state.brands.findIndex(
          (brand) => brand._id === action.payload._id
        );

        if (index !== -1) {
          state.brands[index] = action.payload;
        }
      })

      /* ---------------- DELETE ---------------- */
      .addCase(deleteBrand.fulfilled, (state, action) => {
        state.brands = state.brands.filter(
          (brand) => brand._id !== action.payload
        );
      });
  },
});

export const { clearBrands } = brandSlice.actions;
export default brandSlice.reducer;
