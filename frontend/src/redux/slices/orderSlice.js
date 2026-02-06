import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { selectCurrentToken } from "./Userslice";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${BASE_URL}/orders`;

// ---- helpers ----
const getAuthHeaders = (getState) => {
  const state = getState();
  const token = selectCurrentToken(state);

  return token ? { Authorization: `Bearer ${token}` } : {};
};


const normalizeAxiosError = (err) => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "Request failed"
  );
};

// ==============================
// USER THUNKS
// ==============================

export const fetchMyPaidOrders = createAsyncThunk(
  "orders/fetchMyPaidOrders",
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/paid`, {
        headers: {
          ...getAuthHeaders(getState),
        },
        withCredentials: true, // keep if you use cookies; safe otherwise
      });
      return res.data.orders || [];
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const fetchMyPaidOrderById = createAsyncThunk(
  "orders/fetchMyPaidOrderById",
  async (orderId, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/paid/${orderId}`, {
        headers: {
          ...getAuthHeaders(getState),
        },
        withCredentials: true,
      });
      return res.data.order;
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

// ==============================
// ADMIN THUNKS
// ==============================

/**
 * filters = { paymentStatus, orderStatus, userId }
 * any can be omitted
 */
export const adminFetchOrders = createAsyncThunk(
  "orders/adminFetchOrders",
  async (filters = {}, { getState, rejectWithValue }) => {
    try {
      const params = {};
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.orderStatus) params.orderStatus = filters.orderStatus;
      if (filters.userId) params.userId = filters.userId;

      const res = await axios.get(`${API_URL}/admin/orders`, {
        params,
        headers: { ...getAuthHeaders(getState) },
        withCredentials: true,
      });

      return res.data.orders || [];
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const adminFetchOrderById = createAsyncThunk(
  "orders/adminFetchOrderById",
  async (orderId, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/admin/orders/${orderId}`, {
        headers: { ...getAuthHeaders(getState) },
        withCredentials: true,
      });
      return res.data.order;
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const adminUpdateOrderStatus = createAsyncThunk(
  "orders/adminUpdateOrderStatus",
  async ({ orderId, orderStatus }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${API_URL}/admin/orders/${orderId}/order-status`,
        { orderStatus },
        {
          headers: { ...getAuthHeaders(getState) },
          withCredentials: true,
        }
      );
      // returns { message, order }
      return res.data.order;
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const adminBulkUpdateOrderStatus = createAsyncThunk(
  "orders/adminBulkUpdateOrderStatus",
  async ({ orderIds, orderStatus }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${API_URL}/admin/orders/order-status/bulk`,
        { orderIds, orderStatus },
        {
          headers: { ...getAuthHeaders(getState) },
          withCredentials: true,
        }
      );
      // returns { message, matched, modified }
      return { ...res.data, orderIds, orderStatus };
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

// ==============================
// SLICE
// ==============================

const initialState = {
  // user
  myPaidOrders: [],
  myPaidOrdersLoading: false,
  myPaidOrdersError: null,

  myPaidOrder: null,
  myPaidOrderLoading: false,
  myPaidOrderError: null,

  // admin
  adminOrders: [],
  adminOrdersLoading: false,
  adminOrdersError: null,

  adminOrder: null,
  adminOrderLoading: false,
  adminOrderError: null,

  // status updates
  updateStatusLoading: false,
  updateStatusError: null,

  bulkUpdateLoading: false,
  bulkUpdateError: null,

  lastBulkResult: null, // store matched/modified etc.
};

const orderSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    clearMyPaidOrder(state) {
      state.myPaidOrder = null;
      state.myPaidOrderError = null;
    },
    clearAdminOrder(state) {
      state.adminOrder = null;
      state.adminOrderError = null;
    },
    clearOrderErrors(state) {
      state.myPaidOrdersError = null;
      state.myPaidOrderError = null;
      state.adminOrdersError = null;
      state.adminOrderError = null;
      state.updateStatusError = null;
      state.bulkUpdateError = null;
    },
  },
  extraReducers: (builder) => {
    // ----- USER: list paid orders -----
    builder
      .addCase(fetchMyPaidOrders.pending, (state) => {
        state.myPaidOrdersLoading = true;
        state.myPaidOrdersError = null;
      })
      .addCase(fetchMyPaidOrders.fulfilled, (state, action) => {
        state.myPaidOrdersLoading = false;
        state.myPaidOrders = action.payload;
      })
      .addCase(fetchMyPaidOrders.rejected, (state, action) => {
        state.myPaidOrdersLoading = false;
        state.myPaidOrdersError = action.payload || "Failed to load orders";
      });

    // ----- USER: single paid order -----
    builder
      .addCase(fetchMyPaidOrderById.pending, (state) => {
        state.myPaidOrderLoading = true;
        state.myPaidOrderError = null;
      })
      .addCase(fetchMyPaidOrderById.fulfilled, (state, action) => {
        state.myPaidOrderLoading = false;
        state.myPaidOrder = action.payload;
      })
      .addCase(fetchMyPaidOrderById.rejected, (state, action) => {
        state.myPaidOrderLoading = false;
        state.myPaidOrderError = action.payload || "Failed to load order";
      });

    // ----- ADMIN: list orders -----
    builder
      .addCase(adminFetchOrders.pending, (state) => {
        state.adminOrdersLoading = true;
        state.adminOrdersError = null;
      })
      .addCase(adminFetchOrders.fulfilled, (state, action) => {
        state.adminOrdersLoading = false;
        state.adminOrders = action.payload;
      })
      .addCase(adminFetchOrders.rejected, (state, action) => {
        state.adminOrdersLoading = false;
        state.adminOrdersError = action.payload || "Failed to load admin orders";
      });

    // ----- ADMIN: single order -----
    builder
      .addCase(adminFetchOrderById.pending, (state) => {
        state.adminOrderLoading = true;
        state.adminOrderError = null;
      })
      .addCase(adminFetchOrderById.fulfilled, (state, action) => {
        state.adminOrderLoading = false;
        state.adminOrder = action.payload;
      })
      .addCase(adminFetchOrderById.rejected, (state, action) => {
        state.adminOrderLoading = false;
        state.adminOrderError = action.payload || "Failed to load admin order";
      });

    // ----- ADMIN: update single fulfillment status -----
    builder
      .addCase(adminUpdateOrderStatus.pending, (state) => {
        state.updateStatusLoading = true;
        state.updateStatusError = null;
      })
      .addCase(adminUpdateOrderStatus.fulfilled, (state, action) => {
        state.updateStatusLoading = false;

        const updated = action.payload;
        if (!updated?._id) return;

        // update in admin list
        const idx = state.adminOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (idx >= 0) state.adminOrders[idx] = { ...state.adminOrders[idx], ...updated };

        // update admin single
        if (state.adminOrder && String(state.adminOrder._id) === String(updated._id)) {
          state.adminOrder = { ...state.adminOrder, ...updated };
        }

        // update user list if present
        const uIdx = state.myPaidOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (uIdx >= 0) state.myPaidOrders[uIdx] = { ...state.myPaidOrders[uIdx], ...updated };

        // update user single
        if (state.myPaidOrder && String(state.myPaidOrder._id) === String(updated._id)) {
          state.myPaidOrder = { ...state.myPaidOrder, ...updated };
        }
      })
      .addCase(adminUpdateOrderStatus.rejected, (state, action) => {
        state.updateStatusLoading = false;
        state.updateStatusError = action.payload || "Failed to update status";
      });

    // ----- ADMIN: bulk update fulfillment status -----
    builder
      .addCase(adminBulkUpdateOrderStatus.pending, (state) => {
        state.bulkUpdateLoading = true;
        state.bulkUpdateError = null;
        state.lastBulkResult = null;
      })
      .addCase(adminBulkUpdateOrderStatus.fulfilled, (state, action) => {
        state.bulkUpdateLoading = false;
        state.lastBulkResult = action.payload;

        const { orderIds, orderStatus } = action.payload || {};
        if (!Array.isArray(orderIds) || !orderStatus) return;

        // update admin list locally
        const idSet = new Set(orderIds.map(String));
        state.adminOrders = state.adminOrders.map((o) =>
          idSet.has(String(o._id)) ? { ...o, orderStatus } : o
        );

        // update user list locally (if any overlap)
        state.myPaidOrders = state.myPaidOrders.map((o) =>
          idSet.has(String(o._id)) ? { ...o, orderStatus } : o
        );

        // update detail screens if needed
        if (state.adminOrder && idSet.has(String(state.adminOrder._id))) {
          state.adminOrder = { ...state.adminOrder, orderStatus };
        }
        if (state.myPaidOrder && idSet.has(String(state.myPaidOrder._id))) {
          state.myPaidOrder = { ...state.myPaidOrder, orderStatus };
        }
      })
      .addCase(adminBulkUpdateOrderStatus.rejected, (state, action) => {
        state.bulkUpdateLoading = false;
        state.bulkUpdateError = action.payload || "Failed to bulk update";
      });
  },
});

