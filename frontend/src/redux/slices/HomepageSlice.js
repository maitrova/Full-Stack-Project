// features/homepage/homepageSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Create axios instances with base configuration
const homepageAPI = axios.create({
  baseURL: 'http://localhost:5000/api/homepage',
  timeout: 10000,
});

// Async thunks for New Arrivals
export const fetchEligibleNewArrivals = createAsyncThunk(
  'homepage/fetchEligibleNewArrivals',
  async (_, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.get('/new-arrivals/eligible');
      return { type: 'newArrivals', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch eligible new arrivals'
      );
    }
  }
);

export const setHomepageNewArrivals = createAsyncThunk(
  'homepage/setHomepageNewArrivals',
  async (items, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.post('/new-arrivals/select', { items });
      return { type: 'newArrivals', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to set homepage new arrivals'
      );
    }
  }
);

export const fetchHomepageNewArrivals = createAsyncThunk(
  'homepage/fetchHomepageNewArrivals',
  async (_, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.get('/new-arrivals');
      return { type: 'newArrivals', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch homepage new arrivals'
      );
    }
  }
);

// Async thunks for Best Sellers
export const fetchEligibleBestSellers = createAsyncThunk(
  'homepage/fetchEligibleBestSellers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.get('/best-sellers/eligible');
      return { type: 'bestSellers', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch eligible best sellers'
      );
    }
  }
);

export const setHomepageBestSellers = createAsyncThunk(
  'homepage/setHomepageBestSellers',
  async (items, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.post('/best-sellers/select', { items });
      return { type: 'bestSellers', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to set homepage best sellers'
      );
    }
  }
);

export const fetchHomepageBestSellers = createAsyncThunk(
  'homepage/fetchHomepageBestSellers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await homepageAPI.get('/best-sellers');
      return { type: 'bestSellers', data: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch homepage best sellers'
      );
    }
  }
);

// Initial state
const initialState = {
  // New Arrivals
  newArrivals: {
    eligibleItems: [],
    eligibleLoading: false,
    eligibleError: null,
    
    selectedItemIds: [],
    selectedItemsFull: [],
    
    selectedLoading: false,
    selectedError: null,
    
    settingItems: false,
    settingError: null,
  },
  
  // Best Sellers
  bestSellers: {
    eligibleItems: [],
    eligibleLoading: false,
    eligibleError: null,
    
    selectedItemIds: [],
    selectedItemsFull: [],
    
    selectedLoading: false,
    selectedError: null,
    
    settingItems: false,
    settingError: null,
  },
  
  // Common operation status
  operationSuccess: null,
  operationMessage: '',
  operationType: null, // 'newArrivals' or 'bestSellers'
};

