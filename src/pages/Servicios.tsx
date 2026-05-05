import { useEffect, useState } from "react";
import { api } from "../api";

type Servicio = {
  _id: string;
  montacargas?: { _id: string; numeroEconomico: string; marca: string };
  cliente?: { _id: string; nombre: string };
  fechaReporte: string;
  problema?: string;
  tecnicoAsignado?: string;
  estatus: "abierto" | "en_proceso" | "cerrado";
  costoRefacciones?: number;
  costoManoObra?: number;
  horometro?: number;
};

type Monta   = { _id: string; numeroEconomico: string; marca: string; clienteActual?: { _id: string; nombre: string } | null };
type Cliente = { _id: string; nombre: string };

const emptyForm = {
  montacargas: "", cliente: "", fechaReporte: new Date().toISOString().split("T")[0],
  problema: "", tecnicoAsignado: "", costoRefacciones: 0, costoManoObra: 0, horometro: 0,
};

const ESTATUS_BADGE: Record<string, string> = {
  abierto:    "badge-red",
  en_proceso: "badge-amber",
  cerrado:    "badge-gray",
};

const ESTATUS_LABEL: Record<string, string> = {
  abierto:    "Abierto",
  en_proceso: "En proceso",
  cerrado:    "Cerrado",
};

export default function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [montas, setMontas]       = useState<Monta[]>([]);
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filtro, setFiltro]       = useState("todos");
  const [modal, setModal]         = useState(false);
  const [cerrarModal, setCerrarModal] = useState<Servicio | null>(null);
  const [form, setForm]           = useState<any>(emptyForm);
  const [cerrarForm, setCerrarForm]   = useState({ horometro: 0, proximoServicio: "", estatusMonta: "disponible" });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [s, m, c] = await Promise.all([api.get("/servicios"), api.get("/montacargas"), api.get("/clientes")]);
      setServicios(s.data);
      setMontas(m.data);
      setClientes(c.data);
    } catch {}
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.montacargas || !form.problema.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post("/servicios", form);
      setServicios(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function cerrar() {
    if (!cerrarModal) return;
    setSaving(true);
    try {
      await api.post(`/servicios/${cerrarModal._id}/cerrar`, cerrarForm);
      load();
      setCerrarModal(null);
    } catch {}
    finally { setSaving(false); }
  }

  async function cambiarEstatus(s: Servicio, estatus: string) {
    await api.put(`/servicios/${s._id}`, { estatus });
    setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, estatus: estatus as any } : sv));
  }

  // Auto-fill cliente cuando se selecciona montacargas
  function onMontaChange(montaId: string) {
    const monta = montas.find(m => m._id === montaId);
    setForm((p: any) => ({
      ...p,
      montacargas: montaId,
      cliente: monta?.clienteActual?._id ?? p.cliente,
    }));
  }

  const filtered = servicios.filter(s => {
    const matchSearch =
      (s.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.tecnicoAsignado ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.problema ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "todos" || s.estatus === filtro;
    return matchSearch && matchFiltro;
  });

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="page-subtitle">{servicios.filter(s => s.estatus !== "cerrado").length} tickets abiertos</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>+ Nuevo servicio</button>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Tickets de servicio</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="abierto">Abiertos</option>
                <option value="en_proceso">En proceso</option>
                <option value="cerrado">Cerrados</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🔧</span><p>Sin servicios{search ? " con ese filtro" : " registrados"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Cliente</th>
                  <th>Problema</th>
                  <th>Técnico</th>
                  <th>Costo total</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s._id}>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{fmt(s.fechaReporte)}</td>
                    <td style={{ fontWeight: 600 }}>{s.montacargas?.numeroEconomico} <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.8rem" }}>{s.montacargas?.marca}</span></td>
                    <td>{s.cliente?.nombre ?? "—"}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.problema || "—"}</td>
                    <td>{s.tecnicoAsignado || "—"}</td>
                    <td>{s.costoRefacciones || s.costoManoObra ? `$${((s.costoRefacciones ?? 0) + (s.costoManoObra ?? 0)).toLocaleString()}` : "—"}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: "4px 10px", fontSize: "0.78rem", width: "auto" }}
                        value={s.estatus}
                        onChange={e => cambiarEstatus(s, e.target.value)}
                      >
                        <option value="abierto">Abierto</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                    </td>
                    <td>
                      {s.estatus !== "cerrado" && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setCerrarModal(s); setCerrarForm({ horometro: s.horometro ?? 0, proximoServicio: "", estatusMonta: "disponible" }); }}>
                          Cerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal nuevo servicio */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nuevo servicio</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                <select className="form-select" value={form.montacargas} onChange={e => onMontaChange(e.target.value)}>
                  <option value="">Selecciona equipo...</option>
                  {montas.map(m => <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha reporte</label>
                <input className="form-input" type="date" value={form.fechaReporte} onChange={e => setForm((p: any) => ({ ...p, fechaReporte: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Técnico asignado</label>
                <input className="form-input" value={form.tecnicoAsignado} onChange={e => setForm((p: any) => ({ ...p, tecnicoAsignado: e.target.value }))} placeholder="Nombre del técnico" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Problema *</label>
                <textarea className="form-textarea" value={form.problema} onChange={e => setForm((p: any) => ({ ...p, problema: e.target.value }))} placeholder="Describe el problema..." />
              </div>
              <div className="form-group">
                <label className="form-label">Costo refacciones</label>
                <input className="form-input" type="number" value={form.costoRefacciones} onChange={e => setForm((p: any) => ({ ...p, costoRefacciones: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo mano de obra</label>
                <input className="form-input" type="number" value={form.costoManoObra} onChange={e => setForm((p: any) => ({ ...p, costoManoObra: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometro} onChange={e => setForm((p: any) => ({ ...p, horometro: +e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cerrar servicio */}
      {cerrarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCerrarModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <button className="modal-close" onClick={() => setCerrarModal(null)}>✕</button>
            <h2 className="modal-title">Cerrar servicio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
              Equipo <strong style={{ color: "var(--text)" }}>{cerrarModal.montacargas?.numeroEconomico}</strong>
            </p>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label className="form-label">Horómetro al cierre</label>
                <input className="form-input" type="number" value={cerrarForm.horometro} onChange={e => setCerrarForm(p => ({ ...p, horometro: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio</label>
                <input className="form-input" type="date" value={cerrarForm.proximoServicio} onChange={e => setCerrarForm(p => ({ ...p, proximoServicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Estatus del equipo al cerrar</label>
                <select className="form-select" value={cerrarForm.estatusMonta} onChange={e => setCerrarForm(p => ({ ...p, estatusMonta: e.target.value }))}>
                  <option value="disponible">Disponible</option>
                  <option value="rentado">Rentado</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCerrarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={cerrar} disabled={saving}>{saving ? "Cerrando..." : "Cerrar servicio"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
