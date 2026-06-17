import { useEffect, useState } from "react";
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
  _id: string; folio: string; tipo: "servicio" | "renta" | "venta";
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
  estatus: "borrador" | "enviada" | "aceptada" | "rechazada";
  notas?: string; comentarios: Comentario[];
  equipoMarca?:  string;
  equipoModelo?: string;
  equipoSerie?:  string;
};

type Cliente    = { _id: string; nombre: string };
type Montacargas = {
  _id: string; numeroEconomico: string; marca: string; modelo: string; capacidad?: string;
  tipo?: string; serie?: string; alturaColapsada?: string; alturaLevante?: string;
  horquillas?: string; desplazadorLateral?: boolean; tipoLlantas?: string;
  voltaje?: string; tipoBateria?: string; incluyeCargador?: boolean;
  equipoSeguridad?: { alarmaReversa?: boolean; torretaAmbar?: boolean; luces?: boolean; extintor?: boolean };
  costoSemana?: number; costoMes?: number; costoAnual?: number; precioVenta?: number;
};
type TipoServicio = {
  _id: string; nombre: string; descripcion?: string; intervaloHrs?: number;
  itemsChecklist: string[]; precioTotal: number;
  refacciones: { nombre: string; cantidad: number }[];
};

const emptyClienteOcasional: ClienteOcasional = { nombre: "", direccion: "", telefono: "", contacto: "" };

const emptyForm: any = {
  folio: "", tipo: "servicio", cliente: "", esOcasional: false, clienteOcasional: { ...emptyClienteOcasional },
  montacargas: "", asesor: "",
  fecha: new Date().toISOString().split("T")[0], lugar: "Zapopán, Jal",
  descripcionServicio: "", items: [], subtotal: 0, iva: 0, total: 0,
  estatus: "borrador", notas: "",
  equipoMarca: "", equipoModelo: "", equipoSerie: "",
};
const emptyItem: Item = { cantidad: 1, descripcion: "", precioUnitario: 0, total: 0, imagen: "", subconceptos: [] };
const emptySubconcepto: SubConcepto = { descripcion: "", precio: 0 };

const TIPO_BADGE: Record<string, string> = { servicio: "badge-amber", renta: "badge-blue", venta: "badge-green" };
const ESTATUS_BADGE: Record<string, string> = { borrador: "badge-gray", enviada: "badge-blue", aceptada: "badge-green", rechazada: "badge-red" };

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

