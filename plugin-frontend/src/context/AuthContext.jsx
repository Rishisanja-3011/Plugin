import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('plugin_user');
    const token = localStorage.getItem('plugin_token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const data = res.data;
    localStorage.setItem('plugin_token', data.token);
    localStorage.setItem('plugin_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const register = async (fullName, email, password, phone) => {
    const res = await authApi.register({ fullName, email, password, phone });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('plugin_token');
    localStorage.removeItem('plugin_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STATION_OPERATOR';
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, isAdmin, isCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
