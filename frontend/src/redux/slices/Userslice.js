// userSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Base URL for your API (from environment variable)
const API_URL = import.meta.env.VITE_API_URL;

// Async thunk for user registration
export const registerUser = createAsyncThunk(
  'user/register',
  async (userData, { rejectWithValue }) => {
    try {
      const { name, phone, email, password, role } = userData;
      const response = await axios.post(`${API_URL}/register`, {
        name,
        phone,
        email,
        password,
        role
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Async thunk for user login
export const loginUser = createAsyncThunk(
  'user/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { phone, password } = credentials;
      const response = await axios.post(`${API_URL}/login`, {
        phone,
        password
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Async thunk for user logout
export const logoutUser = createAsyncThunk(
  'user/logout',
  async (_, { rejectWithValue }) => {
    try {
      // Optional: Add API call to invalidate token on server if needed
      // await axios.post(`${API_URL}/logout`);
      return null; // This will clear the userInfo in the state
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Logout failed');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: {
    userInfo: null, // Will be automatically rehydrated by redux-persist
    status: 'idle',
    error: null
  },
  reducers: {
    // Synchronous logout action (alternative approach)
    logout: (state) => {
      state.userInfo = null;
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Register cases
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userInfo = action.payload;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Registration failed';
      })
      
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userInfo = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Login failed';
      })
      
      // Logout cases
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'idle';
        state.userInfo = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload?.message || 'Logout failed';
      });
  }
});

// Export the synchronous logout action
export const { logout } = userSlice.actions;

export default userSlice.reducer;

// Selectors
export const selectCurrentToken = (state) => state.user.userInfo?.token;
export const selectCurrentUser = (state) => state.user.userInfo;
export const selectAuthStatus = (state) => state.user.status;
export const selectAuthError = (state) => state.user.error;