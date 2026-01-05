// client/src/redux/slices/productList.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Base API URL
const API_BASE = `${import.meta.env.VITE_API_URL || "https://narifighter.online/backend"}/api/readymadeproducts`;

// Async Thunks
export const fetchProducts = createAsyncThunk(
  'productList/fetchProducts',
  async ({ filter, category, subCategory, search, page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      // For admin filtered view
      const response = await axios.get(`${API_BASE}/admin/filtered`, {
        params: { filter, category, subCategory, search, page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('fetchProducts Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch products');
    }
  }
);

export const fetchAllProducts = createAsyncThunk(
  'productList/fetchAllProducts',
  async ({ category, subCategory, limit = 100 }, { rejectWithValue }) => {
    try {
      // Use /public endpoint
      const response = await axios.get(`${API_BASE}/public`, {
        params: { category, subCategory, limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('fetchAllProducts Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch products');
    }
  }
);

export const updateProductList = createAsyncThunk(
  'productList/updateProductList',
  async ({ productIds, action, value }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${API_BASE}/admin/bulk/update-flags`, {
        productIds,
        action,
        value
      });
      return response.data;
    } catch (error) {
      console.error('updateProductList Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to update products');
    }
  }
);

export const removeProductFromList = createAsyncThunk(
  'productList/removeProductFromList',
  async ({ productId, action }, { rejectWithValue }) => {
    try {
      // Correct action mapping
      let backendAction;
      if (action === 'removeNewArrival') {
        backendAction = 'removeNewArrival';
      } else if (action === 'removeBestSeller') {
        backendAction = 'removeBestSeller';
      } else {
        backendAction = action;
      }
      
      const response = await axios.patch(`${API_BASE}/admin/bulk/update-flags`, {
        productIds: [productId],
        action: backendAction,
        value: false
      });
      return { ...response.data, productId, action };
    } catch (error) {
      console.error('removeProductFromList Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to remove product');
    }
  }
);

export const fetchFilters = createAsyncThunk(
  'productList/fetchFilters',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/filters/available`);
      console.log('Filters response:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('fetchFilters Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch filters');
    }
  }
);

export const toggleProductStatus = createAsyncThunk(
  'productList/toggleProductStatus',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${API_BASE}/admin/toggle-status/${productId}`);
      return { ...response.data, productId };
    } catch (error) {
      console.error('toggleProductStatus Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle product status');
    }
  }
);

export const createProduct = createAsyncThunk(
  'productList/createProduct',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE}/admin/create`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('createProduct Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to create product');
    }
  }
);

export const updateProduct = createAsyncThunk(
  'productList/updateProduct',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_BASE}/admin/update/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('updateProduct Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to update product');
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'productList/deleteProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_BASE}/admin/delete/${productId}`);
      return { ...response.data, productId };
    } catch (error) {
      console.error('deleteProduct Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to delete product');
    }
  }
);

export const getProductById = createAsyncThunk(
  'productList/getProductById',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/${productId}`);
      return response.data.data;
    } catch (error) {
      console.error('getProductById Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch product');
    }
  }
);

export const searchProducts = createAsyncThunk(
  'productList/searchProducts',
  async ({ searchTerm, page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/search`, {
        params: { q: searchTerm, page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('searchProducts Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to search products');
    }
  }
);

export const getBestSellerProducts = createAsyncThunk(
  'productList/getBestSellerProducts',
  async ({ page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/collections/best-sellers`, {
        params: { page, limit }
      });
      console.log('Best sellers response:', response.data);
      return response.data;
    } catch (error) {
      console.error('getBestSellerProducts Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch best sellers');
    }
  }
);

export const getNewArrivalProducts = createAsyncThunk(
  'productList/getNewArrivalProducts',
  async ({ page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/collections/new-arrivals`, {
        params: { page, limit }
      });
      console.log('New arrivals response:', response.data);
      return response.data;
    } catch (error) {
      console.error('getNewArrivalProducts Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch new arrivals');
    }
  }
);

