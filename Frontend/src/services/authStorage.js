import Cookies from "js-cookie";

const ACCESS_KEY = "token";
const USER_KEY = "user";
const REFRESH_KEY = "crm_refresh_token";

let accessTokenListener = null;

export function onAccessTokenChange(listener) {
  accessTokenListener = listener;
  return () => {
    if (accessTokenListener === listener) accessTokenListener = null;
  };
}

export function getAccessToken() {
  const token = Cookies.get(ACCESS_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

export function setAccessToken(token) {
  if (!token) {
    Cookies.remove(ACCESS_KEY);
    accessTokenListener?.(null);
    return;
  }
  // Keep cookie longer than access JWT; silent refresh renews the value.
  Cookies.set(ACCESS_KEY, token, { expires: 7 });
  accessTokenListener?.(token);
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY) || null;
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  try {
    if (!token) localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, token);
  } catch {
    // ignore quota / private mode
  }
}

export function getStoredUser() {
  const raw = Cookies.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (!user) {
    Cookies.remove(USER_KEY);
    return;
  }
  Cookies.set(USER_KEY, JSON.stringify(user), { expires: 7 });
}

export function clearAuthStorage() {
  Cookies.remove(ACCESS_KEY);
  Cookies.remove(USER_KEY);
  setRefreshToken(null);
}
