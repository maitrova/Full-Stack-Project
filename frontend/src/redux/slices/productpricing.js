// store/slices/productPricingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/admin` || "https://narifighter.online/backend",
  headers: {
    'Content-Type': 'application/json',
  },
});

// Async thunks with explicit token inclusion
export const updateProductPricing = createAsyncThunk(
  'productPricing/update',
  async ({ id, pricingData }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      console.log('Updating pricing for product:', id, pricingData);
      const response = await api.put(`/products/${id}/pricing`, pricingData, config);
      return response.data;
    } catch (error) {
      console.error('Update product pricing error:', error);
      return rejectWithValue(error.response?.data || { message: 'Update failed' });
    }
  }
);

export const getProductPricing = createAsyncThunk(
  'productPricing/get',
  async (id, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      console.log('Fetching pricing for product:', id);
      const response = await api.get(`/products/${id}/pricing`, config);
      return response.data;
    } catch (error) {
      console.error('Get product pricing error:', error);
      return rejectWithValue(error.response?.data || { message: 'Fetch failed' });
    }
  }
);

export const toggleUnlimitedPricing = createAsyncThunk(
  'productPricing/toggleUnlimited',
  async ({ id, enabled, flatCharge, label, description }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      console.log('Toggling unlimited pricing for product:', id, enabled);
      const response = await api.patch(`/products/${id}/pricing/unlimited-toggle`, {
        enabled,
        flatCharge,
        label,
        description
      }, config);
      return response.data;
    } catch (error) {
      console.error('Toggle unlimited pricing error:', error);
      return rejectWithValue(error.response?.data || { message: 'Toggle failed' });
    }
  }
);

export const updateNormalPricing = createAsyncThunk(
  'productPricing/updateNormal',
  async ({ id, fixedSizeInches, pricePerSqInch, sleevePrice }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      console.log('Updating normal pricing for product:', id);
      const response = await api.patch(`/products/${id}/pricing/normal-pricing`, {
        fixedSizeInches,
        pricePerSqInch,
        sleevePrice
      }, config);
      return response.data;
    } catch (error) {
      console.error('Update normal pricing error:', error);
      return rejectWithValue(error.response?.data || { message: 'Update failed' });
    }
  }
);

export const updateBasePrice = createAsyncThunk(
  'productPricing/updateBasePrice',
  async ({ id, basePrice }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      console.log('Updating base price for product:', id, basePrice);
      const response = await api.patch(`/products/${id}/pricing/base-price`, {
        basePrice
      }, config);
      return response.data;
    } catch (error) {
      console.error('Update base price error:', error);
      return rejectWithValue(error.response?.data || { message: 'Update failed' });
    }
  }
);

// Initial state
const initialState = {
  currentProductPricing: null,
  loading: false,
  error: null,
  success: false,
  message: '',
  operation: null
};

