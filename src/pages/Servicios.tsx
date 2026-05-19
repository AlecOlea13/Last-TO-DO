import { useEffect, useState } from "react";
import { api } from "../api";

type Servicio = {
  _id: string;
  folio: string;
  montacargas?: { _id: string; numeroEconomico: string; marca: string };
  cliente?: { _id: string; nombre: string };
  tipoServicio?: { _id: string; nombre: string };
  tecnicoAsignado?: { _id: string; nombre: string };
  fechaReporte: string;
  problema?: string;
  estatus: "abierto" | "en_proceso" | "cerrado";
  costoRefacciones?: number;
  costoManoObra?: number;
  horometro?: number;
  horometroCierre?: number;
  ordenRefaccion?: { _id: string; folio: string; estatus: string };
  notasCierre?: string;
};

type Monta        = { _id: string; numeroEconomico: string; marca: string; clienteActual?: { _id: string; nombre: string } | null };
type Cliente      = { _id: string; nombre: string };
type TipoServicio = { _id: string; nombre: string; intervaloHrs?: number };
type Usuario      = { _id: string; nombre: string; rol: string };

const emptyForm = {
  montacargas: "", cliente: "", tipoServicio: "", tecnicoAsignado: "",
  fechaReporte: new Date().toISOString().split("T")[0],
  problema: "", costoRefacciones: 0, costoManoObra: 0, horometro: 0,
};

const ORDEN_BADGE: Record<string, string> = {
  pendiente: "badge-amber", surtida: "badge-green",
  parcial: "badge-blue",   cancelada: "badge-gray",
};

const rol = localStorage.getItem("rol") ?? "";

