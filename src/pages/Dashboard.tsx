import { useEffect, useState, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import MontaScrollbar from "./MontaScrollbar";
import "../dashboard.css";

const ROL_LABEL: Record<string, string> = {
  developer:          "Developer",
  gerencia:           "Gerencia",
  oficina:            "Oficina",
  tecnico:            "Técnico",
  almacen:            "Almacén",
  supervisor_almacen: "Sup. Almacén",
};

function getSaludo(nombre: string) {
  const h = new Date().getHours();
  const saludo = h >= 6 && h < 12 ? "Buenos días" : h >= 12 && h < 19 ? "Buenas tardes" : "Buenas noches";
  return `${saludo}, ${nombre.split(" ")[0]}.`;
}

type Alerta = {
  id: string;
  tipo: "critico" | "advertencia" | "info";
  icon: string;
  mensaje: string;
  ruta: string;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    disponibles: 0, rentados: 0, taller: 0,
    serviciosAbiertos: 0, rentasVencer: 0, facturasPendientes: 0,
  });
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") ?? "dark"
  );
  const mainRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const nombre = localStorage.getItem("nombre") ?? "Usuario";
  const rol    = localStorage.getItem("rol") ?? "";

  useEffect(() => {
    setAuth(localStorage.getItem("token"));
    loadStats();
  }, []);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  }

  async function loadStats() {
    try {
      const [montas, servicios, rentas, facturas] = await Promise.all([
        api.get("/montacargas"),
        api.get("/servicios"),
        api.get("/rentas"),
        api.get("/facturas"),
      ]);
      const montaList    = montas.data    ?? [];
      const servicioList = servicios.data ?? [];
      const rentaList    = rentas.data    ?? [];
      const facturaList  = facturas.data  ?? [];

      const hoy      = new Date();
      const en7dias  = new Date(Date.now() + 7  * 24 * 60 * 60 * 1000);
      const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // ── Stats ──
      setStats({
        disponibles:        montaList.filter((m: any) => m.estatus === "disponible").length,
        rentados:           montaList.filter((m: any) => m.estatus === "rentado").length,
        taller:             montaList.filter((m: any) => m.estatus === "taller" || m.estatus === "mantenimiento").length,
        serviciosAbiertos:  servicioList.filter((s: any) => s.estatus !== "cerrado").length,
        rentasVencer:       rentaList.filter((r: any) => r.estatus === "activa" && r.fechaFin && new Date(r.fechaFin) <= en30dias).length,
        facturasPendientes: facturaList.filter((f: any) => !f.pagado && new Date(f.fechaVencimiento) < hoy).length,
      });

      // ── Alertas dinámicas por rol ──
      const nuevasAlertas: Alerta[] = [];

      // Técnico y todos: servicios abiertos
      const serviciosAbiertos = servicioList.filter((s: any) => s.estatus !== "cerrado");
      if (serviciosAbiertos.length > 0) {
        const urgentes = serviciosAbiertos.filter((s: any) => {
          const dias = Math.floor((hoy.getTime() - new Date(s.createdAt).getTime()) / 86400000);
          return dias >= 3;
        });
        if (urgentes.length > 0) {
          nuevasAlertas.push({
            id: "servicios-urgentes",
            tipo: "critico",
            icon: "🔧",
            mensaje: `${urgentes.length} servicio${urgentes.length > 1 ? "s" : ""} lleva${urgentes.length > 1 ? "n" : ""} más de 3 días abierto${urgentes.length > 1 ? "s" : ""} sin cerrar.`,
            ruta: "/dashboard/servicios",
          });
        } else {
          nuevasAlertas.push({
            id: "servicios-abiertos",
            tipo: "advertencia",
            icon: "🔧",
            mensaje: `Hay ${serviciosAbiertos.length} servicio${serviciosAbiertos.length > 1 ? "s" : ""} abierto${serviciosAbiertos.length > 1 ? "s" : ""} pendiente${serviciosAbiertos.length > 1 ? "s" : ""}.`,
            ruta: "/dashboard/servicios",
          });
        }
      }

      // Montacargas en taller/mantenimiento: todos
      const enTaller = montaList.filter((m: any) => m.estatus === "taller" || m.estatus === "mantenimiento");
      if (enTaller.length > 0) {
        nuevasAlertas.push({
          id: "montas-taller",
          tipo: "advertencia",
          icon: "🏗️",
          mensaje: `${enTaller.length} montacargas en taller o mantenimiento.`,
          ruta: "/dashboard/montacargas",
        });
      }

      // Mantenimiento vencido en montacargas
      const mantVencido = montaList.filter((m: any) => m.proximoMantenimiento && new Date(m.proximoMantenimiento) < hoy);
      if (mantVencido.length > 0) {
        nuevasAlertas.push({
          id: "mant-vencido",
          tipo: "critico",
          icon: "⚙️",
          mensaje: `${mantVencido.length} equipo${mantVencido.length > 1 ? "s" : ""} con mantenimiento vencido.`,
          ruta: "/dashboard/montacargas",
        });
      }

      // Rentas: solo oficina, gerencia, developer
      if (["developer", "gerencia", "oficina"].includes(rol)) {
        const rentasVencidas = rentaList.filter((r: any) => r.estatus === "activa" && r.fechaFin && new Date(r.fechaFin) < hoy);
        if (rentasVencidas.length > 0) {
          nuevasAlertas.push({
            id: "rentas-vencidas",
            tipo: "critico",
            icon: "📋",
            mensaje: `${rentasVencidas.length} renta${rentasVencidas.length > 1 ? "s" : ""} ya vencida${rentasVencidas.length > 1 ? "s" : ""} y aún activa${rentasVencidas.length > 1 ? "s" : ""}.`,
            ruta: "/dashboard/rentas",
          });
        }

        const rentasSemana = rentaList.filter((r: any) => r.estatus === "activa" && r.fechaFin && new Date(r.fechaFin) > hoy && new Date(r.fechaFin) <= en7dias);
        if (rentasSemana.length > 0) {
          nuevasAlertas.push({
            id: "rentas-semana",
            tipo: "advertencia",
            icon: "📅",
            mensaje: `${rentasSemana.length} renta${rentasSemana.length > 1 ? "s" : ""} vence${rentasSemana.length > 1 ? "n" : ""} en los próximos 7 días.`,
            ruta: "/dashboard/rentas",
          });
        }

        const rentasMes = rentaList.filter((r: any) => r.estatus === "activa" && r.fechaFin && new Date(r.fechaFin) > en7dias && new Date(r.fechaFin) <= en30dias);
        if (rentasMes.length > 0) {
          nuevasAlertas.push({
            id: "rentas-mes",
            tipo: "info",
            icon: "📅",
            mensaje: `${rentasMes.length} renta${rentasMes.length > 1 ? "s" : ""} vence${rentasMes.length > 1 ? "n" : ""} en los próximos 30 días.`,
            ruta: "/dashboard/rentas",
          });
        }

        // Facturas vencidas
        const factVencidas = facturaList.filter((f: any) => !f.pagado && new Date(f.fechaVencimiento) < hoy);
        if (factVencidas.length > 0) {
          nuevasAlertas.push({
            id: "facturas-vencidas",
            tipo: "critico",
            icon: "💸",
            mensaje: `${factVencidas.length} factura${factVencidas.length > 1 ? "s" : ""} vencida${factVencidas.length > 1 ? "s" : ""} sin pagar.`,
            ruta: "/dashboard/facturas",
          });
        }
      }

      setAlertas(nuevasAlertas);
    } catch {}
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("nombre");
    setAuth(null);
    window.location.href = "/";
  }

  const allNav = [
  { to: "/dashboard",             icon: "📊", label: "Dashboard",    roles: ["developer","gerencia","oficina","tecnico","almacen","supervisor_almacen"] },
  { to: "/dashboard/montacargas", icon: "🏗️",  label: "Montacargas", roles: ["developer","gerencia","oficina","tecnico","almacen","supervisor_almacen"] },
  { to: "/dashboard/servicios",   icon: "🔧", label: "Servicios",    roles: ["developer","gerencia","oficina","tecnico","almacen","supervisor_almacen"] },
  { to: "/dashboard/almacen",     icon: "📦", label: "Almacén",      roles: ["developer","gerencia","oficina","tecnico","almacen","supervisor_almacen"] },
  { to: "/dashboard/clientes",    icon: "🏢", label: "Clientes",     roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/rentas",      icon: "📋", label: "Rentas",       roles: ["developer","gerencia","oficina","supervisor_almacen"] },
  { to: "/dashboard/cotizaciones",icon: "📄", label: "Cotizaciones", roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/gastos",      icon: "🧾", label: "Gastos",       roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/asesores",    icon: "👤", label: "Asesores",     roles: ["developer"] },
  { to: "/dashboard/usuarios",    icon: "👥", label: "Usuarios",     roles: ["developer"] },
  { to: "/dashboard/cxc",         icon: "💰", label: "CxC",          roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/proveedores", icon: "🏭", label: "Proveedores",  roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/portales",    icon: "🔑", label: "Portales",     roles: ["developer","gerencia","oficina"] },
  { to: "/dashboard/flota",       icon: "🚗", label: "Flota",        roles: ["developer","gerencia","oficina"], permiso: "flota" },
];

  const permisos = JSON.parse(localStorage.getItem("permisos") ?? "[]") as string[];
  const navItems = allNav.filter(item => {
    if (!item.roles.includes(rol)) return false;
    if (item.permiso && !permisos.includes(item.permiso) && !["developer", "gerencia"].includes(rol)) return false;
    return true;
  });
  const isDashboard = location.pathname === "/dashboard";

  const ALERTA_STYLE: Record<string, { border: string; bg: string; color: string }> = {
    critico:      { border: "var(--red)",    bg: "rgba(239,68,68,0.08)",   color: "var(--red)" },
    advertencia:  { border: "var(--accent)", bg: "rgba(245,158,11,0.08)",  color: "var(--accent)" },
    info:         { border: "var(--blue)",   bg: "rgba(59,130,246,0.08)",  color: "var(--blue)" },
  };

  return (
    <div className="dash-root">

      {/* ── Overlay móvil ── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Topbar móvil ── */}
      <div className="mobile-topbar">
        <span className="mobile-topbar-brand">🏗️ Control Pipsa</span>
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(p => !p)}>
          {sidebarOpen ? "✕" : "☰"}
        </button>
      </div>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">🏗️</span>
          <div>
            <p className="brand-title">Control Pipsa</p>
            <p className="brand-sub">Gestión de Flota</p>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar-placeholder">
            {nombre?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="sidebar-user-name">{nombre}</p>
            <p className="sidebar-user-role">{ROL_LABEL[rol] ?? rol}</p>
          </div>
        </div>

        <p className="nav-section-label">Menú</p>
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-item ${location.pathname === item.to ? "active" : ""}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <button className="theme-toggle" onClick={toggleTheme}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="theme-toggle-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
            {theme === "dark" ? "Modo oscuro" : "Modo claro"}
          </span>
          <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Cambiar</span>
        </button>

        <div className="sidebar-spacer" />
        <button className="sidebar-logout" onClick={logout}>
          <span>↩</span> Cerrar sesión
        </button>
      </aside>

      <div className="dash-main" ref={mainRef}>
        {isDashboard ? (
          <div key="dashboard-home" className="page-transition">
            <div className="page-header">
              <div>
                <h1 className="page-title">{getSaludo(nombre)}</h1>
                <p className="page-subtitle">Aquí está el resumen de hoy.</p>
              </div>
            </div>

            <div className="page-content">

              {/* ── Alertas ── */}
              {alertas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {alertas.map(a => {
                    const s = ALERTA_STYLE[a.tipo];
                    return (
                      <div
                        key={a.id}
                        onClick={() => { navigate(a.ruta); setSidebarOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 18px",
                          borderRadius: "var(--radius)",
                          border: `1.5px solid ${s.border}`,
                          background: s.bg,
                          cursor: "pointer",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                      >
                        <span style={{ fontSize: "1.3rem" }}>{a.icon}</span>
                        <span style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 500, flex: 1 }}>
                          {a.mensaje}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: s.color, fontWeight: 700, textTransform: "uppercase" }}>
                          {a.tipo === "critico" ? "⚠ Urgente" : a.tipo === "advertencia" ? "Atención" : "Info"}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {alertas.length === 0 && (
                <div style={{
                  padding: "14px 18px", borderRadius: "var(--radius)",
                  border: "1.5px solid var(--green)", background: "rgba(34,197,94,0.08)",
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
                }}>
                  <span style={{ fontSize: "1.3rem" }}>✅</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 500 }}>
                    Todo en orden, no hay alertas pendientes.
                  </span>
                </div>
              )}

              {/* ── Stats ── */}
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

              {/* ── Accesos rápidos ── */}
              <div className="table-card">
                <div className="table-card-header">
                  <p className="table-card-title">Accesos rápidos</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1 }}>
                  {navItems.filter(i => i.to !== "/dashboard").map(item => (
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
          </div>
        ) : (
          <div key={location.pathname} className="page-transition">
            <Outlet context={{ nombre, rol }} />
          </div>
        )}
      </div>

      <MontaScrollbar targetRef={mainRef} />
    </div>
  );
}