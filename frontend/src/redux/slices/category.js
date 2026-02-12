import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_API_URL}/admin-category`;


/* ==========================================
   CATEGORY THUNKS
========================================== */

// CREATE CATEGORY
export const createCategory = createAsyncThunk(
  "category/createCategory",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/category`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create category"
      );
    }
  }
);

// UPDATE CATEGORY
export const updateCategory = createAsyncThunk(
  "category/updateCategory",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${BASE_URL}/category/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update category"
      );
    }
  }
);

// GET ALL CATEGORIES
export const fetchCategories = createAsyncThunk(
  "category/fetchCategories",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/category`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch categories"
      );
    }
  }
);

// DELETE CATEGORY
export const deleteCategory = createAsyncThunk(
  "category/deleteCategory",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE_URL}/category/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete category"
      );
    }
  }
);

/* ==========================================
   SUBCATEGORY THUNKS
========================================== */

// CREATE SUBCATEGORY
export const createSubCategory = createAsyncThunk(
  "category/createSubCategory",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/subcategory`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create subcategory"
      );
    }
  }
);

// UPDATE SUBCATEGORY
export const updateSubCategory = createAsyncThunk(
  "category/updateSubCategory",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${BASE_URL}/subcategory/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update subcategory"
      );
    }
  }
);


// GET ALL SUBCATEGORIES
export const fetchSubCategories = createAsyncThunk(
  "category/fetchSubCategories",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/subcategory`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch subcategories"
      );
    }
  }
);

// DELETE SUBCATEGORY
export const deleteSubCategory = createAsyncThunk(
  "category/deleteSubCategory",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE_URL}/subcategory/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete subcategory"
      );
    }
  }
);

/* ==========================================
   SLICE
========================================== */

const categorySlice = createSlice({
  name: "category",
  initialState: {
    categories: [],
    subCategories: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder

      /* -------------------- CATEGORY -------------------- */

      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.unshift(action.payload);
      })

      /* -------- UPDATE CATEGORY -------- */
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex(
          (cat) => cat._id === action.payload._id
        );

        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })

      /* -------- UPDATE SUBCATEGORY -------- */
      .addCase(updateSubCategory.fulfilled, (state, action) => {
        const index = state.subCategories.findIndex(
          (sub) => sub._id === action.payload._id
        );

        if (index !== -1) {
          state.subCategories[index] = action.payload;
        }
      })


      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(
          (cat) => cat._id !== action.payload
        );
      })

      /* -------------------- SUBCATEGORY -------------------- */

      .addCase(fetchSubCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSubCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.subCategories = action.payload;
      })
      .addCase(fetchSubCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createSubCategory.fulfilled, (state, action) => {
        state.subCategories.unshift(action.payload);
      })

      .addCase(deleteSubCategory.fulfilled, (state, action) => {
        state.subCategories = state.subCategories.filter(
          (sub) => sub._id !== action.payload
        );
      });
  },
});

export default categorySlice.reducer;
