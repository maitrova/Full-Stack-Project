// readymadeProductSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async Thunks
export const fetchReadymadeProducts = createAsyncThunk(
  'readymade/fetchProducts',
  async () => {
    const response = await axios.get('http://localhost:5000/api/readymadeproducts/');
    return response.data.products;
  }
);

export const fetchReadymadeProductById = createAsyncThunk(
  'readymade/fetchProductById',
  async (productId) => {
    const response = await axios.get(`http://localhost:5000/api/readymadeproducts/${productId}`);
    console.log("Fetched Product:", response.data.product);
    return response.data.product;
  }
);

export const createReadymadeProduct = createAsyncThunk(
  'readymade/createProduct',
  async (productData) => {
    const formData = new FormData();
    
    // Append basic fields
    Object.keys(productData).forEach(key => {
      if (key !== 'images' && key !== 'video') {
        formData.append(key, productData[key]);
      }
    });

    // Append images
    if (productData.images) {
      productData.images.forEach((image) => {
        formData.append('images', image);
      });
    }

    // Append video
    if (productData.video) {
      formData.append('video', productData.video);
    }

    const response = await axios.post('http://localhost:5000/api/readymadeproducts/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.product;
  }
);

export const updateReadymadeProduct = createAsyncThunk(
  'readymade/updateProduct',
  async ({ id, updateData }) => {
    const formData = new FormData();
    
    // Append update fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'images' && key !== 'video') {
        formData.append(key, updateData[key]);
      }
    });

    // Append new images
    if (updateData.images) {
      updateData.images.forEach((image) => {
        formData.append('images', image);
      });
    }

    // Append new video
    if (updateData.video) {
      formData.append('video', updateData.video);
    }

    const response = await axios.put(`http://localhost:5000/api/readymadeproducts/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.product;
  }
);

export const deleteReadymadeProduct = createAsyncThunk(
  'readymade/deleteProduct',
  async (productId) => {
    await axios.delete(`http://localhost:5000/api/readymadeproducts/${productId}`);
    return productId;
  }
);

// Initial State
const initialState = {
  products: [],
  currentProduct: null,
  loading: false,
  error: null,
  success: false,
};

// Slice
const readymadeSlice = createSlice({
  name: 'readymade',
  initialState,
  reducers: {
    clearCurrentReadymadeProduct: (state) => {
      state.currentProduct = null;
    },
    clearReadymadeError: (state) => {
      state.error = null;
    },
    clearReadymadeSuccess: (state) => {
      state.success = false;
    },
    resetReadymadeState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch Products
      .addCase(fetchReadymadeProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReadymadeProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
        state.success = true;
      })
      .addCase(fetchReadymadeProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // Fetch Single Product
      .addCase(fetchReadymadeProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReadymadeProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = action.payload;
        state.success = true;
      })
      .addCase(fetchReadymadeProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // Create Product
      .addCase(createReadymadeProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createReadymadeProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products.unshift(action.payload); // Add to beginning
        state.success = true;
      })
      .addCase(createReadymadeProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // Update Product
      .addCase(updateReadymadeProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateReadymadeProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Update in products array
        const index = state.products.findIndex(
          (product) => product._id === action.payload._id
        );
        if (index !== -1) {
          state.products[index] = action.payload;
        }
        // Update current product if it's the one being edited
        if (state.currentProduct?._id === action.payload._id) {
          state.currentProduct = action.payload;
        }
        state.success = true;
      })
      .addCase(updateReadymadeProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // Delete Product
      .addCase(deleteReadymadeProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteReadymadeProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Remove from products array
        state.products = state.products.filter(
          (product) => product._id !== action.payload
        );
        // Clear current product if it's the one being deleted
        if (state.currentProduct?._id === action.payload) {
          state.currentProduct = null;
        }
        state.success = true;
      })
      .addCase(deleteReadymadeProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

// Export actions and reducer
export const {
  clearCurrentReadymadeProduct,
  clearReadymadeError,
  clearReadymadeSuccess,
  resetReadymadeState,
} = readymadeSlice.actions;

export default readymadeSlice.reducer;