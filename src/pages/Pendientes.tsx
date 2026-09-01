import { useEffect, useState } from "react";
import { api } from "../api";
// import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Pendiente = {
  _id: string;
  servicio?: { folio: string };
  montacargas?: { numeroEconomico: string; marca: string; modelo?: string };
  cliente?: { nombre: string };
  tecnico?: { nombre: string };
  descripcion: string;
  resuelto: boolean;
  fechaResuelto?: string;
  resueltoPor?: { nombre: string };
  createdAt: string;
};

// function BtnMic({ onResult }: { onResult: (t: string) => void }) {
//   const { escuchando, iniciar, detener } = useSpeechRecognition(onResult);
//   return (
//     <button type="button" onClick={escuchando ? detener : iniciar}
//       style={{ background: escuchando ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.1)", border: `1.5px solid ${escuchando ? "var(--red)" : "rgba(245,158,11,0.3)"}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, flexShrink: 0 }}
//       title={escuchando ? "Toca para detener" : "Toca para dictar"}>
//       {escuchando ? "🔴" : "🎙️"}
//     </button>
//   );
// }

export default function Pendientes() {
  const rol = localStorage.getItem("rol") ?? "";
  const puedeVerTodos = ["developer", "gerencia", "supervisor_almacen"].includes(rol);

  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filtro, setFiltro]         = useState<"pendiente" | "resuelto" | "todos">("pendiente");
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  useEffect(() => { load(); }, [filtro]);

  async function load() {
    setLoading(true);
    try {
      const query = filtro === "todos" ? "" : `?resuelto=${filtro === "resuelto"}`;
      const { data } = await api.get(`/pendientes${query}`);
      setPendientes(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function resolver(id: string) {
    setResolviendoId(id);
    try {
      await api.put(`/pendientes/${id}/resolver`);
      await load();
    } catch { alert("Error al marcar como resuelto"); }
    finally { setResolviendoId(null); }
  }

  async function reabrir(id: string) {
    try {
      await api.put(`/pendientes/${id}/reabrir`);
      await load();
    } catch { alert("Error al reabrir"); }
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

//   const total     = pendientes.length;
  const pendCount = pendientes.filter(p => !p.resuelto).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pendientes</h1>
          <p className="page-subtitle">
            {puedeVerTodos ? "Pendientes de todos los técnicos" : "Tus pendientes"} · {pendCount} sin resolver
          </p>
        </div>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Lista de pendientes</p>
            <div className="table-toolbar">
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["pendiente", "Sin resolver"], ["resuelto", "Resueltos"], ["todos", "Todos"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setFiltro(val)}
                    style={{ padding: "8px 16px", border: "none", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: filtro === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: filtro === val ? "var(--accent)" : "var(--text-muted)", fontWeight: filtro === val ? 700 : 400, fontSize: "0.82rem" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : pendientes.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">✅</span><p>Sin pendientes {filtro === "resuelto" ? "resueltos" : ""}</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {pendientes.map(p => (
                <div key={p._id} style={{
                  display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px",
                  borderBottom: "1px solid var(--border)", opacity: p.resuelto ? 0.6 : 1,
                }}>
                  <button
                    onClick={() => p.resuelto ? reabrir(p._id) : resolver(p._id)}
                    disabled={resolviendoId === p._id}
                    style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                      border: `2px solid ${p.resuelto ? "var(--green)" : "var(--border)"}`,
                      background: p.resuelto ? "var(--green)" : "transparent",
                      color: p.resuelto ? "#000" : "transparent",
                      cursor: "pointer", fontWeight: 900, fontSize: "1rem",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title={p.resuelto ? "Reabrir" : "Marcar como resuelto"}
                  >
                    ✓
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "0.85rem", color: "var(--accent)" }}>
                        {p.servicio?.folio ?? "—"}
                      </span>
                      {p.montacargas && (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          #{p.montacargas.numeroEconomico} {p.montacargas.marca}
                        </span>
                      )}
                      {p.cliente && (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>· {p.cliente.nombre}</span>
                      )}
                    </div>
                    <p style={{
                      margin: 0, fontSize: "0.92rem", color: "var(--text)",
                      textDecoration: p.resuelto ? "line-through" : "none",
                    }}>
                      {p.descripcion}
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      <span>👤 {p.tecnico?.nombre ?? "—"}</span>
                      <span>📅 {fmt(p.createdAt)}</span>
                      {p.resuelto && p.resueltoPor && (
                        <span style={{ color: "var(--green)" }}>✓ Resuelto por {p.resueltoPor.nombre}{p.fechaResuelto ? ` · ${fmt(p.fechaResuelto)}` : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}