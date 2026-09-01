import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type ItemReporte = {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  total: number;
  imagen?: string;
  subconceptos?: { descripcion: string; precio: number }[];
};

export type CotizacionReporte = {
  folio: string;
  tipo: string;
  tipoPeriodo?: string;
  condiciones?: string;
  moneda?: "MXN" | "USD"; // ── NUEVO ──
  cliente?: { nombre: string; direccion?: string; telefono?: string; contacto?: string };
  montacargas?: {
    numeroEconomico?: string; marca: string; modelo: string; capacidad?: string;
    tipo?: string; serie?: string; alturaColapsada?: string; alturaLevante?: string;
    horquillas?: string; desplazadorLateral?: boolean; tipoLlantas?: string;
    voltaje?: string; tipoBateria?: string; incluyeCargador?: boolean;
    equipoSeguridad?: { alarmaReversa?: boolean; torretaAmbar?: boolean; luces?: boolean; extintor?: boolean };
  };
  equipoMarca?:  string;
  equipoModelo?: string;
  equipoSerie?:  string;
  asesor?: { nombre: string; puesto: string; telefono: string; email: string };
  fecha: string;
  lugar: string;
  descripcionServicio?: string;
  items: ItemReporte[];
  subtotal: number;
  iva: number;
  total: number;
  flete?: number;
  cursoDC3?: {
    modalidad?: string;
    participantes?: number;
    precioPorPersona?: number;
    duracionHoras?: number;
    incluyeConstancia?: boolean;
    lugar?: string;
  };
};

export type OrdenTrabajoReporte = {
  folio: string; fecha: string;
  cliente?: { nombre: string; direccion?: string; telefono?: string };
  montacargas?: {
    numeroEconomico?: string; marca?: string; modelo?: string; serie?: string;
    horometro?: number; horometroCierre?: number;
  };
  tipoServicio?: string; tecnico?: string; problema?: string;
  manoDeObra?: string; notasCierre?: string;
  refacciones?: { cantidad: number; descripcion: string; precio?: number }[];
  costoRefacciones?: number; costoManoObra?: number; observaciones?: string;
  firmaCliente?: string;
  fotoEquipoFinal?: string[]; // ← nuevo
};

