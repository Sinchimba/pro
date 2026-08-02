import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { logout as apiLogout } from "../lib/api";
import type { AuthUser } from "../lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "smart-meeting-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore session from a previous visit, if any.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed.user);
        setToken(parsed.token);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  function setAuth(newUser: AuthUser, newToken: string) {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: newUser, token: newToken })
    );
  }

  function logout() {
    // Notify the backend asynchronously to remove the token from Redis
    if (token) {
      apiLogout(token).catch((err) => {
        console.warn("Failed to notify server of logout session removal:", err);
      });
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}