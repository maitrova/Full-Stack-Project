import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { selectCurrentToken } from "./Userslice.js";

const BASE_URL = import.meta.env.VITE_API_URL;

// 🔥 Async thunk to search orders
export const searchOrders = createAsyncThunk(
  "adminSearch/searchOrders",
  async (query, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const token = selectCurrentToken(state);// adjust if your token path is different

      const response = await axios.get(
        `${BASE_URL}/searchproduct/search?q=${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.orders;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Search failed"
      );
    }
  }
);

const adminSearchSlice = createSlice({
  name: "adminSearch",
  initialState: {
    results: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearSearchResults: (state) => {
      state.results = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(searchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults } = adminSearchSlice.actions;

export default adminSearchSlice.reducer;
