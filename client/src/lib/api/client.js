/**
 * API client with authentication support
 */

const API_BASE_URL = '/api';

/**
 * Get auth token from localStorage
 */
export function getAuthToken() {
  return localStorage.getItem('authToken');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

/**
 * Remove auth token from localStorage
 */
export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

/**
 * Fetch wrapper with auth headers
 */
export async function fetchAPI(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Auth API calls
 */
export const authAPI = {
  login: async (username, password) => {
    const data = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (data.token) {
      setAuthToken(data.token);
    }

    return data;
  },

  logout: async () => {
    await fetchAPI('/auth/logout', { method: 'POST' });
    clearAuthToken();
  },

  verify: async () => {
    return fetchAPI('/auth/verify');
  },
};

/**
 * Workout API calls
 */
export const workoutAPI = {
  getToday: async (date) => {
    const query = date ? `?date=${date}` : '';
    return fetchAPI(`/workouts/today${query}`);
  },

  getHistory: async (limit = 20, offset = 0) => {
    return fetchAPI(`/workouts/history?limit=${limit}&offset=${offset}`);
  },

  getSession: async (id) => {
    return fetchAPI(`/workouts/session/${id}`);
  },

  createSession: async (date, dayNumber, exerciseGroupId) => {
    return fetchAPI('/workouts/session', {
      method: 'POST',
      body: JSON.stringify({ date, dayNumber, exerciseGroupId }),
    });
  },

  updateSession: async (id, updates) => {
    return fetchAPI(`/workouts/session/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  createSet: async (setData) => {
    return fetchAPI('/workouts/set', {
      method: 'POST',
      body: JSON.stringify(setData),
    });
  },

  updateSet: async (id, updates) => {
    return fetchAPI(`/workouts/set/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteSet: async (id) => {
    return fetchAPI(`/workouts/set/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Config API calls
 */
export const configAPI = {
  getStaticData: async () => {
    return fetchAPI('/config/static-data');
  },

  getCycleStart: async () => {
    return fetchAPI('/config/cycle-start');
  },

  updateCycleStart: async (startDate) => {
    return fetchAPI('/config/cycle-start', {
      method: 'PUT',
      body: JSON.stringify({ startDate }),
    });
  },
};

/**
 * Sync API calls
 */
export const syncAPI = {
  pull: async (since) => {
    const query = since ? `?since=${since}` : '';
    return fetchAPI(`/sync/pull${query}`);
  },

  push: async (changes) => {
    return fetchAPI('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    });
  },
};
