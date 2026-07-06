import React from "react";
import { Navigate } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  roles?: string[];
  permiso?: string;
};

export default function ProtectedRoute({ children, roles, permiso }: Props) {
  const token    = localStorage.getItem("token");
  const rol      = localStorage.getItem("rol") ?? "";
  const permisos = JSON.parse(localStorage.getItem("permisos") ?? "[]") as string[];

  if (!token) return <Navigate to="/" replace />;
  if (roles && !roles.includes(rol)) return <Navigate to="/dashboard" replace />;
  if (permiso && !permisos.includes(permiso) && !["developer", "gerencia"].includes(rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}