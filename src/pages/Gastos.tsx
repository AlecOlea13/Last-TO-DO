import { useEffect, useState } from "react";
import { api } from "../api";

type Concepto = {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
};

type GastoFiscal = {
  _id: string;
  uuid?: string;
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
  asesor?: { _id: string; nombre: string };
  proveedor?: { _id: string; nombre: string; email?: string };
  notas?: string;
  folioFactura?: string;
  estatus?: "pendiente" | "pagado";
  fechaPago?: string;
  comprobantePago?: string;
  complementoXml?: string;
};

type GastoNoFiscal = {
  _id: string;
  fecha: string;
  asesor?: { _id: string; nombre: string };
  proveedor?: { _id: string; nombre: string; email?: string };
  entrada?: string;
  monto: number;
  descripcion: string;
  notas?: string;
  estatus?: "pendiente" | "pagado";
  fechaPago?: string;
  comprobantePago?: string;
};

type Asesor    = { _id: string; nombre: string };
type Proveedor = { _id: string; nombre: string; email?: string };

const emptyNoFiscal = {
  fecha: new Date().toISOString().split("T")[0],
  asesor: "", proveedor: "", entrada: "", monto: 0, descripcion: "", notas: "",
};

const emptyManual = {
  nombreEmisor: "", rfcEmisor: "", folioFactura: "",
  fechaEmision: new Date().toISOString().split("T")[0],
  total: 0, descripcion: "", asesor: "", notas: "", proveedor: "",
};

const POR_PAGINA = 70;

function urlArchivo(url?: string): string {
  if (!url) return "";
  return url;
}

