import { useEffect, useState, useRef } from "react";
import { api } from "../api";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

type Refaccion = {
  _id: string; nombre: string; numeroParte?: string; categoria?: string;
  unidad: string; stock: number; stockMinimo: number; precio: number; activo: boolean;
};

type OrdenItem = {
  refaccion: { _id: string; nombre: string; numeroParte?: string; unidad: string; stock: number };
  cantidadSolicitada: number; cantidadSurtida: number; confirmado: boolean;
};

type Orden = {
  _id: string; folio: string;
  servicio?: { _id: string; folio: string; problema: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string };
  items: OrdenItem[];
  estatus: "pendiente" | "surtida" | "parcial" | "cancelada";
  notas?: string; surtidoPor?: { nombre: string };
  fechaSurtido?: string; createdAt: string;
  fotosEvidencia?: string[];
};

type TipoServicioItem = {
  refaccion: { _id: string; nombre: string; numeroParte?: string; unidad: string };
  cantidad: number;
};

type TipoServicio = {
  _id: string; nombre: string; descripcion?: string;
  intervaloHrs?: number; refacciones: TipoServicioItem[]; activo: boolean;
};

const emptyRefaccion = { nombre: "", numeroParte: "", categoria: "", unidad: "pieza", stock: 0, stockMinimo: 1, precio: 0 };
const emptyTipo = { nombre: "", descripcion: "", intervaloHrs: "", refacciones: [] as { refaccion: string; cantidad: number }[] };

const ESTATUS_BADGE: Record<string, string> = {
  pendiente: "badge-amber", surtida: "badge-green", parcial: "badge-blue", cancelada: "badge-gray",
};

