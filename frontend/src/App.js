import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import { Loader2 } from "lucide-react";

try {
  const t = localStorage.getItem("ubc_theme");
  if (t) document.documentElement.dataset.theme = t;
} catch (_) { /* ignore */ }

document.title = "Track.It — count what matters";

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
            <Route path="/" element={<Protected><Home /></Protected>} />
            <Route path="/t/:trackerId" element={<Protected><Dashboard /></Protected>} />
            <Route path="/t/:trackerId/history" element={<Protected><History /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              fontFamily: "Manrope",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
