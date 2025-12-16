// client/src/store/store.js
import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import productsReducer from "./slices/productsSlice.js";
import userReducer from "./slices/Userslice.js";

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
    user: persistedUserReducer, // Use persisted reducer instead of regular one
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