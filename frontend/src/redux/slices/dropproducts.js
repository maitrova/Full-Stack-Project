// dropproductSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Base URL for API calls
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/dropproducts`; // Update with your actual API URL

// Async thunks
export const createDropproduct = createAsyncThunk(
  'dropproducts/create',
  async (productData, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      
      // Append product fields
      Object.keys(productData).forEach((key) => {
  if (key === "images" && Array.isArray(productData[key])) {
    productData[key].forEach((file) => formData.append("images", file));
  } else if (key === "variants") {
    // ✅ important
    formData.append("variants", JSON.stringify(productData.variants || []));
  } else {
    formData.append(key, productData[key]);
  }
});


      const response = await axios.post(
        `${API_BASE_URL}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getAllDropproducts = createAsyncThunk(
  'dropproducts/getAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getDropproductById = createAsyncThunk(
  'dropproducts/getById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateDropproduct = createAsyncThunk(
  'dropproducts/update',
  async ({ id, productData }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      
      // Append product fields
      Object.keys(productData).forEach((key) => {
  if (key === "images" && Array.isArray(productData[key])) {
    productData[key].forEach((file) => {
      if (file instanceof File) formData.append("images", file);
    });
  } else if (key === "variants") {
    // ✅ important
    formData.append("variants", JSON.stringify(productData.variants || []));
  } else {
    formData.append(key, productData[key]);
  }
});


      const response = await axios.put(
        `${API_BASE_URL}/${id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteDropproduct = createAsyncThunk(
  'dropproducts/delete',
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  products: [],
  currentProduct: null,
  loading: false,
  error: null,
  success: false,
  total: 0,
  operation: null, // 'create', 'update', 'delete', 'fetch'
};

const dropproductSlice = createSlice({
  name: 'dropproducts',
  initialState,
  reducers: {
    clearCurrentProduct: (state) => {
      state.currentProduct = null;
    },
    clearError: (state) => {
      state.error = null;
      state.success = false;
    },
    resetOperationState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.operation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Dropproduct
      .addCase(createDropproduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'create';
      })
      .addCase(createDropproduct.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.products.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createDropproduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create product';
      })

      // Get All Dropproducts
      .addCase(getAllDropproducts.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.operation = 'fetch';
      })
      .addCase(getAllDropproducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
        state.total = action.payload.length;
      })
      .addCase(getAllDropproducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch products';
      })

      // Get Dropproduct by ID
      .addCase(getDropproductById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentProduct = null;
      })
      .addCase(getDropproductById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = action.payload;
      })
      .addCase(getDropproductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch product';
      })

      // Update Dropproduct
      .addCase(updateDropproduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'update';
      })
      .addCase(updateDropproduct.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.products = state.products.map(product =>
          product._id === action.payload._id ? action.payload : product
        );
        if (state.currentProduct?._id === action.payload._id) {
          state.currentProduct = action.payload;
        }
      })
      .addCase(updateDropproduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update product';
      })

      // Delete Dropproduct
      .addCase(deleteDropproduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'delete';
      })
      .addCase(deleteDropproduct.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.products = state.products.filter(
          product => product._id !== action.payload
        );
        if (state.currentProduct?._id === action.payload) {
          state.currentProduct = null;
        }
        state.total -= 1;
      })
      .addCase(deleteDropproduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete product';
      });
  },
});

// Selectors
export const selectAllProducts = (state) => state.dropproducts.products;
export const selectCurrentProduct = (state) => state.dropproducts.currentProduct;
export const selectLoading = (state) => state.dropproducts.loading;
export const selectError = (state) => state.dropproducts.error;
export const selectSuccess = (state) => state.dropproducts.success;
export const selectTotalProducts = (state) => state.dropproducts.total;
export const selectOperation = (state) => state.dropproducts.operation;

export const { clearCurrentProduct, clearError, resetOperationState } = dropproductSlice.actions;

export default dropproductSlice.reducer;