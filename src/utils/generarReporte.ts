export type ItemReporte = {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  total: number;
  imagen?: string;
};

export type CotizacionReporte = {
  folio: string;
  tipo: string;
  cliente?: { nombre: string; direccion?: string; telefono?: string; contacto?: string };
  montacargas?: {
    numeroEconomico?: string;
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
  asesor?: { nombre: string; puesto: string; telefono: string; email: string };
  fecha: string;
  lugar: string;
  descripcionServicio?: string;
  items: ItemReporte[];
  subtotal: number;
  iva: number;
  total: number;
  flete?: number;
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function si(val?: boolean) { return val ? "Sí" : "No"; }

function specRow(label: string, val?: string | boolean | null) {
  if (!val && val !== false) return "";
  const display = typeof val === "boolean" ? si(val) : val;
  return `<tr>
    <td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;width:220px">${label}</td>
    <td style="padding:5px 10px;border:1px solid #ddd">${display}</td>
  </tr>`;
}

// ── HTML SERVICIO ─────────────────────────────────────────────────────────────

function htmlServicio(cot: CotizacionReporte): string {
  const fecha   = new Date(cot.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";

  const asesorNombre = cot.asesor?.nombre   ?? "Juan Pablo Montúfar Cruz";
  const asesorPuesto = cot.asesor?.puesto   ?? "Asesor comercial";
  const asesorTel    = cot.asesor?.telefono ?? "33 1322 5453";
  const asesorEmail  = cot.asesor?.email    ?? "juanpablo@pipsamontacargas.com";

  const clienteNombre   = cot.cliente?.nombre    ?? "";
  const clienteDirec    = cot.cliente?.direccion ?? "";
  const clienteTel      = cot.cliente?.telefono  ?? "";
  const clienteContacto = cot.cliente?.contacto  ?? "";

  const itemsHtml = cot.items.map(item =>
    `<tr>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;width:60px">${item.cantidad}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;width:60px;text-align:center">
        ${item.imagen ? `<img src="${item.imagen}" style="width:50px;height:50px;object-fit:cover;border-radius:4px" />` : ""}
      </td>
      <td style="padding:6px 8px;border:1px solid #ddd">${item.descripcion}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:110px">$${item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:110px">$${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
    </tr>`
  ).join("");

  return [
    "<!DOCTYPE html>", '<html lang="es">', "<head>", '<meta charset="UTF-8">',
    `<title>${cot.folio}</title>`,
    "<style>",
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; max-width: 820px; margin: auto; }",
    ".header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 2px solid #222; }",
    ".header-left { display: flex; align-items: center; gap: 14px; }",
    ".logo { width: 70px; height: 70px; object-fit: contain; background: #000; border-radius: 6px; }",
    ".company-name { font-size: 12pt; font-weight: bold; max-width: 340px; line-height: 1.3; }",
    ".header-right { text-align: right; font-size: 10pt; line-height: 1.7; }",
    ".client-info { font-size: 10pt; line-height: 1.8; margin: 12px 0; padding-bottom: 10px; border-bottom: 1px solid #ccc; }",
    ".subject { background: #f5f5f5; padding: 10px 14px; margin: 14px 0; font-weight: bold; border-left: 4px solid #222; font-size: 10pt; }",
    ".intro { margin-bottom: 10px; font-size: 10pt; }",
    "table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }",
    "thead { background: #222; color: white; }",
    "thead th { padding: 8px; text-align: left; }",
    "thead th:last-child, thead th:nth-child(4) { text-align: right; }",
    ".totals { margin-top: 8px; text-align: right; font-size: 10pt; }",
    ".total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }",
    ".grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }",
    ".conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }",
    ".conditions strong { color: #222; }",
    ".conditions ul { margin-top: 6px; padding-left: 18px; }",
    ".conditions li { margin-bottom: 2px; }",
    ".signature { margin-top: 28px; text-align: center; font-size: 10pt; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }",
    "@media print { body { padding: 16px; } }",
    "</style>", "</head>", "<body>",

    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="header-right">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    "Bahías de Huatulco No. 99-A, Col. Agua blanca industrial<br>",
    "45602, Zapopán, Jal.<br>",
    "www.pipsamontacargas.com",
    "</div>",
    "</div>",

    '<div class="client-info">',
    `<strong>${clienteNombre}.</strong><br>`,
    clienteDirec    ? clienteDirec + "<br>"                    : "",
    clienteTel      ? "Tel. " + clienteTel + "<br>"            : "",
    clienteContacto ? "At&#39;n: " + clienteContacto + "<br>" : "",
    cot.montacargas ? "Montacargas <strong>" + cot.montacargas.marca + " " + cot.montacargas.modelo + ".</strong>" : "",
    "</div>",

    cot.descripcionServicio ? `<div class="subject">${cot.descripcionServicio}</div>` : "",
    `<p class="intro">Por medio de la presente, nos permitimos presentar la siguiente propuesta:</p>`,

    "<table>",
    "<thead><tr>",
    "<th style='width:60px'>CANTIDAD</th><th style='width:60px'>IMAGEN</th><th>DESCRIPCIÓN</th><th style='width:110px;text-align:right'>PRECIO U.</th><th style='width:110px;text-align:right'>TOTAL</th>",
    "</tr></thead>",
    "<tbody>", itemsHtml, "</tbody>",
    "</table>",

    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>$${cot.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>$${cot.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>$${cot.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    "</div>",

    '<div class="conditions">',
    "<strong>Condiciones comerciales:</strong>",
    "<ul>",
    "<li><strong>Los precios son considerados para su pago pesos M.N. y causan el 16% de IVA.</strong></li>",
    "<li>El servicio solo incluye lo señalado en esta cotización.</li>",
    "<li>De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.</li>",
    "<li>Vigencia de la cotización, es de 15 días naturales.</li>",
    "<li><strong>Para confirmar el servicio de reparación, se deberán realizar transferencia del 50% del importe de esta cotización.</strong></li>",
    "<li>Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados.</li>",
    "<li>En partes eléctricas no hay garantía.</li>",
    "<li>Las existencias son salvo previa venta.</li>",
    "</ul>",
    "<p style='margin-top:8px;font-style:italic;'>En espera de vernos favorecidos con su pedido, quedamos a sus órdenes, para cualquier duda o comentario.</p>",
    "</div>",

    '<div class="signature">',
    "<strong>A T E N T A M E N T E.</strong>",
    `<div class="name">${asesorNombre}.</div>`,
    `${asesorPuesto}.<br>`,
    `Cel. ${asesorTel}<br>`,
    asesorEmail,
    "</div>",

    `<script>window.onload = function() { document.title = '${cot.folio}'; };</script>`,
    "</body>", "</html>",
  ].join("\n");
}

// ── HTML VENTA / RENTA ────────────────────────────────────────────────────────

function htmlVentaRenta(cot: CotizacionReporte): string {
  const fecha   = new Date(cot.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";

  const asesorNombre = cot.asesor?.nombre   ?? "Richard Kimche";
  const asesorPuesto = cot.asesor?.puesto   ?? "Director comercial";
  const asesorTel    = cot.asesor?.telefono ?? "33 3856 8329";
  const asesorEmail  = cot.asesor?.email    ?? "richard@pipsamontacargas.com";

  const clienteNombre = cot.cliente?.nombre ?? "";
  const m = cot.montacargas;
  const tipoLabel = cot.tipo === "renta" ? "RENTA" : "VENTA";
  const esElectrico = m?.tipo === "electrico";

  // ── Specs del equipo ──
  const specsRows = [
    specRow("Marca",                    m?.marca),
    specRow("Modelo",                   m?.modelo),
    specRow("Serie",                    m?.serie),
    specRow("Sistema",                  m?.tipo ? (m.tipo === "electrico" ? "Eléctrico" : m.tipo === "gas" ? "Gas LP" : "Diésel") : null),
    specRow("Capacidad de carga",       m?.capacidad),
    specRow("Altura de levante",        m?.alturaLevante),
    // Gas / Diesel
    !esElectrico ? specRow("Altura contraído",        m?.alturaColapsada)   : "",
    !esElectrico ? specRow("Horquillas",              m?.horquillas)        : "",
    !esElectrico ? specRow("Desplazador lateral",     m?.desplazadorLateral !== undefined ? (m.desplazadorLateral ? "Sí" : null) : null) : "",
    // Eléctrico
    esElectrico  ? specRow("Voltaje",                 m?.voltaje)           : "",
    esElectrico  ? specRow("Tipo de batería",         m?.tipoBateria)       : "",
    esElectrico  ? specRow("Incluye cargador",        m?.incluyeCargador ? "Sí" : null) : "",
    // Llantas
    specRow("Tipo de llantas",          m?.tipoLlantas),
  ].join("");

  // ── Equipo de seguridad ──
  const segItems = [
    m?.equipoSeguridad?.alarmaReversa ? "Alarma de reversa" : "",
    m?.equipoSeguridad?.torretaAmbar  ? "Torreta ámbar"     : "",
    m?.equipoSeguridad?.luces         ? "Luces"             : "",
    m?.equipoSeguridad?.extintor      ? "Extintor"          : "",
  ].filter(Boolean);

  const segHtml = segItems.length > 0
    ? `<tr>
        <td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;width:220px;vertical-align:top">Equipo de seguridad</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${segItems.join(", ")}</td>
      </tr>`
    : "";

  const itemsHtml = cot.items.map(item =>
    `<tr>
      <td style="padding:6px 8px;border:1px solid #ddd">${item.descripcion}</td>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd">${item.cantidad}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
    </tr>`
  ).join("");

  return [
    "<!DOCTYPE html>", '<html lang="es">', "<head>", '<meta charset="UTF-8">',
    `<title>${cot.folio}</title>`,
    "<style>",
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; max-width: 820px; margin: auto; }",
    ".header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 2px solid #222; }",
    ".header-left { display: flex; align-items: center; gap: 14px; }",
    ".logo { width: 70px; height: 70px; object-fit: contain; background: #000; border-radius: 6px; }",
    ".company-name { font-size: 12pt; font-weight: bold; max-width: 340px; line-height: 1.3; }",
    ".header-right { text-align: right; font-size: 10pt; line-height: 1.7; }",
    ".saludo { font-size: 10pt; margin: 16px 0; line-height: 1.7; }",
    ".section-title { font-weight: bold; font-size: 11pt; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }",
    "table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }",
    "thead { background: #222; color: white; }",
    "thead th { padding: 8px; text-align: left; }",
    "thead th:last-child, thead th:nth-child(3) { text-align: right; }",
    "thead th:nth-child(2) { text-align: center; }",
    ".totals { margin-top: 12px; text-align: right; font-size: 10pt; }",
    ".total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }",
    ".grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }",
    ".conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }",
    ".conditions strong { color: #222; }",
    ".conditions ul { margin-top: 6px; padding-left: 18px; }",
    ".conditions li { margin-bottom: 4px; }",
    ".signature { margin-top: 28px; font-size: 10pt; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }",
    "@media print { body { padding: 16px; } }",
    "</style>", "</head>", "<body>",

    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="header-right">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    "Bahías de Huatulco No. 99-A, Col. Agua blanca industrial<br>",
    "45602, Zapopán, Jal.<br>",
    "www.pipsamontacargas.com",
    "</div>",
    "</div>",

    '<div class="saludo">',
    `<strong># ${clienteNombre}</strong><br><br>`,
    `El equipo de PIPSA Montacargas le envía un cordial saludo y se pone a sus órdenes con cualquier duda que esta COTIZACIÓN de <strong>${tipoLabel}</strong> le pueda generar.`,
    "</div>",

    m ? '<div class="section-title">Datos del Equipo</div>' : "",
    m ? `<table><tbody>${specsRows}${segHtml}</tbody></table>` : "",

    cot.items.length > 0 ? '<div class="section-title">Conceptos Adicionales</div>' : "",
    cot.items.length > 0 ? `<table><thead><tr><th>DESCRIPCIÓN</th><th style='width:80px;text-align:center'>CANTIDAD</th><th style='width:120px;text-align:right'>PRECIO U.</th><th style='width:120px;text-align:right'>SUBTOTAL</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : "",

    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>$${cot.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>$${cot.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>$${cot.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    "</div>",

    '<div class="conditions">',
    "<strong>TÉRMINOS Y CONDICIONES COMERCIALES:</strong>",
    "<ul>",
    cot.tipo === "renta" ? "<li>Contrato por 1 año.</li>" : "",
    cot.tipo === "renta" ? "<li>Términos de Cancelación: Se puede cancelar contrato con 60 días de anticipación después de los 6 meses.</li>" : "",
    "<li>Todos los precios son en pesos mexicanos más IVA.</li>",
    "<li>Vigencia de la cotización: 30 días a partir de la fecha del documento.</li>",
    cot.tipo === "renta" ? "<li>La renta del equipo incluye mantenimiento preventivo cada 500 horas y mantenimientos correctivos sin costo mientras el daño no sea ocasionado por mal uso.</li>" : "",
    cot.tipo === "renta" ? "<li>Tiempo de entrega: 2 semanas a partir de la firma de contrato.</li>" : "",
    cot.tipo === "venta" ? "<li>El equipo se entrega en las condiciones descritas en esta cotización.</li>" : "",
    cot.tipo === "venta" ? "<li>Tiempo de entrega sujeto a disponibilidad.</li>" : "",
    "</ul>",
    "</div>",

    '<div class="signature">',
    "<strong>Le Atendió:</strong>",
    `<div class="name">${asesorNombre}</div>`,
    `${asesorPuesto}<br>`,
    `<strong>Tel: ${asesorTel}</strong><br>`,
    asesorEmail,
    "</div>",

    `<script>window.onload = function() { document.title = '${cot.folio}'; };</script>`,
    "</body>", "</html>",
  ].join("\n");
}

// ── EXPORTS PÚBLICOS ──────────────────────────────────────────────────────────

export function generarReporte(cot: CotizacionReporte) {
  const html = cot.tipo === "venta" || cot.tipo === "renta"
    ? htmlVentaRenta(cot)
    : htmlServicio(cot);
  abrirVentana(html);
}

export function imprimirReporte(cot: CotizacionReporte) {
  const html = cot.tipo === "venta" || cot.tipo === "renta"
    ? htmlVentaRenta(cot)
    : htmlServicio(cot);
  const htmlConPrint = html.replace(
    `window.onload = function() { document.title = '${cot.folio}'; };`,
    `window.onload = function() { document.title = '${cot.folio}'; setTimeout(function(){ window.print(); }, 600); window.onafterprint = function(){ window.close(); }; };`
  );
  abrirVentana(htmlConPrint);
}

function abrirVentana(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}