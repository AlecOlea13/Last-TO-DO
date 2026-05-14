import { useEffect, useState } from "react";
import { api } from "../api";
import { generarReporte, imprimirReporte } from "../utils/generarReporte";

type Item = { cantidad: number; descripcion: string; precioUnitario: number; total: number; imagen?: string };
type Asesor = { _id: string; nombre: string; puesto: string; telefono: string; email: string };
type Cotizacion = {
  _id: string;
  folio: string;
  tipo: "servicio" | "renta" | "venta";
  cliente?: { _id: string; nombre: string; direccion?: string; telefono?: string; contacto?: string };
  montacargas?: {
    _id: string;
    numeroEconomico: string;
    marca: string;
    modelo: string;
    capacidad?: string;
    tipo?: string;
    serie?: string;
    alturaColapsada?: string;
    alturaLevante?: string;
    horquillas?: string;
    desplazadorLateral?: boolean;
    tipoLlantas?: string;
    voltaje?: string;
    tipoBateria?: string;
    incluyeCargador?: boolean;
    equipoSeguridad?: {
      alarmaReversa?: boolean;
      torretaAmbar?: boolean;
      luces?: boolean;
      extintor?: boolean;
    };
  };
  asesor?: { _id: string; nombre: string; puesto: string; telefono: string; email: string };
  fecha: string;
  lugar: string;
  descripcionServicio?: string;
  items: Item[];
  subtotal: number;
  iva: number;
  total: number;
  estatus: "borrador" | "enviada" | "aceptada" | "rechazada";
  notas?: string;
};

type Cliente     = { _id: string; nombre: string };
type Montacargas = {
  _id: string;
  numeroEconomico: string;
  marca: string;
  modelo: string;
  capacidad?: string;
  tipo?: string;
  serie?: string;
  alturaColapsada?: string;
  alturaLevante?: string;
  horquillas?: string;
  desplazadorLateral?: boolean;
  tipoLlantas?: string;
  voltaje?: string;
  tipoBateria?: string;
  incluyeCargador?: boolean;
  equipoSeguridad?: {
    alarmaReversa?: boolean;
    torretaAmbar?: boolean;
    luces?: boolean;
    extintor?: boolean;
  };
};

const emptyForm: any = {
  folio: "", tipo: "servicio", cliente: "", montacargas: "", asesor: "",
  fecha: new Date().toISOString().split("T")[0], lugar: "Zapopán, Jal",
  descripcionServicio: "", items: [], subtotal: 0, iva: 0, total: 0,
  estatus: "borrador", notas: "",
};

const emptyItem: Item = { cantidad: 1, descripcion: "", precioUnitario: 0, total: 0, imagen: "" };