export default function Almacen() {
  const rol         = localStorage.getItem("rol") ?? "";
  const canEdit     = ["developer", "gerencia"].includes(rol);
  const canAddRefac = ["developer", "gerencia", "almacen"].includes(rol);
  const canSurtir   = ["developer", "gerencia", "oficina", "almacen"].includes(rol);

  const [tab, setTab]                 = useState<"inventario" | "ordenes" | "tipos">("inventario");
  const [refacciones, setRefacciones] = useState<Refaccion[]>([]);
  const [ordenes, setOrdenes]         = useState<Orden[]>([]);
  const [tipos, setTipos]             = useState<TipoServicio[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const [modal, setModal]             = useState(false);
  const [stockModal, setStockModal]   = useState<Refaccion | null>(null);
  const [editing, setEditing]         = useState<Refaccion | null>(null);
  const [form, setForm]               = useState<any>(emptyRefaccion);
  const [stockForm, setStockForm]     = useState({ tipo: "entrada", cantidad: 1 });

  const [surtirModal, setSurtirModal] = useState<Orden | null>(null);
  const [surtirItems, setSurtirItems] = useState<any[]>([]);
  const [surtirNotas, setSurtirNotas] = useState("");
  const [fotosEvidencia, setFotosEvidencia] = useState<string[]>([]);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);

  const [tipoModal, setTipoModal]     = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoServicio | null>(null);
  const [tipoForm, setTipoForm]       = useState<any>(emptyTipo);
  const [saving, setSaving]           = useState(false);

  const evidenciaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, o, t] = await Promise.all([
        api.get("/refacciones"),
        api.get("/ordenes-refaccion"),
        api.get("/tipos-servicio"),
      ]);
      setRefacciones(r.data);
      setOrdenes(o.data);
      setTipos(t.data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(emptyRefaccion); setModal(true); }

  function openEdit(r: Refaccion) {
    setEditing(r);
    setForm({ nombre: r.nombre, numeroParte: r.numeroParte ?? "", categoria: r.categoria ?? "", unidad: r.unidad, stock: r.stock, stockMinimo: r.stockMinimo, precio: r.precio });
    setModal(true);
  }

  async function saveRefaccion() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/refacciones/${editing._id}`, form);
        setRefacciones(prev => prev.map(r => r._id === editing._id ? data : r));
      } else {
        const { data } = await api.post("/refacciones", form);
        setRefacciones(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function ajustarStock() {
    if (!stockModal) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/refacciones/${stockModal._id}/stock`, stockForm);
      setRefacciones(prev => prev.map(r => r._id === data._id ? data : r));
      setStockModal(null);
    } catch {}
    finally { setSaving(false); }
  }

  async function removeRefaccion(r: Refaccion) {
    if (!confirm(`¿Eliminar ${r.nombre}?`)) return;
    await api.delete(`/refacciones/${r._id}`);
    setRefacciones(prev => prev.filter(x => x._id !== r._id));
  }

  function openSurtir(o: Orden) {
    setSurtirModal(o);
    setSurtirItems(o.items.map(i => ({ refaccionId: i.refaccion._id, cantidadSurtida: i.cantidadSolicitada })));
    setSurtirNotas("");
    setFotosEvidencia([]);
  }

  async function subirEvidencia(file: File) {
    setUploadingEvidencia(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
      const data = await res.json();
      setFotosEvidencia(prev => [...prev, data.secure_url]);
    } catch { alert("Error al subir imagen"); }
    finally { setUploadingEvidencia(false); }
  }

  async function surtirOrden() {
    if (!surtirModal) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/ordenes-refaccion/${surtirModal._id}/surtir`, {
        items: surtirItems, notas: surtirNotas, fotosEvidencia,
      });
      setOrdenes(prev => prev.map(o => o._id === data._id ? data : o));
      setSurtirModal(null);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  function openNewTipo() { setEditingTipo(null); setTipoForm({ ...emptyTipo, refacciones: [] }); setTipoModal(true); }

  function openEditTipo(t: TipoServicio) {
    setEditingTipo(t);
    setTipoForm({ nombre: t.nombre, descripcion: t.descripcion ?? "", intervaloHrs: t.intervaloHrs ?? "", refacciones: t.refacciones.map(r => ({ refaccion: r.refaccion._id, cantidad: r.cantidad })) });
    setTipoModal(true);
  }

  function addRefaccionTipo() { setTipoForm((p: any) => ({ ...p, refacciones: [...p.refacciones, { refaccion: "", cantidad: 1 }] })); }
  function removeRefaccionTipo(i: number) { setTipoForm((p: any) => ({ ...p, refacciones: p.refacciones.filter((_: any, idx: number) => idx !== i) })); }
  function updateRefaccionTipo(i: number, field: string, val: any) {
    setTipoForm((p: any) => { const refs = [...p.refacciones]; refs[i] = { ...refs[i], [field]: val }; return { ...p, refacciones: refs }; });
  }

  async function saveTipo() {
    if (!tipoForm.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nombre: tipoForm.nombre,
        descripcion: tipoForm.descripcion || null,
        intervaloHrs: tipoForm.intervaloHrs ? +tipoForm.intervaloHrs : null,
        refacciones: tipoForm.refacciones.filter((r: any) => r.refaccion),
      };
      if (editingTipo) {
        const { data } = await api.put(`/tipos-servicio/${editingTipo._id}`, payload);
        setTipos(prev => prev.map(t => t._id === editingTipo._id ? data : t));
      } else {
        const { data } = await api.post("/tipos-servicio", payload);
        setTipos(prev => [data, ...prev]);
      }
      setTipoModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function removeTipo(t: TipoServicio) {
    if (!confirm(`¿Eliminar tipo "${t.nombre}"?`)) return;
    await api.delete(`/tipos-servicio/${t._id}`);
    setTipos(prev => prev.filter(x => x._id !== t._id));
  }

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const filteredRef   = refacciones.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (r.numeroParte ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.categoria ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrd   = ordenes.filter(o =>
    o.folio.toLowerCase().includes(search.toLowerCase()) ||
    (o.servicio?.folio ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (o.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredTipos = tipos.filter(t =>
    t.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (t.descripcion ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stockBajo         = refacciones.filter(r => r.stock <= r.stockMinimo).length;
  const ordenesPendientes = ordenes.filter(o => o.estatus === "pendiente").length;

  const tabStyle = (t: string) => ({
    padding: "8px 20px", borderRadius: "var(--radius-sm)", border: "1.5px solid", cursor: "pointer",
    borderColor: tab === t ? "var(--accent)" : "var(--border)",
    background: tab === t ? "rgba(255,180,0,0.1)" : "var(--surface2)",
    color: tab === t ? "var(--accent)" : "var(--text-muted)",
    fontWeight: tab === t ? 700 : 400, fontSize: "0.88rem",
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Almacén</h1>
          <p className="page-subtitle">{refacciones.length} refacciones en inventario</p>
        </div>
        {canAddRefac && tab === "inventario" && <button className="btn btn-primary" onClick={openNew}>+ Nueva refacción</button>}
        {canEdit && tab === "tipos" && <button className="btn btn-primary" onClick={openNewTipo}>+ Nuevo tipo</button>}
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="stat-card">
            <span className="stat-card-icon">📦</span>
            <p className="stat-card-value" style={{ color: "var(--blue)" }}>{refacciones.length}</p>
            <p className="stat-card-label">Total refacciones</p>
            <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("inventario")}>
            <span className="stat-card-icon">⚠️</span>
            <p className="stat-card-value" style={{ color: stockBajo > 0 ? "var(--red)" : "var(--green)" }}>{stockBajo}</p>
            <p className="stat-card-label">Stock bajo</p>
            <div className="stat-card-accent" style={{ background: stockBajo > 0 ? "var(--red)" : "var(--green)" }} />
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("ordenes")}>
            <span className="stat-card-icon">📋</span>
            <p className="stat-card-value" style={{ color: ordenesPendientes > 0 ? "var(--accent)" : "var(--green)" }}>{ordenesPendientes}</p>
            <p className="stat-card-label">Órdenes pendientes</p>
            <div className="stat-card-accent" style={{ background: ordenesPendientes > 0 ? "var(--accent)" : "var(--green)" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setTab("inventario"); setSearch(""); }} style={tabStyle("inventario")}>📦 Inventario</button>
          <button onClick={() => { setTab("ordenes"); setSearch(""); }} style={tabStyle("ordenes")}>📋 Órdenes</button>
          {canEdit && <button onClick={() => { setTab("tipos"); setSearch(""); }} style={tabStyle("tipos")}>⚙️ Tipos de servicio</button>}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">
              {tab === "inventario" ? "Inventario de refacciones" : tab === "ordenes" ? "Órdenes de refacciones" : "Tipos de servicio"}
            </p>
            <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : tab === "inventario" ? (
            filteredRef.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📦</span><p>Sin refacciones registradas</p></div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>No. Parte</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Mín.</th><th>Precio</th><th></th></tr></thead>
                <tbody>
                  {filteredRef.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{r.numeroParte || "—"}</td>
                      <td>{r.categoria || "—"}</td>
                      <td>{r.unidad}</td>
                      <td><span style={{ fontWeight: 700, color: r.stock <= r.stockMinimo ? "var(--red)" : "var(--green)" }}>{r.stock}</span></td>
                      <td style={{ color: "var(--text-muted)" }}>{r.stockMinimo}</td>
                      <td>${r.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canEdit && (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => removeRefaccion(r)}>🗑️</button>
                            </>
                          )}
                          {canAddRefac && (
                            <button className="btn btn-primary btn-sm" onClick={() => { setStockModal(r); setStockForm({ tipo: "entrada", cantidad: 1 }); }} title="Ajustar stock">±</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "ordenes" ? (
            filteredOrd.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📋</span><p>Sin órdenes registradas</p></div>
            ) : (
              <table>
                <thead><tr><th>Folio</th><th>Servicio</th><th>Equipo</th><th>Piezas</th><th>Fecha</th><th>Estatus</th><th></th></tr></thead>
                <tbody>
                  {filteredOrd.map(o => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{o.folio}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{o.servicio?.folio ?? "—"}</td>
                      <td style={{ fontWeight: 600 }}>{o.montacargas?.numeroEconomico} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{o.montacargas?.marca}</span></td>
                      <td>{o.items.length} pieza{o.items.length !== 1 ? "s" : ""}</td>
                      <td>{fmt(o.createdAt)}</td>
                      <td><span className={`badge ${ESTATUS_BADGE[o.estatus]}`}>{o.estatus}</span></td>
                      <td>
                        {(o.estatus === "pendiente" || o.estatus === "parcial") && canSurtir && (
                          <button className="btn btn-primary btn-sm" onClick={() => openSurtir(o)}>Surtir</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            filteredTipos.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">⚙️</span><p>Sin tipos de servicio registrados</p></div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>Intervalo</th><th>Descripción</th><th>Refacciones</th><th></th></tr></thead>
                <tbody>
                  {filteredTipos.map(t => (
                    <tr key={t._id}>
                      <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                      <td>{t.intervaloHrs ? `${t.intervaloHrs} hrs` : "—"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{t.descripcion || "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {t.refacciones.length === 0
                            ? <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Sin refacciones</span>
                            : t.refacciones.map((r, i) => (
                              <span key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "0.75rem" }}>
                                {r.cantidad}× {r.refaccion.nombre}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td>
                        {canEdit && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditTipo(t)}>✏️</button>
                            <button className="btn btn-danger btn-sm" onClick={() => removeTipo(t)}>🗑️</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* ── Modal refacción ── */}
      {modal && canAddRefac && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar refacción" : "Nueva refacción"}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Filtro de aceite" />
              </div>
              <div className="form-group"><label className="form-label">No. de parte</label><input className="form-input" value={form.numeroParte} onChange={e => setForm((p: any) => ({ ...p, numeroParte: e.target.value }))} placeholder="Ej. HY-4521" /></div>
              <div className="form-group"><label className="form-label">Categoría</label><input className="form-input" value={form.categoria} onChange={e => setForm((p: any) => ({ ...p, categoria: e.target.value }))} placeholder="Ej. Filtros, Aceites..." /></div>
              <div className="form-group">
                <label className="form-label">Unidad</label>
                <select className="form-select" value={form.unidad} onChange={e => setForm((p: any) => ({ ...p, unidad: e.target.value }))}>
                  <option value="pieza">Pieza</option><option value="litro">Litro</option>
                  <option value="juego">Juego</option><option value="par">Par</option>
                  <option value="metro">Metro</option><option value="kg">Kg</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Stock inicial</label><input className="form-input" type="number" value={form.stock} onChange={e => setForm((p: any) => ({ ...p, stock: +e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Stock mínimo</label><input className="form-input" type="number" value={form.stockMinimo} onChange={e => setForm((p: any) => ({ ...p, stockMinimo: +e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Precio unitario ($)</label><input className="form-input" type="number" value={form.precio} onChange={e => setForm((p: any) => ({ ...p, precio: +e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveRefaccion} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajustar stock ── */}
      {stockModal && canAddRefac && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStockModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <button className="modal-close" onClick={() => setStockModal(null)}>✕</button>
            <h2 className="modal-title">Ajustar stock</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              <strong style={{ color: "var(--text)" }}>{stockModal.nombre}</strong> — Stock actual: <strong style={{ color: "var(--accent)" }}>{stockModal.stock} {stockModal.unidad}s</strong>
            </p>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label className="form-label">Tipo de movimiento</label>
                <select className="form-select" value={stockForm.tipo} onChange={e => setStockForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="entrada">📥 Entrada</option><option value="salida">📤 Salida</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Cantidad</label><input className="form-input" type="number" min={1} value={stockForm.cantidad} onChange={e => setStockForm(p => ({ ...p, cantidad: +e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={ajustarStock} disabled={saving}>{saving ? "Guardando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal surtir orden ── */}
      {surtirModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSurtirModal(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <button className="modal-close" onClick={() => setSurtirModal(null)}>✕</button>
            <h2 className="modal-title">Surtir orden {surtirModal.folio}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              Servicio: <strong style={{ color: "var(--text)" }}>{surtirModal.servicio?.folio}</strong> — {surtirModal.montacargas?.numeroEconomico} {surtirModal.montacargas?.marca}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {surtirModal.items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>{item.refaccion.nombre}</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {item.refaccion.numeroParte ? `#${item.refaccion.numeroParte} · ` : ""}
                      Stock: <strong style={{ color: item.refaccion.stock >= item.cantidadSolicitada ? "var(--green)" : "var(--red)" }}>{item.refaccion.stock}</strong>
                    </p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>Solicitado</p>
                    <p style={{ margin: 0, fontWeight: 700 }}>{item.cantidadSolicitada} {item.refaccion.unidad}</p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>A surtir</p>
                    <input
                      type="number" min={0} max={item.cantidadSolicitada}
                      value={surtirItems[i]?.cantidadSurtida ?? item.cantidadSolicitada}
                      onChange={e => setSurtirItems(prev => prev.map((x, idx) => idx === i ? { ...x, cantidadSurtida: +e.target.value } : x))}
                      style={{ width: 70, padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", textAlign: "center" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" value={surtirNotas} onChange={e => setSurtirNotas(e.target.value)} placeholder="Ej. Faltó 1 filtro, se pedirá mañana" />
            </div>

            {/* ── Fotos de evidencia ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>📷 Fotos de refacciones viejas / evidencia</label>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => evidenciaRef.current?.click()}
                  disabled={uploadingEvidencia}
                >
                  {uploadingEvidencia ? "Subiendo..." : "+ Agregar foto"}
                </button>
                <input
                  ref={evidenciaRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirEvidencia(f); e.target.value = ""; }}
                />
              </div>
              {fotosEvidencia.length === 0 ? (
                <div
                  onClick={() => evidenciaRef.current?.click()}
                  style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)", padding: "20px", textAlign: "center", cursor: "pointer", background: "var(--surface2)" }}
                >
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>📷 Toca para agregar fotos de evidencia</p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {fotosEvidencia.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt={`evidencia-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                      <button
                        onClick={() => setFotosEvidencia(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </div>
                  ))}
                  <div
                    onClick={() => evidenciaRef.current?.click()}
                    style={{ width: 80, height: 80, border: "2px dashed var(--border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--surface2)" }}
                  >
                    <span style={{ fontSize: "1.4rem", color: "var(--text-muted)" }}>+</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSurtirModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={surtirOrden} disabled={saving}>{saving ? "Confirmando..." : "Confirmar entrega"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal tipo servicio ── */}
      {tipoModal && canEdit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTipoModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setTipoModal(false)}>✕</button>
            <h2 className="modal-title">{editingTipo ? "Editar tipo de servicio" : "Nuevo tipo de servicio"}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={tipoForm.nombre} onChange={e => setTipoForm((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Preventivo 500 hrs" />
              </div>
              <div className="form-group"><label className="form-label">Intervalo (horas)</label><input className="form-input" type="number" value={tipoForm.intervaloHrs} onChange={e => setTipoForm((p: any) => ({ ...p, intervaloHrs: e.target.value }))} placeholder="Ej. 500" /></div>
              <div className="form-group"><label className="form-label">Descripción</label><input className="form-input" value={tipoForm.descripcion} onChange={e => setTipoForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional" /></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Refacciones sugeridas</p>
                <button className="btn btn-secondary btn-sm" onClick={addRefaccionTipo}>+ Agregar</button>
              </div>
              {tipoForm.refacciones.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>Sin refacciones — este tipo no generará orden automática</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tipoForm.refacciones.map((r: any, i: number) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: 8, alignItems: "center" }}>
                      <select className="form-select" value={r.refaccion} onChange={e => updateRefaccionTipo(i, "refaccion", e.target.value)}>
                        <option value="">Selecciona refacción...</option>
                        {refacciones.map(ref => <option key={ref._id} value={ref._id}>{ref.nombre}{ref.numeroParte ? ` (#${ref.numeroParte})` : ""}</option>)}
                      </select>
                      <input className="form-input" type="number" min={1} value={r.cantidad} onChange={e => updateRefaccionTipo(i, "cantidad", +e.target.value)} style={{ padding: "8px", textAlign: "center" }} />
                      <button className="btn btn-danger btn-icon" onClick={() => removeRefaccionTipo(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTipoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTipo} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}