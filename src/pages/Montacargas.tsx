import { useEffect, useState } from "react";
import { api } from "../api";

type Monta = {
  _id: string;
  numeroEconomico: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  capacidad?: string;
  tipo?: string;
  alturaColapsada?: string;
  alturaLevante?: string;
  horquillas?: string;
  desplazadorLateral?: boolean;
  tipoLlantas?: string;
  voltaje?: string;
  tipoBateria?: string;
  incluyeCargador?: boolean;
  equipoSeguridad?: {
    alarmaReversa?: boolean;
    torretaAmbar?: boolean;
    luces?: boolean;
    extintor?: boolean;
  };
  horometroActual?: number;
  horasRestantesServicio?: number;
  estatus: "disponible" | "rentado" | "taller" | "mantenimiento";
  clienteActual?: { _id: string; nombre: string } | null;
  costoDia?: number;
  costoSemana?: number;
  costoMes?: number;
  costoAnual?: number;
  precioVenta?: number;
  fechaUltimoMantenimiento?: string;
  proximoMantenimiento?: string;
  fechaUltimoServicio?: string;
  proximoServicio?: string;
};

type Cliente = { _id: string; nombre: string };

const emptyForm = {
  numeroEconomico: "", marca: "", modelo: "", serie: "",
  capacidad: "", tipo: "electrico",
  alturaColapsada: "", alturaLevante: "",
  horquillas: "", desplazadorLateral: false,
  tipoLlantas: "",
  voltaje: "", tipoBateria: "", incluyeCargador: false,
  equipoSeguridad: { alarmaReversa: false, torretaAmbar: false, luces: false, extintor: false },
  horometroActual: 0, horasRestantesServicio: 0,
  estatus: "disponible",
  costoDia: 0, costoSemana: 0, costoMes: 0, costoAnual: 0,
  precioVenta: 0,
  fechaUltimoMantenimiento: "", proximoMantenimiento: "",
  fechaUltimoServicio: "", proximoServicio: "",
};

const ESTATUS_BADGE: Record<string, string> = {
  disponible: "badge-green", rentado: "badge-blue",
  taller: "badge-amber", mantenimiento: "badge-red",
};

const TIPO_BADGE: Record<string, string> = {
  electrico: "badge-blue", gas: "badge-amber", diesel: "badge-gray",
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
      border: "1.5px solid", borderColor: checked ? "var(--accent)" : "var(--border)",
      background: checked ? "rgba(255,180,0,0.08)" : "var(--input-bg)",
      transition: "all 0.15s",
    }}>
      <span style={{ fontSize: "0.87rem", color: checked ? "var(--accent)" : "var(--text-muted)", fontWeight: checked ? 600 : 400 }}>
        {label}
      </span>
      <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", transition: "background 0.2s", background: checked ? "var(--accent)" : "var(--border)" }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginTop: 16, marginBottom: 4 }}>
      {text}
    </p>
  );
}

