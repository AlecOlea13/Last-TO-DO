import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { generarOrdenTrabajo, imprimirOrdenTrabajo, type OrdenTrabajoReporte } from "../utils/generarReporte";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

type OrdenRefaccionItem = {
  refaccion: { _id: string; nombre: string; numeroParte?: string; unidad: string; precio?: number };
  cantidadSolicitada: number;
  cantidadSurtida: number;
  confirmado: boolean;
};

type Servicio = {
  _id: string;
  folio: string;
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo?: string; serie?: string };
  cliente?: { _id: string; nombre: string; direccion?: string; telefono?: string };
  tipoServicio?: { _id: string; nombre: string };
  tecnicoAsignado?: { _id: string; nombre: string };
  fechaReporte: string;
  problema?: string;
  estatus: "abierto" | "en_proceso" | "cerrado";
  costoRefacciones?: number;
  costoManoObra?: number;
  horometro?: number;
  horometroCierre?: number;
  ordenRefaccion?: { _id: string; folio: string; estatus: string; items?: OrdenRefaccionItem[] };
  notasCierre?: string;
  fotoHojaFirmada?: string;
  fotoEquipoFinal?: string;
};

type Monta        = { _id: string; numeroEconomico: string; marca: string; clienteActual?: { _id: string; nombre: string } | null };
type Cliente      = { _id: string; nombre: string };
type TipoServicio = { _id: string; nombre: string; intervaloHrs?: number };
type Usuario      = { _id: string; nombre: string; rol: string };

const emptyForm = {
  montacargas: "", cliente: "", tipoServicio: "", tecnicoAsignado: "",
  fechaReporte: new Date().toISOString().split("T")[0],
  problema: "", costoRefacciones: 0, costoManoObra: 0, horometro: 0,
};

const emptyCerrarForm = {
  horometro: 0, proximoServicio: "", estatusMonta: "disponible",
  notasCierre: "", fotoHojaFirmada: "", fotoEquipoFinal: "",
};

const ORDEN_BADGE: Record<string, string> = {
  pendiente: "badge-amber", surtida: "badge-green",
  parcial: "badge-blue",   cancelada: "badge-gray",
};

