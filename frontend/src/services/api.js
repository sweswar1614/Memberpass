
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "https://memberpass-uzxv.onrender.com/api"
).replace(/\/+$/, "");

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
    console.error("Failed to parse user from localStorage:", error);
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
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// Common API Response Handler
const handleResponse = async (res) => {
  const contentType = res.headers.get("content-type");

  let data = {};

  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = { message: text || "Unexpected server response" };
  }

  if (!res.ok) {
    return {
      ...data,
      success: false,
      message: data.message || `Request failed (${res.status})`
    };
  }

  return data;
};

// Authentication API
export const authApi = {
  register: async (userDataOrName, maybeEmail, maybePassword, maybePhone) => {
    try {
      const userData =
        typeof userDataOrName === "object" && userDataOrName !== null
          ? userDataOrName
          : {
            name: userDataOrName,
            email: maybeEmail,
            password: maybePassword,
            phone: maybePhone
          };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(userData)
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("authApi.register error:", error);

      return {
        success: false,
        message: "Unable to connect to registration server"
      };
    }
  },

  signup: async (name, email, password, phone) => {
    return authApi.register(name, email, password, phone);
  },

  login: async (emailOrCredentials, maybePassword) => {
    try {
      const credentials =
        typeof emailOrCredentials === "object" &&
          emailOrCredentials !== null
          ? emailOrCredentials
          : {
            email: emailOrCredentials,
            password: maybePassword
          };

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(credentials)
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("authApi.login error:", error);

      return {
        success: false,
        message: "Unable to connect to authentication server"
      };
    }
  },

  logout: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: authHeaders()
      });

      const data = await handleResponse(res);

      clearAuth();

      return data;
    } catch (error) {
      console.warn("Logout API call failed:", error);

      clearAuth();

      return { success: true };
    }
  }
};

// Membership Plans API
export const planApi = {
  getPlans: async () => {
    try {
      const res = await fetch(`${API_BASE}/plans`);

      return await handleResponse(res);
    } catch (error) {
      console.error("planApi.getPlans error:", error);

      return {
        success: false,
        message: "Unable to fetch plans",
        plans: []
      };
    }
  },

  getPlanById: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/plans/${id}`);

      return await handleResponse(res);
    } catch (error) {
      console.error("planApi.getPlanById error:", error);

      return {
        success: false,
        message: "Unable to fetch plan"
      };
    }
  }
};

// Member API
export const memberApi = {
  getProfile: async () => {
    try {
      const res = await fetch(`${API_BASE}/member/profile`, {
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("memberApi.getProfile error:", error);

      return {
        success: false,
        message: "Unable to load member profile"
      };
    }
  },

  getPass: async () => {
    try {
      const res = await fetch(`${API_BASE}/member/pass`, {
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("memberApi.getPass error:", error);

      return {
        success: false,
        message: "Unable to retrieve digital pass"
      };
    }
  },

  getAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/my-attendance-history`, {
        method: "GET",
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("memberApi.getAttendanceHistory error:", error);

      return {
        success: false,
        message: "Unable to load attendance history",
        history: []
      };
    }
  }
};

// Payment API
export const paymentApi = {
  createOrder: async (planId, planName) => {
    try {
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ planId, planName })
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("paymentApi.createOrder error:", error);

      return {
        success: false,
        message: "Unable to create payment order"
      };
    }
  },

  verifyPayment: async (paymentData) => {
    try {
      const res = await fetch(`${API_BASE}/payments/verify`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(paymentData)
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("paymentApi.verifyPayment error:", error);

      return {
        success: false,
        message: "Unable to verify payment"
      };
    }
  },

  getMyPayments: async () => {
    try {
      const res = await fetch(`${API_BASE}/payments/my-payments`, {
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("paymentApi.getMyPayments error:", error);

      return {
        success: false,
        message: "Unable to fetch payment history",
        payments: []
      };
    }
  }
};

// QR API
export const qrApi = {
  validate: async (passCode) => {
    try {
      const res = await fetch(`${API_BASE}/qr/validate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ passCode })
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("qrApi.validate error:", error);

      return {
        success: false,
        message: "Pass validation failed"
      };
    }
  },

  checkIn: async (passCode, checkInId) => {
    try {
      const res = await fetch(`${API_BASE}/qr/check-in`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ passCode, checkInId })
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("qrApi.checkIn error:", error);

      return {
        success: false,
        message: "Check-in failed"
      };
    }
  },

  getAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/attendance-history`, {
        method: "GET",
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("qrApi.getAttendanceHistory error:", error);

      return {
        success: false,
        message: "Unable to load attendance history",
        history: []
      };
    }
  },

  getMyAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/my-attendance-history`, {
        method: "GET",
        headers: authHeaders()
      });

      return await handleResponse(res);
    } catch (error) {
      console.error("qrApi.getMyAttendanceHistory error:", error);

      return {
        success: false,
        message: "Unable to load personal attendance history",
        history: []
      };
    }
  }
};
