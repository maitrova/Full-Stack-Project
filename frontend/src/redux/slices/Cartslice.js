// cartSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Import the selector from userSlice
import { selectCurrentToken } from "./Userslice.js";

const getPersistedToken = () => {
  if (typeof window === "undefined") return null;

  try {
    const persistedUser = window.localStorage.getItem("persist:user");
    if (!persistedUser) return null;

    const parsedUser = JSON.parse(persistedUser);
    const userInfo = parsedUser?.userInfo
      ? JSON.parse(parsedUser.userInfo)
      : null;

    return userInfo?.token || null;
  } catch {
    return null;
  }
};

const getAuthToken = (state) => selectCurrentToken(state) || getPersistedToken();
const getAuthHeaders = (state) => {
  const token = getAuthToken(state);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const CART_ADD_DEBUG_PREFIX = "[cart/addToCart]";

const isFormDataPayload = (value) =>
  typeof FormData !== "undefined" && value instanceof FormData;

const truncateValue = (value, maxLength = 300) => {
  if (typeof value !== "string") return value;
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...<truncated>`
    : value;
};

const summarizePayloadValue = (value) => {
  if (typeof File !== "undefined" && value instanceof File) {
    return {
      type: "file",
      name: value.name,
      size: value.size,
      mimeType: value.type,
    };
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      type: "blob",
      size: value.size,
      mimeType: value.type,
    };
  }

  if (typeof value === "string") {
    return truncateValue(value);
  }

  if (value && typeof value === "object") {
    const summary = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      summary[key] = summarizePayloadValue(nestedValue);
    });
    return summary;
  }

  return value;
};

const summarizeCartPayload = (cartData) => {
  if (isFormDataPayload(cartData)) {
    const entries = {};
    cartData.forEach((value, key) => {
      entries[key] = summarizePayloadValue(value);
    });

    return {
      type: "FormData",
      entries,
    };
  }

  if (cartData && typeof cartData === "object") {
    return summarizePayloadValue(cartData);
  }

  return cartData;
};

const extractErrorMessage = (data) => {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.error === "string" && data.error.trim()) return data.error;

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((entry) => entry?.message || entry?.msg || entry)
      .filter(Boolean)
      .join(", ");
  }

  return null;
};

const buildCartErrorPayload = (error) => {
  let errorMessage = "Failed to add item to cart";
  let statusCode = 500;

  if (error.response) {
    statusCode = error.response.status;
    errorMessage = extractErrorMessage(error.response.data) || errorMessage;

    if (statusCode === 401) {
      errorMessage = "Please login again";
    }
  } else if (error.request) {
    errorMessage = "No response from server. Please check your connection.";
  } else {
    errorMessage = error.message || errorMessage;
  }

  return {
    message: errorMessage,
    status: statusCode,
    code: error.code || null,
    data: error.response?.data || null,
    request: error.config
      ? {
          baseURL: error.config.baseURL || null,
          url: error.config.url || null,
          method: error.config.method || null,
          timeout: error.config.timeout || null,
        }
      : null,
  };
};

// Create axios instance with common config
const createApi = () => {
  const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}`,
    timeout: 10000,
    withCredentials: true,
    headers: {
      Accept: "application/json",
    },
  });
  
  return api;
};

// Async thunks with token from Redux state
export const addToCart = createAsyncThunk(
  "cart/addToCart",
  async (cartData, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const api = createApi();
      const requestDebug = {
        baseURL: api.defaults.baseURL || null,
        endpoint: "/cart/add",
        hasToken: Boolean(getAuthToken(state)),
        payload: summarizeCartPayload(cartData),
      };

      console.info(CART_ADD_DEBUG_PREFIX, "Request", requestDebug);
      
      const response = await api.post("/cart/add", cartData, {
        headers: getAuthHeaders(state),
      });

      console.info(CART_ADD_DEBUG_PREFIX, "Success", {
        status: response.status,
        message: response.data?.message || null,
        itemCount: response.data?.cart?.items?.length ?? null,
      });
      
      return response.data;
    } catch (error) {
      const errorPayload = buildCartErrorPayload(error);

      console.error(CART_ADD_DEBUG_PREFIX, "Failed", {
        ...errorPayload,
        payload: summarizeCartPayload(cartData),
      });

      return rejectWithValue(errorPayload);
    }
  }
);

