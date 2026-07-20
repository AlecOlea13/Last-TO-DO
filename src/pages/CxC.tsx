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

type PagoRep = { uuid: string; montoPagado: number };
type ResultadoRep = {
  uuid: string;
  encontrada: boolean;
  yaEstaba?: boolean;
  folioFactura?: string;
  nombreReceptor?: string;
  total?: number;
};

type RentaDetectada = {
  _id: string;
  cliente?: { _id: string; nombre: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo: string };
  fechaInicio: string;
  fechaFin?: string;
  tipoPeriodo?: string;
  precioMensual: number;
  estatus: string;
};

type RenovacionItem = {
  concepto: string;
  numeroEconomico: string;
  precioConcepto: number;
  fechaFin: string;
  renta: RentaDetectada | null;
  incluir: boolean;
};

const CLOUDINARY_RAW = "https://api.cloudinary.com/v1_1/dijxgoytw/raw/upload";
const UPLOAD_PRESET  = "pipsa productos";
const POR_PAGINA     = 70;

export default function CuentasCobrar() {
  const rol          = localStorage.getItem("rol") ?? "";
  const canDelete    = ["developer", "gerencia"].includes(rol);
  const canVerTotales = ["developer", "gerencia"].includes(rol);

  const [cxcs, setCxcs]         = useState<CxC[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pagina, setPagina]     = useState(1);

  const [modalXml, setModalXml]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [savingF, setSavingF]     = useState(false);
  const [formF, setFormF]         = useState<Partial<CxC>>({});
  const [xmlError, setXmlError]   = useState("");
  const [detalle, setDetalle]     = useState<CxC | null>(null);

  const [modalCobro, setModalCobro]       = useState<CxC | null>(null);
  const [formCobro, setFormCobro]         = useState({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" });
  const [savingCobro, setSavingCobro]     = useState(false);
  const [uploadingComp, setUploadingComp] = useState(false);

  const [modalComent, setModalComent]   = useState<CxC | null>(null);
  const [comentarioEdit, setComentEdit] = useState("");
  const [savingComent, setSavingComent] = useState(false);

  const [modalRep, setModalRep]         = useState(false);
  const [parsingRep, setParsingRep]     = useState(false);
  const [repError, setRepError]         = useState("");
  const [pagosRep, setPagosRep]         = useState<PagoRep[]>([]);
  const [fechaPagoRep, setFechaPagoRep] = useState(new Date().toISOString().split("T")[0]);
  const [complementoRepUrl, setComplementoRepUrl] = useState("");
  const [uploadingRep, setUploadingRep]   = useState(false);
  const [procesandoRep, setProcesandoRep] = useState(false);
  const [resultadosRep, setResultadosRep] = useState<ResultadoRep[] | null>(null);

  const [seleccionados, setSeleccionados]         = useState<Set<string>>(new Set());
  const [modalCobMultiple, setModalCobMultiple]   = useState(false);
  const [formCobMultiple, setFormCobMultiple]     = useState({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" });
  const [savingCobMultiple, setSavingCobMultiple] = useState(false);
  const [uploadingCobMult, setUploadingCobMult]   = useState(false);

  const [modalRentaDetectada, setModalRentaDetectada] = useState<{
    clienteNombre: string;
    items: RenovacionItem[];
  } | null>(null);
  const [renovacionItems, setRenovacionItems] = useState<RenovacionItem[]>([]);
  const [renovandoDesde, setRenovandoDesde]   = useState(false);

  // ── Modal Reportes ──
  const [modalReportes, setModalReportes] = useState(false);
  const [reportePeriodo, setReportePeriodo] = useState<"semana" | "mes" | "año" | "custom">("mes");
  const [reporteMesDesde, setReporteMesDesde] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reporteMesHasta, setReporteMesHasta] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reporteAnio, setReporteAnio] = useState(() => new Date().getFullYear());
  const [reporteSemana, setReporteSemana] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  });

  useEffect(() => { load(); }, []);
  useEffect(() => { setPagina(1); }, [search, filtroEstatus, fechaDesde, fechaHasta]);

  async function load() {
    try {
      const { data } = await api.get("/cxc");
      setCxcs(data);
    } catch {}
    finally { setLoading(false); }
  }

  function fmt(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtCorto(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return `${day}/${month}/${String(year).slice(2)}`;
  }

  const hayFiltros = filtroEstatus !== "todos" || fechaDesde !== "" || fechaHasta !== "";

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

  function parseRepXML(file: File) {
    setParsingRep(true);
    setRepError("");
    setPagosRep([]);
    setResultadosRep(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const getAttr = (node: Element | null | undefined, attr: string) => node?.getAttribute(attr) ?? "";
        let doctos = Array.from(doc.getElementsByTagName("pago20:DoctoRelacionado"));
        if (doctos.length === 0) doctos = Array.from(doc.getElementsByTagName("pago10:DoctoRelacionado"));
        if (doctos.length === 0) doctos = Array.from(doc.getElementsByTagName("DoctoRelacionado"));
        if (doctos.length === 0) throw new Error("No se encontraron documentos relacionados (DoctoRelacionado) en el XML. ¿Es un Recibo Electrónico de Pago (REP)?");
        const pagos: PagoRep[] = doctos.map(d => ({
          uuid:        getAttr(d, "IdDocumento"),
          montoPagado: parseFloat(getAttr(d, "ImpPagado") || "0"),
        })).filter(p => p.uuid);
        if (pagos.length === 0) throw new Error("No se pudo extraer el UUID de los documentos relacionados.");
        setPagosRep(pagos);
        setParsingRep(false);
      } catch (err: any) {
        setRepError(err.message ?? "Error al leer el XML del recibo de pago");
        setParsingRep(false);
      }
    };
    reader.onerror = () => { setRepError("No se pudo leer el archivo"); setParsingRep(false); };
    reader.readAsText(file, "UTF-8");
  }

  async function subirArchivoRep(file: File): Promise<string> {
    setUploadingRep(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res  = await fetch(CLOUDINARY_RAW, { method: "POST", body: fd });
    const data = await res.json();
    setUploadingRep(false);
    return data.secure_url;
  }

  async function procesarRep() {
    if (!pagosRep.length) return;
    setProcesandoRep(true);
    try {
      const { data } = await api.post("/cxc/cobrar-por-rep", {
        pagos: pagosRep,
        fechaPago: fechaPagoRep,
        complementoPago: complementoRepUrl || null,
      });
      setResultadosRep(data.resultados);
      await load();
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setProcesandoRep(false); }
  }

  function cerrarModalRep() {
    setModalRep(false);
    setPagosRep([]);
    setResultadosRep(null);
    setRepError("");
    setComplementoRepUrl("");
    setFechaPagoRep(new Date().toISOString().split("T")[0]);
  }

  function extraerNumeroEconomico(descripcion: string): string | null {
    const match = descripcion.match(/#(\d+)/);
    return match ? match[1] : null;
  }

  function extraerFechaFinDeConcepto(descripcion: string): string {
    const meses: Record<string, string> = {
      enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
      julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
    };
    const patron = /al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i;
    const match = descripcion.match(patron);
    if (match) {
      const [, dia, mes, anio] = match;
      const mesNum = meses[mes.toLowerCase()];
      if (mesNum) return `${anio}-${mesNum}-${dia.padStart(2, "0")}`;
    }
    return "";
  }

  async function saveCxc() {
    if (!formF.nombreReceptor && !formF.rfcReceptor) return;
    setSavingF(true);
    try {
      const { data } = await api.post("/cxc", formF);
      setCxcs(prev => [data, ...prev]);
      setModalXml(false);
      setFormF({});

      const conceptosRenta = (formF.conceptos ?? []).filter(c => /renta/i.test(c.descripcion));
      if (conceptosRenta.length > 0 && formF.rfcReceptor) {
        try {
          const { data: rentaData } = await api.post("/rentas/buscar-por-rfc", { rfc: formF.rfcReceptor });
          if (rentaData.rentas?.length > 0) {
            const rentas: RentaDetectada[] = rentaData.rentas;
            const items: RenovacionItem[] = conceptosRenta.map(c => {
              const numEco = extraerNumeroEconomico(c.descripcion);
              const fechaFin = extraerFechaFinDeConcepto(c.descripcion);
              const rentaMatch = numEco
                ? rentas.find(r => r.montacargas?.numeroEconomico === numEco) ?? null
                : rentas.length === 1 ? rentas[0] : null;
              return {
                concepto:        c.descripcion,
                numeroEconomico: numEco ?? "—",
                precioConcepto:  c.importe,
                fechaFin,
                renta:           rentaMatch,
                incluir:         !!rentaMatch,
              };
            });
            setRenovacionItems(items);
            setModalRentaDetectada({ clienteNombre: rentaData.clienteNombre, items });
          }
        } catch {}
      }
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingF(false); }
  }

  async function renovarDesdeCxC() {
    const itemsAplicar = renovacionItems.filter(i => i.incluir && i.renta && i.fechaFin);
    if (!itemsAplicar.length) return;
    setRenovandoDesde(true);
    try {
      for (const item of itemsAplicar) {
        await api.post(`/rentas/${item.renta!._id}/renovar`, {
          fechaFinNueva:      item.fechaFin,
          precioMensualNuevo: item.precioConcepto,
          notas:              `Renovación desde factura ${formF.folioFactura ?? ""}`.trim(),
        });
      }
      setModalRentaDetectada(null);
      setRenovacionItems([]);
      alert(`✅ ${itemsAplicar.length} renta${itemsAplicar.length !== 1 ? "s" : ""} renovada${itemsAplicar.length !== 1 ? "s" : ""} correctamente`);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    } finally {
      setRenovandoDesde(false);
    }
  }

  async function deleteCxc(id: string) {
    if (!confirm("¿Eliminar esta cuenta por cobrar?")) return;
    await api.delete(`/cxc/${id}`);
    setCxcs(prev => prev.filter(c => c._id !== id));
  }

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

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    const pendientes = paginados.filter(c => c.estatus !== "cobrada").map(c => c._id);
    const todosMarcados = pendientes.every(id => seleccionados.has(id));
    if (todosMarcados) {
      setSeleccionados(prev => { const next = new Set(prev); pendientes.forEach(id => next.delete(id)); return next; });
    } else {
      setSeleccionados(prev => { const next = new Set(prev); pendientes.forEach(id => next.add(id)); return next; });
    }
  }

  async function ejecutarCobrosMultiples() {
    if (!seleccionados.size) return;
    setSavingCobMultiple(true);
    try {
      await api.post("/cxc/cobrar-multiple", { ids: [...seleccionados], ...formCobMultiple });
      await load();
      setSeleccionados(new Set());
      setModalCobMultiple(false);
      setFormCobMultiple({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" });
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    } finally {
      setSavingCobMultiple(false);
    }
  }

  // ── Reporte ──
  function getLunesDeSemana(semana: number, anio: number): Date {
    const enero1 = new Date(anio, 0, 1);
    const lunes = new Date(enero1);
    lunes.setDate(enero1.getDate() + (semana - 1) * 7 - enero1.getDay() + 1);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  }

  function filtrarPorPeriodo(c: CxC): boolean {
    const dateStr = c.fechaEmision;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (reportePeriodo === "semana") {
      const lunes = getLunesDeSemana(reporteSemana, reporteAnio);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);
      return d >= lunes && d <= domingo;
    }
    if (reportePeriodo === "mes") {
      const [y, m] = reporteMesDesde.split("-").map(Number);
      return d.getFullYear() === y && d.getMonth() === m - 1;
    }
    if (reportePeriodo === "año") return d.getFullYear() === reporteAnio;
    if (reportePeriodo === "custom") {
      if (reporteMesDesde) {
        const [y, m] = reporteMesDesde.split("-").map(Number);
        if (d < new Date(y, m - 1, 1)) return false;
      }
      if (reporteMesHasta) {
        const [y, m] = reporteMesHasta.split("-").map(Number);
        if (d > new Date(y, m, 0, 23, 59, 59)) return false;
      }
      return true;
    }
    return true;
  }

  function labelPeriodo(): string {
    if (reportePeriodo === "semana") {
      const lunes = getLunesDeSemana(reporteSemana, reporteAnio);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      const f = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      return `Semana ${reporteSemana}: ${f(lunes)} – ${f(domingo)} ${reporteAnio}`;
    }
    if (reportePeriodo === "mes") {
      const [y, m] = reporteMesDesde.split("-").map(Number);
      const s = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (reportePeriodo === "año") return `Año ${reporteAnio}`;
    const desde = reporteMesDesde ? new Date(reporteMesDesde + "-01").toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—";
    const hasta = reporteMesHasta ? new Date(reporteMesHasta + "-01").toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—";
    return desde === hasta ? desde : `${desde} — ${hasta}`;
  }

  function generarReporte() {
    const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
    const datos = cxcs.filter(filtrarPorPeriodo);
    const rows = [...datos]
      .sort((a, b) => new Date(a.fechaEmision ?? 0).getTime() - new Date(b.fechaEmision ?? 0).getTime())
      .map(c => `<tr>
        <td>${c.nombreReceptor ?? "—"}</td>
        <td>${c.folioFactura ?? "—"}</td>
        <td style="text-align:right">$${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        <td>${fmtCorto(c.fechaEmision)}</td>
        <td>${c.conceptos[0]?.descripcion?.slice(0,40) ?? "—"}</td>
        <td>${fmtCorto(c.fechaPago)}</td>
        <td style="text-align:center">${c.complementoPago ? '<a href="'+c.complementoPago+'">Ver</a>' : "—"}</td>
        <td style="text-align:right;color:${c.estatus === "cobrada" ? "#16a34a" : "#dc2626"}">${c.estatus === "cobrada" ? "$0.00" : "$"+c.total.toLocaleString("es-MX",{minimumFractionDigits:2})}</td>
        <td>${c.comentarios ?? "—"}</td>
      </tr>`).join("");

    const pendiente = datos.filter(c => c.estatus !== "cobrada").reduce((a, c) => a + c.total, 0);
    const cobrado   = datos.filter(c => c.estatus === "cobrada").reduce((a, c) => a + c.total, 0);
    const subtitulo = labelPeriodo();

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Cuentas por Cobrar — ${subtitulo}</title>
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
  .print-btn { position:fixed;top:16px;right:16px;padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-size:11pt;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15); }
  @media print { .print-btn { display:none; } body { padding:10px; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="header">
  <img src="${logoUrl}" class="logo" alt="Pipsa" />
  <div>
    <h1>Cuentas por Cobrar — ${subtitulo}</h1>
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
  <div>Total pendiente: <strong style="color:#dc2626">$${pendiente.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong></div>
  <div>Total cobrado: <strong style="color:#16a34a">$${cobrado.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong></div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setModalReportes(false);
  }

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

  const totalPaginas = Math.ceil(filtered.length / POR_PAGINA);
  const paginados    = filtered.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const totalPendiente = cxcs.filter(c => c.estatus !== "cobrada").reduce((a, c) => a + c.total, 0);
  const totalCobrado   = cxcs.filter(c => c.estatus === "cobrada").reduce((a, c) => a + c.total, 0);

  function Paginador({ total, pag, set }: { total: number; pag: number; set: (p: number) => void }) {
    if (total <= 1) return null;
    const pages = Array.from({ length: total }, (_, i) => i + 1)
      .filter(p => p === 1 || p === total || Math.abs(p - pag) <= 2)
      .reduce((acc: (number | string)[], p, idx, arr) => {
        if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
        acc.push(p);
        return acc;
      }, []);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
        <span>Mostrando {(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, filtered.length)} de {filtered.length}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => set(1)} disabled={pag === 1}>«</button>
          <button className="btn btn-secondary btn-sm" onClick={() => set(pag - 1)} disabled={pag === 1}>‹</button>
          {pages.map((p, idx) => p === "..." ? (
            <span key={`e${idx}`} style={{ padding: "0 4px" }}>…</span>
          ) : (
            <button key={p} className="btn btn-secondary btn-sm" onClick={() => set(p as number)}
              style={{ minWidth: 32, background: pag === p ? "var(--accent)" : undefined, color: pag === p ? "#000" : undefined, fontWeight: pag === p ? 700 : undefined }}>
              {p}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => set(pag + 1)} disabled={pag === total}>›</button>
          <button className="btn btn-secondary btn-sm" onClick={() => set(total)} disabled={pag === total}>»</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas por Cobrar</h1>
          <p className="page-subtitle">{cxcs.length} facturas · {cxcs.filter(c => c.estatus !== "cobrada").length} pendientes</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {seleccionados.size > 0 && (
            <button className="btn btn-primary" style={{ background: "var(--green)", color: "#fff" }}
              onClick={() => { setFormCobMultiple({ fechaPago: new Date().toISOString().split("T")[0], complementoPago: "", comentarios: "" }); setModalCobMultiple(true); }}>
              💳 Cobrar {seleccionados.size} seleccionada{seleccionados.size !== 1 ? "s" : ""}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setModalReportes(true)}>🖨️ Reporte</button>
          <button className="btn btn-secondary" onClick={() => setModalRep(true)}>📥 Subir recibo de pago</button>
          <button className="btn btn-primary" onClick={() => { setFormF({}); setXmlError(""); setModalXml(true); }}>+ Subir XML</button>
        </div>
      </div>

      <div className="page-content">
        {canVerTotales && (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div className="stat-card">
              <span className="stat-card-icon">📄</span>
              <p className="stat-card-value" style={{ color: "var(--blue)" }}>{cxcs.length}</p>
              <p className="stat-card-label">Total facturas</p>
              <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
            </div>
            <div className="stat-card">
              <span className="stat-card-icon">⏳</span>
              <p className="stat-card-value" style={{ color: "var(--red)" }}>
                ${totalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
              <p className="stat-card-label">Por cobrar</p>
              <div className="stat-card-accent" style={{ background: "var(--red)" }} />
            </div>
            <div className="stat-card">
              <span className="stat-card-icon">✅</span>
              <p className="stat-card-value" style={{ color: "var(--green)" }}>
                ${totalCobrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
              <p className="stat-card-label">Cobrado</p>
              <div className="stat-card-accent" style={{ background: "var(--green)" }} />
            </div>
          </div>
        )}

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
              <span style={{ marginLeft: 12, fontWeight: 700 }}>
                Total: ${filtered.reduce((a, c) => a + c.total, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">💰</span><p>Sin cuentas por cobrar{search || hayFiltros ? " con ese filtro" : ""}</p></div>
          ) : (
            <>
              <table style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input type="checkbox"
                        checked={
                          paginados.filter(c => c.estatus !== "cobrada").length > 0 &&
                          paginados.filter(c => c.estatus !== "cobrada").every(c => seleccionados.has(c._id))
                        }
                        onChange={toggleTodos}
                      />
                    </th>
                    <th style={{ minWidth: 120 }}>Cliente</th>
                    <th style={{ minWidth: 80 }}>No. Factura</th>
                    <th style={{ minWidth: 100 }}>Importe</th>
                    <th style={{ minWidth: 90 }}>Fecha fact.</th>
                    <th style={{ minWidth: 160 }}>Concepto</th>
                    <th style={{ minWidth: 90 }}>Fecha pago</th>
                    <th style={{ minWidth: 80 }}>Compl.</th>
                    <th style={{ minWidth: 100 }}>Pendiente</th>
                    <th style={{ minWidth: 120 }}>Comentarios</th>
                    <th style={{ minWidth: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map(c => (
                    <tr key={c._id}>
                      <td style={{ textAlign: "center" }}>
                        {c.estatus !== "cobrada" && (
                          <input type="checkbox" checked={seleccionados.has(c._id)} onChange={() => toggleSeleccion(c._id)} />
                        )}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: "0.78rem" }}>{c.nombreReceptor ?? "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.folioFactura ?? "—"}</td>
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>{fmt(c.fechaEmision)}</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {c.conceptos[0]?.descripcion?.slice(0, 40) ?? "—"}
                        {(c.conceptos[0]?.descripcion?.length ?? 0) > 40 ? "..." : ""}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>{fmt(c.fechaPago)}</td>
                      <td style={{ textAlign: "center" }}>
                        {c.complementoPago
                          ? <a href={c.complementoPago} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "var(--blue)" }}>📎</a>
                          : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.estatus === "cobrada"
                          ? <span style={{ color: "var(--green)", fontWeight: 600, fontSize: "0.78rem" }}>$0.00</span>
                          : <span style={{ color: "var(--red)", fontWeight: 700, fontSize: "0.78rem" }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {c.comentarios
                          ? <span title={c.comentarios}>{c.comentarios.slice(0, 25)}{c.comentarios.length > 25 ? "..." : ""}</span>
                          : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(c)}>👁️</button>
                          <button className="btn btn-secondary btn-sm"
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
              <Paginador total={totalPaginas} pag={pagina} set={setPagina} />
            </>
          )}
        </div>
      </div>

      {/* ── Modal Reportes ── */}
      {modalReportes && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalReportes(false); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setModalReportes(false)}>✕</button>
            <h2 className="modal-title">🖨️ Generar reporte</h2>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Periodo</label>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["semana","Semana"],["mes","Mes"],["año","Año"],["custom","Rango"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setReportePeriodo(val as any)}
                    style={{ flex: 1, padding: "10px 6px", border: "none", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: reportePeriodo === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: reportePeriodo === val ? "var(--accent)" : "var(--text-muted)", fontWeight: reportePeriodo === val ? 700 : 400, fontSize: "0.78rem" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {reportePeriodo === "semana" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Semana del año</label>
                  <input className="form-input" type="number" min={1} max={53} value={reporteSemana}
                    onChange={e => setReporteSemana(+e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Año</label>
                  <input className="form-input" type="number" min={2020} max={2099} value={reporteAnio}
                    onChange={e => setReporteAnio(+e.target.value)} />
                </div>
              </div>
            )}

            {reportePeriodo === "mes" && (
              <div className="form-group">
                <label className="form-label">Mes y año</label>
                <input className="form-input" type="month" value={reporteMesDesde}
                  onChange={e => setReporteMesDesde(e.target.value)} />
              </div>
            )}

            {reportePeriodo === "año" && (
              <div className="form-group">
                <label className="form-label">Año</label>
                <input className="form-input" type="number" min={2020} max={2099} value={reporteAnio}
                  onChange={e => setReporteAnio(+e.target.value)} />
              </div>
            )}

            {reportePeriodo === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Desde</label>
                  <input className="form-input" type="month" value={reporteMesDesde}
                    onChange={e => setReporteMesDesde(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hasta</label>
                  <input className="form-input" type="month" value={reporteMesHasta}
                    onChange={e => setReporteMesHasta(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--accent)" }}>{labelPeriodo()}</strong>
              <br />
              <span style={{ fontSize: "0.75rem" }}>Se abrirá una pestaña — usa el botón 🖨️ para imprimir o guardar como PDF.</span>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalReportes(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={generarReporte}>📄 Ver reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recibo de pago REP ── */}
      {modalRep && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) cerrarModalRep(); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={cerrarModalRep}>✕</button>
            <h2 className="modal-title">Subir recibo de pago (REP)</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
              Sube el XML del Complemento de Pago del SAT. El sistema buscará automáticamente las facturas relacionadas por su UUID y las marcará como cobradas.
            </p>
            {!resultadosRep && (
              <>
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed var(--border2)", borderRadius: "var(--radius)", padding: "28px 20px", cursor: "pointer", background: "var(--surface2)", gap: 8 }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseRepXML(f); }}>
                  <span style={{ fontSize: "2.5rem" }}>{parsingRep ? "⏳" : "📂"}</span>
                  <p style={{ fontWeight: 600, color: "var(--text)" }}>{parsingRep ? "Leyendo XML..." : "Arrastra o selecciona el XML del recibo de pago"}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Complemento de Pago 1.0 o 2.0</p>
                  <input type="file" accept=".xml" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) parseRepXML(f); }} />
                </label>
                {repError && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: 10 }}>⚠ {repError}</p>}
                {pagosRep.length > 0 && (
                  <div style={{ marginTop: 14, background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: 16, border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
                      ✅ {pagosRep.length} documento{pagosRep.length !== 1 ? "s" : ""} relacionado{pagosRep.length !== 1 ? "s" : ""} encontrado{pagosRep.length !== 1 ? "s" : ""}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                      {pagosRep.map((p, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "6px 10px", background: "var(--surface3)", borderRadius: "var(--radius-sm)" }}>
                          <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{p.uuid.slice(0, 18)}...</span>
                          <span style={{ fontWeight: 700, color: "var(--green)" }}>${p.montoPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="form-grid">
                      <div className="form-group span-2">
                        <label className="form-label">Fecha de pago</label>
                        <input className="form-input" type="date" value={fechaPagoRep} onChange={e => setFechaPagoRep(e.target.value)} />
                      </div>
                      <div className="form-group span-2">
                        <label className="form-label">Adjuntar XML del recibo (opcional)</label>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--surface3)" }}>
                          <span style={{ fontSize: "1.3rem" }}>{uploadingRep ? "⏳" : "📎"}</span>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            {complementoRepUrl ? "✅ Archivo subido" : uploadingRep ? "Subiendo..." : "Seleccionar el mismo XML u otro respaldo"}
                          </span>
                          <input type="file" accept=".xml,.pdf,image/*" style={{ display: "none" }}
                            onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await subirArchivoRep(f); setComplementoRepUrl(url); } }} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {resultadosRep && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>Resultado del procesamiento</p>
                {resultadosRep.map((r, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: !r.encontrada ? "rgba(239,68,68,0.08)" : r.yaEstaba ? "rgba(107,114,128,0.08)" : "rgba(34,197,94,0.08)",
                    border: `1px solid ${!r.encontrada ? "rgba(239,68,68,0.25)" : r.yaEstaba ? "rgba(107,114,128,0.25)" : "rgba(34,197,94,0.25)"}`,
                  }}>
                    <div>
                      {r.encontrada ? (
                        <>
                          <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>{r.nombreReceptor ?? "—"} — {r.folioFactura ?? "Sin folio"}</p>
                          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{r.uuid.slice(0, 24)}...</p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--red)" }}>No se encontró ninguna factura con este UUID</p>
                          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{r.uuid.slice(0, 24)}...</p>
                        </>
                      )}
                    </div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: !r.encontrada ? "var(--red)" : r.yaEstaba ? "var(--text-muted)" : "var(--green)" }}>
                      {!r.encontrada ? "⚠ No encontrada" : r.yaEstaba ? "Ya estaba cobrada" : "✅ Marcada como cobrada"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-footer">
              {!resultadosRep ? (
                <>
                  <button className="btn btn-secondary" onClick={cerrarModalRep}>Cancelar</button>
                  <button className="btn btn-primary" onClick={procesarRep} disabled={procesandoRep || uploadingRep || pagosRep.length === 0}
                    style={{ background: "var(--green)", color: "#fff" }}>
                    {procesandoRep ? "Procesando..." : `✅ Procesar ${pagosRep.length || ""} pago${pagosRep.length !== 1 ? "s" : ""}`}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={cerrarModalRep}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal subir XML ── */}
      {modalXml && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalXml(false); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModalXml(false)}>✕</button>
            <h2 className="modal-title">Subir factura XML</h2>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed var(--border2)", borderRadius: "var(--radius)", padding: "28px 20px", cursor: "pointer", background: "var(--surface2)", gap: 8 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseXML(f); }}>
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
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
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
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalCobro(null); }}>
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
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--surface2)" }}>
                  <span style={{ fontSize: "1.3rem" }}>{uploadingComp ? "⏳" : "📎"}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {formCobro.complementoPago ? "✅ Archivo subido" : uploadingComp ? "Subiendo..." : "Seleccionar archivo"}
                  </span>
                  <input type="file" accept=".xml,.pdf,image/*" style={{ display: "none" }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await subirArchivo(f); setFormCobro(p => ({ ...p, complementoPago: url })); } }} />
                </label>
                {formCobro.complementoPago && (
                  <a href={formCobro.complementoPago} target="_blank" rel="noreferrer"
                    style={{ fontSize: "0.78rem", color: "var(--blue)", marginTop: 4, display: "block" }}>Ver archivo subido</a>
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
              <button className="btn btn-primary" onClick={registrarCobro} disabled={savingCobro || uploadingComp}
                style={{ background: "var(--green)", color: "#fff" }}>
                {savingCobro ? "Registrando..." : "✅ Confirmar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal comentarios ── */}
      {modalComent && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalComent(null); }}>
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

      {/* ── Modal cobro múltiple ── */}
      {modalCobMultiple && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalCobMultiple(false); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <button className="modal-close" onClick={() => setModalCobMultiple(false)}>✕</button>
            <h2 className="modal-title">Cobrar {seleccionados.size} factura{seleccionados.size !== 1 ? "s" : ""}</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 14 }}>
              Se marcarán como cobradas las {seleccionados.size} facturas seleccionadas con la misma fecha y complemento.
            </p>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {cxcs.filter(c => seleccionados.has(c._id)).map(c => (
                <div key={c._id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.82rem" }}>
                  <span style={{ fontWeight: 600 }}>{c.nombreReceptor ?? "—"} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {c.folioFactura ?? "sin folio"}</span></span>
                  <span style={{ fontWeight: 700, color: "var(--green)", whiteSpace: "nowrap" }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
            <div style={{ fontWeight: 700, textAlign: "right", fontSize: "0.9rem", marginBottom: 16, color: "var(--green)" }}>
              Total: ${cxcs.filter(c => seleccionados.has(c._id)).reduce((a, c) => a + c.total, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Fecha de cobro *</label>
                <input className="form-input" type="date" value={formCobMultiple.fechaPago}
                  onChange={e => setFormCobMultiple(p => ({ ...p, fechaPago: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Complemento de pago (opcional)</label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--surface2)" }}>
                  <span style={{ fontSize: "1.3rem" }}>{uploadingCobMult ? "⏳" : "📎"}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {formCobMultiple.complementoPago ? "✅ Archivo subido" : uploadingCobMult ? "Subiendo..." : "Seleccionar archivo"}
                  </span>
                  <input type="file" accept=".xml,.pdf,image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploadingCobMult(true);
                      const fd = new FormData();
                      fd.append("file", f);
                      fd.append("upload_preset", UPLOAD_PRESET);
                      const res  = await fetch(CLOUDINARY_RAW, { method: "POST", body: fd });
                      const data = await res.json();
                      setFormCobMultiple(p => ({ ...p, complementoPago: data.secure_url }));
                      setUploadingCobMult(false);
                    }} />
                </label>
              </div>
              <div className="form-group span-2">
                <label className="form-label">Comentarios (opcional)</label>
                <textarea className="form-textarea" rows={2} value={formCobMultiple.comentarios}
                  onChange={e => setFormCobMultiple(p => ({ ...p, comentarios: e.target.value }))}
                  placeholder="Ej. Pago en bloque transferencia 15 julio" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalCobMultiple(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={ejecutarCobrosMultiples}
                disabled={savingCobMultiple || uploadingCobMult}
                style={{ background: "var(--green)", color: "#fff" }}>
                {savingCobMultiple ? "Procesando..." : `✅ Confirmar ${seleccionados.size} cobro${seleccionados.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal rentas detectadas ── */}
      {modalRentaDetectada && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalRentaDetectada(null); }}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setModalRentaDetectada(null)}>✕</button>
            <h2 className="modal-title">🔄 Renovar rentas detectadas</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Se detectaron <strong style={{ color: "var(--text)" }}>{renovacionItems.length}</strong> concepto{renovacionItems.length !== 1 ? "s" : ""} de renta para <strong style={{ color: "var(--text)" }}>{modalRentaDetectada.clienteNombre}</strong>.
              Revisa y confirma los que quieras renovar.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {renovacionItems.map((item, idx) => (
                <div key={idx} style={{
                  background: item.renta ? "var(--surface2)" : "rgba(239,68,68,0.05)",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${item.renta ? "var(--border)" : "rgba(239,68,68,0.2)"}`,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                      <input type="checkbox" checked={item.incluir && !!item.renta}
                        disabled={!item.renta}
                        onChange={e => {
                          const next = [...renovacionItems];
                          next[idx] = { ...next[idx], incluir: e.target.checked };
                          setRenovacionItems(next);
                        }}
                        style={{ width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }}
                      />
                      <div>
                        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>
                          Equipo #{item.numeroEconomico}
                          {item.renta && (
                            <span style={{ marginLeft: 8, fontSize: "0.72rem", fontWeight: 400, color: "var(--text-muted)" }}>
                              {item.renta.montacargas?.marca} {item.renta.montacargas?.modelo}
                            </span>
                          )}
                        </p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {item.concepto.slice(0, 70)}{item.concepto.length > 70 ? "…" : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {item.renta ? (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 10 }}>✅ Renta encontrada</span>
                      ) : (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 10 }}>⚠ Sin match</span>
                      )}
                    </div>
                  </div>
                  {item.renta && item.incluir && (
                    <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface3)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nueva fecha de fin *</label>
                        <input className="form-input" type="date" value={item.fechaFin}
                          onChange={e => {
                            const next = [...renovacionItems];
                            next[idx] = { ...next[idx], fechaFin: e.target.value };
                            setRenovacionItems(next);
                          }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Precio *</label>
                        <input className="form-input" type="number" value={item.precioConcepto}
                          onChange={e => {
                            const next = [...renovacionItems];
                            next[idx] = { ...next[idx], precioConcepto: +e.target.value };
                            setRenovacionItems(next);
                          }} />
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", gridColumn: "1/-1" }}>
                        Fin anterior: <strong>{item.renta.fechaFin ? new Date(item.renta.fechaFin).toLocaleDateString("es-MX") : "—"}</strong>
                        {" · "}Precio anterior: <strong>${item.renta.precioMensual.toLocaleString()}</strong>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalRentaDetectada(null)}>Omitir</button>
              <button className="btn btn-primary" onClick={renovarDesdeCxC}
                disabled={renovandoDesde || !renovacionItems.some(i => i.incluir && i.renta && i.fechaFin)}
                style={{ background: "var(--blue)", color: "#fff" }}>
                {renovandoDesde
                  ? "Renovando..."
                  : `🔄 Renovar ${renovacionItems.filter(i => i.incluir && i.renta).length} renta${renovacionItems.filter(i => i.incluir && i.renta).length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}