// Slice
const productPricingSlice = createSlice({
  name: 'productPricing',
  initialState,
  reducers: {
    resetPricingState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.message = '';
      state.operation = null;
    },
    clearCurrentProductPricing: (state) => {
      state.currentProductPricing = null;
    },
    setSuccess: (state, action) => {
      state.success = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Update product pricing
    builder
      .addCase(updateProductPricing.pending, (state) => {
        console.log('Update product pricing pending');
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = '';
        state.operation = 'update';
      })
      .addCase(updateProductPricing.fulfilled, (state, action) => {
        console.log('Update product pricing fulfilled:', action.payload);
        state.loading = false;
        state.success = true;
        state.currentProductPricing = action.payload?.data || action.payload;
        state.message = action.payload?.message || 'Update successful';
        state.operation = null;
      })
      .addCase(updateProductPricing.rejected, (state, action) => {
        console.log('Update product pricing rejected:', action.payload);
        state.loading = false;
        state.error = action.payload?.error || action.payload?.message || 'Update failed';
        state.success = false;
        state.message = action.payload?.message || action.error?.message || 'Operation failed';
        state.operation = null;
      });

    // Get product pricing
    builder
      .addCase(getProductPricing.pending, (state) => {
        console.log('Get product pricing pending');
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'fetch';
      })
      .addCase(getProductPricing.fulfilled, (state, action) => {
        console.log('Get product pricing fulfilled:', action.payload);
        state.loading = false;
        state.success = true;
        state.currentProductPricing = action.payload?.data || action.payload;
        state.message = action.payload?.message || 'Fetch successful';
        state.operation = null;
      })
      .addCase(getProductPricing.rejected, (state, action) => {
        console.log('Get product pricing rejected:', action.payload);
        state.loading = false;
        state.error = action.payload?.error || action.payload?.message || 'Fetch failed';
        state.success = false;
        state.message = action.payload?.message || 'Operation failed';
        state.operation = null;
      });

    // Toggle unlimited pricing
    builder
      .addCase(toggleUnlimitedPricing.pending, (state) => {
        console.log('Toggle unlimited pricing pending');
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'toggleUnlimited';
      })
      .addCase(toggleUnlimitedPricing.fulfilled, (state, action) => {
        console.log('Toggle unlimited pricing fulfilled:', action.payload);
        state.loading = false;
        state.success = true;
        if (state.currentProductPricing) {
          state.currentProductPricing = {
            ...state.currentProductPricing,
            ...action.payload?.data,
            unlimitedPricing: action.payload?.data?.unlimitedPricing || state.currentProductPricing.unlimitedPricing
          };
        }
        state.message = action.payload?.message || 'Toggle successful';
        state.operation = null;
      })
      .addCase(toggleUnlimitedPricing.rejected, (state, action) => {
        console.log('Toggle unlimited pricing rejected:', action.payload);
        state.loading = false;
        state.error = action.payload?.error || action.payload?.message || 'Toggle failed';
        state.success = false;
        state.message = action.payload?.message || 'Operation failed';
        state.operation = null;
      });

    // Update normal pricing
    builder
      .addCase(updateNormalPricing.pending, (state) => {
        console.log('Update normal pricing pending');
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'updateNormal';
      })
      .addCase(updateNormalPricing.fulfilled, (state, action) => {
        console.log('Update normal pricing fulfilled:', action.payload);
        state.loading = false;
        state.success = true;
        if (state.currentProductPricing) {
          state.currentProductPricing = {
            ...state.currentProductPricing,
            ...action.payload?.data,
            normalPricing: action.payload?.data?.normalPricing || state.currentProductPricing.normalPricing
          };
        }
        state.message = action.payload?.message || 'Update successful';
        state.operation = null;
      })
      .addCase(updateNormalPricing.rejected, (state, action) => {
        console.log('Update normal pricing rejected:', action.payload);
        state.loading = false;
        state.error = action.payload?.error || action.payload?.message || 'Update failed';
        state.success = false;
        state.message = action.payload?.message || 'Operation failed';
        state.operation = null;
      });

    // Update base price
    builder
      .addCase(updateBasePrice.pending, (state) => {
        console.log('Update base price pending');
        state.loading = true;
        state.error = null;
        state.success = false;
        state.operation = 'updateBasePrice';
      })
      .addCase(updateBasePrice.fulfilled, (state, action) => {
        console.log('Update base price fulfilled:', action.payload);
        state.loading = false;
        state.success = true;
        if (state.currentProductPricing) {
          state.currentProductPricing = {
            ...state.currentProductPricing,
            ...action.payload?.data
          };
        }
        state.message = action.payload?.message || 'Update successful';
        state.operation = null;
      })
      .addCase(updateBasePrice.rejected, (state, action) => {
        console.log('Update base price rejected:', action.payload);
        state.loading = false;
        state.error = action.payload?.error || action.payload?.message || 'Update failed';
        state.success = false;
        state.message = action.payload?.message || 'Operation failed';
        state.operation = null;
      });
  }
});

// Selectors
export const selectCurrentProductPricing = (state) => state.productPricing.currentProductPricing;
export const selectPricingLoading = (state) => state.productPricing.loading;
export const selectPricingError = (state) => state.productPricing.error;
export const selectPricingSuccess = (state) => state.productPricing.success;
export const selectPricingMessage = (state) => state.productPricing.message;
export const selectPricingOperation = (state) => state.productPricing.operation;

// Check if specific operation is loading
export const selectIsUpdateLoading = (state) => 
  state.productPricing.loading && state.productPricing.operation === 'update';
export const selectIsFetchLoading = (state) => 
  state.productPricing.loading && state.productPricing.operation === 'fetch';
export const selectIsToggleUnlimitedLoading = (state) => 
  state.productPricing.loading && state.productPricing.operation === 'toggleUnlimited';
export const selectIsUpdateNormalLoading = (state) => 
  state.productPricing.loading && state.productPricing.operation === 'updateNormal';
export const selectIsUpdateBasePriceLoading = (state) => 
  state.productPricing.loading && state.productPricing.operation === 'updateBasePrice';

// Check if unlimited pricing is enabled
export const selectIsUnlimitedPricingEnabled = (state) => 
  state.productPricing.currentProductPricing?.unlimitedPricing?.enabled || false;

// Check current pricing mode
export const selectCurrentPricingMode = (state) => 
  state.productPricing.currentProductPricing?.pricingMode || 'normal';

// Get normal pricing details
export const selectNormalPricing = (state) => 
  state.productPricing.currentProductPricing?.normalPricing || {};

// Get unlimited pricing details
export const selectUnlimitedPricing = (state) => 
  state.productPricing.currentProductPricing?.unlimitedPricing || {};

// Action creators
export const { resetPricingState, clearCurrentProductPricing, setSuccess, setError } = productPricingSlice.actions;

// Reducer
export default productPricingSlice.reducer;