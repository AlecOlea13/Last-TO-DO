import { useEffect, useState } from "react";
import { api } from "../api";

type Cliente = { _id: string; nombre: string };

type EquipoCliente = {
  _id: string;
  cliente?: { _id: string; nombre: string } | null;
  numeroEconomico?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  tipo?: string;
  capacidad?: string;
  horometroActual?: number;
  ubicacion?: string;
  notas?: string;
  fechaUltimoServicio?: string | null;
};

type ServicioHistorial = {
  _id: string;
  folio: string;
  estatus: string;
  fechaReporte: string;
  problema?: string;
  notasCierre?: string;
  horometroCierre?: number;
  tipoServicio?: { nombre: string };
  tecnicoAsignado?: { nombre: string };
};

const emptyForm = {
  cliente: "", numeroEconomico: "", marca: "", modelo: "", serie: "",
  tipo: "", capacidad: "", horometroActual: 0, ubicacion: "", notas: "",
};

const TIPO_BADGE: Record<string, string> = {
  electrico: "badge-blue", gas: "badge-amber", diesel: "badge-gray",
};

const ESTATUS_BADGE: Record<string, string> = {
  abierto: "badge-amber", en_proceso: "badge-blue", pausado: "badge-gray", cerrado: "badge-green",
};

function fmt(date?: string | null) {
  if (!date) return "—";
  const [y, m, d] = date.split("T")[0].split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EquiposCliente() {
  const rol       = localStorage.getItem("rol") ?? "";
  const canEdit   = ["developer", "gerencia", "oficina", "tecnico"].includes(rol);
  const canDelete = ["developer", "gerencia", "oficina"].includes(rol);

  const [equipos, setEquipos]   = useState<EquipoCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");

  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<EquipoCliente | null>(null);
  const [form, setForm]       = useState<any>(emptyForm);
  const [saving, setSaving]   = useState(false);

  const [historialModal, setHistorialModal] = useState<EquipoCliente | null>(null);
  const [historial, setHistorial]           = useState<ServicioHistorial[]>([]);
  const [loadingHist, setLoadingHist]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [e, c] = await Promise.all([
        api.get("/equipos-cliente"),
        api.get("/clientes"),
      ]);
      setEquipos(e.data);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
    } catch {}
    finally { setLoading(false); }
  }

  function setF(field: string, val: any) { setForm((p: any) => ({ ...p, [field]: val })); }

  function openNew() { setEditing(null); setForm(emptyForm); setModal(true); }

  function openEdit(e: EquipoCliente) {
    setEditing(e);
    setForm({
      cliente: e.cliente?._id ?? "",
      numeroEconomico: e.numeroEconomico ?? "", marca: e.marca ?? "", modelo: e.modelo ?? "",
      serie: e.serie ?? "", tipo: e.tipo ?? "", capacidad: e.capacidad ?? "",
      horometroActual: e.horometroActual ?? 0, ubicacion: e.ubicacion ?? "", notas: e.notas ?? "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.cliente) { alert("Selecciona el cliente dueño del equipo"); return; }
    if (!form.marca.trim() && !form.modelo.trim() && !form.serie.trim() && !form.numeroEconomico.trim()) {
      alert("Captura al menos marca, modelo, serie o número del equipo");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/equipos-cliente/${editing._id}`, form);
        setEquipos(prev => prev.map(x => x._id === editing._id ? data : x));
      } else {
        const { data } = await api.post("/equipos-cliente", form);
        setEquipos(prev => [data, ...prev]);
      }
      setModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Error al guardar");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este equipo del cliente? Su historial de servicios se conserva.")) return;
    await api.delete(`/equipos-cliente/${id}`);
    setEquipos(prev => prev.filter(x => x._id !== id));
  }

  async function abrirHistorial(e: EquipoCliente) {
    setHistorialModal(e);
    setLoadingHist(true);
    try {
      const { data } = await api.get(`/equipos-cliente/${e._id}/servicios`);
      setHistorial(data);
    } catch { setHistorial([]); }
    finally { setLoadingHist(false); }
  }

  const q = search.toLowerCase();
  const filtered = equipos.filter(e => {
    const matchSearch =
      (e.numeroEconomico ?? "").toLowerCase().includes(q) ||
      (e.marca ?? "").toLowerCase().includes(q) ||
      (e.modelo ?? "").toLowerCase().includes(q) ||
      (e.serie ?? "").toLowerCase().includes(q) ||
      (e.cliente?.nombre ?? "").toLowerCase().includes(q);
    const matchCliente = filtroCliente === "todos" || e.cliente?._id === filtroCliente;
    return matchSearch && matchCliente;
  });

  const clientesConEquipos = new Set(equipos.map(e => e.cliente?._id)).size;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipos de clientes</h1>
          <p className="page-subtitle">
            {equipos.length} equipos · {clientesConEquipos} clientes · propiedad del cliente (no son inventario Pipsa)
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo equipo de cliente</button>
        )}
      </div>

      <div className="page-content">
        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Equipos registrados</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
                <option value="todos">Todos los clientes</option>
                {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏢</span>
              <p>Sin equipos de clientes{search || filtroCliente !== "todos" ? " con ese filtro" : " registrados"}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>No. / ID</th><th>Marca / Modelo</th><th>Serie</th>
                  <th>Tipo</th><th>Capacidad</th><th>Horómetro</th><th>Último servicio</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e._id}>
                    <td style={{ fontWeight: 600 }}>{e.cliente?.nombre ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{e.numeroEconomico || "—"}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{e.marca}</span>
                      {e.modelo && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {e.modelo}</span>}
                    </td>
                    <td>{e.serie || "—"}</td>
                    <td>{e.tipo ? <span className={`badge ${TIPO_BADGE[e.tipo] ?? "badge-gray"}`}>{e.tipo}</span> : "—"}</td>
                    <td>{e.capacidad || "—"}</td>
                    <td>{e.horometroActual ?? 0} hr</td>
                    <td>{fmt(e.fechaUltimoServicio)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirHistorial(e)} title="Historial de servicios">📋</button>
                        {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}>✏️</button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => remove(e._id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal nuevo / editar ── */}
      {modal && canEdit && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar equipo del cliente" : "Nuevo equipo del cliente"}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Cliente (dueño) *</label>
                <select className="form-select" value={form.cliente} onChange={e => setF("cliente", e.target.value)}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">No. / identificador del cliente</label>
                <input className="form-input" value={form.numeroEconomico} onChange={e => setF("numeroEconomico", e.target.value)} placeholder="Como lo llama el cliente" />
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input className="form-input" value={form.marca} onChange={e => setF("marca", e.target.value)} placeholder="Crown, Yale, Hyster..." />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input className="form-input" value={form.modelo} onChange={e => setF("modelo", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Serie</label>
                <input className="form-input" value={form.serie} onChange={e => setF("serie", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.tipo} onChange={e => setF("tipo", e.target.value)}>
                  <option value="">—</option>
                  <option value="electrico">Eléctrico</option>
                  <option value="gas">Gas LP</option>
                  <option value="diesel">Diésel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacidad de carga</label>
                <input className="form-input" value={form.capacidad} onChange={e => setF("capacidad", e.target.value)} placeholder="5000 lbs, 2.2 tn..." />
              </div>
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometroActual} onChange={e => setF("horometroActual", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ubicación (planta / sucursal)</label>
                <input className="form-input" value={form.ubicacion} onChange={e => setF("ubicacion", e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" rows={2} value={form.notas} onChange={e => setF("notas", e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal historial ── */}
      {historialModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setHistorialModal(null); }}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <button className="modal-close" onClick={() => setHistorialModal(null)}>✕</button>
            <h2 className="modal-title">📋 Historial de servicios</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 14 }}>
              <strong style={{ color: "var(--text)" }}>{historialModal.cliente?.nombre}</strong>
              {" — "}{[historialModal.numeroEconomico, historialModal.marca, historialModal.modelo].filter(Boolean).join(" ")}
            </p>
            {loadingHist ? (
              <div className="loading-state"><div className="spinner" /></div>
            ) : historial.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📋</span><p>Sin servicios registrados para este equipo</p></div>
            ) : (
              <table>
                <thead>
                  <tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Técnico</th><th>Estatus</th><th>Horómetro</th></tr>
                </thead>
                <tbody>
                  {historial.map(s => (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 700 }}>{s.folio}</td>
                      <td>{fmt(s.fechaReporte)}</td>
                      <td>{s.tipoServicio?.nombre ?? "—"}</td>
                      <td>{s.tecnicoAsignado?.nombre ?? "—"}</td>
                      <td><span className={`badge ${ESTATUS_BADGE[s.estatus] ?? "badge-gray"}`}>{s.estatus}</span></td>
                      <td>{s.horometroCierre ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}