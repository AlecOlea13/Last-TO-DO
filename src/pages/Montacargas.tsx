import { useEffect, useState } from "react";
import { api } from "../api";

type Monta = {
  _id: string;
  numeroEconomico: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  capacidad?: string;
  tipo?: string;
  horometroActual?: number;
  estatus: "disponible" | "rentado" | "taller" | "mantenimiento";
  clienteActual?: { _id: string; nombre: string } | null;
  rentaMensual?: number;
  fechaUltimoServicio?: string;
  proximoServicio?: string;
};

type Cliente = { _id: string; nombre: string };

const emptyForm = {
  numeroEconomico: "", marca: "", modelo: "", serie: "",
  capacidad: "", tipo: "electrico", horometroActual: 0,
  estatus: "disponible", rentaMensual: 0,
};

const ESTATUS_BADGE: Record<string, string> = {
  disponible:    "badge-green",
  rentado:       "badge-blue",
  taller:        "badge-amber",
  mantenimiento: "badge-red",
};

const TIPO_BADGE: Record<string, string> = {
  electrico: "badge-blue",
  gas:       "badge-amber",
  diesel:    "badge-gray",
};

export default function Montacargas() {
  const [montas, setMontas]       = useState<Monta[]>([]);
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filtroEstatus, setFiltro]= useState("todos");
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState<Monta | null>(null);
  const [form, setForm]           = useState<any>(emptyForm);
  const [saving, setSaving]       = useState(false);
  // Modal asignar
  const [asignarModal, setAsignarModal] = useState<Monta | null>(null);
  const [clienteSel, setClienteSel]     = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [m, c] = await Promise.all([api.get("/montacargas"), api.get("/clientes")]);
      setMontas(m.data);
      setClientes(c.data.filter((cl: Cliente & { estatus: string }) => cl.estatus === "activo"));
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setModal(true); }
  function openEdit(m: Monta) {
    setEditing(m);
    setForm({
      numeroEconomico: m.numeroEconomico, marca: m.marca ?? "", modelo: m.modelo ?? "",
      serie: m.serie ?? "", capacidad: m.capacidad ?? "", tipo: m.tipo ?? "electrico",
      horometroActual: m.horometroActual ?? 0, estatus: m.estatus,
      rentaMensual: m.rentaMensual ?? 0,
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
    setAsignarModal(null);
    setClienteSel("");
  }

  async function regresar(monta: Monta, estatus: "disponible" | "taller") {
    if (!confirm(`¿Regresar el montacargas a "${estatus}"?`)) return;
    const { data } = await api.post(`/montacargas/${monta._id}/regresar`, { estatus });
    setMontas(prev => prev.map(m => m._id === data._id ? data : m));
  }

  const filtered = montas.filter(m => {
    const matchSearch = m.numeroEconomico.toLowerCase().includes(search.toLowerCase()) ||
      (m.marca ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.modelo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.clienteActual?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchEstatus = filtroEstatus === "todos" || m.estatus === filtroEstatus;
    return matchSearch && matchEstatus;
  });

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
        {/* Stats rápidas */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Disponibles",    val: montas.filter(m => m.estatus === "disponible").length,    color: "var(--green)",  icon: "✅" },
            { label: "Rentados",       val: montas.filter(m => m.estatus === "rentado").length,        color: "var(--blue)",   icon: "📦" },
            { label: "En Taller",      val: montas.filter(m => m.estatus === "taller").length,         color: "var(--accent)", icon: "🔧" },
            { label: "Mantenimiento",  val: montas.filter(m => m.estatus === "mantenimiento").length,  color: "var(--red)",    icon: "⚙️" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFiltro(s.label.toLowerCase().split(" ")[s.label.includes("Taller") ? 1 : 0] === "taller" ? "taller" : s.label === "Disponibles" ? "disponible" : s.label === "Rentados" ? "rentado" : "mantenimiento")}>
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
                  <th>Serie</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Horómetro</th>
                  <th>Estatus</th>
                  <th>Cliente</th>
                  <th>Renta</th>
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
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{m.serie || "—"}</td>
                    <td><span className={`badge ${TIPO_BADGE[m.tipo ?? ""] ?? "badge-gray"}`}>{m.tipo ?? "—"}</span></td>
                    <td>{m.capacidad || "—"}</td>
                    <td>{m.horometroActual ?? 0} hr</td>
                    <td><span className={`badge ${ESTATUS_BADGE[m.estatus]}`}>{m.estatus}</span></td>
                    <td>{m.clienteActual?.nombre ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td>{m.rentaMensual ? `$${m.rentaMensual.toLocaleString()}` : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
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
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar equipo" : "Nuevo montacargas"}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Económico *</label>
                <input className="form-input" value={form.numeroEconomico} onChange={e => setForm((p: any) => ({ ...p, numeroEconomico: e.target.value }))} placeholder="Ej. #01" />
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
                <label className="form-label">Capacidad</label>
                <input className="form-input" value={form.capacidad} onChange={e => setForm((p: any) => ({ ...p, capacidad: e.target.value }))} placeholder="4 mil libras" />
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
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometroActual} onChange={e => setForm((p: any) => ({ ...p, horometroActual: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Renta mensual ($)</label>
                <input className="form-input" type="number" value={form.rentaMensual} onChange={e => setForm((p: any) => ({ ...p, rentaMensual: +e.target.value }))} />
              </div>
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
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
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
