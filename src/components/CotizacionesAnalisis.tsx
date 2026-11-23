/**
 * CotizacionesAnalisis.tsx  →  src/components/CotizacionesAnalisis.tsx
 * Panel de análisis de cotizaciones: KPIs, gráficas por mes / tipo / asesor /
 * cliente, antigüedad de activas y seguimiento. Montos SIN IVA.
 * Se abre desde el botón "📈 Análisis" de la pantalla de Cotizaciones.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Grupo = { n: number; monto: number; activas: number; facturadas: number; canceladas: number; montoActivas: number; montoFacturadas: number; montoCanceladas: number };
type Fila = Grupo & { nombre: string; conversion: number };
type Mes = Grupo & { periodo: string };
type Analisis = {
  meta: { unidad: "MXN" | "USD"; tipoCambioUSD: number; moneda: string; nota: string };
  kpi: {
    total: number; monto: number; activas: number; montoActivas: number; facturadas: number; montoFacturadas: number;
    canceladas: number; montoCanceladas: number; conversion: number; cancelacion: number; ticketPromedioFacturado: number;
    diasPromedioFacturar: number | null; porCobrar: number; montoPorCobrar: number; cobradas: number; montoCobradas: number;
    cotizadoUSD: number; cotizadoMXN: number; nUSD: number; nMXN: number;
  };
  porMes: Mes[];
  facturadoPorMes: { periodo: string; n: number; monto: number }[];
  porTipo: Fila[]; porAsesor: Fila[]; topClientes: Fila[];
  antiguedadActivas: { rango: string; n: number; monto: number }[];
  activasMasAntiguas: { _id: string; folio: string; tipo: string; cliente: string; asesor: string; fecha: string; dias: number; monto: number; moneda: string }[];
};
type Asesor = { _id: string; nombre: string };

const TIPOS = [
  { v: "servicio", label: "Servicio" }, { v: "renta", label: "Renta" }, { v: "venta", label: "Venta" },
  { v: "refacciones", label: "Refacciones" }, { v: "curso", label: "Curso" },
];
const nombreTipo = (t: string) => TIPOS.find(x => x.v === t)?.label ?? t;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (p: string) => { const [y, m] = p.split("-").map(Number); return `${MESES[m - 1]} ${String(y).slice(2)}`; };
const mesLargo = (p: string) => { const [y, m] = p.split("-").map(Number); return `${MESES[m - 1]} ${y}`; };
const compacto = (n: number, usd: boolean) => {
  const pre = usd ? "US$" : "$";
  return n >= 1e6 ? `${pre}${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${pre}${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${pre}${Math.round(n)}`;
};
const isoFecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inicioHace = (meses: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (meses - 1)); return isoFecha(d); };

function escalaY(max: number) {
  const objetivo = Math.max(max, 1) / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(objetivo)));
  const paso = [1, 2, 2.5, 5, 10].map(f => f * pot).find(s => s >= objetivo) ?? pot * 10;
  const tope = Math.max(paso, Math.ceil(max / paso) * paso);
  const ticks: number[] = []; for (let v = 0; v <= tope + 1e-9; v += paso) ticks.push(v);
  return { tope, ticks };
}
function pathBarra(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
/** Lista continua de periodos entre el primero y el último con datos (o el rango filtrado). */
function periodosContinuos(datos: string[], desde: string, hasta: string) {
  const ini = (desde ? desde.slice(0, 7) : datos[0]); const fin = (hasta ? hasta.slice(0, 7) : datos[datos.length - 1]);
  if (!ini || !fin) return [];
  const out: string[] = []; let [y, m] = ini.split("-").map(Number); const [yf, mf] = fin.split("-").map(Number);
  while ((y < yf || (y === yf && m <= mf)) && out.length < 60) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

type Serie = { key: string; label: string; color: string };
type PuntoMes = { periodo: string; valores: Record<string, number>; extra?: string };

/** Barras por mes (apiladas si hay varias series). */
function GraficaMeses({ puntos, series, fmt, fmtTick, aria }: { puntos: PuntoMes[]; series: Serie[]; fmt: (n: number) => string; fmtTick: (n: number) => string; aria: string }) {
  const W = 760, H = 290, ML = 56, MR = 12, MT = 14, MB = 34;
  const iw = W - ML - MR, ih = H - MT - MB;
  const [hover, setHover] = useState<number | null>(null);
  const totales = puntos.map(p => series.reduce((s, x) => s + (p.valores[x.key] ?? 0), 0));
  const { tope, ticks } = escalaY(Math.max(...totales, 0));
  const n = Math.max(puntos.length, 1), paso = iw / n, bw = Math.min(44, paso * 0.62);
  const y = (v: number) => MT + ih - (v / tope) * ih;
  const cadaN = n > 14 ? 2 : 1;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={aria} onMouseLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} opacity={v === 0 ? 1 : 0.6} />
            <text x={ML - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{fmtTick(v)}</text>
          </g>
        ))}
        {puntos.map((p, i) => {
          const cx = ML + paso * i + paso / 2, x0 = cx - bw / 2;
          const segs = series.filter(s => (p.valores[s.key] ?? 0) > 0);
          let acum = 0;
          return (
            <g key={p.periodo}>
              {segs.map((s, k) => {
                const v = p.valores[s.key] ?? 0, yTop = y(acum + v), alto = Math.max(y(acum) - yTop, 0);
                acum += v;
                const op = hover === null || hover === i ? 1 : 0.45;
                return k === segs.length - 1
                  ? <path key={s.key} d={pathBarra(x0, yTop, bw, alto, 4)} fill={s.color} stroke="var(--surface)" strokeWidth={2} opacity={op} />
                  : <rect key={s.key} x={x0} y={yTop} width={bw} height={alto} fill={s.color} stroke="var(--surface)" strokeWidth={2} opacity={op} />;
              })}
              {totales[i] > 0 && hover === i && <text x={cx} y={y(totales[i]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">{fmtTick(totales[i])}</text>}
              {i % cadaN === 0 && <text x={cx} y={H - 12} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{mesCorto(p.periodo)}</text>}
              <rect x={ML + paso * i} y={MT} width={paso} height={ih + MB} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (() => {
        const p = puntos[hover], cx = ML + paso * hover + paso / 2, der = hover < n / 2;
        const lado = der ? { left: `${((cx + bw / 2 + 8) / W) * 100}%` } : { left: `${((cx - bw / 2 - 8) / W) * 100}%`, transform: "translateX(-100%)" };
        return (
          <div className="ca-tip" style={lado}>
            <strong>{mesLargo(p.periodo)}</strong>
            {series.filter(s => (p.valores[s.key] ?? 0) > 0).map(s => (
              <div key={s.key} className="ca-tip-row"><span><i style={{ background: s.color }} />{s.label}</span><span>{fmt(p.valores[s.key])}</span></div>
            ))}
            {series.length > 1 && <div className="ca-tip-row ca-tip-total"><span>Total</span><span>{fmt(totales[hover])}</span></div>}
            {p.extra && <div className="ca-tip-row"><span>{p.extra}</span><span /></div>}
          </div>
        );
      })()}
      {series.length > 1 && <div className="ca-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>}
    </div>
  );
}

/** Barras horizontales (una serie) con detalle a la derecha. */
function BarrasH({ filas }: { filas: { etiqueta: string; valor: number; detalle?: string }[] }) {
  const max = Math.max(...filas.map(f => f.valor), 1);
  if (!filas.length) return <div className="ca-hint" style={{ padding: 16 }}>Sin datos con estos filtros.</div>;
  return (
    <div className="ca-hbars">
      {filas.map(f => (
        <div key={f.etiqueta} className="ca-hrow">
          <div className="ca-hlbl" title={f.etiqueta}>{f.etiqueta}</div>
          <div className="ca-htrack"><div className="ca-hfill" style={{ width: `${Math.max((f.valor / max) * 100, 1.5)}%` }} /></div>
          <div className="ca-hval">{f.detalle}</div>
        </div>
      ))}
    </div>
  );
}

export default function CotizacionesAnalisis({ onClose }: { onClose: () => void }) {
  const [desde, setDesde] = useState(inicioHace(12));
  const [hasta, setHasta] = useState(isoFecha(new Date()));
  const [asesorId, setAsesorId] = useState("");
  const [tipo, setTipo] = useState("");
  const [estatus, setEstatus] = useState("");
  const [moneda, setMoneda] = useState("todas");
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [data, setData] = useState<Analisis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cantidad, setCantidad] = useState(false);   // gráfica mensual: monto / cantidad
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => { api.get("/asesores").then(r => setAsesores(r.data ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    let vivo = true; setLoading(true); setError("");
    api.get("/cotizaciones/analisis", { params: { desde: desde || undefined, hasta: hasta || undefined, asesorId: asesorId || undefined, tipo: tipo || undefined, estatus: estatus || undefined, moneda } })
      .then(r => { if (vivo) setData(r.data); })
      .catch(e => { if (vivo) setError(e?.response?.data?.message ?? "No se pudo cargar el análisis."); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [desde, hasta, asesorId, tipo, estatus, moneda]);

  const usd = data?.meta.unidad === "USD";
  const fmt = (n: number) => usd ? `US$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const fmtTick = (n: number) => cantidad ? String(Math.round(n)) : compacto(n, usd);

  const SERIES_ESTATUS: Serie[] = [
    { key: "facturada", label: "Facturadas", color: "var(--s1)" },
    { key: "activa", label: "Activas", color: "var(--s2)" },
    { key: "cancelada", label: "Canceladas", color: "var(--s-neutro)" },
  ];

  const puntosCotizado: PuntoMes[] = useMemo(() => {
    if (!data) return [];
    const mapa = new Map(data.porMes.map(m => [m.periodo, m]));
    return periodosContinuos(data.porMes.map(m => m.periodo), desde, hasta).map(p => {
      const m = mapa.get(p);
      return { periodo: p, valores: cantidad
        ? { facturada: m?.facturadas ?? 0, activa: m?.activas ?? 0, cancelada: m?.canceladas ?? 0 }
        : { facturada: m?.montoFacturadas ?? 0, activa: m?.montoActivas ?? 0, cancelada: m?.montoCanceladas ?? 0 } };
    });
  }, [data, cantidad, desde, hasta]);

  const puntosFacturado: PuntoMes[] = useMemo(() => {
    if (!data) return [];
    const mapa = new Map(data.facturadoPorMes.map(m => [m.periodo, m]));
    return periodosContinuos(data.facturadoPorMes.map(m => m.periodo), desde, hasta).map(p => ({ periodo: p, valores: { facturado: mapa.get(p)?.monto ?? 0 }, extra: `${mapa.get(p)?.n ?? 0} facturadas` }));
  }, [data, desde, hasta]);

  const k = data?.kpi;
  const maxAging = Math.max(...(data?.antiguedadActivas.map(a => a.monto) ?? [0]), 1);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .ca-root { --s1:#3987e5; --s2:#d95926; --s3:#199e70; --s-neutro:#6b7280; --solo:#3987e5; }
        [data-theme="light"] .ca-root { --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --s-neutro:#9ca3af; --solo:#2a78d6; }
        .ca-modal { width:96vw; max-width:1240px !important; max-height:92vh; overflow-y:auto; padding:26px 30px !important; gap:18px !important; }
        .ca-filters { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; align-items:end; }
        .ca-kpis { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
        @media (max-width: 700px) { .ca-kpis { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        .ca-kpi { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:14px 18px; display:flex; flex-direction:column; gap:4px; min-width:0; }
        .ca-kpi-lbl { font-size:.7rem; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); font-weight:600; }
        .ca-kpi-val { font-size:1.45rem; font-weight:800; letter-spacing:-.02em; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .ca-kpi-sub { font-size:.76rem; color:var(--text-muted); }
        .ca-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
        .ca-grid-wide { grid-template-columns:minmax(0,2fr) minmax(0,1fr); }
        @media (max-width: 1000px) { .ca-grid, .ca-grid-wide { grid-template-columns:1fr; } }
        .ca-card { border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); min-width:0; }
        .ca-card-h { padding:14px 18px 0; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; font-weight:700; }
        .ca-card-b { padding:8px 18px 16px; }
        .ca-hint { font-size:.78rem; color:var(--text-muted); }
        .ca-legend { display:flex; gap:16px; flex-wrap:wrap; margin-top:8px; font-size:.78rem; color:var(--text-muted); }
        .ca-legend i, .ca-tip i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; }
        .ca-tip { position:absolute; top:0; z-index:5; pointer-events:none; background:var(--surface2); border:1px solid var(--border2, var(--border)); border-radius:var(--radius-sm); padding:10px 12px; min-width:190px; box-shadow:0 8px 24px rgba(0,0,0,.35); font-size:.78rem; display:flex; flex-direction:column; gap:4px; }
        .ca-tip-row { display:flex; justify-content:space-between; gap:14px; color:var(--text-muted); }
        .ca-tip-total { border-top:1px solid var(--border); padding-top:5px; color:var(--text); font-weight:700; }
        .ca-hbars { display:flex; flex-direction:column; gap:11px; padding-top:6px; }
        .ca-hrow { display:grid; grid-template-columns:120px 1fr minmax(120px, auto); gap:10px; align-items:center; font-size:.8rem; }
        .ca-hlbl { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ca-htrack { height:14px; background:var(--surface2); border-radius:4px; overflow:hidden; }
        .ca-hfill { height:100%; background:var(--solo); border-radius:0 4px 4px 0; }
        .ca-hval { text-align:right; font-weight:600; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .ca-hval em { font-style:normal; font-weight:400; color:var(--text-muted); }
        .ca-table { width:100%; border-collapse:collapse; font-size:.85rem; }
        .ca-table th { text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); font-weight:600; padding:10px 12px; border-bottom:1px solid var(--border); white-space:nowrap; }
        .ca-table td { padding:11px 12px; border-bottom:1px solid var(--border); font-variant-numeric:tabular-nums; }
        .ca-table tr:last-child td { border-bottom:none; }
        .ca-r { text-align:right !important; }
        .ca-aging { display:flex; flex-direction:column; gap:10px; padding-top:6px; }
        .ca-arow { display:grid; grid-template-columns:90px 1fr minmax(110px, auto); gap:10px; align-items:center; font-size:.8rem; }
        .ca-atrack { height:16px; background:var(--surface2); border-radius:4px; overflow:hidden; }
        .ca-afill { height:100%; border-radius:0 4px 4px 0; }
      `}</style>
      <div className="modal ca-modal ca-root">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div>
          <h2 className="modal-title">📈 Análisis de cotizaciones</h2>
          <div className="ca-hint" style={{ marginTop: 4 }}>Montos antes de IVA. {data && moneda === "todas" ? `Las cotizaciones en USD se convierten a pesos a $${data.meta.tipoCambioUSD}.` : ""}</div>
        </div>

        <div className="ca-filters">
          <div className="form-group"><label className="form-label">Desde</label><input type="date" className="form-input" value={desde} onChange={e => setDesde(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Hasta</label><input type="date" className="form-input" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Asesor</label>
            <select className="form-select" value={asesorId} onChange={e => setAsesorId(e.target.value)}><option value="">Todos</option>{asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Tipo</label>
            <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Estatus</label>
            <select className="form-select" value={estatus} onChange={e => setEstatus(e.target.value)}><option value="">Todos</option><option value="activa">Activas</option><option value="facturada">Facturadas</option><option value="cancelada">Canceladas</option></select></div>
          <div className="form-group"><label className="form-label">Moneda</label>
            <select className="form-select" value={moneda} onChange={e => setMoneda(e.target.value)}><option value="todas">Todas (en pesos)</option><option value="MXN">Solo pesos</option><option value="USD">Solo dólares</option></select></div>
        </div>

        {loading && !data ? <div className="loading-state"><div className="spinner" /></div>
          : error ? <div className="empty-state">{error}</div>
          : data && k && (
            <>
              <div className="ca-kpis" style={{ opacity: loading ? 0.6 : 1 }}>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Cotizado</div><div className="ca-kpi-val">{fmt(k.monto)}</div><div className="ca-kpi-sub">{k.total} cotizaciones</div></div>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Facturado</div><div className="ca-kpi-val">{fmt(k.montoFacturadas)}</div><div className="ca-kpi-sub">{k.facturadas} facturadas · promedio {fmt(k.ticketPromedioFacturado)}</div></div>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Activas (por cerrar)</div><div className="ca-kpi-val">{fmt(k.montoActivas)}</div><div className="ca-kpi-sub">{k.activas} abiertas</div></div>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Canceladas</div><div className="ca-kpi-val">{fmt(k.montoCanceladas)}</div><div className="ca-kpi-sub">{k.canceladas} · {k.cancelacion}% del total</div></div>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Conversión a factura</div><div className="ca-kpi-val">{k.conversion}%</div><div className="ca-kpi-sub">{k.diasPromedioFacturar !== null ? `${k.diasPromedioFacturar} días promedio en facturar` : "facturadas ÷ cotizadas"}</div></div>
                <div className="ca-kpi"><div className="ca-kpi-lbl">Facturado por cobrar</div><div className="ca-kpi-val">{fmt(k.montoPorCobrar)}</div><div className="ca-kpi-sub">{k.porCobrar} sin fecha de pago · cobrado {fmt(k.montoCobradas)}</div></div>
              </div>
              {moneda === "todas" && (k.nUSD > 0) && (
                <div className="ca-hint">Cotizado por moneda (original): <strong>US${k.cotizadoUSD.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> en {k.nUSD} cotizaciones en dólares · <strong>${k.cotizadoMXN.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> en {k.nMXN} en pesos.</div>
              )}

              <div className="ca-grid ca-grid-wide">
                <div className="ca-card">
                  <div className="ca-card-h"><span>Cotizado por mes</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setCantidad(c => !c)}>{cantidad ? "Ver montos" : "Ver cantidad"}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setVerTabla(v => !v)}>{verTabla ? "📊 Gráfica" : "📋 Tabla"}</button>
                    </span></div>
                  <div className="ca-card-b">
                    {verTabla ? (
                      <div style={{ overflowX: "auto" }}><table className="ca-table">
                        <thead><tr><th>Mes</th><th className="ca-r">Cotizaciones</th><th className="ca-r">Cotizado</th><th className="ca-r">Facturado</th><th className="ca-r">Activo</th><th className="ca-r">Cancelado</th></tr></thead>
                        <tbody>{data.porMes.map(m => <tr key={m.periodo}><td>{mesLargo(m.periodo)}</td><td className="ca-r">{m.n}</td><td className="ca-r">{fmt(m.monto)}</td><td className="ca-r">{fmt(m.montoFacturadas)}</td><td className="ca-r">{fmt(m.montoActivas)}</td><td className="ca-r">{fmt(m.montoCanceladas)}</td></tr>)}</tbody>
                      </table></div>
                    ) : puntosCotizado.length ? (
                      <GraficaMeses puntos={puntosCotizado} series={SERIES_ESTATUS} fmt={cantidad ? (n => `${n}`) : fmt} fmtTick={fmtTick} aria="Cotizaciones por mes, apiladas por estatus" />
                    ) : <div className="ca-hint" style={{ padding: 24, textAlign: "center" }}>Sin cotizaciones con estos filtros.</div>}
                  </div>
                </div>
                <div className="ca-card">
                  <div className="ca-card-h"><span>Por tipo de cotización</span></div>
                  <div className="ca-card-b"><BarrasH filas={data.porTipo.map(t => ({ etiqueta: nombreTipo(t.nombre), valor: t.monto, detalle: `${fmt(t.monto)} · ${t.conversion}%` }))} />
                    <div className="ca-hint" style={{ marginTop: 8 }}>El porcentaje es la conversión a factura de cada tipo.</div></div>
                </div>
              </div>

              <div className="ca-grid">
                <div className="ca-card">
                  <div className="ca-card-h"><span>Facturado por mes</span></div>
                  <div className="ca-card-b">
                    {puntosFacturado.length && puntosFacturado.some(p => p.valores.facturado > 0)
                      ? <GraficaMeses puntos={puntosFacturado} series={[{ key: "facturado", label: "Facturado", color: "var(--solo)" }]} fmt={fmt} fmtTick={n => compacto(n, usd)} aria="Facturado por mes" />
                      : <div className="ca-hint" style={{ padding: 24, textAlign: "center" }}>Sin cotizaciones facturadas con estos filtros.</div>}
                    <div className="ca-hint" style={{ marginTop: 6 }}>Por fecha de factura (o de la cotización si no tiene).</div>
                  </div>
                </div>
                <div className="ca-card">
                  <div className="ca-card-h"><span>Por asesor</span></div>
                  <div className="ca-card-b"><BarrasH filas={data.porAsesor.map(a => ({ etiqueta: a.nombre, valor: a.monto, detalle: `${fmt(a.monto)} · ${a.conversion}%` }))} />
                    <div className="ca-hint" style={{ marginTop: 8 }}>Monto cotizado y conversión a factura.</div></div>
                </div>
              </div>

              <div className="ca-grid">
                <div className="ca-card">
                  <div className="ca-card-h"><span>Antigüedad de cotizaciones activas</span></div>
                  <div className="ca-card-b">
                    <div className="ca-aging">
                      {data.antiguedadActivas.map((a, i) => (
                        <div key={a.rango} className="ca-arow">
                          <div>{a.rango}</div>
                          <div className="ca-atrack"><div className="ca-afill" style={{ width: `${a.monto > 0 ? Math.max((a.monto / maxAging) * 100, 2) : 0}%`, background: i >= 3 ? "var(--s2)" : "var(--solo)" }} /></div>
                          <div style={{ textAlign: "right", fontWeight: 600 }}>{fmt(a.monto)} <span className="ca-hint">· {a.n}</span></div>
                        </div>
                      ))}
                    </div>
                    <div className="ca-hint" style={{ marginTop: 10 }}>Días desde la fecha de la cotización. Las de más de 30 días, en naranja, conviene darles seguimiento.</div>
                  </div>
                </div>
                <div className="ca-card">
                  <div className="ca-card-h"><span>Top 10 clientes</span></div>
                  <div className="ca-card-b"><BarrasH filas={data.topClientes.map(c => ({ etiqueta: c.nombre, valor: c.monto, detalle: `${fmt(c.monto)} · ${c.n}` }))} />
                    <div className="ca-hint" style={{ marginTop: 8 }}>Monto cotizado y número de cotizaciones.</div></div>
                </div>
              </div>

              <div className="ca-card">
                <div className="ca-card-h"><span>Seguimiento: activas más antiguas</span></div>
                <div className="ca-card-b" style={{ overflowX: "auto" }}>
                  {data.activasMasAntiguas.length === 0 ? <div className="ca-hint" style={{ padding: 16 }}>No hay cotizaciones activas con estos filtros. 🎉</div> : (
                    <table className="ca-table">
                      <thead><tr><th>Folio</th><th>Tipo</th><th>Cliente</th><th>Asesor</th><th className="ca-r">Días abierta</th><th className="ca-r">Monto s/IVA</th></tr></thead>
                      <tbody>{data.activasMasAntiguas.map(a => (
                        <tr key={a._id}><td><strong>{a.folio}</strong></td><td>{nombreTipo(a.tipo)}</td><td>{a.cliente}</td><td>{a.asesor}</td>
                          <td className="ca-r" style={{ color: a.dias > 30 ? "var(--s2)" : undefined, fontWeight: a.dias > 30 ? 700 : 400 }}>{a.dias}</td>
                          <td className="ca-r">{a.moneda === "USD" && !usd ? `${fmt(a.monto)} ` : fmt(a.monto)}{a.moneda === "USD" ? <span className="ca-hint"> (USD)</span> : null}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}