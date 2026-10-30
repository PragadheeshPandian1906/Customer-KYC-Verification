import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserResponse, RoleCode, LoginRequest } from '@/types/auth';
import { api, SESSION_EXPIRED_EVENT } from '@/lib/api/client';
import { getCsrfToken, clearCsrfToken } from '@/lib/api/csrf';
import { ApiError, extractErrorMessage } from '@/lib/api/errors';

interface AuthContextType {
  user: UserResponse | null;
  isLoading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<UserResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserResponse | null>;
  hasRole: (role: RoleCode) => boolean;
  isCustomer: boolean;
  isAnalyst: boolean;
  isSupervisor: boolean;
  isAdmin: boolean;
  primaryRole: RoleCode | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshUser = useCallback(async (): Promise<UserResponse | null> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      // Ensure CSRF token is initialized as well
      await getCsrfToken();
      const userData = await api.get<UserResponse>('/api/v1/auth/me');
      setUser(userData);
      return userData;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        clearCsrfToken();
        setAuthError(null);
      } else {
        setAuthError(extractErrorMessage(err));
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearCsrfToken();
      setUser(null);
      setAuthError(null);
      setIsLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    refreshUser();
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [refreshUser]);

  const login = async (credentials: LoginRequest): Promise<UserResponse> => {
    setAuthError(null);
    // 1. Fetch CSRF token
    await getCsrfToken(true);
    // 2. Perform login request
    const response = await api.post<UserResponse>('/api/v1/auth/login', credentials);
    setUser(response);
    return response;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post<void>('/api/v1/auth/logout');
    } catch (err) {
      console.warn('Logout error from server', err);
    } finally {
      clearCsrfToken();
      setUser(null);
    }
  };

  const hasRole = useCallback(
    (role: RoleCode): boolean => {
      return !!user?.roles?.includes(role);
    },
    [user]
  );

  const isCustomer = !!user?.roles?.includes('CUSTOMER');
  const isAnalyst = !!user?.roles?.includes('KYC_ANALYST');
  const isSupervisor = !!user?.roles?.includes('COMPLIANCE_SUPERVISOR');
  const isAdmin = !!user?.roles?.includes('API_CLIENT_ADMIN');

  const primaryRole: RoleCode | null = user?.roles?.[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        hasRole,
        isCustomer,
        isAnalyst,
        isSupervisor,
        isAdmin,
        primaryRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
