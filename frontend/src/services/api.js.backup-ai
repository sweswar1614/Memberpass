

const API_BASE = import.meta.env.VITE_API_URL || 'https://memberpass.onrender.com/api';


export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error('Failed to parse user from localStorage', e);
    return null;
  }
};

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const authHeaders = () => {
  const token = localStorage.getItem('token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const authApi = {
  register: async (userDataOrName, maybeEmail, maybePassword, maybePhone) => {
    try {
      const userData =
        typeof userDataOrName === 'object' && userDataOrName !== null
          ? userDataOrName
          : {
              name: userDataOrName,
              email: maybeEmail,
              password: maybePassword,
              phone: maybePhone
            };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(userData)
      });
      return await res.json();
    } catch (err) {
      console.error('authApi.register error:', err);
      return { success: false, message: 'Unable to connect to registration server' };
    }
  },

  signup: async (name, email, password, phone) => {
    return authApi.register(name, email, password, phone);
  },

  login: async (emailOrCredentials, maybePassword) => {
    try {
      const credentials =
        typeof emailOrCredentials === 'object' && emailOrCredentials !== null
          ? emailOrCredentials
          : { email: emailOrCredentials, password: maybePassword };

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(credentials)
      });
      return await res.json();
    } catch (err) {
      console.error('authApi.login error:', err);
      return { success: false, message: 'Unable to connect to authentication server' };
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders()
      });
    } catch (e) {
      console.warn('Logout API call failed, continuing local clear', e);
    }
    clearAuth();
    return { success: true };
  }
};

export const planApi = {
  getPlans: async () => {
    try {
      const res = await fetch(`${API_BASE}/plans`);
      return await res.json();
    } catch (err) {
      console.error('planApi.getPlans error:', err);
      return { success: false, message: 'Unable to fetch plans', plans: [] };
    }
  },

  getPlanById: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/plans/${id}`);
      return await res.json();
    } catch (err) {
      console.error('planApi.getPlanById error:', err);
      return { success: false, message: 'Unable to fetch plan' };
    }
  }
};

export const memberApi = {
  getProfile: async () => {
    try {
      const res = await fetch(`${API_BASE}/member/profile`, {
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('memberApi.getProfile error:', err);
      return { success: false, message: 'Unable to load member profile' };
    }
  },

  getPass: async () => {
    try {
      const res = await fetch(`${API_BASE}/member/pass`, {
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('memberApi.getPass error:', err);
      return { success: false, message: 'Unable to retrieve digital pass' };
    }
  },

  getAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/my-attendance-history`, {
        method: 'GET',
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('memberApi.getAttendanceHistory error:', err);
      return { success: false, message: 'Unable to load attendance history', history: [] };
    }
  }
};

export const paymentApi = {
  createOrder: async (planId, planName) => {
    try {
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId, planName })
      });
      return await res.json();
    } catch (err) {
      console.error('paymentApi.createOrder error:', err);
      return { success: false, message: 'Unable to create payment order' };
    }
  },

  verifyPayment: async (paymentData) => {
    try {
      const res = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(paymentData)
      });
      return await res.json();
    } catch (err) {
      console.error('paymentApi.verifyPayment error:', err);
      return { success: false, message: 'Unable to verify payment' };
    }
  },

  getMyPayments: async () => {
    try {
      const res = await fetch(`${API_BASE}/payments/my-payments`, {
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('paymentApi.getMyPayments error:', err);
      return { success: false, message: 'Unable to fetch payment history', payments: [] };
    }
  }
};

export const qrApi = {
  validate: async (passCode) => {
    try {
      const res = await fetch(`${API_BASE}/qr/validate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ passCode })
      });
      return await res.json();
    } catch (err) {
      console.error('qrApi.validate error:', err);
      return { success: false, message: 'Pass validation failed' };
    }
  },

  checkIn: async (passCode, checkInId) => {
    try {
      const res = await fetch(`${API_BASE}/qr/check-in`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ passCode, checkInId })
      });
      return await res.json();
    } catch (err) {
      console.error('qrApi.checkIn error:', err);
      return { success: false, message: 'Check-in failed' };
    }
  },

  getAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/attendance-history`, {
        method: 'GET',
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('qrApi.getAttendanceHistory error:', err);
      return { success: false, message: 'Unable to load attendance history', history: [] };
    }
  },

  getMyAttendanceHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/qr/my-attendance-history`, {
        method: 'GET',
        headers: authHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error('qrApi.getMyAttendanceHistory error:', err);
      return { success: false, message: 'Unable to load personal attendance history', history: [] };
    }
  }
};

