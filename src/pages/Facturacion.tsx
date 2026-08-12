import { useEffect, useState, useRef } from "react";
import { api } from "../api";

// ── Catálogos SAT ──
const REGIMENES = [
  { clave: "601", desc: "General de Ley Personas Morales" },
  { clave: "603", desc: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", desc: "Sueldos y Salarios" },
  { clave: "606", desc: "Arrendamiento" },
  { clave: "608", desc: "Demás ingresos" },
  { clave: "610", desc: "Residentes en el Extranjero" },
  { clave: "611", desc: "Ingresos por Dividendos" },
  { clave: "612", desc: "Personas Físicas con Actividades Empresariales" },
  { clave: "614", desc: "Ingresos por intereses" },
  { clave: "616", desc: "Sin obligaciones fiscales" },
  { clave: "620", desc: "Sociedades Cooperativas de Producción" },
  { clave: "621", desc: "Incorporación Fiscal" },
  { clave: "622", desc: "Actividades Agrícolas, Ganaderas, Silvícolas" },
  { clave: "623", desc: "Opcional para Grupos de Sociedades" },
  { clave: "624", desc: "Coordinados" },
  { clave: "625", desc: "Actividades Empresariales con Plataformas Tecnológicas" },
  { clave: "626", desc: "Régimen Simplificado de Confianza" },
];

const USOS_CFDI = [
  { clave: "G01", desc: "Adquisición de mercancías" },
  { clave: "G02", desc: "Devoluciones, descuentos o bonificaciones" },
  { clave: "G03", desc: "Gastos en general" },
  { clave: "I01", desc: "Construcciones" },
  { clave: "I02", desc: "Mobiliario y equipo de oficina" },
  { clave: "I03", desc: "Equipo de transporte" },
  { clave: "I04", desc: "Equipo de cómputo y accesorios" },
  { clave: "I08", desc: "Otra maquinaria y equipo" },
  { clave: "S01", desc: "Sin efectos fiscales" },
  { clave: "CP01", desc: "Pagos" },
];

const FORMAS_PAGO = [
  { clave: "01", desc: "Efectivo" },
  { clave: "02", desc: "Cheque nominativo" },
  { clave: "03", desc: "Transferencia electrónica" },
  { clave: "04", desc: "Tarjeta de crédito" },
  { clave: "28", desc: "Tarjeta de débito" },
  { clave: "99", desc: "Por definir" },
];

const CLAVES_UNIDAD = [
  { clave: "E48", desc: "Unidad de servicio" },
  { clave: "C62", desc: "Uno" },
  { clave: "MON", desc: "Mes" },
  { clave: "ACT", desc: "Actividad" },
  { clave: "KGM", desc: "Kilogramo" },
  { clave: "H87", desc: "Pieza" },
];

type ProductoFiscal = {
  _id: string;
  claveSAT: string;
  claveUnidad: string;
  unidad: string;
  descripcion: string;
};

type Partida = {
  cantidad: number;
  claveUnidad: string;
  unidad: string;
  claveProdServ: string;
  descripcion: string;
  valorUnitario: number;
  importe: number;
  descuento: number;
};

type Receptor = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  usoCfdi: string;
  cp: string;
  email?: string;
};

type Factura = {
  _id: string;
  folio: string;
  serie: string;
  uuid?: string;
  tipo: "factura" | "rep" | "nota_credito";
  estatus: "vigente" | "cancelada" | "pendiente";
  estatusPago: "sin_pago" | "parcial" | "pagada" | "no_aplica";
  moneda: string;
  subtotal: number;
  total: number;
  totalPagado: number;
  receptor: Receptor;
  metodoPago: string;
  formaPago: string;
  fechaEmision: string;
  urlPdf?: string;
  urlXml?: string;
  partidas: Partida[];
  notas?: string;
  createdAt: string;
};

const emptyReceptor: Receptor = {
  rfc: "", nombre: "", regimenFiscal: "601", usoCfdi: "G03", cp: "", email: "",
};

const emptyPartida = (): Partida => ({
  cantidad: 1, claveUnidad: "E48", unidad: "Unidad de servicio",
  claveProdServ: "80101500", descripcion: "", valorUnitario: 0, importe: 0, descuento: 0,
});

