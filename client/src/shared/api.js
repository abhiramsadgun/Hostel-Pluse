const API_BASE = '/api/v1';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('hostelpulse_token');
  const headers = {
    ...(options.headers || {}),
  };

  // Only set Content-Type to JSON if not uploading FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Check for token expiry
    if (response.status === 401 && (data?.error?.code === 'AUTH_TOKEN_EXPIRED' || data?.error?.code === 'UNAUTHORIZED')) {
      const refreshToken = localStorage.getItem('hostelpulse_refresh_token');
      if (refreshToken && !options._retry) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshData = await refreshRes.json();
          if (refreshRes.ok && refreshData.success) {
            localStorage.setItem('hostelpulse_token', refreshData.data.token);
            return apiRequest(endpoint, { ...options, _retry: true });
          }
        } catch (e) {
          // ignore and clear
        }
      }
      localStorage.removeItem('hostelpulse_token');
      localStorage.removeItem('hostelpulse_refresh_token');
      localStorage.removeItem('hostelpulse_user');
      window.dispatchEvent(new Event('auth_logout'));
    }

    const err = new Error(data?.error?.message || `Request failed with status ${response.status}`);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (url, opts) => apiRequest(url, { method: 'GET', ...opts }),
  post: (url, body, opts) => apiRequest(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), ...opts }),
  put: (url, body, opts) => apiRequest(url, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body), ...opts }),
  delete: (url, opts) => apiRequest(url, { method: 'DELETE', ...opts }),
};