export default function Montacargas() {
  const rol     = localStorage.getItem("rol") ?? "";
  const canEdit = !["tecnico", "almacen"].includes(rol);

  const [montas, setMontas]         = useState<Monta[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filtroEstatus, setFiltro]  = useState("todos");
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<Monta | null>(null);
  const [form, setForm]             = useState<any>(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [asignarModal, setAsignarModal] = useState<Monta | null>(null);
  const [clienteSel, setClienteSel]     = useState("");
  const [detalleModal, setDetalleModal] = useState<Monta | null>(null);

  // ── Alta rápida ──
  const [modalRapido, setModalRapido] = useState(false);
  const [formRapido, setFormRapido]   = useState({
    numeroEconomico: "", marca: "", modelo: "", tipo: "electrico", estatus: "taller",
  });
  const [savingRapido, setSavingRapido] = useState(false);

  const isElectrico = form.tipo === "electrico";
  const isGasDiesel = form.tipo === "gas" || form.tipo === "diesel";

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [m, c] = await Promise.all([api.get("/montacargas"), api.get("/clientes")]);
      setMontas(m.data);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
    } catch {}
    finally { setLoading(false); }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setModal(true); }

  function openEdit(m: Monta) {
    setEditing(m);
    setForm({
      numeroEconomico: m.numeroEconomico,
      marca: m.marca ?? "", modelo: m.modelo ?? "", serie: m.serie ?? "",
      capacidad: m.capacidad ?? "", tipo: m.tipo ?? "electrico",
      alturaColapsada: m.alturaColapsada ?? "", alturaLevante: m.alturaLevante ?? "",
      horquillas: m.horquillas ?? "", desplazadorLateral: m.desplazadorLateral ?? false,
      tipoLlantas: m.tipoLlantas ?? "",
      voltaje: m.voltaje ?? "", tipoBateria: m.tipoBateria ?? "",
      incluyeCargador: m.incluyeCargador ?? false,
      equipoSeguridad: {
        alarmaReversa: m.equipoSeguridad?.alarmaReversa ?? false,
        torretaAmbar:  m.equipoSeguridad?.torretaAmbar  ?? false,
        luces:         m.equipoSeguridad?.luces         ?? false,
        extintor:      m.equipoSeguridad?.extintor      ?? false,
      },
      horometroActual: m.horometroActual ?? 0,
      horasRestantesServicio: m.horasRestantesServicio ?? 0,
      estatus: m.estatus,
      costoDia:    m.costoDia    ?? 0,
      costoSemana: m.costoSemana ?? 0,
      costoMes:    m.costoMes    ?? 0,
      costoAnual:  m.costoAnual  ?? 0,
      precioVenta: m.precioVenta ?? 0,
      fechaUltimoMantenimiento: m.fechaUltimoMantenimiento ? m.fechaUltimoMantenimiento.split("T")[0] : "",
      proximoMantenimiento:     m.proximoMantenimiento     ? m.proximoMantenimiento.split("T")[0]     : "",
      fechaUltimoServicio:      m.fechaUltimoServicio      ? m.fechaUltimoServicio.split("T")[0]      : "",
      proximoServicio:          m.proximoServicio          ? m.proximoServicio.split("T")[0]          : "",
    });
    setModal(true);
  }

  function setF(field: string, val: any) { setForm((p: any) => ({ ...p, [field]: val })); }
  function setSeg(field: string, val: boolean) { setForm((p: any) => ({ ...p, equipoSeguridad: { ...p.equipoSeguridad, [field]: val } })); }

  async function save() {
    if (!form.numeroEconomico.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/montacargas/${editing._id}`, form);
        setMontas(prev => prev.map(m => m._id === editing._id ? data : m));
      } else {
        const { data } = await api.post("/montacargas", form);
        setMontas(prev => [data, ...prev]);
      }
      setModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este montacargas?")) return;
    await api.delete(`/montacargas/${id}`);
    setMontas(prev => prev.filter(m => m._id !== id));
  }

  async function asignar() {
    if (!asignarModal || !clienteSel) return;
    const { data } = await api.post(`/montacargas/${asignarModal._id}/asignar`, { clienteId: clienteSel });
    setMontas(prev => prev.map(m => m._id === data._id ? data : m));
    setAsignarModal(null); setClienteSel("");
  }

  async function guardarRapido() {
    if (!formRapido.numeroEconomico.trim()) return;
    setSavingRapido(true);
    try {
      const { data } = await api.post("/montacargas", formRapido);
      setMontas(prev => [data, ...prev]);
      setModalRapido(false);
      setFormRapido({ numeroEconomico: "", marca: "", modelo: "", tipo: "electrico", estatus: "taller" });
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingRapido(false); }
  }

  function fmt(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = montas.filter(m => {
    const matchSearch =
      m.numeroEconomico.toLowerCase().includes(search.toLowerCase()) ||
      (m.marca ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.modelo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.clienteActual?.nombre ?? "").toLowerCase().includes(search.toLowerCase());
    const matchEstatus = filtroEstatus === "todos" || m.estatus === filtroEstatus;
    return matchSearch && matchEstatus;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Montacargas</h1>
          <p className="page-subtitle">{montas.length} equipos en flota</p>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setModalRapido(true)}>⚡ Alta rápida</button>
            <button className="btn btn-primary" onClick={openNew}>+ Nuevo equipo</button>
          </div>
        )}
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Disponibles",   val: montas.filter(m => m.estatus === "disponible").length,   color: "var(--green)",  icon: "✅", key: "disponible" },
            { label: "Rentados",      val: montas.filter(m => m.estatus === "rentado").length,       color: "var(--blue)",   icon: "📦", key: "rentado" },
            { label: "En Taller",     val: montas.filter(m => m.estatus === "taller").length,        color: "var(--accent)", icon: "🔧", key: "taller" },
            { label: "Mantenimiento", val: montas.filter(m => m.estatus === "mantenimiento").length, color: "var(--red)",    icon: "⚙️", key: "mantenimiento" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFiltro(s.key)}>
              <span className="stat-card-icon">{s.icon}</span>
              <p className="stat-card-value" style={{ color: s.color }}>{s.val}</p>
              <p className="stat-card-label">{s.label}</p>
              <div className="stat-card-accent" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Flota completa</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtroEstatus} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="disponible">Disponible</option>
                <option value="rentado">Rentado</option>
                <option value="taller">Taller</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🏗️</span><p>Sin equipos{search ? " con ese filtro" : " registrados"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Marca / Modelo</th><th>Tipo</th><th>Capacidad</th>
                  <th>Horómetro</th><th>Prox. Mant.</th><th>Estatus</th><th>Cliente</th>
                  <th>Costo/mes</th><th>P. Venta</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{m.numeroEconomico}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{m.marca}</span>
                      {m.modelo && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {m.modelo}</span>}
                    </td>
                    <td><span className={`badge ${TIPO_BADGE[m.tipo ?? ""] ?? "badge-gray"}`}>{m.tipo ?? "—"}</span></td>
                    <td>{m.capacidad || "—"}</td>
                    <td>{m.horometroActual ?? 0} hr</td>
                    <td style={{ color: m.proximoMantenimiento && new Date(m.proximoMantenimiento) < new Date() ? "var(--red)" : "var(--text)" }}>
                      {fmt(m.proximoMantenimiento)}
                    </td>
                    <td><span className={`badge ${ESTATUS_BADGE[m.estatus]}`}>{m.estatus}</span></td>
                    <td>{m.clienteActual?.nombre ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td>{m.costoMes ? `$${m.costoMes.toLocaleString()}` : "—"}</td>
                    <td>{m.precioVenta ? `$${m.precioVenta.toLocaleString()}` : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalleModal(m)}>👁️</button>
                        {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>✏️</button>}
                        {canEdit && m.estatus === "disponible" && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setAsignarModal(m); setClienteSel(""); }}>Asignar</button>
                        )}
                        {canEdit && <button className="btn btn-danger btn-sm" onClick={() => remove(m._id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal nuevo / editar ── */}
      {modal && canEdit && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar equipo" : "Nuevo montacargas"}</h2>

            <SectionLabel text="Datos generales" />
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Económico *</label>
                <input className="form-input" value={form.numeroEconomico} onChange={e => setF("numeroEconomico", e.target.value)} placeholder="#01" />
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input className="form-input" value={form.marca} onChange={e => setF("marca", e.target.value)} placeholder="Crown, Yale, Hyster..." />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input className="form-input" value={form.modelo} onChange={e => setF("modelo", e.target.value)} placeholder="GLP050, RC5500..." />
              </div>
              <div className="form-group">
                <label className="form-label">Serie</label>
                <input className="form-input" value={form.serie} onChange={e => setF("serie", e.target.value)} placeholder="1A268108" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.tipo} onChange={e => setF("tipo", e.target.value)}>
                  <option value="electrico">Eléctrico</option>
                  <option value="gas">Gas LP</option>
                  <option value="diesel">Diésel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacidad de carga</label>
                <input className="form-input" value={form.capacidad} onChange={e => setF("capacidad", e.target.value)} placeholder="5000 lbs, 2.2 tn..." />
              </div>
              <div className="form-group">
                <label className="form-label">Altura de levante</label>
                <input className="form-input" value={form.alturaLevante} onChange={e => setF("alturaLevante", e.target.value)} placeholder="4.80 mts" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de llantas</label>
                <input className="form-input" value={form.tipoLlantas} onChange={e => setF("tipoLlantas", e.target.value)} placeholder="Sólida, Pneumática..." />
              </div>
              <div className="form-group">
                <label className="form-label">Estatus</label>
                <select className="form-select" value={form.estatus} onChange={e => setF("estatus", e.target.value)}>
                  <option value="disponible">Disponible</option>
                  <option value="rentado">Rentado</option>
                  <option value="taller">Taller</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>

            {isElectrico && (
              <>
                <SectionLabel text="Eléctrico" />
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Voltaje</label>
                    <input className="form-input" value={form.voltaje} onChange={e => setF("voltaje", e.target.value)} placeholder="36v, 48v..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de batería</label>
                    <input className="form-input" value={form.tipoBateria} onChange={e => setF("tipoBateria", e.target.value)} placeholder="Ácido plomo, Litio..." />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <Toggle label="Incluye cargador" checked={form.incluyeCargador} onChange={v => setF("incluyeCargador", v)} />
                  </div>
                </div>
              </>
            )}

            {isGasDiesel && (
              <>
                <SectionLabel text="Gas / Diésel" />
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Altura contraído</label>
                    <input className="form-input" value={form.alturaColapsada} onChange={e => setF("alturaColapsada", e.target.value)} placeholder="2.30 mts" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horquillas</label>
                    <input className="form-input" value={form.horquillas} onChange={e => setF("horquillas", e.target.value)} placeholder='42" (1.06 mts)' />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <Toggle label="Desplazador lateral de horquillas" checked={form.desplazadorLateral} onChange={v => setF("desplazadorLateral", v)} />
                  </div>
                </div>
              </>
            )}

            <SectionLabel text="Equipo de seguridad" />
            <div className="form-grid">
              <Toggle label="Alarma de reversa"  checked={form.equipoSeguridad.alarmaReversa} onChange={v => setSeg("alarmaReversa", v)} />
              <Toggle label="Torreta ámbar"       checked={form.equipoSeguridad.torretaAmbar}  onChange={v => setSeg("torretaAmbar",  v)} />
              <Toggle label="Luces"               checked={form.equipoSeguridad.luces}         onChange={v => setSeg("luces",         v)} />
              <Toggle label="Extintor"            checked={form.equipoSeguridad.extintor}      onChange={v => setSeg("extintor",      v)} />
            </div>

            <SectionLabel text="Horómetro y mantenimiento" />
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Horómetro actual</label>
                <input className="form-input" type="number" value={form.horometroActual} onChange={e => setF("horometroActual", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horas restantes para servicio</label>
                <input className="form-input" type="number" value={form.horasRestantesServicio} onChange={e => setF("horasRestantesServicio", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Último mantenimiento</label>
                <input className="form-input" type="date" value={form.fechaUltimoMantenimiento} onChange={e => setF("fechaUltimoMantenimiento", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo mantenimiento</label>
                <input className="form-input" type="date" value={form.proximoMantenimiento} onChange={e => setF("proximoMantenimiento", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Último servicio</label>
                <input className="form-input" type="date" value={form.fechaUltimoServicio} onChange={e => setF("fechaUltimoServicio", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Próximo servicio</label>
                <input className="form-input" type="date" value={form.proximoServicio} onChange={e => setF("proximoServicio", e.target.value)} />
              </div>
            </div>

            <SectionLabel text="Costos de renta" />
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Costo por día ($)</label>
                <input className="form-input" type="number" value={form.costoDia} onChange={e => setF("costoDia", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo por semana ($)</label>
                <input className="form-input" type="number" value={form.costoSemana} onChange={e => setF("costoSemana", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo por mes ($)</label>
                <input className="form-input" type="number" value={form.costoMes} onChange={e => setF("costoMes", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo anual ($)</label>
                <input className="form-input" type="number" value={form.costoAnual} onChange={e => setF("costoAnual", +e.target.value)} />
              </div>
            </div>

            <SectionLabel text="Precio de venta" />
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Precio de venta ($)</label>
                <input className="form-input" type="number" value={form.precioVenta} onChange={e => setF("precioVenta", +e.target.value)} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalleModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalleModal(null); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setDetalleModal(null)}>✕</button>
            <h2 className="modal-title">{detalleModal.numeroEconomico} — {detalleModal.marca} {detalleModal.modelo}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              {[
                { label: "Serie",               val: detalleModal.serie },
                { label: "Tipo",                val: detalleModal.tipo },
                { label: "Capacidad",           val: detalleModal.capacidad },
                { label: "Altura levante",      val: detalleModal.alturaLevante },
                { label: "Altura contraído",    val: detalleModal.alturaColapsada },
                { label: "Horquillas",          val: detalleModal.horquillas },
                { label: "Desplazador lat.",    val: detalleModal.desplazadorLateral ? "Sí" : null },
                { label: "Tipo de llantas",     val: detalleModal.tipoLlantas },
                { label: "Voltaje",             val: detalleModal.voltaje },
                { label: "Tipo batería",        val: detalleModal.tipoBateria },
                { label: "Incluye cargador",    val: detalleModal.incluyeCargador ? "Sí" : null },
                { label: "Alarma reversa",      val: detalleModal.equipoSeguridad?.alarmaReversa ? "✅" : null },
                { label: "Torreta ámbar",       val: detalleModal.equipoSeguridad?.torretaAmbar  ? "✅" : null },
                { label: "Luces",               val: detalleModal.equipoSeguridad?.luces         ? "✅" : null },
                { label: "Extintor",            val: detalleModal.equipoSeguridad?.extintor      ? "✅" : null },
                { label: "Horómetro",           val: detalleModal.horometroActual ? `${detalleModal.horometroActual} hr` : null },
                { label: "Horas restantes",     val: detalleModal.horasRestantesServicio ? `${detalleModal.horasRestantesServicio} hr` : null },
                { label: "Últ. mantenimiento",  val: fmt(detalleModal.fechaUltimoMantenimiento) },
                { label: "Próx. mantenimiento", val: fmt(detalleModal.proximoMantenimiento) },
                { label: "Últ. servicio",       val: fmt(detalleModal.fechaUltimoServicio) },
                { label: "Próx. servicio",      val: fmt(detalleModal.proximoServicio) },
                { label: "Costo día",           val: detalleModal.costoDia    ? `$${detalleModal.costoDia.toLocaleString()}`    : null },
                { label: "Costo semana",        val: detalleModal.costoSemana ? `$${detalleModal.costoSemana.toLocaleString()}` : null },
                { label: "Costo mes",           val: detalleModal.costoMes    ? `$${detalleModal.costoMes.toLocaleString()}`    : null },
                { label: "Costo anual",         val: detalleModal.costoAnual  ? `$${detalleModal.costoAnual.toLocaleString()}`  : null },
                { label: "Precio venta",        val: detalleModal.precioVenta ? `$${detalleModal.precioVenta.toLocaleString()}` : null },
                { label: "Cliente actual",      val: detalleModal.clienteActual?.nombre },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text)", margin: "2px 0 0", fontWeight: 500 }}>{item.val}</p>
                </div>
              ) : null)}
            </div>
            <div className="modal-footer">
              {canEdit && (
                <button className="btn btn-primary" onClick={() => { setDetalleModal(null); openEdit(detalleModal); }}>✏️ Editar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal asignar cliente ── */}
      {asignarModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAsignarModal(null); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <button className="modal-close" onClick={() => setAsignarModal(null)}>✕</button>
            <h2 className="modal-title">Asignar a cliente</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
              Equipo <strong style={{ color: "var(--text)" }}>{asignarModal.numeroEconomico}</strong> — {asignarModal.marca} {asignarModal.modelo}
            </p>
            <div className="form-group">
              <label className="form-label">Cliente</label>
              <select className="form-select" value={clienteSel} onChange={e => setClienteSel(e.target.value)}>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAsignarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={asignar} disabled={!clienteSel}>Asignar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal alta rápida ── */}
      {modalRapido && canEdit && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalRapido(false); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <button className="modal-close" onClick={() => setModalRapido(false)}>✕</button>
            <h2 className="modal-title">⚡ Alta rápida</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 14 }}>
              Captura lo que tengas a la mano. Puedes completar el resto de los datos después editando el equipo.
            </p>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="form-label">No. Económico *</label>
                <input className="form-input" value={formRapido.numeroEconomico}
                  onChange={e => setFormRapido(p => ({ ...p, numeroEconomico: e.target.value }))}
                  placeholder="#01" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input className="form-input" value={formRapido.marca}
                  onChange={e => setFormRapido(p => ({ ...p, marca: e.target.value }))}
                  placeholder="Crown, Yale..." />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input className="form-input" value={formRapido.modelo}
                  onChange={e => setFormRapido(p => ({ ...p, modelo: e.target.value }))}
                  placeholder="GLP050..." />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={formRapido.tipo}
                  onChange={e => setFormRapido(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="electrico">Eléctrico</option>
                  <option value="gas">Gas LP</option>
                  <option value="diesel">Diésel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Estatus</label>
                <select className="form-select" value={formRapido.estatus}
                  onChange={e => setFormRapido(p => ({ ...p, estatus: e.target.value }))}>
                  <option value="disponible">Disponible</option>
                  <option value="taller">Taller (no sirve)</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalRapido(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarRapido} disabled={savingRapido || !formRapido.numeroEconomico.trim()}>
                {savingRapido ? "Guardando..." : "✅ Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}