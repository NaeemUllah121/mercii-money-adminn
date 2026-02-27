import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface AdminUser {
  id: string;
  username: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  mfaEnabled: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  login: (username: string, password: string, mfaToken?: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('adminUser');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [token]);

  const login = async (username: string, password: string, mfaToken?: string) => {
    const response = await authAPI.login(username, password, mfaToken);
    const data = response.data;

    if (data.requiresMFA) {
      return data;
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUser', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    authAPI.logout().catch(() => {});
    setToken(null);
    setUser(null);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
