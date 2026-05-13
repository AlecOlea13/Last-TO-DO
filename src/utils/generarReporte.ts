export type ItemReporte = { cantidad: number; descripcion: string; precioUnitario: number; total: number };
export type CotizacionReporte = {
  folio: string;
  tipo: string;
  cliente?: { nombre: string };
  montacargas?: { marca: string; modelo: string };
  fecha: string;
  lugar: string;
  descripcionServicio?: string;
  items: ItemReporte[];
  subtotal: number;
  iva: number;
  total: number;
};

export function generarReporte(cot: CotizacionReporte) {
  const fecha = new Date(cot.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "/Pipsa_logo_png.png";

  const itemsHtml = cot.items.map(item =>
    `<tr>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd">${item.cantidad}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${item.descripcion}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd">$${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
    </tr>`
  ).join("");

  const html = [
    "<!DOCTYPE html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="UTF-8">',
    `<title>${cot.folio}</title>`,
    "<style>",
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; max-width: 820px; margin: auto; }",
    ".header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #222; }",
    ".header-left { display: flex; align-items: center; gap: 14px; }",
    ".logo { width: 70px; height: 70px; object-fit: contain; background: #000; border-radius: 6px; }",
    ".company-name { font-size: 12pt; font-weight: bold; max-width: 340px; line-height: 1.3; }",
    ".client-block { text-align: right; font-size: 10pt; line-height: 1.7; }",
    ".subject { background: #f5f5f5; padding: 10px 14px; margin: 14px 0; font-weight: bold; border-left: 4px solid #222; font-size: 10pt; }",
    ".intro { margin-bottom: 10px; font-size: 10pt; }",
    "table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }",
    "thead { background: #222; color: white; }",
    "thead th { padding: 8px; text-align: left; }",
    "thead th:first-child { text-align: center; width: 60px; }",
    "thead th:last-child, thead th:nth-child(3) { text-align: right; width: 110px; }",
    ".totals { margin-top: 8px; text-align: right; font-size: 10pt; }",
    ".total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }",
    ".grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }",
    ".conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }",
    ".conditions strong { color: #222; }",
    ".signature { margin-top: 28px; text-align: center; font-size: 10pt; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }",
    ".footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #666; text-align: center; }",
    "@media print { body { padding: 16px; } }",
    "</style>",
    "</head>",
    "<body>",
    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="client-block">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    `${cot.cliente?.nombre ?? ""}.<br>`,
    `${cot.montacargas ? cot.montacargas.marca + " " + cot.montacargas.modelo + "." : ""}`,
    "</div>",
    "</div>",
    cot.descripcionServicio ? `<div class="subject">${cot.descripcionServicio}</div>` : "",
    `<p class="intro">Por medio de la presente, nos permitimos presentar la siguiente ${cot.tipo === "servicio" ? "propuesta" : "información"}:</p>`,
    "<table>",
    "<thead><tr>",
    "<th>CANTIDAD</th><th>DESCRIPCIÓN</th><th>PRECIO U.</th><th>TOTAL</th>",
    "</tr></thead>",
    "<tbody>",
    itemsHtml,
    "</tbody>",
    "</table>",
    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>$${cot.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>$${cot.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>$${cot.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>`,
    "</div>",
    '<div class="conditions">',
    "<strong>Condiciones comerciales:</strong><br>",
    "<strong>Los precios son considerados para su pago pesos M.N. y causan el 16% de IVA.</strong>",
    " El servicio solo incluye lo señalado en esta cotización. De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.",
    " Vigencia de la cotización, es de 15 días naturales.",
    " <strong>Para confirmar el servicio de reparación, se deberán realizar transferencia del 50% del importe de esta cotización.</strong>",
    " Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados. En partes eléctricas no hay garantía. Las existencias son salvo previa venta.",
    " <em>En espera de vernos favorecidos con su pedido, quedamos a sus órdenes, para cualquier duda o comentario.</em>",
    "</div>",
    '<div class="signature">',
    "<strong>A T E N T A M E N T E.</strong>",
    '<div class="name">Juan Pablo Montúfar Cruz.</div>',
    "Asesor comercial.<br>",
    "Cel. 33 1322 5453<br>",
    "juanpablo@pipsamontacargas.com",
    "</div>",
    '<div class="footer">',
    "Bahías de Huatulco No. 99-A, Col. Agua blanca industrial, 45602, Zapopán, Jal. &nbsp;|&nbsp; www.pipsamontacargas.com",
    "</div>",
    "<script>",
    "window.onload = function() { setTimeout(function() { window.print(); }, 500); window.onafterprint = function() { window.close(); }; };",
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}