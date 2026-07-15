import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=logged out, obj=logged in
  const [error, setError] = useState("");

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.token) localStorage.setItem("ubc_token", data.token);
      setUser({ id: data.id, email: data.email, name: data.name });
      return true;
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  const register = async (email, password, name) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { email, password, name });
      if (data.token) localStorage.setItem("ubc_token", data.token);
      setUser({ id: data.id, email: data.email, name: data.name });
      return true;
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("ubc_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, error, setError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
