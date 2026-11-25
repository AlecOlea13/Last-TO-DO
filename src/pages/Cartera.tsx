import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import { Ico, Combobox } from "../components/GlassUI";
import { descargarEstadoCuenta, descargarReporteGeneral } from "../utils/estadoCuenta";
import "../glass.css";

// ─── Tipos ────────────────────────────────────────────────────
type Rango = "vigente" | "por_vencer" | "vencida_30" | "vencida_60" | "mas_60" | "sin_definir";
type Estado = "VIGENTE" | "POR_VENCER" | "VENCIDA" | "PARCIAL_VIGENTE" | "PARCIAL_POR_VENCER" | "PARCIAL_VENCIDA" | "VENCIMIENTO_POR_DEFINIR" | "PAGADA";
type Riesgo = "bajo" | "medio" | "alto" | "critico" | "por_definir";

type Aging = { vigente: number; d1_30: number; d31_60: number; d61_90: number; d91: number; sinDef: number; total: number };

type ClienteResumen = {
  aging: Aging;
  nombre: string; rfc: string | null;
  diasCreditoCli: number | null;
  facturasPend: number;
  saldoVigente: number; saldoVencido: number; saldoSinDef: number; saldoTotal: number;
  fechaMasAntigua: string | null;
  maxDiasVencidos: number;
  ultimoPago: string | null;
  ultimaEmision: string | null;
  riesgo: Riesgo;
};

type Factura = {
  _id: string; uuid: string | null; folioFactura: string | null;
  fechaEmision: string | null; fechaVencimiento: string | null;
  diasCredito: number | null; total: number; montoPagado: number; saldo: number;
  diasTranscurridos: number; diasVencidos: number; diasParaVencer: number | null;
  sinFechaVencimiento: boolean; rango: Rango; estado: Estado;
  ultimoPago: string | null; nombreReceptor: string | null;
  moneda?: string; conceptos?: { descripcion: string; cantidad: number; importe: number }[];
};

type Resumen = {
  carteraTotal: number; carteraVigente: number; carteraVencida: number;
  carteraSinDefinir: number; pctVencida: number;
  clientesPend: number; clientesVencidos: number;
  facturasPend: number; facturasVencidas: number; facturasSinFecha: number;
  promPondDiasVencidos: number; saldoMas90: number;
};

type Rangos = Record<Rango, number>;

type Paginacion = { page: number; limit: number; total: number; pages: number };

type ApiCartera = {
  fechaCorte: string; resumen: Resumen; rangos: Rangos; aging: Aging;
  clientes: ClienteResumen[]; paginacion: Paginacion;
};

type DetalleCliente = {
  aging: Aging;
  cliente: { nombre: string; rfc: string | null; diasCreditoCli: number | null; condicionesPago: string | null; contacto: string | null; email: string | null };
  resumen: { saldoTotal: number; saldoVencido: number; saldoVigente: number; facturasPend: number; maxDiasVencidos: number; ultimoPago: string | null };
  facturas: Factura[];
};

type Filtros = {
  fechaCorte: string; cliente: string; busqueda: string;
  estado: string; rango: string;
  emisionDesde: string; emisionHasta: string;
  vencimientoDesde: string; vencimientoHasta: string;
  saldoMin: string; saldoMax: string;
  soloVencidas: boolean; sinFechaVencimiento: boolean; soloParcial: boolean;
  sort: string; page: number; limit: number;
};