// ---- exports ----
export const {
  clearMyPaidOrder,
  clearAdminOrder,
  clearOrderErrors,
} = orderSlice.actions;

export default orderSlice.reducer;

// ---- selectors ----
export const selectMyPaidOrders = (state) => state.orders.myPaidOrders;
export const selectMyPaidOrdersLoading = (state) => state.orders.myPaidOrdersLoading;
export const selectMyPaidOrdersError = (state) => state.orders.myPaidOrdersError;

export const selectMyPaidOrder = (state) => state.orders.myPaidOrder;
export const selectMyPaidOrderLoading = (state) => state.orders.myPaidOrderLoading;
export const selectMyPaidOrderError = (state) => state.orders.myPaidOrderError;

export const selectAdminOrders = (state) => state.orders.adminOrders;
export const selectAdminOrdersLoading = (state) => state.orders.adminOrdersLoading;
export const selectAdminOrdersError = (state) => state.orders.adminOrdersError;

export const selectAdminOrder = (state) => state.orders.adminOrder;
export const selectAdminOrderLoading = (state) => state.orders.adminOrderLoading;
export const selectAdminOrderError = (state) => state.orders.adminOrderError;

export const selectUpdateStatusLoading = (state) => state.orders.updateStatusLoading;
export const selectUpdateStatusError = (state) => state.orders.updateStatusError;

export const selectBulkUpdateLoading = (state) => state.orders.bulkUpdateLoading;
export const selectBulkUpdateError = (state) => state.orders.bulkUpdateError;
export const selectLastBulkResult = (state) => state.orders.lastBulkResult;
