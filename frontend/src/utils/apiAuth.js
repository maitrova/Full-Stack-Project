// Attaches the signed-in user's token to requests for the store's own API.
// Admin endpoints require it; requests to any other host never get it.
import axios from "axios";

const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const persistedToken = () => {
  try {
    const persistedUser = window.localStorage.getItem("persist:user");
    const userInfo = persistedUser ? JSON.parse(JSON.parse(persistedUser).userInfo || "null") : null;
    return userInfo?.token || null;
  } catch {
    return null;
  }
};

// main.jsx swaps in a reader of the live Redux state; slices that can't
// import the store fall back to the persisted copy.
let readToken = persistedToken;
export const setApiTokenReader = (reader) => {
  readToken = () => reader() || persistedToken();
};

const isOwnApi = (config) => {
  if (!API_BASE) return false;
  try {
    const uri = axios.getUri(config);
    return uri === API_BASE || uri.startsWith(`${API_BASE}/`) || uri.startsWith(`${API_BASE}?`);
  } catch {
    return false;
  }
};

export const attachApiAuth = (instance = axios) => {
  instance.interceptors.request.use((config) => {
    const token = readToken();
    if (token && isOwnApi(config) && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  return instance;
};
