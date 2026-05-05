import { useEffect, useState } from "react";
import { api } from "../api";

type Cliente = {
  _id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  condicionesPago?: string;
  estatus: "activo" | "inactivo";
};

const empty: Omit<Cliente, "_id"> = {
  nombre: "", contacto: "", telefono: "", email: "",
  direccion: "", condicionesPago: "", estatus: "activo",
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Cliente | null>(null);
  const [form, setForm]         = useState(empty);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/clientes");
      setClientes(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(empty); setModal(true); }
  function openEdit(c: Cliente) { setEditing(c); setForm({ nombre: c.nombre, contacto: c.contacto ?? "", telefono: c.telefono ?? "", email: c.email ?? "", direccion: c.direccion ?? "", condicionesPago: c.condicionesPago ?? "", estatus: c.estatus }); setModal(true); }

  async function save() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/clientes/${editing._id}`, form);
        setClientes(prev => prev.map(c => c._id === editing._id ? data : c));
      } else {
        const { data } = await api.post("/clientes", form);
        setClientes(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    await api.delete(`/clientes/${id}`);
    setClientes(prev => prev.filter(c => c._id !== id));
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.contacto ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} clientes registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Directorio</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🏢</span><p>Sin clientes{search ? " con ese filtro" : " registrados"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Pago</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td>{c.contacto || "—"}</td>
                    <td>{c.telefono || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td>{c.condicionesPago || "—"}</td>
                    <td>
                      <span className={`badge ${c.estatus === "activo" ? "badge-green" : "badge-gray"}`}>
                        {c.estatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(c._id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar cliente" : "Nuevo cliente"}</h2>

            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Nombre empresa *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. JIT Logistics" />
              </div>
              <div className="form-group">
                <label className="form-label">Contacto</label>
                <input className="form-input" value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} placeholder="Nombre del contacto" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="33 1234 5678" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contacto@empresa.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Condiciones de pago</label>
                <input className="form-input" value={form.condicionesPago} onChange={e => setForm(p => ({ ...p, condicionesPago: e.target.value }))} placeholder="Ej. 30 días" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Dirección</label>
                <input className="form-input" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle, Ciudad" />
              </div>
              <div className="form-group">
                <label className="form-label">Estatus</label>
                <select className="form-select" value={form.estatus} onChange={e => setForm(p => ({ ...p, estatus: e.target.value as any }))}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
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
    </>
  );
}
