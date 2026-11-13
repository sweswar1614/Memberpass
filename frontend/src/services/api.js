
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "https://memberpass-uzxv.onrender.com/api"
).replace(/\/+$/, "");

export { API_BASE };

// Authentication Storage
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

export const getAuthToken = () => {
  return localStorage.getItem("token");
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
};

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error("Failed to parse user:", error);
    return null;
  }
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const authHeaders = () => {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Common API Response Handler
const handleResponse = async (res) => {
  const contentType = res.headers.get("content-type") || "";

  let data = {};

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: text || "Unexpected server response" };
    }
  } catch (error) {
    data = { message: "Unable to read server response" };
  }

  if (!res.ok) {
    console.error("API Error:", {
      status: res.status,
      url: res.url,
      message: data.message,
    });

    return {
      ...data,
      success: false,
      message: data.message || `Request failed (${res.status})`,
    };
  }

  return data;
};
