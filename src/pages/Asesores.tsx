import { useEffect, useState } from "react";
import { api } from "../api";

type Asesor = {
  _id: string;
  nombre: string;
  puesto: string;
  telefono: string;
  email: string;
  activo: boolean;
  usuario?: { _id: string; nombre: string; username: string; rol: string };
};

type Usuario = { _id: string; nombre: string; username: string; rol: string };

const empty: any = {
  nombre: "", puesto: "Asesor comercial", telefono: "", email: "", activo: true, usuario: "",
};

export default function Asesores() {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Asesor | null>(null);
  const [form, setForm]         = useState<any>(empty);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [a, u] = await Promise.all([
        api.get("/asesores"),
        api.get("/users"),
      ]);
      setAsesores(a.data);
      setUsuarios(u.data.filter((u: any) => u.activo));
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(empty); setModal(true); }
  function openEdit(a: Asesor) {
    setEditing(a);
    setForm({
      nombre: a.nombre, puesto: a.puesto, telefono: a.telefono,
      email: a.email, activo: a.activo,
      usuario: a.usuario?._id ?? "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, usuario: form.usuario || null };
      if (editing) {
        const { data } = await api.put(`/asesores/${editing._id}`, payload);
        setAsesores(prev => prev.map(a => a._id === editing._id ? data : a));
      } else {
        const { data } = await api.post("/asesores", payload);
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

  // Usuarios ya vinculados a otro asesor (para no duplicar)
  const usuariosVinculados = asesores
    .filter(a => a.usuario && a._id !== editing?._id)
    .map(a => a.usuario!._id);

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
                  <th>Usuario vinculado</th>
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
                    <td>
                      {a.usuario ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{a.usuario.nombre}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>@{a.usuario.username} · {a.usuario.rol}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Sin vincular</span>
                      )}
                    </td>
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
              <div className="form-group span-2">
                <label className="form-label">Usuario del sistema vinculado</label>
                <select className="form-select" value={form.usuario} onChange={e => f("usuario", e.target.value)}>
                  <option value="">Sin vincular</option>
                  {usuarios
                    .filter(u => !usuariosVinculados.includes(u._id))
                    .map(u => (
                      <option key={u._id} value={u._id}>
                        {u.nombre} (@{u.username}) — {u.rol}
                      </option>
                    ))}
                </select>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Al vincular un usuario, sus cotizaciones aparecerán filtradas en las solicitudes de compra.
                </p>
              </div>
              {editing && (
                <div className="form-group span-2">
                  <label className="form-label">Estatus</label>
                  <select className="form-select" value={form.activo ? "true" : "false"} onChange={e => f("activo", e.target.value === "true")}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}
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