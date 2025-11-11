// src/auth/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async ({ identifier, password, email }) => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", {
        identifier: identifier || email,
        password,
      });
      setUser(res.data?.user ?? null);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ name, email, password }) => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        name,
        email,
        password,
      });
      setUser(res.data?.user ?? null);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setUser(null);
  };

  const value = { user, loading, login, register, logout };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export default AuthProvider;
