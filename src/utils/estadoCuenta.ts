// src/utils/estadoCuenta.ts
// Reportes de cartera en PDF: estado de cuenta por cliente (para enviarle al cliente)
// y reporte general de cartera (uso interno). Mismo método que utils/reportes.ts (html2canvas + jsPDF).
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const LOGO_URL = "https://res.cloudinary.com/dijxgoytw/image/upload/v1790702340/LOGO_OFI_zwzayb.png";

export type Aging = { vigente: number; d1_30: number; d31_60: number; d61_90: number; d91: number; sinDef: number; total: number };

export type FacturaReporte = {
  folioFactura: string | null; uuid: string | null;
  fechaEmision: string | null; fechaVencimiento: string | null;
  total: number; montoPagado: number; saldo: number;
  diasVencidos: number; sinFechaVencimiento: boolean; moneda?: string;
  conceptos?: { descripcion: string; cantidad: number; importe: number }[];
};

export type DetalleReporte = {
  cliente: { nombre: string; rfc: string | null; diasCreditoCli: number | null };
  aging: Aging;
  facturas: FacturaReporte[];
};

export type GeneralReporte = {
  aging: Aging;
  resumen: { carteraTotal: number; carteraVigente: number; carteraVencida: number; pctVencida: number; clientesPend: number; facturasPend: number };
  clientes: { nombre: string; rfc: string | null; facturasPend: number; maxDiasVencidos: number; aging: Aging }[];
};

