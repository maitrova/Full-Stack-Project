import { createSlice } from '@reduxjs/toolkit';

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    activeTab: 'newArrival',
    isEditing: false,
    selectedTab: 'newArrival',
    sidebarCollapsed: false,
    notifications: [],
  },
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
      state.selectedTab = action.payload;
      state.isEditing = false;
    },
    setIsEditing: (state, action) => {
      state.isEditing = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    addNotification: (state, action) => {
      state.notifications.push({
        id: Date.now(),
        type: action.payload.type || 'info',
        message: action.payload.message,
        timestamp: new Date().toISOString(),
      });
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    resetAdminState: (state) => {
      state.isEditing = false;
      state.notifications = [];
    },
  },
});

export const {
  setActiveTab,
  setIsEditing,
  toggleSidebar,
  addNotification,
  removeNotification,
  clearNotifications,
  resetAdminState,
} = adminSlice.actions;

export default adminSlice.reducer;