export default function Servicios() {
  const rol       = localStorage.getItem("rol") ?? "";
  const canCreate = ["developer", "gerencia"].includes(rol);

  const [servicios, setServicios]     = useState<Servicio[]>([]);
  const [montas, setMontas]           = useState<Monta[]>([]);
  const [clientes, setClientes]       = useState<Cliente[]>([]);
  const [tipos, setTipos]             = useState<TipoServicio[]>([]);
  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filtro, setFiltro]           = useState("todos");
  const [modal, setModal]             = useState(false);
  const [cerrarModal, setCerrarModal] = useState<Servicio | null>(null);
  const [form, setForm]               = useState<any>(emptyForm);
  const [cerrarForm, setCerrarForm]   = useState<any>(emptyCerrarForm);
  const [saving, setSaving]           = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState<"hoja" | "equipo" | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const calls: any[] = [
        api.get("/servicios"),
        api.get("/montacargas"),
        api.get("/clientes"),
        api.get("/tipos-servicio"),
      ];
      if (["developer", "gerencia", "oficina"].includes(rol)) calls.push(api.get("/users"));
      const [s, m, c, t, u] = await Promise.all(calls);
      setServicios(s.data);
      setMontas(m.data);
      setClientes(c.data);
      setTipos(t.data);
      if (u) setUsuarios(u.data.filter((x: any) => ["tecnico", "oficina", "almacen"].includes(x.rol)));
    } catch {}
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.montacargas || !form.problema.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post("/servicios", form);
      setServicios(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function subirFoto(file: File, tipo: "hoja" | "equipo") {
    setUploadingFoto(tipo);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
      const data = await res.json();
      const key  = tipo === "hoja" ? "fotoHojaFirmada" : "fotoEquipoFinal";
      setCerrarForm((p: any) => ({ ...p, [key]: data.secure_url }));
    } catch { alert("Error al subir imagen"); }
    finally { setUploadingFoto(null); }
  }

  async function cerrar() {
    if (!cerrarModal) return;
    setSaving(true);
    try {
      await api.post(`/servicios/${cerrarModal._id}/cerrar`, cerrarForm);
      load();
      setCerrarModal(null);
    } catch {}
    finally { setSaving(false); }
  }

  async function cambiarEstatus(s: Servicio, estatus: string) {
    await api.put(`/servicios/${s._id}`, { estatus });
    setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, estatus: estatus as any } : sv));
  }

  function onMontaChange(montaId: string) {
    const monta = montas.find(m => m._id === montaId);
    setForm((p: any) => ({ ...p, montacargas: montaId, cliente: monta?.clienteActual?._id ?? p.cliente }));
  }

  function buildOrdenTrabajo(s: Servicio): OrdenTrabajoReporte {
    return {
      folio:        s.folio ?? `OT-${s._id.slice(-4)}`,
      fecha:        s.fechaReporte,
      cliente:      s.cliente ? { nombre: s.cliente.nombre, direccion: s.cliente.direccion } : undefined,
      montacargas:  s.montacargas ? {
        numeroEconomico: s.montacargas.numeroEconomico,
        marca:           s.montacargas.marca,
        modelo:          s.montacargas.modelo ?? "",
        serie:           s.montacargas.serie  ?? "",
        horometro:       s.horometro,
        horometroCierre: s.horometroCierre,
      } : undefined,
      tipoServicio: s.tipoServicio?.nombre,
      tecnico:      s.tecnicoAsignado?.nombre,
      problema:     s.problema,
      notasCierre:  s.notasCierre,
      refacciones:  s.ordenRefaccion?.items
        ?.filter(i => i.cantidadSurtida > 0)
        .map(i => ({
          cantidad:    i.cantidadSurtida,
          descripcion: i.refaccion.nombre,
          precio:      undefined,
        })) ?? [],
      costoRefacciones: s.costoRefacciones,
      costoManoObra:    s.costoManoObra,
      observaciones:    s.notasCierre,
    };
  }

  const filtered = servicios.filter(s => {
    const matchSearch =
      (s.folio ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.tecnicoAsignado?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.problema ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "todos" || s.estatus === filtro;
    return matchSearch && matchFiltro;
  });

  function fmt(date?: string) {
  if (!date) return "—";
  // Parsear sin conversión de zona horaria
  const [year, month, day] = date.split("T")[0].split("-");
  return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

  function FotoUpload({ label, fotoKey, tipo }: { label: string; fotoKey: string; tipo: "hoja" | "equipo" }) {
    const ref = useRef<HTMLInputElement>(null);
    const url = cerrarForm[fotoKey];
    return (
      <div>
        <label className="form-label">{label}</label>
        <div
          onClick={() => ref.current?.click()}
          style={{
            border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)",
            padding: 12, textAlign: "center", cursor: "pointer",
            background: "var(--surface2)", transition: "border-color .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          {url ? (
            <img src={url} alt={label} style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 6 }} />
          ) : uploadingFoto === tipo ? (
            <div className="spinner" style={{ width: 24, height: 24, margin: "auto" }} />
          ) : (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>📷 Toca para subir foto</p>
          )}
        </div>
        <input
          ref={ref} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f, tipo); }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="page-subtitle">{servicios.filter(s => s.estatus !== "cerrado").length} tickets abiertos</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>
            + Nuevo servicio
          </button>
        )}
      </div>

      <div className="page-content">
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Tickets de servicio</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="abierto">Abiertos</option>
                <option value="en_proceso">En proceso</option>
                <option value="cerrado">Cerrados</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🔧</span><p>Sin servicios{search ? " con ese filtro" : " registrados"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Folio</th><th>Fecha</th><th>Equipo</th><th>Cliente</th>
                  <th>Tipo</th><th>Técnico</th><th>Orden refac.</th><th>Estatus</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{s.folio}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{fmt(s.fechaReporte)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {s.montacargas?.numeroEconomico}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.8rem" }}> {s.montacargas?.marca}</span>
                    </td>
                    <td>{s.cliente?.nombre ?? "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{s.tipoServicio?.nombre ?? "—"}</td>
                    <td>{s.tecnicoAsignado?.nombre ?? "—"}</td>
                    <td>
                      {s.ordenRefaccion
                        ? <span className={`badge ${ORDEN_BADGE[s.ordenRefaccion.estatus]}`}>{s.ordenRefaccion.folio}</span>
                        : "—"}
                    </td>
                    <td>
                      {["tecnico", "almacen"].includes(rol) ? (
                        <span className={`badge ${s.estatus === "abierto" ? "badge-red" : s.estatus === "en_proceso" ? "badge-amber" : "badge-gray"}`}>
                          {s.estatus}
                        </span>
                      ) : (
                        <select
                          className="form-select"
                          style={{ padding: "4px 10px", fontSize: "0.78rem", width: "auto" }}
                          value={s.estatus}
                          onChange={e => cambiarEstatus(s, e.target.value)}
                        >
                          <option value="abierto">Abierto</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => generarOrdenTrabajo(buildOrdenTrabajo(s))} title="Ver orden">👁️</button>
                        <button className="btn btn-primary btn-sm" onClick={() => imprimirOrdenTrabajo(buildOrdenTrabajo(s))} title="Imprimir">🖨️</button>
                        {s.estatus !== "cerrado" && ["developer", "gerencia", "oficina", "tecnico"].includes(rol) && (
                          <button
                            className="btn btn-amber btn-sm"
                            onClick={() => { setCerrarModal(s); setCerrarForm({ ...emptyCerrarForm, horometro: s.horometro ?? 0 }); }}
                          >
                            Cerrar
                          </button>
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

      {/* ── Modal nuevo servicio ── */}
      {modal && canCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nuevo servicio</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                <select className="form-select" value={form.montacargas} onChange={e => onMontaChange(e.target.value)}>
                  <option value="">Selecciona equipo...</option>
                  {montas.map(m => <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de servicio</label>
                <select className="form-select" value={form.tipoServicio} onChange={e => setForm((p: any) => ({ ...p, tipoServicio: e.target.value }))}>
                  <option value="">Sin tipo (revisión / otro)</option>
                  {tipos.map(t => <option key={t._id} value={t._id}>{t.nombre}{t.intervaloHrs ? ` (${t.intervaloHrs} hrs)` : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Técnico asignado</label>
                <select className="form-select" value={form.tecnicoAsignado} onChange={e => setForm((p: any) => ({ ...p, tecnicoAsignado: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => <option key={u._id} value={u._id}>{u.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha reporte</label>
                <input className="form-input" type="date" value={form.fechaReporte} onChange={e => setForm((p: any) => ({ ...p, fechaReporte: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometro} onChange={e => setForm((p: any) => ({ ...p, horometro: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Problema / descripción *</label>
                <textarea className="form-textarea" value={form.problema} onChange={e => setForm((p: any) => ({ ...p, problema: e.target.value }))} placeholder="Describe el problema o trabajo a realizar..." rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo refacciones</label>
                <input className="form-input" type="number" value={form.costoRefacciones} onChange={e => setForm((p: any) => ({ ...p, costoRefacciones: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo mano de obra</label>
                <input className="form-input" type="number" value={form.costoManoObra} onChange={e => setForm((p: any) => ({ ...p, costoManoObra: +e.target.value }))} />
              </div>
            </div>
            {form.tipoServicio && (
              <div style={{ padding: "10px 14px", background: "rgba(255,180,0,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", fontSize: "0.82rem", color: "var(--accent)", marginTop: 8 }}>
                ⚡ Se generará automáticamente una orden de refacciones al guardar.
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cerrar servicio ── */}
      {cerrarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCerrarModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setCerrarModal(null)}>✕</button>
            <h2 className="modal-title">Cerrar servicio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 8 }}>
              <strong style={{ color: "var(--text)" }}>{cerrarModal.folio}</strong> — {cerrarModal.montacargas?.numeroEconomico} {cerrarModal.montacargas?.marca}
            </p>
            {cerrarModal.ordenRefaccion && cerrarModal.ordenRefaccion.estatus !== "surtida" && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--red)", fontSize: "0.82rem", color: "var(--red)", marginBottom: 12 }}>
                ⚠️ La orden <strong>{cerrarModal.ordenRefaccion.folio}</strong> aún no está surtida completamente.
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Horómetro al cierre</label>
                <input className="form-input" type="number" value={cerrarForm.horometro} onChange={e => setCerrarForm((p: any) => ({ ...p, horometro: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio</label>
                <input className="form-input" type="date" value={cerrarForm.proximoServicio} onChange={e => setCerrarForm((p: any) => ({ ...p, proximoServicio: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Estatus del equipo al cerrar</label>
                <select className="form-select" value={cerrarForm.estatusMonta} onChange={e => setCerrarForm((p: any) => ({ ...p, estatusMonta: e.target.value }))}>
                  <option value="disponible">Disponible</option>
                  <option value="rentado">Rentado</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Notas de cierre / trabajos realizados</label>
                <textarea className="form-textarea" value={cerrarForm.notasCierre} onChange={e => setCerrarForm((p: any) => ({ ...p, notasCierre: e.target.value }))} placeholder="Trabajos realizados, observaciones..." rows={3} />
              </div>
              <div className="form-group">
                <FotoUpload label="📋 Foto de hoja firmada" fotoKey="fotoHojaFirmada" tipo="hoja" />
              </div>
              <div className="form-group">
                <FotoUpload label="📸 Foto del equipo finalizado" fotoKey="fotoEquipoFinal" tipo="equipo" />
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
              📧 Se enviará notificación automática a gerencia al cerrar.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCerrarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={cerrar} disabled={saving}>{saving ? "Cerrando..." : "Cerrar servicio"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}