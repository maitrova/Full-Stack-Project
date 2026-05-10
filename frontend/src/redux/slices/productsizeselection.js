// productSizeSelectionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL;

// Async thunk to fetch product price
export const fetchProductPrice = createAsyncThunk(
  'productSizeSelection/fetchProductPrice',
  async ({ designId, selectedSize }, { rejectWithValue }) => {
    try {
      console.log(`Fetching price for design: ${designId}, size: ${selectedSize}`);
      const response = await axios.get(`${API_URL}/designsizeselection/product/${designId}/price/${selectedSize}`);
      console.log('Price API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Price API error:', error.response?.data || error.message);
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to fetch price',
        status: error.response?.status || 500
      });
    }
  }
);

const initialState = {
  designId: null,
  selectedSize: null,
  priceDetails: {
    basePrice: 0,
    additionalCharges: 0,
    calculatedPrice: 0,
    size: null,
    currency: 'INR',
    priceBreakdown: {
      designLayers: [],
      textLayers: [],
      minimumDesignCharges: 0,
      totalCustomization: 0
    }
  },
  isLoading: false,
  error: null,
  availableSizes: [],
  isSizeSelected: false
};

const productSizeSelectionSlice = createSlice({
  name: 'productSizeSelection',
  initialState,
  reducers: {
    // Set design ID
    setDesignId: (state, action) => {
      state.designId = action.payload;
    },
    
    // Select a size
    selectSize: (state, action) => {
      state.selectedSize = action.payload;
      state.isSizeSelected = true;
    },
    
    // Clear size selection
    clearSizeSelection: (state) => {
      state.selectedSize = null;
      state.isSizeSelected = false;
      state.priceDetails = initialState.priceDetails;
    },
    
    // Set available sizes
    setAvailableSizes: (state, action) => {
      state.availableSizes = action.payload;
    },
    
    // Reset to initial state
    resetProductSizeSelection: () => initialState,
    
    // Manually update price details (for local calculations or fallback)
    updatePriceDetails: (state, action) => {
      state.priceDetails = {
        ...state.priceDetails,
        ...action.payload
      };
    },
    
    // Calculate price locally as fallback
    calculatePriceLocally: (state, action) => {
      const { basePrice, selectedSize } = action.payload;
      // Simple size-based pricing logic
      const sizeMultipliers = {
        'S': 1.0,
        'M': 1.1,
        'L': 1.2,
        'XL': 1.3,
        'XXL': 1.4
      };
      
      const multiplier = sizeMultipliers[selectedSize] || 1.0;
      const calculatedPrice = basePrice * multiplier;
      
      state.priceDetails = {
        basePrice,
        additionalCharges: calculatedPrice - basePrice,
        calculatedPrice,
        size: selectedSize,
        currency: 'INR',
        priceBreakdown: {
          designLayers: [],
          textLayers: [],
          minimumDesignCharges: 0,
          totalCustomization: 0
        }
      };
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchProductPrice pending
      .addCase(fetchProductPrice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      // Handle fetchProductPrice fulfilled
      .addCase(fetchProductPrice.fulfilled, (state, action) => {
        state.isLoading = false;
        state.priceDetails = action.payload;
        state.error = null;
      })
      // Handle fetchProductPrice rejected
      .addCase(fetchProductPrice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch price';
        
        // Keep the current size selected even if price fetch fails
        state.isSizeSelected = state.selectedSize !== null;
      });
  }
});

// Export actions
export const {
  setDesignId,
  selectSize,
  clearSizeSelection,
  setAvailableSizes,
  resetProductSizeSelection,
  updatePriceDetails,
  calculatePriceLocally,
  clearError
} = productSizeSelectionSlice.actions;

// Export selectors
export const selectProductSizeSelection = (state) => state.productSizeSelection;
export const selectSelectedSize = (state) => state.productSizeSelection.selectedSize;
export const selectPriceDetails = (state) => state.productSizeSelection.priceDetails;
export const selectIsLoading = (state) => state.productSizeSelection.isLoading;
export const selectError = (state) => state.productSizeSelection.error;
export const selectAvailableSizes = (state) => state.productSizeSelection.availableSizes;
export const selectIsSizeSelected = (state) => state.productSizeSelection.isSizeSelected;
export const selectTotalPrice = (state) => state.productSizeSelection.priceDetails.calculatedPrice;

export default productSizeSelectionSlice.reducer;