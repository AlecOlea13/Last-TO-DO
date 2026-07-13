import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { generarReporte, descargarPDF } from "../utils/generarReporte";

type SubConcepto = { descripcion: string; precio: number };
type Item = {
  cantidad: number; descripcion: string; precioUnitario: number;
  total: number; imagen?: string; subconceptos?: SubConcepto[];
};
type Asesor = { _id: string; nombre: string; puesto: string; telefono: string; email: string };
type Comentario = { _id: string; texto: string; autor: { _id: string; nombre: string; rol: string }; fecha: string };
type ClienteOcasional = { nombre: string; direccion?: string; telefono?: string; contacto?: string };

type Cotizacion = {
  _id: string; folio: string; tipo: "servicio" | "renta" | "venta" | "refacciones";
  tipoPeriodo?: "semanal" | "mensual" | "anual";
  condiciones?: string;
  cliente?: { _id: string; nombre: string; direccion?: string; telefono?: string; contacto?: string };
  clienteOcasional?: ClienteOcasional;
  montacargas?: {
    _id: string; numeroEconomico: string; marca: string; modelo: string; capacidad?: string;
    tipo?: string; serie?: string; alturaColapsada?: string; alturaLevante?: string;
    horquillas?: string; desplazadorLateral?: boolean; tipoLlantas?: string;
    voltaje?: string; tipoBateria?: string; incluyeCargador?: boolean;
    equipoSeguridad?: { alarmaReversa?: boolean; torretaAmbar?: boolean; luces?: boolean; extintor?: boolean };
  };
  asesor?: { _id: string; nombre: string; puesto: string; telefono: string; email: string };
  fecha: string; lugar: string; descripcionServicio?: string;
  items: Item[]; subtotal: number; iva: number; total: number;
  estatus: "activa" | "facturada" | "cancelada";
  numeroFactura?: string;
  notas?: string; comentarios: Comentario[];
  equipoMarca?: string; equipoModelo?: string; equipoSerie?: string;
};

type Cliente = { _id: string; nombre: string };
type Montacargas = {
  _id: string; numeroEconomico: string; marca: string; modelo: string; capacidad?: string;
  tipo?: string; serie?: string; alturaColapsada?: string; alturaLevante?: string;
  horquillas?: string; desplazadorLateral?: boolean; tipoLlantas?: string;
  voltaje?: string; tipoBateria?: string; incluyeCargador?: boolean;
  equipoSeguridad?: { alarmaReversa?: boolean; torretaAmbar?: boolean; luces?: boolean; extintor?: boolean };
  costoSemana?: number; costoMes?: number; costoAnual?: number; precioVenta?: number;
  clienteActual?: { _id: string; nombre: string } | null;
};
type TipoServicio = {
  _id: string; nombre: string; descripcion?: string; intervaloHrs?: number;
  itemsChecklist: string[]; precioTotal: number;
  refacciones: { nombre: string; cantidad: number }[];
};
type RefaccionCatalogo = { _id: string; nombre: string; numeroParte?: string; precio?: number; unidad?: string };

const emptyClienteOcasional: ClienteOcasional = { nombre: "", direccion: "", telefono: "", contacto: "" };
const emptyForm: any = {
  folio: "", tipo: "servicio", cliente: "", esOcasional: false,
  clienteOcasional: { ...emptyClienteOcasional },
  montacargas: "", asesor: "", tipoPeriodo: "mensual", condiciones: "",
  fecha: new Date().toISOString().split("T")[0], lugar: "Zapopán, Jal",
  descripcionServicio: "", items: [], subtotal: 0, iva: 0, total: 0,
  estatus: "activa", notas: "",
  equipoMarca: "", equipoModelo: "", equipoSerie: "",
};
const emptyItem: Item = { cantidad: 1, descripcion: "", precioUnitario: 0, total: 0, imagen: "", subconceptos: [] };
const emptySubconcepto: SubConcepto = { descripcion: "", precio: 0 };

const TIPO_BADGE: Record<string, string> = { servicio: "badge-amber", renta: "badge-blue", venta: "badge-green", refacciones: "badge-purple" };
const ESTATUS_BADGE: Record<string, string> = { activa: "badge-green", facturada: "badge-blue", cancelada: "badge-gray" };
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

