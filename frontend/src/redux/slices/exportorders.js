import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

// 🚀 Async Thunk for Export
export const exportOrders = createAsyncThunk(
  "orders/exportOrders",
  async (orderIds, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/admin/excel-export/export-orders`,
        { orderIds },
        {
          responseType: "blob", // 🔥 VERY IMPORTANT for file download
        }
      );

      // 🔥 Create file download
      const url = window.URL.createObjectURL(
        new Blob([response.data])
      );

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `orders_${Date.now()}.xlsx`
      );

      document.body.appendChild(link);
      link.click();
      link.remove();

      return true;

    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Export failed"
      );
    }
  }
);

const exportOrdersSlice = createSlice({
  name: "exportOrders",
  initialState: {
    loading: false,
    success: false,
    error: null,
  },
  reducers: {
    resetExportState: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(exportOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(exportOrders.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(exportOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetExportState } = exportOrdersSlice.actions;

export default exportOrdersSlice.reducer;
