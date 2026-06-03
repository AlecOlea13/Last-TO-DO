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
  razonSocial?: string;
  rfc?: string;
  regimenFiscal?: string;
  usoCFDI?: string;
  direccionFiscal?: string;
  codigoPostal?: string;
  emailFiscal?: string;
};

const empty: any = {
  nombre: "", contacto: "", telefono: "", email: "",
  direccion: "", condicionesPago: "", estatus: "activo",
  razonSocial: "", rfc: "", regimenFiscal: "", usoCFDI: "",
  direccionFiscal: "", codigoPostal: "", emailFiscal: "",
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Cliente | null>(null);
  const [form, setForm]         = useState<any>(empty);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState<"general" | "fiscal">("general");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/clientes");
      setClientes(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(empty); setTab("general"); setModal(true); }
  function openEdit(c: Cliente) {
    setEditing(c);
    setForm({
      nombre: c.nombre, contacto: c.contacto ?? "", telefono: c.telefono ?? "",
      email: c.email ?? "", direccion: c.direccion ?? "", condicionesPago: c.condicionesPago ?? "",
      estatus: c.estatus, razonSocial: c.razonSocial ?? "", rfc: c.rfc ?? "",
      regimenFiscal: c.regimenFiscal ?? "", usoCFDI: c.usoCFDI ?? "",
      direccionFiscal: c.direccionFiscal ?? "", codigoPostal: c.codigoPostal ?? "",
      emailFiscal: c.emailFiscal ?? "",
    });
    setTab("general");
    setModal(true);
  }

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
    (c.contacto ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.rfc ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const f = (field: string, val: string) => setForm((p: any) => ({ ...p, [field]: val }));

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
                  <th>Razón Social</th>
                  <th>RFC</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Pago</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{c.razonSocial || "—"}</td>
                    <td style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>{c.rfc || "—"}</td>
                    <td>{c.contacto || "—"}</td>
                    <td>{c.telefono || "—"}</td>
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
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar cliente" : "Nuevo cliente"}</h2>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
              {(["general", "fiscal"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
                  color: tab === t ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "0.85rem",
                  textTransform: "capitalize", transition: "color 0.2s",
                }}>
                  {t === "general" ? "General" : "Datos Fiscales"}
                </button>
              ))}
            </div>

            {tab === "general" && (
              <div className="form-grid">
                <div className="form-group span-2">
                  <label className="form-label">Nombre empresa *</label>
                  <input className="form-input" value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Ej. JIT Logistics" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contacto</label>
                  <input className="form-input" value={form.contacto} onChange={e => f("contacto", e.target.value)} placeholder="Nombre del contacto" />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.telefono} onChange={e => f("telefono", e.target.value)} placeholder="33 1234 5678" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={form.email} onChange={e => f("email", e.target.value)} placeholder="contacto@empresa.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Condiciones de pago</label>
                  <input className="form-input" value={form.condicionesPago} onChange={e => f("condicionesPago", e.target.value)} placeholder="Ej. 30 días" />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={form.direccion} onChange={e => f("direccion", e.target.value)} placeholder="Calle, Ciudad" />
                </div>
                <div className="form-group">
                  <label className="form-label">Estatus</label>
                  <select className="form-select" value={form.estatus} onChange={e => f("estatus", e.target.value)}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            )}

            {tab === "fiscal" && (
              <div className="form-grid">
                <div className="form-group span-2">
                  <label className="form-label">Razón Social</label>
                  <input className="form-input" value={form.razonSocial} onChange={e => f("razonSocial", e.target.value)} placeholder="Nombre legal de la empresa" />
                </div>
                <div className="form-group">
                  <label className="form-label">RFC</label>
                  <input className="form-input" value={form.rfc} onChange={e => f("rfc", e.target.value.toUpperCase())} placeholder="XXXX000000XXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Régimen Fiscal</label>
                  <input className="form-input" value={form.regimenFiscal} onChange={e => f("regimenFiscal", e.target.value)} placeholder="Ej. 601 - General de Ley" />
                </div>
                <div className="form-group">
                  <label className="form-label">Uso de CFDI</label>
                  <input className="form-input" value={form.usoCFDI} onChange={e => f("usoCFDI", e.target.value)} placeholder="Ej. G03 - Gastos en general" />
                </div>
                <div className="form-group">
                  <label className="form-label">Código Postal</label>
                  <input className="form-input" value={form.codigoPostal} onChange={e => f("codigoPostal", e.target.value)} placeholder="45000" />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Dirección Fiscal</label>
                  <input className="form-input" value={form.direccionFiscal} onChange={e => f("direccionFiscal", e.target.value)} placeholder="Dirección completa para facturación" />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Email Fiscal</label>
                  <input className="form-input" value={form.emailFiscal} onChange={e => f("emailFiscal", e.target.value)} placeholder="facturacion@empresa.com" />
                </div>
              </div>
            )}

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