export default function Cotizaciones() {
  const rol        = localStorage.getItem("rol") ?? "";
  const canComment = ["developer", "gerencia", "oficina"].includes(rol);

  const [cotizaciones, setCotizaciones]         = useState<Cotizacion[]>([]);
  const [clientes, setClientes]                 = useState<Cliente[]>([]);
  const [montas, setMontas]                     = useState<Montacargas[]>([]);
  const [asesores, setAsesores]                 = useState<Asesor[]>([]);
  const [tiposServicio, setTiposServicio]       = useState<TipoServicio[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState("");
  const [filtro, setFiltro]                     = useState("todos");
  const [filtroAsesor, setFiltroAsesor]         = useState("todos");
  const [modal, setModal]                       = useState(false);
  const [editing, setEditing]                   = useState<Cotizacion | null>(null);
  const [comentarioModal, setComentarioModal]   = useState<Cotizacion | null>(null);
  const [nuevoComentario, setNuevoComentario]   = useState("");
  const [form, setForm]                         = useState<any>(emptyForm);
  const [saving, setSaving]                     = useState(false);
  const [savingComentario, setSavingComentario] = useState(false);
  const [uploadingIdx, setUploadingIdx]         = useState<number | null>(null);
  const [periodoRenta, setPeriodoRenta]         = useState<"semanal" | "mensual" | "anual">("mensual");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [co, cl, mo, as, ts] = await Promise.all([
        api.get("/cotizaciones"), api.get("/clientes"),
        api.get("/montacargas"), api.get("/asesores"),
        api.get("/tipos-servicio"),
      ]);
      setCotizaciones(co.data);
      setClientes(cl.data.filter((c: any) => c.estatus === "activo"));
      setMontas(mo.data);
      setAsesores(as.data);
      setTiposServicio(ts.data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setPeriodoRenta("mensual");
    setForm({ ...emptyForm, folio: "", clienteOcasional: { ...emptyClienteOcasional }, items: [{ ...emptyItem, subconceptos: [] }] });
    setModal(true);
  }

  function openEdit(c: Cotizacion) {
    setEditing(c);
    setPeriodoRenta("mensual");
    const esOcasional = !c.cliente && !!c.clienteOcasional?.nombre;
    setForm({
      folio: c.folio, tipo: c.tipo,
      cliente: c.cliente?._id ?? "",
      esOcasional,
      clienteOcasional: c.clienteOcasional ?? { ...emptyClienteOcasional },
      montacargas: c.montacargas?._id ?? "", asesor: c.asesor?._id ?? "",
      fecha: c.fecha.split("T")[0], lugar: c.lugar,
      descripcionServicio: c.descripcionServicio ?? "",
      items: c.items.map(i => ({ ...i, subconceptos: i.subconceptos ?? [] })),
      subtotal: c.subtotal, iva: c.iva, total: c.total,
      estatus: c.estatus, notas: c.notas ?? "",
      equipoMarca:  c.equipoMarca  ?? "",
      equipoModelo: c.equipoModelo ?? "",
      equipoSerie:  c.equipoSerie  ?? "",
    });
    setModal(true);
  }

  function recalcTotales(items: Item[]) {
    const subtotal = items.reduce((acc, it) => acc + it.total, 0);
    const iva      = subtotal * 0.16;
    return { subtotal, iva, total: subtotal + iva };
  }

  function addItem() {
    setForm((p: any) => ({ ...p, items: [...p.items, { ...emptyItem, subconceptos: [] }] }));
  }

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
        if (!items[i].subconceptos?.length) {
          items[i].total = items[i].cantidad * items[i].precioUnitario;
        }
      }
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
    const refaccionesList = t.refacciones.length > 0
      ? "\n\nRefacciones:\n" + t.refacciones.map(r => `• ${r.cantidad} ${r.nombre}`).join("\n")
      : "";
    const descripcionCompleta = [
      t.nombre,
      t.descripcion ? `\n${t.descripcion}` : "",
      checklist ? `\n\nSolo se checa:\n${checklist}` : "",
      refaccionesList,
    ].filter(Boolean).join("");
    const precio = t.precioTotal ?? 0;
    setForm((p: any) => {
      const items = [...p.items];
      items[0] = { ...items[0], descripcion: descripcionCompleta, precioUnitario: precio, total: items[0].cantidad * precio, subconceptos: [] };
      return { ...p, descripcionServicio: t.descripcion ?? p.descripcionServicio, items, ...recalcTotales(items) };
    });
  }

  function addSubconcepto(itemIdx: number) {
    setForm((p: any) => {
      const items = [...p.items];
      items[itemIdx] = { ...items[itemIdx], subconceptos: [...(items[itemIdx].subconceptos ?? []), { ...emptySubconcepto }] };
      return { ...p, items };
    });
  }
  function removeSubconcepto(itemIdx: number, subIdx: number) {
    setForm((p: any) => {
      const items = [...p.items];
      const subs  = items[itemIdx].subconceptos?.filter((_: any, i: number) => i !== subIdx) ?? [];
      const suma  = subs.reduce((acc: number, s: SubConcepto) => acc + s.precio, 0);
      items[itemIdx] = { ...items[itemIdx], subconceptos: subs, precioUnitario: suma, total: items[itemIdx].cantidad * suma };
      return { ...p, items, ...recalcTotales(items) };
    });
  }
  function updateSubconcepto(itemIdx: number, subIdx: number, field: keyof SubConcepto, val: any) {
    setForm((p: any) => {
      const items = [...p.items];
      const subs  = [...(items[itemIdx].subconceptos ?? [])];
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
    const tieneClienteValido = form.esOcasional
      ? !!form.clienteOcasional?.nombre?.trim()
      : !!form.cliente;
    if (!tieneClienteValido) return;

    setSaving(true);
    try {
      const payload: any = { ...form };
      delete payload.esOcasional;
      if (form.esOcasional) {
        payload.cliente = null;
        payload.clienteOcasional = {
          nombre:    form.clienteOcasional.nombre?.trim(),
          direccion: form.clienteOcasional.direccion?.trim() || undefined,
          telefono:  form.clienteOcasional.telefono?.trim()  || undefined,
          contacto:  form.clienteOcasional.contacto?.trim()  || undefined,
        };
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

  const filtered = cotizaciones.filter(c => {
    const matchSearch =
      c.folio.toLowerCase().includes(search.toLowerCase()) ||
      nombreCliente(c).toLowerCase().includes(search.toLowerCase()) ||
      (c.asesor?.nombre  ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro       === "todos" || c.tipo === filtro || c.estatus === filtro;
    const matchAsesor = filtroAsesor === "todos" || c.asesor?._id === filtroAsesor;
    return matchSearch && matchFiltro && matchAsesor;
  });

  const montaSeleccionada    = montas.find(m => m._id === form.montacargas);
  const mostrarAutocompletar = (form.tipo === "renta" || form.tipo === "venta") && !!form.montacargas;

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
          </select>
        </div>

        {/* ── Cliente: catálogo u ocasional ── */}
        <div className="form-group span-2" style={{ margin: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <input type="checkbox" checked={!!form.esOcasional}
              onChange={e => setForm((p: any) => ({ ...p, esOcasional: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              👤 Cliente ocasional <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(solo para esta cotización, no se guarda en el catálogo)</span>
            </span>
          </label>

          {form.esOcasional ? (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group span-2" style={{ margin: 0 }}>
                <label className="form-label">Nombre del cliente *</label>
                <input className="form-input" value={form.clienteOcasional?.nombre ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, nombre: e.target.value } }))}
                  placeholder="Ej. Juan Pérez" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono</label>
                <input className="form-input" value={form.clienteOcasional?.telefono ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, telefono: e.target.value } }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contacto</label>
                <input className="form-input" value={form.clienteOcasional?.contacto ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, contacto: e.target.value } }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group span-2" style={{ margin: 0 }}>
                <label className="form-label">Dirección</label>
                <input className="form-input" value={form.clienteOcasional?.direccion ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, clienteOcasional: { ...p.clienteOcasional, direccion: e.target.value } }))}
                  placeholder="Opcional" />
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cliente *</label>
              <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                <option value="">Selecciona cliente...</option>
                {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Asesor</label>
          <select className="form-select" value={form.asesor} onChange={e => setForm((p: any) => ({ ...p, asesor: e.target.value }))}>
            <option value="">Sin asesor</option>
            {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Montacargas</label>
          <select className="form-select" value={form.montacargas} onChange={e => setForm((p: any) => ({ ...p, montacargas: e.target.value }))}>
            <option value="">Sin equipo</option>
            {montas.map(m => <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca} {m.modelo}</option>)}
          </select>
        </div>

        <div className="form-group span-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12 }}>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
            🔧 Datos del equipo (opcionales — aparecen en el reporte)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Marca</label>
              <input className="form-input" value={form.equipoMarca ?? ""}
                onChange={e => setForm((p: any) => ({ ...p, equipoMarca: e.target.value }))}
                placeholder="Ej. Yale" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Modelo</label>
              <input className="form-input" value={form.equipoModelo ?? ""}
                onChange={e => setForm((p: any) => ({ ...p, equipoModelo: e.target.value }))}
                placeholder="Ej. YL_456" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Serie</label>
              <input className="form-input" value={form.equipoSerie ?? ""}
                onChange={e => setForm((p: any) => ({ ...p, equipoSerie: e.target.value }))}
                placeholder="Ej. 1A3234RT45" />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Fecha</label>
          <input className="form-input" type="date" value={form.fecha} onChange={e => setForm((p: any) => ({ ...p, fecha: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Lugar</label>
          <input className="form-input" value={form.lugar} onChange={e => setForm((p: any) => ({ ...p, lugar: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Estatus</label>
          <select className="form-select" value={form.estatus} onChange={e => setForm((p: any) => ({ ...p, estatus: e.target.value }))}>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
        <div className="form-group span-2">
          <label className="form-label">Descripción del servicio</label>
          <textarea className="form-textarea" rows={3} value={form.descripcionServicio}
            onChange={e => setForm((p: any) => ({ ...p, descripcionServicio: e.target.value }))}
            placeholder="Ej. Mantenimiento correctivo a batería modelo 18-125-15" />
        </div>

        {form.tipo === "servicio" && tiposServicio.length > 0 && (
          <div className="form-group span-2" style={{
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "var(--radius-sm)", padding: 12,
          }}>
            <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              ⚙️ Autocompletar desde tipo de servicio
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="form-select" defaultValue=""
                onChange={e => { if (e.target.value) aplicarTipoServicio(e.target.value); }}>
                <option value="">Selecciona un tipo de servicio...</option>
                {tiposServicio.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.nombre}{t.intervaloHrs ? ` (${t.intervaloHrs} hrs)` : ""}{t.precioTotal ? ` — $${t.precioTotal.toLocaleString()}` : ""}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Llena el primer concepto
              </p>
            </div>
          </div>
        )}

        {mostrarAutocompletar && (
          <div className="form-group span-2" style={{
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "var(--radius-sm)", padding: 12,
          }}>
            <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              ⚡ Autocompletar primer concepto
            </p>
            {montaSeleccionada && (
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
                {montaSeleccionada.marca} {montaSeleccionada.modelo} #{montaSeleccionada.numeroEconomico}
                {form.tipo === "renta" && (
                  <> — Semana: {montaSeleccionada.costoSemana ? `$${montaSeleccionada.costoSemana.toLocaleString()}` : "—"} · Mes: {montaSeleccionada.costoMes ? `$${montaSeleccionada.costoMes.toLocaleString()}` : "—"} · Año: {montaSeleccionada.costoAnual ? `$${montaSeleccionada.costoAnual.toLocaleString()}` : "—"}</>
                )}
                {form.tipo === "venta" && (
                  <> — Precio venta: {montaSeleccionada.precioVenta ? `$${montaSeleccionada.precioVenta.toLocaleString()}` : "—"}</>
                )}
              </p>
            )}
            {form.tipo === "renta" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0, whiteSpace: "nowrap" }}>Periodo:</label>
                <select className="form-select" value={periodoRenta} onChange={e => setPeriodoRenta(e.target.value as any)} style={{ width: "auto" }}>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            )}
            <button className="btn btn-secondary btn-sm"
              style={{ color: "var(--accent)", borderColor: "rgba(245,158,11,0.3)" }}
              onClick={() => generarConceptoAutomatico(form.montacargas, form.tipo, periodoRenta)}>
              ⚡ Llenar primer concepto automáticamente
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Conceptos</p>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar concepto</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {form.items.map((item: Item, i: number) => {
            const tieneSubconceptos = (item.subconceptos?.length ?? 0) > 0;
            return (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
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
                  <input className="form-input" type="number" value={item.cantidad}
                    onChange={e => updateItem(i, "cantidad", +e.target.value)} style={{ padding: "8px" }} />
                  <textarea className="form-textarea" value={item.descripcion}
                    onChange={e => updateItem(i, "descripcion", e.target.value)}
                    placeholder="Descripción del concepto" rows={2}
                    style={{ resize: "vertical", minHeight: 40 }} />
                  <input className="form-input" type="number" value={item.precioUnitario}
                    onChange={e => updateItem(i, "precioUnitario", +e.target.value)}
                    style={{ padding: "8px" }}
                    readOnly={tieneSubconceptos}
                    title={tieneSubconceptos ? "Calculado desde subconceptos" : ""} />
                  <input className="form-input" value={`$${item.total.toLocaleString()}`} readOnly style={{ padding: "8px", color: "var(--text-muted)" }} />
                  <button className="btn btn-danger btn-icon" onClick={() => removeItem(i)}>✕</button>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Subconceptos {tieneSubconceptos ? `(${item.subconceptos?.length})` : ""}
                    </p>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem", padding: "3px 8px" }} onClick={() => addSubconcepto(i)}>
                      + Agregar subconcepto
                    </button>
                  </div>
                  {tieneSubconceptos && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.subconceptos!.map((sub, si) => (
                        <div key={si} style={{ display: "grid", gridTemplateColumns: "1fr 120px 28px", gap: 6, alignItems: "center" }}>
                          <input className="form-input" value={sub.descripcion}
                            onChange={e => updateSubconcepto(i, si, "descripcion", e.target.value)}
                            placeholder="Descripción del subconcepto"
                            style={{ fontSize: "0.82rem", padding: "6px 10px" }} />
                          <input className="form-input" type="number" value={sub.precio}
                            onChange={e => updateSubconcepto(i, si, "precio", +e.target.value)}
                            placeholder="Precio"
                            style={{ fontSize: "0.82rem", padding: "6px 10px" }} />
                          <button className="btn btn-danger btn-icon" style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                            onClick={() => removeSubconcepto(i, si)}>✕</button>
                        </div>
                      ))}
                      <p style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: 2 }}>
                        Suma subconceptos: ${(item.subconceptos!.reduce((a, s) => a + s.precio, 0)).toLocaleString("es-MX", { minimumFractionDigits: 2 })} → Precio U. calculado automáticamente
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
            <span>Subtotal:</span><span>${form.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
            <span>IVA (16%):</span><span>${form.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            <span>Total:</span><span>${form.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={() => { setModal(false); setEditing(null); }}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </div>
  );

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

        <div className="table-card" style={{ overflowX: "auto" }}>
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
                <tr><th>Folio</th><th>Tipo</th><th>Cliente</th><th>Asesor</th><th>Fecha</th><th>Total</th><th>Estatus</th><th>Comentarios</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{c.folio}</td>
                    <td><span className={`badge ${TIPO_BADGE[c.tipo]}`}>{c.tipo}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      {nombreCliente(c)}
                      {!c.cliente && c.clienteOcasional?.nombre && (
                        <span style={{ fontSize: "0.65rem", color: "var(--accent)", background: "rgba(245,158,11,0.12)", padding: "1px 6px", borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>
                          OCASIONAL
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{c.asesor?.nombre ?? "—"}</td>
                    <td>{fmt(c.fecha)}</td>
                    <td style={{ fontWeight: 700 }}>${c.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td>
                      <select className="form-select" style={{ padding: "4px 8px", fontSize: "0.78rem", width: "auto" }}
                        value={c.estatus} onChange={e => cambiarEstatus(c._id, e.target.value)}>
                        <option value="borrador">Borrador</option>
                        <option value="enviada">Enviada</option>
                        <option value="aceptada">Aceptada</option>
                        <option value="rechazada">Rechazada</option>
                      </select>
                    </td>
                    <td>
                      {canComment && (
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => { setComentarioModal(c); setNuevoComentario(""); }}
                          style={{ position: "relative" }}>
                          💬
                          {c.comentarios?.length > 0 && (
                            <span style={{ position: "absolute", top: -6, right: -6, background: "var(--accent)", color: "#000", borderRadius: "50%", width: 16, height: 16, fontSize: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.comentarios.length}</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => generarReporte({ ...c, cliente: c.cliente ?? c.clienteOcasional })} title="Ver reporte">👁️</button>
                        <button className="btn btn-primary btn-sm" onClick={() => descargarPDF({ ...c, cliente: c.cliente ?? c.clienteOcasional })} title="Descargar PDF">📥 PDF</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)} title="Editar">✏️</button>
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

      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setEditing(null); } }}>
          {modalForm}
        </div>
      )}

      {comentarioModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setComentarioModal(null); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setComentarioModal(null)}>✕</button>
            <h2 className="modal-title">Comentarios — {comentarioModal.folio}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className={`badge ${TIPO_BADGE[comentarioModal.tipo]}`}>{comentarioModal.tipo}</span>
              <span className={`badge ${ESTATUS_BADGE[comentarioModal.estatus]}`}>{comentarioModal.estatus}</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>{nombreCliente(comentarioModal)}</p>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {comentarioModal.comentarios.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>Sin comentarios aún</p>
                </div>
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