const TIPO_BADGE: Record<string, string> = {
  servicio: "badge-amber", renta: "badge-blue", venta: "badge-green",
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [montas, setMontas]             = useState<Montacargas[]>([]);
  const [asesores, setAsesores]         = useState<Asesor[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filtro, setFiltro]             = useState("todos");
  const [modal, setModal]               = useState(false);
  const [form, setForm]                 = useState<any>(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [co, cl, mo, as] = await Promise.all([
        api.get("/cotizaciones"), api.get("/clientes"),
        api.get("/montacargas"), api.get("/asesores"),
      ]);
      setCotizaciones(co.data);
      setClientes(cl.data.filter((c: any) => c.estatus === "activo"));
      setMontas(mo.data);
      setAsesores(as.data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ ...emptyForm, folio: `COT-${Date.now().toString().slice(-6)}`, items: [{ ...emptyItem }] });
    setModal(true);
  }

  function addItem() {
    setForm((p: any) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  }

  function removeItem(i: number) {
    setForm((p: any) => ({ ...p, items: p.items.filter((_: any, idx: number) => idx !== i) }));
  }

  function updateItem(i: number, field: string, val: any) {
    setForm((p: any) => {
      const items = [...p.items];
      items[i] = { ...items[i], [field]: val };
      if (field === "cantidad" || field === "precioUnitario") {
        items[i].total = items[i].cantidad * items[i].precioUnitario;
      }
      const subtotal = items.reduce((acc: number, it: Item) => acc + it.total, 0);
      const iva      = subtotal * 0.16;
      return { ...p, items, subtotal, iva, total: subtotal + iva };
    });
  }

  async function subirImagen(i: number, file: File) {
    setUploadingIdx(i);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const data = await res.json();
      updateItem(i, "imagen", data.secure_url);
    } catch {
      alert("Error al subir imagen");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function save() {
    if (!form.folio || !form.cliente) return;
    setSaving(true);
    try {
      const { data } = await api.post("/cotizaciones", form);
      setCotizaciones(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta cotización?")) return;
    await api.delete(`/cotizaciones/${id}`);
    setCotizaciones(prev => prev.filter(c => c._id !== id));
  }

  async function cambiarEstatus(id: string, estatus: string) {
    const { data } = await api.put(`/cotizaciones/${id}`, { estatus });
    setCotizaciones(prev => prev.map(c => c._id === id ? { ...c, estatus: data.estatus } : c));
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = cotizaciones.filter(c => {
    const matchSearch =
      c.folio.toLowerCase().includes(search.toLowerCase()) ||
      (c.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "todos" || c.tipo === filtro || c.estatus === filtro;
    return matchSearch && matchFiltro;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">{cotizaciones.length} cotizaciones registradas</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva cotización</button>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Borradores", val: cotizaciones.filter(c => c.estatus === "borrador").length, color: "var(--text-muted)", icon: "📝" },
            { label: "Enviadas",   val: cotizaciones.filter(c => c.estatus === "enviada").length,  color: "var(--blue)",       icon: "📤" },
            { label: "Aceptadas",  val: cotizaciones.filter(c => c.estatus === "aceptada").length, color: "var(--green)",      icon: "✅" },
            { label: "Rechazadas", val: cotizaciones.filter(c => c.estatus === "rechazada").length,color: "var(--red)",        icon: "❌" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-card-icon">{s.icon}</span>
              <p className="stat-card-value" style={{ color: s.color }}>{s.val}</p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Todas las cotizaciones</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todas</option>
                <option value="servicio">Servicio</option>
                <option value="renta">Renta</option>
                <option value="venta">Venta</option>
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📄</span><p>Sin cotizaciones{search ? " con ese filtro" : ""}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Asesor</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{c.folio}</td>
                    <td><span className={`badge ${TIPO_BADGE[c.tipo]}`}>{c.tipo}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.cliente?.nombre ?? "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{c.asesor?.nombre ?? "—"}</td>
                    <td>{fmt(c.fecha)}</td>
                    <td style={{ fontWeight: 700 }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: "4px 8px", fontSize: "0.78rem", width: "auto" }}
                        value={c.estatus}
                        onChange={e => cambiarEstatus(c._id, e.target.value)}
                      >
                        <option value="borrador">Borrador</option>
                        <option value="enviada">Enviada</option>
                        <option value="aceptada">Aceptada</option>
                        <option value="rechazada">Rechazada</option>
                      </select>
                    </td>
                      <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => generarReporte(c)} title="Ver reporte">👁️</button>
                      <button className="btn btn-primary btn-sm" onClick={() => imprimirReporte(c)} title="Imprimir / Descargar PDF">🖨️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(c._id)}>🗑️</button>
                    </div>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nueva cotización</h2>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Folio *</label>
                <input className="form-input" value={form.folio} onChange={e => setForm((p: any) => ({ ...p, folio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select className="form-select" value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}>
                  <option value="servicio">Servicio / Mantenimiento</option>
                  <option value="renta">Renta</option>
                  <option value="venta">Venta</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Asesor</label>
                <select className="form-select" value={form.asesor} onChange={e => setForm((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asesor</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montacargas</label>
                <select className="form-select" value={form.montacargas} onChange={e => setForm((p: any) => ({ ...p, montacargas: e.target.value }))}>
                  <option value="">Sin equipo</option>
                  {montas.map(m => <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca} {m.modelo}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={form.fecha} onChange={e => setForm((p: any) => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Lugar</label>
                <input className="form-input" value={form.lugar} onChange={e => setForm((p: any) => ({ ...p, lugar: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Descripción del servicio</label>
                <input className="form-input" value={form.descripcionServicio} onChange={e => setForm((p: any) => ({ ...p, descripcionServicio: e.target.value }))} placeholder="Ej. Mantenimiento correctivo a batería modelo 18-125-15" />
              </div>
            </div>

            {/* Items */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Conceptos</p>
                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar línea</button>
              </div>

              {/* Headers */}
              <div style={{ display: "grid", gridTemplateColumns: "56px 50px 1fr 110px 110px 32px", gap: 6, marginBottom: 4 }}>
                {["Foto", "Cant.", "Descripción", "Precio U.", "Total", ""].map(h => (
                  <p key={h} style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{h}</p>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.items.map((item: Item, i: number) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 50px 1fr 110px 110px 32px", gap: 6, alignItems: "center", background: "var(--surface2)", padding: 8, borderRadius: "var(--radius-sm)" }}>
                    {/* Imagen */}
                    <label style={{ cursor: "pointer", position: "relative" }}>
                      {item.imagen ? (
                        <img src={item.imagen} alt="producto" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                      ) : (
                        <div style={{ width: 48, height: 48, background: "var(--surface3)", borderRadius: 6, border: "1px dashed var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                          {uploadingIdx === i ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : "📷"}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirImagen(i, f); }}
                      />
                    </label>

                    <input className="form-input" type="number" value={item.cantidad} onChange={e => updateItem(i, "cantidad", +e.target.value)} style={{ padding: "8px" }} />
                    <input className="form-input" value={item.descripcion} onChange={e => updateItem(i, "descripcion", e.target.value)} placeholder="Descripción del concepto" />
                    <input className="form-input" type="number" value={item.precioUnitario} onChange={e => updateItem(i, "precioUnitario", +e.target.value)} style={{ padding: "8px" }} />
                    <input className="form-input" value={`$${item.total.toLocaleString()}`} readOnly style={{ padding: "8px", color: "var(--text-muted)" }} />
                    <button className="btn btn-danger btn-icon" onClick={() => removeItem(i)}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                  <span>Subtotal:</span>
                  <span>${form.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                  <span>IVA (16%):</span>
                  <span>${form.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                  <span>Total:</span>
                  <span>${form.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
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