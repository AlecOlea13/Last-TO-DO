import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";

// ── Logo oficial ───────────────────────────────────────────────────────────────
const LOGO_URL =
  "https://res.cloudinary.com/dijxgoytw/image/upload/v1790702340/LOGO_OFI_zwzayb.png";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Asesor   = { _id: string; nombre: string };

type ResumenEquipos = {
  equiposVendidos:             number;
  ventaComercialTotal:         number;
  subtotalFacturadoRegistrado: number;
  ivaRegistrado:               number;
  ventaEfectivo:               number;
  ticketPromedio:              number;
};

type ResumenServicios = {
  serviciosVendidos:   number;
  manoObraTotal:       number | null;
  refaccionesTotal:    number | null;
  subtotalComercial:   number;
  ivaRegistrado:       number | null;
  ventaComercialTotal: number;
  ticketPromedio:      number;
};

type OperacionServicio = {
  id:              string;
  cotizacionId:    string;
  folio:           string;
  fecha:           string | null;
  moneda:          string;
  subtotal:        number;
  iva:             number;
  total:           number;
  numeroFactura:   string | null;
  descripcion:     string | null;
  itemsCount:      number;
  equipoMarca:     string | null;
  equipoModelo:    string | null;
  equipoSerie:     string | null;
  fechaFacturada:    string | null;
  fechaReferencia:   string | null;
  fechaPagoComision: { inicio: string; fin: string; etiqueta: string } | null;
  fechaPago:         string | null;
  comision:        { diasCobro: number; porcentaje: number; monto: number } | null;
  cliente:         { id: string | null; nombre: string } | null;
  asesor:          { id: string | null; nombre: string } | null;
};

type PorAsesorServicio = {
  asesorId:            string | null;
  asesorNombre:        string;
  serviciosVendidos:   number;
  ventaComercialTotal: number;
  subtotalComercial:   number;
  ivaRegistrado:       number;
  manoObraTotal:       number | null;
  refaccionesTotal:    number | null;
  ticketPromedio:      number;
  participacion:       number;
};

type ResultadoServicios = {
  resumen:       ResumenServicios;
  porAsesor:     PorAsesorServicio[];
  operaciones:   OperacionServicio[];
  paginacion:    Paginacion;
  disponibilidad: { facturacionConciliada: boolean; cobranza: boolean; saldo: boolean };
  meta:          { fuenteFecha: string; advertencia: string; manoObra: string };
};

type PorAsesor = {
  asesorId:                    string | null;
  asesorNombre:                string;
  equiposVendidos:             number;
  ventaComercialTotal:         number;
  subtotalFacturadoRegistrado: number;
  ivaRegistrado:               number;
  ventaEfectivo:               number;
  ticketPromedio:              number;
  participacion:               number;
};

type VentaDetalle = {
  fecha:             string | null;
  importe:           number;
  montoFacturado:    number;
  ivaFacturado:      number;
  montoEfectivo:     number;
  importeCalculado?:  number;
  diferenciaImporte?: number;
  requiereRevision?:  boolean;
  numeroFactura:     string | null;
  notas:             string | null;
  cliente:           { id: string | null; nombre: string } | null;
  asesor:            { id: string | null; nombre: string } | null;
};

type Operacion = {
  id:              string;
  montacargasId:   string;
  numeroEconomico: string;
  marca:           string;
  modelo:          string;
  serie:           string;
  capacidad:       string;
  tipoCombustible: string;
  venta:           VentaDetalle;
};

type Paginacion = { page: number; limit: number; total: number; pages: number };

type ResultadoEquipos = {
  resumen:       ResumenEquipos;
  porAsesor:     PorAsesor[];
  operaciones:   Operacion[];
  paginacion:    Paginacion;
  disponibilidad: { facturacionConciliada: boolean; cobranza: boolean; saldo: boolean };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formatea número como moneda MXN sin desfase. */
function fmtMXN(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "0.00";
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "YYYY-MM-DD" | ISO → "DD MMM YYYY" sin desfase UTC */
function fmtFecha(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const s = dateStr.split("T")[0];
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Primer día del mes anterior en "YYYY-MM-DD" */
function primerDiaMesAnterior(): string {
  const d = new Date();
  d.setDate(1);          // ir al día 1 del mes actual
  d.setMonth(d.getMonth() - 1);  // retroceder un mes
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Último día del mes anterior en "YYYY-MM-DD" */
function ultimoDiaMesAnterior(): string {
  const d = new Date();
  d.setDate(1);          // día 1 del mes actual
  d.setDate(0);          // retroceder al último día del mes anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}



// ── Componentes auxiliares ────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "var(--green)",
  sub,
  noDisponible = false,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  noDisponible?: boolean;
}) {
  return (
    <div className="stat-card" style={{ position: "relative" }}>
      <p className="stat-card-label">{label}</p>
      {noDisponible ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>
          No disponible
        </p>
      ) : (
        <p className="stat-card-value" style={{ color, fontSize: "1.5rem" }}>
          {value}
        </p>
      )}
      {sub && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>}
      <div className="stat-card-accent" style={{ background: noDisponible ? "var(--surface3)" : color }} />
    </div>
  );
}

function Spinner() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>Cargando reporte…</p>
    </div>
  );
}

// ── Tipo de columna para el tooltip ──────────────────────────────────────────
type ColKey =
  | "fecha" | "equipo" | "marca" | "serie" | "capacidad" | "tipo"
  | "cliente" | "asesor" | "refFactura" | "subtotal" | "iva" | "efectivo" | "total";

