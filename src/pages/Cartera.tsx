import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";

// ─── Tipos ────────────────────────────────────────────────────
type Rango = "vigente" | "1_30" | "31_60" | "61_90" | "mas_90" | "sin_definir";
type Estado = "VIGENTE" | "VENCIDA" | "PARCIAL_VIGENTE" | "PARCIAL_VENCIDA" | "VENCIMIENTO_POR_DEFINIR" | "PAGADA";
type Riesgo = "bajo" | "medio" | "alto" | "critico" | "por_definir";

type ClienteResumen = {
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
  fechaCorte: string; resumen: Resumen; rangos: Rangos;
  clientes: ClienteResumen[]; paginacion: Paginacion;
};

type DetalleCliente = {
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

// ─── Paleta de rangos ─────────────────────────────────────────
const RANGO_COLOR: Record<Rango, string> = {
  vigente:    "var(--green)",
  "1_30":     "#f0b429",
  "31_60":    "#f97316",
  "61_90":    "var(--red)",
  mas_90:     "#7f1d1d",
  sin_definir:"var(--text-muted)",
};
const RANGO_LABEL: Record<Rango, string> = {
  vigente:    "Vigente",
  "1_30":     "1–30 días",
  "31_60":    "31–60 días",
  "61_90":    "61–90 días",
  mas_90:     "+90 días",
  sin_definir:"Sin definir",
};
const ESTADO_COLOR: Record<Estado, string> = {
  VIGENTE:                  "var(--green)",
  VENCIDA:                  "var(--red)",
  PARCIAL_VIGENTE:          "#f0b429",
  PARCIAL_VENCIDA:          "#f97316",
  VENCIMIENTO_POR_DEFINIR:  "var(--text-muted)",
  PAGADA:                   "var(--green)",
};
const ESTADO_LABEL: Record<Estado, string> = {
  VIGENTE:                  "Vigente",
  VENCIDA:                  "Vencida",
  PARCIAL_VIGENTE:          "Parcial vigente",
  PARCIAL_VENCIDA:          "Parcial vencida",
  VENCIMIENTO_POR_DEFINIR:  "Sin fecha",
  PAGADA:                   "Pagada",
};
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

// ─── Descripción de vencimiento ───────────────────────────────
function descVenc(f: Factura) {
  if (f.sinFechaVencimiento) return "Vencimiento por definir";
  if (f.diasVencidos === 0 && f.diasParaVencer === 0) return "Vence hoy";
  if (f.diasVencidos > 0) return `Vencida por ${f.diasVencidos} día${f.diasVencidos !== 1 ? "s" : ""}`;
  return `Vence en ${f.diasParaVencer} día${f.diasParaVencer !== 1 ? "s" : ""}`;
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

// ─── Barra de distribución por rangos ────────────────────────
function BarraRangos({ rangos, total }: { rangos: Rangos; total: number }) {
  if (total <= 0) return null;
  const orden: Rango[] = ["vigente", "1_30", "31_60", "61_90", "mas_90", "sin_definir"];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 1 }}>
        {orden.map(r => {
          const pct = total > 0 ? (rangos[r] / total) * 100 : 0;
          if (pct < 0.5) return null;
          return <div key={r} style={{ width: pct + "%", background: RANGO_COLOR[r], transition: "width .3s" }} title={`${RANGO_LABEL[r]}: ${mxn(rangos[r])}`} />;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
        {orden.map(r => {
          const pct = total > 0 ? (rangos[r] / total) * 100 : 0;
          if (rangos[r] === 0) return null;
          return (
            <span key={r} style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: RANGO_COLOR[r], display: "inline-block" }} />
              {RANGO_LABEL[r]} · {mxn(rangos[r])} ({pct.toFixed(1)}%)
            </span>
          );
        })}
      </div>
    </div>
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
  const rangos = data?.rangos;

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
          <button className="btn btn-primary btn-sm" onClick={exportarCSV}>⬇️ CSV</button>
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
                <select className="form-select" value={draft.estado} onChange={e => setDraft(p => ({ ...p, estado: e.target.value }))}>
                  <option value="">Todos</option>
                  <option value="VIGENTE">Vigente</option>
                  <option value="VENCIDA">Vencida</option>
                  <option value="PARCIAL_VIGENTE">Parcial vigente</option>
                  <option value="PARCIAL_VENCIDA">Parcial vencida</option>
                  <option value="VENCIMIENTO_POR_DEFINIR">Sin fecha de vencimiento</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rango de antigüedad</label>
                <select className="form-select" value={draft.rango} onChange={e => setDraft(p => ({ ...p, rango: e.target.value }))}>
                  <option value="">Todos</option>
                  <option value="vigente">Vigente</option>
                  <option value="1_30">1–30 días</option>
                  <option value="31_60">31–60 días</option>
                  <option value="61_90">61–90 días</option>
                  <option value="mas_90">Más de 90 días</option>
                  <option value="sin_definir">Sin definir</option>
                </select>
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

            {/* Barra de rangos */}
            {rangos && (
              <div className="table-card" style={{ padding: "14px 20px", marginBottom: 16 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Distribución por antigüedad</p>
                <BarraRangos rangos={rangos} total={r.carteraTotal} />
              </div>
            )}
          </>
        )}

        {/* ── Tabla principal ────────────────────────────── */}
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Saldo por cliente</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="form-select" style={{ fontSize: "0.78rem", padding: "6px 10px" }} value={filtros.sort} onChange={e => cambiarSort(e.target.value)}>
                <option value="saldo">Mayor saldo</option>
                <option value="saldoVencido">Mayor saldo vencido</option>
                <option value="diasVencidos">Más días vencidos</option>
                <option value="antigüedad">Factura más antigua</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="riesgo">Mayor riesgo</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : !data?.clientes.length ? (
            <div className="empty-state"><span className="empty-icon">💰</span><p>Sin clientes con saldo pendiente</p></div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ fontSize: "0.82rem", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Cliente</th>
                      <th style={{ textAlign: "center" }}>Facturas</th>
                      <th style={{ textAlign: "right" }}>C. vigente</th>
                      <th style={{ textAlign: "right" }}>C. vencida</th>
                      <th style={{ textAlign: "right" }}>Saldo total</th>
                      <th>Fact. más antigua</th>
                      <th style={{ textAlign: "center" }}>Días venc.</th>
                      <th>Último pago</th>
                      <th>Riesgo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientes.map(c => (
                      <tr key={c.nombre}>
                        <td style={{ fontWeight: 600 }}>
                          {c.nombre}
                          {c.rfc && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{c.rfc}</div>}
                        </td>
                        <td style={{ textAlign: "center" }}>{c.facturasPend}</td>
                        <td style={{ textAlign: "right", color: "var(--green)" }}>{c.saldoVigente > 0 ? mxn(c.saldoVigente) : "—"}</td>
                        <td style={{ textAlign: "right", color: c.saldoVencido > 0 ? "var(--red)" : "var(--text-muted)" }}>
                          {c.saldoVencido > 0 ? mxn(c.saldoVencido) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: c.saldoVencido > 0 ? "var(--red)" : "var(--text)" }}>{mxn(c.saldoTotal)}</span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{fmtFecha(c.fechaMasAntigua)}</td>
                        <td style={{ textAlign: "center" }}>
                          {c.maxDiasVencidos > 0
                            ? <span style={{ fontWeight: 700, color: c.maxDiasVencidos > 90 ? "#7f1d1d" : c.maxDiasVencidos > 30 ? "var(--red)" : "#f97316" }}>{c.maxDiasVencidos}</span>
                            : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{fmtFecha(c.ultimoPago)}</td>
                        <td><Badge color={RIESGO_COLOR[c.riesgo]} label={RIESGO_LABEL[c.riesgo]} /></td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => abrirDetalle(c.nombre)} disabled={loadDet}>
                            {loadDet ? "…" : "👁️"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
          <div className="modal" style={{ maxWidth: 780, maxHeight: "92vh", overflowY: "auto" }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h2 className="modal-title">{detalle.cliente.nombre}</h2>
            {detalle.cliente.rfc && <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 4 }}>RFC: {detalle.cliente.rfc}</p>}
            {detalle.cliente.condicionesPago && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 4 }}>Condiciones: {detalle.cliente.condicionesPago}</p>}
            {detalle.cliente.diasCreditoCli && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 8 }}>Plazo de crédito: {detalle.cliente.diasCreditoCli} días</p>}

            {/* Resumen cliente */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Saldo total",   val: mxn(detalle.resumen.saldoTotal),   color: "var(--red)" },
                { label: "Saldo vigente", val: mxn(detalle.resumen.saldoVigente), color: "var(--green)" },
                { label: "Saldo vencido", val: mxn(detalle.resumen.saldoVencido), color: "var(--red)" },
                { label: "Facturas pend.",val: String(detalle.resumen.facturasPend), color: "var(--accent)" },
                { label: "Mayor atraso",  val: detalle.resumen.maxDiasVencidos > 0 ? detalle.resumen.maxDiasVencidos + " días" : "—", color: "#f97316" },
                { label: "Último pago",   val: fmtFecha(detalle.resumen.ultimoPago), color: "var(--text)" },
              ].map(item => (
                <div key={item.label} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontWeight: 700, color: item.color, fontSize: "0.9rem" }}>{item.val}</p>
                </div>
              ))}
            </div>

            {/* Tabla de facturas */}
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              Facturas pendientes ({detalle.facturas.length})
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: "0.78rem", minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Pagado</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                    <th>Situación</th>
                    <th>Rango</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.facturas.map(f => (
                    <tr key={f._id}>
                      <td style={{ fontWeight: 600 }}>
                        {f.folioFactura || "Sin folio"}
                        {f.uuid && <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{f.uuid.slice(0, 18)}…</div>}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{fmtFecha(f.fechaEmision)}</td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {f.fechaVencimiento ? fmtFecha(f.fechaVencimiento) : <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Por definir</span>}
                        {f.diasCredito && <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{f.diasCredito} días</div>}
                      </td>
                      <td style={{ textAlign: "right" }}>{mxn(f.total)}</td>
                      <td style={{ textAlign: "right", color: "var(--green)" }}>{f.montoPagado > 0 ? mxn(f.montoPagado) : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: f.diasVencidos > 0 ? "var(--red)" : "var(--text)" }}>{mxn(f.saldo)}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.72rem", color: f.diasVencidos > 0 ? "var(--red)" : f.sinFechaVencimiento ? "var(--text-muted)" : "var(--green)" }}>
                        {descVenc(f)}
                      </td>
                      <td><Badge color={RANGO_COLOR[f.rango]} label={RANGO_LABEL[f.rango]} /></td>
                      <td><Badge color={ESTADO_COLOR[f.estado]} label={ESTADO_LABEL[f.estado]} /></td>
                    </tr>
                  ))}
                </tbody>
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