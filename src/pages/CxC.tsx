import { useEffect, useState } from "react";
import { api } from "../api";

type Concepto = {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
};

type CxC = {
  _id: string;
  uuid?: string;
  folioFactura?: string;
  fechaEmision?: string;
  rfcEmisor?: string;
  nombreEmisor?: string;
  rfcReceptor?: string;
  nombreReceptor?: string;
  conceptos: Concepto[];
  subtotal: number;
  iva: number;
  total: number;
  moneda?: string;
  estatus?: "pendiente" | "cobrada";
  fechaPago?: string;
  complementoPago?: string;
  comentarios?: string;
  notas?: string;
};

const CLOUDINARY_RAW = "https://api.cloudinary.com/v1_1/dijxgoytw/raw/upload";
const UPLOAD_PRESET  = "pipsa productos";

export default function CuentasCobrar() {
  const rol       = localStorage.getItem("rol") ?? "";
  const canDelete = ["developer", "gerencia"].includes(rol);

  const [cxcs, setCxcs]         = useState<CxC[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal subir XML
  const [modalXml, setModalXml]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [savingF, setSavingF]     = useState(false);
  const [formF, setFormF]         = useState<Partial<CxC>>({});
  const [xmlError, setXmlError]   = useState("");

  // Modal detalle
  const [detalle, setDetalle]     = useState<CxC | null>(null);

  // Modal cobro
  const [modalCobro, setModalCobro]     = useState<CxC | null>(null);
  const [formCobro, setFormCobro]       = useState({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" });
  const [savingCobro, setSavingCobro]   = useState(false);
  const [uploadingComp, setUploadingComp] = useState(false);

  // Modal editar comentarios
  const [modalComent, setModalComent]   = useState<CxC | null>(null);
  const [comentarioEdit, setComentEdit] = useState("");
  const [savingComent, setSavingComent] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/cxc");
      setCxcs(data);
    } catch {}
    finally { setLoading(false); }
  }

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtCorto(date?: string) {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`;
  }

  const hayFiltros = filtroEstatus !== "todos" || fechaDesde !== "" || fechaHasta !== "";

  // ── XML Parser ─────────────────────────────────────────────────────────────
  function parseXML(file: File) {
    setParsing(true);
    setXmlError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const ns  = "http://www.sat.gob.mx/cfd/4";
        const ns3 = "http://www.sat.gob.mx/cfd/3";
        const cfdi = doc.querySelector("Comprobante") ??
                     doc.getElementsByTagNameNS(ns,  "Comprobante")[0] ??
                     doc.getElementsByTagNameNS(ns3, "Comprobante")[0];
        if (!cfdi) throw new Error("No se encontró el nodo Comprobante en el XML");
        const getAttr = (node: Element | null | undefined, attr: string) => node?.getAttribute(attr) ?? "";
        const emisor   = cfdi.querySelector("Emisor")   ?? cfdi.getElementsByTagName("Emisor")[0];
        const receptor = cfdi.querySelector("Receptor") ?? cfdi.getElementsByTagName("Receptor")[0];
        const timbre   = cfdi.querySelector("TimbreFiscalDigital") ?? cfdi.getElementsByTagName("TimbreFiscalDigital")[0];
        const conceptosNodes = Array.from(
          cfdi.querySelectorAll("Concepto").length > 0
            ? cfdi.querySelectorAll("Concepto")
            : cfdi.getElementsByTagName("Concepto")
        );
        const conceptos: Concepto[] = conceptosNodes.map(c => ({
          descripcion:   getAttr(c, "Descripcion")   || getAttr(c, "descripcion"),
          cantidad:      parseFloat(getAttr(c, "Cantidad")      || "1"),
          valorUnitario: parseFloat(getAttr(c, "ValorUnitario") || "0"),
          importe:       parseFloat(getAttr(c, "Importe")       || "0"),
        }));
        let iva = 0;
        const traslados = Array.from(
          cfdi.querySelectorAll("Traslado").length > 0
            ? cfdi.querySelectorAll("Traslado")
            : cfdi.getElementsByTagName("Traslado")
        );
        traslados.forEach(t => {
          const imp = parseFloat(getAttr(t, "Importe") || "0");
          if (!isNaN(imp)) iva += imp;
        });
        setFormF({
          uuid:           getAttr(timbre, "UUID")     || getAttr(timbre, "uuid"),
          folioFactura:   getAttr(cfdi, "Folio")      || getAttr(cfdi, "folio") || "",
          fechaEmision:   getAttr(cfdi, "Fecha")      || getAttr(cfdi, "fecha"),
          rfcEmisor:      getAttr(emisor,   "Rfc")    || getAttr(emisor,   "rfc"),
          nombreEmisor:   getAttr(emisor,   "Nombre") || getAttr(emisor,   "nombre"),
          rfcReceptor:    getAttr(receptor, "Rfc")    || getAttr(receptor, "rfc"),
          nombreReceptor: getAttr(receptor, "Nombre") || getAttr(receptor, "nombre"),
          subtotal:  parseFloat(getAttr(cfdi, "SubTotal") || "0"),
          iva:       iva || parseFloat(getAttr(cfdi, "Iva") || "0"),
          total:     parseFloat(getAttr(cfdi, "Total") || "0"),
          moneda:    getAttr(cfdi, "Moneda") || "MXN",
          conceptos,
        });
        setParsing(false);
      } catch (err: any) {
        setXmlError(err.message ?? "Error al leer el XML");
        setParsing(false);
      }
    };
    reader.onerror = () => { setXmlError("No se pudo leer el archivo"); setParsing(false); };
    reader.readAsText(file, "UTF-8");
  }

  async function saveCxc() {
    if (!formF.nombreReceptor && !formF.rfcReceptor) return;
    setSavingF(true);
    try {
      const { data } = await api.post("/cxc", formF);
      setCxcs(prev => [data, ...prev]);
      setModalXml(false);
      setFormF({});
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingF(false); }
  }

  async function deleteCxc(id: string) {
    if (!confirm("¿Eliminar esta cuenta por cobrar?")) return;
    await api.delete(`/cxc/${id}`);
    setCxcs(prev => prev.filter(c => c._id !== id));
  }

  // ── Subir archivo ──────────────────────────────────────────────────────────
  async function subirArchivo(file: File): Promise<string> {
    setUploadingComp(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res  = await fetch(CLOUDINARY_RAW, { method: "POST", body: fd });
    const data = await res.json();
    setUploadingComp(false);
    return data.secure_url;
  }

  // ── Cobro ──────────────────────────────────────────────────────────────────
  async function registrarCobro() {
    if (!modalCobro) return;
    setSavingCobro(true);
    try {
      const { data } = await api.post(`/cxc/${modalCobro._id}/cobrar`, formCobro);
      setCxcs(prev => prev.map(c => c._id === modalCobro._id ? { ...c, ...data } : c));
      setModalCobro(null);
      setFormCobro({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" });
    } catch {}
    finally { setSavingCobro(false); }
  }

  // ── Editar comentarios ─────────────────────────────────────────────────────
  async function guardarComentario() {
    if (!modalComent) return;
    setSavingComent(true);
    try {
      const { data } = await api.put(`/cxc/${modalComent._id}`, { comentarios: comentarioEdit });
      setCxcs(prev => prev.map(c => c._id === modalComent._id ? { ...c, comentarios: data.comentarios } : c));
      setModalComent(null);
    } catch {}
    finally { setSavingComent(false); }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtered = cxcs.filter(c => {
    const matchSearch =
      (c.nombreReceptor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.folioFactura   ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.rfcReceptor    ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.conceptos.some(co => co.descripcion.toLowerCase().includes(search.toLowerCase()));
    const matchEstatus = filtroEstatus === "todos" || c.estatus === filtroEstatus;
    const fecha = c.fechaEmision ? new Date(c.fechaEmision) : null;
    const matchDesde = !fechaDesde || (fecha && fecha >= new Date(fechaDesde));
    const matchHasta = !fechaHasta || (fecha && fecha <= new Date(fechaHasta + "T23:59:59"));
    return matchSearch && matchEstatus && matchDesde && matchHasta;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPendiente = cxcs.filter(c => c.estatus !== "cobrada").reduce((a, c) => a + c.total, 0);
  const totalCobrado   = cxcs.filter(c => c.estatus === "cobrada").reduce((a, c) => a + c.total, 0);

  // ── Reporte ────────────────────────────────────────────────────────────────
  function abrirReporte() {
    const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
    let acum = 0;
    const rows = [...filtered]
      .sort((a, b) => new Date(a.fechaEmision ?? 0).getTime() - new Date(b.fechaEmision ?? 0).getTime())
      .map(c => {
        if (c.estatus !== "cobrada") acum += c.total;
        return `<tr>
          <td>${c.nombreReceptor ?? "—"}</td>
          <td>${c.folioFactura ?? "—"}</td>
          <td style="text-align:right">$${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
          <td>${fmtCorto(c.fechaEmision)}</td>
          <td>${c.conceptos[0]?.descripcion?.slice(0,40) ?? "—"}</td>
          <td>${fmtCorto(c.fechaPago)}</td>
          <td style="text-align:center">${c.complementoPago ? '<a href="'+c.complementoPago+'">Ver</a>' : "—"}</td>
          <td style="text-align:right;color:${c.estatus === "cobrada" ? "#16a34a" : "#dc2626"}">${c.estatus === "cobrada" ? "$0.00" : "$"+c.total.toLocaleString("es-MX",{minimumFractionDigits:2})}</td>
          <td>${c.comentarios ?? "—"}</td>
        </tr>`;
      }).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Cuentas por Cobrar</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:20px; }
  .header { display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px; }
  .logo { width:55px;height:55px;object-fit:contain;background:#000;border-radius:6px; }
  h1 { font-size:13pt;font-weight:900; }
  p { font-size:8.5pt;color:#555; }
  table { width:100%;border-collapse:collapse;font-size:8.5pt; }
  thead { background:#222;color:#fff; }
  thead th { padding:5px 7px;text-align:left; }
  tbody tr:nth-child(even) { background:#f5f5f5; }
  td { padding:4px 7px;border-bottom:1px solid #ddd; }
  .totales { margin-top:12px;text-align:right;font-size:9.5pt; }
  @media print { body { padding:10px; } }
</style></head><body>
<div class="header">
  <img src="${logoUrl}" class="logo" alt="Pipsa" />
  <div>
    <h1>Cuentas por Cobrar</h1>
    <p>Equipos Industriales y Montacargas de Guadalajara S de RL de CV</p>
    <p>Generado el ${new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}</p>
  </div>
</div>
<table>
  <thead><tr>
    <th>Cliente</th><th>No. Factura</th><th style="text-align:right">Importe</th><th>Fecha factura</th>
    <th>Concepto</th><th>Fecha pago</th><th>Complemento</th><th style="text-align:right">Pendiente</th><th>Comentarios</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totales">
  <div>Total pendiente: <strong style="color:#dc2626">$${totalPendiente.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong></div>
  <div>Total cobrado: <strong style="color:#16a34a">$${totalCobrado.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong></div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);window.onafterprint=function(){window.close();};};</script>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas por Cobrar</h1>
          <p className="page-subtitle">{cxcs.length} facturas · {cxcs.filter(c => c.estatus !== "cobrada").length} pendientes</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={abrirReporte}>🖨️ Reporte</button>
          <button className="btn btn-primary" onClick={() => { setFormF({}); setXmlError(""); setModalXml(true); }}>+ Subir XML</button>
        </div>
      </div>

      <div className="page-content">

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat-card">
            <span className="stat-card-icon">📄</span>
            <p className="stat-card-value">{cxcs.length}</p>
            <p className="stat-card-label">Total facturas</p>
            <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">⏳</span>
            <p className="stat-card-value" style={{ color: "var(--red)", fontSize: "1.3rem" }}>
              ${totalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
            <p className="stat-card-label">Por cobrar</p>
            <div className="stat-card-accent" style={{ background: "var(--red)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">✅</span>
            <p className="stat-card-value" style={{ color: "var(--green)", fontSize: "1.3rem" }}>
              ${totalCobrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
            <p className="stat-card-label">Cobrado</p>
            <div className="stat-card-accent" style={{ background: "var(--green)" }} />
          </div>
        </div>

        {/* Tabla */}
        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Todas las cuentas por cobrar</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
                <option value="todos">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="cobrada">Cobradas</option>
              </select>
              <input className="form-input" type="date" value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)} style={{ width: "auto" }} title="Desde" />
              <input className="form-input" type="date" value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)} style={{ width: "auto" }} title="Hasta" />
              {hayFiltros && (
                <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroEstatus("todos"); setFechaDesde(""); setFechaHasta(""); }}>✕ Limpiar</button>
              )}
            </div>
          </div>

          {hayFiltros && (
            <div style={{ padding: "8px 20px", background: "rgba(245,158,11,0.08)", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--accent)" }}>
              🔍 Mostrando {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              {filtered.length > 0 && (
                <span style={{ marginLeft: 12, fontWeight: 700 }}>
                  Total: ${filtered.reduce((a, c) => a + c.total, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">💰</span><p>Sin cuentas por cobrar{search || hayFiltros ? " con ese filtro" : ""}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>No. Factura</th>
                  <th>Importe</th>
                  <th>Fecha factura</th>
                  <th>Concepto</th>
                  <th>Fecha pago</th>
                  <th>Complemento</th>
                  <th>Pendiente</th>
                  <th>Comentarios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.nombreReceptor ?? "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{c.folioFactura ?? "—"}</td>
                    <td style={{ fontWeight: 700 }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td>{fmt(c.fechaEmision)}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 160 }}>
                      {c.conceptos[0]?.descripcion?.slice(0, 45) ?? "—"}
                      {(c.conceptos[0]?.descripcion?.length ?? 0) > 45 ? "..." : ""}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{fmt(c.fechaPago)}</td>
                    <td>
                      {c.complementoPago
                        ? <a href={c.complementoPago} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "var(--blue)" }}>Ver 📎</a>
                        : <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>—</span>}
                    </td>
                    <td>
                      {c.estatus === "cobrada"
                        ? <span style={{ color: "var(--green)", fontWeight: 600, fontSize: "0.82rem" }}>$0.00</span>
                        : <span style={{ color: "var(--red)", fontWeight: 700 }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 140 }}>
                      {c.comentarios
                        ? <span title={c.comentarios}>{c.comentarios.slice(0, 30)}{c.comentarios.length > 30 ? "..." : ""}</span>
                        : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(c)}>👁️</button>
                        <button className="btn btn-secondary btn-sm" title="Comentarios"
                          onClick={() => { setModalComent(c); setComentEdit(c.comentarios ?? ""); }}>💬</button>
                        {c.estatus !== "cobrada" && (
                          <button className="btn btn-secondary btn-sm" style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                            onClick={() => { setModalCobro(c); setFormCobro({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" }); }}>
                            💳
                          </button>
                        )}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => deleteCxc(c._id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal subir XML ── */}
      {modalXml && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalXml(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModalXml(false)}>✕</button>
            <h2 className="modal-title">Subir factura XML</h2>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed var(--border2)", borderRadius: "var(--radius)", padding: "28px 20px",
              cursor: "pointer", background: "var(--surface2)", gap: 8,
            }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseXML(f); }}
            >
              <span style={{ fontSize: "2.5rem" }}>{parsing ? "⏳" : "📂"}</span>
              <p style={{ fontWeight: 600, color: "var(--text)" }}>{parsing ? "Leyendo XML..." : "Arrastra o selecciona tu XML del SAT"}</p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>CFDI 3.3 o 4.0</p>
              <input type="file" accept=".xml" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) parseXML(f); }} />
            </label>
            {xmlError && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>⚠ {xmlError}</p>}

            {formF.nombreReceptor && !parsing && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>✅ Datos extraídos</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: "0.85rem" }}>
                  {[
                    { label: "Cliente (receptor)", val: formF.nombreReceptor },
                    { label: "RFC receptor",       val: formF.rfcReceptor },
                    { label: "Emisor",             val: formF.nombreEmisor },
                    { label: "No. Factura",        val: formF.folioFactura || "(sin folio en XML)" },
                    { label: "Fecha",              val: formF.fechaEmision ? new Date(formF.fechaEmision).toLocaleDateString("es-MX") : "" },
                    { label: "UUID",               val: (formF.uuid ?? "").slice(0, 20) + "..." },
                    { label: "Subtotal",           val: `$${(formF.subtotal ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "IVA",                val: `$${(formF.iva     ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "Total",              val: `$${(formF.total   ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "Conceptos",          val: `${formF.conceptos?.length ?? 0} concepto(s)` },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</p>
                      <p style={{ color: "var(--text)", fontWeight: 500 }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">No. de factura (editable)</label>
                  <input className="form-input" value={formF.folioFactura ?? ""}
                    onChange={e => setFormF(p => ({ ...p, folioFactura: e.target.value }))}
                    placeholder="Ej. M-8117" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notas (opcional)</label>
                  <input className="form-input" value={formF.notas ?? ""}
                    onChange={e => setFormF(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Ej. Factura renta enero" />
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalXml(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveCxc} disabled={savingF || !formF.nombreReceptor || parsing}>
                {savingF ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h2 className="modal-title">{detalle.nombreReceptor ?? "Factura"}</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>UUID: {detalle.uuid ?? "—"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 8 }}>
              {[
                { label: "No. Factura",    val: detalle.folioFactura },
                { label: "Fecha emisión",  val: fmt(detalle.fechaEmision) },
                { label: "Emisor",         val: detalle.nombreEmisor },
                { label: "RFC Emisor",     val: detalle.rfcEmisor },
                { label: "RFC Receptor",   val: detalle.rfcReceptor },
                { label: "Estatus",        val: detalle.estatus === "cobrada" ? "✅ Cobrada" : "⏳ Pendiente" },
                { label: "Fecha pago",     val: detalle.fechaPago ? fmt(detalle.fechaPago) : null },
                { label: "Comentarios",    val: detalle.comentarios },
                { label: "Notas",          val: detalle.notas },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 500, marginTop: 2 }}>{item.val}</p>
                </div>
              ) : null)}
            </div>
            {detalle.complementoPago && (
              <a href={detalle.complementoPago} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: "0.82rem", color: "var(--blue)" }}>
                📎 Ver complemento de pago
              </a>
            )}
            {detalle.conceptos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Conceptos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detalle.conceptos.map((c, i) => (
                    <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text)", fontWeight: 500 }}>{c.descripcion}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{c.cantidad} × ${c.valorUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <p style={{ fontWeight: 700, whiteSpace: "nowrap" }}>${c.importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                <span>Subtotal:</span><span>${detalle.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                <span>IVA:</span><span>${detalle.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--green)" }}>
                <span>Total:</span><span>${detalle.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              {detalle.estatus !== "cobrada" && (
                <button className="btn btn-primary" style={{ background: "var(--green)", color: "#fff" }}
                  onClick={() => { setDetalle(null); setModalCobro(detalle); setFormCobro({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" }); }}>
                  💳 Registrar cobro
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal registrar cobro ── */}
      {modalCobro && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCobro(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={() => setModalCobro(null)}>✕</button>
            <h2 className="modal-title">Registrar cobro</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {modalCobro.nombreReceptor} — {modalCobro.folioFactura ?? "—"} —{" "}
              <strong style={{ color: "var(--green)" }}>${modalCobro.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
            </p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-group span-2">
                <label className="form-label">Fecha de cobro *</label>
                <input className="form-input" type="date" value={formCobro.fechaPago}
                  onChange={e => setFormCobro(p => ({ ...p, fechaPago: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Complemento de pago (XML / PDF)</label>
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)",
                  cursor: "pointer", background: "var(--surface2)",
                }}>
                  <span style={{ fontSize: "1.3rem" }}>{uploadingComp ? "⏳" : "📎"}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {formCobro.complementoPago ? "✅ Archivo subido" : uploadingComp ? "Subiendo..." : "Seleccionar archivo"}
                  </span>
                  <input type="file" accept=".xml,.pdf,image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const url = await subirArchivo(f);
                        setFormCobro(p => ({ ...p, complementoPago: url }));
                      }
                    }} />
                </label>
                {formCobro.complementoPago && (
                  <a href={formCobro.complementoPago} target="_blank" rel="noreferrer"
                    style={{ fontSize: "0.78rem", color: "var(--blue)", marginTop: 4, display: "block" }}>
                    Ver archivo subido
                  </a>
                )}
              </div>
              <div className="form-group span-2">
                <label className="form-label">Comentarios (opcional)</label>
                <textarea className="form-textarea" rows={2} value={formCobro.comentarios}
                  onChange={e => setFormCobro(p => ({ ...p, comentarios: e.target.value }))}
                  placeholder="Ej. Pagó con transferencia SPEI" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalCobro(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarCobro}
                disabled={savingCobro || uploadingComp}
                style={{ background: "var(--green)", color: "#fff" }}>
                {savingCobro ? "Registrando..." : "✅ Confirmar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal comentarios ── */}
      {modalComent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalComent(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <button className="modal-close" onClick={() => setModalComent(null)}>✕</button>
            <h2 className="modal-title">Comentarios</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>
              {modalComent.nombreReceptor} — {modalComent.folioFactura ?? "—"}
            </p>
            <div className="form-group">
              <label className="form-label">Comentario</label>
              <textarea className="form-textarea" rows={4} value={comentarioEdit}
                onChange={e => setComentEdit(e.target.value)}
                placeholder="Escribe un comentario sobre esta cuenta..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalComent(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarComentario} disabled={savingComent}>
                {savingComent ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}