export const getCart = createAsyncThunk(
  "cart/getCart",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const api = createApi();
      
      const response = await api.get("/cart", {
        headers: getAuthHeaders(state),
      });
      
      return response.data;
    } catch (error) {
      let errorMessage = "Failed to fetch cart";
      let statusCode = 500;
      
      if (error.response) {
        statusCode = error.response.status;
        
        // Don't treat empty cart as error
        if (statusCode === 404) {
          return { cart: null };
        }
        
        errorMessage = error.response.data?.message || errorMessage;
        
        if (statusCode === 401) errorMessage = "Please login to continue";
      } else if (error.request) {
        errorMessage = "No response from server";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return rejectWithValue({
        message: errorMessage,
        status: statusCode,
      });
    }
  }
);

export const updateCartItemQty = createAsyncThunk(
  "cart/updateCartItemQty",
  async ({ itemId, qty }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const api = createApi();
      
      const response = await api.patch(
        `/cart/item/${itemId}`,
        { qty },
        {
          headers: getAuthHeaders(state),
        }
      );
      
      return response.data;
    } catch (error) {
      let errorMessage = "Failed to update quantity";
      let statusCode = 500;
      
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = error.response.data?.message || errorMessage;
        
        if (statusCode === 401) {
          errorMessage = "Session expired. Please login again.";
        }
      } else if (error.request) {
        errorMessage = "No response from server";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return rejectWithValue({
        message: errorMessage,
        status: statusCode,
      });
    }
  }
);

export const removeCartItem = createAsyncThunk(
  "cart/removeCartItem",
  async (itemId, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const api = createApi();
      
      const response = await api.delete(`/cart/item/${itemId}`, {
        headers: getAuthHeaders(state),
      });
      
      return { ...response.data, itemId };
    } catch (error) {
      let errorMessage = "Failed to remove item";
      let statusCode = 500;
      
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = error.response.data?.message || errorMessage;
        
        if (statusCode === 401) {
          errorMessage = "Please login again";
        }
      } else if (error.request) {
        errorMessage = "No response from server";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return rejectWithValue({
        message: errorMessage,
        status: statusCode,
      });
    }
  }
);

export const clearCart = createAsyncThunk(
  "cart/clearCart",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const api = createApi();
      
      const response = await api.delete("/cart/clear", {
        headers: getAuthHeaders(state),
      });
      
      return response.data;
    } catch (error) {
      let errorMessage = "Failed to clear cart";
      let statusCode = 500;
      
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = error.response.data?.message || errorMessage;
        
        if (statusCode === 401) {
          errorMessage = "Please login again";
        }
      } else if (error.request) {
        errorMessage = "No response from server";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return rejectWithValue({
        message: errorMessage,
        status: statusCode,
      });
    }
  }
);

// Initial state
const initialState = {
  cart: null,
  loading: false,
  error: null,
  success: false,
  lastAction: null,
  cartSummary: {
    totalItems: 0,
    subtotal: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  },
};

