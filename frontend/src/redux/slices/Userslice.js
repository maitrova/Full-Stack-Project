// userSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Base URL for your API
const BASE_URL = import.meta.env.VITE_API_URL || "https://narifighter.online/backend";
const API_URL = `${BASE_URL}/auth`;

// --------------------
// Auth Thunks
// --------------------

// Register
export const registerUser = createAsyncThunk(
  "user/register",
  async (userData, { rejectWithValue }) => {
    try {
      const { name, phone, email, password, role } = userData;
      const response = await axios.post(`${API_URL}/register`, {
        name,
        phone,
        email,
        password,
        role,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Registration failed" });
    }
  }
);

// Login
export const loginUser = createAsyncThunk(
  "user/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const { phone, password } = credentials;
      const response = await axios.post(`${API_URL}/login`, { phone, password });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Login failed" });
    }
  }
);

// Logout
export const logoutUser = createAsyncThunk(
  "user/logout",
  async (_, { rejectWithValue }) => {
    try {
      return null;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Logout failed" });
    }
  }
);

// --------------------
// Profile Thunks
// --------------------

// GET Profile
export const fetchUserProfile = createAsyncThunk(
  "user/fetchProfile",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().user.userInfo?.token;
      if (!token) return rejectWithValue({ message: "No token found" });

      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // response is user object: { _id, name, phone, email, role, ... }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Failed to fetch profile" });
    }
  }
);

// PUT Update Profile
export const updateUserProfile = createAsyncThunk(
  "user/updateProfile",
  async (profileData, { getState, rejectWithValue }) => {
    try {
      const token = getState().user.userInfo?.token;
      if (!token) return rejectWithValue({ message: "No token found" });

      const response = await axios.put(`${API_URL}/profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      /**
       * Backend returns:
       * { _id, name, phone, email, role, token }
       */
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Profile update failed" });
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    userInfo: null, // persisted
    status: "idle",
    error: null,

    // optional: separate profile state
    profile: null,
    profileStatus: "idle",
    profileError: null,
  },
  reducers: {
    logout: (state) => {
      state.userInfo = null;
      state.status = "idle";
      state.error = null;

      state.profile = null;
      state.profileStatus = "idle";
      state.profileError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --------------------
      // Register
      // --------------------
      .addCase(registerUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.userInfo = action.payload;
        state.error = null;

        // You can also set profile from signup response if you want:
        state.profile = {
          _id: action.payload?._id,
          name: action.payload?.name,
          phone: action.payload?.phone,
          email: action.payload?.email,
          role: action.payload?.role,
        };
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.message || "Registration failed";
      })

      // --------------------
      // Login
      // --------------------
      .addCase(loginUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.userInfo = action.payload;
        state.error = null;

        // Optionally preload profile from login response
        state.profile = {
          _id: action.payload?._id,
          name: action.payload?.name,
          phone: action.payload?.phone,
          email: action.payload?.email,
          role: action.payload?.role,
        };
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.message || "Login failed";
      })

      // --------------------
      // Logout thunk
      // --------------------
      .addCase(logoutUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = "idle";
        state.userInfo = null;
        state.error = null;

        state.profile = null;
        state.profileStatus = "idle";
        state.profileError = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = "idle";
        state.error = action.payload?.message || "Logout failed";
      })

      // --------------------
      // Fetch Profile
      // --------------------
      .addCase(fetchUserProfile.pending, (state) => {
        state.profileStatus = "loading";
        state.profileError = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.profileStatus = "succeeded";
        state.profile = action.payload;
        state.profileError = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.profileStatus = "failed";
        state.profileError = action.payload?.message || "Failed to fetch profile";
      })

      // --------------------
      // Update Profile
      // --------------------
      .addCase(updateUserProfile.pending, (state) => {
        state.profileStatus = "loading";
        state.profileError = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.profileStatus = "succeeded";
        state.profileError = null;

        // update profile object
        state.profile = {
          _id: action.payload?._id,
          name: action.payload?.name,
          phone: action.payload?.phone,
          email: action.payload?.email,
          role: action.payload?.role,
        };

        // update persisted userInfo too (especially token if refreshed)
        state.userInfo = {
          ...state.userInfo,
          ...action.payload,
        };
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.profileStatus = "failed";
        state.profileError = action.payload?.message || "Profile update failed";
      });
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;

// --------------------
// Selectors
// --------------------
export const selectCurrentToken = (state) => state.user.userInfo?.token;
export const selectCurrentUser = (state) => state.user.userInfo;
export const selectAuthStatus = (state) => state.user.status;
export const selectAuthError = (state) => state.user.error;

export const selectUserProfile = (state) => state.user.profile;
export const selectProfileStatus = (state) => state.user.profileStatus;
export const selectProfileError = (state) => state.user.profileError;
