import { useEffect, useState } from "react";
import { api } from "../api";

type Servicio = {
  _id: string;
  fecha: string;
  descripcion: string;
  km?: number;
  taller?: string;
  costo?: number;
};

type Vehiculo = {
  _id: string;
  numero?: number;
  marca: string;
  modelo: string;
  anio?: number;
  placa: string;
  niv?: string;
  numeroMotor?: string;
  numTarjetaCirculacion?: string;
  propietario?: string;
  operador?: string;
  agencia?: string;
  telefonos?: string;
  medidaLlanta?: string;
  vencimientoTC?: string;
  poliza?: string;
  vencimientoSeguro?: string;
  proximoServicioKm?: number;
  proximoServicioFecha?: string;
  kmActual?: number;
  historial: Servicio[];
  activo: boolean;
};

const emptyForm = {
  numero: "", marca: "", modelo: "", anio: "", placa: "", niv: "",
  numeroMotor: "", numTarjetaCirculacion: "", propietario: "", operador: "",
  agencia: "", telefonos: "", medidaLlanta: "", poliza: "",
  vencimientoTC: "", vencimientoSeguro: "",
  proximoServicioKm: "", proximoServicioFecha: "", kmActual: "",
};

const emptyServicio = { fecha: new Date().toISOString().split("T")[0], descripcion: "", km: "", taller: "", costo: "" };