// ── Helpers de semana (martes a lunes) ──
function getMartes(date: Date): Date {
  const d = new Date(date);
  // Forzar a mediodia para evitar problemas de timezone
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0=dom,1=lun,2=mar,3=mie,4=jue,5=vie,6=sab
  const diff = day === 2 ? 0 : day === 3 ? -1 : day === 4 ? -2 : day === 5 ? -3 : day === 6 ? -4 : day === 0 ? -5 : -6;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function getFinSemana(martes: Date): Date {
  const d = new Date(martes);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}
function semanaLabel(martes: Date): string {
  const fin = getFinSemana(martes);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${martes.toLocaleDateString("es-MX", opts)} – ${fin.toLocaleDateString("es-MX", { ...opts, year: "numeric" })}`;
}
function toInputWeek(martes: Date): string {
  const tmp = new Date(martes);
  tmp.setHours(12, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const semana1 = new Date(tmp.getFullYear(), 0, 4);
  const nSemana = 1 + Math.round(((tmp.getTime() - semana1.getTime()) / 86400000 - 3 + ((semana1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(nSemana).padStart(2, "0")}`;
}
function fromInputWeek(val: string): Date {
  // El input type="week" siempre da el lunes ISO — le sumamos 1 para llegar al martes
  const [year, week] = val.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const lunes = new Date(startOfWeek1);
  lunes.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  // Sumamos 1 día para ir de lunes ISO → martes pipsa
  lunes.setDate(lunes.getDate() + 1);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function SearchableSelect({
  value, onChange, options, placeholder, renderLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { _id: string; label: string }[];
  placeholder: string;
  renderLabel?: (opt: { _id: string; label: string }) => string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o._id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  function select(id: string) { onChange(id); setQuery(""); setOpen(false); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          className="form-input"
          value={open ? query : (selected ? (renderLabel ? renderLabel(selected) : selected.label) : "")}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          placeholder={placeholder}
          style={{ paddingRight: 32 }}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1 }}>✕</button>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.85rem" }}>Sin resultados</div>
          ) : filtered.map(o => (
            <div key={o._id} onClick={() => select(o._id)}
              style={{ padding: "10px 14px", cursor: "pointer", fontSize: "0.88rem", background: o._id === value ? "rgba(245,158,11,0.1)" : "transparent", color: o._id === value ? "var(--accent)" : "var(--text)", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = o._id === value ? "rgba(245,158,11,0.1)" : "transparent")}>
              {renderLabel ? renderLabel(o) : o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function generarPlantillaCondiciones(tipo: string, tipoPeriodo?: string, vigenciaDias: number = 30, entregaDias: number = 14, incluirCancelacion: boolean = false): string {
  const lineas: string[] = [];
  if (tipo === "renta") {
    const plazoLabel: Record<string, string> = { semanal: "1 semana", mensual: "1 mes", anual: "1 año" };
    const plazo = plazoLabel[tipoPeriodo ?? "mensual"] ?? "1 mes";
    lineas.push(`Contrato por ${plazo}.`);
    if (incluirCancelacion) lineas.push("Términos de Cancelación: Se puede cancelar contrato con 60 días de anticipación después de los 6 meses.");
    lineas.push("Todos los precios son en pesos mexicanos más IVA.");
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("La renta del equipo incluye mantenimiento preventivo cada 500 horas y mantenimientos correctivos sin costo mientras el daño no sea ocasionado por mal uso.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días a partir de la firma de contrato.`);
  } else if (tipo === "venta") {
    lineas.push("Todos los precios son en pesos mexicanos más IVA.");
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("El equipo se entrega en las condiciones descritas en esta cotización.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días, sujeto a disponibilidad.`);
  } else if (tipo === "refacciones") {
    lineas.push("Todos los precios son en pesos mexicanos más IVA.");
    lineas.push(`Vigencia de la cotización: ${vigenciaDias} días a partir de la fecha del documento.`);
    lineas.push("Las existencias son salvo previa venta.");
    lineas.push(`Tiempo de entrega: ${entregaDias} días a partir de la confirmación del pedido.`);
  } else {
    lineas.push("Los precios son considerados para su pago pesos M.N. y causan el 16% de IVA.");
    lineas.push("El servicio solo incluye lo señalado en esta cotización.");
    lineas.push("De presentar alguna falla adicional ó requerir alguna refacción adicional, se cotizará por aparte.");
    lineas.push(`Vigencia de la cotización, es de ${vigenciaDias} días naturales.`);
    lineas.push("Por ningún motivo, se cancelarán los pedidos u órdenes de compra presentados.");
    lineas.push("En partes eléctricas no hay garantía.");
    lineas.push("Las existencias son salvo previa venta.");
  }
  return lineas.join("\n");
}

export default function Cotizaciones() {
  const rol        = localStorage.getItem("rol") ?? "";
  const canComment = ["developer", "gerencia", "oficina"].includes(rol);
  const canDelete  = ["developer", "gerencia"].includes(rol);

  const [cotizaciones, setCotizaciones]               = useState<Cotizacion[]>([]);
  const [clientes, setClientes]                       = useState<Cliente[]>([]);
  const [montas, setMontas]                           = useState<Montacargas[]>([]);
  const [asesores, setAsesores]                       = useState<Asesor[]>([]);
  const [tiposServicio, setTiposServicio]             = useState<TipoServicio[]>([]);
  const [refaccionesCatalogo, setRefaccionesCatalogo] = useState<RefaccionCatalogo[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [search, setSearch]                           = useState("");
  const [filtro, setFiltro]                           = useState("activa");
  const [filtroAsesor, setFiltroAsesor]               = useState("todos");
  const [modal, setModal]                             = useState(false);
  const [editing, setEditing]                         = useState<Cotizacion | null>(null);
  const [comentarioModal, setComentarioModal]         = useState<Cotizacion | null>(null);
  const [nuevoComentario, setNuevoComentario]         = useState("");
  const [facturaModal, setFacturaModal]               = useState<Cotizacion | null>(null);
  const [numeroFacturaInput, setNumeroFacturaInput]   = useState("");
  const [form, setForm]                               = useState<any>(emptyForm);
  const [saving, setSaving]                           = useState(false);
  const [savingComentario, setSavingComentario]       = useState(false);
  const [uploadingIdx, setUploadingIdx]               = useState<number | null>(null);
  const [verTodosMontas, setVerTodosMontas]           = useState(false);

  // ── Reporte semanal ──
  const [modalReporte, setModalReporte] = useState(false);
  const [semanaInicio, setSemanaInicio] = useState<Date>(getMartes(new Date()));

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [co, cl, mo, as, ts, rf] = await Promise.all([
        api.get("/cotizaciones"), api.get("/clientes"),
        api.get("/montacargas"), api.get("/asesores"),
        api.get("/tipos-servicio"),
        api.get("/refacciones").catch(() => ({ data: [] })),
      ]);
      setCotizaciones(co.data);
      setClientes(cl.data.filter((c: any) => c.estatus === "activo"));
      setMontas(mo.data);
      setAsesores(as.data);
      setTiposServicio(ts.data);
      setRefaccionesCatalogo(rf.data);
    } catch {}
    finally { setLoading(false); }
  }

  // ── Lógica del reporte semanal ──
  function getCotizacionesSemana(): Cotizacion[] {
    const desde = semanaInicio;
    const hasta = getFinSemana(semanaInicio);
    return cotizaciones.filter(c => {
      const f = new Date(c.fecha);
      return f >= desde && f <= hasta;
    });
  }

  type GrupoAsesor = {
    nombre: string;
    cotizaciones: Cotizacion[];
    total: number;
    facturadas: number;
    activas: number;
    canceladas: number;
  };

  function agruparPorAsesor(cots: Cotizacion[]): GrupoAsesor[] {
    const mapa = new Map<string, GrupoAsesor>();
    for (const c of cots) {
      const key    = c.asesor?._id ?? "__sin_asesor__";
      const nombre = c.asesor?.nombre ?? "Sin asesor asignado";
      if (!mapa.has(key)) mapa.set(key, { nombre, cotizaciones: [], total: 0, facturadas: 0, activas: 0, canceladas: 0 });
      const g = mapa.get(key)!;
      g.cotizaciones.push(c);
      g.total += c.total;
      if (c.estatus === "facturada") g.facturadas++;
      else if (c.estatus === "activa") g.activas++;
      else g.canceladas++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }

  function openNew() {
    setEditing(null);
    setVerTodosMontas(false);
    setForm({ ...emptyForm, folio: "", clienteOcasional: { ...emptyClienteOcasional }, items: [{ ...emptyItem, subconceptos: [] }] });
    setModal(true);
  }

  function openEdit(c: Cotizacion) {
    setEditing(c);
    setVerTodosMontas(false);
    const esOcasional = !c.cliente && !!c.clienteOcasional?.nombre;
    setForm({
      folio: c.folio, tipo: c.tipo, tipoPeriodo: c.tipoPeriodo ?? "mensual", condiciones: c.condiciones ?? "",
      cliente: c.cliente?._id ?? "", esOcasional,
      clienteOcasional: c.clienteOcasional ?? { ...emptyClienteOcasional },
      montacargas: c.montacargas?._id ?? "", asesor: c.asesor?._id ?? "",
      fecha: c.fecha.split("T")[0], lugar: c.lugar, descripcionServicio: c.descripcionServicio ?? "",
      items: c.items.map(i => ({ ...i, subconceptos: i.subconceptos ?? [] })),
      subtotal: c.subtotal, iva: c.iva, total: c.total, estatus: c.estatus, notas: c.notas ?? "",
      equipoMarca: c.equipoMarca ?? "", equipoModelo: c.equipoModelo ?? "", equipoSerie: c.equipoSerie ?? "",
    });
    setModal(true);
  }

  function clonar(c: Cotizacion) {
    setEditing(null);
    setVerTodosMontas(false);
    setForm({
      folio: "", tipo: c.tipo, tipoPeriodo: c.tipoPeriodo ?? "mensual", condiciones: c.condiciones ?? "",
      cliente: c.cliente?._id ?? "", esOcasional: !c.cliente && !!c.clienteOcasional?.nombre,
      clienteOcasional: c.clienteOcasional ?? { ...emptyClienteOcasional },
      montacargas: c.montacargas?._id ?? "", asesor: c.asesor?._id ?? "",
      fecha: new Date().toISOString().split("T")[0], lugar: c.lugar, descripcionServicio: c.descripcionServicio ?? "",
      items: c.items.map(i => ({ ...i, subconceptos: i.subconceptos ?? [] })),
      subtotal: c.subtotal, iva: c.iva, total: c.total, estatus: "activa", notas: c.notas ?? "",
      equipoMarca: c.equipoMarca ?? "", equipoModelo: c.equipoModelo ?? "", equipoSerie: c.equipoSerie ?? "",
    });
    setModal(true);
  }

  async function marcarFacturada() {
    if (!facturaModal || !numeroFacturaInput.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/cotizaciones/${facturaModal._id}`, { estatus: "facturada", numeroFactura: numeroFacturaInput.trim() });
      setCotizaciones(prev => prev.map(c => c._id === facturaModal._id ? { ...c, ...data } : c));
      setFacturaModal(null);
      setNumeroFacturaInput("");
    } catch {}
    finally { setSaving(false); }
  }

  function recalcTotales(items: Item[]) {
    const subtotal = items.reduce((acc, it) => acc + it.total, 0);
    const iva      = subtotal * 0.16;
    return { subtotal, iva, total: subtotal + iva };
  }

  function addItem() { setForm((p: any) => ({ ...p, items: [...p.items, { ...emptyItem, subconceptos: [] }] })); }

  function removeItem(i: number) {
    setForm((p: any) => {
      const items = p.items.filter((_: any, idx: number) => idx !== i);
      return { ...p, items, ...recalcTotales(items) };
    });
  }

  function updateItem(i: number, field: string, val: any) {
    setForm((p: any) => {
      const items = [...p.items];
      items[i] = { ...items[i], [field]: val };
      if (field === "cantidad" || field === "precioUnitario") {
        if (!items[i].subconceptos?.length) items[i].total = items[i].cantidad * items[i].precioUnitario;
      }
      return { ...p, items, ...recalcTotales(items) };
    });
  }

  function aplicarRefaccionCatalogo(i: number, refaccionId: string) {
    if (!refaccionId) return;
    const r = refaccionesCatalogo.find(rf => rf._id === refaccionId);
    if (!r) return;
    setForm((p: any) => {
      const items = [...p.items];
      const cantidad = items[i].cantidad || 1;
      items[i] = { ...items[i], descripcion: r.numeroParte ? `${r.nombre} (${r.numeroParte})` : r.nombre, precioUnitario: r.precio ?? 0, total: cantidad * (r.precio ?? 0) };
      return { ...p, items, ...recalcTotales(items) };
    });
  }

  function generarConceptoAutomatico(montaId: string, tipo: string, periodo: "semanal" | "mensual" | "anual") {
    const m = montas.find(m => m._id === montaId);
    if (!m) return;
    let descripcion = ""; let precio = 0;
    if (tipo === "venta") {
      if (!m.precioVenta) { alert("Este equipo no tiene precio de venta registrado."); return; }
      descripcion = `Venta de Montacargas ${m.marca ?? ""} ${m.modelo ?? ""} #${m.numeroEconomico}${m.capacidad ? " Capacidad " + m.capacidad : ""}${m.serie ? " Serie " + m.serie : ""}`.trim();
      precio = m.precioVenta;
    } else if (tipo === "renta") {
      const precios: Record<string, number> = { semanal: m.costoSemana ?? 0, mensual: m.costoMes ?? 0, anual: m.costoAnual ?? 0 };
      precio = precios[periodo];
      if (!precio) { alert(`Este equipo no tiene costo ${periodo} registrado.`); return; }
      const periodoLabel: Record<string, string> = { semanal: "semanal", mensual: "mensual", anual: "anual" };
      descripcion = `Renta de Montacargas ${m.marca ?? ""} ${m.modelo ?? ""} #${m.numeroEconomico}${m.capacidad ? " Capacidad " + m.capacidad : ""}${m.serie ? " Serie " + m.serie : ""} — periodo ${periodoLabel[periodo]}`.trim();
    }
    if (!descripcion || !precio) return;
    setForm((p: any) => {
      const items = [...p.items];
      items[0] = { ...items[0], descripcion, precioUnitario: precio, total: items[0].cantidad * precio, subconceptos: [] };
      return { ...p, items, ...recalcTotales(items) };
    });
  }

  function aplicarTipoServicio(tipoId: string) {
    const t = tiposServicio.find(t => t._id === tipoId);
    if (!t) return;
    const checklist = (t.itemsChecklist ?? []).map(item => `• ${item}`).join("\n");
    const refaccionesList = t.refacciones.length > 0 ? "\n\nRefacciones:\n" + t.refacciones.map(r => `• ${r.cantidad} ${r.nombre}`).join("\n") : "";
    const descripcionCompleta = [t.nombre, t.descripcion ? `\n${t.descripcion}` : "", checklist ? `\n\nSolo se checa:\n${checklist}` : "", refaccionesList].filter(Boolean).join("");
    const precio = t.precioTotal ?? 0;
    setForm((p: any) => {
      const items = [...p.items];
      items[0] = { ...items[0], descripcion: descripcionCompleta, precioUnitario: precio, total: items[0].cantidad * precio, subconceptos: [] };
      return { ...p, descripcionServicio: t.descripcion ?? p.descripcionServicio, items, ...recalcTotales(items) };
    });
  }

  function addSubconcepto(itemIdx: number) {
    setForm((p: any) => { const items = [...p.items]; items[itemIdx] = { ...items[itemIdx], subconceptos: [...(items[itemIdx].subconceptos ?? []), { ...emptySubconcepto }] }; return { ...p, items }; });
  }
  function removeSubconcepto(itemIdx: number, subIdx: number) {
    setForm((p: any) => {
      const items = [...p.items];
      const subs = items[itemIdx].subconceptos?.filter((_: any, i: number) => i !== subIdx) ?? [];
      const suma = subs.reduce((acc: number, s: SubConcepto) => acc + s.precio, 0);
      items[itemIdx] = { ...items[itemIdx], subconceptos: subs, precioUnitario: suma, total: items[itemIdx].cantidad * suma };
      return { ...p, items, ...recalcTotales(items) };
    });
  }
  function updateSubconcepto(itemIdx: number, subIdx: number, field: keyof SubConcepto, val: any) {
    setForm((p: any) => {
      const items = [...p.items];
      const subs = [...(items[itemIdx].subconceptos ?? [])];
      subs[subIdx] = { ...subs[subIdx], [field]: val };
      const suma = subs.reduce((acc: number, s: SubConcepto) => acc + s.precio, 0);
      items[itemIdx] = { ...items[itemIdx], subconceptos: subs, precioUnitario: suma, total: items[itemIdx].cantidad * suma };
      return { ...p, items, ...recalcTotales(items) };
    });
  }

  async function subirImagen(i: number, file: File) {
    setUploadingIdx(i);
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const data = await res.json();
      updateItem(i, "imagen", data.secure_url);
    } catch { alert("Error al subir imagen"); }
    finally { setUploadingIdx(null); }
  }

  async function save() {
    const tieneClienteValido = form.esOcasional ? !!form.clienteOcasional?.nombre?.trim() : !!form.cliente;
    if (!tieneClienteValido) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      delete payload.esOcasional;
      if (form.esOcasional) {
        payload.cliente = null;
        payload.clienteOcasional = { nombre: form.clienteOcasional.nombre?.trim(), direccion: form.clienteOcasional.direccion?.trim() || undefined, telefono: form.clienteOcasional.telefono?.trim() || undefined, contacto: form.clienteOcasional.contacto?.trim() || undefined };
      } else {
        payload.clienteOcasional = null;
      }
      if (editing) {
        const { data } = await api.put(`/cotizaciones/${editing._id}`, payload);
        setCotizaciones(prev => prev.map(c => c._id === editing._id ? { ...c, ...data } : c));
      } else {
        if (!payload.folio) delete payload.folio;
        const { data } = await api.post("/cotizaciones", payload);
        setCotizaciones(prev => [data, ...prev]);
      }
      setModal(false); setEditing(null); load();
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

  async function enviarComentario() {
    if (!comentarioModal || !nuevoComentario.trim()) return;
    setSavingComentario(true);
    try {
      const { data } = await api.post(`/cotizaciones/${comentarioModal._id}/comentarios`, { texto: nuevoComentario.trim() });
      setCotizaciones(prev => prev.map(c => c._id === comentarioModal._id ? { ...c, comentarios: data } : c));
      setComentarioModal(prev => prev ? { ...prev, comentarios: data } : null);
      setNuevoComentario("");
    } catch {}
    finally { setSavingComentario(false); }
  }

  async function eliminarComentario(cotId: string, comentId: string) {
    if (!confirm("¿Eliminar este comentario?")) return;
    await api.delete(`/cotizaciones/${cotId}/comentarios/${comentId}`);
    setCotizaciones(prev => prev.map(c => c._id === cotId ? { ...c, comentarios: c.comentarios.filter(cm => cm._id !== comentId) } : c));
    setComentarioModal(prev => prev ? { ...prev, comentarios: prev.comentarios.filter(cm => cm._id !== comentId) } : null);
  }

  function fmt(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtHora(date: string) {
    return new Date(date).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function nombreCliente(c: Cotizacion): string {
    return c.cliente?.nombre ?? c.clienteOcasional?.nombre ?? "—";
  }
  function precioBaseConcepto(c: Cotizacion): number | null {
    if ((c.tipo === "renta" || c.tipo === "venta") && c.items.length > 0) return c.items[0].precioUnitario;
    return null;
  }

  const clienteOpts = clientes.map(c => ({ _id: c._id, label: c.nombre }));
  const asesorOpts  = asesores.map(a => ({ _id: a._id, label: a.nombre }));

  const montasDelCliente  = form.cliente ? montas.filter(m => m.clienteActual?._id === form.cliente) : [];
  const montasDisponibles = verTodosMontas || !form.cliente || montasDelCliente.length === 0 ? montas : montasDelCliente;
  const montaOpts         = montasDisponibles.map(m => ({ _id: m._id, label: `${m.numeroEconomico} — ${m.marca} ${m.modelo}` }));

  const filtered = cotizaciones.filter(c => {
    const matchSearch =
      c.folio.toLowerCase().includes(search.toLowerCase()) ||
      nombreCliente(c).toLowerCase().includes(search.toLowerCase()) ||
      (c.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.numeroFactura ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "todos" || c.tipo === filtro || c.estatus === filtro;
    const matchAsesor = filtroAsesor === "todos" || c.asesor?._id === filtroAsesor;
    return matchSearch && matchFiltro && matchAsesor;
  });

  const montaSeleccionada    = montas.find(m => m._id === form.montacargas);
  const mostrarAutocompletar = (form.tipo === "renta" || form.tipo === "venta") && !!form.montacargas;
  const esRefacciones        = form.tipo === "refacciones";

  function generarPlantilla() {
    setForm((p: any) => ({ ...p, condiciones: generarPlantillaCondiciones(form.tipo, form.tipoPeriodo) }));
  }

  // ── Datos del reporte actual ──
  const cotsSemana  = getCotizacionesSemana();
  const grupos      = agruparPorAsesor(cotsSemana);
  const totalSemana = cotsSemana.reduce((a, c) => a + c.total, 0);

  const TIPO_COLOR: Record<string, string> = {
    servicio: "#f59e0b", renta: "#3b82f6", venta: "#22c55e", refacciones: "#a855f7",
  };
  const ESTATUS_COLOR: Record<string, string> = {
    activa: "#22c55e", facturada: "#3b82f6", cancelada: "#6b7280",
  };

  const modalForm = (
    <div className="modal" style={{ maxWidth: 760 }}>
      <button className="modal-close" onClick={() => { setModal(false); setEditing(null); }}>✕</button>
      <h2 className="modal-title">{editing ? `Editar — ${editing.folio}` : "Nueva cotización"}</h2>

      <div className="form-grid">
        {editing && (
          <div className="form-group">
            <label className="form-label">Folio</label>
            <input className="form-input" value={form.folio} onChange={e => setForm((p: any) => ({ ...p, folio: e.target.value }))} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Tipo *</label>
          <select className="form-select" value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}>
            <option value="servicio">Servicio / Mantenimiento</option>
            <option value="renta">Renta</option>
            <option value="venta">Venta</option>
            <option value="refacciones">Refacciones</option>
          </select>
        </div>

        <div className="form-group span-2" style={{ margin: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <input type="checkbox" checked={!!form.esOcasional}
              onChange={e => setForm((p: any) => ({ ...p, esOcasional: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              👤 Cliente prospecto <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(no se guarda en el catálogo)</span>
            </span>
          </label>
          {form.esOcasional ? (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group span-2" style={{ margin: 0 }}>
                <label className="form-label">Nombre del prospecto *</label>
                <input className="form-input" value={form.clienteOcasional?.nombre ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, nombre: e.target.value } }))} placeholder="Ej. Juan Pérez" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.clienteOcasional?.telefono ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, telefono: e.target.value } }))} placeholder="Opcional" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contacto</label>
                <input className="form-input" value={form.clienteOcasional?.contacto ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, contacto: e.target.value } }))} placeholder="Opcional" />
              </div>
              <div className="form-group span-2" style={{ margin: 0 }}>
                <label className="form-label">Dirección</label>
                <input className="form-input" value={form.clienteOcasional?.direccion ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, direccion: e.target.value } }))} placeholder="Opcional" />
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cliente *</label>
              <SearchableSelect value={form.cliente} onChange={id => setForm((p: any) => ({ ...p, cliente: id, montacargas: "" }))} options={clienteOpts} placeholder="Escribe para buscar cliente..." />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Asesor</label>
          <SearchableSelect value={form.asesor} onChange={id => setForm((p: any) => ({ ...p, asesor: id }))} options={asesorOpts} placeholder="Escribe para buscar asesor..." />
        </div>

        {!esRefacciones && (
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0 }}>Montacargas</label>
              {form.cliente && montasDelCliente.length > 0 && (
                <button onClick={() => { setVerTodosMontas(v => !v); setForm((p: any) => ({ ...p, montacargas: "" })); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600, padding: 0 }}>
                  {verTodosMontas ? `🔍 Solo de ${clientes.find(c => c._id === form.cliente)?.nombre ?? "cliente"}` : "🌐 Ver todos"}
                </button>
              )}
            </div>
            {form.cliente && montasDelCliente.length > 0 && !verTodosMontas && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>Mostrando {montasDelCliente.length} equipo{montasDelCliente.length !== 1 ? "s" : ""} de este cliente</p>}
            {form.cliente && montasDelCliente.length === 0 && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>Este cliente no tiene equipos asignados — mostrando todos</p>}
            <SearchableSelect value={form.montacargas} onChange={id => setForm((p: any) => ({ ...p, montacargas: id }))} options={montaOpts} placeholder="Escribe para buscar equipo..." renderLabel={opt => opt.label} />
          </div>
        )}

        {!esRefacciones && (
          <div className="form-group span-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>🔧 Datos del equipo (opcionales — aparecen en el reporte)</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Marca</label><input className="form-input" value={form.equipoMarca ?? ""} onChange={e => setForm((p: any) => ({ ...p, equipoMarca: e.target.value }))} placeholder="Ej. Yale" /></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Modelo</label><input className="form-input" value={form.equipoModelo ?? ""} onChange={e => setForm((p: any) => ({ ...p, equipoModelo: e.target.value }))} placeholder="Ej. YL_456" /></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Serie</label><input className="form-input" value={form.equipoSerie ?? ""} onChange={e => setForm((p: any) => ({ ...p, equipoSerie: e.target.value }))} placeholder="Ej. 1A3234RT45" /></div>
            </div>
          </div>
        )}

        <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={form.fecha} onChange={e => setForm((p: any) => ({ ...p, fecha: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Lugar</label><input className="form-input" value={form.lugar} onChange={e => setForm((p: any) => ({ ...p, lugar: e.target.value }))} /></div>
        <div className="form-group">
          <label className="form-label">Estatus</label>
          <select className="form-select" value={form.estatus} onChange={e => setForm((p: any) => ({ ...p, estatus: e.target.value }))}>
            <option value="activa">Activa</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="form-group span-2">
          <label className="form-label">Descripción {esRefacciones ? "(opcional)" : "del servicio"}</label>
          <textarea className="form-textarea" rows={3} value={form.descripcionServicio}
            onChange={e => setForm((p: any) => ({ ...p, descripcionServicio: e.target.value }))}
            placeholder={esRefacciones ? "Ej. Refacciones para mantenimiento" : "Ej. Mantenimiento correctivo a batería"} />
        </div>

        {form.tipo === "servicio" && tiposServicio.length > 0 && (
          <div className="form-group span-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>⚙️ Autocompletar desde tipo de servicio</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="form-select" defaultValue="" onChange={e => { if (e.target.value) aplicarTipoServicio(e.target.value); }}>
                <option value="">Selecciona un tipo de servicio...</option>
                {tiposServicio.map(t => <option key={t._id} value={t._id}>{t.nombre}{t.intervaloHrs ? ` (${t.intervaloHrs} hrs)` : ""}{t.precioTotal ? ` — $${t.precioTotal.toLocaleString()}` : ""}</option>)}
              </select>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Llena el primer concepto</p>
            </div>
          </div>
        )}

        {mostrarAutocompletar && (
          <div className="form-group span-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>⚡ Autocompletar primer concepto</p>
            {montaSeleccionada && (
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
                {montaSeleccionada.marca} {montaSeleccionada.modelo} #{montaSeleccionada.numeroEconomico}
                {form.tipo === "renta" && <> — Semana: {montaSeleccionada.costoSemana ? `$${montaSeleccionada.costoSemana.toLocaleString()}` : "—"} · Mes: {montaSeleccionada.costoMes ? `$${montaSeleccionada.costoMes.toLocaleString()}` : "—"} · Año: {montaSeleccionada.costoAnual ? `$${montaSeleccionada.costoAnual.toLocaleString()}` : "—"}</>}
                {form.tipo === "venta" && <> — Precio venta: {montaSeleccionada.precioVenta ? `$${montaSeleccionada.precioVenta.toLocaleString()}` : "—"}</>}
              </p>
            )}
            {form.tipo === "renta" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0, whiteSpace: "nowrap" }}>Periodo:</label>
                <select className="form-select" value={form.tipoPeriodo} onChange={e => setForm((p: any) => ({ ...p, tipoPeriodo: e.target.value }))} style={{ width: "auto" }}>
                  <option value="semanal">Semanal</option><option value="mensual">Mensual</option><option value="anual">Anual</option>
                </select>
              </div>
            )}
            <button className="btn btn-secondary btn-sm" style={{ color: "var(--accent)", borderColor: "rgba(245,158,11,0.3)" }}
              onClick={() => generarConceptoAutomatico(form.montacargas, form.tipo, form.tipoPeriodo)}>
              ⚡ Llenar primer concepto automáticamente
            </button>
          </div>
        )}

        <div className="form-group span-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📋 Condiciones comerciales</p>
            <button className="btn btn-secondary btn-sm" onClick={generarPlantilla}>⚡ Generar plantilla</button>
          </div>
          <textarea className="form-textarea" rows={6} value={form.condiciones}
            onChange={e => setForm((p: any) => ({ ...p, condiciones: e.target.value }))}
            placeholder="Genera una plantilla con el botón de arriba, o escribe las condiciones manualmente — una por línea."
            style={{ fontSize: "0.85rem" }} />
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6 }}>Si dejas este campo vacío, el reporte usará una plantilla estándar según tipo y periodo.</p>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{esRefacciones ? "Refacciones" : "Conceptos"}</p>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar {esRefacciones ? "refacción" : "concepto"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {form.items.map((item: Item, i: number) => {
            const tieneSubconceptos = (item.subconceptos?.length ?? 0) > 0;
            return (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
                {esRefacciones && refaccionesCatalogo.length > 0 && (
                  <div style={{ padding: "8px 8px 0" }}>
                    <select className="form-select" style={{ fontSize: "0.8rem", padding: "6px 10px" }} defaultValue=""
                      onChange={e => { aplicarRefaccionCatalogo(i, e.target.value); e.target.value = ""; }}>
                      <option value="">🔍 Buscar en catálogo de Almacén (opcional)...</option>
                      {refaccionesCatalogo.map(r => <option key={r._id} value={r._id}>{r.nombre}{r.numeroParte ? ` (${r.numeroParte})` : ""}{r.precio ? ` — $${r.precio.toLocaleString()}` : " — sin precio"}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "56px 50px 1fr 110px 110px 32px", gap: 6, alignItems: "center", padding: 8 }}>
                  <label style={{ cursor: "pointer" }}>
                    {item.imagen ? (
                      <img src={item.imagen} alt="producto" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                    ) : (
                      <div style={{ width: 48, height: 48, background: "var(--surface3)", borderRadius: 6, border: "1px dashed var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                        {uploadingIdx === i ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : "📷"}
                      </div>
                    )}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) subirImagen(i, f); }} />
                  </label>
                  <input className="form-input" type="number" value={item.cantidad} onChange={e => updateItem(i, "cantidad", +e.target.value)} style={{ padding: "8px" }} />
                  <textarea className="form-textarea" value={item.descripcion} onChange={e => updateItem(i, "descripcion", e.target.value)} placeholder={esRefacciones ? "Nombre de la refacción" : "Descripción del concepto"} rows={2} style={{ resize: "vertical", minHeight: 40 }} />
                  <input className="form-input" type="number" value={item.precioUnitario} onChange={e => updateItem(i, "precioUnitario", +e.target.value)} style={{ padding: "8px" }} readOnly={tieneSubconceptos} title={tieneSubconceptos ? "Calculado desde subconceptos" : ""} />
                  <input className="form-input" value={`$${item.total.toLocaleString()}`} readOnly style={{ padding: "8px", color: "var(--text-muted)" }} />
                  <button className="btn btn-danger btn-icon" onClick={() => removeItem(i)}>✕</button>
                </div>
                {!esRefacciones && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subconceptos {tieneSubconceptos ? `(${item.subconceptos?.length})` : ""}</p>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem", padding: "3px 8px" }} onClick={() => addSubconcepto(i)}>+ Agregar subconcepto</button>
                    </div>
                    {tieneSubconceptos && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {item.subconceptos!.map((sub, si) => (
                          <div key={si} style={{ display: "grid", gridTemplateColumns: "1fr 120px 28px", gap: 6, alignItems: "center" }}>
                            <input className="form-input" value={sub.descripcion} onChange={e => updateSubconcepto(i, si, "descripcion", e.target.value)} placeholder="Descripción del subconcepto" style={{ fontSize: "0.82rem", padding: "6px 10px" }} />
                            <input className="form-input" type="number" value={sub.precio} onChange={e => updateSubconcepto(i, si, "precio", +e.target.value)} placeholder="Precio" style={{ fontSize: "0.82rem", padding: "6px 10px" }} />
                            <button className="btn btn-danger btn-icon" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => removeSubconcepto(i, si)}>✕</button>
                          </div>
                        ))}
                        <p style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: 2 }}>Suma: ${(item.subconceptos!.reduce((a, s) => a + s.precio, 0)).toLocaleString("es-MX", { minimumFractionDigits: 2 })} → Precio U. calculado automáticamente</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}><span>Subtotal:</span><span>${form.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
          <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}><span>IVA (16%):</span><span>${form.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
          <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}><span>Total:</span><span>${form.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={() => { setModal(false); setEditing(null); }}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">{cotizaciones.filter(c => c.estatus === "activa").length} activas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["developer", "gerencia"].includes(rol) && (
            <button className="btn btn-secondary" onClick={() => { setSemanaInicio(getMartes(new Date())); setModalReporte(true); }}>
              📊 Reporte semanal
            </button>
          )}
          <button className="btn btn-primary" onClick={openNew}>+ Nueva cotización</button>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { label: "Activas",    val: cotizaciones.filter(c => c.estatus === "activa").length,    color: "var(--green)",      icon: "📄", filtro: "activa" },
            { label: "Facturadas", val: cotizaciones.filter(c => c.estatus === "facturada").length, color: "var(--blue)",       icon: "🧾", filtro: "facturada" },
            { label: "Canceladas", val: cotizaciones.filter(c => c.estatus === "cancelada").length, color: "var(--text-muted)", icon: "❌", filtro: "cancelada" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFiltro(s.filtro)}>
              <span className="stat-card-icon">{s.icon}</span>
              <p className="stat-card-value" style={{ color: s.color }}>{s.val}</p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Todas las cotizaciones</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todas</option>
                <option value="activa">Activas</option>
                <option value="facturada">Facturadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="servicio">Servicio</option>
                <option value="renta">Renta</option>
                <option value="venta">Venta</option>
                <option value="refacciones">Refacciones</option>
              </select>
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}>
                <option value="todos">Todos los asesores</option>
                {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
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
                <tr><th>Folio</th><th>Tipo</th><th>Cliente</th><th>Asesor</th><th>Fecha</th><th>Precio base</th><th>Total c/IVA</th><th>Estatus</th><th>Comentarios</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const precioBase = precioBaseConcepto(c);
                  return (
                    <tr key={c._id}>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{c.folio}</td>
                      <td><span className={`badge ${TIPO_BADGE[c.tipo]}`}>{c.tipo}</span></td>
                      <td style={{ fontWeight: 600 }}>
                        {nombreCliente(c)}
                        {!c.cliente && c.clienteOcasional?.nombre && (
                          <span style={{ fontSize: "0.65rem", color: "var(--blue)", background: "rgba(79,124,255,0.12)", padding: "1px 6px", borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>PROSPECTO</span>
                        )}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{c.asesor?.nombre ?? "—"}</td>
                      <td>{fmt(c.fecha)}</td>
                      <td>
                        {precioBase !== null ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.92rem" }}>${precioBase.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{c.tipo === "renta" ? "precio renta" : "precio venta"}</span>
                          </div>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td style={{ fontWeight: 700 }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className={`badge ${ESTATUS_BADGE[c.estatus] ?? "badge-gray"}`}>
                            {c.estatus === "activa" ? "Activa" : c.estatus === "facturada" ? "Facturada" : "Cancelada"}
                          </span>
                          {c.estatus === "facturada" && c.numeroFactura && (
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>#{c.numeroFactura}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {canComment && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setComentarioModal(c); setNuevoComentario(""); }} style={{ position: "relative" }}>
                            💬
                            {c.comentarios?.length > 0 && (
                              <span style={{ position: "absolute", top: -6, right: -6, background: "var(--accent)", color: "#000", borderRadius: "50%", width: 16, height: 16, fontSize: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.comentarios.length}</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => generarReporte({ ...c, cliente: c.cliente ?? c.clienteOcasional })} title="Ver reporte">👁️</button>
                          <button className="btn btn-primary btn-sm" onClick={() => descargarPDF({ ...c, cliente: c.cliente ?? c.clienteOcasional })} title="Descargar PDF">📥 PDF</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)} title="Editar">✏️</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => clonar(c)} title="Clonar" disabled={saving}>📋</button>
                          {c.estatus !== "facturada" && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--blue)", borderColor: "rgba(79,124,255,0.3)" }}
                              onClick={() => { setFacturaModal(c); setNumeroFacturaInput(""); }} title="Marcar como facturada">🧾</button>
                          )}
                          {c.estatus === "activa" && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--text-muted)" }}
                              onClick={() => cambiarEstatus(c._id, "cancelada")} title="Cancelar">🚫</button>
                          )}
                          {canDelete && <button className="btn btn-danger btn-sm" onClick={() => remove(c._id)}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setEditing(null); } }}>
          {modalForm}
        </div>
      )}

      {/* ── Modal reporte semanal ── */}
      {modalReporte && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalReporte(false); }}>
          <div className="modal" style={{ maxWidth: 960, width: "96vw", display: "flex", flexDirection: "column" }}>
            <button className="modal-close" onClick={() => setModalReporte(false)}>✕</button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div>
                <h2 className="modal-title" style={{ marginBottom: 2 }}>📊 Reporte semanal de cotizaciones</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{semanaLabel(semanaInicio)}</p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(semanaInicio); d.setDate(d.getDate() - 7); setSemanaInicio(d); }}>‹ Anterior</button>
                <input
                  type="week"
                  className="form-input"
                  style={{ width: "auto", padding: "5px 8px", fontSize: "0.82rem" }}
                  value={toInputWeek(semanaInicio)}
                  onChange={e => { if (e.target.value) setSemanaInicio(fromInputWeek(e.target.value)); }}
                />
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { const d = new Date(semanaInicio); d.setDate(d.getDate() + 7); setSemanaInicio(d); }}
                  disabled={semanaInicio >= getMartes(new Date())}>Siguiente ›</button>
              </div>
            </div>

            {/* Resumen global */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Cotizaciones", val: cotsSemana.length, color: "var(--accent)", icon: "📄" },
                { label: "Monto total", val: `$${totalSemana.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, color: "var(--text)", icon: "💰" },
                { label: "Facturadas", val: cotsSemana.filter(c => c.estatus === "facturada").length, color: "#3b82f6", icon: "🧾" },
                { label: "Activas", val: cotsSemana.filter(c => c.estatus === "activa").length, color: "#22c55e", icon: "✅" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: "1px solid var(--border)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 2 }}>{s.icon}</div>
                  <p style={{ fontSize: "1rem", fontWeight: 700, color: s.color }}>{s.val}</p>
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Grupos por asesor */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cotsSemana.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: "2rem", marginBottom: 8 }}>📭</p>
                  <p>Sin cotizaciones esta semana</p>
                </div>
              ) : grupos.map(g => (
                <div key={g.nombre} style={{ background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
                  {/* Header del asesor */}
                  <div style={{ padding: "10px 14px", background: "var(--surface3)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: "#000", flexShrink: 0 }}>
                        {g.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{g.nombre}</p>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{g.cotizaciones.length} cotización{g.cotizaciones.length !== 1 ? "es" : ""} esta semana</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>total cotizado</p>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {g.facturadas > 0 && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "2px 7px", borderRadius: 20 }}>🧾 {g.facturadas} fact.</span>}
                        {g.activas > 0    && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)",  padding: "2px 7px", borderRadius: 20 }}>✅ {g.activas} act.</span>}
                        {g.canceladas > 0 && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6b7280", background: "rgba(107,114,128,0.12)", padding: "2px 7px", borderRadius: 20 }}>❌ {g.canceladas} canc.</span>}
                      </div>
                    </div>
                  </div>

                  {/* Tabla */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ fontSize: "0.78rem" }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 110 }}>Folio</th>
                          <th style={{ minWidth: 70 }}>Tipo</th>
                          <th style={{ minWidth: 140 }}>Cliente</th>
                          <th style={{ minWidth: 85 }}>Fecha</th>
                          <th>Concepto principal</th>
                          <th style={{ textAlign: "right", minWidth: 110 }}>Precio base</th>
                          <th style={{ textAlign: "right", minWidth: 100 }}>Total c/IVA</th>
                          <th style={{ textAlign: "center", minWidth: 130 }}>Estatus / Factura</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.cotizaciones.map(c => {
                          const precioBase = precioBaseConcepto(c);
                          return (
                            <tr key={c._id}>
                              <td style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.73rem" }}>{c.folio}</td>
                              <td>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: TIPO_COLOR[c.tipo], background: `${TIPO_COLOR[c.tipo]}1a`, padding: "2px 6px", borderRadius: 10, whiteSpace: "nowrap" }}>
                                  {c.tipo}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, fontSize: "0.76rem" }}>
                                {nombreCliente(c)}
                                {!c.cliente && c.clienteOcasional?.nombre && (
                                  <span style={{ fontSize: "0.6rem", color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "1px 4px", borderRadius: 4, marginLeft: 4, fontWeight: 700 }}>PROSP</span>
                                )}
                              </td>
                              <td style={{ whiteSpace: "nowrap", fontSize: "0.73rem", color: "var(--text-muted)" }}>{fmt(c.fecha)}</td>
                              <td style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
                                <span title={c.items[0]?.descripcion ?? "—"}>
                                  {(c.items[0]?.descripcion ?? "—").slice(0, 50)}{(c.items[0]?.descripcion?.length ?? 0) > 50 ? "…" : ""}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {precioBase !== null ? (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                    <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.78rem" }}>
                                      ${precioBase.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </span>
                                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                                      {c.tipo === "renta" ? "renta" : "venta"}
                                    </span>
                                  </div>
                                ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: c.estatus === "cancelada" ? "var(--text-muted)" : "var(--text)" }}>
                                ${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: ESTATUS_COLOR[c.estatus], background: `${ESTATUS_COLOR[c.estatus]}1a`, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                                    {c.estatus === "activa" ? "Activa" : c.estatus === "facturada" ? "Facturada" : "Cancelada"}
                                  </span>
                                  {c.numeroFactura && (
                                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "monospace" }}>#{c.numeroFactura}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "3px 7px" }}
                                  title="Ver cotización"
                                  onClick={() => generarReporte({ ...c, cliente: c.cliente ?? c.clienteOcasional })}
                                >👁️</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ paddingTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setModalReporte(false)}>Cerrar</button>
              <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal marcar facturada ── */}
      {facturaModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setFacturaModal(null); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <button className="modal-close" onClick={() => setFacturaModal(null)}>✕</button>
            <h2 className="modal-title">🧾 Marcar como facturada</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              <strong style={{ color: "var(--text)" }}>{facturaModal.folio}</strong> — {nombreCliente(facturaModal)}
            </p>
            <div className="form-group">
              <label className="form-label">Número de factura *</label>
              <input className="form-input" value={numeroFacturaInput} onChange={e => setNumeroFacturaInput(e.target.value)}
                placeholder="Ej. A-1234" autoFocus
                onKeyDown={e => { if (e.key === "Enter" && numeroFacturaInput.trim()) marcarFacturada(); }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFacturaModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={marcarFacturada} disabled={saving || !numeroFacturaInput.trim()}>
                {saving ? "Guardando..." : "✅ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal comentarios ── */}
      {comentarioModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setComentarioModal(null); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setComentarioModal(null)}>✕</button>
            <h2 className="modal-title">Comentarios — {comentarioModal.folio}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className={`badge ${TIPO_BADGE[comentarioModal.tipo]}`}>{comentarioModal.tipo}</span>
              <span className={`badge ${ESTATUS_BADGE[comentarioModal.estatus] ?? "badge-gray"}`}>{comentarioModal.estatus}</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>{nombreCliente(comentarioModal)}</p>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {comentarioModal.comentarios.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}><p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>Sin comentarios aún</p></div>
              ) : (
                comentarioModal.comentarios.map(cm => (
                  <div key={cm._id} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{cm.autor?.nombre ?? "Usuario"}</span>
                        <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--text-muted)", background: "var(--surface3)", padding: "1px 6px", borderRadius: 4 }}>{cm.autor?.rol}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{fmtHora(cm.fecha)}</span>
                        {["developer", "gerencia"].includes(rol) && (
                          <button onClick={() => eliminarComentario(comentarioModal._id, cm._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", padding: 0 }}>🗑️</button>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.5 }}>{cm.texto}</p>
                  </div>
                ))
              )}
            </div>
            {canComment && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <label className="form-label">Nuevo comentario</label>
                <textarea className="form-textarea" rows={3} value={nuevoComentario}
                  onChange={e => setNuevoComentario(e.target.value)}
                  placeholder="Escribe un comentario sobre esta cotización..."
                  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) enviarComentario(); }} />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Ctrl + Enter para enviar</p>
                <div className="modal-footer" style={{ paddingTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setComentarioModal(null)}>Cerrar</button>
                  <button className="btn btn-primary" onClick={enviarComentario} disabled={savingComentario || !nuevoComentario.trim()}>
                    {savingComentario ? "Enviando..." : "Agregar comentario"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}