// ── Utilidades ──────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number, moneda = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda === "USD" ? "USD" : "MXN" }).format(n || 0);
const dash = (n: number) => (n > 0.004 ? money(n) : "—");
function fecha(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return new Date(+y, +m - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
const ahora = () => new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cliente";

const COLORES = { vigente: "#16a34a", d1_30: "#ca8a04", d31_60: "#ea580c", d61_90: "#dc2626", d91: "#7f1d1d", sinDef: "#94a3b8" };
const ETIQ = { vigente: "Por vencer", d1_30: "1 – 30 días", d31_60: "31 – 60 días", d61_90: "61 – 90 días", d91: "91+ días", sinDef: "Sin fecha" };
const ORDEN: (keyof typeof COLORES)[] = ["d1_30", "d31_60", "d61_90", "d91"];
const venc = (a: Aging) => a.d1_30 + a.d31_60 + a.d61_90 + a.d91;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;font-size:12px;line-height:1.4}
.page{padding:34px 38px 30px}
.top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #f59e0b}
.logo{height:54px;width:auto;object-fit:contain}
.ttl{text-align:right}
.ttl h1{font-size:22px;letter-spacing:.04em;color:#0f172a;font-weight:800}
.ttl p{color:#64748b;font-size:11.5px;margin-top:3px}
.cli{margin:18px 0 16px;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,#fffbeb,#fff);border:1px solid #fde68a}
.cli .n{font-size:16px;font-weight:800;color:#0f172a}
.cli .m{color:#64748b;font-size:11.5px;margin-top:3px}
.aging{display:grid;gap:8px;margin-bottom:18px}
.cell{border-radius:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-top:4px solid var(--c)}
.cell .l{font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#64748b}
.cell .v{font-size:14px;font-weight:800;margin-top:4px;color:#0f172a;white-space:nowrap}
.cell.tot{background:#0f172a;border-color:#0f172a;border-top-color:#f59e0b}
.cell.tot .l{color:#fcd34d}.cell.tot .v{color:#fff}
table{width:100%;border-collapse:collapse}
thead th{background:#0f172a;color:#fff;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;padding:9px 8px;text-align:left}
thead th.r,td.r{text-align:right}
thead th:first-child{border-radius:8px 0 0 0}thead th:last-child{border-radius:0 8px 0 0}
td{padding:9px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:11.5px}
tbody tr:nth-child(even) td{background:#f8fafc}
.fol{font-weight:700;color:#0f172a;white-space:nowrap}
.con{color:#475569;font-size:10.5px;line-height:1.35}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap}
.tfoot td{background:#fffbeb!important;border-top:2px solid #f59e0b;border-bottom:none;font-weight:800;font-size:12px;color:#0f172a}
.note{margin-top:16px;padding:12px 14px;border-radius:10px;background:#f1f5f9;color:#475569;font-size:10.5px;line-height:1.5}
.foot{margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;color:#94a3b8;font-size:10px}
.bar{display:flex;height:14px;border-radius:8px;overflow:hidden;gap:2px;margin:6px 0 10px}
.leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:10.5px;color:#475569;margin-bottom:16px}
.leg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
`;

function celdas(a: Aging, mostrarTotal = true) {
  const cel = ORDEN.map(k => `<div class="cell" style="--c:${COLORES[k]}"><p class="l">${ETIQ[k]}</p><p class="v">${money(a[k])}</p></div>`);
  if (mostrarTotal) cel.push(`<div class="cell tot"><p class="l">Total vencido</p><p class="v">${money(venc(a))}</p></div>`);
  return { html: cel.join(""), n: cel.length };
}

function badgeAtraso(f: { diasVencidos: number; sinFechaVencimiento: boolean }) {
  if (f.sinFechaVencimiento) return `<span class="badge" style="background:#e2e8f0;color:#475569">Sin fecha</span>`;
  if (f.diasVencidos <= 0) return `<span class="badge" style="background:#dcfce7;color:#166534">Al corriente</span>`;
  const k = f.diasVencidos <= 30 ? "d1_30" : f.diasVencidos <= 60 ? "d31_60" : f.diasVencidos <= 90 ? "d61_90" : "d91";
  return `<span class="badge" style="background:${COLORES[k]}22;color:${COLORES[k]}">${f.diasVencidos} día${f.diasVencidos === 1 ? "" : "s"}</span>`;
}

// ── HTML: estado de cuenta del cliente ─────────────────────
function htmlEstadoCuenta(d: DetalleReporte, fechaCorte: string) {
  const { html: celdasHtml, n } = celdas(d.aging);
  const mixta = new Set(d.facturas.map(f => f.moneda ?? "MXN")).size > 1;
  const filas = d.facturas.map(f => {
    const cs = (f.conceptos ?? []).filter(c => c.descripcion);
    const conceptos = cs.length
      ? cs.slice(0, 3).map(c => `• ${esc(c.descripcion.length > 90 ? c.descripcion.slice(0, 90) + "…" : c.descripcion)}`).join("<br/>") + (cs.length > 3 ? `<br/><i>+ ${cs.length - 3} concepto(s) más</i>` : "")
      : `<span style="color:#94a3b8">—</span>`;
    const mon = f.moneda ?? "MXN";
    return `<tr>
      <td class="fol">${esc(f.folioFactura || "Sin folio")}</td>
      <td>${fecha(f.fechaEmision)}</td>
      <td>${f.fechaVencimiento ? fecha(f.fechaVencimiento) : "Por definir"}</td>
      <td class="con">${conceptos}</td>
      <td class="r">${money(f.total, mon)}${mixta ? `<div style="font-size:9px;color:#94a3b8">${mon}</div>` : ""}</td>
      <td class="r">${f.montoPagado > 0 ? money(f.montoPagado, mon) : "—"}</td>
      <td class="r" style="font-weight:800;color:${f.diasVencidos > 0 ? "#b91c1c" : "#0f172a"}">${money(f.saldo, mon)}</td>
      <td>${badgeAtraso(f)}</td>
    </tr>`;
  }).join("");
  const totFact = d.facturas.reduce((a, f) => a + f.total, 0);
  const totPag = d.facturas.reduce((a, f) => a + f.montoPagado, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="page">
    <div class="top">
      <img class="logo" src="${LOGO_URL}" crossorigin="anonymous" />
      <div class="ttl"><h1>ESTADO DE CUENTA</h1><p>Corte al ${fecha(fechaCorte)}</p></div>
    </div>
    <div class="cli">
      <p class="n">${esc(d.cliente.nombre)}</p>
      <p class="m">${d.cliente.rfc ? `RFC: ${esc(d.cliente.rfc)} · ` : ""}${d.facturas.length} factura${d.facturas.length === 1 ? "" : "s"} vencida${d.facturas.length === 1 ? "" : "s"}${d.cliente.diasCreditoCli ? ` · Crédito: ${d.cliente.diasCreditoCli} días` : ""}</p>
    </div>
    <div class="aging" style="grid-template-columns:repeat(${n},1fr)">${celdasHtml}</div>
    <table>
      <thead><tr><th>Folio</th><th>Emisión</th><th>Vence</th><th style="width:26%">Concepto</th><th class="r">Total</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Atraso</th></tr></thead>
      <tbody>${filas}
        <tr class="tfoot"><td colspan="4">TOTAL</td><td class="r">${mixta ? "" : money(totFact)}</td><td class="r">${mixta ? "" : (totPag > 0 ? money(totPag) : "—")}</td><td class="r">${money(venc(d.aging))}</td><td></td></tr>
      </tbody>
    </table>
    <div class="note">Los días de atraso se cuentan a partir de la fecha de vencimiento de cada factura. Si ya realizó algún pago que no aparezca en este estado de cuenta, le agradeceremos enviarnos su comprobante para aplicarlo a la brevedad.</div>
    <div class="foot"><span>PIPSA Montacargas</span><span>Generado el ${ahora()}</span></div>
  </div></body></html>`;
}

// ── HTML: reporte general (interno) ────────────────────────
function htmlGeneral(d: GeneralReporte, fechaCorte: string) {
  const { html: celdasHtml, n } = celdas(d.aging);
  const tot = venc(d.aging) || 1;
  const barra = ORDEN.map(k => {
    const pct = (d.aging[k] / tot) * 100;
    return pct < 0.4 ? "" : `<div style="width:${pct}%;background:${COLORES[k]}"></div>`;
  }).join("");
  const leyenda = ORDEN.map(k => `<span><i style="background:${COLORES[k]}"></i>${ETIQ[k]} · ${((d.aging[k] / tot) * 100).toFixed(1)}%</span>`).join("");
  const filas = d.clientes.map(c => `<tr>
    <td class="fol">${esc(c.nombre)}${c.rfc ? `<div style="font-weight:400;font-size:9.5px;color:#94a3b8">${esc(c.rfc)}</div>` : ""}</td>
    <td class="r">${c.facturasPend}</td>
    <td class="r" style="color:${COLORES.d1_30}">${dash(c.aging.d1_30)}</td>
    <td class="r" style="color:${COLORES.d31_60}">${dash(c.aging.d31_60)}</td>
    <td class="r" style="color:${COLORES.d61_90}">${dash(c.aging.d61_90)}</td>
    <td class="r" style="color:${COLORES.d91};font-weight:700">${dash(c.aging.d91)}</td>
    <td class="r" style="font-weight:800">${money(venc(c.aging))}</td>
  </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}.page{padding:30px 34px}</style></head><body><div class="page">
    <div class="top">
      <img class="logo" src="${LOGO_URL}" crossorigin="anonymous" />
      <div class="ttl"><h1>REPORTE DE CARTERA</h1><p>Antigüedad de saldos · Corte al ${fecha(fechaCorte)}</p></div>
    </div>
    <div class="aging" style="grid-template-columns:repeat(${n},1fr);margin-top:18px">${celdasHtml}</div>
    <div class="bar">${barra}</div>
    <div class="leg">${leyenda}</div>
    <table>
      <thead><tr><th>Cliente</th><th class="r">Fact.</th><th class="r">1–30</th><th class="r">31–60</th><th class="r">61–90</th><th class="r">91+</th><th class="r">Total</th></tr></thead>
      <tbody>${filas}
        <tr class="tfoot"><td>TOTAL (${d.resumen.clientesPend} clientes)</td><td class="r">${d.resumen.facturasPend}</td>
          <td class="r">${dash(d.aging.d1_30)}</td><td class="r">${dash(d.aging.d31_60)}</td><td class="r">${dash(d.aging.d61_90)}</td><td class="r">${dash(d.aging.d91)}</td><td class="r">${money(venc(d.aging))}</td></tr>
      </tbody>
    </table>
    <div class="foot"><span>PIPSA Montacargas · Documento interno</span><span>Generado el ${ahora()}</span></div>
  </div></body></html>`;
}

// ── HTML → PDF (corta entre filas, nunca a media fila) ─────
async function htmlAPdf(html: string, archivo: string, ancho: number, orient: "portrait" | "landscape") {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${ancho}px;height:1px;border:none;visibility:hidden;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();

  // espera a que cargue el logo (máx. 4 s)
  await Promise.race([
    Promise.all(Array.from(doc.images).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = () => r(0); }))),
    new Promise(r => setTimeout(r, 4000)),
  ]);
  await new Promise(r => setTimeout(r, 250));

  const alto = Math.max(doc.body.scrollHeight, doc.body.offsetHeight, 600);
  iframe.style.height = alto + "px";
  await new Promise(r => setTimeout(r, 150));

  // límites seguros para cortar (parte baja de cada fila)
  const cortes = Array.from(doc.querySelectorAll("tbody tr, .cell, .note, .foot"))
    .map(el => (el as HTMLElement).getBoundingClientRect().bottom + (iframe.contentWindow?.scrollY ?? 0))
    .sort((a, b) => a - b);

  const canvas = await html2canvas(doc.body, {
    scale: 2, useCORS: true, allowTaint: false, width: ancho, height: alto,
    windowWidth: ancho, windowHeight: alto, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0,
  });
  document.body.removeChild(iframe);

  const pdf = new jsPDF({ orientation: orient, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const k = pageW / ancho;                 // pt por px CSS
  const pagCss = pageH / k;                // alto de página en px CSS

  const trozos: [number, number][] = [];
  let ini = 0;
  while (ini < alto - 1) {
    let fin = ini + pagCss;
    if (fin >= alto) fin = alto;
    else {
      const ok = cortes.filter(c => c <= fin && c > ini + pagCss * 0.4);
      if (ok.length) fin = ok[ok.length - 1] + 4;
    }
    trozos.push([ini, Math.min(fin, alto)]);
    ini = Math.min(fin, alto);
  }

  trozos.forEach(([a, b], i) => {
    if (i > 0) pdf.addPage();
    const h = (b - a) * 2;
    const pc = document.createElement("canvas");
    pc.width = canvas.width; pc.height = Math.max(1, Math.round(h));
    const ctx = pc.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, pc.width, pc.height);
    ctx.drawImage(canvas, 0, a * 2, canvas.width, h, 0, 0, canvas.width, h);
    pdf.addImage(pc.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, (b - a) * k);
  });
  pdf.save(archivo);
}

// ── API pública ────────────────────────────────────────────
export function descargarEstadoCuenta(d: DetalleReporte, fechaCorte: string) {
  return htmlAPdf(htmlEstadoCuenta(d, fechaCorte), `Estado-de-cuenta-${slug(d.cliente.nombre)}-${fechaCorte}.pdf`, 850, "portrait");
}
export function descargarReporteGeneral(d: GeneralReporte, fechaCorte: string) {
  return htmlAPdf(htmlGeneral(d, fechaCorte), `Reporte-cartera-PIPSA-${fechaCorte}.pdf`, 1100, "landscape");
}