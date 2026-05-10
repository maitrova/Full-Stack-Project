// src/redux/slices/orderStatusSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// ✅ Base API URL from env
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/email`;

/* ================================
   ASYNC THUNK
================================ */
export const updateOrderStatus = createAsyncThunk(
  "orderStatus/updateOrderStatus",
  async ({ orderId, orderIds, orderStatus }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/orders/status`,
        {
          orderId,
          orderIds,
          orderStatus,
        },
        {
          headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}` // add if needed
          },
        }
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

/* ================================
   SLICE
================================ */
const orderStatusSlice = createSlice({
  name: "orderStatus",
  initialState: {
    loading: false,
    success: false,
    error: null,
    summary: null,
  },
  reducers: {
    resetOrderStatusState: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.summary = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // 🔄 Pending
      .addCase(updateOrderStatus.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })

      // ✅ Fulfilled
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.summary = action.payload.summary;
      })

      // ❌ Rejected
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      });
  },
});

export const { resetOrderStatusState } = orderStatusSlice.actions;

export default orderStatusSlice.reducer;