// ─── Utilidades de formato ────────────────────────────────────
function mxn(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
function fmtFecha(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return new Date(+y, +m - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

const RIESGO_COLOR: Record<Riesgo, string> = {
  bajo:       "var(--green)",
  medio:      "#f0b429",
  alto:       "#f97316",
  critico:    "var(--red)",
  por_definir:"var(--text-muted)",
};
const RIESGO_LABEL: Record<Riesgo, string> = {
  bajo:       "Bajo",
  medio:      "Medio",
  alto:       "Alto",
  critico:    "Crítico",
  por_definir:"Por definir",
};

// ─── Antigüedad en columnas (días desde el vencimiento) ──────
const AG_COLS: { k: keyof Aging; label: string; color: string }[] = [
  { k: "vigente", label: "Por vencer",  color: "#22c55e" },
  { k: "d1_30",   label: "1 – 30",      color: "#eab308" },
  { k: "d31_60",  label: "31 – 60",     color: "#f97316" },
  { k: "d61_90",  label: "61 – 90",     color: "#ef4444" },
  { k: "d91",     label: "91 +",        color: "#b91c1c" },
];
const dashMxn = (n: number) => (n > 0.004 ? mxn(n) : "—");

function PanelAging({ aging }: { aging: Aging }) {
  const tot = aging.total || 1;
  return (
    <div className="table-card" style={{ padding: "18px 22px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Antigüedad de saldos · días desde el vencimiento</p>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total cartera <b style={{ color: "var(--text)", fontSize: "1.05rem", marginLeft: 6 }}>{mxn(aging.total)}</b></p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {AG_COLS.map(c => (
          <div key={c.k} className="g-ag-cell" style={{ ["--c" as any]: c.color }}>
            <span className="g-ag-lbl">{c.label} <small>días</small></span>
            <span className="g-ag-val">{mxn(aging[c.k])}</span>
            <span className="g-ag-pct">{((aging[c.k] / tot) * 100).toFixed(1)}%</span>
          </div>
        ))}
        {aging.sinDef > 0.004 && (
          <div className="g-ag-cell" style={{ ["--c" as any]: "#94a3b8" }}>
            <span className="g-ag-lbl">Sin fecha</span>
            <span className="g-ag-val">{mxn(aging.sinDef)}</span>
            <span className="g-ag-pct">{((aging.sinDef / tot) * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="g-ag-bar">
        {AG_COLS.map(c => { const pct = (aging[c.k] / tot) * 100; return pct < 0.4 ? null : <div key={c.k} style={{ width: pct + "%", background: c.color }} title={`${c.label} días: ${mxn(aging[c.k])}`} />; })}
      </div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────
function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      fontSize: "0.68rem", fontWeight: 700, color,
      background: color + "22", padding: "2px 8px", borderRadius: 10,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ─── Tarjeta de stat ──────────────────────────────────────────
function StatCard({ icon, val, label, color, small }: { icon: string; val: string; label: string; color: string; small?: boolean }) {
  return (
    <div className="stat-card">
      <span className="stat-card-icon">{icon}</span>
      <p className="stat-card-value" style={{ color, fontSize: small ? "1rem" : undefined }}>{val}</p>
      <p className="stat-card-label">{label}</p>
      <div className="stat-card-accent" style={{ background: color }} />
    </div>
  );
}

// ─── Filtros iniciales ────────────────────────────────────────
function hoy() { return new Date().toISOString().split("T")[0]; }
const FILTROS_INIT: Filtros = {
  fechaCorte: hoy(), cliente: "", busqueda: "", estado: "", rango: "",
  emisionDesde: "", emisionHasta: "", vencimientoDesde: "", vencimientoHasta: "",
  saldoMin: "", saldoMax: "",
  soloVencidas: false, sinFechaVencimiento: false, soloParcial: false,
  sort: "saldo", page: 1, limit: 50,
};

// ─── Componente principal ─────────────────────────────────────
export default function Cartera() {

  const [data, setData]           = useState<ApiCartera | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filtros, setFiltros]     = useState<Filtros>(FILTROS_INIT);
  const [draft, setDraft]         = useState<Filtros>(FILTROS_INIT); // edición sin aplicar
  const [detalle, setDetalle]     = useState<DetalleCliente | null>(null);
  const [loadDet, setLoadDet]     = useState(false);
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Ref para abortar requests anteriores
  const abortRef = useRef<AbortController | null>(null);

  const [generando, setGenerando] = useState<"" | "general" | "cliente">("");

  function armarQuery(f: Filtros, extra?: Record<string, string>) {
    const q = new URLSearchParams();
    if (f.fechaCorte)          q.set("fechaCorte", f.fechaCorte);
    if (f.cliente)             q.set("cliente", f.cliente);
    if (f.busqueda)            q.set("busqueda", f.busqueda);
    if (f.estado)              q.set("estado", f.estado);
    if (f.rango)               q.set("rango", f.rango);
    if (f.emisionDesde)        q.set("emisionDesde", f.emisionDesde);
    if (f.emisionHasta)        q.set("emisionHasta", f.emisionHasta);
    if (f.vencimientoDesde)    q.set("vencimientoDesde", f.vencimientoDesde);
    if (f.vencimientoHasta)    q.set("vencimientoHasta", f.vencimientoHasta);
    if (f.saldoMin)            q.set("saldoMin", f.saldoMin);
    if (f.saldoMax)            q.set("saldoMax", f.saldoMax);
    if (f.soloVencidas)        q.set("soloVencidas", "true");
    if (f.sinFechaVencimiento) q.set("sinFechaVencimiento", "true");
    if (f.soloParcial)         q.set("soloParcial", "true");
    q.set("sort", f.sort); q.set("page", String(f.page)); q.set("limit", String(f.limit));
    if (extra) Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    return q;
  }

  async function descargarGeneral() {
    setGenerando("general");
    try {
      const res = await api.get(`/cartera?${armarQuery(filtros, { page: "1", limit: "200", sort: "saldo" })}`);
      await descargarReporteGeneral(res.data, filtros.fechaCorte);
    } catch { alert("No se pudo generar el reporte. Intenta de nuevo."); }
    finally { setGenerando(""); }
  }

  async function descargarCliente() {
    if (!detalle) return;
    setGenerando("cliente");
    try { await descargarEstadoCuenta(detalle, filtros.fechaCorte); }
    catch { alert("No se pudo generar el estado de cuenta. Intenta de nuevo."); }
    finally { setGenerando(""); }
  }

  // ── Carga principal ─────────────────────────────────────────
  const cargar = useCallback(async (f: Filtros) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (f.fechaCorte)          q.set("fechaCorte", f.fechaCorte);
      if (f.cliente)             q.set("cliente", f.cliente);
      if (f.busqueda)            q.set("busqueda", f.busqueda);
      if (f.estado)              q.set("estado", f.estado);
      if (f.rango)               q.set("rango", f.rango);
      if (f.emisionDesde)        q.set("emisionDesde", f.emisionDesde);
      if (f.emisionHasta)        q.set("emisionHasta", f.emisionHasta);
      if (f.vencimientoDesde)    q.set("vencimientoDesde", f.vencimientoDesde);
      if (f.vencimientoHasta)    q.set("vencimientoHasta", f.vencimientoHasta);
      if (f.saldoMin)            q.set("saldoMin", f.saldoMin);
      if (f.saldoMax)            q.set("saldoMax", f.saldoMax);
      if (f.soloVencidas)        q.set("soloVencidas", "true");
      if (f.sinFechaVencimiento) q.set("sinFechaVencimiento", "true");
      if (f.soloParcial)         q.set("soloParcial", "true");
      q.set("sort", f.sort); q.set("page", String(f.page)); q.set("limit", String(f.limit));

      const res = await api.get(`/cartera?${q}`, {
        signal: abortRef.current.signal,
      });
      setData(res.data);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Error de red");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(filtros); }, []);

  function aplicarFiltros() {
    const nf = { ...draft, page: 1 };
    setFiltros(nf);
    cargar(nf);
    setFiltrosOpen(false);
  }
  function limpiarFiltros() {
    setDraft(FILTROS_INIT);
    setFiltros(FILTROS_INIT);
    cargar(FILTROS_INIT);
    setFiltrosOpen(false);
  }
  function cambiarSort(sort: string) {
    const nf = { ...filtros, sort, page: 1 };
    setFiltros(nf); cargar(nf);
  }
  function cambiarPag(page: number) {
    const nf = { ...filtros, page };
    setFiltros(nf); cargar(nf);
  }

  // ── Conteo de filtros activos ───────────────────────────────
  const filtrosActivos = Object.entries(filtros).filter(([k, v]) => {
    if (k === "fechaCorte") return v !== hoy();
    if (k === "sort") return v !== "saldo";
    if (k === "page" || k === "limit") return false;
    return Boolean(v);
  }).length;

  // ── Detalle de cliente ──────────────────────────────────────
  async function abrirDetalle(nombre: string) {
    setLoadDet(true);
    try {
      const q = new URLSearchParams({ fechaCorte: filtros.fechaCorte });
      const res = await api.get(
        `/cartera/cliente/${encodeURIComponent(nombre)}?${q}`
      );
      setDetalle(res.data);
    } catch { setDetalle(null); }
    finally { setLoadDet(false); }
  }

  // ── Exportar CSV ────────────────────────────────────────────
  function exportarCSV() {
    const q = new URLSearchParams();
    if (filtros.fechaCorte)          q.set("fechaCorte", filtros.fechaCorte);
    if (filtros.soloVencidas)        q.set("soloVencidas", "true");
    if (filtros.rango)               q.set("rango", filtros.rango);
    if (filtros.estado)              q.set("estado", filtros.estado);
    if (filtros.saldoMin)            q.set("saldoMin", filtros.saldoMin);
    if (filtros.saldoMax)            q.set("saldoMax", filtros.saldoMax);
    if (filtros.cliente)             q.set("cliente", filtros.cliente);
    if (filtros.sinFechaVencimiento) q.set("sinFechaVencimiento", "true");
    api.get(`/cartera/exportar/csv?${q}`, { responseType: "blob" })
      .then((res: any) => {
        const u = URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = u;
        link.download = `reporte-cartera-pipsa-${filtros.fechaCorte}.csv`;
        link.click();
        URL.revokeObjectURL(u);
      });
  }

  // ─────────────────────────────────────────────────────────
  const r = data?.resumen;

  return (
    <>
      {/* ── Encabezado ────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cartera de Clientes</h1>
          <p className="page-subtitle">
            Corte al {fmtFecha(filtros.fechaCorte)} · {data?.paginacion.total ?? 0} clientes con saldo pendiente
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => cargar(filtros)}>↺ Actualizar</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setFiltrosOpen(o => !o); setDraft(filtros); }}>
            🔽 Filtros {filtrosActivos > 0 && <span style={{ marginLeft: 4, background: "var(--accent)", color: "#000", borderRadius: 99, fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px" }}>{filtrosActivos}</span>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportarCSV}><Ico name="download" size={14} /> CSV</button>
          <button className="btn btn-primary btn-sm" onClick={descargarGeneral} disabled={generando !== "" || loading}>
            <Ico name="printer" size={14} /> {generando === "general" ? "Generando…" : "Reporte PDF"}
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* ── Error ──────────────────────────────────────── */}
        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", color: "var(--red)", marginBottom: 16, fontSize: "0.88rem" }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Panel de filtros ──────────────────────────── */}
        {filtrosOpen && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Fecha de corte</label>
                <input type="date" className="form-input" value={draft.fechaCorte} onChange={e => setDraft(p => ({ ...p, fechaCorte: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <input className="form-input" placeholder="Nombre o RFC..." value={draft.cliente} onChange={e => setDraft(p => ({ ...p, cliente: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Búsqueda general</label>
                <input className="form-input" placeholder="Folio, UUID..." value={draft.busqueda} onChange={e => setDraft(p => ({ ...p, busqueda: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <Combobox value={draft.estado} onChange={v => setDraft(p => ({ ...p, estado: v }))} placeholder="Todos" clearable options={[
                  { value: "VIGENTE", label: "Vigente" }, { value: "VENCIDA", label: "Vencida" }, { value: "POR_VENCER", label: "Por vencer" },
                  { value: "PARCIAL_VIGENTE", label: "Parcial vigente" }, { value: "PARCIAL_POR_VENCER", label: "Parcial por vencer" },
                  { value: "PARCIAL_VENCIDA", label: "Parcial vencida" }, { value: "VENCIMIENTO_POR_DEFINIR", label: "Sin fecha de vencimiento" },
                ]} />
              </div>
              <div className="form-group">
                <label className="form-label">Rango de antigüedad</label>
                <Combobox value={draft.rango} onChange={v => setDraft(p => ({ ...p, rango: v }))} placeholder="Todos" clearable options={[
                  { value: "vigente", label: "Vigente" }, { value: "por_vencer", label: "Por vencer (1–60 días)" },
                  { value: "vencida_30", label: "Vencida 1–30 días" }, { value: "vencida_60", label: "Vencida 31–60 días" },
                  { value: "mas_60", label: "Vencida más de 60 días" }, { value: "sin_definir", label: "Sin definir" },
                ]} />
              </div>
              <div className="form-group">
                <label className="form-label">Emisión desde</label>
                <input type="date" className="form-input" value={draft.emisionDesde} onChange={e => setDraft(p => ({ ...p, emisionDesde: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Emisión hasta</label>
                <input type="date" className="form-input" value={draft.emisionHasta} onChange={e => setDraft(p => ({ ...p, emisionHasta: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vencimiento desde</label>
                <input type="date" className="form-input" value={draft.vencimientoDesde} onChange={e => setDraft(p => ({ ...p, vencimientoDesde: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vencimiento hasta</label>
                <input type="date" className="form-input" value={draft.vencimientoHasta} onChange={e => setDraft(p => ({ ...p, vencimientoHasta: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Saldo mínimo ($)</label>
                <input type="number" className="form-input" placeholder="0" value={draft.saldoMin} onChange={e => setDraft(p => ({ ...p, saldoMin: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Saldo máximo ($)</label>
                <input type="number" className="form-input" placeholder="∞" value={draft.saldoMax} onChange={e => setDraft(p => ({ ...p, saldoMax: e.target.value }))} />
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
                {[
                  { key: "soloVencidas" as const,        label: "Solo cartera vencida" },
                  { key: "sinFechaVencimiento" as const,  label: "Sin fecha de vencimiento" },
                  { key: "soloParcial" as const,          label: "Solo pagos parciales" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "var(--text)" }}>
                    <input type="checkbox" checked={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>✕ Limpiar</button>
              <button className="btn btn-primary btn-sm" onClick={aplicarFiltros}>✓ Aplicar filtros</button>
            </div>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────── */}
        {r && (
          <>
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: 8 }}>
              <StatCard icon="💼" val={mxn(r.carteraTotal)}    label="Cartera total"      color="var(--blue)"   small />
              <StatCard icon="✅" val={mxn(r.carteraVigente)}  label="Cartera vigente"    color="var(--green)"  small />
              <StatCard icon="🔴" val={mxn(r.carteraVencida)}  label="Cartera vencida"    color="var(--red)"    small />
              <StatCard icon="⚠️" val={fmtPct(r.pctVencida)}   label="% vencida"          color={r.pctVencida > 50 ? "var(--red)" : r.pctVencida > 20 ? "#f97316" : "var(--accent)"} />
              <StatCard icon="👥" val={String(r.clientesPend)} label="Clientes pendientes" color="var(--blue)" />
              <StatCard icon="🚨" val={String(r.clientesVencidos)} label="Clientes vencidos" color="var(--red)" />
              <StatCard icon="📄" val={String(r.facturasPend)} label="Facturas pendientes" color="var(--accent)" />
              <StatCard icon="📛" val={String(r.facturasVencidas)} label="Facturas vencidas" color="var(--red)" />
              <StatCard icon="📅" val={r.promPondDiasVencidos.toFixed(1) + " días"} label="Prom. ponderado días vencidos" color="#f97316" />
              <StatCard icon="💀" val={mxn(r.saldoMas90)}      label="+90 días vencidos"  color="#7f1d1d" small />
              <StatCard icon="❓" val={String(r.facturasSinFecha)} label="Sin fecha vencimiento" color="var(--text-muted)" />
            </div>

            {data?.aging && <PanelAging aging={data.aging} />}
          </>
        )}

        {/* ── Tabla principal ────────────────────────────── */}
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Saldo por cliente</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 210 }}><Combobox value={filtros.sort} onChange={v => v && cambiarSort(v)} options={[
                { value: "saldo", label: "Mayor saldo" }, { value: "saldoVencido", label: "Mayor saldo vencido" },
                { value: "diasVencidos", label: "Más días vencidos" }, { value: "antigüedad", label: "Factura más antigua" },
                { value: "nombre", label: "Nombre A–Z" }, { value: "riesgo", label: "Mayor riesgo" },
              ]} /></div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : !data?.clientes.length ? (
            <div className="empty-state"><span className="empty-icon">💰</span><p>Sin clientes con saldo pendiente</p></div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ fontSize: "0.82rem", minWidth: 1100 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 190 }}>Cliente</th>
                      <th style={{ textAlign: "center" }}>Fact.</th>
                      {AG_COLS.map(c => (
                        <th key={c.k} style={{ textAlign: "right", boxShadow: `inset 0 -2px 0 ${c.color}` }}>{c.k === "vigente" ? "Por vencer" : c.label + " días"}</th>
                      ))}
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th>Riesgo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientes.map(c => (
                      <tr key={c.nombre}>
                        <td style={{ fontWeight: 600 }}>
                          {c.nombre}
                          {c.rfc && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>{c.rfc}</div>}
                        </td>
                        <td style={{ textAlign: "center" }}>{c.facturasPend}</td>
                        {AG_COLS.map(col => {
                          const v = c.aging?.[col.k] ?? 0;
                          return (
                            <td key={col.k} style={{ textAlign: "right", color: v > 0.004 ? col.color : "var(--text-muted)", fontWeight: col.k === "d91" && v > 0 ? 700 : 500 }}>
                              {dashMxn(v)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 800 }}>{mxn(c.saldoTotal)}</span>
                          {(c.aging?.sinDef ?? 0) > 0.004 && <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>{mxn(c.aging.sinDef)} sin fecha</div>}
                        </td>
                        <td><Badge color={RIESGO_COLOR[c.riesgo]} label={RIESGO_LABEL[c.riesgo]} /></td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => abrirDetalle(c.nombre)} disabled={loadDet} title="Ver estado de cuenta">
                            {loadDet ? "…" : <Ico name="eye" size={15} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {data.aging && (
                    <tfoot>
                      <tr className="g-tfoot">
                        <td>TOTAL · {data.paginacion.total} clientes</td>
                        <td style={{ textAlign: "center" }}>{data.resumen.facturasPend}</td>
                        {AG_COLS.map(col => <td key={col.k} style={{ textAlign: "right", color: col.color }}>{dashMxn(data.aging[col.k])}</td>)}
                        <td style={{ textAlign: "right" }}>{mxn(data.aging.total)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Paginación */}
              {data.paginacion.pages > 1 && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "14px 0", alignItems: "center" }}>
                  <button className="btn btn-secondary btn-sm" disabled={filtros.page <= 1} onClick={() => cambiarPag(filtros.page - 1)}>← Anterior</button>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Página {data.paginacion.page} de {data.paginacion.pages} · {data.paginacion.total} clientes
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={filtros.page >= data.paginacion.pages} onClick={() => cambiarPag(filtros.page + 1)}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal detalle cliente ─────────────────────────── */}
      {detalle && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
          <div className="modal" style={{ maxWidth: 1020, maxHeight: "92vh", overflowY: "auto" }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingRight: 36 }}>
              <div>
                <p style={{ fontSize: "0.68rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 700 }}>Estado de cuenta</p>
                <h2 className="modal-title" style={{ marginBottom: 4 }}>{detalle.cliente.nombre}</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  {detalle.cliente.rfc ? `RFC ${detalle.cliente.rfc} · ` : ""}
                  Corte al {fmtFecha(filtros.fechaCorte)}
                  {detalle.cliente.diasCreditoCli ? ` · Crédito ${detalle.cliente.diasCreditoCli} días` : ""}
                  {detalle.cliente.condicionesPago ? ` · ${detalle.cliente.condicionesPago}` : ""}
                </p>
              </div>
              <button className="btn btn-primary" onClick={descargarCliente} disabled={generando !== ""}>
                <Ico name="download" size={15} /> {generando === "cliente" ? "Generando…" : "Descargar estado de cuenta"}
              </button>
            </div>

            {/* Antigüedad del cliente */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, margin: "18px 0 20px" }}>
              {AG_COLS.map(c => (
                <div key={c.k} className="g-ag-cell" style={{ ["--c" as any]: c.color }}>
                  <span className="g-ag-lbl">{c.k === "vigente" ? "Por vencer" : c.label} {c.k !== "vigente" && <small>días</small>}</span>
                  <span className="g-ag-val">{mxn(detalle.aging?.[c.k] ?? 0)}</span>
                </div>
              ))}
              {(detalle.aging?.sinDef ?? 0) > 0.004 && (
                <div className="g-ag-cell" style={{ ["--c" as any]: "#94a3b8" }}>
                  <span className="g-ag-lbl">Sin fecha</span><span className="g-ag-val">{mxn(detalle.aging.sinDef)}</span>
                </div>
              )}
              <div className="g-ag-cell g-ag-total">
                <span className="g-ag-lbl">Total adeudado</span>
                <span className="g-ag-val">{mxn(detalle.aging?.total ?? detalle.resumen.saldoTotal)}</span>
              </div>
            </div>

            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8, letterSpacing: ".08em" }}>
              Facturas pendientes ({detalle.facturas.length}) · último pago {fmtFecha(detalle.resumen.ultimoPago)}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: "0.8rem", minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Emisión</th>
                    <th>Vence</th>
                    <th style={{ minWidth: 220 }}>Concepto</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Pagado</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                    <th>Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.facturas.map(f => {
                    const cs = (f.conceptos ?? []).filter(c => c.descripcion);
                    const col = f.sinFechaVencimiento ? "var(--text-muted)" : f.diasVencidos <= 0 ? "var(--green)"
                      : f.diasVencidos <= 30 ? "#eab308" : f.diasVencidos <= 60 ? "#f97316" : f.diasVencidos <= 90 ? "#ef4444" : "#b91c1c";
                    return (
                      <tr key={f._id}>
                        <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{f.folioFactura || "Sin folio"}</td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFecha(f.fechaEmision)}</td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {f.fechaVencimiento ? fmtFecha(f.fechaVencimiento) : "Por definir"}
                          {f.diasCredito ? <div style={{ fontSize: "0.65rem" }}>{f.diasCredito} días</div> : null}
                        </td>
                        <td style={{ fontSize: "0.74rem", color: "var(--text-muted)", whiteSpace: "normal", lineHeight: 1.35 }}>
                          {cs.length ? (
                            <>
                              {cs.slice(0, 3).map((c, i) => <div key={i}>• {c.descripcion.length > 80 ? c.descripcion.slice(0, 80) + "…" : c.descripcion}</div>)}
                              {cs.length > 3 && <div style={{ fontStyle: "italic" }}>+ {cs.length - 3} más</div>}
                            </>
                          ) : "—"}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{mxn(f.total)}</td>
                        <td style={{ textAlign: "right", color: "var(--green)", whiteSpace: "nowrap" }}>{f.montoPagado > 0 ? mxn(f.montoPagado) : "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{mxn(f.saldo)}</td>
                        <td><Badge color={col} label={f.sinFechaVencimiento ? "Sin fecha" : f.diasVencidos <= 0 ? "Al corriente" : `${f.diasVencidos} día${f.diasVencidos !== 1 ? "s" : ""}`} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="g-tfoot">
                    <td colSpan={4}>TOTAL</td>
                    <td style={{ textAlign: "right" }}>{mxn(detalle.facturas.reduce((a, f) => a + f.total, 0))}</td>
                    <td style={{ textAlign: "right" }}>{mxn(detalle.facturas.reduce((a, f) => a + f.montoPagado, 0))}</td>
                    <td style={{ textAlign: "right" }}>{mxn(detalle.aging?.total ?? detalle.resumen.saldoTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}