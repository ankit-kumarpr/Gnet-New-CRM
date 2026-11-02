import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { refreshAccessToken } from "../services/api";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  onAccessTokenChange,
  setAccessToken,
  setRefreshToken,
  setStoredUser,
} from "../services/authStorage";
import {
  DEFAULT_CLIENT_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_ASSIGNED_WORK_PERMISSIONS,
  permissionGranted,
} from "../constants/permissions";

const AuthContext = createContext();

function normalizeUser(userData) {
  if (!userData) return null;
  const userType = String(userData.userType || (userData.clientId ? "CLIENT" : "")).toUpperCase() || undefined;
  const raw = Array.isArray(userData.permissions) ? userData.permissions.filter(Boolean) : [];
  let permissions = raw.length
    ? raw
    : userType === "CLIENT"
      ? [...DEFAULT_CLIENT_PERMISSIONS]
      : userType === "ADMIN"
        ? raw
        : [...DEFAULT_EMPLOYEE_PERMISSIONS];
  if (userType === "EMPLOYEE") {
    permissions = [...new Set([...permissions, ...EMPLOYEE_ASSIGNED_WORK_PERMISSIONS])];
  }
  return {
    ...userData,
    id: userData.id || userData._id,
    userType,
    permissions,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((userData, accessToken, refreshTokenValue) => {
    const normalized = normalizeUser(userData);
    setUser(normalized);
    setToken(accessToken || null);
    if (accessToken) setAccessToken(accessToken);
    if (normalized) setStoredUser(normalized);
    if (refreshTokenValue) setRefreshToken(refreshTokenValue);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearAuthStorage();
  }, []);

  const login = useCallback((userData, authToken, refreshTokenValue) => {
    applySession(userData, authToken, refreshTokenValue);
  }, [applySession]);

  useEffect(() => onAccessTokenChange((next) => {
    setToken(next);
  }), []);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        let access = getAccessToken();
        const refresh = getRefreshToken();

        if (!access && !refresh) {
          if (!cancelled) {
            setUser(null);
            setToken(null);
          }
          return;
        }

        const loadMe = async (accessToken) => {
          const response = await api.get("/auth/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          return response.data.data;
        };

        try {
          if (!access && refresh) {
            access = await refreshAccessToken();
          }
          const profile = await loadMe(access);
          if (!cancelled) applySession(profile, access);
        } catch {
          if (!refresh) {
            if (!cancelled) logout();
            return;
          }
          try {
            const nextAccess = await refreshAccessToken();
            const profile = await loadMe(nextAccess);
            if (!cancelled) applySession(profile, nextAccess);
          } catch {
            if (!cancelled) logout();
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth", error);
        const savedUser = getStoredUser();
        const access = getAccessToken();
        if (!cancelled && savedUser && access) {
          applySession(savedUser, access);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initializeAuth();
    return () => {
      cancelled = true;
    };
  }, [logout, applySession]);

  const hasRole = (roles) => {
    if (!user) return false;
    if (!roles || roles.length === 0) return true;
    const role = String(user.userType || "").toUpperCase();
    if (!role) return false;
    return roles.map((r) => String(r).toUpperCase()).includes(role);
  };

  const hasPermission = (permissions) => permissionGranted(user, permissions);

  const updateUser = useCallback((patch) => {
    setUser((current) => {
      if (!current) return current;
      const next = normalizeUser({ ...current, ...patch });
      setStoredUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasRole, hasPermission, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
