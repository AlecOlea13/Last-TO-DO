import { useEffect, useState } from "react";
import { api } from "../api";
import { generarReporte } from "../utils/generarReporte";

type Item = { cantidad: number; descripcion: string; precioUnitario: number; total: number };
type Cotizacion = {
  _id: string;
  folio: string;
  tipo: "servicio" | "renta" | "venta";
  cliente?: { _id: string; nombre: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo: string };
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

type Cliente    = { _id: string; nombre: string };
type Montacargas = { _id: string; numeroEconomico: string; marca: string; modelo: string };

const emptyForm: any = {
  folio: "", tipo: "servicio", cliente: "", montacargas: "",
  fecha: new Date().toISOString().split("T")[0], lugar: "Zapopán, Jal",
  descripcionServicio: "", items: [], subtotal: 0, iva: 0, total: 0,
  estatus: "borrador", notas: "",
};

const emptyItem: Item = { cantidad: 1, descripcion: "", precioUnitario: 0, total: 0 };

// const ESTATUS_BADGE: Record<string, string> = {
//   borrador: "badge-gray", enviada: "badge-blue",
//   aceptada: "badge-green", rechazada: "badge-red",
// };

const TIPO_BADGE: Record<string, string> = {
  servicio: "badge-amber", renta: "badge-blue", venta: "badge-green",
};

// const CONDICIONES_DEFAULT = `Los precios son considerados para su pago en pesos M.N. y causan el 16% de IVA.
// El servicio solo incluye lo señalado en esta cotización.
// De presentar alguna falla adicional o requerir alguna refacción adicional, se cotizará por aparte.
// Vigencia de la cotización: 15 días naturales.
// Por ningún motivo se cancelarán los pedidos u órdenes de compra presentados.
// En partes eléctricas no hay garantía.
// Las existencias son salvo previa venta.`;

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [montas, setMontas]             = useState<Montacargas[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filtro, setFiltro]             = useState("todos");
  const [modal, setModal]               = useState(false);
  const [form, setForm]                 = useState<any>(emptyForm);
  const [saving, setSaving]             = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [co, cl, mo] = await Promise.all([
        api.get("/cotizaciones"), api.get("/clientes"), api.get("/montacargas"),
      ]);
      setCotizaciones(co.data);
      setClientes(cl.data.filter((c: any) => c.estatus === "activo"));
      setMontas(mo.data);
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
      (c.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
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
        {/* Stats */}
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
                  <th>Equipo</th>
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
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {c.montacargas ? `${c.montacargas.numeroEconomico} ${c.montacargas.marca}` : "—"}
                    </td>
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
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {<button className="btn btn-primary btn-sm" onClick={() => generarReporte(c)}>📄 PDF</button>}
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

      {/* Modal nueva cotización */}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 120px 120px 32px", gap: 8 }}>
                  {["Cant.", "Descripción", "Precio U.", "Total", ""].map(h => (
                    <p key={h} style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{h}</p>
                  ))}
                </div>
                {form.items.map((item: Item, i: number) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 120px 120px 32px", gap: 8, alignItems: "center" }}>
                    <input className="form-input" type="number" value={item.cantidad} onChange={e => updateItem(i, "cantidad", +e.target.value)} style={{ padding: "8px" }} />
                    <input className="form-input" value={item.descripcion} onChange={e => updateItem(i, "descripcion", e.target.value)} placeholder="Descripción del concepto" />
                    <input className="form-input" type="number" value={item.precioUnitario} onChange={e => updateItem(i, "precioUnitario", +e.target.value)} style={{ padding: "8px" }} />
                    <input className="form-input" value={`$${item.total.toLocaleString()}`} readOnly style={{ padding: "8px", color: "var(--text-muted)" }} />
                    <button className="btn btn-danger btn-icon" onClick={() => removeItem(i)}>✕</button>
                  </div>
                ))}
              </div>

              {/* Totales */}
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

// Generador de reporte PDF en nueva ventana
// function generarReporte(cot: Cotizacion) {
//   const fecha = new Date(cot.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
//   const logoUrl = "/Pipsa_logo_png.png";
//     <tr>
//       <td style="text-align:center;padding:6px 8px;border:1px solid #ddd">${item.cantidad}</td>
//       <td style="padding:6px 8px;border:1px solid #ddd">${item.descripcion}</td>
//       <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
//       <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
//     </tr>
//   `).join("");

//   const html = `<!DOCTYPE html>
// <html lang="es">
// <head>
//   <meta charset="UTF-8">
//   <title>${cot.folio}</title>
//   <style>
//     * { margin: 0; padding: 0; box-sizing: border-box; }
//     body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; max-width: 820px; margin: auto; }
//     .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #222; }
//     .header-left { display: flex; align-items: center; gap: 14px; }
//     .logo { width: 70px; height: 70px; object-fit: contain; background: #000; border-radius: 6px; }
//     .company-name { font-size: 12pt; font-weight: bold; max-width: 340px; line-height: 1.3; }
//     .client-block { text-align: right; font-size: 10pt; line-height: 1.7; }
//     .subject { background: #f5f5f5; padding: 10px 14px; margin: 14px 0; font-weight: bold; border-left: 4px solid #222; font-size: 10pt; }
//     .intro { margin-bottom: 10px; font-size: 10pt; }
//     table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
//     thead { background: #222; color: white; }
//     thead th { padding: 8px; text-align: left; }
//     thead th:first-child { text-align: center; width: 60px; }
//     thead th:last-child, thead th:nth-child(3) { text-align: right; width: 110px; }
//     .totals { margin-top: 8px; text-align: right; font-size: 10pt; }
//     .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }
//     .grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }
//     .conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }
//     .conditions strong { color: #222; }
//     .signature { margin-top: 28px; text-align: center; font-size: 10pt; }
//     .signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }
//     .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #666; text-align: center; }
//     @media print { body { padding: 16px; } }
//   </style>
// </head>
// <body>
//   <div class="header">
//     <div class="header-left">
//       <img src="${{logoUrl}" class="logo" alt="Pipsa Logo" />
//       <div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>
//     </div>
//     <div class="client-block">
//       <strong>${cot.lugar}; ${fecha}.</strong><br>
//       ${cot.cliente?.nombre ?? ""}.<br>
//       ${cot.montacargas ? `${cot.montacargas.marca} ${cot.montacargas.modelo}.` : ""}
//     </div>
//   </div>

//   ${cot.descripcionServicio ? `<div class="subject">${cot.descripcionServicio}</div>` : ""}

//   <p class="intro">Por medio de la presente, nos permitimos presentar la siguiente ${cot.tipo === "servicio" ? "propuesta" : "información"}:</p>

//   <table>
//     <thead>
//       <tr>
//         <th>CANTIDAD</th>
//         <th>DESCRIPCIÓN</th>
//         <th>PRECIO U.</th>
//         <th>TOTAL</th>
//       </tr>
//     </thead>
//     <tbody>${itemsHtml}</tbody>
//   </table>

//   <div class="totals">
//     <div class="total-row"><span>SUB TOTAL</span><span>$${cot.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
//     <div class="total-row"><span>IVA 16%</span><span>$${cot.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
//     <div class="total-row grand-total"><span>TOTAL</span><span>$${cot.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
//   </div>

//   <div class="conditions">
//     <strong>Condiciones comerciales:</strong><br>
//     <strong>Los precios son considerados para su pago pesos M.N. y causan el 16% de IVA.</strong>
//     El servicio solo incluye lo señalado en esta cotización. De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.
//     Vigencia de la cotización, es de 15 días naturales.
//     <strong>Para confirmar el servicio de reparación, se deberán realizar transferencia del 50% del importe de esta cotización.</strong>
//     Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados. En partes eléctricas no hay garantía. Las existencias son salvo previa venta.
//     <em>En espera de vernos favorecidos con su pedido, quedamos a sus órdenes, para cualquier duda o comentario.</em>
//   </div>

//   <div class="signature">
//     <strong>A T E N T A M E N T E.</strong>
//     <div class="name">Juan Pablo Montúfar Cruz.</div>
//     Asesor comercial.<br>
//     Cel. 33 1322 5453<br>
//     juanpablo@pipsamontacargas.com
//   </div>

//   <div class="footer">
//     Bahías de Huatulco No. 99-A, Col. Agua blanca industrial, 45602, Zapopán, Jal. &nbsp;|&nbsp; www.pipsamontacargas.com
//   </div>

//   <script>
//     window.onload = () => {
//       setTimeout(() => window.print(), 500);
//       window.onafterprint = () => window.close();
//     };
//   </script>
// </body>
// </html>`;

//   const blob = new Blob([html], { type: "text/html" });
//   const url  = URL.createObjectURL(blob);
//   const win  = window.open(url, "_blank");
//   if (win) win.focus();
//   setTimeout(() => URL.revokeObjectURL(url), 10000);
// }