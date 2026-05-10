import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_URL = import.meta.env.VITE_API_URL + "/addresses"; // ✅ base url from env (Vite)
// Example: VITE_API_URL="http://localhost:5000/api"

const getToken = (getState) => {
  // change this based on your auth slice name
   const { user }=  getState(); 
const token = user.userInfo?.token;
  return token;
};

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const initialState = {
  addresses: [],
  deliveryAddress: null,
  billingAddress: null,
  loading: false,
  error: null,
  success: false,
  message: null,
};

export const upsertDeliveryBilling = createAsyncThunk(
  "address/upsertDeliveryBilling",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      if (!token) return rejectWithValue("Token missing");

      const res = await fetch(`${API_URL}/createaddress`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return rejectWithValue(data?.message || "Failed to save addresses");

      return data; // { message, deliveryAddress, billingAddress }
    } catch (err) {
      return rejectWithValue(err.message || "Server error");
    }
  }
);

export const fetchMyAddresses = createAsyncThunk(
  "address/fetchMyAddresses",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      if (!token) return rejectWithValue("Token missing");

      const res = await fetch(`${API_URL}/createaddress`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) return rejectWithValue(data?.message || "Failed to fetch addresses");

      return data; // { addresses: [] }
    } catch (err) {
      return rejectWithValue(err.message || "Server error");
    }
  }
);

export const updateAddress = createAsyncThunk(
  "address/updateAddress",
  async ({ id, updates }, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      if (!token) return rejectWithValue("Token missing");

      const res = await fetch(`${API_URL}/updateaddress/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) return rejectWithValue(data?.message || "Failed to update address");

      return data; // { message, address }
    } catch (err) {
      return rejectWithValue(err.message || "Server error");
    }
  }
);

export const deleteAddress = createAsyncThunk(
  "address/deleteAddress",
  async (id, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      if (!token) return rejectWithValue("Token missing");

      const res = await fetch(`${API_URL}/deleteaddress/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) return rejectWithValue(data?.message || "Failed to delete address");

      return { id, message: data?.message || "Address deleted" };
    } catch (err) {
      return rejectWithValue(err.message || "Server error");
    }
  }
);

export const setDefaultAddress = createAsyncThunk(
  "address/setDefaultAddress",
  async (id, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      if (!token) return rejectWithValue("Token missing");

      const res = await fetch(`${API_URL}/defaultaddress/${id}/default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) return rejectWithValue(data?.message || "Failed to set default address");

      return data; // { message, address }
    } catch (err) {
      return rejectWithValue(err.message || "Server error");
    }
  }
);

const addressSlice = createSlice({
  name: "address",
  initialState,
  reducers: {
    resetAddressState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.message = null;
    },
    clearAddresses: (state) => {
      state.addresses = [];
      state.deliveryAddress = null;
      state.billingAddress = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ✅ UPSERT
      .addCase(upsertDeliveryBilling.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = null;
      })
      .addCase(upsertDeliveryBilling.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload?.message || "Saved";
        state.deliveryAddress = action.payload?.deliveryAddress || null;
        state.billingAddress = action.payload?.billingAddress || null;

        // Keep list in sync if already loaded
        const d = action.payload?.deliveryAddress;
        const b = action.payload?.billingAddress;
        if (d) {
          const idx = state.addresses.findIndex((x) => x._id === d._id);
          if (idx >= 0) state.addresses[idx] = d;
          else state.addresses.unshift(d);
        }
        if (b) {
          const idx = state.addresses.findIndex((x) => x._id === b._id);
          if (idx >= 0) state.addresses[idx] = b;
          else state.addresses.unshift(b);
        }
      })
      .addCase(upsertDeliveryBilling.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed";
      })

      // ✅ FETCH
      .addCase(fetchMyAddresses.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = null;
      })
      .addCase(fetchMyAddresses.fulfilled, (state, action) => {
        state.loading = false;
        state.addresses = action.payload?.addresses || [];

        // Extract current delivery & billing (latest/default)
        const delivery = state.addresses.find((a) => a.type === "delivery" && a.isDefault) ||
                         state.addresses.find((a) => a.type === "delivery") ||
                         null;

        const billing = state.addresses.find((a) => a.type === "billing" && a.isDefault) ||
                        state.addresses.find((a) => a.type === "billing") ||
                        null;

        state.deliveryAddress = delivery;
        state.billingAddress = billing;
      })
      .addCase(fetchMyAddresses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed";
      })

      // ✅ UPDATE
      .addCase(updateAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = null;
      })
      .addCase(updateAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload?.message || "Updated";

        const updated = action.payload?.address;
        if (updated) {
          const idx = state.addresses.findIndex((x) => x._id === updated._id);
          if (idx >= 0) state.addresses[idx] = updated;

          if (updated.type === "delivery") state.deliveryAddress = updated;
          if (updated.type === "billing") state.billingAddress = updated;
        }
      })
      .addCase(updateAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed";
      })

      // ✅ DELETE
      .addCase(deleteAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = null;
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload?.message || "Deleted";

        const id = action.payload?.id;
        state.addresses = state.addresses.filter((a) => a._id !== id);

        if (state.deliveryAddress?._id === id) state.deliveryAddress = null;
        if (state.billingAddress?._id === id) state.billingAddress = null;
      })
      .addCase(deleteAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed";
      })

      // ✅ SET DEFAULT
      .addCase(setDefaultAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.message = null;
      })
      .addCase(setDefaultAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload?.message || "Default updated";

        const updated = action.payload?.address;
        if (updated) {
          // unset defaults of same type
          state.addresses = state.addresses.map((a) => {
            if (a.type === updated.type) return { ...a, isDefault: a._id === updated._id };
            return a;
          });

          // update pointers
          if (updated.type === "delivery") state.deliveryAddress = updated;
          if (updated.type === "billing") state.billingAddress = updated;
        }
      })
      .addCase(setDefaultAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed";
      });
  },
});

export const { resetAddressState, clearAddresses } = addressSlice.actions;

// selectors (optional)
export const selectAddresses = (state) => state.address.addresses;
export const selectDeliveryAddress = (state) => state.address.deliveryAddress;
export const selectBillingAddress = (state) => state.address.billingAddress;
export const selectAddressLoading = (state) => state.address.loading;
export const selectAddressError = (state) => state.address.error;
export const selectAddressSuccess = (state) => state.address.success;
export const selectAddressMessage = (state) => state.address.message;

export default addressSlice.reducer;
