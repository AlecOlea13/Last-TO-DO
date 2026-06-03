import { useEffect, useState } from "react";
import { api } from "../api";

type Renta = {
  _id: string;
  cliente?: { _id: string; nombre: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo: string };
  asesor?: { _id: string; nombre: string };
  fechaInicio: string;
  fechaFin?: string;
  tipoPeriodo?: "semanal" | "mensual" | "anual";
  precioMensual: number;
  flete?: number;
  deposito?: number;
  estatus: "activa" | "vencida" | "terminada";
};

type Cliente     = { _id: string; nombre: string };
type Montacargas = { _id: string; numeroEconomico: string; marca: string; modelo: string; estatus: string };
type Asesor      = { _id: string; nombre: string };

const emptyForm = {
  cliente: "", montacargas: "", asesor: "", fechaInicio: "", fechaFin: "",
  tipoPeriodo: "mensual",
  precioMensual: 0, flete: 0, deposito: 0, estatus: "activa",
};

const ESTATUS_BADGE: Record<string, string> = {
  activa:    "badge-green",
  vencida:   "badge-amber",
  terminada: "badge-gray",
};

const PERIODO_LABEL: Record<string, string> = {
  semanal: "📅 Semanal",
  mensual: "🗓️ Mensual",
  anual:   "📆 Anual",
};

export default function Rentas() {
  const [rentas, setRentas]       = useState<Renta[]>([]);
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [montas, setMontas]       = useState<Montacargas[]>([]);
  const [asesores, setAsesores]   = useState<Asesor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filtro, setFiltro]       = useState("todos");
  const [filtroAsesor, setFiltroAsesor] = useState("todos");
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState<any>(emptyForm);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, c, m, a] = await Promise.all([
        api.get("/rentas"),
        api.get("/clientes"),
        api.get("/montacargas"),
        api.get("/asesores"),
      ]);
      setRentas(r.data);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
      setMontas(m.data.filter((mt: any) => mt.estatus === "disponible"));
      setAsesores(a.data);
    } catch {}
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.cliente || !form.montacargas || !form.fechaInicio || !form.precioMensual) return;
    setSaving(true);
    try {
      const { data } = await api.post("/rentas", form);
      setRentas(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function cerrar(renta: Renta) {
    if (!confirm("¿Cerrar esta renta?")) return;
    await api.post(`/rentas/${renta._id}/cerrar`, { estatusMonta: "disponible" });
    load();
  }

  const filtered = rentas.filter(r => {
    const matchSearch =
      (r.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro  = filtro === "todos" || r.estatus === filtro;
    const matchAsesor  = filtroAsesor === "todos" || r.asesor?._id === filtroAsesor;
    return matchSearch && matchFiltro && matchAsesor;
  });

 function fmt(date?: string) {
  if (!date) return "—";
  // Parsear sin conversión de zona horaria
  const [year, month, day] = date.split("T")[0].split("-");
  return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

  function diasRestantes(fechaFin?: string) {
    if (!fechaFin) return null;
    return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86400000);
  }

  const precioLabel = form.tipoPeriodo === "semanal"
    ? "Precio semanal"
    : form.tipoPeriodo === "anual"
    ? "Precio anual"
    : "Precio mensual";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rentas</h1>
          <p className="page-subtitle">{rentas.filter(r => r.estatus === "activa").length} rentas activas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>
          + Nueva renta
        </button>
      </div>

      <div className="page-content">
        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Todas las rentas</p>
            <div className="table-toolbar">
              <input
                className="search-input"
                placeholder="🔍 Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="form-select"
                style={{ width: "auto", padding: "8px 14px" }}
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
              >
                <option value="todos">Todas</option>
                <option value="activa">Activas</option>
                <option value="vencida">Vencidas</option>
                <option value="terminada">Terminadas</option>
              </select>
              <select
                className="form-select"
                style={{ width: "auto", padding: "8px 14px" }}
                value={filtroAsesor}
                onChange={e => setFiltroAsesor(e.target.value)}
              >
                <option value="todos">Todos los asesores</option>
                {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <p>Sin rentas{search ? " con ese filtro" : " registradas"}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Equipo</th>
                  <th>Asesor</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Periodo</th>
                  <th>Precio</th>
                  <th>Flete</th>
                  <th>Depósito</th>
                  <th>Días restantes</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const dias = diasRestantes(r.fechaFin);
                  return (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 600 }}>{r.cliente?.nombre ?? "—"}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.montacargas?.numeroEconomico}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {r.montacargas?.marca}</span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{r.asesor?.nombre ?? "—"}</td>
                      <td>{fmt(r.fechaInicio)}</td>
                      <td>{fmt(r.fechaFin)}</td>
                      <td style={{ textTransform: "capitalize" }}>{r.tipoPeriodo ?? "mensual"}</td>
                      <td>${r.precioMensual.toLocaleString()}</td>
                      <td>{r.flete ? `$${r.flete.toLocaleString()}` : "—"}</td>
                      <td>{r.deposito ? `$${r.deposito.toLocaleString()}` : "—"}</td>
                      <td>
                        {dias !== null ? (
                          <span style={{
                            color: dias <= 7 ? "var(--red)" : dias <= 30 ? "var(--accent)" : "var(--green)",
                            fontWeight: 600,
                          }}>
                            {dias > 0 ? `${dias} días` : "Vencida"}
                          </span>
                        ) : "—"}
                      </td>
                      <td><span className={`badge ${ESTATUS_BADGE[r.estatus]}`}>{r.estatus}</span></td>
                      <td>
                        {r.estatus === "activa" && (
                          <button className="btn btn-danger btn-sm" onClick={() => cerrar(r)}>Cerrar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nueva renta</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                <select className="form-select" value={form.montacargas} onChange={e => setForm((p: any) => ({ ...p, montacargas: e.target.value }))}>
                  <option value="">Selecciona equipo...</option>
                  {montas.map(m => (
                    <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca} {m.modelo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Asesor</label>
                <select className="form-select" value={form.asesor} onChange={e => setForm((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asesor</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Tipo de periodo *</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["semanal", "mensual", "anual"] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setForm((p: any) => ({ ...p, tipoPeriodo: tipo }))}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px", border: "2px solid",
                        borderColor: form.tipoPeriodo === tipo ? "var(--accent)" : "var(--border)",
                        background: form.tipoPeriodo === tipo ? "rgba(255,180,0,0.12)" : "var(--input-bg)",
                        color: form.tipoPeriodo === tipo ? "var(--accent)" : "var(--text-muted)",
                        fontWeight: form.tipoPeriodo === tipo ? 700 : 400,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {PERIODO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={form.fechaInicio} onChange={e => setForm((p: any) => ({ ...p, fechaInicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin</label>
                <input className="form-input" type="date" value={form.fechaFin} onChange={e => setForm((p: any) => ({ ...p, fechaFin: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{precioLabel} *</label>
                <input className="form-input" type="number" value={form.precioMensual} onChange={e => setForm((p: any) => ({ ...p, precioMensual: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Flete</label>
                <input className="form-input" type="number" value={form.flete} onChange={e => setForm((p: any) => ({ ...p, flete: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Depósito</label>
                <input className="form-input" type="number" value={form.deposito} onChange={e => setForm((p: any) => ({ ...p, deposito: +e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}