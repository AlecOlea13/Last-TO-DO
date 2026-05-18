import { useEffect, useState } from "react";
import { api } from "../api";

type Usuario = {
  _id: string;
  username: string;
  nombre: string;
  rol: "developer" | "gerencia" | "oficina" | "tecnico";
  activo: boolean;
  createdAt: string;
};

const emptyForm = {
  username: "", nombre: "", password: "", rol: "oficina", activo: true,
};

const ROL_BADGE: Record<string, string> = {
  developer: "badge-red",
  gerencia:  "badge-blue",
  oficina:   "badge-green",
  tecnico:   "badge-amber",
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Usuario | null>(null);
  const [form, setForm]         = useState<any>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/users");
      setUsuarios(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModal(true);
  }

  function openEdit(u: Usuario) {
    setEditing(u);
    setForm({ username: u.username, nombre: u.nombre, password: "", rol: u.rol, activo: u.activo });
    setError("");
    setModal(true);
  }

  async function save() {
    if (!form.username || !form.nombre || !form.rol) return;
    if (!editing && !form.password) { setError("La contraseña es requerida"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const { data } = await api.put(`/users/${editing._id}`, form);
        setUsuarios(prev => prev.map(u => u._id === editing._id ? data : u));
      } else {
        const { data } = await api.post("/users", form);
        setUsuarios(prev => [data, ...prev]);
      }
      setModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    const { data } = await api.put(`/users/${u._id}`, { ...u, activo: !u.activo });
    setUsuarios(prev => prev.map(x => x._id === u._id ? data : x));
  }

  async function remove(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre}?`)) return;
    await api.delete(`/users/${u._id}`);
    setUsuarios(prev => prev.filter(x => x._id !== u._id));
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">{usuarios.length} usuarios en el sistema</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo usuario</button>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Todos los usuarios</p>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">👥</span><p>Sin usuarios registrados</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estatus</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>@{u.username}</td>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td><span className={`badge ${ROL_BADGE[u.rol]}`}>{u.rol}</span></td>
                    <td>
                      <span className={`badge ${u.activo ? "badge-green" : "badge-gray"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️</button>
                        <button
                          className={`btn btn-sm ${u.activo ? "btn-amber" : "btn-secondary"}`}
                          onClick={() => toggleActivo(u)}
                          title={u.activo ? "Desactivar" : "Activar"}
                        >
                          {u.activo ? "🔒" : "🔓"}
                        </button>
                        {u.rol !== "developer" && (
                          <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>🗑️</button>
                        )}
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
            <h2 className="modal-title">{editing ? "Editar usuario" : "Nuevo usuario"}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nombre completo *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Juan Pérez" />
              </div>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" value={form.username} onChange={e => setForm((p: any) => ({ ...p, username: e.target.value }))} placeholder="juan.perez" disabled={!!editing} />
              </div>
              <div className="form-group">
                <label className="form-label">{editing ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">Rol *</label>
                <select className="form-select" value={form.rol} onChange={e => setForm((p: any) => ({ ...p, rol: e.target.value }))}>
                  <option value="tecnico">Técnico</option>
                  <option value="oficina">Oficina</option>
                  <option value="gerencia">Gerencia</option>
                </select>
              </div>
              {editing && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Estatus</label>
                  <select className="form-select" value={form.activo ? "true" : "false"} onChange={e => setForm((p: any) => ({ ...p, activo: e.target.value === "true" }))}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}
            </div>
            {error && <p className="alert" style={{ marginTop: 8 }}>{error}</p>}
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