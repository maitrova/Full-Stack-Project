// client/src/store/store.js
import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import productsReducer from "./slices/productsSlice.js";
import userReducer from "./slices/Userslice.js";
import readymadeSliceReducer from "./slices/predesignedslice.js";
import cartSliceReducer from "./slices/Cartslice.js";
import productPricingSliceReducer from "./slices/productpricing.js";
import productListSliceReducer from "./slices/productList.js";
import adminSliceReducer from "./slices/adminSlice.js";
import designsSliceReducer from "./slices/Designslice.js";
import commonSavedDataSliceReducer from "./slices/commonproducts.js";
import homepageSliceReducer from "./slices/HomepageSlice.js";
import designUploadsSliceReducer from "./slices/admindesignuploads.js";
import dropproductSliceReducer from "./slices/dropproducts.js";
import homeCategoryTilesSliceReducer from "./slices/Homepagecategorylist.js";
import productCategoriesSliceReducer from "./slices/productcategories.js";
// Persist configuration for user slice only
const persistConfig = {
  key: 'user', // key for localStorage
  storage,
  whitelist: ['userInfo'], // only persist userInfo from user slice
  // Optional: You can also blacklist specific fields
  // blacklist: ['status', 'error']
};

// Create persisted reducer
const persistedUserReducer = persistReducer(persistConfig, userReducer);

export const store = configureStore({
  reducer: {
    products: productsReducer,
    user: persistedUserReducer,
    readymadeproducts: readymadeSliceReducer,
    cart: cartSliceReducer,
    productPricing : productPricingSliceReducer,
    productList : productListSliceReducer,
    admin : adminSliceReducer,
    designs : designsSliceReducer,
    commonSavedData : commonSavedDataSliceReducer,
    homepage : homepageSliceReducer,
    designUploads : designUploadsSliceReducer,
    dropproducts : dropproductSliceReducer,
    homeCategoryTiles : homeCategoryTilesSliceReducer,
    productCategories : productCategoriesSliceReducer // Use persisted reducer instead of regular one
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Create persistor
export const persistor = persistStore(store);