// Helper function to calculate cart summary
const calculateCartSummary = (cart) => {
  if (!cart?.items || cart.items.length === 0) {
    return {
      totalItems: 0,
      subtotal: 0,
      shipping: 0,
      tax: 0,
      total: 0,
    };
  }

  const subtotal = cart.items.reduce((sum, item) => {
    return sum + (item.unitPrice || 0) * (item.qty || 0);
  }, 0);

  const shipping = 0;
  const tax = 0;
  const total = subtotal;

  return {
    totalItems: cart.items.reduce((sum, item) => sum + (item.qty || 0), 0),
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: parseFloat(shipping.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

// Cart slice
const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    resetCartState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.lastAction = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = false;
    },
    // Local cart manipulation (useful for optimistic updates)
    updateItemQtyLocally: (state, action) => {
      const { itemId, qty } = action.payload;
      if (state.cart?.items) {
        const itemIndex = state.cart.items.findIndex(
          (item) => item._id === itemId
        );
        if (itemIndex !== -1) {
          state.cart.items[itemIndex].qty = qty;
          state.cartSummary = calculateCartSummary(state.cart);
        }
      }
    },
    removeItemLocally: (state, action) => {
      const itemId = action.payload;
      if (state.cart?.items) {
        state.cart.items = state.cart.items.filter(
          (item) => item._id !== itemId
        );
        state.cartSummary = calculateCartSummary(state.cart);
      }
    },
    // Reset cart completely (on logout)
    resetCart: () => initialState,
    // Set cart data directly (useful for SSR or initial hydration)
    setCart: (state, action) => {
      state.cart = action.payload;
      state.cartSummary = calculateCartSummary(action.payload);
    },
  },
  extraReducers: (builder) => {
    // Add to Cart
    builder
      .addCase(addToCart.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.lastAction = "addToCart";
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload.cart;
        state.cartSummary = calculateCartSummary(action.payload.cart);
        state.success = true;
        state.error = null;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to add item to cart";
        state.success = false;
      });

    // Get Cart
    builder
      .addCase(getCart.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.lastAction = "getCart";
      })
      .addCase(getCart.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload.cart;
        state.cartSummary = calculateCartSummary(action.payload.cart);
        state.error = null;
      })
      .addCase(getCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch cart";
      });

    // Update Cart Item Quantity
    builder
      .addCase(updateCartItemQty.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.lastAction = "updateCartItemQty";
      })
      .addCase(updateCartItemQty.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload.cart;
        state.cartSummary = calculateCartSummary(action.payload.cart);
        state.success = true;
        state.error = null;
      })
      .addCase(updateCartItemQty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to update item quantity";
        state.success = false;
      });

    // Remove Cart Item
    builder
      .addCase(removeCartItem.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.lastAction = "removeCartItem";
      })
      .addCase(removeCartItem.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload.cart;
        state.cartSummary = calculateCartSummary(action.payload.cart);
        state.success = true;
        state.error = null;
      })
      .addCase(removeCartItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to remove item";
        state.success = false;
      });

    // Clear Cart
    builder
      .addCase(clearCart.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.lastAction = "clearCart";
      })
      .addCase(clearCart.fulfilled, (state) => {
        state.loading = false;
        state.cart = null;
        state.cartSummary = calculateCartSummary(null);
        state.success = true;
        state.error = null;
      })
      .addCase(clearCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to clear cart";
        state.success = false;
      });
  },
});

// Export actions and reducer
export const {
  resetCartState,
  clearError,
  clearSuccess,
  updateItemQtyLocally,
  removeItemLocally,
  resetCart,
  setCart,
} = cartSlice.actions;

export default cartSlice.reducer;

// Selectors
export const selectCart = (state) => state.cart.cart;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartError = (state) => state.cart.error;
export const selectCartSuccess = (state) => state.cart.success;
export const selectCartSummary = (state) => state.cart.cartSummary;
export const selectTotalItems = (state) => state.cart.cartSummary.totalItems;
export const selectCartSubtotal = (state) => state.cart.cartSummary.subtotal;
export const selectCartTotal = (state) => state.cart.cartSummary.total;
export const selectCartItems = (state) => state.cart.cart?.items || [];
export const selectLastAction = (state) => state.cart.lastAction;
export const selectCartItemCount = (state) => {
  if (!state.cart.cart?.items) return 0;
  return state.cart.cart.items.reduce((total, item) => total + item.qty, 0);
};

// Utility function to check if an item is in cart
export const isItemInCart = (state, signature) => {
  if (!state.cart.cart?.items) return false;
  return state.cart.cart.items.some((item) => item.signature === signature);
};

// Utility function to get item quantity in cart
export const getItemQuantity = (state, signature) => {
  if (!state.cart.cart?.items) return 0;
  const item = state.cart.cart.items.find(
    (item) => item.signature === signature
  );
  return item ? item.qty : 0;
};

// Utility function to get item by ID
export const getCartItemById = (state, itemId) => {
  if (!state.cart.cart?.items) return null;
  return state.cart.cart.items.find((item) => item._id === itemId);
};

// Helper function to check if user is logged in (for UI components)
export const selectIsUserLoggedIn = (state) => {
  return !!selectCurrentToken(state);
};
