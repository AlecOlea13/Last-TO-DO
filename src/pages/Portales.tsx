import { useEffect, useState } from "react";
import { api } from "../api";

type Portal = {
  _id: string;
  nombre: string;
  url?: string;
  usuario?: string;
  password?: string;
  notas?: string;
};

const emptyForm = { nombre: "", url: "", usuario: "", password: "", notas: "" };

export default function Portales() {
  const [portales, setPortales] = useState<Portal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState<Portal | null>(null);
  const [form, setForm]     = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [verPassword, setVerPassword] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/portales");
      setPortales(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  }

  function openEdit(p: Portal) {
    setEditing(p);
    setForm({
      nombre: p.nombre, url: p.url ?? "", usuario: p.usuario ?? "",
      password: p.password ?? "", notas: p.notas ?? "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/portales/${editing._id}`, form);
        setPortales(prev => prev.map(p => p._id === editing._id ? data : p));
      } else {
        const { data } = await api.post("/portales", form);
        setPortales(prev => [...prev, data]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este acceso?")) return;
    await api.delete(`/portales/${id}`);
    setPortales(prev => prev.filter(p => p._id !== id));
  }

  function copiar(texto: string, label: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(label);
    setTimeout(() => setCopiado(null), 1500);
  }

  const filtered = portales.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.usuario ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Portales</h1>
          <p className="page-subtitle">{portales.length} accesos guardados</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo acceso</button>
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Accesos a portales</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🔑</span><p>Sin accesos guardados{search ? " con ese filtro" : ""}</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
              {filtered.map(p => (
                <div key={p._id} style={{
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "1rem" }}>{p.nombre}</p>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "var(--blue)" }}>
                          {p.url}
                        </a>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p._id)}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {p.usuario && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", flex: 1 }}>👤 {p.usuario}</span>
                        <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                          onClick={() => copiar(p.usuario!, `usuario-${p._id}`)}>
                          {copiado === `usuario-${p._id}` ? "✅" : "📋"}
                        </button>
                      </div>
                    )}
                    {p.password && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", flex: 1, fontFamily: "monospace" }}>
                          🔒 {verPassword[p._id] ? p.password : "•".repeat(p.password.length)}
                        </span>
                        <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                          onClick={() => setVerPassword(prev => ({ ...prev, [p._id]: !prev[p._id] }))}>
                          {verPassword[p._id] ? "🙈" : "👁️"}
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                          onClick={() => copiar(p.password!, `pass-${p._id}`)}>
                          {copiado === `pass-${p._id}` ? "✅" : "📋"}
                        </button>
                      </div>
                    )}
                  </div>

                  {p.notas && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 10 }}>📝 {p.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar acceso" : "Nuevo acceso"}</h2>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Nombre del portal *</label>
                <input className="form-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Cytrum - MEDAM" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">URL</label>
                <input className="form-input" value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input className="form-input" value={form.usuario}
                  onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input className="form-input" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Notas (opcional)</label>
                <textarea className="form-textarea" rows={2} value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Ej. Acceso compartido con el cliente X" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.nombre.trim()}>
                {saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}