import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/dropproducts`;

export const createDropproduct = createAsyncThunk(
  'dropproducts/create',
  async (productData, { rejectWithValue }) => {
    try {
      const formData = new FormData();

      formData.append('name', productData.name || '');
      formData.append('description', productData.description || '');
      formData.append('category', productData.category || '');
      formData.append('subCategory', productData.subCategory || '');
      formData.append('salePrice', productData.salePrice ?? '');
      formData.append('saleStartAt', productData.saleStartAt ?? '');
      formData.append('saleEndAt', productData.saleEndAt ?? '');
      formData.append('variants', JSON.stringify(productData.variants || []));

      (productData.images || []).forEach((file) => {
        if (file instanceof File) {
          formData.append('images', file);
        }
      });

      if (productData.thumbnail instanceof File) {
        formData.append('thumbnail', productData.thumbnail);
      }

      if (productData.sizeChart instanceof File) {
        formData.append('sizeChart', productData.sizeChart);
      }

      if (productData.isActive !== undefined) {
        formData.append('isActive', String(productData.isActive));
      }
      if (productData.bestSeller !== undefined) {
        formData.append('bestSeller', String(productData.bestSeller));
      }
      if (productData.newArrival !== undefined) {
        formData.append('newArrival', String(productData.newArrival));
      }
      if (productData.removeThumbnail) {
        formData.append('removeThumbnail', 'true');
      }
      if (productData.removeSizeChart) {
        formData.append('removeSizeChart', 'true');
      }

      const response = await axios.post(API_BASE_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data ||
          error.message ||
          'Create dropproduct failed'
      );
    }
  }
);

export const getAllDropproducts = createAsyncThunk(
  'dropproducts/getAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(API_BASE_URL);
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

export const getDropproductBySlug = createAsyncThunk(
  'dropproducts/getBySlug',
  async (slug, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/slug/${slug}`);
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

      Object.entries(productData).forEach(([key, value]) => {
        if (key === 'images' && Array.isArray(value)) {
          value.forEach((file) => {
            if (file instanceof File) {
              formData.append('images', file);
            }
          });
          return;
        }

        if (key === 'variants') {
          formData.append('variants', JSON.stringify(value || []));
          return;
        }

        if ((key === 'thumbnail' || key === 'sizeChart') && value instanceof File) {
          formData.append(key, value);
          return;
        }

        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      const response = await axios.put(`${API_BASE_URL}/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

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
  operation: null,
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
        state.error = action.payload?.message || action.payload || 'Failed to create product';
      })
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
        state.error = action.payload?.message || action.payload || 'Failed to fetch products';
      })
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
        state.error = action.payload?.message || action.payload || 'Failed to fetch product';
      })
      .addCase(getDropproductBySlug.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentProduct = null;
      })
      .addCase(getDropproductBySlug.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = action.payload;
      })
      .addCase(getDropproductBySlug.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || 'Failed to fetch product';
      })
      .addCase(updateDropproduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'update';
      })
      .addCase(updateDropproduct.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.products = state.products.map((product) =>
          product._id === action.payload._id ? action.payload : product
        );
        if (state.currentProduct?._id === action.payload._id) {
          state.currentProduct = action.payload;
        }
      })
      .addCase(updateDropproduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || 'Failed to update product';
      })
      .addCase(deleteDropproduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'delete';
      })
      .addCase(deleteDropproduct.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.products = state.products.filter((product) => product._id !== action.payload);
        if (state.currentProduct?._id === action.payload) {
          state.currentProduct = null;
        }
        state.total -= 1;
      })
      .addCase(deleteDropproduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || 'Failed to delete product';
      });
  },
});

export const selectAllProducts = (state) => state.dropproducts.products;
export const selectCurrentProduct = (state) => state.dropproducts.currentProduct;
export const selectLoading = (state) => state.dropproducts.loading;
export const selectError = (state) => state.dropproducts.error;
export const selectSuccess = (state) => state.dropproducts.success;
export const selectTotalProducts = (state) => state.dropproducts.total;
export const selectOperation = (state) => state.dropproducts.operation;

export const { clearCurrentProduct, clearError, resetOperationState } =
  dropproductSlice.actions;

export default dropproductSlice.reducer;
