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

export const cancelMyOrder = createAsyncThunk(
  "orders/cancelMyOrder",
  async (orderId, { getState, rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${API_URL}/${orderId}/cancel`,
        {},
        {
          headers: {
            ...getAuthHeaders(getState),
          },
          withCredentials: true,
        }
      );
      return res.data.order;
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const submitReturnRequest = createAsyncThunk(
  "orders/submitReturnRequest",
  async ({ orderId, formData }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/${orderId}/return-request`, formData, {
        headers: {
          ...getAuthHeaders(getState),
          "Content-Type": "multipart/form-data",
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
 * filters = { paymentStatus, orderStatus, userId, dateFrom, dateTo }
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
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

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

export const adminFetchReturnRequests = createAsyncThunk(
  "orders/adminFetchReturnRequests",
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/admin/returns`, {
        headers: { ...getAuthHeaders(getState) },
        withCredentials: true,
      });
      return res.data.orders || [];
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const adminUpdateReturnRequest = createAsyncThunk(
  "orders/adminUpdateReturnRequest",
  async ({ orderId, status, adminDecisionNote }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${API_URL}/admin/returns/${orderId}`,
        { status, adminDecisionNote },
        {
          headers: { ...getAuthHeaders(getState) },
          withCredentials: true,
        }
      );
      return res.data.order;
    } catch (err) {
      return rejectWithValue(normalizeAxiosError(err));
    }
  }
);

export const adminUpdateReturnRefundStatus = createAsyncThunk(
  "orders/adminUpdateReturnRefundStatus",
  async ({ orderId, refundStatus }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${API_URL}/admin/returns/${orderId}/refund-status`,
        { refundStatus },
        {
          headers: { ...getAuthHeaders(getState) },
          withCredentials: true,
        }
      );
      return res.data.order;
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
  cancelMyOrderLoading: false,
  cancelMyOrderError: null,
  cancellingOrderId: null,
  submitReturnLoading: false,
  submitReturnError: null,
  returnSubmittingOrderId: null,

  // admin
  adminOrders: [],
  adminOrdersLoading: false,
  adminOrdersError: null,

  adminOrder: null,
  adminOrderLoading: false,
  adminOrderError: null,
  adminReturns: [],
  adminReturnsLoading: false,
  adminReturnsError: null,

  // status updates
  updateStatusLoading: false,
  updateStatusError: null,

  bulkUpdateLoading: false,
  bulkUpdateError: null,
  updateReturnLoading: false,
  updateReturnError: null,

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
      state.cancelMyOrderError = null;
      state.submitReturnError = null;
      state.adminOrdersError = null;
      state.adminOrderError = null;
      state.adminReturnsError = null;
      state.updateStatusError = null;
      state.bulkUpdateError = null;
      state.updateReturnError = null;
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
      })
      .addCase(cancelMyOrder.pending, (state, action) => {
        state.cancelMyOrderLoading = true;
        state.cancelMyOrderError = null;
        state.cancellingOrderId = action.meta.arg || null;
      })
      .addCase(cancelMyOrder.fulfilled, (state, action) => {
        state.cancelMyOrderLoading = false;
        state.cancellingOrderId = null;

        const updated = action.payload;
        if (!updated?._id) return;

        const listIndex = state.myPaidOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (listIndex >= 0) {
          state.myPaidOrders[listIndex] = { ...state.myPaidOrders[listIndex], ...updated };
        }

        if (state.myPaidOrder && String(state.myPaidOrder._id) === String(updated._id)) {
          state.myPaidOrder = { ...state.myPaidOrder, ...updated };
        }

        const adminIndex = state.adminOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (adminIndex >= 0) {
          state.adminOrders[adminIndex] = { ...state.adminOrders[adminIndex], ...updated };
        }

        if (state.adminOrder && String(state.adminOrder._id) === String(updated._id)) {
          state.adminOrder = { ...state.adminOrder, ...updated };
        }
      })
      .addCase(cancelMyOrder.rejected, (state, action) => {
        state.cancelMyOrderLoading = false;
        state.cancellingOrderId = null;
        state.cancelMyOrderError = action.payload || "Failed to cancel order";
      })
      .addCase(submitReturnRequest.pending, (state, action) => {
        state.submitReturnLoading = true;
        state.submitReturnError = null;
        state.returnSubmittingOrderId = action.meta.arg?.orderId || null;
      })
      .addCase(submitReturnRequest.fulfilled, (state, action) => {
        state.submitReturnLoading = false;
        state.returnSubmittingOrderId = null;

        const updated = action.payload;
        if (!updated?._id) return;

        const listIndex = state.myPaidOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (listIndex >= 0) {
          state.myPaidOrders[listIndex] = { ...state.myPaidOrders[listIndex], ...updated };
        }

        if (state.myPaidOrder && String(state.myPaidOrder._id) === String(updated._id)) {
          state.myPaidOrder = { ...state.myPaidOrder, ...updated };
        }

        const adminIndex = state.adminOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (adminIndex >= 0) {
          state.adminOrders[adminIndex] = { ...state.adminOrders[adminIndex], ...updated };
        }

        const adminReturnIndex = state.adminReturns.findIndex((o) => String(o._id) === String(updated._id));
        if (adminReturnIndex >= 0) {
          state.adminReturns[adminReturnIndex] = { ...state.adminReturns[adminReturnIndex], ...updated };
        } else {
          state.adminReturns.unshift(updated);
        }

        if (state.adminOrder && String(state.adminOrder._id) === String(updated._id)) {
          state.adminOrder = { ...state.adminOrder, ...updated };
        }
      })
      .addCase(submitReturnRequest.rejected, (state, action) => {
        state.submitReturnLoading = false;
        state.returnSubmittingOrderId = null;
        state.submitReturnError = action.payload || "Failed to submit return request";
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
      })
      .addCase(adminFetchReturnRequests.pending, (state) => {
        state.adminReturnsLoading = true;
        state.adminReturnsError = null;
      })
      .addCase(adminFetchReturnRequests.fulfilled, (state, action) => {
        state.adminReturnsLoading = false;
        state.adminReturns = action.payload;
      })
      .addCase(adminFetchReturnRequests.rejected, (state, action) => {
        state.adminReturnsLoading = false;
        state.adminReturnsError = action.payload || "Failed to load return requests";
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
      })
      .addCase(adminUpdateReturnRequest.pending, (state) => {
        state.updateReturnLoading = true;
        state.updateReturnError = null;
      })
      .addCase(adminUpdateReturnRequest.fulfilled, (state, action) => {
        state.updateReturnLoading = false;

        const updated = action.payload;
        if (!updated?._id) return;

        const adminReturnIndex = state.adminReturns.findIndex((o) => String(o._id) === String(updated._id));
        if (adminReturnIndex >= 0) {
          state.adminReturns[adminReturnIndex] = { ...state.adminReturns[adminReturnIndex], ...updated };
        } else {
          state.adminReturns.unshift(updated);
        }

        const adminIndex = state.adminOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (adminIndex >= 0) {
          state.adminOrders[adminIndex] = { ...state.adminOrders[adminIndex], ...updated };
        }

        const userIndex = state.myPaidOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (userIndex >= 0) {
          state.myPaidOrders[userIndex] = { ...state.myPaidOrders[userIndex], ...updated };
        }

        if (state.adminOrder && String(state.adminOrder._id) === String(updated._id)) {
          state.adminOrder = { ...state.adminOrder, ...updated };
        }
        if (state.myPaidOrder && String(state.myPaidOrder._id) === String(updated._id)) {
          state.myPaidOrder = { ...state.myPaidOrder, ...updated };
        }
      })
      .addCase(adminUpdateReturnRequest.rejected, (state, action) => {
        state.updateReturnLoading = false;
        state.updateReturnError = action.payload || "Failed to update return request";
      })
      .addCase(adminUpdateReturnRefundStatus.pending, (state) => {
        state.updateReturnLoading = true;
        state.updateReturnError = null;
      })
      .addCase(adminUpdateReturnRefundStatus.fulfilled, (state, action) => {
        state.updateReturnLoading = false;

        const updated = action.payload;
        if (!updated?._id) return;

        const adminReturnIndex = state.adminReturns.findIndex((o) => String(o._id) === String(updated._id));
        if (adminReturnIndex >= 0) {
          state.adminReturns[adminReturnIndex] = { ...state.adminReturns[adminReturnIndex], ...updated };
        } else {
          state.adminReturns.unshift(updated);
        }

        const adminIndex = state.adminOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (adminIndex >= 0) {
          state.adminOrders[adminIndex] = { ...state.adminOrders[adminIndex], ...updated };
        }

        const userIndex = state.myPaidOrders.findIndex((o) => String(o._id) === String(updated._id));
        if (userIndex >= 0) {
          state.myPaidOrders[userIndex] = { ...state.myPaidOrders[userIndex], ...updated };
        }

        if (state.adminOrder && String(state.adminOrder._id) === String(updated._id)) {
          state.adminOrder = { ...state.adminOrder, ...updated };
        }
        if (state.myPaidOrder && String(state.myPaidOrder._id) === String(updated._id)) {
          state.myPaidOrder = { ...state.myPaidOrder, ...updated };
        }
      })
      .addCase(adminUpdateReturnRefundStatus.rejected, (state, action) => {
        state.updateReturnLoading = false;
        state.updateReturnError = action.payload || "Failed to update refund status";
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
export const selectCancelMyOrderLoading = (state) => state.orders.cancelMyOrderLoading;
export const selectCancelMyOrderError = (state) => state.orders.cancelMyOrderError;
export const selectCancellingOrderId = (state) => state.orders.cancellingOrderId;
export const selectSubmitReturnLoading = (state) => state.orders.submitReturnLoading;
export const selectSubmitReturnError = (state) => state.orders.submitReturnError;
export const selectReturnSubmittingOrderId = (state) => state.orders.returnSubmittingOrderId;

export const selectAdminOrders = (state) => state.orders.adminOrders;
export const selectAdminOrdersLoading = (state) => state.orders.adminOrdersLoading;
export const selectAdminOrdersError = (state) => state.orders.adminOrdersError;
export const selectAdminReturns = (state) => state.orders.adminReturns;
export const selectAdminReturnsLoading = (state) => state.orders.adminReturnsLoading;
export const selectAdminReturnsError = (state) => state.orders.adminReturnsError;

export const selectAdminOrder = (state) => state.orders.adminOrder;
export const selectAdminOrderLoading = (state) => state.orders.adminOrderLoading;
export const selectAdminOrderError = (state) => state.orders.adminOrderError;

export const selectUpdateStatusLoading = (state) => state.orders.updateStatusLoading;
export const selectUpdateStatusError = (state) => state.orders.updateStatusError;

export const selectBulkUpdateLoading = (state) => state.orders.bulkUpdateLoading;
export const selectBulkUpdateError = (state) => state.orders.bulkUpdateError;
export const selectLastBulkResult = (state) => state.orders.lastBulkResult;
export const selectUpdateReturnLoading = (state) => state.orders.updateReturnLoading;
export const selectUpdateReturnError = (state) => state.orders.updateReturnError;
