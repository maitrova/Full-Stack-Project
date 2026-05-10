import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// ✅ Base URL from env
const BASE_URL = `${import.meta.env.VITE_API_URL}/auth`;

// Load from localStorage if exists
const userFromStorage = localStorage.getItem("googleUser")
  ? JSON.parse(localStorage.getItem("googleUser"))
  : null;


// ================= GOOGLE AUTH =================
export const googleAuth = createAsyncThunk(
  "googleAuth/login",
  async (googleToken, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/google`,
        { token: googleToken },
        { withCredentials: true }
      );

      // Save to localStorage
      localStorage.setItem("googleUser", JSON.stringify(data));

      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Google authentication failed"
      );
    }
  }
);


const googleAuthSlice = createSlice({
  name: "googleAuth",
  initialState: {
    user: userFromStorage,
    loading: false,
    error: null,
  },
  reducers: {
    googleLogout: (state) => {
      localStorage.removeItem("googleUser");
      state.user = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // 🔄 Pending
      .addCase(googleAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      // ✅ Success
      .addCase(googleAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })

      // ❌ Error
      .addCase(googleAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { googleLogout } = googleAuthSlice.actions;

export default googleAuthSlice.reducer;
