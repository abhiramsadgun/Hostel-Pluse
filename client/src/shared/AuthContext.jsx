import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hostelpulse_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('hostelpulse_token') || null);
  const [loading, setLoading] = useState(true);
  const [assignedWardens, setAssignedWardens] = useState([]);

  async function loadProfile() {
    if (!localStorage.getItem('hostelpulse_token')) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      if (res.success && res.data.user) {
        setUser(res.data.user);
        setAssignedWardens(res.data.user.assignedWardens || []);
        localStorage.setItem('hostelpulse_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.warn('Failed to refresh profile session:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();

    const handleLogout = () => {
      setUser(null);
      setToken(null);
      setAssignedWardens([]);
    };
    window.addEventListener('auth_logout', handleLogout);
    return () => window.removeEventListener('auth_logout', handleLogout);
  }, []);

  async function login(identifier, password) {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.success) {
      const { token: newTok, refreshToken, user: authUser } = res.data;
      localStorage.setItem('hostelpulse_token', newTok);
      localStorage.setItem('hostelpulse_refresh_token', refreshToken);
      localStorage.setItem('hostelpulse_user', JSON.stringify(authUser));
      setToken(newTok);
      setUser(authUser);
      await loadProfile();
      return authUser;
    }
  }

  function logout() {
    localStorage.removeItem('hostelpulse_token');
    localStorage.removeItem('hostelpulse_refresh_token');
    localStorage.removeItem('hostelpulse_user');
    setUser(null);
    setToken(null);
    setAssignedWardens([]);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        assignedWardens,
        login,
        logout,
        refreshProfile: loadProfile,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