// Create slice
const homepageSlice = createSlice({
  name: 'homepage',
  initialState,
  reducers: {
    // Reset operation status
    resetOperationStatus: (state) => {
      state.operationSuccess = null;
      state.operationMessage = '';
      state.operationType = null;
      state.newArrivals.eligibleError = null;
      state.newArrivals.selectedError = null;
      state.newArrivals.settingError = null;
      state.bestSellers.eligibleError = null;
      state.bestSellers.selectedError = null;
      state.bestSellers.settingError = null;
    },
    
    // Clear all data (useful for logout)
    clearHomepageData: (state) => {
      state.newArrivals = initialState.newArrivals;
      state.bestSellers = initialState.bestSellers;
      state.operationSuccess = null;
      state.operationMessage = '';
      state.operationType = null;
    },
    
    // Manually add/remove items from selection (for admin UI)
    toggleItemSelection: (state, action) => {
      const { section, itemType, itemId } = action.payload;
      const sectionState = state[section];
      
      if (!sectionState) return;
      
      const existingIndex = sectionState.selectedItemIds.findIndex(
        item => item.itemType === itemType && item.itemId === itemId
      );
      
      if (existingIndex >= 0) {
        // Remove from selection
        sectionState.selectedItemIds.splice(existingIndex, 1);
        
        // Also remove from full items if present
        const fullIndex = sectionState.selectedItemsFull.findIndex(
          item => item.type === itemType && item._id === itemId
        );
        if (fullIndex >= 0) {
          sectionState.selectedItemsFull.splice(fullIndex, 1);
        }
      } else {
        // Add to selection
        sectionState.selectedItemIds.push({ itemType, itemId });
        
        // Try to find the item in eligible items to add to full items
        const eligibleItem = sectionState.eligibleItems.find(
          item => item.type === itemType && item._id === itemId
        );
        if (eligibleItem) {
          sectionState.selectedItemsFull.push(eligibleItem);
        }
      }
    },
    
    // Clear current selection for a specific section
    clearSelection: (state, action) => {
      const { section } = action.payload;
      const sectionState = state[section];
      
      if (sectionState) {
        sectionState.selectedItemIds = [];
        sectionState.selectedItemsFull = [];
      }
    },
    
    // Set selection from saved data for a specific section
    setSelectionFromData: (state, action) => {
      const { section, items } = action.payload;
      const sectionState = state[section];
      
      if (sectionState) {
        sectionState.selectedItemIds = items.map(item => ({
          itemType: item.type,
          itemId: item._id
        }));
        sectionState.selectedItemsFull = items;
      }
    },
    
    // Clear selection for both sections
    clearAllSelections: (state) => {
      state.newArrivals.selectedItemIds = [];
      state.newArrivals.selectedItemsFull = [];
      state.bestSellers.selectedItemIds = [];
      state.bestSellers.selectedItemsFull = [];
    },
  },
  extraReducers: (builder) => {
    // Helper function to handle fetch eligible
    const handleFetchEligible = (section) => (state, action) => {
      const sectionState = state[section];
      if (action.payload.type === section) {
        sectionState.eligibleLoading = false;
        sectionState.eligibleItems = action.payload.data.eligible || [];
      }
    };
    
    // Helper function to handle set items
    const handleSetItems = (section) => (state, action) => {
      if (action.payload.type === section) {
        const sectionState = state[section];
        sectionState.settingItems = false;
        state.operationSuccess = true;
        state.operationMessage = `${section === 'newArrivals' ? 'New arrivals' : 'Best sellers'} updated successfully`;
        state.operationType = section;
        
        // Update selected items from server response
        if (action.payload.data.data?.items) {
          const items = action.payload.data.data.items;
          sectionState.selectedItemIds = items.map(item => ({
            itemType: item.itemType,
            itemId: item.itemId
          }));
        }
      }
    };
    
    // Helper function to handle fetch selected items
    const handleFetchSelected = (section) => (state, action) => {
      if (action.payload.type === section) {
        const sectionState = state[section];
        sectionState.selectedLoading = false;
        sectionState.selectedItemsFull = action.payload.data.items || [];
        
        // Convert full items to IDs for selection
        sectionState.selectedItemIds = action.payload.data.items.map(item => ({
          itemType: item.type,
          itemId: item._id
        })) || [];
      }
    };
    
    // New Arrivals - Fetch eligible
    builder
      .addCase(fetchEligibleNewArrivals.pending, (state) => {
        state.newArrivals.eligibleLoading = true;
        state.newArrivals.eligibleError = null;
      })
      .addCase(fetchEligibleNewArrivals.fulfilled, handleFetchEligible('newArrivals'))
      .addCase(fetchEligibleNewArrivals.rejected, (state, action) => {
        state.newArrivals.eligibleLoading = false;
        state.newArrivals.eligibleError = action.payload || action.error.message;
      });
    
    // New Arrivals - Set items
    builder
      .addCase(setHomepageNewArrivals.pending, (state) => {
        state.newArrivals.settingItems = true;
        state.newArrivals.settingError = null;
        state.operationSuccess = null;
        state.operationMessage = '';
        state.operationType = null;
      })
      .addCase(setHomepageNewArrivals.fulfilled, handleSetItems('newArrivals'))
      .addCase(setHomepageNewArrivals.rejected, (state, action) => {
        state.newArrivals.settingItems = false;
        state.newArrivals.settingError = action.payload || action.error.message;
        state.operationSuccess = false;
        state.operationMessage = action.payload || 'Failed to update new arrivals';
        state.operationType = 'newArrivals';
      });
    
    // New Arrivals - Fetch selected
    builder
      .addCase(fetchHomepageNewArrivals.pending, (state) => {
        state.newArrivals.selectedLoading = true;
        state.newArrivals.selectedError = null;
      })
      .addCase(fetchHomepageNewArrivals.fulfilled, handleFetchSelected('newArrivals'))
      .addCase(fetchHomepageNewArrivals.rejected, (state, action) => {
        state.newArrivals.selectedLoading = false;
        state.newArrivals.selectedError = action.payload || action.error.message;
      });
    
    // Best Sellers - Fetch eligible
    builder
      .addCase(fetchEligibleBestSellers.pending, (state) => {
        state.bestSellers.eligibleLoading = true;
        state.bestSellers.eligibleError = null;
      })
      .addCase(fetchEligibleBestSellers.fulfilled, handleFetchEligible('bestSellers'))
      .addCase(fetchEligibleBestSellers.rejected, (state, action) => {
        state.bestSellers.eligibleLoading = false;
        state.bestSellers.eligibleError = action.payload || action.error.message;
      });
    
    // Best Sellers - Set items
    builder
      .addCase(setHomepageBestSellers.pending, (state) => {
        state.bestSellers.settingItems = true;
        state.bestSellers.settingError = null;
        state.operationSuccess = null;
        state.operationMessage = '';
        state.operationType = null;
      })
      .addCase(setHomepageBestSellers.fulfilled, handleSetItems('bestSellers'))
      .addCase(setHomepageBestSellers.rejected, (state, action) => {
        state.bestSellers.settingItems = false;
        state.bestSellers.settingError = action.payload || action.error.message;
        state.operationSuccess = false;
        state.operationMessage = action.payload || 'Failed to update best sellers';
        state.operationType = 'bestSellers';
      });
    
    // Best Sellers - Fetch selected
    builder
      .addCase(fetchHomepageBestSellers.pending, (state) => {
        state.bestSellers.selectedLoading = true;
        state.bestSellers.selectedError = null;
      })
      .addCase(fetchHomepageBestSellers.fulfilled, handleFetchSelected('bestSellers'))
      .addCase(fetchHomepageBestSellers.rejected, (state, action) => {
        state.bestSellers.selectedLoading = false;
        state.bestSellers.selectedError = action.payload || action.error.message;
      });
  },
});

