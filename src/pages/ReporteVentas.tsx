/**
 * ReporteVentas.tsx  →  src/pages/ReporteVentas.tsx (reemplaza el anterior)
 * Reemplaza al Excel: cada vendedor captura SUS comisiones del mes eligiendo la
 * venta (equipo / renta / refacciones / servicio), corrige montos, días y %, y
 * escribe la comisión. developer y gerencia ven todo; oficina solo lo suyo.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Tipo = "equipo" | "renta" | "refacciones" | "servicio" | "otro";
type Asesor = { _id: string; nombre: string };
type Linea = {
  _id: string; tipo: Tipo; origenRef?: string | null; origenId?: string | null;
  referencia: string; descripcion: string; cliente: string;
  asesor: Asesor | null; creadoPor?: { _id: string; nombre: string } | null;
  fechaVenta: string | null; fechaPago: string | null; periodo: string;
  moneda: "MXN" | "USD"; subtotal: number; tipoCambio: number;
  dias: number; porcentaje: number; comision: number; notas: string;
};
type Origen = {
  origenRef: string; origenId: string; referencia: string; descripcion: string; cliente: string;
  asesor: string | null; asesorNombre: string; fechaVenta: string | null; fechaPago: string | null;
  moneda: "MXN" | "USD"; subtotal: number;
};
type Resumen = { total: number; cantidad: number; porAsesor: { asesor: string; comision: number }[]; porTipo: Record<string, number> };

const TIPO_CAMBIO_USD = 18.8; // mismo valor fijo que usa Cotizaciones
const TIPOS: { v: Tipo; label: string; icon: string }[] = [
  { v: "equipo", label: "Equipos", icon: "🏗️" },
  { v: "renta", label: "Rentas", icon: "📋" },
  { v: "refacciones", label: "Refacciones", icon: "🔩" },
  { v: "servicio", label: "Servicios", icon: "🔧" },
  { v: "otro", label: "Otro", icon: "➕" },
];
const tipoInfo = (t: Tipo) => TIPOS.find(x => x.v === t)!;

const mxn = (n: number) => (n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const aInputFecha = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const fmtFecha = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function porcentajePorDias(d: number) { return d <= 30 ? 3 : d <= 60 ? 2 : d <= 90 ? 1 : 0; }
function diasEntre(a?: string, b?: string) {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000));
}

type Form = {
  _id?: string; tipo: Tipo; origenRef: string | null; origenId: string | null;
  referencia: string; descripcion: string; cliente: string; asesor: string;
  fechaVenta: string; fechaPago: string; periodo: string;
  moneda: "MXN" | "USD"; subtotal: string; dias: string; porcentaje: string; comision: string; notas: string;
};
const formVacio = (periodo: string, tipo: Tipo = "equipo"): Form => ({
  tipo, origenRef: null, origenId: null, referencia: "", descripcion: "", cliente: "", asesor: "",
  fechaVenta: "", fechaPago: "", periodo, moneda: "MXN", subtotal: "", dias: "", porcentaje: "", comision: "", notas: "",
});

export default function ReporteVentas() {
  const rol = localStorage.getItem("rol") ?? "";
  const esAdmin = rol === "developer" || rol === "gerencia";

  const [periodo, setPeriodo] = useState(mesActual());
  const [filtroAsesor, setFiltroAsesor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"" | Tipo>("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Form>(formVacio(mesActual()));
  const [origenes, setOrigenes] = useState<Origen[]>([]);
  const [buscar, setBuscar] = useState("");
  const [cargandoOrig, setCargandoOrig] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm] = useState("");
  const [comisionManual, setComisionManual] = useState(false);

  async function cargar() {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/comisiones", {
        params: { periodo, asesorId: filtroAsesor || undefined, tipo: filtroTipo || undefined },
      });
      setLineas(data.lineas ?? []); setResumen(data.resumen ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "No se pudieron cargar las comisiones.");
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [periodo, filtroAsesor, filtroTipo]);
  useEffect(() => { api.get("/asesores").then(r => setAsesores(r.data ?? [])).catch(() => {}); }, []);

  // Cargar ventas seleccionables al abrir el modal / cambiar tipo / buscar
  useEffect(() => {
    if (!modal || form._id || form.tipo === "otro") { setOrigenes([]); return; }
    let vivo = true;
    setCargandoOrig(true);
    const t = setTimeout(() => {
      api.get("/comisiones/origenes", { params: { tipo: form.tipo, buscar: buscar || undefined } })
        .then(r => { if (vivo) setOrigenes(r.data ?? []); })
        .catch(() => { if (vivo) setOrigenes([]); })
        .finally(() => { if (vivo) setCargandoOrig(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [modal, form.tipo, form._id, buscar]);

  function abrirNueva() { setForm(formVacio(periodo)); setBuscar(""); setErrForm(""); setComisionManual(false); setModal(true); }
  function abrirEditar(l: Linea) {
    setForm({
      _id: l._id, tipo: l.tipo, origenRef: l.origenRef ?? null, origenId: l.origenId ?? null,
      referencia: l.referencia, descripcion: l.descripcion, cliente: l.cliente, asesor: l.asesor?._id ?? "",
      fechaVenta: aInputFecha(l.fechaVenta), fechaPago: aInputFecha(l.fechaPago), periodo: l.periodo,
      moneda: l.moneda, subtotal: String(l.subtotal), dias: String(l.dias), porcentaje: String(l.porcentaje),
      comision: String(l.comision), notas: l.notas,
    });
    setErrForm(""); setComisionManual(true); setModal(true);
  }

  function elegirOrigen(o: Origen) {
    const fv = aInputFecha(o.fechaVenta), fp = aInputFecha(o.fechaPago);
    const dias = fv && fp ? diasEntre(fv, fp) : 0;
    const pct = fv && fp ? porcentajePorDias(dias) : 0;
    const f: Form = {
      ...form, origenRef: o.origenRef, origenId: o.origenId, referencia: o.referencia, descripcion: o.descripcion,
      cliente: o.cliente, asesor: o.asesor ?? form.asesor, fechaVenta: fv, fechaPago: fp,
      moneda: o.moneda, subtotal: String(o.subtotal), dias: fv && fp ? String(dias) : "", porcentaje: fv && fp ? String(pct) : "",
      comision: "",
    };
    f.comision = sugerida(f);
    setForm(f); setComisionManual(false);
  }

  // Comisión sugerida = subtotal sin IVA × % × TC (solo ayuda; se puede sobrescribir)
  function sugerida(f: Form) {
    const sub = Number(f.subtotal) || 0, pct = Number(f.porcentaje) || 0;
    const tc = f.moneda === "USD" ? TIPO_CAMBIO_USD : 1;
    return pct > 0 && sub > 0 ? String(round2(sub * (pct / 100) * tc)) : "";
  }
  function cambiar<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(prev => {
      const n = { ...prev, [k]: v } as Form;
      if (k === "fechaVenta" || k === "fechaPago") {
        if (n.fechaVenta && n.fechaPago) { const d = diasEntre(n.fechaVenta, n.fechaPago); n.dias = String(d); n.porcentaje = String(porcentajePorDias(d)); }
      }
      if (k === "dias") { const d = Number(v); if (!isNaN(d) && String(v) !== "") n.porcentaje = String(porcentajePorDias(d)); }
      if (!comisionManual && ["subtotal", "porcentaje", "moneda", "dias", "fechaVenta", "fechaPago"].includes(k as string)) n.comision = sugerida(n);
      return n;
    });
  }

  async function guardar() {
    setErrForm("");
    if (!form.asesor) return setErrForm("Selecciona el asesor.");
    if (form.comision === "" || isNaN(Number(form.comision))) return setErrForm("Captura la comisión (en pesos).");
    setGuardando(true);
    try {
      const body = {
        ...form, subtotal: Number(form.subtotal) || 0, dias: Number(form.dias) || 0, porcentaje: Number(form.porcentaje) || 0,
        comision: Number(form.comision), tipoCambio: form.moneda === "USD" ? TIPO_CAMBIO_USD : 1,
      };
      if (form._id) await api.put(`/comisiones/${form._id}`, body); else await api.post("/comisiones", body);
      setModal(false); cargar();
    } catch (e: any) {
      setErrForm(e?.response?.data?.message ?? "No se pudo guardar.");
    } finally { setGuardando(false); }
  }
  async function borrar(l: Linea) {
    if (!window.confirm(`¿Borrar la comisión de ${l.referencia || l.cliente || "esta línea"}?`)) return;
    try { await api.delete(`/comisiones/${l._id}`); cargar(); }
    catch (e: any) { alert(e?.response?.data?.message ?? "No se pudo borrar."); }
  }

  function exportarCSV() {
    const enc = ["Periodo", "Asesor", "Tipo", "Referencia", "Cliente", "Descripción", "Fecha venta", "Fecha pago", "Moneda", "Subtotal sin IVA", "Días", "%", "Comisión MXN", "Notas"];
    const filas = lineas.map(l => [l.periodo, l.asesor?.nombre ?? "", tipoInfo(l.tipo).label, l.referencia, l.cliente, l.descripcion,
      aInputFecha(l.fechaVenta), aInputFecha(l.fechaPago), l.moneda, l.subtotal, l.dias, l.porcentaje, l.comision, l.notas]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [enc, ...filas].map(r => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `reporte_ventas_${periodo}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const totalMostrado = useMemo(() => lineas.reduce((s, l) => s + l.comision, 0), [lineas]);
  const f = form;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 className="page-title">📈 Reporte de ventas{esAdmin ? "" : " — mis ventas"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={exportarCSV} disabled={!lineas.length}>⬇️ Exportar CSV</button>
          <button className="btn btn-primary" onClick={abrirNueva}>+ Agregar venta</button>
        </div>
      </div>

      <div className="table-toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div><label className="form-label">Mes</label>
          <input type="month" className="form-input" value={periodo} onChange={e => e.target.value && setPeriodo(e.target.value)} /></div>
        {esAdmin && (
          <div><label className="form-label">Asesor</label>
            <select className="form-select" value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}>
              <option value="">Todos</option>{asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
            </select></div>
        )}
        <div><label className="form-label">Tipo</label>
          <select className="form-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
            <option value="">Todos</option>{TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select></div>
      </div>

      {resumen && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-card-label">Comisiones del mes</div><div className="stat-card-value">{mxn(totalMostrado)}</div></div>
          <div className="stat-card"><div className="stat-card-label">Ventas capturadas</div><div className="stat-card-value">{resumen.cantidad}</div></div>
          {TIPOS.filter(t => resumen.porTipo[t.v]).map(t => (
            <div className="stat-card" key={t.v}><div className="stat-card-label">{t.icon} {t.label}</div><div className="stat-card-value">{mxn(resumen.porTipo[t.v])}</div></div>
          ))}
        </div>
      )}

      {esAdmin && resumen && resumen.porAsesor.length > 0 && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-card-header"><span className="table-card-title">Por asesor</span></div>
          <table><thead><tr><th>Asesor</th><th style={{ textAlign: "right" }}>Comisión</th></tr></thead>
            <tbody>{resumen.porAsesor.map(a => <tr key={a.asesor}><td>{a.asesor}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{mxn(a.comision)}</td></tr>)}</tbody></table>
        </div>
      )}

      <div className="table-card">
        <div className="table-card-header"><span className="table-card-title">Detalle del mes</span></div>
        {loading ? <div className="loading-state"><div className="spinner" /></div>
          : error ? <div className="empty-state">{error}</div>
          : lineas.length === 0 ? <div className="empty-state"><div className="empty-icon">💵</div>Aún no hay ventas capturadas en este mes.</div>
          : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th>Tipo</th>{esAdmin && <th>Asesor</th>}<th>Referencia</th><th>Cliente</th>
                  <th style={{ textAlign: "right" }}>Subtotal s/IVA</th><th style={{ textAlign: "right" }}>Días</th><th style={{ textAlign: "right" }}>%</th>
                  <th style={{ textAlign: "right" }}>Comisión</th><th />
                </tr></thead>
                <tbody>
                  {lineas.map(l => (
                    <tr key={l._id}>
                      <td>{tipoInfo(l.tipo).icon} {tipoInfo(l.tipo).label}</td>
                      {esAdmin && <td>{l.asesor?.nombre ?? "—"}</td>}
                      <td>{l.referencia || "—"}{l.descripcion && <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{l.descripcion}</div>}</td>
                      <td>{l.cliente || "—"}</td>
                      <td style={{ textAlign: "right" }}>{l.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {l.moneda}</td>
                      <td style={{ textAlign: "right" }}>{l.dias || "—"}</td>
                      <td style={{ textAlign: "right" }}>{l.porcentaje ? `${l.porcentaje}%` : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{mxn(l.comision)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(l)}>✏️</button>{" "}
                        <button className="btn btn-danger btn-sm" onClick={() => borrar(l)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{f._id ? "Editar comisión" : "Agregar venta al reporte"}</h2>

            {!f._id && (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {TIPOS.map(t => (
                    <button key={t.v} type="button" className={`btn btn-sm ${f.tipo === t.v ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => { setForm({ ...formVacio(f.periodo, t.v), asesor: f.asesor }); setBuscar(""); setComisionManual(false); }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                {f.tipo !== "otro" && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label">Selecciona la venta (se llenan los datos y los puedes corregir)</label>
                    <input className="form-input" placeholder="Buscar por # económico, folio, cliente o asesor…" value={buscar} onChange={e => setBuscar(e.target.value)} />
                    <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginTop: 6 }}>
                      {cargandoOrig ? <div style={{ padding: 12 }}>Cargando…</div>
                        : origenes.length === 0 ? <div style={{ padding: 12, opacity: 0.7 }}>No hay ventas que coincidan.</div>
                        : origenes.map(o => (
                          <div key={o.origenId} onClick={() => elegirOrigen(o)}
                            style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                              background: f.origenId === o.origenId ? "var(--surface2)" : "transparent" }}>
                            <strong>{o.referencia || "—"}</strong> · {o.cliente || "Sin cliente"}
                            <span style={{ opacity: 0.7 }}> · {o.asesorNombre || "Sin asesor"} · {fmtFecha(o.fechaVenta)} · {o.subtotal.toLocaleString("es-MX")} {o.moneda}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-grid">
              <div className="form-group"><label className="form-label">Asesor *</label>
                <select className="form-select" value={f.asesor} onChange={e => cambiar("asesor", e.target.value)}>
                  <option value="">— Selecciona —</option>{asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Mes de la comisión *</label>
                <input type="month" className="form-input" value={f.periodo} onChange={e => e.target.value && cambiar("periodo", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Referencia (# económico / folio)</label>
                <input className="form-input" value={f.referencia} onChange={e => cambiar("referencia", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Cliente</label>
                <input className="form-input" value={f.cliente} onChange={e => cambiar("cliente", e.target.value)} /></div>
              <div className="form-group span-2"><label className="form-label">Descripción</label>
                <input className="form-input" value={f.descripcion} onChange={e => cambiar("descripcion", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Fecha de venta / factura</label>
                <input type="date" className="form-input" value={f.fechaVenta} onChange={e => cambiar("fechaVenta", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Fecha de pago</label>
                <input type="date" className="form-input" value={f.fechaPago} onChange={e => cambiar("fechaPago", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Moneda</label>
                <select className="form-select" value={f.moneda} onChange={e => cambiar("moneda", e.target.value as any)}>
                  <option value="MXN">MXN</option><option value="USD">USD (TC ${TIPO_CAMBIO_USD})</option></select></div>
              <div className="form-group"><label className="form-label">Subtotal SIN IVA</label>
                <input type="number" step="0.01" className="form-input" value={f.subtotal} onChange={e => cambiar("subtotal", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Días de cobro</label>
                <input type="number" className="form-input" value={f.dias} onChange={e => cambiar("dias", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">% de comisión</label>
                <input type="number" step="0.01" className="form-input" value={f.porcentaje} onChange={e => cambiar("porcentaje", e.target.value)} /></div>
              <div className="form-group span-2"><label className="form-label">Comisión (MXN) *</label>
                <input type="number" step="0.01" className="form-input" value={f.comision}
                  onChange={e => { setComisionManual(true); cambiar("comision", e.target.value); }} />
                <div style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 4 }}>
                  Sugerida: subtotal × % {f.moneda === "USD" ? `× TC ${TIPO_CAMBIO_USD}` : ""} = {sugerida(f) ? mxn(Number(sugerida(f))) : "—"}.
                  Puedes escribir el monto que te corresponde.
                </div></div>
              <div className="form-group span-2"><label className="form-label">Notas</label>
                <input className="form-input" value={f.notas} onChange={e => cambiar("notas", e.target.value)} /></div>
            </div>

            {errForm && <div style={{ color: "var(--red)", margin: "8px 0" }}>{errForm}</div>}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}