function calcTotales(partidas: Partida[]) {
  const subtotal   = partidas.reduce((a, p) => a + p.cantidad * p.valorUnitario, 0);
  const descuentos = partidas.reduce((a, p) => a + (p.descuento ?? 0), 0);
  const base       = subtotal - descuentos;
  const iva        = parseFloat((base * 0.16).toFixed(2));
  const total      = parseFloat((base + iva).toFixed(2));
  return { subtotal: parseFloat(subtotal.toFixed(2)), descuentos: parseFloat(descuentos.toFixed(2)), base: parseFloat(base.toFixed(2)), iva, total };
}

// ── Buscador de clientes ──
function BuscadorCliente({ onSelect }: { onSelect: (c: any) => void }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);
  const timer                 = useRef<any>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function buscar(q: string) {
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/facturacion/clientes/buscar?q=${encodeURIComponent(q)}`);
        setResults(data);
        setOpen(true);
      } catch {}
      finally { setLoading(false); }
    }, 400);
  }

  function select(c: any) {
    onSelect(c);
    setQuery(c.nombreFiscal ?? c.nombre ?? c.rfc ?? "");
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input className="form-input" value={query} onChange={e => buscar(e.target.value)}
          placeholder="🔍 Buscar por RFC o nombre..." autoComplete="off" />
        {loading && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {results.map((c, i) => (
            <div key={i} onClick={() => select(c)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent)" }}>{c.rfc}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text)" }}>{c.nombreFiscal ?? c.nombre}</div>
              {c.regimenFiscal && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Régimen: {c.regimenFiscal}</div>}
            </div>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Sin resultados — captura los datos manualmente
        </div>
      )}
    </div>
  );
}

// ── Buscador de productos fiscales ──
function BuscadorProducto({ onSelect }: { onSelect: (p: ProductoFiscal) => void }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<ProductoFiscal[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);
  const timer                 = useRef<any>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function buscar(q: string) {
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/facturacion/productos?q=${encodeURIComponent(q)}`);
        setResults(data);
        setOpen(true);
      } catch {}
      finally { setLoading(false); }
    }, 300);
  }

  useEffect(() => {
    buscar("");
  }, []);

  function select(p: ProductoFiscal) {
    onSelect(p);
    setQuery(p.descripcion);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input className="form-input" value={query}
          onChange={e => buscar(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); else buscar(query); }}
          placeholder="🔍 Buscar en catálogo de productos/servicios..."
          style={{ fontSize: "0.85rem" }} />
        {loading && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          </div>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {results.length === 0 ? (
            <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Sin productos en catálogo — captura la clave manualmente
            </div>
          ) : results.map((p, i) => (
            <div key={i} onClick={() => select(p)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--accent)" }}>{p.claveSAT} — {p.claveUnidad}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text)" }}>{p.descripcion}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal gestión de productos fiscales ──
function ModalProductos({ onClose }: { onClose: () => void }) {
  const [productos, setProductos]   = useState<ProductoFiscal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState({ claveSAT: "", claveUnidad: "E48", unidad: "Unidad de servicio", descripcion: "" });
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadProductos(); }, []);

  async function loadProductos() {
    try {
      const { data } = await api.get("/facturacion/productos");
      setProductos(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function guardar() {
    if (!form.claveSAT.trim() || !form.descripcion.trim()) return;
    setSaving(true);
    try {
      await api.post("/facturacion/productos", form);
      setForm({ claveSAT: "", claveUnidad: "E48", unidad: "Unidad de servicio", descripcion: "" });
      await loadProductos();
    } catch {}
    finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    await api.delete(`/facturacion/productos/${id}`);
    setProductos(prev => prev.filter(p => p._id !== id));
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 660 }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">📦 Catálogo de productos y servicios fiscales</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>
          Estos productos se auto-llenan en las partidas de la factura — equivalente al catálogo de Enlace Fiscal.
        </p>

        {/* Form nuevo producto */}
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>+ Nuevo producto/servicio</p>
          <div className="form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clave SAT *</label>
              <input className="form-input" value={form.claveSAT} onChange={e => setForm(p => ({ ...p, claveSAT: e.target.value }))} placeholder="Ej. 80101500" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clave unidad SAT *</label>
              <select className="form-select" value={form.claveUnidad} onChange={e => { const u = CLAVES_UNIDAD.find(u => u.clave === e.target.value); setForm(p => ({ ...p, claveUnidad: e.target.value, unidad: u?.desc ?? p.unidad })); }}>
                {CLAVES_UNIDAD.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
              </select>
            </div>
            <div className="form-group span-2" style={{ margin: 0 }}>
              <label className="form-label">Descripción *</label>
              <input className="form-input" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej. Servicio de mantenimiento correctivo de montacargas" onKeyDown={e => { if (e.key === "Enter") guardar(); }} />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || !form.claveSAT.trim() || !form.descripcion.trim()}>
              {saving ? "Guardando..." : "+ Agregar al catálogo"}
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : productos.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">📦</span><p>Sin productos registrados</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
            {productos.map(p => (
              <div key={p._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent)", marginRight: 8 }}>{p.claveSAT}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginRight: 8 }}>{p.claveUnidad}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>{p.descripcion}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => eliminar(p._id)}>🗑️</button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Facturacion() {
  const rol         = localStorage.getItem("rol") ?? "";
  const canFacturar = ["developer", "gerencia", "oficina"].includes(rol);
  const canAdmin    = ["developer", "gerencia"].includes(rol);

  const [facturas, setFacturas]           = useState<Factura[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [filtroTipo, setFiltroTipo]       = useState<"todos" | "factura" | "rep">("todos");
  const [filtroEstatus, setFiltroEstatus] = useState<"todos" | "vigente" | "cancelada">("vigente");
  const [filtroPago, setFiltroPago]       = useState<"todos" | "sin_pago" | "parcial" | "pagada">("todos");
  const [desde, setDesde]                 = useState("");
  const [hasta, setHasta]                 = useState("");

  const [modalFactura, setModalFactura]     = useState(false);
  const [modalRep, setModalRep]             = useState<Factura | null>(null);
  const [modalCancelar, setModalCancelar]   = useState<Factura | null>(null);
  const [modalDetalle, setModalDetalle]     = useState<Factura | null>(null);
  const [modalProductos, setModalProductos] = useState(false);

  const [receptor, setReceptor]         = useState<Receptor>({ ...emptyReceptor });
  const [partidas, setPartidas]         = useState<Partida[]>([emptyPartida()]);
  const [metodoPago, setMetodoPago]     = useState("PUE");
  const [formaPago, setFormaPago]       = useState("03");
  const [condiciones, setCondiciones]   = useState("");
  const [fechaVenc, setFechaVenc]       = useState("");
  const [moneda, setMoneda]             = useState<"MXN" | "USD">("MXN");
  const [tipoCambio, setTipoCambio]     = useState<number>(0);
  const [notasFactura, setNotasFactura] = useState("");
  const [saving, setSaving]             = useState(false);

  const [repMonto, setRepMonto]   = useState<number>(0);
  const [repForma, setRepForma]   = useState("03");
  const [repFecha, setRepFecha]   = useState(new Date().toISOString().split("T")[0]);
  const [repRef, setRepRef]       = useState("");
  const [savingRep, setSavingRep] = useState(false);

  const [motivoCancelacion, setMotivoCancelacion] = useState("02");
  const [savingCancelar, setSavingCancelar]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo !== "todos")    params.append("tipo",    filtroTipo);
      if (filtroEstatus !== "todos") params.append("estatus", filtroEstatus);
      if (search) params.append("search", search);
      if (desde)  params.append("desde",  desde);
      if (hasta)  params.append("hasta",  hasta);
      const { data } = await api.get(`/facturacion?${params}`);
      setFacturas(data);
    } catch {}
    finally { setLoading(false); }
  }

  function resetForm() {
    setReceptor({ ...emptyReceptor });
    setPartidas([emptyPartida()]);
    setMetodoPago("PUE");
    setFormaPago("03");
    setCondiciones("");
    setFechaVenc("");
    setMoneda("MXN");
    setTipoCambio(0);
    setNotasFactura("");
  }

  function onClienteSelect(c: any) {
    setReceptor(prev => ({
      ...prev,
      rfc:           c.rfc           ?? prev.rfc,
      nombre:        c.nombreFiscal  ?? c.nombre ?? prev.nombre,
      regimenFiscal: c.regimenFiscal ?? prev.regimenFiscal,
      usoCfdi:       c.usoCfdi       ?? prev.usoCfdi,
      cp:            c.cp            ?? prev.cp,
      email:         c.email         ?? prev.email,
    }));
  }

  function onProductoSelect(i: number, p: ProductoFiscal) {
    setPartidas(prev => prev.map((partida, idx) => {
      if (idx !== i) return partida;
      return {
        ...partida,
        claveProdServ: p.claveSAT,
        claveUnidad:   p.claveUnidad,
        unidad:        p.unidad,
        descripcion:   p.descripcion,
        importe:       parseFloat((partida.cantidad * partida.valorUnitario).toFixed(2)),
      };
    }));
  }

  function updatePartida(i: number, field: string, val: any) {
    setPartidas(prev => prev.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [field]: val };
      if (field === "cantidad" || field === "valorUnitario") {
        updated.importe = parseFloat((updated.cantidad * updated.valorUnitario).toFixed(2));
      }
      return updated;
    }));
  }

  async function timbrar() {
    if (!receptor.rfc || !receptor.nombre || !partidas.some(p => p.descripcion.trim())) return;
    setSaving(true);
    try {
      const { data } = await api.post("/facturacion/timbrar", {
        receptor,
        partidas: partidas.filter(p => p.descripcion.trim()),
        metodoPago,
        formaPago: metodoPago === "PPD" ? "99" : formaPago,
        condicionesPago: condiciones || undefined,
        fechaVencimiento: fechaVenc || undefined,
        moneda,
        tipoCambio: moneda !== "MXN" && tipoCambio ? tipoCambio : undefined,
        notas: notasFactura || undefined,
      });
      setFacturas(prev => [data.factura, ...prev]);
      setModalFactura(false);
      resetForm();
    } catch (e: any) {
      alert(e?.response?.data?.detalle?.AckEnlaceFiscal?.descripcionError ?? e?.response?.data?.message ?? "Error al timbrar");
    }
    finally { setSaving(false); }
  }

  async function emitirRep() {
    if (!modalRep || !repMonto) return;
    setSavingRep(true);
    try {
      const { data } = await api.post("/facturacion/rep", {
        facturaId: modalRep._id, montoPagado: repMonto,
        formaPago: repForma, fechaPago: repFecha,
        referenciaBancaria: repRef || undefined,
      });
      setFacturas(prev => [data.rep, ...prev.map(f =>
        f._id === modalRep._id
          ? { ...f, totalPagado: f.totalPagado + repMonto, estatusPago: f.totalPagado + repMonto >= f.total ? "pagada" : "parcial" as any }
          : f
      )]);
      setModalRep(null);
      setRepMonto(0); setRepForma("03"); setRepFecha(new Date().toISOString().split("T")[0]); setRepRef("");
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Error al emitir REP");
    }
    finally { setSavingRep(false); }
  }

  async function cancelar() {
    if (!modalCancelar) return;
    setSavingCancelar(true);
    try {
      await api.post(`/facturacion/${modalCancelar._id}/cancelar`, { motivo: motivoCancelacion });
      setFacturas(prev => prev.map(f => f._id === modalCancelar._id ? { ...f, estatus: "cancelada" } : f));
      setModalCancelar(null);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Error al cancelar");
    }
    finally { setSavingCancelar(false); }
  }

  const totales = calcTotales(partidas);
  const simb    = moneda === "USD" ? "USD $" : "$";

  const filtered = facturas.filter(f => {
    if (filtroTipo !== "todos"    && f.tipo       !== filtroTipo)    return false;
    if (filtroEstatus !== "todos" && f.estatus    !== filtroEstatus) return false;
    if (filtroPago !== "todos"    && f.estatusPago !== filtroPago)   return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.folio.toLowerCase().includes(q) ||
        (f.uuid ?? "").toLowerCase().includes(q) ||
        f.receptor.nombre.toLowerCase().includes(q) ||
        f.receptor.rfc.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalVigente   = facturas.filter(f => f.estatus === "vigente" && f.tipo === "factura").reduce((a, f) => a + f.total, 0);
  const totalCobrado   = facturas.filter(f => f.tipo === "factura").reduce((a, f) => a + f.totalPagado, 0);
  const totalPendiente = facturas.filter(f => f.estatus === "vigente" && f.tipo === "factura" && f.estatusPago !== "pagada").reduce((a, f) => a + (f.total - f.totalPagado), 0);
  const totalReps      = facturas.filter(f => f.tipo === "rep").length;

  function fmtFecha(d?: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function badgePago(f: Factura) {
    if (f.tipo !== "factura") return null;
    const map: Record<string, { label: string; color: string; bg: string }> = {
      sin_pago:  { label: "Sin pago", color: "#b45309", bg: "rgba(245,158,11,0.15)" },
      parcial:   { label: "Parcial",  color: "#1d4ed8", bg: "rgba(59,130,246,0.15)" },
      pagada:    { label: "Pagada",   color: "#15803d", bg: "rgba(34,197,94,0.15)"  },
      no_aplica: { label: "N/A",      color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
    };
    const s = map[f.estatusPago] ?? map.sin_pago;
    return <span style={{ fontSize: "0.72rem", fontWeight: 700, color: s.color, background: s.bg, padding: "2px 8px", borderRadius: 20 }}>{s.label}</span>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación</h1>
          <p className="page-subtitle">RFC: EIM140306JN1 · Serie M</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canAdmin && (
            <button className="btn btn-secondary" onClick={() => setModalProductos(true)}>
              📦 Catálogo
            </button>
          )}
          {canFacturar && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setModalFactura(true); }}>
              + Nueva Factura
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {[
            { label: "Total facturado", val: `$${totalVigente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,   color: "var(--accent)", icon: "🧾" },
            { label: "Total cobrado",   val: `$${totalCobrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,   color: "var(--green)",  icon: "✅" },
            { label: "Por cobrar",      val: `$${totalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, color: "var(--red)",    icon: "⏳" },
            { label: "REPs emitidos",   val: totalReps,                                                                    color: "var(--blue)",   icon: "💳" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-card-icon">{s.icon}</span>
              <p className="stat-card-value" style={{ color: s.color }}>{s.val}</p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Comprobantes fiscales</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["todos","Todos"],["factura","Facturas"],["rep","REPs"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setFiltroTipo(val)}
                    style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: "0.78rem", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: filtroTipo === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: filtroTipo === val ? "var(--accent)" : "var(--text-muted)", fontWeight: filtroTipo === val ? 700 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["vigente","Vigentes"],["cancelada","Canceladas"],["todos","Todas"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setFiltroEstatus(val)}
                    style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: "0.78rem", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: filtroEstatus === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: filtroEstatus === val ? "var(--accent)" : "var(--text-muted)", fontWeight: filtroEstatus === val ? 700 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["todos","Todos"],["sin_pago","Sin pago"],["parcial","Parcial"],["pagada","Pagadas"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setFiltroPago(val)}
                    style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: "0.78rem", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: filtroPago === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: filtroPago === val ? "var(--accent)" : "var(--text-muted)", fontWeight: filtroPago === val ? 700 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
              <input className="form-input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: "auto", padding: "7px 10px", fontSize: "0.82rem" }} />
              <input className="form-input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: "auto", padding: "7px 10px", fontSize: "0.82rem" }} />
              <button className="btn btn-secondary btn-sm" onClick={load}>🔍 Buscar</button>
              <input className="search-input" placeholder="RFC, nombre, folio..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🧾</span><p>Sin comprobantes</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Folio</th><th>Tipo</th><th>Fecha</th><th>Cliente</th><th>RFC</th>
                  <th>Moneda</th><th>Total</th><th>Pagado</th><th>Pago</th><th>Estatus</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>{f.folio}</td>
                    <td>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: f.tipo === "rep" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)", color: f.tipo === "rep" ? "var(--blue)" : "var(--accent)" }}>
                        {f.tipo === "rep" ? "REP" : f.tipo === "nota_credito" ? "NC" : "FACTURA"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFecha(f.fechaEmision)}</td>
                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.receptor.nombre}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{f.receptor.rfc}</td>
                    <td>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: f.moneda === "USD" ? "#1d4ed8" : "var(--text-muted)", background: f.moneda === "USD" ? "rgba(29,78,216,0.1)" : "var(--surface2)", padding: "2px 6px", borderRadius: 6 }}>
                        {f.moneda}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {f.moneda === "USD" ? "USD " : ""}${f.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--green)", whiteSpace: "nowrap" }}>
                      {f.totalPagado > 0 ? `$${f.totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td>{badgePago(f)}</td>
                    <td>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: f.estatus === "vigente" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: f.estatus === "vigente" ? "var(--green)" : "var(--red)" }}>
                        {f.estatus === "vigente" ? "Vigente" : "Cancelada"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModalDetalle(f)} title="Ver detalle">👁️</button>
                        {f.urlPdf && <a className="btn btn-secondary btn-sm" href={f.urlPdf} target="_blank" rel="noreferrer" title="PDF" style={{ textDecoration: "none" }}>📄</a>}
                        {f.urlXml && <a className="btn btn-secondary btn-sm" href={f.urlXml} target="_blank" rel="noreferrer" title="XML" style={{ textDecoration: "none" }}>📋</a>}
                        {f.tipo === "factura" && f.estatus === "vigente" && f.estatusPago !== "pagada" && canFacturar && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setModalRep(f); setRepMonto(parseFloat((f.total - f.totalPagado).toFixed(2))); }} title="Registrar pago">💳 REP</button>
                        )}
                        {f.estatus === "vigente" && canFacturar && (
                          <button className="btn btn-danger btn-sm" onClick={() => { setModalCancelar(f); setMotivoCancelacion("02"); }} title="Cancelar">🚫</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal nueva factura ── */}
      {modalFactura && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModalFactura(false); resetForm(); } }}>
          <div className="modal" style={{ maxWidth: 800, width: "96vw" }}>
            <button className="modal-close" onClick={() => { setModalFactura(false); resetForm(); }}>✕</button>
            <h2 className="modal-title">🧾 Nueva Factura — Serie M</h2>

            {/* Receptor */}
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>📋 Datos del receptor</p>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">Buscar cliente</label>
                <BuscadorCliente onSelect={onClienteSelect} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">RFC *</label>
                  <input className="form-input" value={receptor.rfc} onChange={e => setReceptor(p => ({ ...p, rfc: e.target.value.toUpperCase() }))} placeholder="RFC sin guiones" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre fiscal *</label>
                  <input className="form-input" value={receptor.nombre} onChange={e => setReceptor(p => ({ ...p, nombre: e.target.value.toUpperCase() }))} placeholder="Como aparece en constancia fiscal" />
                </div>
                <div className="form-group">
                  <label className="form-label">Régimen fiscal *</label>
                  <select className="form-select" value={receptor.regimenFiscal} onChange={e => setReceptor(p => ({ ...p, regimenFiscal: e.target.value }))}>
                    {REGIMENES.map(r => <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Uso CFDI *</label>
                  <select className="form-select" value={receptor.usoCfdi} onChange={e => setReceptor(p => ({ ...p, usoCfdi: e.target.value }))}>
                    {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Código postal *</label>
                  <input className="form-input" value={receptor.cp} onChange={e => setReceptor(p => ({ ...p, cp: e.target.value }))} placeholder="Ej. 44580" maxLength={5} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (para envío)</label>
                  <input className="form-input" value={receptor.email ?? ""} onChange={e => setReceptor(p => ({ ...p, email: e.target.value }))} placeholder="cliente@empresa.com" />
                </div>
              </div>
            </div>

            {/* Moneda y pago */}
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>💰 Pago y moneda</p>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Moneda</label>
                  <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    {(["MXN", "USD"] as const).map((val, i) => (
                      <button key={val} type="button" onClick={() => setMoneda(val)}
                        style={{ flex: 1, padding: "10px 8px", border: "none", cursor: "pointer", background: moneda === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: moneda === val ? "var(--accent)" : "var(--text-muted)", fontWeight: moneda === val ? 700 : 400, fontSize: "0.85rem", borderRight: i === 0 ? "1px solid var(--border)" : "none" }}>
                        {val === "MXN" ? "🇲🇽 Pesos (MXN)" : "🇺🇸 Dólares (USD)"}
                      </button>
                    ))}
                  </div>
                </div>
                {moneda === "USD" && (
                  <div className="form-group">
                    <label className="form-label">Tipo de cambio</label>
                    <input className="form-input" type="number" step="0.01" value={tipoCambio} onChange={e => setTipoCambio(+e.target.value)} placeholder="Ej. 17.50" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Método de pago</label>
                  <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    {(["PUE","PPD"] as const).map((val, i) => (
                      <button key={val} type="button" onClick={() => setMetodoPago(val)}
                        style={{ flex: 1, padding: "10px 8px", border: "none", cursor: "pointer", background: metodoPago === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: metodoPago === val ? "var(--accent)" : "var(--text-muted)", fontWeight: metodoPago === val ? 700 : 400, fontSize: "0.85rem", borderRight: i === 0 ? "1px solid var(--border)" : "none" }}>
                        {val === "PUE" ? "PUE — Una sola exhibición" : "PPD — Parcialidades"}
                      </button>
                    ))}
                  </div>
                </div>
                {metodoPago === "PUE" && (
                  <div className="form-group">
                    <label className="form-label">Forma de pago</label>
                    <select className="form-select" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                      {FORMAS_PAGO.map(f => <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Condiciones de pago</label>
                  <input className="form-input" value={condiciones} onChange={e => setCondiciones(e.target.value)} placeholder="Ej. 30 días netos" />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de vencimiento</label>
                  <input className="form-input" type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Partidas */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>📦 Conceptos / Partidas</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setPartidas(p => [...p, emptyPartida()])}>+ Agregar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {partidas.map((p, i) => (
                  <div key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                    {/* Buscador de producto */}
                    <div className="form-group" style={{ margin: "0 0 10px" }}>
                      <label className="form-label">Buscar en catálogo</label>
                      <BuscadorProducto onSelect={prod => onProductoSelect(i, prod)} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Clave prod/serv SAT</label>
                        <input className="form-input" value={p.claveProdServ} onChange={e => updatePartida(i, "claveProdServ", e.target.value)} placeholder="Ej. 80101500" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Clave unidad SAT</label>
                        <select className="form-select" value={p.claveUnidad} onChange={e => { updatePartida(i, "claveUnidad", e.target.value); updatePartida(i, "unidad", CLAVES_UNIDAD.find(u => u.clave === e.target.value)?.desc ?? ""); }}>
                          {CLAVES_UNIDAD.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: "0 0 8px" }}>
                      <label className="form-label">Descripción *</label>
                      <textarea className="form-textarea" rows={2} value={p.descripcion} onChange={e => updatePartida(i, "descripcion", e.target.value)} placeholder="Descripción del concepto..." style={{ resize: "vertical", minHeight: 40 }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 32px", gap: 8, alignItems: "flex-end" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Cant.</label>
                        <input className="form-input" type="number" min={1} value={p.cantidad} onChange={e => updatePartida(i, "cantidad", +e.target.value)} style={{ padding: "8px" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Valor unitario ({simb})</label>
                        <input className="form-input" type="number" min={0} step="0.01" value={p.valorUnitario} onChange={e => updatePartida(i, "valorUnitario", +e.target.value)} style={{ padding: "8px" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Descuento ({simb})</label>
                        <input className="form-input" type="number" min={0} step="0.01" value={p.descuento} onChange={e => updatePartida(i, "descuento", +e.target.value)} style={{ padding: "8px" }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Importe</label>
                        <input className="form-input" value={`${simb}${((p.cantidad * p.valorUnitario) - p.descuento).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} readOnly style={{ padding: "8px", color: "var(--text-muted)" }} />
                      </div>
                      <button className="btn btn-danger btn-icon" onClick={() => setPartidas(prev => prev.filter((_, idx) => idx !== i))} disabled={partidas.length === 1}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}><span>Subtotal:</span><span>{simb}{totales.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
                {totales.descuentos > 0 && <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}><span>Descuentos:</span><span>-{simb}{totales.descuentos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>}
                <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}><span>IVA 16%:</span><span>{simb}{totales.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: "flex", gap: 24, fontSize: "1.1rem", fontWeight: 800, color: "var(--accent)" }}><span>TOTAL:</span><span>{simb}{totales.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas adicionales (aparecen en el PDF)</label>
              <textarea className="form-textarea" rows={2} value={notasFactura} onChange={e => setNotasFactura(e.target.value)} placeholder="Ej. Folio de contrato, referencia interna..." />
            </div>

            {metodoPago === "PPD" && (
              <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--blue)", marginTop: 8 }}>
                💡 Con método <strong>PPD</strong> deberás emitir un <strong>Recibo Electrónico de Pago (REP)</strong> cada vez que el cliente realice un pago.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setModalFactura(false); resetForm(); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={timbrar} disabled={saving || !receptor.rfc || !receptor.nombre}>
                {saving ? "Timbrando..." : "🧾 Timbrar factura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal REP ── */}
      {modalRep && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalRep(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModalRep(null)}>✕</button>
            <h2 className="modal-title">💳 Recibo Electrónico de Pago</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              <strong style={{ color: "var(--text)" }}>{modalRep.folio}</strong> — {modalRep.receptor.nombre}
            </p>
            <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Total factura:</span><span style={{ fontWeight: 700 }}>${modalRep.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Ya pagado:</span><span style={{ color: "var(--green)", fontWeight: 700 }}>${modalRep.totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6 }}><span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Por cobrar:</span><span style={{ color: "var(--accent)", fontWeight: 800, fontSize: "1rem" }}>${(modalRep.total - modalRep.totalPagado).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Monto del pago *</label>
                <input className="form-input" type="number" step="0.01" value={repMonto} onChange={e => setRepMonto(+e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de pago *</label>
                <input className="form-input" type="date" value={repFecha} onChange={e => setRepFecha(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Forma de pago</label>
                <select className="form-select" value={repForma} onChange={e => setRepForma(e.target.value)}>
                  {FORMAS_PAGO.filter(f => f.clave !== "99").map(f => <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Referencia bancaria</label>
                <input className="form-input" value={repRef} onChange={e => setRepRef(e.target.value)} placeholder="Últimos 4 dígitos o referencia" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalRep(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={emitirRep} disabled={savingRep || !repMonto}>
                {savingRep ? "Timbrando REP..." : "💳 Emitir REP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cancelar ── */}
      {modalCancelar && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalCancelar(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <button className="modal-close" onClick={() => setModalCancelar(null)}>✕</button>
            <h2 className="modal-title">🚫 Cancelar CFDI</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              <strong style={{ color: "var(--text)" }}>{modalCancelar.folio}</strong> — {modalCancelar.receptor.nombre}
            </p>
            {modalCancelar.uuid && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 16, wordBreak: "break-all" }}>
                UUID: {modalCancelar.uuid}
              </p>
            )}
            <div className="form-group">
              <label className="form-label">Motivo de cancelación</label>
              <select className="form-select" value={motivoCancelacion} onChange={e => setMotivoCancelacion(e.target.value)}>
                <option value="01">01 — Comprobante emitido con errores con relación</option>
                <option value="02">02 — Comprobante emitido con errores sin relación</option>
                <option value="03">03 — No se llevó a cabo la operación</option>
                <option value="04">04 — Operación nominativa relacionada con factura global</option>
              </select>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--red)", marginBottom: 12 }}>
              ⚠️ Esta acción cancela el CFDI ante el SAT. El receptor recibirá una notificación.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalCancelar(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={cancelar} disabled={savingCancelar}>
                {savingCancelar ? "Cancelando..." : "🚫 Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {modalDetalle && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalDetalle(null); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModalDetalle(null)}>✕</button>
            <h2 className="modal-title">{modalDetalle.folio}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: modalDetalle.estatus === "vigente" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: modalDetalle.estatus === "vigente" ? "var(--green)" : "var(--red)" }}>
                {modalDetalle.estatus === "vigente" ? "Vigente" : "Cancelada"}
              </span>
              {badgePago(modalDetalle)}
              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: modalDetalle.moneda === "USD" ? "rgba(29,78,216,0.1)" : "var(--surface2)", color: modalDetalle.moneda === "USD" ? "#1d4ed8" : "var(--text-muted)" }}>
                {modalDetalle.moneda}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["RFC receptor",   modalDetalle.receptor.rfc],
                ["Nombre",         modalDetalle.receptor.nombre],
                ["Régimen fiscal", modalDetalle.receptor.regimenFiscal],
                ["Uso CFDI",       modalDetalle.receptor.usoCfdi],
                ["Método de pago", modalDetalle.metodoPago],
                ["Forma de pago",  modalDetalle.formaPago],
                ["Fecha emisión",  fmtFecha(modalDetalle.fechaEmision)],
                ["UUID SAT",       modalDetalle.uuid ?? "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 600, fontFamily: label === "UUID SAT" ? "monospace" : "inherit", fontSize: label === "UUID SAT" ? "0.72rem" : "inherit", wordBreak: "break-all", textAlign: "right", maxWidth: "60%" }}>{val}</span>
                </div>
              ))}
              <div style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Conceptos</p>
                {modalDetalle.partidas.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", padding: "4px 0", borderBottom: i < modalDetalle.partidas.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ flex: 1, color: "var(--text)" }}>{p.descripcion}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 12, whiteSpace: "nowrap" }}>{p.cantidad} × ${p.valorUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, padding: "8px 12px" }}>
                <div style={{ display: "flex", gap: 20, fontSize: "0.85rem", color: "var(--text-muted)" }}><span>Subtotal:</span><span>${modalDetalle.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: "flex", gap: 20, fontSize: "0.95rem", fontWeight: 800, color: "var(--accent)" }}><span>Total:</span><span>${modalDetalle.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
                {modalDetalle.totalPagado > 0 && <div style={{ display: "flex", gap: 20, fontSize: "0.85rem", color: "var(--green)", fontWeight: 700 }}><span>Pagado:</span><span>${modalDetalle.totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {modalDetalle.urlPdf && <a className="btn btn-secondary" style={{ flex: 1, textDecoration: "none", textAlign: "center" }} href={modalDetalle.urlPdf} target="_blank" rel="noreferrer">📄 Descargar PDF</a>}
                {modalDetalle.urlXml && <a className="btn btn-secondary" style={{ flex: 1, textDecoration: "none", textAlign: "center" }} href={modalDetalle.urlXml} target="_blank" rel="noreferrer">📋 Descargar XML</a>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal catálogo de productos ── */}
      {modalProductos && <ModalProductos onClose={() => setModalProductos(false)} />}
    </>
  );
}