import axios from "axios";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./authStorage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const storedRefresh = getRefreshToken();
    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL}auth/refresh-token`,
      storedRefresh ? { refreshToken: storedRefresh } : {},
      {
        withCredentials: true,
        headers: storedRefresh ? { "X-Refresh-Token": storedRefresh } : undefined,
      },
    );

    const accessToken = data?.data?.accessToken;
    const nextRefresh = data?.data?.refreshToken;
    if (!accessToken) throw new Error("Refresh failed");

    setAccessToken(accessToken);
    if (nextRefresh) setRefreshToken(nextRefresh);
    return accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function redirectToLogin() {
  clearAuthStorage();
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
}

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel?.(error) || error.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const original = error.config;
    const url = String(original?.url || "");
    const isAuthRefresh = url.includes("/auth/refresh-token");
    const isAuthLogin = url.includes("/auth/login");

    if (status !== 401 || !original || original._retry || isAuthRefresh || isAuthLogin) {
      if (status === 401 && !isAuthLogin && (isAuthRefresh || (!getRefreshToken() && !getAccessToken()))) {
        redirectToLogin();
      }
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

export const isRequestCanceled = (error) =>
  Boolean(axios.isCancel?.(error) || error?.code === "ERR_CANCELED" || error?.name === "CanceledError");

export default api;
