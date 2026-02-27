import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import { clearAuthToken, getApiBaseUrl, getAuthToken } from "@/lib/auth";

function PublicOnlyRoute({ isAuthenticated, children }) {
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

const API_BASE_URL = getApiBaseUrl();

export default function App() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsCheckingAuth(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      const data = await response.json();
      setIsAuthenticated(true);
      setCurrentUser(data.user || null);
    } catch {
      clearAuthToken();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleAuthSuccess = useCallback((user) => {
    setIsAuthenticated(true);
    setCurrentUser(user || null);
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <Home user={currentUser} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute isAuthenticated={isAuthenticated}>
            <Login onAuthSuccess={handleAuthSuccess} />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/signup"
        element={(
          <PublicOnlyRoute isAuthenticated={isAuthenticated}>
            <Signup onAuthSuccess={handleAuthSuccess} />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <PublicOnlyRoute isAuthenticated={isAuthenticated}>
            <ForgotPassword />
          </PublicOnlyRoute>
        )}
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
}