export default function Servicios() {
  const [servicios, setServicios]   = useState<Servicio[]>([]);
  const [montas, setMontas]         = useState<Monta[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [tipos, setTipos]           = useState<TipoServicio[]>([]);
  const [usuarios, setUsuarios]     = useState<Usuario[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filtro, setFiltro]         = useState("todos");
  const [modal, setModal]           = useState(false);
  const [cerrarModal, setCerrarModal] = useState<Servicio | null>(null);
  const [form, setForm]             = useState<any>(emptyForm);
  const [cerrarForm, setCerrarForm] = useState({ horometro: 0, proximoServicio: "", estatusMonta: "disponible", notasCierre: "" });
  const [saving, setSaving]         = useState(false);

  const canCreate = ["developer","gerencia","oficina"].includes(rol);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const calls: any[] = [api.get("/servicios"), api.get("/montacargas"), api.get("/clientes"), api.get("/tipos-servicio")];
      if (["developer","gerencia","oficina"].includes(rol)) calls.push(api.get("/users"));
      const [s, m, c, t, u] = await Promise.all(calls);
      setServicios(s.data);
      setMontas(m.data);
      setClientes(c.data);
      setTipos(t.data);
      if (u) setUsuarios(u.data.filter((x: any) => ["tecnico","oficina"].includes(x.rol)));
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
    if (rol === "tecnico" && estatus !== "cerrado") return;
    await api.put(`/servicios/${s._id}`, { estatus });
    setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, estatus: estatus as any } : sv));
  }

  function onMontaChange(montaId: string) {
    const monta = montas.find(m => m._id === montaId);
    setForm((p: any) => ({ ...p, montacargas: montaId, cliente: monta?.clienteActual?._id ?? p.cliente }));
  }

  const filtered = servicios.filter(s => {
    const matchSearch =
      (s.folio ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.tecnicoAsignado?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
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
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>+ Nuevo servicio</button>
        )}
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
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Técnico</th>
                  <th>Orden refac.</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{s.folio}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{fmt(s.fechaReporte)}</td>
                    <td style={{ fontWeight: 600 }}>{s.montacargas?.numeroEconomico} <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.8rem" }}>{s.montacargas?.marca}</span></td>
                    <td>{s.cliente?.nombre ?? "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{s.tipoServicio?.nombre ?? "—"}</td>
                    <td>{s.tecnicoAsignado?.nombre ?? "—"}</td>
                    <td>
                      {s.ordenRefaccion ? (
                        <span className={`badge ${ORDEN_BADGE[s.ordenRefaccion.estatus]}`}>{s.ordenRefaccion.folio}</span>
                      ) : "—"}
                    </td>
                    <td>
                      {rol === "tecnico" ? (
                        <span className={`badge ${s.estatus === "abierto" ? "badge-red" : s.estatus === "en_proceso" ? "badge-amber" : "badge-gray"}`}>
                          {s.estatus}
                        </span>
                      ) : (
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
                      )}
                    </td>
                    <td>
                      {s.estatus !== "cerrado" && (
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setCerrarModal(s);
                          setCerrarForm({ horometro: s.horometro ?? 0, proximoServicio: "", estatusMonta: "disponible", notasCierre: "" });
                        }}>
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
      {modal && canCreate && (
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
                <label className="form-label">Tipo de servicio</label>
                <select className="form-select" value={form.tipoServicio} onChange={e => setForm((p: any) => ({ ...p, tipoServicio: e.target.value }))}>
                  <option value="">Sin tipo (revisión / otro)</option>
                  {tipos.map(t => <option key={t._id} value={t._id}>{t.nombre}{t.intervaloHrs ? ` (${t.intervaloHrs} hrs)` : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Técnico asignado</label>
                <select className="form-select" value={form.tecnicoAsignado} onChange={e => setForm((p: any) => ({ ...p, tecnicoAsignado: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => <option key={u._id} value={u._id}>{u.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha reporte</label>
                <input className="form-input" type="date" value={form.fechaReporte} onChange={e => setForm((p: any) => ({ ...p, fechaReporte: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometro} onChange={e => setForm((p: any) => ({ ...p, horometro: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Problema / descripción *</label>
                <textarea className="form-textarea" value={form.problema} onChange={e => setForm((p: any) => ({ ...p, problema: e.target.value }))} placeholder="Describe el problema o trabajo a realizar..." rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo refacciones</label>
                <input className="form-input" type="number" value={form.costoRefacciones} onChange={e => setForm((p: any) => ({ ...p, costoRefacciones: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo mano de obra</label>
                <input className="form-input" type="number" value={form.costoManoObra} onChange={e => setForm((p: any) => ({ ...p, costoManoObra: +e.target.value }))} />
              </div>
            </div>
            {form.tipoServicio && (
              <div style={{ padding: "10px 14px", background: "rgba(255,180,0,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", fontSize: "0.82rem", color: "var(--accent)", marginTop: 8 }}>
                ⚡ Se generará automáticamente una orden de refacciones al guardar.
              </div>
            )}
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
          <div className="modal" style={{ maxWidth: 460 }}>
            <button className="modal-close" onClick={() => setCerrarModal(null)}>✕</button>
            <h2 className="modal-title">Cerrar servicio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 8 }}>
              <strong style={{ color: "var(--text)" }}>{cerrarModal.folio}</strong> — {cerrarModal.montacargas?.numeroEconomico} {cerrarModal.montacargas?.marca}
            </p>
            {cerrarModal.ordenRefaccion && cerrarModal.ordenRefaccion.estatus !== "surtida" && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--red)", fontSize: "0.82rem", color: "var(--red)", marginBottom: 12 }}>
                ⚠️ La orden de refacciones <strong>{cerrarModal.ordenRefaccion.folio}</strong> aún no ha sido surtida completamente.
              </div>
            )}
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
              <div className="form-group">
                <label className="form-label">Notas de cierre</label>
                <textarea className="form-textarea" value={cerrarForm.notasCierre} onChange={e => setCerrarForm(p => ({ ...p, notasCierre: e.target.value }))} placeholder="Trabajos realizados, observaciones..." rows={3} />
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