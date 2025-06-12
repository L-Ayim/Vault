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
    bio?: string;
    isPublic?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Use QUERY_ME to fetch current user whenever there is a token
  const [loadMe, { data, loading: queryLoading, error }] = useLazyQuery<{ me: User }>(QUERY_ME, {
    fetchPolicy: "network-only",
  });

  // On mount, if a token exists, run the ME query
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadMe();
    } else {
      setInitializing(false);
    }
  }, [loadMe]);

  // Update user / auth state when ME data arrives or errors out
  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      setIsAuthenticated(true);
      setInitializing(false);
    } else if (error) {
      localStorage.removeItem("token");
      setUser(null);
      setIsAuthenticated(false);
      setInitializing(false);
    }
  }, [data, error]);

  const login = (token: string) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
    loadMe();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    user,
    loading: initializing || queryLoading,
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
