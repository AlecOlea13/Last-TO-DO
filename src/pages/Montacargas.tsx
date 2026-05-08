import { useEffect, useState } from "react";
import { api } from "../api";

type Monta = {
  _id: string;
  numeroEconomico: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  motor?: string;
  capacidad?: string;
  tipo?: string;
  alturaColapsada?: string;
  alturaLevante?: string;
  tipoLlantas?: string;
  voltajeBateria?: string;
  horometroActual?: number;
  horasRestantesServicio?: number;
  estatus: "disponible" | "rentado" | "taller" | "mantenimiento";
  clienteActual?: { _id: string; nombre: string } | null;
  costoDia?: number;
  costoSemana?: number;
  costoMes?: number;
  fechaUltimoMantenimiento?: string;
  proximoMantenimiento?: string;
  fechaUltimoServicio?: string;
  proximoServicio?: string;
};

type Cliente = { _id: string; nombre: string };

const emptyForm = {
  numeroEconomico: "", marca: "", modelo: "", serie: "", motor: "",
  capacidad: "", tipo: "electrico", alturaColapsada: "", alturaLevante: "",
  tipoLlantas: "", voltajeBateria: "", horometroActual: 0, horasRestantesServicio: 0,
  estatus: "disponible", costoDia: 0, costoSemana: 0, costoMes: 0,
  fechaUltimoMantenimiento: "", proximoMantenimiento: "",
  fechaUltimoServicio: "", proximoServicio: "",
};

const ESTATUS_BADGE: Record<string, string> = {
  disponible: "badge-green", rentado: "badge-blue",
  taller: "badge-amber", mantenimiento: "badge-red",
};

const TIPO_BADGE: Record<string, string> = {
  electrico: "badge-blue", gas: "badge-amber", diesel: "badge-gray",
};