// Export actions
export const { 
  resetOperationStatus, 
  clearHomepageData, 
  toggleItemSelection, 
  clearSelection,
  setSelectionFromData,
  clearAllSelections 
} = homepageSlice.actions;

// Export selectors for New Arrivals
export const selectNewArrivalsEligibleItems = (state) => state.homepage.newArrivals.eligibleItems;
export const selectNewArrivalsSelectedItemIds = (state) => state.homepage.newArrivals.selectedItemIds;
export const selectNewArrivalsSelectedItemsFull = (state) => state.homepage.newArrivals.selectedItemsFull;
export const selectNewArrivalsEligibleLoading = (state) => state.homepage.newArrivals.eligibleLoading;
export const selectNewArrivalsSelectedLoading = (state) => state.homepage.newArrivals.selectedLoading;
export const selectNewArrivalsSettingLoading = (state) => state.homepage.newArrivals.settingItems;
export const selectNewArrivalsEligibleError = (state) => state.homepage.newArrivals.eligibleError;
export const selectNewArrivalsSelectedError = (state) => state.homepage.newArrivals.selectedError;
export const selectNewArrivalsSettingError = (state) => state.homepage.newArrivals.settingError;
export const selectNewArrivalsCanSubmitSelection = (state) => 
  state.homepage.newArrivals.selectedItemIds.length >= 2 && 
  state.homepage.newArrivals.selectedItemIds.length <= 6;

// Export selectors for Best Sellers
export const selectBestSellersEligibleItems = (state) => state.homepage.bestSellers.eligibleItems;
export const selectBestSellersSelectedItemIds = (state) => state.homepage.bestSellers.selectedItemIds;
export const selectBestSellersSelectedItemsFull = (state) => state.homepage.bestSellers.selectedItemsFull;
export const selectBestSellersEligibleLoading = (state) => state.homepage.bestSellers.eligibleLoading;
export const selectBestSellersSelectedLoading = (state) => state.homepage.bestSellers.selectedLoading;
export const selectBestSellersSettingLoading = (state) => state.homepage.bestSellers.settingItems;
export const selectBestSellersEligibleError = (state) => state.homepage.bestSellers.eligibleError;
export const selectBestSellersSelectedError = (state) => state.homepage.bestSellers.selectedError;
export const selectBestSellersSettingError = (state) => state.homepage.bestSellers.settingError;
export const selectBestSellersCanSubmitSelection = (state) => 
  state.homepage.bestSellers.selectedItemIds.length >= 2 && 
  state.homepage.bestSellers.selectedItemIds.length <= 6;

// Export common selectors
export const selectOperationStatus = (state) => ({
  success: state.homepage.operationSuccess,
  message: state.homepage.operationMessage,
  type: state.homepage.operationType,
});

// Export reducer
export default homepageSlice.reducer;