const TOOLTIPS: Record<string, string> = {
  refFactura: "Texto capturado manualmente al registrar la venta. No representa una conciliación con el CFDI.",
  subtotal:   "Corresponde al campo montoFacturado. No representa una conciliación con el CFDI.",
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function ReporteVentas() {
  // ── Filtros ──────────────────────────────────────────────────────────────
  const [desde,     setDesde]    = useState(primerDiaMesAnterior());
  const [hasta,     setHasta]    = useState(ultimoDiaMesAnterior());
  const [asesorId,  setAsesorId] = useState("todos");
  const [buscar,    setBuscar]   = useState("");
  const [page,      setPage]     = useState(1);
  const [limit]                  = useState(20);
  const [sortBy,    setSortBy]   = useState("venta.fecha");
  const [sortDir,   setSortDir]  = useState<"asc" | "desc">("desc");
  const [categoria, setCategoria] = useState<"equipos" | "rentas" | "servicios" | "refacciones" | "otros">("equipos");

  // ── Datos ────────────────────────────────────────────────────────────────
  const [asesores, setAsesores]   = useState<Asesor[]>([]);
  const [resultado, setResultado] = useState<ResultadoEquipos | ResultadoServicios | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Detalle modal ────────────────────────────────────────────────────────
  const [detalle, setDetalle] = useState<Operacion | null>(null);

  // ── Tooltip estado ───────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{ key: ColKey; x: number; y: number } | null>(null);

  // ── Cargar asesores una sola vez ─────────────────────────────────────────
  useEffect(() => {
    api.get("/asesores").then((r: { data: Asesor[] }) => setAsesores(r.data)).catch(() => {});
  }, []);

  // ── Carga de datos ───────────────────────────────────────────────────────
  const cargar = useCallback(async (resetPage = false) => {
    if (categoria !== "equipos" && categoria !== "servicios") return;
    setLoading(true);
    setError(null);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const params: Record<string, string> = {
        desde, hasta, page: String(currentPage), limit: String(limit),
        sortBy, sortDir,
      };
      if (asesorId !== "todos") params.asesorId = asesorId;
      if (buscar.trim())        params.buscar   = buscar.trim();

      const endpoint = categoria === "servicios" ? "/reportes/ventas/servicios" : "/reportes/ventas/equipos";
      const { data } = await api.get(endpoint, { params });
      setResultado(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Error al cargar el reporte.");
    } finally {
      setLoading(false);
    }
  }, [categoria, desde, hasta, asesorId, buscar, page, limit, sortBy, sortDir]);

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, desde, hasta, asesorId, page, sortBy, sortDir]);

  // ── Helpers de exportación segura ───────────────────────────────────────
  // Escapa valores para CSV: comas, comillas, saltos de línea y fórmulas Excel
  function escaparCSV(val: unknown): string {
    const s = String(val ?? "");
    const neutralized = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${neutralized.replace(/"/g, '""')}"`;
  }

  // Escapa contenido HTML para evitar XSS en el reporte imprimible
  function escaparHTML(s: unknown): string {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Exportar CSV ─────────────────────────────────────────────────────────
  function exportarCSV() {
    if (!resultado) return;

    if (categoria === "servicios") {
      const rs = resultado as ResultadoServicios;
      const cabecera = [
        "Fecha","Folio","Cliente","Asesor","No. Factura",
        "Equipo","Subtotal","IVA","Total comercial","Comisión aprox.",
      ].map(escaparCSV).join(",");
      const filas = rs.operaciones.map(op => [
        fmtFecha(op.fecha),
        op.folio,
        op.cliente?.nombre ?? "—",
        op.asesor?.nombre  ?? "Sin asesor asignado",
        op.numeroFactura   ?? "—",
        [op.equipoMarca, op.equipoModelo].filter(Boolean).join(" ") || "—",
        op.subtotal,
        op.iva,
        op.total,
        op.fechaPagoComision?.etiqueta ?? "—",
      ].map(escaparCSV).join(","));
      const csv = [cabecera, ...filas].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `reporte-servicios-facturados_${desde}_${hasta}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // Categoría equipos (lógica original)
    const re = resultado as ResultadoEquipos;
    const cabecera = [
      "Fecha","N° Económico","Marca","Modelo","Serie","Capacidad","Tipo",
      "Cliente","Asesor","Ref. Factura (manual)",
      "Subtotal registrado","IVA registrado","Efectivo","Total comercial",
      "Importe calculado","Diferencia","Requiere revisión","Notas",
    ].map(escaparCSV).join(",");

    const filas = re.operaciones.map(op => [
      fmtFecha(op.venta.fecha),
      op.numeroEconomico,
      op.marca,
      op.modelo,
      op.serie,
      op.capacidad,
      op.tipoCombustible,
      op.venta.cliente?.nombre ?? "—",
      op.venta.asesor?.nombre  ?? "Sin asesor asignado",
      op.venta.numeroFactura   ?? "—",
      op.venta.montoFacturado,
      op.venta.ivaFacturado,
      op.venta.montoEfectivo,
      op.venta.importe,
      op.venta.importeCalculado  ?? "",
      op.venta.diferenciaImporte ?? "",
      op.venta.requiereRevision  ? "Sí" : "No",
      op.venta.notas ?? "",
    ].map(escaparCSV).join(","));

    const csv = [cabecera, ...filas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `reporte-equipos-vendidos_${desde}_${hasta}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── Exportar HTML imprimible ──────────────────────────────────────────────
  function exportarHTML() {
    if (!resultado) return;

    if (categoria === "servicios") {
      const rs = resultado as ResultadoServicios;
      const filas = rs.operaciones.map(op => `
        <tr>
          <td>${escaparHTML(fmtFecha(op.fecha))}</td>
          <td>${escaparHTML(op.folio)}</td>
          <td>${escaparHTML(op.cliente?.nombre ?? "—")}</td>
          <td>${escaparHTML(op.asesor?.nombre ?? "Sin asesor")}</td>
          <td>${escaparHTML(op.numeroFactura ?? "—")}</td>
          <td>${escaparHTML([op.equipoMarca, op.equipoModelo].filter(Boolean).join(" ") || "—")}</td>
          <td style="text-align:right">$${fmtMXN(op.subtotal)}</td>
          <td style="text-align:right">$${fmtMXN(op.iva)}</td>
          <td style="text-align:right;font-weight:700">$${fmtMXN(op.total)}</td>
          <td style="font-size:0.8em">${escaparHTML(op.fechaPagoComision?.etiqueta ?? "—")}</td>
        </tr>`).join("");
      const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Servicios Facturados</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:20px}.header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px}.logo{height:52px;object-fit:contain}h1{font-size:13pt;font-weight:900}p.sub{font-size:8.5pt;color:#555}.aviso{font-size:8pt;color:#888;margin:8px 0;font-style:italic;border-left:3px solid #ccc;padding-left:8px}.resumen{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}.box{border:1px solid #ddd;border-radius:4px;padding:10px 16px;text-align:center;min-width:120px}.box .val{font-size:14pt;font-weight:900}.box .lbl{font-size:7.5pt;color:#666;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:16px}thead{background:#222;color:#fff}thead th{padding:5px 8px;text-align:left}tbody tr:nth-child(even){background:#f5f5f5}td{padding:4px 8px;border-bottom:1px solid #ddd}.print-btn{position:fixed;top:16px;right:16px;padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer}@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="header"><img src="${LOGO_URL}" class="logo" alt="PIPSA"/><div><h1>Reporte de Servicios Facturados</h1><p class="sub">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</p><p class="sub">Del ${fmtFecha(desde)} al ${fmtFecha(hasta)}</p></div></div>
<div class="aviso">⚠ El filtro usa la fecha de cotización, no de facturación. No. factura es texto libre.</div>
<div class="resumen"><div class="box"><div class="val">${rs.resumen.serviciosVendidos}</div><div class="lbl">Servicios</div></div><div class="box"><div class="val" style="color:#16a34a">$${fmtMXN(rs.resumen.ventaComercialTotal)}</div><div class="lbl">Total comercial</div></div><div class="box"><div class="val">$${fmtMXN(rs.resumen.ticketPromedio)}</div><div class="lbl">Ticket prom.</div></div></div>
<table><thead><tr><th>Fecha</th><th>Folio</th><th>Cliente</th><th>Asesor</th><th>Factura*</th><th>Equipo</th><th style="text-align:right">Subtotal</th><th style="text-align:right">IVA</th><th style="text-align:right">Total</th><th>Comisión</th></tr></thead><tbody>${filas || "<tr><td colspan='10'>Sin datos</td></tr>"}</tbody></table>
<p style="font-size:7.5pt;color:#aaa">* Texto libre, sin conciliación con CFDI.</p>
</body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // Categoría equipos
    const re2 = resultado as ResultadoEquipos;
    const r = re2.resumen;
    const filas = re2.operaciones.map(op => `
      <tr>
        <td>${escaparHTML(fmtFecha(op.venta.fecha))}</td>
        <td>${escaparHTML(op.numeroEconomico)}</td>
        <td>${escaparHTML(op.marca)} ${escaparHTML(op.modelo)}</td>
        <td>${escaparHTML(op.serie || "—")}</td>
        <td>${escaparHTML(op.capacidad || "—")}</td>
        <td>${escaparHTML(op.tipoCombustible || "—")}</td>
        <td>${escaparHTML(op.venta.cliente?.nombre ?? "—")}</td>
        <td>${escaparHTML(op.venta.asesor?.nombre  ?? "Sin asesor")}</td>
        <td>${escaparHTML(op.venta.numeroFactura   ?? "—")}</td>
        <td style="text-align:right">$${fmtMXN(op.venta.montoFacturado)}</td>
        <td style="text-align:right">$${fmtMXN(op.venta.ivaFacturado)}</td>
        <td style="text-align:right">$${fmtMXN(op.venta.montoEfectivo)}</td>
        <td style="text-align:right;font-weight:700">$${fmtMXN(op.venta.importe)}</td>
        ${op.venta.requiereRevision ? '<td style="color:#ef4444;font-size:0.75em">⚠ revisar</td>' : '<td></td>'}
      </tr>`).join("");

    const porAsesorRows = (re2.porAsesor as PorAsesor[]).map(g => `
      <tr>
        <td>${escaparHTML(g.asesorNombre)}</td>
        <td style="text-align:center">${g.equiposVendidos}</td>
        <td style="text-align:right">$${fmtMXN(g.subtotalFacturadoRegistrado)}</td>
        <td style="text-align:right">$${fmtMXN(g.ivaRegistrado)}</td>
        <td style="text-align:right">$${fmtMXN(g.ventaEfectivo)}</td>
        <td style="text-align:right;font-weight:700">$${fmtMXN(g.ventaComercialTotal)}</td>
        <td style="text-align:right">${g.participacion.toFixed(1)}%</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Equipos Vendidos</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:20px; }
  .header { display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px; }
  .logo { height:52px;object-fit:contain; }
  h1 { font-size:13pt;font-weight:900; }
  p.sub { font-size:8.5pt;color:#555; }
  .aviso { font-size:8pt;color:#888;margin:8px 0;font-style:italic;border-left:3px solid #ccc;padding-left:8px; }
  .resumen { display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap; }
  .box { border:1px solid #ddd;border-radius:4px;padding:10px 16px;text-align:center;min-width:120px; }
  .box .val { font-size:14pt;font-weight:900; } .box .lbl { font-size:7.5pt;color:#666;text-transform:uppercase; }
  h2 { font-size:10pt;font-weight:700;margin:16px 0 8px;border-left:3px solid #222;padding-left:6px; }
  table { width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:16px; }
  thead { background:#222;color:#fff; } thead th { padding:5px 8px;text-align:left; }
  tbody tr:nth-child(even) { background:#f5f5f5; } td { padding:4px 8px;border-bottom:1px solid #ddd; }
  .print-btn { position:fixed;top:16px;right:16px;padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer; }
  @media print { .print-btn { display:none; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="header">
  <img src="${LOGO_URL}" class="logo" alt="PIPSA Montacargas" />
  <div>
    <h1>Reporte de Equipos Vendidos</h1>
    <p class="sub">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</p>
    <p class="sub">Del ${fmtFecha(desde)} al ${fmtFecha(hasta)}</p>
  </div>
</div>
<div class="aviso">⚠️ Los datos de subtotal y folio de factura son capturados manualmente. No representan una conciliación con el CFDI emitido. Cobrado y saldo no disponibles en esta fase.</div>
<div class="resumen">
  <div class="box"><div class="val">${r.equiposVendidos}</div><div class="lbl">Equipos vendidos</div></div>
  <div class="box"><div class="val" style="color:#16a34a">$${fmtMXN(r.ventaComercialTotal)}</div><div class="lbl">Venta comercial total</div></div>
  <div class="box"><div class="val">$${fmtMXN(r.subtotalFacturadoRegistrado)}</div><div class="lbl">Subtotal registrado</div></div>
  <div class="box"><div class="val">$${fmtMXN(r.ivaRegistrado)}</div><div class="lbl">IVA registrado</div></div>
  <div class="box"><div class="val">$${fmtMXN(r.ventaEfectivo)}</div><div class="lbl">Efectivo</div></div>
  <div class="box"><div class="val">$${fmtMXN(r.ticketPromedio)}</div><div class="lbl">Ticket promedio</div></div>
</div>
<h2>Ventas por asesor</h2>
<table>
  <thead><tr><th>Asesor</th><th>Equipos</th><th style="text-align:right">Subtotal reg.</th><th style="text-align:right">IVA</th><th style="text-align:right">Efectivo</th><th style="text-align:right">Total comercial</th><th style="text-align:right">%</th></tr></thead>
  <tbody>${porAsesorRows || '<tr><td colspan="7" style="text-align:center;color:#aaa">Sin datos</td></tr>'}</tbody>
</table>
<h2>Detalle de operaciones (página ${resultado.paginacion.page} de ${resultado.paginacion.pages})</h2>
<table>
  <thead><tr><th>Fecha</th><th>#</th><th>Marca/Modelo</th><th>Serie</th><th>Cap.</th><th>Tipo</th><th>Cliente</th><th>Asesor</th><th>Ref. Factura*</th><th style="text-align:right">Subtotal*</th><th style="text-align:right">IVA*</th><th style="text-align:right">Efectivo</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${filas || '<tr><td colspan="13" style="text-align:center;color:#aaa">Sin operaciones en este periodo</td></tr>'}</tbody>
</table>
<p style="font-size:7.5pt;color:#aaa">* Datos capturados manualmente, no conciliados con CFDI.</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── Cambio de columna de orden ─────────────────────────────────────────────
  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span style={{ color: "var(--accent)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Cerrar tooltip al hacer click fuera ───────────────────────────────────
  const tooltipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltip(null);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const CATS = [
    { key: "equipos",     label: "Equipos",     pendiente: false },
    { key: "servicios",   label: "Servicios",   pendiente: false },
    { key: "rentas",      label: "Rentas",       pendiente: true  },
    { key: "refacciones", label: "Refacciones",  pendiente: true  },
    { key: "otros",       label: "Otros",        pendiente: true  },
  ] as const;

  return (
    <>
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporte de ventas</h1>
          <p className="page-subtitle">Análisis general del desempeño comercial</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={exportarCSV}
            disabled={!resultado || loading || (categoria !== "equipos" && categoria !== "servicios")}
            title="Exportar CSV con los filtros activos"
          >
            CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportarHTML}
            disabled={!resultado || loading || (categoria !== "equipos" && categoria !== "servicios")}
            title="Abrir reporte imprimible / PDF"
          >
            Imprimir / PDF
          </button>
          <button
            className="btn btn-primary"
            onClick={() => cargar(true)}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div
          className="table-card"
          style={{ padding: "16px 20px", marginBottom: 0 }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde</label>
              <input
                className="form-input"
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hasta</label>
              <input
                className="form-input"
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Asesor</label>
              <select
                className="form-select"
                value={asesorId}
                onChange={e => setAsesorId(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="todos">Todos</option>
                {asesores.map(a => (
                  <option key={a._id} value={a._id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Buscar</label>
              <input
                className="form-input"
                placeholder="Equipo, cliente, asesor…"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") cargar(true); }}
                style={{ width: 220 }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => cargar(true)}
              disabled={loading}
            >
              {loading ? "Cargando…" : "Buscar"}
            </button>
            {(asesorId !== "todos" || buscar) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setAsesorId("todos"); setBuscar(""); }}
                style={{ alignSelf: "flex-end" }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Pestañas de categoría ─────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginTop: 16 }}>
          {CATS.map(c => (
            <button
              key={c.key}
              onClick={() => {
                if (categoria === c.key) return;  // ya estamos aquí, no hacer nada
                setCategoria(c.key);
                setResultado(null);
                setPage(1);
                // NO limpiar buscar, desde, hasta ni asesorId — conservar filtros al cambiar pestaña
              }}
              style={{
                padding: "10px 22px",
                border: "none",
                cursor: "pointer",
                background: "transparent",
                fontFamily: "var(--font-head)",
                fontWeight: 700,
                fontSize: "0.88rem",
                color: categoria === c.key ? "var(--accent)" : "var(--text-muted)",
                borderBottom:
                  categoria === c.key
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              {c.label}
              {c.pendiente && (
                <span
                  style={{
                    fontSize: "0.6rem",
                    background: "var(--surface3)",
                    color: "var(--text-muted)",
                    padding: "1px 5px",
                    borderRadius: 4,
                    marginLeft: 6,
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                    verticalAlign: "middle",
                  }}
                >
                  próx.
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ CATEGORÍA EQUIPOS ══════════════════════════════════════════════ */}
        {categoria === "equipos" && (() => {
          const reE = resultado as ResultadoEquipos | null;
          const r   = reE?.resumen;
          return (
          <>
            {/* ── Aviso de limitaciones ─────────────────────────────────────── */}
            <div
              style={{
                marginTop: 16,
                padding: "10px 16px",
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--accent)" }}>Fase 1 — Solo categoría Equipos.</strong>
              {" "}La venta todavía no está vinculada con el módulo de Facturación. Los datos de cobranza y saldo no están disponibles.
              Los campos de subtotal y folio de factura son texto capturado manualmente al registrar la venta y no representan una conciliación con el CFDI.
            </div>

            {/* ── Métricas ─────────────────────────────────────────────────── */}
            {error ? (
              <div
                style={{
                  marginTop: 16,
                  padding: "20px 24px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "var(--radius)",
                  color: "var(--red)",
                  fontSize: "0.88rem",
                }}
              >
                {error}
              </div>
            ) : (
              <>
                <div
                  className="stats-grid"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    marginTop: 16,
                  }}
                >
                  <StatCard
                    label="Equipos vendidos"
                    value={loading ? "—" : String(r?.equiposVendidos ?? 0)}
                    color="var(--blue)"
                  />
                  <StatCard
                    label="Venta comercial total"
                    value={loading ? "—" : `$${fmtMXN(r?.ventaComercialTotal ?? 0)}`}
                    color="var(--green)"
                    sub="importe registrado (subtotal + IVA + efectivo)"
                  />
                  <StatCard
                    label="Subtotal facturado reg."
                    value={loading ? "—" : `$${fmtMXN(r?.subtotalFacturadoRegistrado ?? 0)}`}
                    color="var(--accent)"
                    sub="sin IVA, capturado manualmente"
                  />
                  <StatCard
                    label="IVA registrado"
                    value={loading ? "—" : `$${fmtMXN(r?.ivaRegistrado ?? 0)}`}
                    color="var(--accent)"
                  />
                  <StatCard
                    label="Venta en efectivo"
                    value={loading ? "—" : `$${fmtMXN(r?.ventaEfectivo ?? 0)}`}
                    color="var(--purple)"
                    sub="sin factura"
                  />
                  <StatCard
                    label="Ticket promedio"
                    value={loading ? "—" : `$${fmtMXN(r?.ticketPromedio ?? 0)}`}
                    color="var(--text)"
                  />
                  <StatCard
                    label="Total cobrado"
                    value=""
                    noDisponible
                    sub="requiere vinculación con Facturación"
                  />
                  <StatCard
                    label="Saldo pendiente"
                    value=""
                    noDisponible
                    sub="requiere vinculación con Facturación"
                  />
                </div>

                {/* ── Ventas por asesor ────────────────────────────────────── */}
                {!loading && resultado && resultado.porAsesor.length > 0 && (
                  <div className="table-card" style={{ marginTop: 16 }}>
                    <div className="table-card-header">
                      <p className="table-card-title">Ventas por asesor</p>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Asesor</th>
                            <th style={{ textAlign: "right" }}>Equipos</th>
                            <th style={{ textAlign: "right" }}>Subtotal reg.</th>
                            <th style={{ textAlign: "right" }}>IVA reg.</th>
                            <th style={{ textAlign: "right" }}>Efectivo</th>
                            <th style={{ textAlign: "right" }}>Total comercial</th>
                            <th style={{ textAlign: "right" }}>Ticket prom.</th>
                            <th style={{ textAlign: "right" }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reE!.porAsesor.map((g, i) => (
                            <tr key={g.asesorId ?? `sin-${i}`}>
                              <td style={{ fontWeight: 600 }}>
                                {g.asesorNombre}
                                {!g.asesorId && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      fontSize: "0.68rem",
                                      color: "var(--text-muted)",
                                      fontWeight: 400,
                                    }}
                                  >
                                    (sin asignar)
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>{g.equiposVendidos}</td>
                              <td style={{ textAlign: "right" }}>${fmtMXN(g.subtotalFacturadoRegistrado)}</td>
                              <td style={{ textAlign: "right" }}>${fmtMXN(g.ivaRegistrado)}</td>
                              <td style={{ textAlign: "right" }}>${fmtMXN(g.ventaEfectivo)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>
                                ${fmtMXN(g.ventaComercialTotal)}
                              </td>
                              <td style={{ textAlign: "right" }}>${fmtMXN(g.ticketPromedio)}</td>
                              <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                                {g.participacion.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Tabla de operaciones ──────────────────────────────────── */}
                <div className="table-card" style={{ marginTop: 16 }}>
                  <div className="table-card-header">
                    <p className="table-card-title">
                      Operaciones
                      {resultado && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 400,
                          }}
                        >
                          {resultado.paginacion.total} total
                          {resultado.paginacion.total !== resultado.operaciones.length &&
                            ` · página ${resultado.paginacion.page} de ${resultado.paginacion.pages}`}
                        </span>
                      )}
                    </p>
                  </div>

                  {loading ? (
                    <Spinner />
                  ) : !resultado || resultado.operaciones.length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: "2rem" }}>📊</span>
                      <p>Sin operaciones en este periodo</p>
                      <p style={{ fontSize: "0.8rem" }}>
                        Ajusta el rango de fechas o los filtros
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Tabla — scroll interno solo si es necesario */}
                      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <table style={{ fontSize: "0.82rem", minWidth: 900 }}>
                          <thead>
                            <tr>
                              <th
                                onClick={() => toggleSort("venta.fecha")}
                                style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Fecha <SortIcon col="venta.fecha" />
                              </th>
                              <th
                                onClick={() => toggleSort("numeroEconomico")}
                                style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                # Económico <SortIcon col="numeroEconomico" />
                              </th>
                              <th
                                onClick={() => toggleSort("marca")}
                                style={{ cursor: "pointer" }}
                              >
                                Marca/Modelo <SortIcon col="marca" />
                              </th>
                              <th>Serie</th>
                              <th>Cap.</th>
                              <th>Tipo</th>
                              <th>Cliente</th>
                              <th>Asesor</th>
                              <th>
                                Ref. Factura
                                {" "}
                                <span
                                  style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}
                                  onClick={e => setTooltip({ key: "refFactura", x: e.clientX, y: e.clientY })}
                                  title={TOOLTIPS.refFactura}
                                >
                                  ⓘ
                                </span>
                              </th>
                              <th style={{ textAlign: "right" }}>
                                Subtotal reg.
                                {" "}
                                <span
                                  style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}
                                  onClick={e => setTooltip({ key: "subtotal", x: e.clientX, y: e.clientY })}
                                  title={TOOLTIPS.subtotal}
                                >
                                  ⓘ
                                </span>
                              </th>
                              <th style={{ textAlign: "right" }}>IVA reg.</th>
                              <th style={{ textAlign: "right" }}>Efectivo</th>
                              <th
                                onClick={() => toggleSort("venta.importe")}
                                style={{ textAlign: "right", cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Total comercial <SortIcon col="venta.importe" />
                              </th>
                              <th style={{ width: 40 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {reE!.operaciones.map(op => (
                              <tr key={op.id}>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {fmtFecha(op.venta.fecha)}
                                </td>
                                <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>
                                  {op.numeroEconomico}
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600 }}>{op.marca}</span>
                                  {op.modelo && (
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                      {" "}{op.modelo}
                                    </span>
                                  )}
                                </td>
                                <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                  {op.serie || "—"}
                                </td>
                                <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                  {op.capacidad || "—"}
                                </td>
                                <td>
                                  {op.tipoCombustible ? (
                                    <span
                                      className={`badge ${
                                        op.tipoCombustible === "electrico"
                                          ? "badge-blue"
                                          : op.tipoCombustible === "gas"
                                          ? "badge-amber"
                                          : "badge-gray"
                                      }`}
                                    >
                                      {op.tipoCombustible}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {op.venta.cliente?.nombre ?? (
                                    <span style={{ color: "var(--text-muted)" }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {op.venta.asesor?.nombre ?? (
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontSize: "0.75rem",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      Sin asesor asignado
                                    </span>
                                  )}
                                </td>
                                <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                  {op.venta.numeroFactura ?? "—"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {op.venta.montoFacturado > 0
                                    ? `$${fmtMXN(op.venta.montoFacturado)}`
                                    : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {op.venta.ivaFacturado > 0
                                    ? `$${fmtMXN(op.venta.ivaFacturado)}`
                                    : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {op.venta.montoEfectivo > 0
                                    ? `$${fmtMXN(op.venta.montoEfectivo)}`
                                    : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                </td>
                                <td
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 700,
                                    color: "var(--green)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  ${fmtMXN(op.venta.importe)}
                                </td>
                                <td>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setDetalle(op)}
                                    title="Ver detalle"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Paginación */}
                      {reE!.paginacion.pages > 1 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 20px",
                            borderTop: "1px solid var(--border)",
                            fontSize: "0.82rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          <span>
                            {(page - 1) * limit + 1}–
                            {Math.min(page * limit, reE!.paginacion.total)} de{" "}
                            {reE!.paginacion.total}
                          </span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPage(1)}
                              disabled={page === 1}
                            >
                              «
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPage(p => p - 1)}
                              disabled={page === 1}
                            >
                              ‹
                            </button>
                            {Array.from({ length: resultado.paginacion.pages }, (_, i) => i + 1)
                              .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === resultado.paginacion.pages)
                              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                                acc.push(p);
                                return acc;
                              }, [])
                              .map((p, i) =>
                                p === "…" ? (
                                  <span key={`e${i}`} style={{ padding: "0 4px" }}>…</span>
                                ) : (
                                  <button
                                    key={p}
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setPage(p as number)}
                                    style={{
                                      minWidth: 32,
                                      background: page === p ? "var(--accent)" : undefined,
                                      color: page === p ? "#000" : undefined,
                                      fontWeight: page === p ? 700 : undefined,
                                    }}
                                  >
                                    {p}
                                  </button>
                                )
                              )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPage(p => p + 1)}
                              disabled={page === reE!.paginacion.pages}
                            >
                              ›
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPage(resultado.paginacion.pages)}
                              disabled={page === reE!.paginacion.pages}
                            >
                              »
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </>
          );
        })()}

        {/* ══ CATEGORÍA SERVICIOS ══════════════════════════════════════════ */}
        {categoria === "servicios" && (() => {
          const rs = resultado as ResultadoServicios | null;
          const r  = rs?.resumen;
          return (
            <>
              {/* Aviso de limitaciones */}
              <div style={{
                marginTop: 16, padding: "10px 16px",
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--radius-sm)", fontSize: "0.78rem",
                color: "var(--text-muted)", lineHeight: 1.6,
              }}>
                <strong style={{ color: "var(--accent)" }}>Servicios — Cotizaciones facturadas.</strong>
                {" "}Se muestran cotizaciones de tipo "servicio" con estatus "facturada".
                El filtro de fechas usa la fecha de la cotización, no la fecha de facturación (campo inexistente en el modelo).
                Mano de obra y refacciones no están desglosadas: los conceptos son texto libre.
                La fecha de pago de comisión corresponde a la segunda semana del mes siguiente.
              </div>

              {error ? (
                <div style={{
                  marginTop: 16, padding: "20px 24px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "var(--radius)", color: "var(--red)", fontSize: "0.88rem",
                }}>
                  {error}
                </div>
              ) : (
                <>
                  {/* KPIs */}
                  <div className="stats-grid" style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", marginTop: 16,
                  }}>
                    <StatCard label="Servicios facturados" value={loading ? "—" : String(r?.serviciosVendidos ?? 0)} color="var(--blue)" />
                    <StatCard label="Total comercial" value={loading ? "—" : `$${fmtMXN(r?.ventaComercialTotal ?? 0)}`} color="var(--green)" sub="total c/IVA" />
                    <StatCard label="Subtotal (sin IVA)" value={loading ? "—" : `$${fmtMXN(r?.subtotalComercial ?? 0)}`} color="var(--accent)" />
                    <StatCard label="IVA registrado" value={loading ? "—" : `$${fmtMXN(r?.ivaRegistrado ?? 0)}`} color="var(--accent)" />
                    <StatCard label="Ticket promedio" value={loading ? "—" : `$${fmtMXN(r?.ticketPromedio ?? 0)}`} color="var(--text)" />
                    <StatCard label="Mano de obra" value="" noDisponible sub="items sin categoría" />
                    <StatCard label="Total cobrado" value="" noDisponible sub="sin vinculación fiscal" />
                    <StatCard label="Saldo pendiente" value="" noDisponible sub="sin vinculación fiscal" />
                  </div>

                  {/* Por asesor */}
                  {!loading && rs && rs.porAsesor.length > 0 && (
                    <div className="table-card" style={{ marginTop: 16 }}>
                      <div className="table-card-header">
                        <p className="table-card-title">Servicios por asesor</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                          Fecha de pago de comisión: segunda semana del mes siguiente a la cotización
                        </p>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Asesor</th>
                              <th style={{ textAlign: "right" }}>Servicios</th>
                              <th style={{ textAlign: "right" }}>Subtotal</th>
                              <th style={{ textAlign: "right" }}>IVA</th>
                              <th style={{ textAlign: "right" }}>Total comercial</th>
                              <th style={{ textAlign: "right" }}>Ticket prom.</th>
                              <th style={{ textAlign: "right" }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rs.porAsesor.map((g, i) => (
                              <tr key={g.asesorId ?? `sin-${i}`}>
                                <td style={{ fontWeight: 600 }}>
                                  {g.asesorNombre}
                                  {!g.asesorId && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 400 }}>(sin asignar)</span>}
                                </td>
                                <td style={{ textAlign: "right" }}>{g.serviciosVendidos}</td>
                                <td style={{ textAlign: "right" }}>${fmtMXN(g.subtotalComercial)}</td>
                                <td style={{ textAlign: "right" }}>${fmtMXN(g.ivaRegistrado)}</td>
                                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>${fmtMXN(g.ventaComercialTotal)}</td>
                                <td style={{ textAlign: "right" }}>${fmtMXN(g.ticketPromedio)}</td>
                                <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{g.participacion.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tabla de operaciones */}
                  <div className="table-card" style={{ marginTop: 16 }}>
                    <div className="table-card-header">
                      <p className="table-card-title">
                        Cotizaciones facturadas — Servicios
                        {rs && <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>{rs.paginacion.total} total</span>}
                      </p>
                    </div>
                    {loading ? (
                      <div className="loading-state"><div className="spinner" /></div>
                    ) : !rs || rs.operaciones.length === 0 ? (
                      <div className="empty-state">
                        <span style={{ fontSize: "2rem" }}>🔧</span>
                        <p>Sin servicios facturados en este periodo</p>
                        <p style={{ fontSize: "0.8rem" }}>Ajusta el rango de fechas o los filtros</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                          <table style={{ fontSize: "0.82rem", minWidth: 860 }}>
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Folio</th>
                                <th>Cliente</th>
                                <th>Asesor</th>
                                <th>Factura</th>
                                <th>Equipo</th>
                                <th style={{ textAlign: "right" }}>Subtotal</th>
                                <th style={{ textAlign: "right" }}>IVA</th>
                                <th style={{ textAlign: "right" }}>Total</th>
                                <th>Comisión</th>
                                <th style={{ width: 40 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rs.operaciones.map(op => (
                                <tr key={op.id}>
                                  <td style={{ whiteSpace: "nowrap" }}>{fmtFecha(op.fecha)}</td>
                                  <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{op.folio}</td>
                                  <td>{op.cliente?.nombre ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                                  <td>
                                    {op.asesor?.nombre ?? (
                                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>Sin asesor asignado</span>
                                    )}
                                  </td>
                                  <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{op.numeroFactura ?? "—"}</td>
                                  <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                    {[op.equipoMarca, op.equipoModelo].filter(Boolean).join(" ") || "—"}
                                  </td>
                                  <td style={{ textAlign: "right" }}>${fmtMXN(op.subtotal)}</td>
                                  <td style={{ textAlign: "right" }}>${fmtMXN(op.iva)}</td>
                                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", whiteSpace: "nowrap" }}>${fmtMXN(op.total)}</td>
                                  <td style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                                    {op.comision ? (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                        <span style={{ fontWeight: 700, color: "var(--green)" }}>
                                          ${fmtMXN(op.comision.monto)}
                                        </span>
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>
                                          {op.comision.porcentaje}% · {op.comision.diasCobro}d
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)" }}>
                                        {op.fechaPagoComision?.etiqueta ?? "—"}
                                        {!op.fechaPago && (
                                          <span style={{ display: "block", fontSize: "0.65rem", color: "rgba(156,163,175,0.7)" }}>
                                            sin fecha de pago
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setDetalle({ ...op, _tipoDetalle: "servicio" } as any)} title="Ver detalle">Ver</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Paginación igual que equipos */}
                        {rs.paginacion.pages > 1 && (
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 20px", borderTop: "1px solid var(--border)",
                            fontSize: "0.82rem", color: "var(--text-muted)",
                          }}>
                            <span>{(page - 1) * limit + 1}–{Math.min(page * limit, rs.paginacion.total)} de {rs.paginacion.total}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page === rs.paginacion.pages}>›</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPage(rs.paginacion.pages)} disabled={page === rs.paginacion.pages}>»</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* ── Tooltip flotante ─────────────────────────────────────────────── */}
      {tooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: tooltip.y + 12,
            left: Math.min(tooltip.x, window.innerWidth - 320),
            zIndex: 9999,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            maxWidth: 300,
            fontSize: "0.8rem",
            color: "var(--text)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            lineHeight: 1.5,
          }}
        >
          {TOOLTIPS[tooltip.key]}
        </div>
      )}

      {/* ── Modal de detalle servicios ──────────────────────────────────── */}
      {detalle && (detalle as any)._tipoDetalle === "servicio" && (() => {
        const op = detalle as any as OperacionServicio & { _tipoDetalle: string };
        return (
          <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
            <div className="modal" style={{ maxWidth: 500 }}>
              <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
              <h2 className="modal-title">
                {op.folio}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — Servicio facturado</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 12 }}>
                {[
                  { label: "Fecha de cotización", val: fmtFecha(op.fecha) },
                  { label: "Cliente",             val: op.cliente?.nombre },
                  { label: "Asesor",              val: op.asesor?.nombre ?? "Sin asesor asignado" },
                  { label: "No. de factura *",    val: op.numeroFactura },
                  { label: "Moneda",              val: op.moneda },
                  { label: "Equipo",              val: [op.equipoMarca, op.equipoModelo, op.equipoSerie].filter(Boolean).join(" ") || undefined },
                  { label: "Descripción",         val: op.descripcion },
                  { label: "Conceptos",           val: op.itemsCount ? `${op.itemsCount} concepto${op.itemsCount !== 1 ? "s" : ""}` : undefined },
                  { label: "Fecha facturación",   val: op.fechaFacturada ? fmtFecha(op.fechaFacturada) : undefined },
                  { label: "Ref. comisión",       val: !op.fechaFacturada ? `Usando fecha cotización (${fmtFecha(op.fecha)}) — captura la fecha de facturación para mayor precisión` : undefined },
                  { label: "Fecha pago comisión", val: op.comision ? undefined : op.fechaPagoComision?.etiqueta },
                  { label: "Comisión calculada",  val: op.comision ? `${op.comision.porcentaje}% · $${fmtMXN(op.comision.monto)} (${op.comision.diasCobro} días de cobro)` : undefined },
                  { label: "Sin fecha de pago",   val: (!op.comision && !op.fechaPago) ? "Registra la fecha de pago en Cotizaciones para calcular la comisión" : undefined },
                ].map(item => item.val ? (
                  <div key={item.label}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: "0.9rem", color: "var(--text)", margin: "2px 0 0", fontWeight: 500 }}>{item.val}</p>
                  </div>
                ) : null)}
              </div>
              <div style={{
                marginTop: 16, background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "12px 16px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>Subtotal</span><span>${fmtMXN(op.subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>IVA (16%)</span><span>${fmtMXN(op.iva)}</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: "0.95rem", fontWeight: 700, color: "var(--green)",
                  borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 8,
                }}>
                  <span>Total comercial</span><span>${fmtMXN(op.total)}</span>
                </div>
              </div>
              <div style={{
                marginTop: 12, padding: "8px 12px",
                background: "rgba(122,128,153,0.08)", border: "1px solid rgba(122,128,153,0.2)",
                borderRadius: "var(--radius-sm)", fontSize: "0.75rem",
                color: "var(--text-muted)", lineHeight: 1.5,
              }}>
                La cotización está vinculada a una factura solo por folio de texto. No hay conciliación automática con el módulo de Facturación.
              </div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 8 }}>
                * No. factura es texto libre. No representa FK a Factura en la BD.
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal de detalle ─────────────────────────────────────────────── */}
      {detalle && (detalle as any)._tipoDetalle !== "servicio" && (
        <div
          className="modal-overlay"
          onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null); }}
        >
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h2 className="modal-title">
              {detalle.numeroEconomico}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {" "}— {detalle.marca} {detalle.modelo}
              </span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 12 }}>
              {[
                { label: "Fecha de venta",   val: fmtFecha(detalle.venta.fecha) },
                { label: "Tipo",             val: detalle.tipoCombustible },
                { label: "Serie",            val: detalle.serie },
                { label: "Capacidad",        val: detalle.capacidad },
                { label: "Cliente",          val: detalle.venta.cliente?.nombre },
                { label: "Asesor",           val: detalle.venta.asesor?.nombre ?? "Sin asesor asignado" },
                { label: "Ref. factura *",   val: detalle.venta.numeroFactura },
                { label: "Notas",            val: detalle.venta.notas },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text)", margin: "2px 0 0", fontWeight: 500 }}>
                    {item.val}
                  </p>
                </div>
              ) : null)}
            </div>

            <div
              style={{
                marginTop: 16,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {detalle.venta.montoFacturado > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    <span>Subtotal registrado *</span>
                    <span>${fmtMXN(detalle.venta.montoFacturado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    <span>IVA registrado (16%)</span>
                    <span>${fmtMXN(detalle.venta.ivaFacturado)}</span>
                  </div>
                </>
              )}
              {detalle.venta.montoEfectivo > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>Efectivo / sin factura</span>
                  <span>${fmtMXN(detalle.venta.montoEfectivo)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--green)",
                  borderTop: "1px solid var(--border)",
                  marginTop: 4,
                  paddingTop: 8,
                }}
              >
                <span>Total comercial</span>
                <span>${fmtMXN(detalle.venta.importe)}</span>
              </div>
            </div>

            {/* Alerta si el importe guardado difiere del calculado */}
            {detalle.venta.requiereRevision && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  color: "var(--red)",
                  lineHeight: 1.5,
                }}
              >
                ⚠ El importe guardado (${fmtMXN(detalle.venta.importe)}) difiere del calculado
                (${fmtMXN(detalle.venta.importeCalculado ?? 0)}). Diferencia: ${fmtMXN(detalle.venta.diferenciaImporte ?? 0)}.
                Este registro puede requerir revisión manual.
              </div>
            )}

            {/* Aviso de facturación/cobranza no disponible */}
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(122,128,153,0.08)",
                border: "1px solid rgba(122,128,153,0.2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              La venta todavía no está vinculada con el módulo de Facturación. Los datos de cobranza y saldo no están disponibles.
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 8 }}>
              * Ref. factura y subtotal son datos capturados manualmente. No representan una conciliación con el CFDI emitido.
            </p>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}