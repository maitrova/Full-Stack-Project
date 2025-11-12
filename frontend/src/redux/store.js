import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import userSliceReducer from './slices/Userslice.js';

const userPersistConfig = {
  key: 'user',
  storage,
  whitelist: ['userInfo'] // Only persist the token field from user slice
};


const rootReducer = combineReducers({
  // Persisted reducers
  user: persistReducer(userPersistConfig, userSliceReducer),
  
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      // Optional: Add logging middleware for debugging
      (store) => (next) => (action) => {
        if (process.env.NODE_ENV === 'development') {
          if (action.type.endsWith('/fulfilled')) {
            console.log('Redux Action:', action.type);
          }
        }
        return next(action);
      }
    ),
  devTools: process.env.NODE_ENV !== 'production'
});

// Export persistor for both user and delivery boy auth token persistence
export const persistor = persistStore(store);