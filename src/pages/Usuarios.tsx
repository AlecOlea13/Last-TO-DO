import { useEffect, useState } from "react";
import { api } from "../api";

type Usuario = {
  _id: string;
  username: string;
  nombre: string;
  rol: "developer" | "gerencia" | "oficina" | "tecnico" | "almacen";
  activo: boolean;
  permisos: string[];
  createdAt: string;
};

const ROL_BADGE: Record<string, string> = {
  developer: "badge-red",
  gerencia:  "badge-blue",
  oficina:   "badge-green",
  tecnico:   "badge-amber",
  almacen:   "badge-purple",
};

const emptyForm = {
  username: "", nombre: "", password: "", rol: "oficina", activo: true, permisos: [] as string[],
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
    setForm({
      username: u.username, nombre: u.nombre, password: "",
      rol: u.rol, activo: u.activo, permisos: u.permisos ?? [],
    });
    setError("");
    setModal(true);
  }

  function togglePermiso(permiso: string) {
    setForm((p: any) => {
      const permisos = p.permisos.includes(permiso)
        ? p.permisos.filter((x: string) => x !== permiso)
        : [...p.permisos, permiso];
      return { ...p, permisos };
    });
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

  // Permisos especiales disponibles — aquí agregas más en el futuro
  const PERMISOS_DISPONIBLES = [
    { key: "flota", label: "🚗 Flota", desc: "Acceso al módulo de camionetas y flota vehicular" },
  ];

  // Solo mostrar permisos para roles que no los tienen por defecto
  const mostrarPermisos = form.rol === "oficina" || form.rol === "tecnico" || form.rol === "almacen";

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
                  <th>Permisos extra</th>
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
                      {(u.permisos ?? []).length > 0 ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {u.permisos.map(p => (
                            <span key={p} style={{ fontSize: "0.72rem", background: "rgba(79,124,255,0.12)", color: "var(--blue)", border: "1px solid rgba(79,124,255,0.25)", borderRadius: 4, padding: "1px 8px", fontWeight: 600 }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>—</span>
                      )}
                    </td>
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
                <input className="form-input" value={form.username} onChange={e => setForm((p: any) => ({ ...p, username: e.target.value }))} placeholder="juan.perez" />
              </div>
              <div className="form-group">
                <label className="form-label">{editing ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">Rol *</label>
                <select className="form-select" value={form.rol} onChange={e => setForm((p: any) => ({ ...p, rol: e.target.value }))}>
                  <option value="tecnico">Técnico</option>
                  <option value="almacen">Almacén</option>
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

              {mostrarPermisos && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Permisos especiales</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    {PERMISOS_DISPONIBLES.map(p => (
                      <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: form.permisos.includes(p.key) ? "rgba(79,124,255,0.08)" : "var(--surface2)", border: `1px solid ${form.permisos.includes(p.key) ? "rgba(79,124,255,0.3)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", transition: "all 0.15s" }}>
                        <input
                          type="checkbox"
                          checked={form.permisos.includes(p.key)}
                          onChange={() => togglePermiso(p.key)}
                          style={{ width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer", flexShrink: 0 }}
                        />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem", color: "var(--text)" }}>{p.label}</p>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
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