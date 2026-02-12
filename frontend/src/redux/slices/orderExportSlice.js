import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// ✅ Base API URL from .env
const API_BASE = import.meta.env.VITE_API_URL;

// ================================
// 🔥 Async Thunk to Export Orders
// ================================
export const exportOrdersToExcel = createAsyncThunk(
  "orderExport/exportOrdersToExcel",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/admin/excel-export/export-orders`, {
        responseType: "blob", // 👈 Important for file download
      });

      // 🔹 Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "orders.xlsx");
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

// ================================
// 🔥 Slice
// ================================
const orderExportSlice = createSlice({
  name: "orderExport",
  initialState: {
    loading: false,
    error: null,
    success: false,
  },
  reducers: {
    resetExportState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(exportOrdersToExcel.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(exportOrdersToExcel.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(exportOrdersToExcel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetExportState } = orderExportSlice.actions;
export default orderExportSlice.reducer;
