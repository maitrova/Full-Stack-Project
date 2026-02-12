import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { selectCurrentToken } from "./Userslice.js";


const BASE_URL = import.meta.env.VITE_API_URL;

// 🔥 Async thunk to download invoice
export const downloadInvoice = createAsyncThunk(
  "invoice/downloadInvoice",
  async (orderId, { rejectWithValue,getState }) => {
    try {
        const state = getState();
       const token = selectCurrentToken(state);

      const response = await fetch(
        `${BASE_URL}/invoice/orders/${orderId}/invoice`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || "Failed to download invoice");
      }

      // Convert to blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      link.remove();

      return { success: true, orderId };
    } catch (error) {
      return rejectWithValue(error.message || "Invoice download failed");
    }
  }
);

const invoiceSlice = createSlice({
  name: "invoice",
  initialState: {
    loading: false,
    error: null,
    success: false,
    downloadingOrderId: null,
  },
  reducers: {
    resetInvoiceState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.downloadingOrderId = null;
    },
    clearInvoiceError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadInvoice.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.downloadingOrderId = action.meta.arg;
      })
      .addCase(downloadInvoice.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
        state.downloadingOrderId = null;
      })
      .addCase(downloadInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.success = false;
        state.downloadingOrderId = null;
      });
  },
});

export const { resetInvoiceState, clearInvoiceError } = invoiceSlice.actions;

export default invoiceSlice.reducer;

// Selectors
export const selectInvoiceLoading = (state) => state.invoice.loading;
export const selectInvoiceError = (state) => state.invoice.error;
export const selectInvoiceSuccess = (state) => state.invoice.success;
export const selectDownloadingOrderId = (state) => state.invoice.downloadingOrderId;