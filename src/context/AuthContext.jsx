/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

// Base URL of the Express backend
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

const AuthContext = createContext(null);

// Keeps track of which user is logged in across the whole website.
// The JWT is kept in localStorage so the session survives a page refresh.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));

  // On first load: if a JWT is stored, ask the backend who it belongs to
  useEffect(() => {
    if (!token) return;

    async function restoreSession() {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Invalid session");
        const data = await res.json();
        setUser(data.user);
      } catch {
        // Token expired / invalid -> clear it
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called after a successful login
  function login(newToken, newUser) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  // Clear the JWT on logout
  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
