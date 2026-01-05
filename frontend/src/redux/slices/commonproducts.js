import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
// Your API client

// Async thunk for fetching common saved data
export const fetchCommonSavedData = createAsyncThunk(
  'commonSavedData/fetchCommonSavedData',
  async ({ page = 1, limit = 50 } = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get('http://localhost:5000/savedata/common', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Async thunk for fetching more data (infinite scroll/pagination)
export const fetchMoreCommonSavedData = createAsyncThunk(
  'commonSavedData/fetchMoreCommonSavedData',
  async ({ page, limit = 50 }, { rejectWithValue, getState }) => {
    try {
      const response = await axios.get('http://localhost:5000/savedata/common', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  items: [],
  page: 1,
  limit: 50,
  total: 0,
  returned: 0,
  loading: false,
  loadingMore: false,
  error: null,
  success: false,
  hasMore: true,
};

const commonSavedDataSlice = createSlice({
  name: 'commonSavedData',
  initialState,
  reducers: {
    // Reset the state
    resetCommonSavedData: (state) => {
      state.items = [];
      state.page = 1;
      state.total = 0;
      state.returned = 0;
      state.error = null;
      state.success = false;
      state.hasMore = true;
    },
    
    // Update filters or search criteria
    updateFilters: (state, action) => {
      // You can extend this to handle filtering client-side
      state.filters = action.payload;
    },
    
    // Clear any errors
    clearError: (state) => {
      state.error = null;
    },
    
    // Manually add an item (for optimistic updates)
    addItem: (state, action) => {
      state.items.unshift(action.payload);
      state.total += 1;
      state.returned += 1;
    },
    
    // Update an existing item
    updateItem: (state, action) => {
      const index = state.items.findIndex(item => item._id === action.payload._id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    },
    
    // Remove an item
    removeItem: (state, action) => {
      state.items = state.items.filter(item => item._id !== action.payload._id);
      state.total = Math.max(0, state.total - 1);
      state.returned = Math.max(0, state.returned - 1);
    },
    
    // Sort items client-side (if needed)
    sortItems: (state, action) => {
      const { field, order } = action.payload;
      state.items.sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        
        if (order === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // Initial fetch
      .addCase(fetchCommonSavedData.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(fetchCommonSavedData.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.total = action.payload.total;
        state.returned = action.payload.returned;
        state.hasMore = state.items.length < action.payload.total;
      })
      .addCase(fetchCommonSavedData.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload || 'Failed to fetch data';
      })
      
      // Fetch more (pagination)
      .addCase(fetchMoreCommonSavedData.pending, (state) => {
        state.loadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreCommonSavedData.fulfilled, (state, action) => {
        state.loadingMore = false;
        state.success = true;
        
        // Append new items to existing ones
        state.items = [...state.items, ...action.payload.items];
        state.page = action.payload.page;
        state.total = action.payload.total;
        state.returned = state.items.length;
        state.hasMore = state.items.length < action.payload.total;
      })
      .addCase(fetchMoreCommonSavedData.rejected, (state, action) => {
        state.loadingMore = false;
        state.error = action.payload || 'Failed to fetch more data';
      });
  },
});

// Selectors
export const selectCommonSavedData = (state) => state.commonSavedData.items;
export const selectCommonSavedDataLoading = (state) => state.commonSavedData.loading;
export const selectCommonSavedDataLoadingMore = (state) => state.commonSavedData.loadingMore;
export const selectCommonSavedDataError = (state) => state.commonSavedData.error;
export const selectCommonSavedDataSuccess = (state) => state.commonSavedData.success;
export const selectCommonSavedDataPagination = (state) => ({
  page: state.commonSavedData.page,
  limit: state.commonSavedData.limit,
  total: state.commonSavedData.total,
  returned: state.commonSavedData.returned,
  hasMore: state.commonSavedData.hasMore,
});

// Selector for filtered data (client-side filtering if needed)
export const selectFilteredCommonSavedData = (state) => {
  const items = state.commonSavedData.items;
  const filters = state.commonSavedData.filters || {};
  
  return items.filter(item => {
    // Type filter
    if (filters.type && item.type !== filters.type) return false;
    
    // Category filter
    if (filters.category && item.category !== filters.category) return false;
    
    // Subcategory filter
    if (filters.subCategory && item.subCategory !== filters.subCategory) return false;
    
    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.subCategory?.toLowerCase().includes(searchLower)
      );
    }
    
    // Stock filter
    if (filters.inStockOnly && item.stock <= 0) return false;
    
    // Price range filter
    if (filters.minPrice && item.price < filters.minPrice) return false;
    if (filters.maxPrice && item.price > filters.maxPrice) return false;
    
    return true;
  });
};

// Selector for getting items by type
export const selectCommonSavedDataByType = (type) => (state) => 
  state.commonSavedData.items.filter(item => item.type === type);

// Selector for getting a specific item by ID
export const selectCommonSavedDataById = (id) => (state) =>
  state.commonSavedData.items.find(item => item._id === id);

export const { 
  resetCommonSavedData, 
  updateFilters, 
  clearError, 
  addItem, 
  updateItem, 
  removeItem,
  sortItems 
} = commonSavedDataSlice.actions;

export default commonSavedDataSlice.reducer;