export default function Montacargas() {
  const [montas, setMontas]     = useState<Monta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filtroEstatus, setFiltro] = useState("todos");
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Monta | null>(null);
  const [form, setForm]         = useState<any>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [asignarModal, setAsignarModal] = useState<Monta | null>(null);
  const [clienteSel, setClienteSel]     = useState("");
  const [detalleModal, setDetalleModal] = useState<Monta | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [m, c] = await Promise.all([api.get("/montacargas"), api.get("/clientes")]);
      setMontas(m.data);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setModal(true); }
  function openEdit(m: Monta) {
    setEditing(m);
    setForm({
      numeroEconomico: m.numeroEconomico, marca: m.marca ?? "", modelo: m.modelo ?? "",
      serie: m.serie ?? "", motor: m.motor ?? "", capacidad: m.capacidad ?? "",
      tipo: m.tipo ?? "electrico", alturaColapsada: m.alturaColapsada ?? "",
      alturaLevante: m.alturaLevante ?? "", tipoLlantas: m.tipoLlantas ?? "",
      voltajeBateria: m.voltajeBateria ?? "", horometroActual: m.horometroActual ?? 0,
      horasRestantesServicio: m.horasRestantesServicio ?? 0, estatus: m.estatus,
      costoDia: m.costoDia ?? 0, costoSemana: m.costoSemana ?? 0, costoMes: m.costoMes ?? 0,
      fechaUltimoMantenimiento: m.fechaUltimoMantenimiento ? m.fechaUltimoMantenimiento.split("T")[0] : "",
      proximoMantenimiento: m.proximoMantenimiento ? m.proximoMantenimiento.split("T")[0] : "",
      fechaUltimoServicio: m.fechaUltimoServicio ? m.fechaUltimoServicio.split("T")[0] : "",
      proximoServicio: m.proximoServicio ? m.proximoServicio.split("T")[0] : "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.numeroEconomico.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/montacargas/${editing._id}`, form);
        setMontas(prev => prev.map(m => m._id === editing._id ? data : m));
      } else {
        const { data } = await api.post("/montacargas", form);
        setMontas(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este montacargas?")) return;
    await api.delete(`/montacargas/${id}`);
    setMontas(prev => prev.filter(m => m._id !== id));
  }

  async function asignar() {
    if (!asignarModal || !clienteSel) return;
    const { data } = await api.post(`/montacargas/${asignarModal._id}/asignar`, { clienteId: clienteSel });
    setMontas(prev => prev.map(m => m._id === data._id ? data : m));
    setAsignarModal(null); setClienteSel("");
  }

  async function regresar(monta: Monta, estatus: "disponible" | "taller") {
    if (!confirm(`¿Regresar el montacargas a "${estatus}"?`)) return;
    const { data } = await api.post(`/montacargas/${monta._id}/regresar`, { estatus });
    setMontas(prev => prev.map(m => m._id === data._id ? data : m));
  }

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = montas.filter(m => {
    const matchSearch = m.numeroEconomico.toLowerCase().includes(search.toLowerCase()) ||
      (m.marca ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.modelo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.clienteActual?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchEstatus = filtroEstatus === "todos" || m.estatus === filtroEstatus;
    return matchSearch && matchEstatus;
  });

  // const = (p: any) => ({ ...form, [p.field]: p.val });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Montacargas</h1>
          <p className="page-subtitle">{montas.length} equipos en flota</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo equipo</button>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Disponibles",   val: montas.filter(m => m.estatus === "disponible").length,   color: "var(--green)",  icon: "✅", key: "disponible" },
            { label: "Rentados",      val: montas.filter(m => m.estatus === "rentado").length,       color: "var(--blue)",   icon: "📦", key: "rentado" },
            { label: "En Taller",     val: montas.filter(m => m.estatus === "taller").length,        color: "var(--accent)", icon: "🔧", key: "taller" },
            { label: "Mantenimiento", val: montas.filter(m => m.estatus === "mantenimiento").length, color: "var(--red)",    icon: "⚙️", key: "mantenimiento" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFiltro(s.key)}>
              <span className="stat-card-icon">{s.icon}</span>
              <p className="stat-card-value" style={{ color: s.color }}>{s.val}</p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Flota completa</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtroEstatus} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="disponible">Disponible</option>
                <option value="rentado">Rentado</option>
                <option value="taller">Taller</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🏗️</span><p>Sin equipos{search ? " con ese filtro" : " registrados"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Marca / Modelo</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Horómetro</th>
                  <th>Prox. Mant.</th>
                  <th>Estatus</th>
                  <th>Cliente</th>
                  <th>Costo/mes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{m.numeroEconomico}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{m.marca}</span>
                      {m.modelo && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {m.modelo}</span>}
                    </td>
                    <td><span className={`badge ${TIPO_BADGE[m.tipo ?? ""] ?? "badge-gray"}`}>{m.tipo ?? "—"}</span></td>
                    <td>{m.capacidad || "—"}</td>
                    <td>{m.horometroActual ?? 0} hr</td>
                    <td style={{ color: m.proximoMantenimiento && new Date(m.proximoMantenimiento) < new Date() ? "var(--red)" : "var(--text)" }}>
                      {fmt(m.proximoMantenimiento)}
                    </td>
                    <td><span className={`badge ${ESTATUS_BADGE[m.estatus]}`}>{m.estatus}</span></td>
                    <td>{m.clienteActual?.nombre ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td>{m.costoMes ? `$${m.costoMes.toLocaleString()}` : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalleModal(m)}>👁️</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>✏️</button>
                        {m.estatus === "disponible" && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setAsignarModal(m); setClienteSel(""); }}>Asignar</button>
                        )}
                        {m.estatus === "rentado" && (
                          <button className="btn btn-secondary btn-sm" onClick={() => regresar(m, "disponible")}>Regresar</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => remove(m._id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal nuevo/editar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar equipo" : "Nuevo montacargas"}</h2>

            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Datos generales</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Económico *</label>
                <input className="form-input" value={form.numeroEconomico} onChange={e => setForm((p: any) => ({ ...p, numeroEconomico: e.target.value }))} placeholder="#01" />
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input className="form-input" value={form.marca} onChange={e => setForm((p: any) => ({ ...p, marca: e.target.value }))} placeholder="Crown, Hyster..." />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input className="form-input" value={form.modelo} onChange={e => setForm((p: any) => ({ ...p, modelo: e.target.value }))} placeholder="RR5200" />
              </div>
              <div className="form-group">
                <label className="form-label">Serie</label>
                <input className="form-input" value={form.serie} onChange={e => setForm((p: any) => ({ ...p, serie: e.target.value }))} placeholder="1A268108" />
              </div>
              <div className="form-group">
                <label className="form-label">Motor</label>
                <input className="form-input" value={form.motor} onChange={e => setForm((p: any) => ({ ...p, motor: e.target.value }))} placeholder="Ej. GAS LPG" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}>
                  <option value="electrico">Eléctrico</option>
                  <option value="gas">Gas</option>
                  <option value="diesel">Diésel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacidad</label>
                <input className="form-input" value={form.capacidad} onChange={e => setForm((p: any) => ({ ...p, capacidad: e.target.value }))} placeholder="4 mil libras" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de llantas</label>
                <input className="form-input" value={form.tipoLlantas} onChange={e => setForm((p: any) => ({ ...p, tipoLlantas: e.target.value }))} placeholder="Ej. Sólida, Pneumática" />
              </div>
              <div className="form-group">
                <label className="form-label">Altura colapsada</label>
                <input className="form-input" value={form.alturaColapsada} onChange={e => setForm((p: any) => ({ ...p, alturaColapsada: e.target.value }))} placeholder="Ej. 2.10 m" />
              </div>
              <div className="form-group">
                <label className="form-label">Altura de levante</label>
                <input className="form-input" value={form.alturaLevante} onChange={e => setForm((p: any) => ({ ...p, alturaLevante: e.target.value }))} placeholder="Ej. 4.80 m" />
              </div>
              {form.tipo === "electrico" && (
                <div className="form-group">
                  <label className="form-label">Voltaje / Batería</label>
                  <input className="form-input" value={form.voltajeBateria} onChange={e => setForm((p: any) => ({ ...p, voltajeBateria: e.target.value }))} placeholder="Ej. 48V / 18-125-15" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Estatus</label>
                <select className="form-select" value={form.estatus} onChange={e => setForm((p: any) => ({ ...p, estatus: e.target.value }))}>
                  <option value="disponible">Disponible</option>
                  <option value="rentado">Rentado</option>
                  <option value="taller">Taller</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>Horómetro y mantenimiento</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometroActual} onChange={e => setForm((p: any) => ({ ...p, horometroActual: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Horas restantes para servicio</label>
                <input className="form-input" type="number" value={form.horasRestantesServicio} onChange={e => setForm((p: any) => ({ ...p, horasRestantesServicio: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Último mantenimiento</label>
                <input className="form-input" type="date" value={form.fechaUltimoMantenimiento} onChange={e => setForm((p: any) => ({ ...p, fechaUltimoMantenimiento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo mantenimiento</label>
                <input className="form-input" type="date" value={form.proximoMantenimiento} onChange={e => setForm((p: any) => ({ ...p, proximoMantenimiento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Último servicio</label>
                <input className="form-input" type="date" value={form.fechaUltimoServicio} onChange={e => setForm((p: any) => ({ ...p, fechaUltimoServicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio</label>
                <input className="form-input" type="date" value={form.proximoServicio} onChange={e => setForm((p: any) => ({ ...p, proximoServicio: e.target.value }))} />
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>Costos de renta</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Costo por día ($)</label>
                <input className="form-input" type="number" value={form.costoDia} onChange={e => setForm((p: any) => ({ ...p, costoDia: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo por semana ($)</label>
                <input className="form-input" type="number" value={form.costoSemana} onChange={e => setForm((p: any) => ({ ...p, costoSemana: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo por mes ($)</label>
                <input className="form-input" type="number" value={form.costoMes} onChange={e => setForm((p: any) => ({ ...p, costoMes: +e.target.value }))} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalleModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setDetalleModal(null)}>✕</button>
            <h2 className="modal-title">{detalleModal.numeroEconomico} — {detalleModal.marca} {detalleModal.modelo}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              {[
                { label: "Serie", val: detalleModal.serie },
                { label: "Motor", val: detalleModal.motor },
                { label: "Tipo", val: detalleModal.tipo },
                { label: "Capacidad", val: detalleModal.capacidad },
                { label: "Altura colapsada", val: detalleModal.alturaColapsada },
                { label: "Altura de levante", val: detalleModal.alturaLevante },
                { label: "Tipo de llantas", val: detalleModal.tipoLlantas },
                { label: "Voltaje / Batería", val: detalleModal.voltajeBateria },
                { label: "Horómetro", val: detalleModal.horometroActual ? `${detalleModal.horometroActual} hr` : null },
                { label: "Horas restantes", val: detalleModal.horasRestantesServicio ? `${detalleModal.horasRestantesServicio} hr` : null },
                { label: "Último mantenimiento", val: fmt(detalleModal.fechaUltimoMantenimiento) },
                { label: "Próximo mantenimiento", val: fmt(detalleModal.proximoMantenimiento) },
                { label: "Último servicio", val: fmt(detalleModal.fechaUltimoServicio) },
                { label: "Próximo servicio", val: fmt(detalleModal.proximoServicio) },
                { label: "Costo día", val: detalleModal.costoDia ? `$${detalleModal.costoDia.toLocaleString()}` : null },
                { label: "Costo semana", val: detalleModal.costoSemana ? `$${detalleModal.costoSemana.toLocaleString()}` : null },
                { label: "Costo mes", val: detalleModal.costoMes ? `$${detalleModal.costoMes.toLocaleString()}` : null },
                { label: "Cliente actual", val: detalleModal.clienteActual?.nombre },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text)", margin: "2px 0 0", fontWeight: 500 }}>{item.val}</p>
                </div>
              ) : null)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { setDetalleModal(null); openEdit(detalleModal); }}>✏️ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar cliente */}
      {asignarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAsignarModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <button className="modal-close" onClick={() => setAsignarModal(null)}>✕</button>
            <h2 className="modal-title">Asignar a cliente</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
              Equipo <strong style={{ color: "var(--text)" }}>{asignarModal.numeroEconomico}</strong> — {asignarModal.marca} {asignarModal.modelo}
            </p>
            <div className="form-group">
              <label className="form-label">Cliente</label>
              <select className="form-select" value={clienteSel} onChange={e => setClienteSel(e.target.value)}>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAsignarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={asignar} disabled={!clienteSel}>Asignar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
