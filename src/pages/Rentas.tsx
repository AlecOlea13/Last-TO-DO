import { useEffect, useState } from "react";
import { api } from "../api";

type Renovacion = {
  _id: string;
  fechaFinAnterior?: string;
  precioMensualAnterior: number;
  fechaFinNueva: string;
  precioMensualNuevo: number;
  fechaRenovacion: string;
  notas?: string;
};

type Renta = {
  _id: string;
  cliente?: { _id: string; nombre: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo: string };
  asesor?: { _id: string; nombre: string };
  fechaInicio: string;
  fechaFin?: string;
  tipoPeriodo?: "semanal" | "mensual" | "anual";
  precioMensual: number;
  flete?: number;
  deposito?: number;
  estatus: "activa" | "vencida" | "terminada";
  renovaciones?: Renovacion[];
};

type Cliente     = { _id: string; nombre: string };
type Montacargas = {
  _id: string; numeroEconomico: string; marca: string; modelo: string; estatus: string;
  costoSemana?: number; costoMes?: number; costoAnual?: number;
};
type Asesor = { _id: string; nombre: string };

const emptyForm = {
  cliente: "", montacargas: "", asesor: "", fechaInicio: "", fechaFin: "",
  tipoPeriodo: "mensual",
  precioMensual: 0, flete: 0, deposito: 0, estatus: "activa",
};

const ESTATUS_BADGE: Record<string, string> = {
  activa: "badge-green", vencida: "badge-amber", terminada: "badge-gray",
};

const PERIODO_LABEL: Record<string, string> = {
  semanal: "📅 Semanal", mensual: "🗓️ Mensual", anual: "📆 Anual",
};

