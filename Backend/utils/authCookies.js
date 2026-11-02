const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Cross-origin SPA (Vite → API) needs SameSite=None; Secure only in production HTTPS. */
const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_MAX_AGE_MS,
    path: "/",
});

const setRefreshCookie = (res, token) => {
    res.cookie("refreshToken", token, refreshCookieOptions());
};

const clearRefreshCookie = (res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });
};

module.exports = {
    REFRESH_MAX_AGE_MS,
    refreshCookieOptions,
    setRefreshCookie,
    clearRefreshCookie,
};
