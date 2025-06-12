// src/auth/AuthContext.tsx

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLazyQuery } from "@apollo/client";
import { QUERY_ME } from "../graphql/operations";

interface User {
  id: string;
  username: string;
  email: string;
  profile?: {
    avatarUrl?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Use QUERY_ME to fetch current user based on the cookie
  const [loadMe, { data, loading, error }] = useLazyQuery<{ me: User }>(QUERY_ME, {
    fetchPolicy: "network-only",
  });

  // On mount, check if a session already exists via cookie
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Update user / auth state when ME data arrives or errors out
  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      setIsAuthenticated(true);
    } else if (error) {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [data, error]);

  const login = () => {
    setIsAuthenticated(true);
    loadMe();
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
