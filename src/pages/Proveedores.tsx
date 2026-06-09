import { useEffect, useState } from "react";
import { api } from "../api";

type Proveedor = {
  _id: string;
  nombre: string;
  rfc?: string;
  email?: string;
  telefono?: string;
  notas?: string;
  activo: boolean;
};

const emptyForm = { nombre: "", rfc: "", email: "", telefono: "", notas: "" };

export default function Proveedores() {
  const rol = localStorage.getItem("rol") ?? "";
  const canEdit = ["developer", "gerencia"].includes(rol);

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [modal, setModal]             = useState(false);
  const [editing, setEditing]         = useState<Proveedor | null>(null);
  const [form, setForm]               = useState<any>(emptyForm);
  const [saving, setSaving]           = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/proveedores");
      setProveedores(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  }

  function openEdit(p: Proveedor) {
    setEditing(p);
    setForm({
      nombre:   p.nombre,
      rfc:      p.rfc      ?? "",
      email:    p.email    ?? "",
      telefono: p.telefono ?? "",
      notas:    p.notas    ?? "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.nombre) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/proveedores/${editing._id}`, form);
        setProveedores(prev => prev.map(p => p._id === editing._id ? data : p));
      } else {
        const { data } = await api.post("/proveedores", form);
        setProveedores(prev => [data, ...prev]);
      }
      setModal(false);
      setEditing(null);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSaving(false); }
  }

  async function toggleActivo(p: Proveedor) {
    const { data } = await api.put(`/proveedores/${p._id}`, { activo: !p.activo });
    setProveedores(prev => prev.map(x => x._id === p._id ? data : x));
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    await api.delete(`/proveedores/${id}`);
    setProveedores(prev => prev.filter(p => p._id !== id));
  }

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.rfc     ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.email   ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">{proveedores.length} registrados</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo proveedor</button>
        )}
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Catálogo de proveedores</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏭</span>
              <p>Sin proveedores registrados</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 130px 200px 130px 1fr 80px",
                padding: "8px 20px", borderBottom: "1px solid var(--border)",
                fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                <span>Nombre</span>
                <span>RFC</span>
                <span>Email</span>
                <span>Teléfono</span>
                <span>Notas</span>
                <span style={{ textAlign: "right" }}>Acciones</span>
              </div>

              {filtered.map((p, idx) => (
                <div key={p._id} style={{
                  display: "grid", gridTemplateColumns: "1fr 130px 200px 130px 1fr 80px",
                  padding: "12px 20px", borderBottom: "1px solid var(--border)",
                  alignItems: "center", fontSize: "0.82rem",
                  background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  opacity: p.activo ? 1 : 0.45,
                }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{p.nombre}</p>
                    {!p.activo && (
                      <span style={{ fontSize: "0.68rem", color: "var(--red)" }}>Inactivo</span>
                    )}
                  </div>
                  <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {p.rfc ?? "—"}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--blue)" }}>
                    {p.email ? <a href={`mailto:${p.email}`} style={{ color: "var(--blue)" }}>{p.email}</a> : "—"}
                  </p>
                  <p style={{ color: "var(--text-muted)" }}>{p.telefono ?? "—"}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {p.notas ?? "—"}
                  </p>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} title="Editar">✏️</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActivo(p)}
                        title={p.activo ? "Desactivar" : "Activar"}>
                        {p.activo ? "🔒" : "🔓"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(p._id)} title="Eliminar">🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre}
                  onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Ferretería Guadalajara" />
              </div>
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input className="form-input" value={form.rfc}
                  onChange={e => setForm((p: any) => ({ ...p, rfc: e.target.value }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.telefono}
                  onChange={e => setForm((p: any) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))}
                  placeholder="correo@proveedor.com — se usará para envío de comprobantes" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Notas</label>
                <input className="form-input" value={form.notas}
                  onChange={e => setForm((p: any) => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}
                disabled={saving || !form.nombre}>
                {saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}