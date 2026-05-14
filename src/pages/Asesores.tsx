import { useEffect, useState } from "react";
import { api } from "../api";

type Asesor = {
  _id: string;
  nombre: string;
  puesto: string;
  telefono: string;
  email: string;
  activo: boolean;
};

const empty: any = {
  nombre: "", puesto: "Asesor comercial", telefono: "", email: "", activo: true,
};

export default function Asesores() {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Asesor | null>(null);
  const [form, setForm]         = useState<any>(empty);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/asesores");
      setAsesores(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(empty); setModal(true); }
  function openEdit(a: Asesor) {
    setEditing(a);
    setForm({ nombre: a.nombre, puesto: a.puesto, telefono: a.telefono, email: a.email, activo: a.activo });
    setModal(true);
  }

  async function save() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/asesores/${editing._id}`, form);
        setAsesores(prev => prev.map(a => a._id === editing._id ? data : a));
      } else {
        const { data } = await api.post("/asesores", form);
        setAsesores(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Desactivar este asesor?")) return;
    await api.delete(`/asesores/${id}`);
    setAsesores(prev => prev.filter(a => a._id !== id));
  }

  const f = (field: string, val: any) => setForm((p: any) => ({ ...p, [field]: val }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asesores</h1>
          <p className="page-subtitle">{asesores.length} asesores registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo asesor</button>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Equipo de Pipsa</p>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : asesores.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">👤</span><p>Sin asesores registrados</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Puesto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {asesores.map(a => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                    <td>{a.puesto}</td>
                    <td>{a.telefono || "—"}</td>
                    <td>{a.email || "—"}</td>
                    <td><span className={`badge ${a.activo ? "badge-green" : "badge-gray"}`}>{a.activo ? "Activo" : "Inactivo"}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(a._id)}>🗑️</button>
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
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar asesor" : "Nuevo asesor"}</h2>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Nombre completo" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Puesto</label>
                <input className="form-input" value={form.puesto} onChange={e => f("puesto", e.target.value)} placeholder="Ej. Asesor comercial" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.telefono} onChange={e => f("telefono", e.target.value)} placeholder="33 1234 5678" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={form.email} onChange={e => f("email", e.target.value)} placeholder="nombre@pipsamontacargas.com" />
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