export default function Gastos() {
  const rol       = localStorage.getItem("rol") ?? "";
  const canDelete = ["developer", "gerencia", "oficina"].includes(rol);

  const [tab, setTab]               = useState<"fiscal" | "nofiscal">("fiscal");
  const [fiscales, setFiscales]     = useState<GastoFiscal[]>([]);
  const [noFiscales, setNoFiscales] = useState<GastoNoFiscal[]>([]);
  const [asesores, setAsesores]     = useState<Asesor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");

  const [filtroEstatus, setFiltroEstatus] = useState<"pendiente" | "pagado" | "todos">("pendiente");
  const [filtroAsesor, setFiltroAsesor]   = useState("todos");
  const [fechaDesde, setFechaDesde]       = useState("");
  const [fechaHasta, setFechaHasta]       = useState("");

  const [modalFiscal, setModalFiscal] = useState(false);
  const [parsing, setParsing]         = useState(false);
  const [savingF, setSavingF]         = useState(false);
  const [formF, setFormF]             = useState<Partial<GastoFiscal>>({});
  const [xmlError, setXmlError]       = useState("");
  const [detalleF, setDetalleF]       = useState<GastoFiscal | null>(null);

  const [modalManual, setModalManual]   = useState(false);
  const [formManual, setFormManual]     = useState<any>(emptyManual);
  const [savingManual, setSavingManual] = useState(false);

  const [editingF, setEditingF]       = useState<GastoFiscal | null>(null);
  const [modalEditF, setModalEditF]   = useState(false);
  const [formEditF, setFormEditF]     = useState<any>({});
  const [savingEditF, setSavingEditF] = useState(false);

  const [modalNF, setModalNF]     = useState(false);
  const [editingNF, setEditingNF] = useState<GastoNoFiscal | null>(null);
  const [formNF, setFormNF]       = useState<any>(emptyNoFiscal);
  const [savingNF, setSavingNF]   = useState(false);

  // Modal pago individual
  const [modalPago, setModalPago]         = useState<{ id: string; tipo: "fiscal" | "nofiscal"; gasto?: GastoFiscal } | null>(null);
  const [formPago, setFormPago]           = useState({ fechaPago: new Date().toISOString().split("T")[0], comprobantePago: "", complementoXml: "" });
  const [savingPago, setSavingPago]       = useState(false);
  const [uploadingPago, setUploadingPago] = useState(false);

  // Pago múltiple
  const [pagoMultipleIds, setPagoMultipleIds] = useState<string[]>([]);
  // const [modalPagoMultiple, setModalPagoMultiple] = useState(false);
  // const [formPagoMultiple, setFormPagoMultiple]   = useState({ fechaPago: new Date().toISOString().split("T")[0], comprobantePago: "", complementoXml: "" });
  // const [savingPagoMultiple, setSavingPagoMultiple] = useState(false);

  const [reemplazandoComp, setReemplazandoComp] = useState(false);

  const [paginaF, setPaginaF]   = useState(1);
  const [paginaNF, setPaginaNF] = useState(1);

  useEffect(() => { load(); }, []);
  useEffect(() => { setPaginaF(1);  }, [search, filtroAsesor, filtroEstatus, fechaDesde, fechaHasta, tab]);
  useEffect(() => { setPaginaNF(1); }, [search, filtroAsesor, filtroEstatus, fechaDesde, fechaHasta, tab]);

  async function load() {
    try {
      const [f, nf, as, pr] = await Promise.all([
        api.get("/gastos"),
        api.get("/gastos-no-fiscales"),
        api.get("/asesores"),
        api.get("/proveedores"),
      ]);
      setFiscales(f.data);
      setNoFiscales(nf.data);
      setAsesores(as.data);
      setProveedores(pr.data.filter((p: any) => p.activo));
    } catch {}
    finally { setLoading(false); }
  }

  function limpiarFiltros() {
    setFiltroAsesor("todos");
    setFiltroEstatus("pendiente");
    setFechaDesde("");
    setFechaHasta("");
    setSearch("");
  }

  function enRango(dateStr?: string, tipo?: "semana" | "mes" | "año") {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    if (tipo === "semana") {
      const lunes = new Date(now);
      lunes.setDate(now.getDate() - now.getDay() + 1);
      lunes.setHours(0,0,0,0);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23,59,59,999);
      return d >= lunes && d <= domingo;
    }
    if (tipo === "mes") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (tipo === "año") return d.getFullYear() === now.getFullYear();
    return false;
  }

  function sumaFiscal(tipo?: "semana" | "mes" | "año") {
    return fiscales.filter(g => tipo ? enRango(g.fechaEmision, tipo) : true).reduce((acc, g) => acc + g.total, 0);
  }
  function sumaNoFiscal(tipo?: "semana" | "mes" | "año") {
    return noFiscales.filter(g => tipo ? enRango(g.fecha, tipo) : true).reduce((acc, g) => acc + g.monto, 0);
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
        const impuestos = cfdi.querySelector("Impuestos") ?? cfdi.getElementsByTagName("Impuestos")[0];
        if (impuestos) {
          const traslados = Array.from(
            impuestos.querySelectorAll("Traslado").length > 0
              ? impuestos.querySelectorAll("Traslado")
              : impuestos.getElementsByTagName("Traslado")
          );
          traslados.forEach(t => {
            const imp = parseFloat(getAttr(t, "Importe") || "0");
            if (!isNaN(imp)) iva += imp;
          });
        }
        const folioFactura = [getAttr(cfdi, "Serie"), getAttr(cfdi, "Folio")]
          .filter(Boolean).join("") || undefined;

        setFormF(prev => ({
          ...prev,
          uuid:           getAttr(timbre, "UUID")    || getAttr(timbre, "uuid"),
          fechaEmision:   getAttr(cfdi, "Fecha")     || getAttr(cfdi, "fecha"),
          rfcEmisor:      getAttr(emisor,   "Rfc")   || getAttr(emisor,   "rfc"),
          nombreEmisor:   getAttr(emisor,   "Nombre")|| getAttr(emisor,   "nombre"),
          rfcReceptor:    getAttr(receptor, "Rfc")   || getAttr(receptor, "rfc"),
          nombreReceptor: getAttr(receptor, "Nombre")|| getAttr(receptor, "nombre"),
          subtotal:  parseFloat(getAttr(cfdi, "SubTotal") || "0"),
          iva:       iva || parseFloat(getAttr(cfdi, "Iva") || "0"),
          total:     parseFloat(getAttr(cfdi, "Total") || "0"),
          moneda:    getAttr(cfdi, "Moneda") || "MXN",
          folioFactura,
          conceptos,
        }));
        setParsing(false);
      } catch (err: any) {
        setXmlError(err.message ?? "Error al leer el XML");
        setParsing(false);
      }
    };
    reader.onerror = () => { setXmlError("No se pudo leer el archivo"); setParsing(false); };
    reader.readAsText(file, "UTF-8");
  }

  async function saveFiscal() {
    if (!formF.nombreEmisor && !formF.rfcEmisor) return;
    setSavingF(true);
    try {
      const payload: any = { ...formF, folioFactura: formF.folioFactura || undefined };
      if (!payload.proveedor) delete payload.proveedor;
      const { data } = await api.post("/gastos", payload);
      setFiscales(prev => [data, ...prev]);
      setModalFiscal(false);
      setFormF({});
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingF(false); }
  }

  async function saveManual() {
    if (!formManual.nombreEmisor || !formManual.total) return;
    setSavingManual(true);
    try {
      const total    = Number(formManual.total);
      const iva      = Math.round(total / 1.16 * 0.16 * 100) / 100;
      const subtotal = Math.round((total - iva) * 100) / 100;
      const payload: any = {
        nombreEmisor:  formManual.nombreEmisor,
        rfcEmisor:     formManual.rfcEmisor  || undefined,
        fechaEmision:  formManual.fechaEmision,
        folioFactura:  formManual.folioFactura || undefined,
        total, subtotal, iva,
        conceptos: [{
          descripcion:   formManual.descripcion || formManual.nombreEmisor,
          cantidad:      1,
          valorUnitario: subtotal,
          importe:       subtotal,
        }],
        notas: formManual.notas || undefined,
      };
      if (formManual.asesor)    payload.asesor    = formManual.asesor;
      if (formManual.proveedor) payload.proveedor = formManual.proveedor;
      const { data } = await api.post("/gastos", payload);
      setFiscales(prev => [data, ...prev]);
      setModalManual(false);
      setFormManual(emptyManual);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingManual(false); }
  }

  function openEditF(g: GastoFiscal) {
    setEditingF(g);
    setFormEditF({
      nombreEmisor: g.nombreEmisor ?? "",
      rfcEmisor:    g.rfcEmisor    ?? "",
      fechaEmision: g.fechaEmision ? g.fechaEmision.split("T")[0] : "",
      total:        g.total,
      descripcion:  g.conceptos[0]?.descripcion ?? "",
      asesor:       g.asesor?._id    ?? "",
      proveedor:    g.proveedor?._id ?? "",
      notas:        g.notas ?? "",
      folioFactura: g.folioFactura ?? "",
    });
    setModalEditF(true);
  }

  async function saveEditF() {
    if (!editingF || !formEditF.nombreEmisor || !formEditF.total) return;
    setSavingEditF(true);
    try {
      const total    = Number(formEditF.total);
      const iva      = Math.round(total / 1.16 * 0.16 * 100) / 100;
      const subtotal = Math.round((total - iva) * 100) / 100;
      const payload: any = {
        nombreEmisor: formEditF.nombreEmisor,
        rfcEmisor:    formEditF.rfcEmisor || undefined,
        fechaEmision: formEditF.fechaEmision,
        folioFactura: formEditF.folioFactura || undefined,
        total, subtotal, iva,
        notas: formEditF.notas || undefined,
        proveedor: formEditF.proveedor || null,
      };
      if (formEditF.asesor) payload.asesor = formEditF.asesor;
      if (formEditF.descripcion) {
        payload.conceptos = [{
          descripcion:   formEditF.descripcion,
          cantidad:      1,
          valorUnitario: subtotal,
          importe:       subtotal,
        }];
      }
      const { data } = await api.put(`/gastos/${editingF._id}`, payload);
      setFiscales(prev => prev.map(g => g._id === editingF._id ? { ...g, ...data } : g));
      setModalEditF(false);
      setEditingF(null);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingEditF(false); }
  }

  async function deleteFiscal(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await api.delete(`/gastos/${id}`);
    setFiscales(prev => prev.filter(g => g._id !== id));
  }

  function openNewNF() {
    setEditingNF(null);
    setFormNF({ ...emptyNoFiscal, fecha: new Date().toISOString().split("T")[0] });
    setModalNF(true);
  }

  function openEditNF(g: GastoNoFiscal) {
    setEditingNF(g);
    setFormNF({
      fecha:       g.fecha.split("T")[0],
      asesor:      g.asesor?._id    ?? "",
      proveedor:   g.proveedor?._id ?? "",
      entrada:     g.entrada ?? "",
      monto:       g.monto,
      descripcion: g.descripcion,
      notas:       g.notas ?? "",
    });
    setModalNF(true);
  }

  async function saveNF() {
    if (!formNF.descripcion || !formNF.monto) return;
    setSavingNF(true);
    try {
      const body = { ...formNF };
      if (!body.proveedor) delete body.proveedor;
      if (editingNF) {
        const { data } = await api.put(`/gastos-no-fiscales/${editingNF._id}`, body);
        setNoFiscales(prev => prev.map(g => g._id === editingNF._id ? data : g));
      } else {
        const { data } = await api.post("/gastos-no-fiscales", body);
        setNoFiscales(prev => [data, ...prev]);
      }
      setModalNF(false);
      setEditingNF(null);
    } catch {}
    finally { setSavingNF(false); }
  }

  async function deleteNF(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await api.delete(`/gastos-no-fiscales/${id}`);
    setNoFiscales(prev => prev.filter(g => g._id !== id));
  }

  function abrirModalPago(id: string, tipo: "fiscal" | "nofiscal", gasto?: GastoFiscal) {
    setModalPago({ id, tipo, gasto });
    setFormPago({ fechaPago: new Date().toISOString().split("T")[0], comprobantePago: "", complementoXml: "" });
    setPagoMultipleIds([id]);
  }

  async function subirArchivo(file: File): Promise<string> {
    setUploadingPago(true);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { setUploadingPago(false); resolve(reader.result as string); };
      reader.onerror = () => { setUploadingPago(false); reject(new Error("Error al leer el archivo")); };
      reader.readAsDataURL(file);
    });
  }

  async function reemplazarComprobante(gastoId: string, file: File) {
    setReemplazandoComp(true);
    try {
      const url = await subirArchivo(file);
      const { data } = await api.put(`/gastos/${gastoId}`, { comprobantePago: url });
      setFiscales(prev => prev.map(g => g._id === gastoId ? { ...g, comprobantePago: data.comprobantePago } : g));
      setDetalleF(prev => prev ? { ...prev, comprobantePago: data.comprobantePago } : null);
      alert("✅ Comprobante actualizado");
    } catch { alert("Error al reemplazar comprobante"); }
    finally { setReemplazandoComp(false); }
  }

  async function registrarPago() {
    if (!modalPago) return;

    // Si hay múltiples seleccionados, usar endpoint múltiple
    if (pagoMultipleIds.length > 1) {
      setSavingPago(true);
      try {
        const { data } = await api.post("/gastos/pagar-multiple", {
          ids:             pagoMultipleIds,
          fechaPago:       formPago.fechaPago,
          comprobantePago: formPago.comprobantePago || null,
          complementoXml:  formPago.complementoXml  || null,
        });
        const updatedIds = new Set((data as GastoFiscal[]).map(g => g._id));
        setFiscales(prev => prev.map(g => updatedIds.has(g._id) ? { ...g, ...(data as GastoFiscal[]).find(d => d._id === g._id) } : g));
        setModalPago(null);
        setPagoMultipleIds([]);
      } catch {}
      finally { setSavingPago(false); }
      return;
    }

    // Pago individual
    setSavingPago(true);
    try {
      const endpoint = modalPago.tipo === "fiscal"
        ? `/gastos/${modalPago.id}/pagar`
        : `/gastos-no-fiscales/${modalPago.id}/pagar`;
      const { data } = await api.post(endpoint, formPago);
      if (modalPago.tipo === "fiscal") {
        setFiscales(prev => prev.map(g => g._id === modalPago.id ? { ...g, ...data } : g));
      } else {
        setNoFiscales(prev => prev.map(g => g._id === modalPago.id ? { ...g, ...data } : g));
      }
      setModalPago(null);
      setPagoMultipleIds([]);
    } catch {}
    finally { setSavingPago(false); }
  }

  function abrirReporte(tipo: "fiscal" | "nofiscal" | "general", periodo: "semana" | "mes" | "año" | "todo") {
    const periodoLabel: Record<string, string> = { semana: "Semanal", mes: "Mensual", año: "Anual", todo: "General" };
    const filtrarF  = (g: GastoFiscal)   => periodo === "todo" ? true : enRango(g.fechaEmision, periodo);
    const filtrarNF = (g: GastoNoFiscal) => periodo === "todo" ? true : enRango(g.fecha, periodo);
    const gastosFR  = fiscales.filter(filtrarF);
    const gastosNFR = noFiscales.filter(filtrarNF);
    const nfOrdenados = [...gastosNFR].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    let acum = 0;
    const rowsF = gastosFR.map(g => `
      <tr>
        <td>${fmtCorto(g.fechaEmision)}</td><td>${g.asesor?.nombre ?? "—"}</td>
        <td>${g.nombreEmisor ?? "—"}</td><td>${g.rfcEmisor ?? "—"}</td>
        <td>${g.folioFactura ?? "—"}</td>
        <td style="text-align:right">$${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        <td>${g.conceptos[0]?.descripcion ?? "—"}</td><td>${g.notas ?? "—"}</td>
        <td style="text-align:center">${g.estatus === "pagado" ? "✅" : "⏳"}</td>
      </tr>`).join("");
    const rowsNF = nfOrdenados.map(g => {
      acum += g.monto;
      return `<tr>
        <td>${fmtCorto(g.fecha)}</td><td>${g.asesor?.nombre ?? "—"}</td>
        <td>${g.entrada ?? ""}</td>
        <td style="text-align:right">$${g.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${acum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        <td>${g.descripcion}</td><td>${g.notas ?? ""}</td>
        <td style="text-align:center">${g.estatus === "pagado" ? "✅" : "⏳"}</td>
      </tr>`;
    }).join("");
    const totalF  = gastosFR.reduce((a, g) => a + g.total, 0);
    const totalNF = gastosNFR.reduce((a, g) => a + g.monto, 0);
    const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Gastos ${periodoLabel[periodo]}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:10pt;color:#222;padding:24px; }
  .header { display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px; }
  .logo { width:60px;height:60px;object-fit:contain;background:#000;border-radius:6px; }
  .header-info h1 { font-size:14pt;font-weight:900; }
  .header-info p { font-size:9pt;color:#555; }
  .section-title { font-size:11pt;font-weight:700;margin:16px 0 8px;border-left:4px solid #222;padding-left:8px; }
  table { width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9pt; }
  thead { background:#222;color:#fff; }
  thead th { padding:6px 8px;text-align:left; }
  tbody tr:nth-child(even) { background:#f5f5f5; }
  td { padding:5px 8px;border-bottom:1px solid #ddd; }
  .total-row { text-align:right;font-size:10pt;font-weight:700;margin-top:4px; }
  .grand-total { margin-top:16px;padding:10px 16px;background:#222;color:#fff;border-radius:6px;text-align:right;font-size:12pt;font-weight:900; }
  @media print { body { padding:12px; } }
</style></head><body>
<div class="header">
  <img src="${logoUrl}" class="logo" alt="Pipsa" />
  <div class="header-info">
    <h1>Reporte de Gastos — ${periodoLabel[periodo]}</h1>
    <p>Equipos Industriales y Montacargas de Guadalajara S de RL de CV</p>
    <p>Generado el ${new Date().toLocaleDateString("es-MX", { day:"2-digit",month:"long",year:"numeric" })}</p>
  </div>
</div>
${(tipo==="fiscal"||tipo==="general") ? `
<div class="section-title">Gastos Fiscales</div>
${gastosFR.length===0 ? "<p style='color:#999;font-size:9pt'>Sin gastos fiscales en este periodo.</p>" : `
<table><thead><tr><th>Fecha</th><th>Quien</th><th>Proveedor</th><th>RFC</th><th>No. Factura</th><th style="text-align:right">Total</th><th>Concepto</th><th>Notas</th><th>Pago</th></tr></thead>
<tbody>${rowsF}</tbody></table>
<p class="total-row">Total fiscal: $${totalF.toLocaleString("es-MX",{minimumFractionDigits:2})}</p>`}` : ""}
${(tipo==="nofiscal"||tipo==="general") ? `
<div class="section-title">Gastos No Fiscales</div>
${gastosNFR.length===0 ? "<p style='color:#999;font-size:9pt'>Sin gastos no fiscales en este periodo.</p>" : `
<table><thead><tr><th>Fecha</th><th>Quien</th><th>Entrada</th><th style="text-align:right">Monto</th><th style="text-align:right">Acumulado</th><th>Descripción</th><th>Notas</th><th>Pago</th></tr></thead>
<tbody>${rowsNF}</tbody></table>
<p class="total-row">Total no fiscal: $${totalNF.toLocaleString("es-MX",{minimumFractionDigits:2})}</p>`}` : ""}
${tipo==="general" ? `<div class="grand-total">TOTAL GENERAL: $${(totalF+totalNF).toLocaleString("es-MX",{minimumFractionDigits:2})}</div>` : ""}
<script>window.onload=function(){setTimeout(function(){window.print();},500);window.onafterprint=function(){window.close();};};</script>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const filteredF = fiscales.filter(g => {
    const matchSearch =
      (g.nombreEmisor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (g.rfcEmisor    ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (g.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (g.folioFactura ?? "").toLowerCase().includes(search.toLowerCase()) ||
      g.conceptos.some(c => c.descripcion.toLowerCase().includes(search.toLowerCase()));
    const matchAsesor  = filtroAsesor  === "todos" || g.asesor?._id === filtroAsesor;
    const matchEstatus = filtroEstatus === "todos" ||
      (filtroEstatus === "pendiente" ? (!g.estatus || g.estatus === "pendiente") : g.estatus === filtroEstatus);
    const fecha = g.fechaEmision ? new Date(g.fechaEmision) : null;
    const matchDesde = !fechaDesde || (fecha && fecha >= new Date(fechaDesde));
    const matchHasta = !fechaHasta || (fecha && fecha <= new Date(fechaHasta + "T23:59:59"));
    return matchSearch && matchAsesor && matchEstatus && matchDesde && matchHasta;
  });

  const filteredNF = noFiscales.filter(g => {
    const matchSearch =
      g.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      (g.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (g.notas ?? "").toLowerCase().includes(search.toLowerCase());
    const matchAsesor  = filtroAsesor  === "todos" || g.asesor?._id === filtroAsesor;
    const matchEstatus = filtroEstatus === "todos" ||
      (filtroEstatus === "pendiente" ? (!g.estatus || g.estatus === "pendiente") : g.estatus === filtroEstatus);
    const fecha = new Date(g.fecha);
    const matchDesde = !fechaDesde || fecha >= new Date(fechaDesde);
    const matchHasta = !fechaHasta || fecha <= new Date(fechaHasta + "T23:59:59");
    return matchSearch && matchAsesor && matchEstatus && matchDesde && matchHasta;
  });

  const totalPaginasF  = Math.ceil(filteredF.length  / POR_PAGINA);
  const paginadosF     = filteredF.slice((paginaF  - 1) * POR_PAGINA, paginaF  * POR_PAGINA);
  const totalPaginasNF = Math.ceil(filteredNF.length / POR_PAGINA);
  const paginadosNF    = [...filteredNF]
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .slice((paginaNF - 1) * POR_PAGINA, paginaNF * POR_PAGINA);

  const statsF = [
    { label: "Esta semana",   val: sumaFiscal("semana") },
    { label: "Este mes",      val: sumaFiscal("mes") },
    { label: "Este año",      val: sumaFiscal("año") },
    { label: "Total general", val: sumaFiscal() },
  ];
  const statsNF = [
    { label: "Esta semana",   val: sumaNoFiscal("semana") },
    { label: "Este mes",      val: sumaNoFiscal("mes") },
    { label: "Este año",      val: sumaNoFiscal("año") },
    { label: "Total general", val: sumaNoFiscal() },
  ];

  // Facturas del mismo proveedor pendientes (para pago múltiple)
  const gastosDelMismoProveedor = modalPago?.tipo === "fiscal" && modalPago.gasto
    ? filteredF.filter(g =>
        g.estatus !== "pagado" &&
        g.nombreEmisor === modalPago.gasto!.nombreEmisor
      )
    : [];

  const totalSeleccionado = pagoMultipleIds.reduce((acc, id) => {
    const g = fiscales.find(x => x._id === id);
    return acc + (g?.total ?? 0);
  }, 0);

  function toggleSeleccion(id: string) {
    setPagoMultipleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function EstatusPago({ estatus, fechaPago, comprobante }: { estatus?: string; fechaPago?: string; comprobante?: string }) {
    const pagado = estatus === "pagado";
    return (
      <div>
        <span style={{
          padding: "3px 8px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 600,
          background: pagado ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          color: pagado ? "var(--green)" : "var(--red)",
          border: `1px solid ${pagado ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          whiteSpace: "nowrap" as const,
        }}>
          {pagado ? "✅ Pagado" : "⏳ Pendiente"}
        </span>
        {pagado && fechaPago && (
          <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>{fmt(fechaPago)}</p>
        )}
        {pagado && comprobante && (
          <a href={urlArchivo(comprobante)} download target="_blank" rel="noreferrer"
            style={{ fontSize: "0.68rem", color: "var(--blue)", display: "block" }}>
            📎 Descargar comprobante
          </a>
        )}
      </div>
    );
  }

  function Paginador({ total, pag, count, set }: { total: number; pag: number; count: number; set: (p: number) => void }) {
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
        <span>Mostrando {(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, count)} de {count}</span>
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

  const selectorProveedor = (value: string, onChange: (v: string) => void) => (
    <div className="form-group">
      <label className="form-label">Proveedor del catálogo</label>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Sin vincular</option>
        {proveedores.map(p => <option key={p._id} value={p._id}>{p.nombre}{p.email ? ` — ${p.email}` : ""}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">{fiscales.length} fiscales · {noFiscales.length} no fiscales</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["semana","mes","año","todo"] as const).map(p => (
              <button key={p} className="btn btn-secondary btn-sm" onClick={() => abrirReporte("general", p)}>
                📊 {p === "semana" ? "Semanal" : p === "mes" ? "Mensual" : p === "año" ? "Anual" : "General"}
              </button>
            ))}
          </div>
          {tab === "fiscal" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary" onClick={() => { setFormManual(emptyManual); setModalManual(true); }}>
                ✏️ Captura manual
              </button>
              <button className="btn btn-primary" onClick={() => { setFormF({}); setXmlError(""); setModalFiscal(true); }}>
                + Subir XML
              </button>
            </div>
          )}
          {tab === "nofiscal" && (
            <button className="btn btn-primary" onClick={openNewNF}>+ Nuevo gasto</button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {(["fiscal","nofiscal"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); limpiarFiltros(); }}
              style={{
                padding: "10px 24px", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: "var(--font-head)",
                fontWeight: 700, fontSize: "0.88rem",
                color: tab === t ? "var(--accent)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "all 0.15s",
              }}>
              {t === "fiscal" ? "🧾 Fiscal" : "💵 No Fiscal"}
            </button>
          ))}
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {(tab === "fiscal" ? statsF : statsNF).map(s => (
            <div key={s.label} className="stat-card">
              <p className="stat-card-value" style={{ color: "var(--accent)", fontSize: "1.2rem" }}>
                ${s.val.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: "var(--accent)" }} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Reporte {tab === "fiscal" ? "fiscal" : "no fiscal"}:
          </span>
          {(["semana","mes","año","todo"] as const).map(p => (
            <button key={p} className="btn btn-secondary btn-sm"
              onClick={() => abrirReporte(tab === "fiscal" ? "fiscal" : "nofiscal", p)}>
              🖨️ {p === "semana" ? "Semanal" : p === "mes" ? "Mensual" : p === "año" ? "Anual" : "General"}
            </button>
          ))}
        </div>

        {/* ── Tabla fiscal ── */}
        {tab === "fiscal" && (
          <div className="table-card">
            <div className="table-card-header">
              <p className="table-card-title">Facturas fiscales</p>
              <div className="table-toolbar">
                <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                  value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value as any)}>
                  <option value="pendiente">⏳ Pendientes</option>
                  <option value="pagado">✅ Pagadas</option>
                  <option value="todos">Todas</option>
                </select>
                <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                  value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}>
                  <option value="todos">Todos</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
                <input className="form-input" type="date" value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)} style={{ width: "auto" }} title="Desde" />
                <input className="form-input" type="date" value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)} style={{ width: "auto" }} title="Hasta" />
                {(filtroAsesor !== "todos" || fechaDesde || fechaHasta) && (
                  <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>✕ Limpiar</button>
                )}
              </div>
            </div>
            {filteredF.length > 0 && (
              <div style={{ padding: "8px 20px", background: "rgba(245,158,11,0.08)", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--accent)" }}>
                Mostrando {filteredF.length} factura{filteredF.length !== 1 ? "s" : ""}
                {filtroEstatus !== "todos" ? ` · ${filtroEstatus === "pendiente" ? "pendientes" : "pagadas"}` : ""}
                {filtroAsesor !== "todos" ? ` · ${asesores.find(a => a._id === filtroAsesor)?.nombre}` : ""}
                {fechaDesde ? ` · desde ${fmt(fechaDesde)}` : ""}
                {fechaHasta ? ` · hasta ${fmt(fechaHasta)}` : ""}
                <span style={{ marginLeft: 12, fontWeight: 700 }}>
                  Total: ${filteredF.reduce((acc, g) => acc + g.total, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {loading ? (
              <div className="loading-state"><div className="spinner" /></div>
            ) : filteredF.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">🧾</span><p>Sin gastos fiscales{filtroEstatus !== "todos" ? ` ${filtroEstatus === "pendiente" ? "pendientes" : "pagados"}` : ""}</p></div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {paginadosF.map((g, idx) => (
                    <div key={g._id} style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 90px 1fr 100px 100px 120px 130px",
                      gap: 0, padding: "12px 20px",
                      borderBottom: "1px solid var(--border)",
                      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      alignItems: "start", fontSize: "0.8rem",
                    }}>
                      <div>
                        <p style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmt(g.fechaEmision)}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{g.asesor?.nombre ?? "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontWeight: 600 }}>{g.nombreEmisor ?? "—"}</p>
                        <p style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)", marginTop: 2 }}>{g.rfcEmisor ?? "—"}</p>
                        {g.proveedor && (
                          <p style={{ fontSize: "0.68rem", color: "var(--blue)", marginTop: 2 }}>🏭 {g.proveedor.nombre}</p>
                        )}
                      </div>
                      <div>
                        {g.folioFactura
                          ? <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>📄 {g.folioFactura}</p>
                          : <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>—</p>
                        }
                      </div>
                      <div>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {g.conceptos[0]?.descripcion?.slice(0, 60) ?? "—"}
                          {(g.conceptos[0]?.descripcion?.length ?? 0) > 60 ? "..." : ""}
                        </p>
                        {g.notas && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>{g.notas.slice(0, 40)}</p>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ whiteSpace: "nowrap" }}>${g.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>IVA ${g.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap", fontSize: "0.88rem" }}>
                          ${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <EstatusPago estatus={g.estatus} fechaPago={g.fechaPago} comprobante={g.comprobantePago} />
                      </div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalleF(g)} title="Ver detalle">👁️</button>
                        {canDelete && (
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditF(g)} title="Editar">✏️</button>
                        )}
                        {g.estatus !== "pagado" && canDelete && (
                          <button className="btn btn-secondary btn-sm"
                            style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                            onClick={() => abrirModalPago(g._id, "fiscal", g)} title="Registrar pago">💳</button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" onClick={() => deleteFiscal(g._id)} title="Eliminar">🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Paginador total={totalPaginasF} pag={paginaF} count={filteredF.length} set={setPaginaF} />
              </>
            )}
          </div>
        )}

        {/* ── Tabla no fiscal ── */}
        {tab === "nofiscal" && (
          <div className="table-card">
            <div className="table-card-header">
              <p className="table-card-title">Gastos no fiscales</p>
              <div className="table-toolbar">
                <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                  value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value as any)}>
                  <option value="pendiente">⏳ Pendientes</option>
                  <option value="pagado">✅ Pagados</option>
                  <option value="todos">Todos</option>
                </select>
                <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                  value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}>
                  <option value="todos">Todos</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
                <input className="form-input" type="date" value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)} style={{ width: "auto" }} title="Desde" />
                <input className="form-input" type="date" value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)} style={{ width: "auto" }} title="Hasta" />
                {(filtroAsesor !== "todos" || fechaDesde || fechaHasta) && (
                  <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>✕ Limpiar</button>
                )}
              </div>
            </div>
            {filteredNF.length > 0 && (
              <div style={{ padding: "8px 20px", background: "rgba(245,158,11,0.08)", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--accent)" }}>
                Mostrando {filteredNF.length} gasto{filteredNF.length !== 1 ? "s" : ""}
                {filtroEstatus !== "todos" ? ` · ${filtroEstatus === "pendiente" ? "pendientes" : "pagados"}` : ""}
                {filtroAsesor !== "todos" ? ` · ${asesores.find(a => a._id === filtroAsesor)?.nombre}` : ""}
                {fechaDesde ? ` · desde ${fmt(fechaDesde)}` : ""}
                {fechaHasta ? ` · hasta ${fmt(fechaHasta)}` : ""}
                <span style={{ marginLeft: 12, fontWeight: 700 }}>
                  Total: ${filteredNF.reduce((acc, g) => acc + g.monto, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {loading ? (
              <div className="loading-state"><div className="spinner" /></div>
            ) : filteredNF.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">💵</span><p>Sin gastos no fiscales{filtroEstatus !== "todos" ? ` ${filtroEstatus === "pendiente" ? "pendientes" : "pagados"}` : ""}</p></div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {(() => {
                    let acum = 0;
                    return paginadosNF.map((g, idx) => {
                      acum += g.monto;
                      return (
                        <div key={g._id} style={{
                          display: "grid",
                          gridTemplateColumns: "110px 90px 80px 110px 110px 1fr 120px 90px",
                          gap: 0, padding: "12px 20px",
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                          alignItems: "start", fontSize: "0.8rem",
                        }}>
                          <div><p style={{ whiteSpace: "nowrap" }}>{fmt(g.fecha)}</p></div>
                          <div><p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{g.asesor?.nombre ?? "—"}</p></div>
                          <div><p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{g.entrada ?? "—"}</p></div>
                          <div><p style={{ fontWeight: 600 }}>${g.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></div>
                          <div><p style={{ color: "var(--text-muted)" }}>${acum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></div>
                          <div>
                            <p style={{ fontWeight: 500, fontSize: "0.78rem" }}>{g.descripcion}</p>
                            {g.proveedor && <p style={{ fontSize: "0.68rem", color: "var(--blue)", marginTop: 2 }}>🏭 {g.proveedor.nombre}</p>}
                            {g.notas && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>{g.notas}</p>}
                          </div>
                          <div>
                            <EstatusPago estatus={g.estatus} fechaPago={g.fechaPago} comprobante={g.comprobantePago} />
                          </div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditNF(g)}>✏️</button>
                            {g.estatus !== "pagado" && canDelete && (
                              <button className="btn btn-secondary btn-sm"
                                style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                                onClick={() => abrirModalPago(g._id, "nofiscal")}>💳</button>
                            )}
                            {canDelete && <button className="btn btn-danger btn-sm" onClick={() => deleteNF(g._id)}>🗑️</button>}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <Paginador total={totalPaginasNF} pag={paginaNF} count={filteredNF.length} set={setPaginaNF} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal captura manual ── */}
      {modalManual && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalManual(false); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setModalManual(false)}>✕</button>
            <h2 className="modal-title">Captura manual de factura</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Proveedor *</label>
                <input className="form-input" value={formManual.nombreEmisor}
                  onChange={e => setFormManual((p: any) => ({ ...p, nombreEmisor: e.target.value }))}
                  placeholder="Nombre del proveedor" />
              </div>
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input className="form-input" value={formManual.rfcEmisor}
                  onChange={e => setFormManual((p: any) => ({ ...p, rfcEmisor: e.target.value }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label className="form-label">No. Factura</label>
                <input className="form-input" value={formManual.folioFactura}
                  onChange={e => setFormManual((p: any) => ({ ...p, folioFactura: e.target.value }))}
                  placeholder="Ej. FES2246" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formManual.fechaEmision}
                  onChange={e => setFormManual((p: any) => ({ ...p, fechaEmision: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Monto total con IVA *</label>
                <input className="form-input" type="number" value={formManual.total}
                  onChange={e => setFormManual((p: any) => ({ ...p, total: +e.target.value }))} placeholder="0.00" />
                {formManual.total > 0 && (
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Subtotal: ${(formManual.total / 1.16).toLocaleString("es-MX", { minimumFractionDigits: 2 })} · IVA: ${(formManual.total - formManual.total / 1.16).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="form-group span-2">
                <label className="form-label">Concepto / Descripción</label>
                <input className="form-input" value={formManual.descripcion}
                  onChange={e => setFormManual((p: any) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej. Renta de montacargas enero" />
              </div>
              <div className="form-group">
                <label className="form-label">Quien realizó el gasto</label>
                <select className="form-select" value={formManual.asesor}
                  onChange={e => setFormManual((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>
              {selectorProveedor(formManual.proveedor, v => setFormManual((p: any) => ({ ...p, proveedor: v })))}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={formManual.notas}
                  onChange={e => setFormManual((p: any) => ({ ...p, notas: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalManual(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveManual}
                disabled={savingManual || !formManual.nombreEmisor || !formManual.total}>
                {savingManual ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar fiscal ── */}
      {modalEditF && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalEditF(false); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setModalEditF(false)}>✕</button>
            <h2 className="modal-title">Editar factura fiscal</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Proveedor *</label>
                <input className="form-input" value={formEditF.nombreEmisor}
                  onChange={e => setFormEditF((p: any) => ({ ...p, nombreEmisor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input className="form-input" value={formEditF.rfcEmisor}
                  onChange={e => setFormEditF((p: any) => ({ ...p, rfcEmisor: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label className="form-label">No. Factura</label>
                <input className="form-input" value={formEditF.folioFactura}
                  onChange={e => setFormEditF((p: any) => ({ ...p, folioFactura: e.target.value }))} placeholder="Ej. FES2246" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={formEditF.fechaEmision}
                  onChange={e => setFormEditF((p: any) => ({ ...p, fechaEmision: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Monto total con IVA *</label>
                <input className="form-input" type="number" value={formEditF.total}
                  onChange={e => setFormEditF((p: any) => ({ ...p, total: +e.target.value }))} />
                {formEditF.total > 0 && (
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Subtotal: ${(formEditF.total / 1.16).toLocaleString("es-MX", { minimumFractionDigits: 2 })} · IVA: ${(formEditF.total - formEditF.total / 1.16).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Concepto / Descripción</label>
                <input className="form-input" value={formEditF.descripcion}
                  onChange={e => setFormEditF((p: any) => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Quien realizó el gasto</label>
                <select className="form-select" value={formEditF.asesor}
                  onChange={e => setFormEditF((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>
              {selectorProveedor(formEditF.proveedor ?? "", v => setFormEditF((p: any) => ({ ...p, proveedor: v })))}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={formEditF.notas}
                  onChange={e => setFormEditF((p: any) => ({ ...p, notas: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalEditF(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEditF}
                disabled={savingEditF || !formEditF.nombreEmisor || !formEditF.total}>
                {savingEditF ? "Guardando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal subir XML fiscal ── */}
      {modalFiscal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalFiscal(false); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModalFiscal(false)}>✕</button>
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
            {formF.nombreEmisor && !parsing && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>✅ Datos extraídos</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: "0.85rem" }}>
                  {[
                    { label: "Proveedor",   val: formF.nombreEmisor },
                    { label: "RFC",         val: formF.rfcEmisor },
                    { label: "Fecha",       val: formF.fechaEmision ? new Date(formF.fechaEmision).toLocaleDateString("es-MX") : "" },
                    { label: "No. Factura", val: formF.folioFactura || "—" },
                    { label: "UUID",        val: (formF.uuid ?? "").slice(0, 20) + "..." },
                    { label: "Subtotal",    val: `$${(formF.subtotal ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "IVA",         val: `$${(formF.iva     ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "Total",       val: `$${(formF.total   ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</p>
                      <p style={{ color: "var(--text)", fontWeight: 500 }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Quien realizó el gasto</label>
                  <select className="form-select" value={formF.asesor as any ?? ""}
                    onChange={e => setFormF(p => ({ ...p, asesor: e.target.value as any }))}>
                    <option value="">Sin asignar</option>
                    {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                  </select>
                </div>
                {selectorProveedor(formF.proveedor as any ?? "", v => setFormF(p => ({ ...p, proveedor: v as any })))}
                <div className="form-group">
                  <label className="form-label">Notas (opcional)</label>
                  <input className="form-input" value={formF.notas ?? ""}
                    onChange={e => setFormF(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Ej. Factura de combustible enero" />
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalFiscal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveFiscal} disabled={savingF || !formF.nombreEmisor || parsing}>
                {savingF ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo / editar no fiscal ── */}
      {modalNF && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalNF(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModalNF(false)}>✕</button>
            <h2 className="modal-title">{editingNF ? "Editar gasto" : "Nuevo gasto no fiscal"}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formNF.fecha}
                  onChange={e => setFormNF((p: any) => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Quien realizó el gasto</label>
                <select className="form-select" value={formNF.asesor}
                  onChange={e => setFormNF((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input className="form-input" type="number" value={formNF.monto}
                  onChange={e => setFormNF((p: any) => ({ ...p, monto: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Entrada</label>
                <input className="form-input" value={formNF.entrada}
                  onChange={e => setFormNF((p: any) => ({ ...p, entrada: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Descripción *</label>
                <textarea className="form-textarea" rows={3} value={formNF.descripcion}
                  onChange={e => setFormNF((p: any) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej. LALO SERVICIO DE PARCHE LLANTAS" />
              </div>
              {selectorProveedor(formNF.proveedor ?? "", v => setFormNF((p: any) => ({ ...p, proveedor: v })))}
              <div className="form-group span-2">
                <label className="form-label">Notas</label>
                <input className="form-input" value={formNF.notas}
                  onChange={e => setFormNF((p: any) => ({ ...p, notas: e.target.value }))}
                  placeholder="Ej. CAJA CHICA ABRIL 2026" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalNF(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveNF} disabled={savingNF}>
                {savingNF ? "Guardando..." : editingNF ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle fiscal ── */}
      {detalleF && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalleF(null); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setDetalleF(null)}>✕</button>
            <h2 className="modal-title">{detalleF.nombreEmisor ?? "Factura"}</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>UUID: {detalleF.uuid ?? "—"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 8 }}>
              {[
                { label: "Fecha",        val: fmt(detalleF.fechaEmision) },
                { label: "No. Factura",  val: detalleF.folioFactura },
                { label: "RFC Emisor",   val: detalleF.rfcEmisor },
                { label: "Receptor",     val: detalleF.nombreReceptor },
                { label: "RFC Receptor", val: detalleF.rfcReceptor },
                { label: "Quien",        val: detalleF.asesor?.nombre },
                { label: "Proveedor",    val: detalleF.proveedor ? `🏭 ${detalleF.proveedor.nombre}${detalleF.proveedor.email ? ` — ${detalleF.proveedor.email}` : ""}` : null },
                { label: "Estatus",      val: detalleF.estatus === "pagado" ? "✅ Pagado" : "⏳ Pendiente" },
                { label: "Fecha pago",   val: detalleF.fechaPago ? fmt(detalleF.fechaPago) : null },
                { label: "Notas",        val: detalleF.notas },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 500, marginTop: 2 }}>{item.val}</p>
                </div>
              ) : null)}
            </div>

            {detalleF.estatus === "pagado" && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {detalleF.comprobantePago && (
                  <a href={urlArchivo(detalleF.comprobantePago)} download target="_blank" rel="noreferrer"
                    style={{ fontSize: "0.82rem", color: "var(--blue)" }}>
                    📎 Descargar comprobante
                  </a>
                )}
                {canDelete && (
                  <label style={{ cursor: "pointer", fontSize: "0.82rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                    {reemplazandoComp ? "⏳ Subiendo..." : "🔄 Reemplazar comprobante"}
                    <input type="file" accept=".pdf,image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) reemplazarComprobante(detalleF._id, f); }} />
                  </label>
                )}
              </div>
            )}

            {detalleF.complementoXml && (
              <a href={urlArchivo(detalleF.complementoXml)} download target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: "0.82rem", color: "var(--blue)" }}>
                🗂️ Descargar complemento XML
              </a>
            )}

            {detalleF.conceptos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Conceptos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detalleF.conceptos.map((c, i) => (
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
                <span>Subtotal:</span><span>${detalleF.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                <span>IVA:</span><span>${detalleF.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--red)" }}>
                <span>Total:</span><span>${detalleF.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalleF(null)}>Cerrar</button>
              {canDelete && (
                <button className="btn btn-secondary" onClick={() => { setDetalleF(null); openEditF(detalleF); }}>✏️ Editar</button>
              )}
              {detalleF.estatus !== "pagado" && canDelete && (
                <button className="btn btn-primary" style={{ background: "var(--green)", color: "#fff" }}
                  onClick={() => { setDetalleF(null); abrirModalPago(detalleF._id, "fiscal", detalleF); }}>
                  💳 Registrar pago
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago ── */}
      {modalPago && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModalPago(null); setPagoMultipleIds([]); } }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => { setModalPago(null); setPagoMultipleIds([]); }}>✕</button>
            <h2 className="modal-title">Registrar pago</h2>

            {/* Sección pago múltiple — solo para fiscales con proveedor conocido */}
            {modalPago.tipo === "fiscal" && gastosDelMismoProveedor.length > 1 && (
              <div style={{ marginBottom: 16, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                  💳 Pago múltiple — {modalPago.gasto?.nombreEmisor}
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
                  Selecciona las facturas que se pagan con este comprobante:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {gastosDelMismoProveedor.map(g => (
                    <label key={g._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: pagoMultipleIds.includes(g._id) ? "rgba(34,197,94,0.08)" : "var(--surface2)", borderRadius: "var(--radius-sm)", border: `1px solid ${pagoMultipleIds.includes(g._id) ? "rgba(34,197,94,0.3)" : "var(--border)"}`, cursor: "pointer" }}>
                      <input type="checkbox" checked={pagoMultipleIds.includes(g._id)}
                        onChange={() => toggleSeleccion(g._id)}
                        style={{ accentColor: "var(--green)", width: 16, height: 16 }} />
                      <div style={{ flex: 1, fontSize: "0.82rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent)" }}>{g.folioFactura ?? "Sin folio"}</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{fmt(g.fechaEmision)}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--red)", fontSize: "0.85rem" }}>
                        ${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </label>
                  ))}
                </div>
                {pagoMultipleIds.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(34,197,94,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {pagoMultipleIds.length} factura{pagoMultipleIds.length !== 1 ? "s" : ""} seleccionada{pagoMultipleIds.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--green)", fontSize: "0.9rem" }}>
                      Total: ${totalSeleccionado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Fecha de pago *</label>
                <input className="form-input" type="date" value={formPago.fechaPago}
                  onChange={e => setFormPago(p => ({ ...p, fechaPago: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Comprobante de pago (PDF / imagen)</label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--surface2)" }}>
                  <span style={{ fontSize: "1.3rem" }}>{uploadingPago ? "⏳" : "📎"}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {formPago.comprobantePago ? "✅ Archivo listo" : uploadingPago ? "Procesando..." : "Seleccionar archivo"}
                  </span>
                  <input type="file" accept=".pdf,image/*" style={{ display: "none" }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await subirArchivo(f); setFormPago(p => ({ ...p, comprobantePago: url })); } }} />
                </label>
                {formPago.comprobantePago && (
                  <a href={urlArchivo(formPago.comprobantePago)} download target="_blank" rel="noreferrer"
                    style={{ fontSize: "0.78rem", color: "var(--blue)", marginTop: 4, display: "block" }}>
                    📎 Ver archivo seleccionado
                  </a>
                )}
              </div>
              {modalPago.tipo === "fiscal" && (
                <div className="form-group span-2">
                  <label className="form-label">Complemento de pago XML (opcional)</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--surface2)" }}>
                    <span style={{ fontSize: "1.3rem" }}>🗂️</span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {formPago.complementoXml ? "✅ Complemento listo" : "Seleccionar XML"}
                    </span>
                    <input type="file" accept=".xml,.pdf,image/*" style={{ display: "none" }}
                      onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await subirArchivo(f); setFormPago(p => ({ ...p, complementoXml: url })); } }} />
                  </label>
                  {formPago.complementoXml && (
                    <a href={urlArchivo(formPago.complementoXml)} download target="_blank" rel="noreferrer"
                      style={{ fontSize: "0.78rem", color: "var(--blue)", marginTop: 4, display: "block" }}>
                      🗂️ Ver complemento seleccionado
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setModalPago(null); setPagoMultipleIds([]); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarPago}
                disabled={savingPago || uploadingPago || pagoMultipleIds.length === 0}
                style={{ background: "var(--green)", color: "#fff" }}>
                {savingPago
                  ? "Registrando..."
                  : pagoMultipleIds.length > 1
                    ? `✅ Pagar ${pagoMultipleIds.length} facturas`
                    : "✅ Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}