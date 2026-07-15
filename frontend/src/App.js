import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

// Restore theme on first paint (before auth loads)
try {
  const t = localStorage.getItem("ubc_theme");
  if (t) document.documentElement.dataset.theme = t;
} catch (_) { /* ignore */ }

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import { Loader2 } from "lucide-react";

function CheckingScreen() {
  return (
    <div className="min-h-screen grain flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <CheckingScreen />;
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [loadingState, setLoadingState] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !user.id) return;
    setLoadingState(true);
    try {
      const { data } = await api.get("/state");
      setState(data);
    } finally {
      setLoadingState(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id) refresh();
  }, [user, refresh]);

  if (user === null) return <CheckingScreen />;
  if (user === false) return <Navigate to="/login" replace />;

  if (!state) return <CheckingScreen />;
  if (!state.onboarded) return <Onboarding onDone={refresh} />;

  return <Dashboard state={state} refresh={refresh} />;
}

function HistoryProtected() {
  return (
    <Protected>
      <History />
    </Protected>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/history" element={<HistoryProtected />} />
            <Route path="/" element={<AppShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#121419",
              color: "#F4F0EA",
              border: "1px solid #22252D",
              fontFamily: "Manrope",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
