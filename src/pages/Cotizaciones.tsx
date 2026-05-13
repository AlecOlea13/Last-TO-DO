import { useEffect, useState } from "react";
import { api } from "../api";

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
                        <button className="btn btn-primary btn-sm" onClick={() => generarReporte(c)}>📄 PDF</button>
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
function generarReporte(cot: Cotizacion) {
  const fecha = new Date(cot.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoBase64 = "data:image/jpeg;base64,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";

  const itemsHtml = cot.items.map(item => `
    <tr>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd">${item.cantidad}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${item.descripcion}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${cot.folio}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; max-width: 820px; margin: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #222; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo { width: 70px; height: 70px; object-fit: contain; background: #000; border-radius: 6px; }
    .company-name { font-size: 12pt; font-weight: bold; max-width: 340px; line-height: 1.3; }
    .client-block { text-align: right; font-size: 10pt; line-height: 1.7; }
    .subject { background: #f5f5f5; padding: 10px 14px; margin: 14px 0; font-weight: bold; border-left: 4px solid #222; font-size: 10pt; }
    .intro { margin-bottom: 10px; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
    thead { background: #222; color: white; }
    thead th { padding: 8px; text-align: left; }
    thead th:first-child { text-align: center; width: 60px; }
    thead th:last-child, thead th:nth-child(3) { text-align: right; width: 110px; }
    .totals { margin-top: 8px; text-align: right; font-size: 10pt; }
    .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }
    .grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }
    .conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }
    .conditions strong { color: #222; }
    .signature { margin-top: 28px; text-align: center; font-size: 10pt; }
    .signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }
    .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #666; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img src="${logoBase64}" class="logo" alt="Pipsa Logo" />
      <div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>
    </div>
    <div class="client-block">
      <strong>${cot.lugar}; ${fecha}.</strong><br>
      ${cot.cliente?.nombre ?? ""}.<br>
      ${cot.montacargas ? `${cot.montacargas.marca} ${cot.montacargas.modelo}.` : ""}
    </div>
  </div>

  ${cot.descripcionServicio ? `<div class="subject">${cot.descripcionServicio}</div>` : ""}

  <p class="intro">Por medio de la presente, nos permitimos presentar la siguiente ${cot.tipo === "servicio" ? "propuesta" : "información"}:</p>

  <table>
    <thead>
      <tr>
        <th>CANTIDAD</th>
        <th>DESCRIPCIÓN</th>
        <th>PRECIO U.</th>
        <th>TOTAL</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>SUB TOTAL</span><span>$${cot.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row"><span>IVA 16%</span><span>$${cot.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row grand-total"><span>TOTAL</span><span>$${cot.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
  </div>

  <div class="conditions">
    <strong>Condiciones comerciales:</strong><br>
    <strong>Los precios son considerados para su pago pesos M.N. y causan el 16% de IVA.</strong>
    El servicio solo incluye lo señalado en esta cotización. De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.
    Vigencia de la cotización, es de 15 días naturales.
    <strong>Para confirmar el servicio de reparación, se deberán realizar transferencia del 50% del importe de esta cotización.</strong>
    Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados. En partes eléctricas no hay garantía. Las existencias son salvo previa venta.
    <em>En espera de vernos favorecidos con su pedido, quedamos a sus órdenes, para cualquier duda o comentario.</em>
  </div>

  <div class="signature">
    <strong>A T E N T A M E N T E.</strong>
    <div class="name">Juan Pablo Montúfar Cruz.</div>
    Asesor comercial.<br>
    Cel. 33 1322 5453<br>
    juanpablo@pipsamontacargas.com
  </div>

  <div class="footer">
    Bahías de Huatulco No. 99-A, Col. Agua blanca industrial, 45602, Zapopán, Jal. &nbsp;|&nbsp; www.pipsamontacargas.com
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 500);
      window.onafterprint = () => window.close();
    };
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}