// ── Helper moneda ──
function fmtMoneda(valor: number, moneda: "MXN" | "USD" = "MXN"): string {
  const simbolo = moneda === "USD" ? "USD $" : "$";
  return `${simbolo}${valor.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function generarPlantillaCondiciones(
  tipo: string,
  tipoPeriodo?: string,
  vigenciaDias: number = 30,
  entregaDias: number = 14,
  incluirCancelacion: boolean = false,
  moneda: "MXN" | "USD" = "MXN", // ── NUEVO ──
): string {
  const monedaTexto = moneda === "USD" ? "dólares americanos (USD)" : "pesos mexicanos";
  const monedaSimbolo = moneda === "USD" ? "USD" : "M.N.";
  const lineas: string[] = [];

  if (tipo === "renta") {
    const plazoLabel: Record<string, string> = { semanal: "1 semana", mensual: "1 mes", anual: "1 año" };
    const plazo = plazoLabel[tipoPeriodo ?? "mensual"] ?? "1 mes";
    lineas.push(`Contrato por ${plazo}.`);
    if (incluirCancelacion) lineas.push("Términos de Cancelación: Se puede cancelar contrato con 60 días de anticipación después de los 6 meses.");
    lineas.push(`Todos los precios son en ${monedaTexto} más IVA.`);
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("La renta del equipo incluye mantenimiento preventivo cada 500 horas y mantenimientos correctivos sin costo mientras el daño no sea ocasionado por mal uso.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días a partir de la firma de contrato.`);
  } else if (tipo === "venta") {
    lineas.push(`Todos los precios son en ${monedaTexto} más IVA.`);
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("El equipo se entrega en las condiciones descritas en esta cotización.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días, sujeto a disponibilidad.`);
  } else if (tipo === "refacciones") {
    lineas.push(`Todos los precios son en ${monedaTexto} más IVA.`);
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("Las existencias son salvo previa venta.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días a partir de la confirmación del pedido.`);
  } else if (tipo === "curso") {
    lineas.push(`Todos los precios son en ${monedaTexto} más IVA.`);
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("El curso incluye material didáctico y evaluación teórica y práctica.");
    lineas.push("La calificación mínima aprobatoria es de 80%.");
    lineas.push("Los participantes que no aprueben el examen teórico no podrán realizar la evaluación práctica.");
    lineas.push("La constancia DC-3 ante la STPS se entrega únicamente a los participantes que aprueben ambas evaluaciones.");
    lineas.push("El cliente deberá proporcionar: sala de juntas o salón, cañón proyector, hojas blancas y plumas.");
    lineas.push("Para la evaluación práctica, el cliente deberá tener disponible un montacargas en buen estado.");
  } else {
    lineas.push(`Los precios son considerados para su pago en ${monedaTexto} (${monedaSimbolo}) y causan el 16% de IVA.`);
    lineas.push("El servicio solo incluye lo señalado en esta cotización.");
    lineas.push("De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.");
    lineas.push(`Vigencia de la cotización, es de ${vigenciaDias} días naturales.`);
    lineas.push("Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados.");
    lineas.push("En partes eléctricas no hay garantía.");
    lineas.push("Las existencias son salvo previa venta.");
  }

  return lineas.join("\n");
}

function condicionesHtml(cot: CotizacionReporte): string {
  if (cot.condiciones?.trim()) {
    return cot.condiciones.split("\n").filter(l => l.trim()).map(l => `<li>${l.trim()}</li>`).join("");
  }
  return generarPlantillaCondiciones(cot.tipo, cot.tipoPeriodo, 30, 14, false, cot.moneda).split("\n").map(l => `<li>${l}</li>`).join("");
}

function htmlCurso(cot: CotizacionReporte): string {
  const [fy, fm, fd] = cot.fecha.split("T")[0].split("-");
  const fecha = new Date(+fy, +fm - 1, +fd).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
  const moneda = cot.moneda ?? "MXN";

  const asesorNombre = cot.asesor?.nombre   ?? "Tania Hernandez";
  const asesorPuesto = cot.asesor?.puesto   ?? "Ventas";
  const asesorTel    = cot.asesor?.telefono ?? "33 3856 8329";
  const asesorEmail  = cot.asesor?.email    ?? "pipsamontacargas@hotmail.com";

  const clienteNombre   = cot.cliente?.nombre    ?? "";
  const clienteDirec    = cot.cliente?.direccion ?? "";
  const clienteTel      = cot.cliente?.telefono  ?? "";
  const clienteContacto = cot.cliente?.contacto  ?? "";

  const dc3 = cot.cursoDC3 ?? {};
  const participantes    = dc3.participantes    ?? 1;
  const precioPorPersona = dc3.precioPorPersona ?? 0;
  const duracion         = dc3.duracionHoras    ?? 4;
  const incluyeConst     = dc3.incluyeConstancia !== false;
  const modalidadLabel: Record<string, string> = {
    "teorico":           "Teórico",
    "practico":          "Práctico",
    "teorico-practico":  "Teórico-Práctico",
  };
  const modalidad  = modalidadLabel[dc3.modalidad ?? "teorico-practico"] ?? "Teórico-Práctico";
  const lugarCurso = dc3.lugar ?? cot.lugar ?? "Instalaciones del cliente";

  const temasTeoricos = [
    "Introducción y parámetros de estándares nacionales e internacionales para ser un montacarguista calificado.",
    "Responsabilidades y obligaciones del operador y el porqué del entrenamiento para operadores de montacargas.",
    "Diferentes clases de montacargas: características y sus componentes.",
    "Definiciones y conceptos básicos de estabilidad y balance en un montacargas.",
    "Cómo realizar la inspección pre-turno y/o check list del equipo montacargas antes de comenzar a laborar.",
    "Pasos a seguir antes de comenzar a trabajar en un equipo montacargas y maniobras seguras al momento de trabajar en el equipo.",
    "Maniobras correctas y medidas de seguridad de la operación del equipo montacargas.",
    "Concientización con videos sobre los accidentes en un equipo montacargas.",
  ];

  const temasPracticos = [
    "Realización de la revisión Pre-Turno al equipo.",
    "Traslado de materiales.",
    "Técnica para manejo de los diferentes materiales, maniobras para estiba de producto sobre producto, en racks, carga y descarga de contenedores.",
    "Confiabilidad y Seguridad Peatonal al conducir en áreas de tráfico concurrido.",
    "Estacionado correcto del montacargas.",
  ];

  const mostrarTeorico  = dc3.modalidad !== "practico";
  const mostrarPractico = dc3.modalidad !== "teorico";

  const teoricoHtml = mostrarTeorico ? `
    <div class="modulo">
      <div class="modulo-title">📚 Curso Teórico <span class="modulo-dur">Duración aprox. ${duracion} horas</span></div>
      <ul class="temas-list">
        ${temasTeoricos.map(t => `<li>${t}</li>`).join("")}
      </ul>
      <div class="eval-nota">
        <strong>Evaluación teórica:</strong> Examen escrito (preguntas abiertas y opción múltiple).
        Duración máxima: 45 min. Calificación mínima aprobatoria: <strong>80%</strong>.
      </div>
    </div>` : "";

  const practicoHtml = mostrarPractico ? `
    <div class="modulo">
      <div class="modulo-title">🏭 Evaluación Práctica <span class="modulo-dur">15–20 min por participante</span></div>
      <ul class="temas-list">
        ${temasPracticos.map(t => `<li>${t}</li>`).join("")}
      </ul>
      <div class="eval-nota">
        Solo participantes que aprueben el examen teórico pueden realizar esta evaluación.
        Se realiza en las instalaciones del cliente evaluando el trabajo cotidiano del operador.
        Calificación mínima aprobatoria: <strong>80%</strong>.
      </div>
    </div>` : "";

  const requisitosHtml = `
    <div class="requisitos">
      <strong>Material requerido por el cliente:</strong>
      <ul>
        <li>Sala de juntas o salón con mesas</li>
        <li>Cañón proyector</li>
        <li>Hojas blancas, lápices y/o plumas</li>
        ${mostrarPractico ? "<li>Montacargas en buen estado para la evaluación práctica</li>" : ""}
        <li>Mesa de Coffee Break para los asistentes</li>
      </ul>
    </div>`;

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
    ".saludo { font-size: 10pt; margin: 12px 0 16px; line-height: 1.7; }",
    ".curso-titulo { font-size: 13pt; font-weight: 900; text-align: center; border: 2px solid #222; padding: 10px; margin: 12px 0; background: #f5f5f5; letter-spacing: 0.5px; }",
    ".ficha { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }",
    ".ficha-item { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; font-size: 10pt; }",
    ".ficha-label { font-size: 8pt; color: #666; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }",
    ".ficha-value { font-weight: 600; color: #222; }",
    ".modulo { margin: 14px 0; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }",
    ".modulo-title { background: #222; color: #fff; font-weight: 700; padding: 8px 14px; font-size: 10.5pt; display: flex; justify-content: space-between; align-items: center; }",
    ".modulo-dur { font-size: 8.5pt; font-weight: 400; color: #ccc; }",
    ".temas-list { padding: 10px 14px 10px 32px; font-size: 10pt; line-height: 1.9; }",
    ".temas-list li { margin-bottom: 2px; }",
    ".eval-nota { background: #fffbeb; border-top: 1px solid #f0d060; padding: 8px 14px; font-size: 9.5pt; color: #555; }",
    ".requisitos { margin: 14px 0; background: #f0f7ff; border: 1px solid #bbd6f5; border-radius: 4px; padding: 10px 14px; font-size: 10pt; }",
    ".requisitos ul { padding-left: 20px; margin-top: 6px; line-height: 1.9; }",
    ".precio-box { margin: 16px 0; border: 2px solid #222; border-radius: 4px; overflow: hidden; }",
    ".precio-header { background: #222; color: #fff; font-weight: 700; padding: 8px 14px; font-size: 10pt; }",
    "table.precio-table { width: 100%; border-collapse: collapse; font-size: 10pt; }",
    "table.precio-table thead { background: #444; color: #fff; }",
    "table.precio-table th { padding: 7px 12px; text-align: left; }",
    "table.precio-table th:last-child { text-align: right; }",
    "table.precio-table td { padding: 7px 12px; border-bottom: 1px solid #eee; }",
    "table.precio-table td:last-child { text-align: right; font-weight: 700; }",
    ".totals { text-align: right; padding: 10px 14px; background: #f9f9f9; border-top: 2px solid #222; }",
    ".total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; font-size: 10pt; }",
    ".grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }",
    ".constancia-badge { display: inline-block; background: #16a34a; color: #fff; border-radius: 20px; padding: 3px 12px; font-size: 9pt; font-weight: 700; margin-top: 8px; }",
    ".moneda-badge { display: inline-block; background: #1d4ed8; color: #fff; border-radius: 6px; padding: 2px 10px; font-size: 9pt; font-weight: 700; margin-bottom: 8px; }",
    ".conditions { margin-top: 18px; font-size: 9pt; line-height: 1.7; color: #444; }",
    ".conditions ul { margin-top: 6px; padding-left: 18px; }",
    ".conditions li { margin-bottom: 2px; }",
    ".signature { margin-top: 28px; font-size: 10pt; page-break-inside: avoid; break-inside: avoid; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 4px; }",
    "@media print { body { padding: 16px; } }",
    "</style>", "</head>", "<body>",

    `<p style="text-align:center;font-size:8.5pt;color:#888;margin-bottom:6px;letter-spacing:.08em">${cot.folio}</p>`,
    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="header-right">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    "Bahías de Huatulco No. 99-A, Col. Agua Blanca Industrial<br>",
    "45235, Zapopán, Jal.<br>",
    "www.pipsamontacargas.com",
    "</div>",
    "</div>",

    '<div class="client-info">',
    `<strong>${clienteNombre}.</strong><br>`,
    clienteDirec    ? clienteDirec + "<br>"                                     : "",
    clienteTel      ? "Tel. " + clienteTel + "<br>"                             : "",
    clienteContacto ? "<strong>At&#39;n: " + clienteContacto + "</strong><br>" : "",
    "</div>",

    moneda === "USD" ? `<div><span class="moneda-badge">💵 Precios en Dólares Americanos (USD)</span></div>` : "",

    `<div class="saludo">El equipo de <strong>Pipsa Montacargas</strong> le envía un cordial saludo y se pone a sus órdenes con cualquier duda que esta <strong>COTIZACIÓN</strong> le pueda generar.</div>`,

    `<div class="curso-titulo">Entrenamiento para el Operador de Montacargas:<br>El Manejo Seguro del Montacargas</div>`,

    '<div class="ficha">',
    `<div class="ficha-item"><div class="ficha-label">Modalidad</div><div class="ficha-value">${modalidad}</div></div>`,
    `<div class="ficha-item"><div class="ficha-label">Participantes</div><div class="ficha-value">${participantes} persona${participantes !== 1 ? "s" : ""}</div></div>`,
    `<div class="ficha-item"><div class="ficha-label">Duración total aprox.</div><div class="ficha-value">${duracion} horas</div></div>`,
    `<div class="ficha-item"><div class="ficha-label">Lugar</div><div class="ficha-value">${lugarCurso}</div></div>`,
    "</div>",

    incluyeConst ? `<div><span class="constancia-badge">✅ Incluye constancia DC-3 ante la STPS</span></div>` : "",

    teoricoHtml,
    practicoHtml,
    requisitosHtml,

    '<div class="precio-box">',
    '<div class="precio-header">💰 Inversión</div>',
    `<table class="precio-table">
      <thead><tr>
        <th>Concepto</th>
        <th>Participantes</th>
        <th style="text-align:right">Precio por persona</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>Curso ${modalidad} — Operador de Montacargas DC-3</td>
          <td style="text-align:center">${participantes}</td>
          <td style="text-align:right">${fmtMoneda(precioPorPersona, moneda)}</td>
          <td style="text-align:right;font-weight:700">${fmtMoneda(participantes * precioPorPersona, moneda)}</td>
        </tr>
      </tbody>
    </table>`,
    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>${fmtMoneda(cot.subtotal, moneda)}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>${fmtMoneda(cot.iva, moneda)}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>${fmtMoneda(cot.total, moneda)}</span></div>`,
    "</div>",
    "</div>",

    '<div class="conditions">',
    "<strong>Condiciones comerciales:</strong>",
    "<ul>", condicionesHtml(cot), "</ul>",
    "<p style='margin-top:8px;font-style:italic;'>En espera de vernos favorecidos con su elección, quedamos a sus órdenes para cualquier duda o comentario.</p>",
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

function htmlServicio(cot: CotizacionReporte): string {
  const [fy, fm, fd] = cot.fecha.split("T")[0].split("-");
  const fecha = new Date(+fy, +fm - 1, +fd).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
  const moneda = cot.moneda ?? "MXN";

  const asesorNombre = cot.asesor?.nombre   ?? "Juan Pablo Montúfar Cruz";
  const asesorPuesto = cot.asesor?.puesto   ?? "Asesor comercial";
  const asesorTel    = cot.asesor?.telefono ?? "33 1322 5453";
  const asesorEmail  = cot.asesor?.email    ?? "juanpablo@pipsamontacargas.com";

  const clienteNombre   = cot.cliente?.nombre    ?? "";
  const clienteDirec    = cot.cliente?.direccion ?? "";
  const clienteTel      = cot.cliente?.telefono  ?? "";
  const clienteContacto = cot.cliente?.contacto  ?? "";

  const equipoMarca  = cot.montacargas?.marca  ?? cot.equipoMarca  ?? "";
  const equipoModelo = cot.montacargas?.modelo ?? cot.equipoModelo ?? "";
  const equipoSerie  = cot.montacargas?.serie  ?? cot.equipoSerie  ?? "";

  const equipoTexto = [
    equipoMarca  ? `<strong>Marca:</strong> ${equipoMarca}`   : "",
    equipoModelo ? `<strong>Modelo:</strong> ${equipoModelo}` : "",
    equipoSerie  ? `<strong>Serie:</strong> ${equipoSerie}`   : "",
  ].filter(Boolean).join("&nbsp;&nbsp;&nbsp;");

  const itemsHtml = cot.items.map(item => {
    const subHtml = (item.subconceptos ?? []).map(s =>
      `<div class="subconcept">
        <span>${s.descripcion}</span>
        <span>${fmtMoneda(s.precio, moneda)}</span>
      </div>`
    ).join("");
    return `<tr>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;width:60px">${item.cantidad}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;width:60px;text-align:center">
        ${item.imagen ? `<img src="${item.imagen}" style="width:50px;height:50px;object-fit:cover;border-radius:4px" />` : ""}
      </td>
      <td style="padding:6px 8px;border:1px solid #ddd">
        <div style="white-space:pre-wrap">${item.descripcion.replace(/\n/g, "<br>")}</div>
        ${subHtml}
      </td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:110px">${fmtMoneda(item.precioUnitario, moneda)}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:110px">${fmtMoneda(item.total, moneda)}</td>
    </tr>`;
  }).join("");

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
    ".equipo-info { font-size: 10pt; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 7px 12px; margin-bottom: 10px; color: #333; }",
    ".subject { background: #f5f5f5; padding: 10px 14px; margin: 14px 0; font-weight: bold; border-left: 4px solid #222; font-size: 10pt; white-space: pre-wrap; }",
    ".intro { margin-bottom: 10px; font-size: 10pt; }",
    ".moneda-badge { display: inline-block; background: #1d4ed8; color: #fff; border-radius: 6px; padding: 2px 10px; font-size: 9pt; font-weight: 700; margin-bottom: 8px; }",
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
    ".signature { margin-top: 28px; text-align: center; font-size: 10pt; page-break-inside: avoid; break-inside: avoid; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }",
    ".folio-ref { text-align: center; font-size: 8.5pt; color: #888; margin-bottom: 6px; letter-spacing: 0.08em; }",
    ".subconcept { font-size: 9pt; color: #555; padding: 2px 0 2px 12px; display: flex; justify-content: space-between; border-top: 1px dotted #e0e0e0; margin-top: 3px; }",
    "@media print { body { padding: 16px; } }",
    "</style>", "</head>", "<body>",

    `<p class="folio-ref">${cot.folio}</p>`,
    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="header-right">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    "Bahías de Huatulco No. 99-A, Col. Agua Blanca Industrial<br>",
    "45235, Zapopán, Jal.<br>",
    "www.pipsamontacargas.com",
    "</div>",
    "</div>",

    '<div class="client-info">',
    `<strong>${clienteNombre}.</strong><br>`,
    clienteDirec    ? clienteDirec + "<br>"                                     : "",
    clienteTel      ? "Tel. " + clienteTel + "<br>"                             : "",
    clienteContacto ? "<strong>At&#39;n: " + clienteContacto + "</strong><br>" : "",
    "</div>",

    moneda === "USD" ? `<div><span class="moneda-badge">💵 Precios en Dólares Americanos (USD)</span></div>` : "",

    equipoTexto ? `<div class="equipo-info">🔧 <strong>Equipo:</strong>&nbsp;&nbsp;${equipoTexto}</div>` : "",
    cot.descripcionServicio ? `<div class="subject">${cot.descripcionServicio.replace(/\n/g, "<br>")}</div>` : "",
    `<p class="intro">Por medio de la presente, nos permitimos presentar la siguiente propuesta:</p>`,

    "<table>",
    "<thead><tr>",
    "<th style='width:60px'>CANTIDAD</th><th style='width:60px'>IMAGEN</th><th>DESCRIPCIÓN</th><th style='width:110px;text-align:right'>PRECIO U.</th><th style='width:110px;text-align:right'>TOTAL</th>",
    "</tr></thead>",
    "<tbody>", itemsHtml, "</tbody>",
    "</table>",

    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>${fmtMoneda(cot.subtotal, moneda)}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>${fmtMoneda(cot.iva, moneda)}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>${fmtMoneda(cot.total, moneda)}</span></div>`,
    "</div>",

    '<div class="conditions">',
    "<strong>Condiciones comerciales:</strong>",
    "<ul>", condicionesHtml(cot), "</ul>",
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

async function htmlVentaRenta(cot: CotizacionReporte): Promise<string> {
  const [fy, fm, fd] = cot.fecha.split("T")[0].split("-");
  const fecha = new Date(+fy, +fm - 1, +fd).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
  const moneda = cot.moneda ?? "MXN";

  const asesorNombre = cot.asesor?.nombre   ?? "Richard Kimche";
  const asesorPuesto = cot.asesor?.puesto   ?? "Director comercial";
  const asesorTel    = cot.asesor?.telefono ?? "33 3856 8329";
  const asesorEmail  = cot.asesor?.email    ?? "richard@pipsamontacargas.com";

  const clienteNombre   = cot.cliente?.nombre    ?? "";
  const clienteDirec    = cot.cliente?.direccion ?? "";
  const clienteTel      = cot.cliente?.telefono  ?? "";
  const clienteContacto = cot.cliente?.contacto  ?? "";

  const m = cot.montacargas;
  const tipoLabel = cot.tipo === "renta" ? "RENTA" : "VENTA";

  const equipoMarca  = m?.marca  ?? cot.equipoMarca  ?? "";
  const equipoModelo = m?.modelo ?? cot.equipoModelo ?? "";
  const equipoSerie  = m?.serie  ?? cot.equipoSerie  ?? "";

  const sistemaLabel = m?.tipo === "electrico" ? "Eléctrico"
    : m?.tipo === "gas"    ? "Gas LP"
    : m?.tipo === "diesel" ? "Diésel"
    : "";

  const equipoDatos = [
    equipoMarca    ? `<strong>Marca:</strong> ${equipoMarca}`     : "",
    equipoModelo   ? `<strong>Modelo:</strong> ${equipoModelo}`   : "",
    equipoSerie    ? `<strong>Serie:</strong> ${equipoSerie}`     : "",
    sistemaLabel   ? `<strong>Sistema:</strong> ${sistemaLabel}`  : "",
    m?.capacidad   ? `<strong>Capacidad:</strong> ${m.capacidad}` : "",
  ].filter(Boolean).join("&nbsp;&nbsp;&nbsp;");

  const itemsHtml = cot.items.map((item, idx) => {
    const subHtml = (item.subconceptos ?? []).map(s =>
      `<div class="subconcept">
        <span>${s.descripcion}</span>
        <span>${fmtMoneda(s.precio, moneda)}</span>
      </div>`
    ).join("");
    const equipoExtra = idx === 0 && equipoDatos
      ? `<div style="margin-top:6px;font-size:9pt;color:#555;border-top:1px dotted #ddd;padding-top:4px;">${equipoDatos}</div>`
      : "";
    return `<tr>
      <td style="padding:6px 8px;border:1px solid #ddd;width:80px;text-align:center;vertical-align:middle">
        ${item.imagen
          ? `<img src="${item.imagen}" style="width:70px;height:70px;object-fit:cover;border-radius:4px;display:block;margin:auto" />`
          : `<span style="color:#aaa;font-size:9pt">—</span>`}
      </td>
      <td style="padding:6px 8px;border:1px solid #ddd">
        <div style="white-space:pre-wrap">${item.descripcion.replace(/\n/g, "<br>")}</div>
        ${equipoExtra}
        ${subHtml}
      </td>
      <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;width:60px">${item.cantidad}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:120px">${fmtMoneda(item.precioUnitario, moneda)}</td>
      <td style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:120px">${fmtMoneda(item.total, moneda)}</td>
    </tr>`;
  }).join("");

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
    ".saludo { font-size: 10pt; margin: 12px 0; line-height: 1.7; }",
    ".section-title { font-weight: bold; font-size: 11pt; margin: 12px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }",
    ".moneda-badge { display: inline-block; background: #1d4ed8; color: #fff; border-radius: 6px; padding: 2px 10px; font-size: 9pt; font-weight: 700; margin-bottom: 8px; }",
    "table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }",
    "thead { background: #222; color: white; }",
    "thead th { padding: 8px; text-align: left; }",
    ".totals { margin-top: 12px; text-align: right; font-size: 10pt; }",
    ".total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 2px 0; }",
    ".grand-total { font-weight: bold; font-size: 12pt; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px; }",
    ".precio-nota { margin-top: 8px; font-size: 9pt; color: #555; font-style: italic; }",
    ".conditions { margin-top: 16px; font-size: 9pt; line-height: 1.7; color: #444; }",
    ".conditions strong { color: #222; }",
    ".conditions ul { margin-top: 6px; padding-left: 18px; }",
    ".conditions li { margin-bottom: 4px; }",
    ".signature { margin-top: 24px; font-size: 10pt; page-break-inside: avoid; break-inside: avoid; }",
    ".signature .name { font-weight: bold; font-size: 11pt; margin-top: 6px; }",
    ".folio-ref { text-align: center; font-size: 8.5pt; color: #888; margin-bottom: 6px; letter-spacing: 0.08em; }",
    ".subconcept { font-size: 9pt; color: #555; padding: 2px 0 2px 12px; display: flex; justify-content: space-between; border-top: 1px dotted #e0e0e0; margin-top: 3px; }",
    "@media print { body { padding: 16px; } }",
    "</style>", "</head>", "<body>",

    `<p class="folio-ref">${cot.folio}</p>`,
    '<div class="header">',
    '<div class="header-left">',
    `<img src="${logoUrl}" class="logo" alt="Pipsa" />`,
    '<div class="company-name">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>',
    "</div>",
    '<div class="header-right">',
    `<strong>${cot.lugar}; ${fecha}.</strong><br>`,
    "Bahías de Huatulco No. 99-A, Col. Agua blanca industrial<br>",
    "45235, Zapopán, Jal.<br>",
    "www.pipsamontacargas.com",
    "</div>",
    "</div>",

    '<div class="client-info">',
    `<strong>${clienteNombre}.</strong><br>`,
    clienteDirec    ? clienteDirec + "<br>"                                     : "",
    clienteTel      ? "Tel. " + clienteTel + "<br>"                             : "",
    clienteContacto ? "<strong>At&#39;n: " + clienteContacto + "</strong><br>" : "",
    "</div>",

    moneda === "USD" ? `<div><span class="moneda-badge">💵 Precios en Dólares Americanos (USD)</span></div>` : "",

    '<div class="saludo">',
    `El equipo de PIPSA Montacargas le envía un cordial saludo y se pone a sus órdenes con cualquier duda que esta COTIZACIÓN de <strong>${tipoLabel}</strong> le pueda generar.`,
    "</div>",

    '<div class="section-title">Conceptos</div>',
    `<table>
      <thead><tr>
        <th style="width:80px">IMAGEN</th>
        <th>DESCRIPCIÓN</th>
        <th style="width:60px;text-align:center">CANT.</th>
        <th style="width:120px;text-align:right">PRECIO U.</th>
        <th style="width:120px;text-align:right">SUBTOTAL</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>`,

    '<div class="totals">',
    `<div class="total-row"><span>SUB TOTAL</span><span>${fmtMoneda(cot.subtotal, moneda)}</span></div>`,
    `<div class="total-row"><span>IVA 16%</span><span>${fmtMoneda(cot.iva, moneda)}</span></div>`,
    `<div class="total-row grand-total"><span>TOTAL</span><span>${fmtMoneda(cot.total, moneda)}</span></div>`,
    cot.tipo === "renta" ? `<p class="precio-nota">* El precio indicado corresponde a la renta del equipo.</p>` : "",
    "</div>",

    '<div class="conditions">',
    "<strong>TÉRMINOS Y CONDICIONES COMERCIALES:</strong>",
    "<ul>", condicionesHtml(cot), "</ul>",
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

function htmlOrdenTrabajo(ot: OrdenTrabajoReporte): string {
  const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
  const fechaObj = new Date(ot.fecha);
  const dia  = String(fechaObj.getDate()).padStart(2, "0");
  const mes  = fechaObj.toLocaleDateString("es-MX", { month: "short" });
  const anio = String(fechaObj.getFullYear()).slice(2);

  const refaccionesHtml = (ot.refacciones ?? []).map(r =>
    `<tr>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;width:70px">${r.cantidad}</td>
      <td style="padding:6px 10px;border:1px solid #ccc">${r.descripcion}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:right;width:100px">
        ${r.precio ? `$${r.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : ""}
      </td>
    </tr>`
  ).join("");

  const filasFaltantes = Math.max(0, 8 - (ot.refacciones?.length ?? 0));
  const filasVacias = Array(filasFaltantes).fill(
    `<tr>
      <td style="padding:6px 10px;border:1px solid #ccc;height:28px">&nbsp;</td>
      <td style="padding:6px 10px;border:1px solid #ccc">&nbsp;</td>
      <td style="padding:6px 10px;border:1px solid #ccc">&nbsp;</td>
    </tr>`
  ).join("");

  const totalCosto = (ot.costoRefacciones ?? 0) + (ot.costoManoObra ?? 0);

  // ── Bloque de firma del cliente: imagen si existe, línea en blanco si no ──
  const firmaClienteHtml = ot.firmaCliente
    ? `<img src="${ot.firmaCliente}" style="max-height:44px;max-width:200px;object-fit:contain;display:block;margin:0 auto 2px;" alt="Firma del cliente" />`
    : "";

  // ── Cuadrícula de fotos del equipo (hasta 5) ──
  const MAX_FOTOS_REPORTE = 6;
  const totalFotos = ot.fotoEquipoFinal?.length ?? 0;
  const fotosAMostrar = (ot.fotoEquipoFinal ?? []).slice(0, MAX_FOTOS_REPORTE);

  const fotosEquipoHtml = totalFotos > 0
    ? `<div class="ref-section">
        <div class="ref-title">📸 Fotos del equipo${totalFotos > MAX_FOTOS_REPORTE ? ` (mostrando ${MAX_FOTOS_REPORTE} de ${totalFotos})` : ""}</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(fotosAMostrar.length, 6)},1fr);gap:4px;padding:6px;">
          ${fotosAMostrar.map(url =>
            `<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:3px;border:1px solid #ccc;" />`
          ).join("")}
        </div>
        ${totalFotos > MAX_FOTOS_REPORTE ? `<p style="font-size:8pt;color:#888;text-align:center;padding:4px;">+ ${totalFotos - MAX_FOTOS_REPORTE} foto${totalFotos - MAX_FOTOS_REPORTE > 1 ? "s" : ""} más disponible${totalFotos - MAX_FOTOS_REPORTE > 1 ? "s" : ""} en el sistema</p>` : ""}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${ot.folio}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; background: #fff; }
  .page { display: grid; grid-template-columns: 110px 1fr; min-height: 100vh; }
  .sidebar-logos { border-right: 2px solid #111; display: flex; flex-direction: column; align-items: center; padding: 8px 4px; gap: 10px; }
  .sidebar-logos img { width: 90px; object-fit: contain; }
  .brand-text { font-weight: 900; font-size: 11pt; letter-spacing: 1px; text-align: center; line-height: 1.1; }
  .brand-text.raymond { color: #cc0000; font-style: italic; }
  .brand-text.caterpillar { color: #f0a500; font-size: 9pt; }
  .brand-text.toyota { color: #cc0000; font-size: 9pt; }
  .brand-text.nissan { color: #222; font-size: 9pt; }
  .brand-text.komatsu { color: #f0a500; font-size: 10pt; }
  .main { padding: 10px 14px; }
  .top-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .company-info { text-align: center; font-size: 9pt; line-height: 1.6; flex: 1; }
  .company-info strong { font-size: 10pt; }
  .order-box { border: 2px solid #111; min-width: 140px; }
  .order-box .order-title { background: #e8a000; color: #111; font-weight: 900; text-align: center; padding: 3px 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; }
  .order-box .order-number { text-align: center; font-size: 18pt; font-weight: 900; color: #cc0000; padding: 4px 8px; }
  .date-box { border: 2px solid #111; margin-top: 6px; }
  .date-box .date-title { background: #e8a000; color: #111; font-weight: 900; text-align: center; padding: 3px 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; }
  .date-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; font-size: 8pt; color: #555; }
  .date-grid div { padding: 2px 4px; border-right: 1px solid #ccc; }
  .date-grid div:last-child { border-right: none; }
  .date-values { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; font-size: 12pt; font-weight: 700; }
  .date-values div { padding: 2px 4px; border-right: 1px solid #ccc; border-top: 1px solid #ccc; }
  .date-values div:last-child { border-right: none; }
  .doc-title { text-align: center; font-size: 13pt; font-weight: 900; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 4px 0; margin: 8px 0; letter-spacing: 2px; text-transform: uppercase; }
  .field-row { display: flex; align-items: stretch; margin-bottom: 6px; border: 1px solid #ccc; }
  .field-label { background: #f0f0f0; font-weight: 700; font-size: 8pt; padding: 4px 8px; min-width: 90px; text-transform: uppercase; display: flex; align-items: center; border-right: 1px solid #ccc; text-align: center; justify-content: center; }
  .field-value { padding: 4px 10px; flex: 1; font-size: 10pt; min-height: 28px; }
  .unit-section { border: 1px solid #ccc; margin-bottom: 6px; }
  .unit-title { background: #222; color: #fff; font-weight: 700; font-size: 9pt; text-align: center; padding: 3px; text-transform: uppercase; letter-spacing: 1px; }
  .unit-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; }
  .unit-cell { padding: 4px 8px; border-right: 1px solid #ccc; }
  .unit-cell:last-child { border-right: none; }
  .unit-cell-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #555; }
  .unit-cell-value { font-size: 10pt; min-height: 20px; }
  .ref-section { border: 1px solid #ccc; margin-bottom: 6px; }
  .ref-title { background: #e8a000; color: #111; font-weight: 900; font-size: 9pt; text-align: center; padding: 4px; text-transform: uppercase; letter-spacing: 2px; }
  .ref-table { width: 100%; border-collapse: collapse; }
  .ref-table thead th { background: #e8a000; color: #111; font-weight: 700; font-size: 8.5pt; padding: 5px 10px; text-align: center; border: 1px solid #ccc; text-transform: uppercase; letter-spacing: 1px; }
  .ref-table thead th:nth-child(2) { text-align: left; }
  .ref-table tbody tr:nth-child(even) { background: #fafafa; }
  .totals-row { display: flex; justify-content: flex-end; gap: 0; border-top: 2px solid #111; margin-top: 2px; }
  .total-item { padding: 4px 14px; font-size: 9.5pt; border-left: 1px solid #ccc; }
  .total-item strong { font-size: 11pt; }
  .obs-section { border: 1px solid #ccc; margin-bottom: 10px; }
  .obs-label { font-weight: 700; font-size: 8.5pt; text-transform: uppercase; padding: 4px 8px; background: #f0f0f0; border-bottom: 1px solid #ccc; }
  .obs-value { padding: 6px 10px; font-size: 9.5pt; min-height: 60px; line-height: 1.6; white-space: pre-wrap; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
  .firma-box { text-align: center; }
  .firma-line { border-top: 1.5px solid #111; margin-top: 40px; padding-top: 4px; font-size: 9pt; font-weight: 700; text-transform: uppercase; }
  .firma-box.cliente .firma-line { margin-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="sidebar-logos">
    <img src="${logoUrl}" alt="Pipsa" style="width:95px;background:#000;border-radius:4px;padding:4px" />
    <div style="border-top:1px solid #ccc;width:100%;margin:4px 0"></div>
    <div style="text-align:center;font-size:8pt;color:#555;font-style:italic">Montacargas</div>
    <div style="background:#f5c000;padding:3px 6px;border-radius:3px;width:90px;text-align:center">
      <span style="font-weight:900;font-size:13pt;font-style:italic;color:#111">Yale</span>
      <span style="font-size:7pt;color:#333;display:block">MONTACARGAS</span>
    </div>
    <div style="background:#222;padding:3px 6px;border-radius:3px;width:90px;text-align:center">
      <span style="font-weight:900;font-size:12pt;color:#fff;letter-spacing:1px">Crown</span>
    </div>
    <div style="background:#f5a000;padding:3px 6px;border-radius:3px;width:90px;text-align:center">
      <span style="font-weight:900;font-size:11pt;color:#111;letter-spacing:1px">HYSTER</span>
    </div>
    <div style="border-top:1px solid #ccc;width:100%;margin:4px 0"></div>
    <p class="brand-text raymond">RAYMOND</p>
    <p class="brand-text caterpillar">CATERPILLAR®</p>
    <p class="brand-text toyota">🚗 TOYOTA<br><span style="font-size:7pt;color:#555">Equipos Industriales</span></p>
    <p class="brand-text nissan">NISSAN<br>FORKLIFT</p>
    <p class="brand-text komatsu">KOMATSU</p>
  </div>

  <div class="main">
    <div class="top-header">
      <div class="company-info">
        <strong>C. Bahías de Huatulco No.99</strong><br>
        Col. Agua Blanca Industrial C.P. 45235<br>
        Tels. 33 3856 8329 / 33 3440 0214<br>
        Zapopán, Jal., Méx.<br>
        <strong>pipsamontacargas@hotmail.com</strong><br>
        <strong>www.pipsamontacargas.com</strong>
      </div>
      <div>
        <div class="order-box">
          <div class="order-title">Orden de Trabajo</div>
          <div class="order-number">${ot.folio.replace("SRV-", "")}</div>
        </div>
        <div class="date-box">
          <div class="date-title">Fecha</div>
          <div class="date-grid"><div>DÍA</div><div>MES</div><div>AÑO</div></div>
          <div class="date-values"><div>${dia}</div><div>${mes}</div><div>${anio}</div></div>
        </div>
      </div>
    </div>

    <div class="doc-title">Servicio de Montacargas</div>

    <div class="field-row">
      <div class="field-label">Cliente</div>
      <div class="field-value">${ot.cliente?.nombre ?? ""}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Domicilio</div>
      <div class="field-value">${ot.cliente?.direccion ?? ""}</div>
    </div>

    <div class="unit-section">
      <div class="unit-title">Datos de la Unidad</div>
      <div class="unit-grid">
        <div class="unit-cell"><div class="unit-cell-label">Marca</div><div class="unit-cell-value">${ot.montacargas?.marca ?? ""}</div></div>
        <div class="unit-cell"><div class="unit-cell-label">Modelo</div><div class="unit-cell-value">${ot.montacargas?.modelo ?? ""}</div></div>
        <div class="unit-cell"><div class="unit-cell-label">Serie</div><div class="unit-cell-value">${ot.montacargas?.serie ?? ""}</div></div>
      </div>
      <div style="border-top:1px solid #ccc">
        <div class="unit-grid">
          <div class="unit-cell" style="grid-column:1/2">
            <div class="unit-cell-label">Horómetro entrada</div>
            <div class="unit-cell-value">${ot.montacargas?.horometro ?? ""} hrs</div>
          </div>
          <div class="unit-cell" style="grid-column:2/4">
            <div class="unit-cell-label">Falla reportada</div>
            <div class="unit-cell-value">${ot.problema ?? ""}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="field-row" style="min-height:60px;align-items:flex-start">
      <div class="field-label" style="padding-top:6px">Mano de Obra</div>
      <div class="field-value" style="white-space:pre-wrap">${ot.manoDeObra ?? ot.notasCierre ?? ""}</div>
    </div>

    <div class="ref-section">
      <div class="ref-title">Refacciones</div>
      <table class="ref-table">
        <thead>
          <tr>
            <th style="width:70px">Cantidad</th>
            <th>Descripción</th>
            <th style="width:100px;text-align:right">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${refaccionesHtml}
          ${filasVacias}
        </tbody>
      </table>
    </div>

    ${totalCosto > 0 ? `
    <div class="totals-row">
      ${ot.costoRefacciones ? `<div class="total-item">Refacciones: <strong>$${ot.costoRefacciones.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong></div>` : ""}
      ${ot.costoManoObra ? `<div class="total-item">Mano de obra: <strong>$${ot.costoManoObra.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong></div>` : ""}
      <div class="total-item">Total: <strong>$${totalCosto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong></div>
    </div>` : ""}

    ${fotosEquipoHtml}

    <div class="obs-section">
      <div class="obs-label">Observaciones:</div>
      <div class="obs-value">${ot.observaciones ?? ""}</div>
    </div>

    <div class="firmas">
      <div class="firma-box"><div class="firma-line">Técnico: ${ot.tecnico ?? "_____________________"}</div></div>
      <div class="firma-box cliente">
        ${firmaClienteHtml}
        <div class="firma-line">Cliente: ${ot.firmaCliente ? (ot.cliente?.nombre ?? "") : "_____________________"}</div>
      </div>
    </div>
  </div>
</div>
<script>window.onload = function() { document.title = '${ot.folio}'; };</script>
</body>
</html>`;
}

function resolverHtml(cot: CotizacionReporte): Promise<string> | string {
  if (cot.tipo === "venta" || cot.tipo === "renta") return htmlVentaRenta(cot);
  if (cot.tipo === "curso")                          return htmlCurso(cot);
  return htmlServicio(cot);
}

export async function generarReporte(cot: CotizacionReporte) {
  abrirVentana(await Promise.resolve(resolverHtml(cot)));
}

export async function imprimirReporte(cot: CotizacionReporte) {
  const html = await Promise.resolve(resolverHtml(cot));
  const htmlConPrint = html.replace(
    `window.onload = function() { document.title = '${cot.folio}'; };`,
    `window.onload = function() { document.title = '${cot.folio}'; setTimeout(function(){ window.print(); }, 600); window.onafterprint = function(){ window.close(); }; };`
  );
  abrirVentana(htmlConPrint);
}

export function imprimirOrdenTrabajo(ot: OrdenTrabajoReporte) {
  const folio = ot.folio ?? "OT";
  const html = htmlOrdenTrabajo({ ...ot, folio });
  const htmlConPrint = html.replace(
    `window.onload = function() { document.title = '${folio}'; };`,
    `window.onload = function() { document.title = '${folio}'; setTimeout(function(){ window.print(); }, 600); window.onafterprint = function(){ window.close(); }; };`
  );
  abrirVentana(htmlConPrint);
}

export function generarOrdenTrabajo(ot: OrdenTrabajoReporte) {
  const folio = ot.folio ?? "OT";
  abrirVentana(htmlOrdenTrabajo({ ...ot, folio }));
}

function abrirVentana(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function descargarPDF(cot: CotizacionReporte) {
  const html = await Promise.resolve(resolverHtml(cot));

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:850px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();

  await new Promise(r => setTimeout(r, 1800));

  const body       = doc.body;
  const alturaReal = Math.max(body.scrollHeight, body.offsetHeight, 1200);
  iframe.style.height = alturaReal + "px";

  await new Promise(r => setTimeout(r, 300));

  const signatureEl = doc.querySelector(".signature") as HTMLElement | null;
  const signatureTop = signatureEl
    ? signatureEl.getBoundingClientRect().top + (iframe.contentWindow?.scrollY ?? 0)
    : null;

  const canvas = await html2canvas(body, {
    scale: 2, useCORS: true, allowTaint: true,
    width: 850, height: alturaReal,
    windowWidth: 850, windowHeight: alturaReal,
    backgroundColor: "#ffffff", scrollY: 0, scrollX: 0,
  });

  document.body.removeChild(iframe);

  const pdf   = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const scale    = pageW / canvas.width;
  const imgH     = canvas.height * scale;
  const pageImgH = pageH / scale;

  if (imgH <= pageH) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, imgH);
  } else {
    const totalPx = canvas.height;
    const cuts: number[] = [];
    let cursor = 0;

    while (cursor < totalPx) {
      let nextCut = cursor + pageImgH;
      if (nextCut >= totalPx) break;
      if (signatureTop !== null) {
        const signatureTopPx = signatureTop * 2;
        if (nextCut > signatureTopPx && cursor < signatureTopPx) {
          nextCut = signatureTopPx - 10;
        }
      }
      cuts.push(nextCut);
      cursor = nextCut;
    }

    let srcY = 0;
    let page = 0;
    const allCuts = [...cuts, totalPx];

    for (const cutY of allCuts) {
      if (page > 0) pdf.addPage();
      const sliceH     = cutY - srcY;
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width  = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, sliceH * scale);
      srcY = cutY;
      page++;
    }
  }

  pdf.save(`${cot.folio}.pdf`);
}