export const getProductsByCategory = createAsyncThunk(
  'productList/getProductsByCategory',
  async ({ category, page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/categories/${category}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('getProductsByCategory Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch category products');
    }
  }
);

export const getProductsBySubCategory = createAsyncThunk(
  'productList/getProductsBySubCategory',
  async ({ category, subCategory, page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      // Note: This endpoint requires BOTH category and subCategory
      const response = await axios.get(`${API_BASE}/categories/${category}/${subCategory}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('getProductsBySubCategory Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sub-category products');
    }
  }
);

// Get all products for admin
export const getAllProductsAdmin = createAsyncThunk(
  'productList/getAllProductsAdmin',
  async ({ page = 1, limit = 100 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/admin/all`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('getAllProductsAdmin Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch products');
    }
  }
);

// Slice
const productListSlice = createSlice({
  name: 'productList',
  initialState: {
    products: [],
    availableProducts: [],
    currentProduct: null,
    filters: {
      categories: [],
      subCategories: [],
    },
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 1,
    },
    selectedProductIds: [],
    loading: false,
    error: null,
    currentFilter: 'all',
    currentCategory: '',
    currentSubCategory: '',
    searchQuery: '',
  },
  reducers: {
    setCurrentFilter: (state, action) => {
      state.currentFilter = action.payload;
      state.pagination.page = 1;
    },
    setCurrentCategory: (state, action) => {
      state.currentCategory = action.payload;
      state.currentSubCategory = '';
      state.selectedProductIds = [];
      state.pagination.page = 1;
    },
    setCurrentSubCategory: (state, action) => {
      state.currentSubCategory = action.payload;
      state.selectedProductIds = [];
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      state.pagination.page = 1;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setSelectedProductIds: (state, action) => {
      state.selectedProductIds = action.payload;
    },
    toggleProductSelection: (state, action) => {
      const productId = action.payload;
      if (state.selectedProductIds.includes(productId)) {
        state.selectedProductIds = state.selectedProductIds.filter(id => id !== productId);
      } else {
        state.selectedProductIds.push(productId);
      }
    },
    clearSelectedProducts: (state) => {
      state.selectedProductIds = [];
    },
    selectAllProducts: (state) => {
      state.selectedProductIds = state.availableProducts.map(product => product._id);
    },
    deselectAllProducts: (state) => {
      state.selectedProductIds = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    resetProductList: (state) => {
      state.products = [];
      state.availableProducts = [];
      state.currentProduct = null;
      state.selectedProductIds = [];
      state.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        pages: 1,
      };
      state.error = null;
      state.currentFilter = 'all';
      state.currentCategory = '';
      state.currentSubCategory = '';
      state.searchQuery = '';
    },
    clearCurrentProduct: (state) => {
      state.currentProduct = null;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    updateProductInList: (state, action) => {
      const { productId, updates } = action.payload;
      const index = state.products.findIndex(p => p._id === productId);
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...updates };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Products (Admin Filter)
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch All Products (Public)
      .addCase(fetchAllProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.availableProducts = action.payload || [];
        state.products = action.payload || [];
        state.pagination.total = action.payload?.length || 0;
      })
      .addCase(fetchAllProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Product List (Bulk Update)
      .addCase(updateProductList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProductList.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProductIds = [];
      })
      .addCase(updateProductList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Remove Product from List
      .addCase(removeProductFromList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeProductFromList.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the product from the current list
        state.products = state.products.filter(
          product => product._id !== action.payload.productId
        );
        // Update pagination total
        state.pagination.total = Math.max(0, state.pagination.total - 1);
      })
      .addCase(removeProductFromList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Filters
      .addCase(fetchFilters.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFilters.fulfilled, (state, action) => {
        state.loading = false;
        state.filters.categories = action.payload?.categories || [];
        state.filters.subCategories = action.payload?.subCategories || [];
      })
      .addCase(fetchFilters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Toggle Product Status
      .addCase(toggleProductStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleProductStatus.fulfilled, (state, action) => {
        state.loading = false;
        // Update product in the list
        state.products = state.products.map(product => 
          product._id === action.payload.productId 
            ? { ...product, isActive: action.payload.data?.isActive } 
            : product
        );
      })
      .addCase(toggleProductStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Product
      .addCase(createProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Add new product to the beginning of the list
        const newProduct = action.payload.data;
        if (newProduct) {
          state.products.unshift(newProduct);
          state.availableProducts.unshift(newProduct);
          state.pagination.total += 1;
        }
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Product
      .addCase(updateProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Update product in the list
        const updatedProduct = action.payload.data;
        if (updatedProduct) {
          state.products = state.products.map(product => 
            product._id === updatedProduct._id 
              ? updatedProduct 
              : product
          );
          state.availableProducts = state.availableProducts.map(product => 
            product._id === updatedProduct._id 
              ? updatedProduct 
              : product
          );
          state.currentProduct = updatedProduct;
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Product
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Remove product from the list
        state.products = state.products.filter(
          product => product._id !== action.payload.productId
        );
        state.availableProducts = state.availableProducts.filter(
          product => product._id !== action.payload.productId
        );
        state.pagination.total = Math.max(0, state.pagination.total - 1);
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Product by ID
      .addCase(getProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = action.payload;
      })
      .addCase(getProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Search Products
      .addCase(searchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
      })
      .addCase(searchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Best Seller Products
      .addCase(getBestSellerProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getBestSellerProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
        state.currentFilter = 'best-seller';
      })
      .addCase(getBestSellerProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get New Arrival Products
      .addCase(getNewArrivalProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getNewArrivalProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
        state.currentFilter = 'new-arrival';
      })
      .addCase(getNewArrivalProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Products by Category
      .addCase(getProductsByCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProductsByCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
        state.currentCategory = action.meta.arg?.category || '';
      })
      .addCase(getProductsByCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Products by Sub-Category
      .addCase(getProductsBySubCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProductsBySubCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
        state.currentSubCategory = action.meta.arg?.subCategory || '';
      })
      .addCase(getProductsBySubCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get All Products Admin
      .addCase(getAllProductsAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllProductsAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.data || [];
        state.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: state.products.length,
          pages: 1,
        };
      })
      .addCase(getAllProductsAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setCurrentFilter,
  setCurrentCategory,
  setCurrentSubCategory,
  setSearchQuery,
  setPage,
  setSelectedProductIds,
  toggleProductSelection,
  clearSelectedProducts,
  selectAllProducts,
  deselectAllProducts,
  clearError,
  resetProductList,
  clearCurrentProduct,
  setPagination,
  updateProductInList,
} = productListSlice.actions;

// Selectors
export const selectAllReadymadeProducts = (state) => state.productList.availableProducts;
export const selectReadymadeProducts = (state) => state.productList.products;
export const selectCurrentProduct = (state) => state.productList.currentProduct;
export const selectProductFilters = (state) => state.productList.filters;
export const selectProductLoading = (state) => state.productList.loading;
export const selectProductError = (state) => state.productList.error;
export const selectProductPagination = (state) => state.productList.pagination;
export const selectSelectedProductIds = (state) => state.productList.selectedProductIds;
export const selectCurrentFilter = (state) => state.productList.currentFilter;
export const selectCurrentCategory = (state) => state.productList.currentCategory;
export const selectCurrentSubCategory = (state) => state.productList.currentSubCategory;
export const selectSearchQuery = (state) => state.productList.searchQuery;

// Helper selector to get products based on current filter
export const selectFilteredProducts = (state) => {
  const { products, currentFilter } = state.productList;
  
  switch (currentFilter) {
    case 'new-arrival':
      return products.filter(product => product.newArrival === true);
    case 'best-seller':
      return products.filter(product => product.bestSeller === true);
    default:
      return products;
  }
};

export default productListSlice.reducer;