export default function Flota() {
  const [vehiculos, setVehiculos]       = useState<Vehiculo[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [modal, setModal]               = useState(false);
  const [editing, setEditing]           = useState<Vehiculo | null>(null);
  const [form, setForm]                 = useState<any>(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [historialModal, setHistorialModal] = useState<Vehiculo | null>(null);
  const [servicioForm, setServicioForm] = useState<any>(emptyServicio);
  const [savingServicio, setSavingServicio] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/vehiculos");
      setVehiculos(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  }

  function openEdit(v: Vehiculo) {
    setEditing(v);
    setForm({
      numero:               v.numero ?? "",
      marca:                v.marca,
      modelo:               v.modelo,
      anio:                 v.anio ?? "",
      placa:                v.placa,
      niv:                  v.niv ?? "",
      numeroMotor:          v.numeroMotor ?? "",
      numTarjetaCirculacion: v.numTarjetaCirculacion ?? "",
      propietario:          v.propietario ?? "",
      operador:             v.operador ?? "",
      agencia:              v.agencia ?? "",
      telefonos:            v.telefonos ?? "",
      medidaLlanta:         v.medidaLlanta ?? "",
      poliza:               v.poliza ?? "",
      vencimientoTC:        v.vencimientoTC ? v.vencimientoTC.split("T")[0] : "",
      vencimientoSeguro:    v.vencimientoSeguro ? v.vencimientoSeguro.split("T")[0] : "",
      proximoServicioKm:    v.proximoServicioKm ?? "",
      proximoServicioFecha: v.proximoServicioFecha ? v.proximoServicioFecha.split("T")[0] : "",
      kmActual:             v.kmActual ?? "",
    });
    setModal(true);
  }

  async function save() {
    if (!form.marca || !form.modelo || !form.placa) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!payload.numero) delete payload.numero;
      if (!payload.anio) delete payload.anio;
      if (!payload.proximoServicioKm) delete payload.proximoServicioKm;
      if (!payload.kmActual) delete payload.kmActual;
      if (!payload.vencimientoTC) delete payload.vencimientoTC;
      if (!payload.vencimientoSeguro) delete payload.vencimientoSeguro;
      if (!payload.proximoServicioFecha) delete payload.proximoServicioFecha;

      if (editing) {
        const { data } = await api.put(`/vehiculos/${editing._id}`, payload);
        setVehiculos(prev => prev.map(v => v._id === editing._id ? data : v));
      } else {
        const { data } = await api.post("/vehiculos", payload);
        setVehiculos(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(v: Vehiculo) {
    if (!confirm(`¿Eliminar ${v.marca} ${v.modelo} — ${v.placa}?`)) return;
    await api.delete(`/vehiculos/${v._id}`);
    setVehiculos(prev => prev.filter(x => x._id !== v._id));
  }

  async function agregarServicio() {
    if (!historialModal || !servicioForm.descripcion.trim() || !servicioForm.fecha) return;
    setSavingServicio(true);
    try {
      const payload: any = {
        fecha:       servicioForm.fecha,
        descripcion: servicioForm.descripcion.trim(),
        taller:      servicioForm.taller.trim() || undefined,
        km:          servicioForm.km ? +servicioForm.km : undefined,
        costo:       servicioForm.costo ? +servicioForm.costo : undefined,
      };
      const { data } = await api.post(`/vehiculos/${historialModal._id}/servicios`, payload);
      setVehiculos(prev => prev.map(v => v._id === historialModal._id ? data : v));
      setHistorialModal(data);
      setServicioForm(emptyServicio);
    } catch {}
    finally { setSavingServicio(false); }
  }

  async function eliminarServicio(vehiculoId: string, servicioId: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    const { data } = await api.delete(`/vehiculos/${vehiculoId}/servicios/${servicioId}`);
    setVehiculos(prev => prev.map(v => v._id === vehiculoId ? data : v));
    setHistorialModal(data);
  }

  function fmt(date?: string) {
    if (!date) return "—";
    const [y, m, d] = date.split("T")[0].split("-");
    return new Date(+y, +m - 1, +d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function alertaFecha(fecha?: string): "critico" | "advertencia" | "ok" | null {
    if (!fecha) return null;
    const hoy   = Date.now();
    const f     = new Date(fecha).getTime();
    const dias  = (f - hoy) / 86400000;
    if (dias < 0)  return "critico";
    if (dias <= 7) return "critico";
    if (dias <= 30) return "advertencia";
    return "ok";
  }

  function alertaKm(kmActual?: number, proximoKm?: number): "critico" | "advertencia" | "ok" | null {
    if (!kmActual || !proximoKm) return null;
    const diff = proximoKm - kmActual;
    if (diff <= 0)    return "critico";
    if (diff <= 1000) return "advertencia";
    return "ok";
  }

  const ALERTA_COLOR = {
    critico:    { color: "var(--red)",    bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)" },
    advertencia:{ color: "var(--accent)", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)" },
    ok:         { color: "var(--green)",  bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)" },
  };

  function FechaCell({ fecha, label }: { fecha?: string; label: string }) {
    const alerta = alertaFecha(fecha);
    if (!fecha) return <span style={{ color: "var(--text-muted)" }}>—</span>;
    const style = alerta ? ALERTA_COLOR[alerta] : undefined;
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{
          fontSize: "0.8rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6,
          color: style?.color ?? "var(--text)",
          background: style?.bg ?? "transparent",
          border: style ? `1px solid ${style.border}` : "none",
        }}>
          {alerta === "critico" && "⚠️ "}{fmt(fecha)}
        </span>
      </div>
    );
  }

  const filtered = vehiculos.filter(v =>
    v.placa.toLowerCase().includes(search.toLowerCase()) ||
    v.marca.toLowerCase().includes(search.toLowerCase()) ||
    v.modelo.toLowerCase().includes(search.toLowerCase()) ||
    (v.operador ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (v.propietario ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const alertasCount = vehiculos.filter(v => {
    const s = alertaFecha(v.vencimientoSeguro);
    const tc = alertaFecha(v.vencimientoTC);
    const km = alertaKm(v.kmActual, v.proximoServicioKm);
    const sf = alertaFecha(v.proximoServicioFecha);
    return s === "critico" || s === "advertencia" || tc === "critico" || tc === "advertencia" || km === "critico" || km === "advertencia" || sf === "critico" || sf === "advertencia";
  }).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Flota Vehicular</h1>
          <p className="page-subtitle">{vehiculos.length} vehículos{alertasCount > 0 ? ` · ⚠️ ${alertasCount} con alertas` : ""}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Agregar vehículo</button>
      </div>

      <div className="page-content">

        {/* ── Alertas rápidas ── */}
        {vehiculos.some(v => alertaFecha(v.vencimientoSeguro) === "critico" || alertaFecha(v.vencimientoTC) === "critico" || alertaKm(v.kmActual, v.proximoServicioKm) === "critico" || alertaFecha(v.proximoServicioFecha) === "critico") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vehiculos.map(v => {
              const alerts: string[] = [];
              if (alertaFecha(v.vencimientoSeguro) === "critico") alerts.push(`🛡️ Seguro vencido/por vencer`);
              if (alertaFecha(v.vencimientoTC) === "critico") alerts.push(`📋 Tarjeta de circulación vencida/por vencer`);
              if (alertaKm(v.kmActual, v.proximoServicioKm) === "critico") alerts.push(`🔧 Servicio por km vencido`);
              if (alertaFecha(v.proximoServicioFecha) === "critico") alerts.push(`🔧 Servicio por fecha vencido`);
              if (!alerts.length) return null;
              return (
                <div key={v._id} style={{ padding: "12px 18px", borderRadius: "var(--radius)", border: "1.5px solid var(--red)", background: "rgba(239,68,68,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{v.marca} {v.modelo} — {v.placa}</span>
                  <span style={{ color: "var(--red)", fontSize: "0.82rem" }}>{alerts.join(" · ")}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Vehículos</p>
            <input className="search-input" placeholder="🔍 Buscar por placa, marca, operador..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🚗</span><p>Sin vehículos registrados</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Vehículo</th><th>Placa</th><th>Operador</th>
                  <th>Seguro</th><th>Tarjeta circ.</th><th>Km actual</th>
                  <th>Próx. servicio</th><th>Historial</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const alertSeg  = alertaFecha(v.vencimientoSeguro);
                  const alertTC   = alertaFecha(v.vencimientoTC);
                  const alertKm   = alertaKm(v.kmActual, v.proximoServicioKm);
                  const alertSF   = alertaFecha(v.proximoServicioFecha);
                  const hayAlerta = alertSeg === "critico" || alertSeg === "advertencia" || alertTC === "critico" || alertTC === "advertencia" || alertKm === "critico" || alertKm === "advertencia" || alertSF === "critico" || alertSF === "advertencia";

                  return (
                    <tr key={v._id} style={{ background: hayAlerta ? "rgba(239,68,68,0.03)" : undefined }}>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{v.numero ?? "—"}</td>
                      <td style={{ fontWeight: 600 }}>
                        {v.marca} {v.modelo}
                        {v.anio && <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.8rem" }}> {v.anio}</span>}
                      </td>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent)" }}>{v.placa}</td>
                      <td>{v.operador ?? "—"}</td>
                      <td><FechaCell fecha={v.vencimientoSeguro} label="vence" /></td>
                      <td><FechaCell fecha={v.vencimientoTC} label="vence" /></td>
                      <td>
                        {v.kmActual ? (
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                            {v.kmActual.toLocaleString()} km
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {v.proximoServicioFecha && <FechaCell fecha={v.proximoServicioFecha} label="fecha" />}
                          {v.proximoServicioKm && (
                            (() => {
                              const a = alertaKm(v.kmActual, v.proximoServicioKm);
                              const s = a ? ALERTA_COLOR[a] : undefined;
                              const diff = v.proximoServicioKm - (v.kmActual ?? 0);
                              return (
                                <span style={{ fontSize: "0.8rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, color: s?.color ?? "var(--text)", background: s?.bg ?? "transparent", border: s ? `1px solid ${s.border}` : "none", display: "inline-block" }}>
                                  {a === "critico" && "⚠️ "}{v.proximoServicioKm.toLocaleString()} km {v.kmActual ? `(${diff > 0 ? "faltan " + diff.toLocaleString() : "vencido"})` : ""}
                                </span>
                              );
                            })()
                          )}
                          {!v.proximoServicioFecha && !v.proximoServicioKm && <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setHistorialModal(v); setServicioForm(emptyServicio); }}
                          style={{ position: "relative" }}
                        >
                          🔧
                          {v.historial.length > 0 && (
                            <span style={{ position: "absolute", top: -6, right: -6, background: "var(--blue)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {v.historial.length}
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(v)}>🗑️</button>
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

      {/* ── Modal vehículo ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? `Editar — ${editing.placa}` : "Nuevo vehículo"}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label"># Unidad</label>
                <input className="form-input" type="number" value={form.numero} onChange={e => setForm((p: any) => ({ ...p, numero: e.target.value }))} placeholder="Ej. 1" />
              </div>
              <div className="form-group">
                <label className="form-label">Placa *</label>
                <input className="form-input" value={form.placa} onChange={e => setForm((p: any) => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="Ej. JX31961" />
              </div>
              <div className="form-group">
                <label className="form-label">Marca *</label>
                <input className="form-input" value={form.marca} onChange={e => setForm((p: any) => ({ ...p, marca: e.target.value }))} placeholder="Ej. Chevrolet" />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo *</label>
                <input className="form-input" value={form.modelo} onChange={e => setForm((p: any) => ({ ...p, modelo: e.target.value }))} placeholder="Ej. Tornado" />
              </div>
              <div className="form-group">
                <label className="form-label">Año</label>
                <input className="form-input" type="number" value={form.anio} onChange={e => setForm((p: any) => ({ ...p, anio: e.target.value }))} placeholder="Ej. 2022" />
              </div>
              <div className="form-group">
                <label className="form-label">Operador</label>
                <input className="form-input" value={form.operador} onChange={e => setForm((p: any) => ({ ...p, operador: e.target.value }))} placeholder="Ej. Alfredo" />
              </div>
              <div className="form-group">
                <label className="form-label">Propietario</label>
                <input className="form-input" value={form.propietario} onChange={e => setForm((p: any) => ({ ...p, propietario: e.target.value }))} placeholder="Ej. Equipos Industriales..." />
              </div>
              <div className="form-group">
                <label className="form-label">NIV / Serie</label>
                <input className="form-input" value={form.niv} onChange={e => setForm((p: any) => ({ ...p, niv: e.target.value }))} placeholder="Ej. LZWNNGM0NC804959" />
              </div>
              <div className="form-group">
                <label className="form-label">No. Motor</label>
                <input className="form-input" value={form.numeroMotor} onChange={e => setForm((p: any) => ({ ...p, numeroMotor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">No. Tarjeta circulación</label>
                <input className="form-input" value={form.numTarjetaCirculacion} onChange={e => setForm((p: any) => ({ ...p, numTarjetaCirculacion: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Agencia</label>
                <input className="form-input" value={form.agencia} onChange={e => setForm((p: any) => ({ ...p, agencia: e.target.value }))} placeholder="Ej. Carsol Sta. Anita" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfonos</label>
                <input className="form-input" value={form.telefonos} onChange={e => setForm((p: any) => ({ ...p, telefonos: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Medida de llanta</label>
                <input className="form-input" value={form.medidaLlanta} onChange={e => setForm((p: any) => ({ ...p, medidaLlanta: e.target.value }))} placeholder="Ej. 165/65/R14" />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>🛡️ Seguro y documentos</p>
              </div>

              <div className="form-group">
                <label className="form-label">Póliza de seguro</label>
                <input className="form-input" value={form.poliza} onChange={e => setForm((p: any) => ({ ...p, poliza: e.target.value }))} placeholder="Ej. CHUBB GB46002081" />
              </div>
              <div className="form-group">
                <label className="form-label">Vencimiento seguro</label>
                <input className="form-input" type="date" value={form.vencimientoSeguro} onChange={e => setForm((p: any) => ({ ...p, vencimientoSeguro: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vencimiento tarjeta circulación</label>
                <input className="form-input" type="date" value={form.vencimientoTC} onChange={e => setForm((p: any) => ({ ...p, vencimientoTC: e.target.value }))} />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>🔧 Servicio</p>
              </div>

              <div className="form-group">
                <label className="form-label">Km actual</label>
                <input className="form-input" type="number" value={form.kmActual} onChange={e => setForm((p: any) => ({ ...p, kmActual: e.target.value }))} placeholder="Ej. 82145" />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio (km)</label>
                <input className="form-input" type="number" value={form.proximoServicioKm} onChange={e => setForm((p: any) => ({ ...p, proximoServicioKm: e.target.value }))} placeholder="Ej. 90000" />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio (fecha)</label>
                <input className="form-input" type="date" value={form.proximoServicioFecha} onChange={e => setForm((p: any) => ({ ...p, proximoServicioFecha: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal historial de servicios ── */}
      {historialModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistorialModal(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <button className="modal-close" onClick={() => setHistorialModal(null)}>✕</button>
            <h2 className="modal-title">🔧 Historial — {historialModal.marca} {historialModal.modelo} <span style={{ color: "var(--accent)" }}>{historialModal.placa}</span></h2>

            {/* Agregar servicio */}
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>+ Registrar servicio</p>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" value={servicioForm.fecha} onChange={e => setServicioForm((p: any) => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Km al momento</label>
                  <input className="form-input" type="number" value={servicioForm.km} onChange={e => setServicioForm((p: any) => ({ ...p, km: e.target.value }))} placeholder="Ej. 82145" />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Descripción *</label>
                  <textarea className="form-textarea" rows={2} value={servicioForm.descripcion} onChange={e => setServicioForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej. Servicio completo, cambio de llantas, alineación..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Taller / Agencia</label>
                  <input className="form-input" value={servicioForm.taller} onChange={e => setServicioForm((p: any) => ({ ...p, taller: e.target.value }))} placeholder="Ej. Carsol Sta. Anita" />
                </div>
                <div className="form-group">
                  <label className="form-label">Costo ($)</label>
                  <input className="form-input" type="number" value={servicioForm.costo} onChange={e => setServicioForm((p: any) => ({ ...p, costo: e.target.value }))} placeholder="Ej. 2500" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={agregarServicio} disabled={savingServicio || !servicioForm.descripcion.trim()}>
                  {savingServicio ? "Guardando..." : "✅ Agregar servicio"}
                </button>
              </div>
            </div>

            {/* Lista de servicios */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
              {historialModal.historial.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>Sin servicios registrados</div>
              ) : (
                historialModal.historial.map(s => (
                  <div key={s._id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent)" }}>{fmt(s.fecha)}</span>
                        {s.km && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--surface3)", padding: "1px 8px", borderRadius: 4 }}>{s.km.toLocaleString()} km</span>}
                        {s.taller && <span style={{ fontSize: "0.75rem", color: "var(--blue)" }}>📍 {s.taller}</span>}
                        {s.costo && <span style={{ fontSize: "0.75rem", color: "var(--green)", fontWeight: 600 }}>${s.costo.toLocaleString()}</span>}
                      </div>
                      <button onClick={() => eliminarServicio(historialModal._id, s._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", padding: 0, flexShrink: 0 }}>🗑️</button>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>{s.descripcion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}