export default function Rentas() {
  const rol         = localStorage.getItem("rol") ?? "";
  const canEditRenta = ["developer", "gerencia"].includes(rol);

  const [rentas, setRentas]         = useState<Renta[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [montas, setMontas]         = useState<Montacargas[]>([]);
  const [todosMontas, setTodosMontas] = useState<Montacargas[]>([]);
  const [asesores, setAsesores]     = useState<Asesor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filtro, setFiltro]         = useState("todos");
  const [filtroAsesor, setFiltroAsesor] = useState("todos");
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState<any>(emptyForm);
  const [saving, setSaving]         = useState(false);

  // ── Editar renta (solo developer/gerencia) ──
  const [modalEditar, setModalEditar] = useState<Renta | null>(null);
  const [formEditar, setFormEditar]   = useState<any>(emptyForm);
  const [savingEditar, setSavingEditar] = useState(false);

  // ── Renovación ──
  const [modalRenovar, setModalRenovar] = useState<Renta | null>(null);
  const [formRenovar, setFormRenovar]   = useState({ fechaFinNueva: "", precioMensualNuevo: 0, notas: "" });
  const [savingRenovar, setSavingRenovar] = useState(false);

  // ── Historial de renovaciones ──
  const [modalHistorial, setModalHistorial] = useState<Renta | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, c, m, a] = await Promise.all([
        api.get("/rentas"),
        api.get("/clientes"),
        api.get("/montacargas"),
        api.get("/asesores"),
      ]);
      setRentas(r.data);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
      setTodosMontas(m.data);
      setMontas(m.data.filter((mt: any) => mt.estatus === "disponible"));
      setAsesores(a.data);
    } catch {}
    finally { setLoading(false); }
  }

  // ── Cuando cambia montacargas o periodo, auto-llenar precio ───────────────
  function aplicarPrecioAutomatico(montaId: string, periodo: string, setter: typeof setForm) {
    const m = todosMontas.find(m => m._id === montaId);
    if (!m) return;
    const precios: Record<string, number> = {
      semanal: m.costoSemana ?? 0,
      mensual: m.costoMes    ?? 0,
      anual:   m.costoAnual  ?? 0,
    };
    const precio = precios[periodo] ?? 0;
    if (precio) setter((p: any) => ({ ...p, precioMensual: precio }));
  }

  function handleMontaChange(montaId: string) {
    setForm((p: any) => ({ ...p, montacargas: montaId }));
    aplicarPrecioAutomatico(montaId, form.tipoPeriodo, setForm);
  }

  function handlePeriodoChange(periodo: string) {
    setForm((p: any) => ({ ...p, tipoPeriodo: periodo }));
    if (form.montacargas) aplicarPrecioAutomatico(form.montacargas, periodo, setForm);
  }

  async function save() {
    if (!form.cliente || !form.montacargas || !form.fechaInicio || !form.precioMensual) return;
    setSaving(true);
    try {
      const { data } = await api.post("/rentas", form);
      setRentas(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function cerrar(renta: Renta) {
    if (!confirm("¿Cerrar esta renta?")) return;
    await api.post(`/rentas/${renta._id}/cerrar`, { estatusMonta: "disponible" });
    load();
  }

  function abrirModalEditar(renta: Renta) {
    setModalEditar(renta);
    setFormEditar({
      cliente:       renta.cliente?._id ?? "",
      montacargas:   renta.montacargas?._id ?? "",
      asesor:        renta.asesor?._id ?? "",
      fechaInicio:   renta.fechaInicio ? renta.fechaInicio.split("T")[0] : "",
      fechaFin:      renta.fechaFin ? renta.fechaFin.split("T")[0] : "",
      tipoPeriodo:   renta.tipoPeriodo ?? "mensual",
      precioMensual: renta.precioMensual,
      flete:         renta.flete ?? 0,
      deposito:      renta.deposito ?? 0,
      estatus:       renta.estatus,
    });
  }

  async function guardarEdicion() {
    if (!modalEditar || !formEditar.cliente || !formEditar.montacargas || !formEditar.fechaInicio || !formEditar.precioMensual) return;
    setSavingEditar(true);
    try {
      const { data } = await api.put(`/rentas/${modalEditar._id}`, formEditar);
      setRentas(prev => prev.map(r => r._id === modalEditar._id ? { ...r, ...data } : r));
      setModalEditar(null);
      load();
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingEditar(false); }
  }

  function abrirModalRenovar(renta: Renta) {
    setModalRenovar(renta);
    setFormRenovar({
      fechaFinNueva: "",
      precioMensualNuevo: renta.precioMensual,
      notas: "",
    });
  }

  async function renovar() {
    if (!modalRenovar || !formRenovar.fechaFinNueva || !formRenovar.precioMensualNuevo) return;
    setSavingRenovar(true);
    try {
      const { data } = await api.post(`/rentas/${modalRenovar._id}/renovar`, formRenovar);
      setRentas(prev => prev.map(r => r._id === modalRenovar._id ? data : r));
      setModalRenovar(null);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingRenovar(false); }
  }

  const filtered = rentas.filter(r => {
    const matchSearch =
      (r.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.asesor?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "todos" || r.estatus === filtro;
    const matchAsesor = filtroAsesor === "todos" || r.asesor?._id === filtroAsesor;
    return matchSearch && matchFiltro && matchAsesor;
  });

  function fmt(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtHora(date: string) {
    return new Date(date).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function diasRestantes(fechaFin?: string) {
    if (!fechaFin) return null;
    return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86400000);
  }

  const montaSeleccionada = montas.find(m => m._id === form.montacargas);
  const precioLabel = form.tipoPeriodo === "semanal" ? "Precio semanal" : form.tipoPeriodo === "anual" ? "Precio anual" : "Precio mensual";

  // Para el modal de editar: incluye el montacargas actual de la renta aunque esté "rentado" (no solo disponibles)
  const montasParaEditar = modalEditar
    ? todosMontas.filter(m => m.estatus === "disponible" || m._id === modalEditar.montacargas?._id)
    : [];
  const montaSeleccionadaEditar = todosMontas.find(m => m._id === formEditar.montacargas);
  const precioLabelEditar = formEditar.tipoPeriodo === "semanal" ? "Precio semanal" : formEditar.tipoPeriodo === "anual" ? "Precio anual" : "Precio mensual";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rentas</h1>
          <p className="page-subtitle">{rentas.filter(r => r.estatus === "activa").length} rentas activas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>
          + Nueva renta
        </button>
      </div>

      <div className="page-content">
        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Todas las rentas</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todas</option>
                <option value="activa">Activas</option>
                <option value="vencida">Vencidas</option>
                <option value="terminada">Terminadas</option>
              </select>
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }}
                value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}>
                <option value="todos">Todos los asesores</option>
                {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <p>Sin rentas{search ? " con ese filtro" : " registradas"}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>Equipo</th><th>Asesor</th><th>Inicio</th><th>Fin</th>
                  <th>Periodo</th><th>Precio</th><th>Flete</th><th>Depósito</th>
                  <th>Días restantes</th><th>Estatus</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const dias = diasRestantes(r.fechaFin);
                  return (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 600 }}>{r.cliente?.nombre ?? "—"}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.montacargas?.numeroEconomico}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {r.montacargas?.marca}</span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{r.asesor?.nombre ?? "—"}</td>
                      <td>{fmt(r.fechaInicio)}</td>
                      <td>{fmt(r.fechaFin)}</td>
                      <td style={{ textTransform: "capitalize" }}>{r.tipoPeriodo ?? "mensual"}</td>
                      <td>${r.precioMensual.toLocaleString()}</td>
                      <td>{r.flete ? `$${r.flete.toLocaleString()}` : "—"}</td>
                      <td>{r.deposito ? `$${r.deposito.toLocaleString()}` : "—"}</td>
                      <td>
                        {dias !== null ? (
                          <span style={{
                            color: dias <= 7 ? "var(--red)" : dias <= 30 ? "var(--accent)" : "var(--green)",
                            fontWeight: 600,
                          }}>
                            {dias > 0 ? `${dias} días` : "Vencida"}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`badge ${ESTATUS_BADGE[r.estatus]}`}>{r.estatus}</span>
                        {(r.renovaciones?.length ?? 0) > 0 && (
                          <button
                            onClick={() => setModalHistorial(r)}
                            title="Ver historial de renovaciones"
                            style={{
                              marginLeft: 6, fontSize: "0.68rem", fontWeight: 700,
                              color: "var(--blue)", background: "rgba(59,130,246,0.1)",
                              border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
                            }}>
                            🔄 {r.renovaciones!.length}
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {canEditRenta && (
                            <button className="btn btn-secondary btn-sm" onClick={() => abrirModalEditar(r)}>
                              ✏️
                            </button>
                          )}
                          {r.estatus !== "terminada" && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--blue)", borderColor: "rgba(59,130,246,0.3)" }}
                              onClick={() => abrirModalRenovar(r)}>
                              🔄 Renovar
                            </button>
                          )}
                          {r.estatus === "activa" && (
                            <button className="btn btn-danger btn-sm" onClick={() => cerrar(r)}>Cerrar</button>
                          )}
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

      {/* ── Modal nueva renta ── */}
      {modal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nueva renta</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={form.cliente}
                  onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                <select className="form-select" value={form.montacargas}
                  onChange={e => handleMontaChange(e.target.value)}>
                  <option value="">Selecciona equipo...</option>
                  {montas.map(m => (
                    <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca} {m.modelo}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Asesor</label>
                <select className="form-select" value={form.asesor}
                  onChange={e => setForm((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asesor</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Tipo de periodo *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["semanal", "mensual", "anual"] as const).map(tipo => (
                    <button key={tipo} type="button"
                      onClick={() => handlePeriodoChange(tipo)}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "2px solid",
                        borderColor: form.tipoPeriodo === tipo ? "var(--accent)" : "var(--border)",
                        background: form.tipoPeriodo === tipo ? "rgba(255,180,0,0.12)" : "var(--input-bg)",
                        color: form.tipoPeriodo === tipo ? "var(--accent)" : "var(--text-muted)",
                        fontWeight: form.tipoPeriodo === tipo ? 700 : 400,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {PERIODO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precios del equipo seleccionado */}
              {montaSeleccionada && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <div style={{
                    background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: "var(--radius-sm)", padding: "10px 14px",
                    display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>
                      ⚡ Precios del equipo
                    </span>
                    {[
                      { label: "Semanal", val: montaSeleccionada.costoSemana, key: "semanal" },
                      { label: "Mensual", val: montaSeleccionada.costoMes,    key: "mensual" },
                      { label: "Anual",   val: montaSeleccionada.costoAnual,  key: "anual"   },
                    ].map(p => (
                      <div key={p.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{p.label}</span>
                        <span style={{
                          fontWeight: 700, fontSize: "0.9rem",
                          color: form.tipoPeriodo === p.key ? "var(--accent)" : "var(--text)",
                        }}>
                          {p.val ? `$${p.val.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={form.fechaInicio}
                  onChange={e => setForm((p: any) => ({ ...p, fechaInicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin</label>
                <input className="form-input" type="date" value={form.fechaFin}
                  onChange={e => setForm((p: any) => ({ ...p, fechaFin: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">{precioLabel} *</label>
                <input className="form-input" type="number" value={form.precioMensual}
                  onChange={e => setForm((p: any) => ({ ...p, precioMensual: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Flete</label>
                <input className="form-input" type="number" value={form.flete}
                  onChange={e => setForm((p: any) => ({ ...p, flete: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Depósito</label>
                <input className="form-input" type="number" value={form.deposito}
                  onChange={e => setForm((p: any) => ({ ...p, deposito: +e.target.value }))} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar renta (solo developer/gerencia) ── */}
      {modalEditar && canEditRenta && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalEditar(null); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModalEditar(null)}>✕</button>
            <h2 className="modal-title">✏️ Editar renta</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 14 }}>
              Solo gerencia y developer pueden editar una renta directamente.
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={formEditar.cliente}
                  onChange={e => setFormEditar((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                <select className="form-select" value={formEditar.montacargas}
                  onChange={e => {
                    setFormEditar((p: any) => ({ ...p, montacargas: e.target.value }));
                    aplicarPrecioAutomatico(e.target.value, formEditar.tipoPeriodo, setFormEditar);
                  }}>
                  <option value="">Selecciona equipo...</option>
                  {montasParaEditar.map(m => (
                    <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca} {m.modelo}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Asesor</label>
                <select className="form-select" value={formEditar.asesor}
                  onChange={e => setFormEditar((p: any) => ({ ...p, asesor: e.target.value }))}>
                  <option value="">Sin asesor</option>
                  {asesores.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Tipo de periodo *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["semanal", "mensual", "anual"] as const).map(tipo => (
                    <button key={tipo} type="button"
                      onClick={() => {
                        setFormEditar((p: any) => ({ ...p, tipoPeriodo: tipo }));
                        if (formEditar.montacargas) aplicarPrecioAutomatico(formEditar.montacargas, tipo, setFormEditar);
                      }}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "2px solid",
                        borderColor: formEditar.tipoPeriodo === tipo ? "var(--accent)" : "var(--border)",
                        background: formEditar.tipoPeriodo === tipo ? "rgba(255,180,0,0.12)" : "var(--input-bg)",
                        color: formEditar.tipoPeriodo === tipo ? "var(--accent)" : "var(--text-muted)",
                        fontWeight: formEditar.tipoPeriodo === tipo ? 700 : 400,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {PERIODO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
              </div>

              {montaSeleccionadaEditar && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <div style={{
                    background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: "var(--radius-sm)", padding: "10px 14px",
                    display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>
                      ⚡ Precios del equipo
                    </span>
                    {[
                      { label: "Semanal", val: montaSeleccionadaEditar.costoSemana, key: "semanal" },
                      { label: "Mensual", val: montaSeleccionadaEditar.costoMes,    key: "mensual" },
                      { label: "Anual",   val: montaSeleccionadaEditar.costoAnual,  key: "anual"   },
                    ].map(p => (
                      <div key={p.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{p.label}</span>
                        <span style={{
                          fontWeight: 700, fontSize: "0.9rem",
                          color: formEditar.tipoPeriodo === p.key ? "var(--accent)" : "var(--text)",
                        }}>
                          {p.val ? `$${p.val.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Fecha inicio *</label>
                <input className="form-input" type="date" value={formEditar.fechaInicio}
                  onChange={e => setFormEditar((p: any) => ({ ...p, fechaInicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha fin</label>
                <input className="form-input" type="date" value={formEditar.fechaFin}
                  onChange={e => setFormEditar((p: any) => ({ ...p, fechaFin: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">{precioLabelEditar} *</label>
                <input className="form-input" type="number" value={formEditar.precioMensual}
                  onChange={e => setFormEditar((p: any) => ({ ...p, precioMensual: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Flete</label>
                <input className="form-input" type="number" value={formEditar.flete}
                  onChange={e => setFormEditar((p: any) => ({ ...p, flete: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Depósito</label>
                <input className="form-input" type="number" value={formEditar.deposito}
                  onChange={e => setFormEditar((p: any) => ({ ...p, deposito: +e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Estatus</label>
                <select className="form-select" value={formEditar.estatus}
                  onChange={e => setFormEditar((p: any) => ({ ...p, estatus: e.target.value }))}>
                  <option value="activa">Activa</option>
                  <option value="vencida">Vencida</option>
                  <option value="terminada">Terminada</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalEditar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEdicion} disabled={savingEditar}>
                {savingEditar ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal renovar renta ── */}
      {modalRenovar && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalRenovar(null); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={() => setModalRenovar(null)}>✕</button>
            <h2 className="modal-title">🔄 Renovar renta</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 4 }}>
              {modalRenovar.cliente?.nombre} — {modalRenovar.montacargas?.numeroEconomico}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 14 }}>
              Fecha fin actual: <strong style={{ color: "var(--text)" }}>{fmt(modalRenovar.fechaFin)}</strong> —{" "}
              Precio actual: <strong style={{ color: "var(--text)" }}>${modalRenovar.precioMensual.toLocaleString()}</strong>
            </p>

            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">Nueva fecha de fin *</label>
                <input className="form-input" type="date" value={formRenovar.fechaFinNueva}
                  onChange={e => setFormRenovar(p => ({ ...p, fechaFinNueva: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Nuevo precio ({modalRenovar.tipoPeriodo ?? "mensual"}) *</label>
                <input className="form-input" type="number" value={formRenovar.precioMensualNuevo}
                  onChange={e => setFormRenovar(p => ({ ...p, precioMensualNuevo: +e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Notas (opcional)</label>
                <textarea className="form-textarea" rows={2} value={formRenovar.notas}
                  onChange={e => setFormRenovar(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Ej. Renovación anual acordada por correo" />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalRenovar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={renovar} disabled={savingRenovar || !formRenovar.fechaFinNueva || !formRenovar.precioMensualNuevo}
                style={{ background: "var(--blue)", color: "#fff" }}>
                {savingRenovar ? "Renovando..." : "✅ Confirmar renovación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal historial de renovaciones ── */}
      {modalHistorial && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalHistorial(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModalHistorial(null)}>✕</button>
            <h2 className="modal-title">Historial de renovaciones</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 14 }}>
              {modalHistorial.cliente?.nombre} — {modalHistorial.montacargas?.numeroEconomico}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...(modalHistorial.renovaciones ?? [])].reverse().map(rv => (
                <div key={rv._id} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>
                    Renovado el {fmtHora(rv.fechaRenovacion)}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>Fecha fin: {fmt(rv.fechaFinAnterior)} → <strong>{fmt(rv.fechaFinNueva)}</strong></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 2 }}>
                    <span>Precio: ${rv.precioMensualAnterior.toLocaleString()} → <strong>${rv.precioMensualNuevo.toLocaleString()}</strong></span>
                  </div>
                  {rv.notas && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6 }}>📝 {rv.notas}</p>}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalHistorial(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}