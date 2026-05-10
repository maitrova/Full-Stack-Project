import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL + "/admin-color";

/* =========================================
   FETCH ALL COLORS (Admin)
========================================= */
export const fetchColors = createAsyncThunk(
  "colors/fetchColors",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(BASE_URL);
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch colors"
      );
    }
  }
);

/* =========================================
   FETCH ACTIVE COLORS (Frontend)
========================================= */
export const fetchActiveColors = createAsyncThunk(
  "colors/fetchActiveColors",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${BASE_URL}/active`);
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch active colors"
      );
    }
  }
);

/* =========================================
   CREATE COLOR
========================================= */
export const createColor = createAsyncThunk(
  "colors/createColor",
  async (colorData, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(BASE_URL, colorData);
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create color"
      );
    }
  }
);

/* =========================================
   UPDATE COLOR
========================================= */
export const updateColor = createAsyncThunk(
  "colors/updateColor",
  async ({ colorId, updateData }, { rejectWithValue }) => {
    try {
      const { data } = await axios.put(
        `${BASE_URL}/${colorId}`,
        updateData
      );
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update color"
      );
    }
  }
);

/* =========================================
   DELETE COLOR
========================================= */
export const deleteColor = createAsyncThunk(
  "colors/deleteColor",
  async (colorId, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE_URL}/${colorId}`);
      return colorId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete color"
      );
    }
  }
);

/* =========================================
   SLICE
========================================= */
const colorSlice = createSlice({
  name: "colors",
  initialState: {
    colors: [],
    activeColors: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder

      /* FETCH ALL */
      .addCase(fetchColors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchColors.fulfilled, (state, action) => {
        state.loading = false;
        state.colors = action.payload;
      })
      .addCase(fetchColors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      /* FETCH ACTIVE */
      .addCase(fetchActiveColors.fulfilled, (state, action) => {
        state.activeColors = action.payload;
      })

      /* CREATE */
      .addCase(createColor.fulfilled, (state, action) => {
        state.colors.unshift(action.payload);
      })

      /* UPDATE */
      .addCase(updateColor.fulfilled, (state, action) => {
        const index = state.colors.findIndex(
          (color) => color._id === action.payload._id
        );
        if (index !== -1) {
          state.colors[index] = action.payload;
        }
      })

      /* DELETE */
      .addCase(deleteColor.fulfilled, (state, action) => {
        state.colors = state.colors.filter(
          (color) => color._id !== action.payload
        );
      });
  },
});

export default colorSlice.reducer;
