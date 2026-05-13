import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import "../dashboard.css";

export default function Dashboard() {
  const [user, setUser]     = useState<any>(null);
  const [stats, setStats]   = useState({ disponibles: 0, rentados: 0, taller: 0, serviciosAbiertos: 0, rentasVencer: 0, facturasPendientes: 0 });
  const location            = useLocation();
  const navigate            = useNavigate();

  useEffect(() => {
    setAuth(localStorage.getItem("token"));
    api.get("/users/me").then(r => setUser(r.data)).catch(() => {});
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [montas, servicios, rentas, facturas] = await Promise.all([
        api.get("/montacargas"),
        api.get("/servicios"),
        api.get("/rentas"),
        api.get("/facturas"),
      ]);
      const montaList    = montas.data ?? [];
      const servicioList = servicios.data ?? [];
      const rentaList    = rentas.data ?? [];
      const facturaList  = facturas.data ?? [];
      const hoy          = new Date();
      const en30dias     = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setStats({
        disponibles:        montaList.filter((m: any) => m.estatus === "disponible").length,
        rentados:           montaList.filter((m: any) => m.estatus === "rentado").length,
        taller:             montaList.filter((m: any) => m.estatus === "taller" || m.estatus === "mantenimiento").length,
        serviciosAbiertos:  servicioList.filter((s: any) => s.estatus !== "cerrado").length,
        rentasVencer:       rentaList.filter((r: any) => r.estatus === "activa" && r.fechaFin && new Date(r.fechaFin) <= en30dias).length,
        facturasPendientes: facturaList.filter((f: any) => !f.pagado && new Date(f.fechaVencimiento) < hoy).length,
      });
    } catch {}
  }

  function logout() {
    localStorage.removeItem("token");
    setAuth(null);
    window.location.href = "/";
  }

  const navItems = [
    { to: "/dashboard",            icon: "📊", label: "Dashboard" },
    { to: "/dashboard/montacargas",icon: "🏗️",  label: "Montacargas" },
    { to: "/dashboard/clientes",   icon: "🏢", label: "Clientes" },
    { to: "/dashboard/rentas",     icon: "📋", label: "Rentas" },
    { to: "/dashboard/servicios",  icon: "🔧", label: "Servicios" },
    { to: "/dashboard/facturas",   icon: "💰", label: "Cobranza" },
    { to: "/dashboard/cotizaciones", icon: "📄", label: "Cotizaciones" },
    { to: "/dashboard/asesores", icon: "👤", label: "Asesores" },
  ];

  const isDashboard = location.pathname === "/dashboard";

  return (
    <div className="dash-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏗️</span>
          <div>
            <p className="brand-title">Control Pipsa</p>
            <p className="brand-sub">Gestión de Flota</p>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar-placeholder">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="sidebar-user-name">{user?.name ?? "Usuario"}</p>
            <p className="sidebar-user-role">Administrador</p>
          </div>
        </div>

        <p className="nav-section-label">Menú</p>
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-item ${location.pathname === item.to ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div className="sidebar-spacer" />
        <button className="sidebar-logout" onClick={logout}>
          <span>↩</span> Cerrar sesión
        </button>
      </aside>

      <div className="dash-main">
        {isDashboard ? (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Resumen general de la flota</p>
              </div>
            </div>
            <div className="page-content">
              <div className="stats-grid">
                <div className="stat-card" onClick={() => navigate("/dashboard/montacargas")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">✅</span>
                  <p className="stat-card-value" style={{ color: "var(--green)" }}>{stats.disponibles}</p>
                  <p className="stat-card-label">Disponibles</p>
                  <div className="stat-card-accent" style={{ background: "var(--green)" }} />
                </div>
                <div className="stat-card" onClick={() => navigate("/dashboard/montacargas")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">📦</span>
                  <p className="stat-card-value" style={{ color: "var(--blue)" }}>{stats.rentados}</p>
                  <p className="stat-card-label">Rentados</p>
                  <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
                </div>
                <div className="stat-card" onClick={() => navigate("/dashboard/montacargas")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">🔧</span>
                  <p className="stat-card-value" style={{ color: "var(--orange)" }}>{stats.taller}</p>
                  <p className="stat-card-label">En Taller</p>
                  <div className="stat-card-accent" style={{ background: "var(--orange)" }} />
                </div>
                <div className="stat-card" onClick={() => navigate("/dashboard/servicios")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">⚠️</span>
                  <p className="stat-card-value" style={{ color: "var(--accent)" }}>{stats.serviciosAbiertos}</p>
                  <p className="stat-card-label">Servicios Abiertos</p>
                  <div className="stat-card-accent" style={{ background: "var(--accent)" }} />
                </div>
                <div className="stat-card" onClick={() => navigate("/dashboard/rentas")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">📅</span>
                  <p className="stat-card-value" style={{ color: "var(--purple)" }}>{stats.rentasVencer}</p>
                  <p className="stat-card-label">Rentas por Vencer</p>
                  <div className="stat-card-accent" style={{ background: "var(--purple)" }} />
                </div>
                <div className="stat-card" onClick={() => navigate("/dashboard/facturas")} style={{ cursor: "pointer" }}>
                  <span className="stat-card-icon">💸</span>
                  <p className="stat-card-value" style={{ color: "var(--red)" }}>{stats.facturasPendientes}</p>
                  <p className="stat-card-label">Facturas Vencidas</p>
                  <div className="stat-card-accent" style={{ background: "var(--red)" }} />
                </div>
              </div>

              <div className="table-card">
                <div className="table-card-header">
                  <p className="table-card-title">Accesos rápidos</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1 }}>
                  {[
                    { to: "/dashboard/montacargas", icon: "🏗️", label: "Ver todos los montacargas", color: "var(--blue)" },
                    { to: "/dashboard/clientes",    icon: "🏢", label: "Gestionar clientes",         color: "var(--green)" },
                    { to: "/dashboard/rentas",      icon: "📋", label: "Ver rentas activas",         color: "var(--purple)" },
                    { to: "/dashboard/servicios",   icon: "🔧", label: "Servicios pendientes",       color: "var(--accent)" },
                    { to: "/dashboard/facturas",    icon: "💰", label: "Cobranza pendiente",         color: "var(--red)" },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border)",
                        textDecoration: "none", color: "var(--text)",
                        fontSize: "0.88rem", fontWeight: 500,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: "1.3rem" }}>{item.icon}</span>
                      {item.label}
                      <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <Outlet context={{ user }} />
        )}
      </div>
    </div>
  );
}
const isDashboard = location.pathname === "/dashboard";
console.log("pathname:", location.pathname, "isDashboard:", isDashboard);
