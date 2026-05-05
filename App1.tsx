import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login      from "./pages/Login";
import Register   from "./pages/Register";
import Dashboard  from "./pages/Dashboard";
import Profile    from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail"; // ← nuevo
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/verify-email"  element={<VerifyEmail />} /> {/* ← nuevo */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            window.location.pathname === "/verify-email"
            ? null
            :localStorage.getItem("token")
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

