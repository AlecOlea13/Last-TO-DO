import React from "react";
import { Navigate } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  roles?: string[];
};

export default function ProtectedRoute({ children, roles }: Props) {
  const token = localStorage.getItem("token");
  const rol   = localStorage.getItem("rol") ?? "";

  if (!token) return <Navigate to="/" replace />;
  if (roles && !roles.includes(rol)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}