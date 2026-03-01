const TOKEN_KEY = "auth_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  // Fallback to same-origin API when env is not set.
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "";
}

export function authHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
