import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login        from "./pages/Login";
import Register     from "./pages/Register";
import Dashboard    from "./pages/Dashboard";
import Profile      from "./pages/Profile";
import VerifyEmail  from "./pages/VerifyEmail"; // ← agregar
import ProtectedRoute from "./routes/ProtectedRoute";

import "./index.css";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<Login />} />
        <Route path="/register"     element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} /> {/* ← agregar */}

        {/* Dashboard protegido */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="profile" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
