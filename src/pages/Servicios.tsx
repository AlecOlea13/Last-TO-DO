import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { generarOrdenTrabajo, imprimirOrdenTrabajo, type OrdenTrabajoReporte } from "../utils/generarReporte";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  cachearServicios, obtenerServiciosCache,
  guardarAccion, guardarFotoOffline, fileToBase64,
} from "../utils/offlineDB";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

type OrdenRefaccionItem = {
  refaccion: { _id: string; nombre: string; numeroParte?: string; unidad: string; precio?: number };
  cantidadSolicitada: number;
  cantidadSurtida: number;
  confirmado: boolean;
};

type Pausa = {
  _id: string;
  razon: string;
  horaInicio: string;
  horaFin?: string;
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
  estatus: "abierto" | "en_proceso" | "pausado" | "cerrado";
  costoRefacciones?: number;
  costoManoObra?: number;
  horometro?: number;
  horometroCierre?: number;
  ordenRefaccion?: { _id: string; folio: string; estatus: string; items?: OrdenRefaccionItem[] };
  notasCierre?: string;
  fotoHojaFirmada?: string;
  fotoEquipoFinal?: string;
  fotoRefacciones?: string;
  horaInicio?: string;
  horaFin?: string;
  pausas?: Pausa[];
  ubicacionInicio?: { lat: number; lng: number };
  ubicacionCierre?: { lat: number; lng: number };
};

type Monta        = { _id: string; numeroEconomico: string; marca: string; clienteActual?: { _id: string; nombre: string } | null };
type Cliente      = { _id: string; nombre: string };
type TipoServicio = { _id: string; nombre: string; intervaloHrs?: number };
type Usuario      = { _id: string; nombre: string; rol: string };

const emptyForm = {
  montacargas: "", cliente: "", tipoServicio: "", tecnicoAsignado: "",
  fechaReporte: new Date().toISOString().split("T")[0],
  problema: "", horometro: 0,
};

const emptyCerrarForm = {
  horometro: 0, proximoServicio: "", estatusMonta: "disponible",
  notasCierre: "", fotoHojaFirmada: "", fotoEquipoFinal: "", fotoRefacciones: "",
};

const ORDEN_BADGE: Record<string, string> = {
  pendiente: "badge-amber", surtida: "badge-green",
  parcial: "badge-blue",   cancelada: "badge-gray",
};

const STORAGE_KEY_RECORDATORIO = "pipsa_ultimo_recordatorio";
const TREINTA_MIN = 30 * 60 * 1000;

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Botón micrófono reutilizable ──
function BtnMic({ onResult, style }: { onResult: (t: string) => void; style?: React.CSSProperties }) {
  const { escuchando, iniciar, detener } = useSpeechRecognition(onResult);
  return (
    <button
      type="button"
      onClick={escuchando ? detener : iniciar}
      style={{
        background: escuchando ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.1)",
        border: `1.5px solid ${escuchando ? "var(--red)" : "rgba(245,158,11,0.3)"}`,
        borderRadius: 8, padding: "8px 12px", cursor: "pointer",
        fontSize: "1.2rem", lineHeight: 1, flexShrink: 0,
        animation: escuchando ? "pulse 1s infinite" : "none",
        ...style,
      }}
      title={escuchando ? "Toca para detener" : "Toca para dictar"}
    >
      {escuchando ? "🔴" : "🎙️"}
    </button>
  );
}

function Cronometro({ horaInicio, pausas, grande }: { horaInicio: string; pausas?: Pausa[]; grande?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function calcElapsed() {
      const inicio = new Date(horaInicio).getTime();
      const ahora  = Date.now();
      const tiempoPausado = (pausas ?? []).reduce((acc, p) => {
        const pInicio = new Date(p.horaInicio).getTime();
        const pFin    = p.horaFin ? new Date(p.horaFin).getTime() : ahora;
        return acc + (pFin - pInicio);
      }, 0);
      return Math.floor((ahora - inicio - tiempoPausado) / 1000);
    }
    setElapsed(calcElapsed());
    const interval = setInterval(() => setElapsed(calcElapsed()), 1000);
    return () => clearInterval(interval);
  }, [horaInicio, pausas]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const texto = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (grande) {
    return (
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, fontFamily: "var(--font-head)", color: "var(--accent)", letterSpacing: 2 }}>
          ⏱️ {texto}
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>Tiempo trabajado</div>
      </div>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "0.78rem", color: "var(--accent)", background: "rgba(245,158,11,0.1)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
      ⏱️ {texto}
    </span>
  );
}

function VistaTecnicoMovil({
  servicios, iniciandoId, pausandoId, reanudandoId, online, pendientes,
  onIniciarConfirm, onPausar, onReanudar, onCerrar,
}: {
  servicios: Servicio[];
  iniciandoId: string | null;
  pausandoId: string | null;
  reanudandoId: string | null;
  online: boolean;
  pendientes: number;
  onIniciarConfirm: (s: Servicio) => void;
  onPausar: (s: Servicio) => void;
  onReanudar: (s: Servicio) => void;
  onCerrar: (s: Servicio) => void;
}) {
  const activo        = servicios.find(s => s.estatus === "en_proceso" || s.estatus === "pausado");
  const pendientesSvc = servicios.filter(s => s.estatus === "abierto");
  const pausaActiva   = activo?.pausas?.find(p => !p.horaFin);

  function fmt(date?: string) {
    if (!date) return "—";
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {!online && (
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4rem" }}>📵</span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--red)", fontSize: "0.9rem" }}>Sin conexión</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Tus acciones se guardan y se envían cuando recuperes internet</div>
          </div>
        </div>
      )}

      {online && pendientes > 0 && (
        <div style={{ background: "rgba(245,158,11,0.12)", border: "1.5px solid var(--accent)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4rem" }}>🔄</span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.9rem" }}>Sincronizando...</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{pendientes} acción{pendientes !== 1 ? "es" : ""} pendiente{pendientes !== 1 ? "s" : ""} de enviar</div>
          </div>
        </div>
      )}

      {activo && (
        <div style={{ background: activo.estatus === "pausado" ? "rgba(107,114,128,0.12)" : "rgba(245,158,11,0.08)", border: `2px solid ${activo.estatus === "pausado" ? "var(--border)" : "var(--accent)"}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: activo.estatus === "pausado" ? "var(--text-muted)" : "var(--accent)" }}>
              {activo.estatus === "pausado" ? "⏸️ En pausa" : "🔧 En proceso"}
            </span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text-muted)" }}>{activo.folio}</span>
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text)", marginBottom: 2 }}>
            #{activo.montacargas?.numeroEconomico} {activo.montacargas?.marca}
          </div>
          <div style={{ fontSize: "0.92rem", color: "var(--text-muted)", marginBottom: 4 }}>{activo.cliente?.nombre ?? "Sin cliente"}</div>
          {activo.problema && (
            <div style={{ fontSize: "0.85rem", color: "var(--text)", background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{activo.problema}</div>
          )}
          {activo.estatus === "pausado" && pausaActiva && (
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              ⏸️ <strong>Motivo:</strong> {pausaActiva.razon}
            </div>
          )}
          {activo.horaInicio && activo.estatus === "en_proceso" && (
            <Cronometro horaInicio={activo.horaInicio} pausas={activo.pausas} grande />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {activo.estatus === "en_proceso" && (
              <>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--surface2)", color: "var(--text)", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => onPausar(activo)} disabled={pausandoId === activo._id}>
                  {pausandoId === activo._id ? "..." : "⏸️ Pausar servicio"}
                </button>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#000", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => onCerrar(activo)}>
                  ✅ Terminar servicio
                </button>
              </>
            )}
            {activo.estatus === "pausado" && (
              <>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "1.5px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.15)", color: "var(--green)", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => onReanudar(activo)} disabled={reanudandoId === activo._id}>
                  {reanudandoId === activo._id ? "..." : "▶️ Reanudar servicio"}
                </button>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#000", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => onCerrar(activo)}>
                  ✅ Terminar servicio
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {pendientesSvc.length > 0 && (
        <div>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>Servicios pendientes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendientesSvc.map(s => (
              <div key={s._id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 16, opacity: activo ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-head)" }}>{s.folio}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{fmt(s.fechaReporte)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>#{s.montacargas?.numeroEconomico} {s.montacargas?.marca}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: s.problema ? 8 : 0 }}>{s.cliente?.nombre ?? "Sin cliente"}</div>
                {s.problema && <div style={{ fontSize: "0.82rem", color: "var(--text)", marginBottom: 12 }}>{s.problema}</div>}
                {!activo ? (
                  <button style={{ width: "100%", padding: "14px", borderRadius: 10, border: "1.5px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.15)", color: "var(--blue)", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}
                    onClick={() => onIniciarConfirm(s)} disabled={iniciandoId === s._id}>
                    {iniciandoId === s._id ? "Iniciando..." : "▶️ Iniciar este servicio"}
                  </button>
                ) : (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>🔒 Termina el servicio activo primero</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!activo && pendientesSvc.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Sin servicios pendientes</div>
          <div style={{ fontSize: "0.85rem", marginTop: 6 }}>Por el momento no tienes trabajo asignado</div>
        </div>
      )}
    </div>
  );
}

export default function Servicios() {
  const rol               = localStorage.getItem("rol") ?? "";
  const userId            = localStorage.getItem("userId") ?? "";
  const canCreate         = ["developer", "gerencia", "oficina", "supervisor_almacen"].includes(rol);
  const canAsignarTecnico = ["developer", "gerencia", "oficina"].includes(rol);
  const esTecnico         = rol === "tecnico";
  const soloVer           = ["oficina", "supervisor_almacen"].includes(rol);

  const { online, pendientes, sincronizando, actualizarPendientes } = useOnlineStatus();

  const [servicios, setServicios]       = useState<Servicio[]>([]);
  const [montas, setMontas]             = useState<Monta[]>([]);
  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [tipos, setTipos]               = useState<TipoServicio[]>([]);
  const [usuarios, setUsuarios]         = useState<Usuario[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filtro, setFiltro]             = useState("todos");
  const [modal, setModal]               = useState(false);
  const [cerrarModal, setCerrarModal]   = useState<Servicio | null>(null);
  const [pausarModal, setPausarModal]   = useState<Servicio | null>(null);
  const [confirmarIniciarModal, setConfirmarIniciarModal] = useState<Servicio | null>(null);
  const [razonPausa, setRazonPausa]     = useState("");
  const [form, setForm]                 = useState<any>(emptyForm);
  const [cerrarForm, setCerrarForm]     = useState<any>(emptyCerrarForm);
  const [saving, setSaving]             = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState<"hoja" | "equipo" | "refacciones" | null>(null);
  const [iniciandoId, setIniciandoId]   = useState<string | null>(null);
  const [pausandoId, setPausandoId]     = useState<string | null>(null);
  const [reanudandoId, setReanudandoId] = useState<string | null>(null);
  const [mostrarRecordatorio, setMostrarRecordatorio] = useState(false);

  const [modalReporte, setModalReporte]                 = useState(false);
  const [reportePeriodo, setReportePeriodo]             = useState<"semana" | "mes" | "custom">("mes");
  const [reporteMes, setReporteMes]                     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reporteDesde, setReporteDesde]                 = useState("");
  const [reporteHasta, setReporteHasta]                 = useState("");
  const [reporteFiltroTecnico, setReporteFiltroTecnico] = useState("todos");

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (rol !== "tecnico") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    function checkRecordatorio() {
      const hayActivo = servicios.some(s => s.estatus === "en_proceso" || s.estatus === "pausado");
      if (!hayActivo) return;
      const ultimo = parseInt(localStorage.getItem(STORAGE_KEY_RECORDATORIO) ?? "0");
      if (Date.now() - ultimo >= TREINTA_MIN) {
        localStorage.setItem(STORAGE_KEY_RECORDATORIO, String(Date.now()));
        setMostrarRecordatorio(true);
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification("⏱️ Control Pipsa", { body: "Recuerda terminar el servicio en la app.", icon: "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png" }); } catch {}
        }
      }
    }
    function onVisibility() { if (document.visibilityState === "visible") checkRecordatorio(); }
    const intervalo = setInterval(checkRecordatorio, 60 * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    checkRecordatorio();
    return () => { clearInterval(intervalo); document.removeEventListener("visibilitychange", onVisibility); };
  }, [rol, servicios]);

  async function load() {
    if (online) {
      try {
        const [s, m, c, t] = await Promise.all([
          api.get("/servicios"),
          api.get("/montacargas"),
          api.get("/clientes"),
          api.get("/tipos-servicio"),
        ]);
        setServicios(s.data);
        setMontas(m.data);
        setClientes(c.data);
        setTipos(t.data);
        if (esTecnico) await cachearServicios(s.data);
      } catch {}
      if (["developer", "gerencia", "oficina", "supervisor_almacen"].includes(rol)) {
        try {
          const { data } = await api.get("/users");
          setUsuarios(data.filter((x: any) => ["tecnico", "oficina", "almacen"].includes(x.rol)));
        } catch {}
      }
    } else {
      try {
        const cached = await obtenerServiciosCache();
        if (cached.length > 0) setServicios(cached);
      } catch {}
    }
    setLoading(false);
  }

  useEffect(() => {
    if (online) load();
  }, [online]);

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

  async function subirFoto(file: File, tipo: "hoja" | "equipo" | "refacciones", accionId?: string) {
    setUploadingFoto(tipo);
    try {
      if (online) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", UPLOAD_PRESET);
        const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
        const data = await res.json();
        const key  = tipo === "hoja" ? "fotoHojaFirmada" : tipo === "equipo" ? "fotoEquipoFinal" : "fotoRefacciones";
        setCerrarForm((p: any) => ({ ...p, [key]: data.secure_url }));
      } else {
        if (!accionId) return;
        const base64 = await fileToBase64(file);
        await guardarFotoOffline({ id: nanoid(), accionId, tipo, base64, fileName: file.name });
        const key = tipo === "hoja" ? "fotoHojaFirmada" : tipo === "equipo" ? "fotoEquipoFinal" : "fotoRefacciones";
        setCerrarForm((p: any) => ({ ...p, [key]: base64 }));
      }
    } catch { alert("Error al procesar la imagen"); }
    finally { setUploadingFoto(null); }
  }

  async function obtenerUbicacion(): Promise<{ lat: number; lng: number } | null> {
    if (!("geolocation" in navigator)) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch { return null; }
  }

  async function iniciar(s: Servicio) {
    setIniciandoId(s._id);
    setConfirmarIniciarModal(null);
    try {
      const ubicacion = await obtenerUbicacion();
      const payload   = ubicacion ? { ubicacion } : {};
      if (online) {
        const { data } = await api.post(`/servicios/${s._id}/iniciar`, payload);
        setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, ...data } : sv));
        await cachearServicios(servicios.map(sv => sv._id === s._id ? { ...sv, ...data } : sv));
      } else {
        await guardarAccion({ id: nanoid(), tipo: "iniciar", servicioId: s._id, payload, timestamp: Date.now() });
        const ahora = new Date().toISOString();
        setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, estatus: "en_proceso", horaInicio: ahora } : sv));
        await actualizarPendientes();
      }
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setIniciandoId(null); }
  }

  async function pausar() {
    if (!pausarModal || !razonPausa.trim()) return;
    setPausandoId(pausarModal._id);
    const payload = { razon: razonPausa.trim() };
    try {
      if (online) {
        const { data } = await api.post(`/servicios/${pausarModal._id}/pausar`, payload);
        setServicios(prev => prev.map(sv => sv._id === pausarModal._id ? { ...sv, ...data } : sv));
      } else {
        await guardarAccion({ id: nanoid(), tipo: "pausar", servicioId: pausarModal._id, payload, timestamp: Date.now() });
        const ahora = new Date().toISOString();
        setServicios(prev => prev.map(sv => sv._id === pausarModal._id
          ? { ...sv, estatus: "pausado", pausas: [...(sv.pausas ?? []), { _id: nanoid(), razon: razonPausa.trim(), horaInicio: ahora }] }
          : sv
        ));
        await actualizarPendientes();
      }
      setPausarModal(null);
      setRazonPausa("");
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setPausandoId(null); }
  }

  async function reanudar(s: Servicio) {
    setReanudandoId(s._id);
    try {
      if (online) {
        const { data } = await api.post(`/servicios/${s._id}/reanudar`);
        setServicios(prev => prev.map(sv => sv._id === s._id ? { ...sv, ...data } : sv));
      } else {
        await guardarAccion({ id: nanoid(), tipo: "reanudar", servicioId: s._id, payload: {}, timestamp: Date.now() });
        setServicios(prev => prev.map(sv => sv._id === s._id
          ? { ...sv, estatus: "en_proceso", pausas: sv.pausas?.map(p => !p.horaFin ? { ...p, horaFin: new Date().toISOString() } : p) }
          : sv
        ));
        await actualizarPendientes();
      }
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setReanudandoId(null); }
  }

  const [cerrarAccionId] = useState(() => nanoid());

  async function cerrar() {
    if (!cerrarModal) return;
    setSaving(true);
    try {
      const ubicacion = await obtenerUbicacion();
      const payload   = { ...cerrarForm, ...(ubicacion ? { ubicacion } : {}) };
      if (online) {
        await api.post(`/servicios/${cerrarModal._id}/cerrar`, payload);
        load();
      } else {
        await guardarAccion({
          id: cerrarAccionId, tipo: "cerrar", servicioId: cerrarModal._id,
          payload: {
            ...payload,
            fotoHojaFirmada: payload.fotoHojaFirmada?.startsWith("data:") ? "" : payload.fotoHojaFirmada,
            fotoEquipoFinal: payload.fotoEquipoFinal?.startsWith("data:")  ? "" : payload.fotoEquipoFinal,
            fotoRefacciones: payload.fotoRefacciones?.startsWith("data:")  ? "" : payload.fotoRefacciones,
          },
          timestamp: Date.now(),
        });
        setServicios(prev => prev.map(sv => sv._id === cerrarModal._id ? { ...sv, estatus: "cerrado" } : sv));
        await actualizarPendientes();
      }
      setCerrarModal(null);
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
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

  function onClienteChange(clienteId: string) {
    setForm((p: any) => ({ ...p, cliente: clienteId, montacargas: "" }));
  }

  const montasFiltradas  = form.cliente ? montas.filter(m => m.clienteActual?._id === form.cliente) : montas;
  const montasSinCliente = form.cliente && montasFiltradas.length === 0;

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
      tipoServicio:     s.tipoServicio?.nombre,
      tecnico:          s.tecnicoAsignado?.nombre,
      problema:         s.problema,
      notasCierre:      s.notasCierre,
      refacciones:      s.ordenRefaccion?.items?.filter(i => i.cantidadSurtida > 0).map(i => ({ cantidad: i.cantidadSurtida, descripcion: i.refaccion.nombre, precio: undefined })) ?? [],
      costoRefacciones: s.costoRefacciones,
      costoManoObra:    s.costoManoObra,
      observaciones:    s.notasCierre,
    };
  }

  function filtrarPorPeriodoReporte(s: Servicio): boolean {
    const fecha = s.fechaReporte ? new Date(s.fechaReporte.split("T")[0] + "T12:00:00") : null;
    if (!fecha) return false;
    if (reportePeriodo === "mes") {
      const [y, m] = reporteMes.split("-").map(Number);
      return fecha.getFullYear() === y && fecha.getMonth() === m - 1;
    }
    if (reportePeriodo === "semana") {
      const hoy   = new Date();
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      lunes.setHours(0, 0, 0, 0);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);
      return fecha >= lunes && fecha <= domingo;
    }
    if (reportePeriodo === "custom") {
      if (reporteDesde && fecha < new Date(reporteDesde + "T00:00:00")) return false;
      if (reporteHasta && fecha > new Date(reporteHasta + "T23:59:59")) return false;
      return true;
    }
    return true;
  }

  function generarReporteServicios() {
    const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
    const datos = servicios
      .filter(s => s.estatus === "cerrado")
      .filter(filtrarPorPeriodoReporte)
      .filter(s => reporteFiltroTecnico === "todos" || s.tecnicoAsignado?._id === reporteFiltroTecnico);

    const porTecnico = new Map<string, { nombre: string; servicios: Servicio[] }>();
    for (const s of datos) {
      const key    = s.tecnicoAsignado?._id ?? "__sin__";
      const nombre = s.tecnicoAsignado?.nombre ?? "Sin técnico";
      if (!porTecnico.has(key)) porTecnico.set(key, { nombre, servicios: [] });
      porTecnico.get(key)!.servicios.push(s);
    }

    const porEquipo = new Map<string, { eco: string; marca: string; count: number }>();
    for (const s of datos) {
      const key = s.montacargas?._id ?? "__sin__";
      if (!porEquipo.has(key)) porEquipo.set(key, { eco: s.montacargas?.numeroEconomico ?? "—", marca: s.montacargas?.marca ?? "—", count: 0 });
      porEquipo.get(key)!.count++;
    }

    const labelPeriodo = reportePeriodo === "mes"
      ? new Date(reporteMes + "-01").toLocaleDateString("es-MX", { month: "long", year: "numeric" })
      : reportePeriodo === "semana" ? "Semana actual"
      : `${reporteDesde ?? "—"} al ${reporteHasta ?? "—"}`;

    const totalCostoRef  = datos.reduce((a, s) => a + (s.costoRefacciones ?? 0), 0);
    const totalCostoMano = datos.reduce((a, s) => a + (s.costoManoObra    ?? 0), 0);

    function fmtCorto(date?: string) {
      if (!date) return "—";
      const [y, m, d] = date.split("T")[0].split("-");
      return `${d}/${m}/${String(y).slice(2)}`;
    }

    const rowsTecnico = [...porTecnico.values()]
      .sort((a, b) => b.servicios.length - a.servicios.length)
      .map(g => `<tr>
        <td>${g.nombre}</td>
        <td style="text-align:center">${g.servicios.length}</td>
        <td style="text-align:right">$${g.servicios.reduce((a, s) => a + (s.costoManoObra ?? 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${g.servicios.reduce((a, s) => a + (s.costoRefacciones ?? 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");

    const rowsEquipo = [...porEquipo.values()]
      .sort((a, b) => b.count - a.count)
      .map(e => `<tr><td>${e.eco}</td><td>${e.marca}</td><td style="text-align:center">${e.count}</td></tr>`).join("");

    const rowsDetalle = datos
      .sort((a, b) => new Date(a.fechaReporte).getTime() - new Date(b.fechaReporte).getTime())
      .map(s => `<tr>
        <td>${s.folio ?? "—"}</td>
        <td>${fmtCorto(s.fechaReporte)}</td>
        <td>${s.montacargas?.numeroEconomico ?? "—"} ${s.montacargas?.marca ?? ""}</td>
        <td>${s.cliente?.nombre ?? "—"}</td>
        <td>${s.tipoServicio?.nombre ?? "—"}</td>
        <td>${s.tecnicoAsignado?.nombre ?? "—"}</td>
        <td style="text-align:right">${s.costoRefacciones ? "$" + s.costoRefacciones.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</td>
        <td style="text-align:right">${s.costoManoObra ? "$" + s.costoManoObra.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Servicios — ${labelPeriodo}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:20px;max-width:900px;margin:auto; }
  .header { display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px; }
  .logo { width:55px;height:55px;object-fit:contain;background:#000;border-radius:6px; }
  h1 { font-size:13pt;font-weight:900; } h2 { font-size:10pt;font-weight:700;margin:18px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px; }
  p.sub { font-size:8.5pt;color:#555; }
  table { width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:6px; }
  thead { background:#222;color:#fff; } thead th { padding:5px 8px;text-align:left; }
  tbody tr:nth-child(even) { background:#f5f5f5; } td { padding:4px 8px;border-bottom:1px solid #ddd; }
  .resumen-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px; }
  .resumen-box { border:1px solid #ddd;border-radius:4px;padding:10px;text-align:center; }
  .resumen-box .val { font-size:18pt;font-weight:900;color:#222; }
  .resumen-box .lbl { font-size:7.5pt;color:#666;text-transform:uppercase;margin-top:2px; }
  .print-btn { position:fixed;top:16px;right:16px;padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-size:11pt;font-weight:700;cursor:pointer; }
  @media print { .print-btn { display:none; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="header">
  <img src="${logoUrl}" class="logo" alt="Pipsa" />
  <div>
    <h1>Reporte de Servicios — ${labelPeriodo.charAt(0).toUpperCase() + labelPeriodo.slice(1)}</h1>
    <p class="sub">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</p>
    <p class="sub">Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>
  </div>
</div>
<div class="resumen-grid">
  <div class="resumen-box"><div class="val">${datos.length}</div><div class="lbl">Servicios cerrados</div></div>
  <div class="resumen-box"><div class="val">${porTecnico.size}</div><div class="lbl">Técnicos activos</div></div>
  <div class="resumen-box"><div class="val">$${totalCostoMano.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div><div class="lbl">Mano de obra</div></div>
  <div class="resumen-box"><div class="val">$${totalCostoRef.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div><div class="lbl">Refacciones</div></div>
</div>
<h2>Por técnico</h2>
<table><thead><tr><th>Técnico</th><th style="text-align:center">Servicios</th><th style="text-align:right">Mano de obra</th><th style="text-align:right">Refacciones</th></tr></thead>
<tbody>${rowsTecnico || '<tr><td colspan="4" style="text-align:center;color:#aaa">Sin datos</td></tr>'}</tbody></table>
<h2>Por equipo</h2>
<table><thead><tr><th>No. Económico</th><th>Marca</th><th style="text-align:center">Servicios</th></tr></thead>
<tbody>${rowsEquipo || '<tr><td colspan="3" style="text-align:center;color:#aaa">Sin datos</td></tr>'}</tbody></table>
<h2>Detalle de servicios</h2>
<table><thead><tr><th>Folio</th><th>Fecha</th><th>Equipo</th><th>Cliente</th><th>Tipo</th><th>Técnico</th><th style="text-align:right">Refacciones</th><th style="text-align:right">Mano de obra</th></tr></thead>
<tbody>${rowsDetalle || '<tr><td colspan="8" style="text-align:center;color:#aaa">Sin servicios en este período</td></tr>'}</tbody></table>
<div style="text-align:right;margin-top:8px;font-size:9pt;"><strong>Total: $${(totalCostoRef + totalCostoMano).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong></div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setModalReporte(false);
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
    const [year, month, day] = date.split("T")[0].split("-");
    return new Date(+year, +month - 1, +day).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function FotoUpload({ label, fotoKey, tipo }: { label: string; fotoKey: string; tipo: "hoja" | "equipo" | "refacciones" }) {
    const ref = useRef<HTMLInputElement>(null);
    const url = cerrarForm[fotoKey];
    return (
      <div>
        <label className="form-label">{label}{!online && <span style={{ fontSize: "0.68rem", color: "var(--accent)", marginLeft: 6 }}>📵 se guardará offline</span>}</label>
        <div onClick={() => ref.current?.click()}
          style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)", padding: 12, textAlign: "center", cursor: "pointer", background: "var(--surface2)" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          {url ? (
            <img src={url} alt={label} style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 6 }} />
          ) : uploadingFoto === tipo ? (
            <div className="spinner" style={{ width: 24, height: 24, margin: "auto" }} />
          ) : (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>📷 Toca para tomar o subir foto</p>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f, tipo, cerrarAccionId); }} />
      </div>
    );
  }

  // ── Vista técnico ──
  if (esTecnico) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Mis Servicios</h1>
            <p className="page-subtitle">{servicios.filter(s => s.estatus !== "cerrado").length} pendientes</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: online ? "var(--green)" : "var(--red)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "var(--green)" : "var(--red)", display: "inline-block" }} />
            {online ? "En línea" : "Sin conexión"}
            {sincronizando && <span style={{ color: "var(--accent)" }}>· Sincronizando...</span>}
            {!sincronizando && pendientes > 0 && (
              <span style={{ background: "var(--accent)", color: "#000", borderRadius: 99, padding: "1px 7px", fontSize: "0.68rem" }}>
                {pendientes} pendiente{pendientes !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {mostrarRecordatorio && (
          <div style={{ margin: "0 16px 12px", background: "rgba(245,158,11,0.15)", border: "2px solid var(--accent)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent)", marginBottom: 2 }}>⏱️ Recordatorio</div>
              <div style={{ fontSize: "0.88rem", color: "var(--text)" }}>Recuerda terminar el servicio en la app cuando lo hayas completado.</div>
            </div>
            <button onClick={() => setMostrarRecordatorio(false)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)", padding: "4px 8px", flexShrink: 0 }}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : (
          <VistaTecnicoMovil
            servicios={servicios}
            iniciandoId={iniciandoId}
            pausandoId={pausandoId}
            reanudandoId={reanudandoId}
            online={online}
            pendientes={pendientes}
            onIniciarConfirm={s => setConfirmarIniciarModal(s)}
            onPausar={s => { setPausarModal(s); setRazonPausa(""); }}
            onReanudar={reanudar}
            onCerrar={s => { setCerrarModal(s); setCerrarForm({ ...emptyCerrarForm, horometro: s.horometro ?? 0 }); }}
          />
        )}

        {confirmarIniciarModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmarIniciarModal(null)}>
            <div className="modal" style={{ maxWidth: 360 }}>
              <h2 className="modal-title" style={{ textAlign: "center", fontSize: "1.3rem" }}>¿Iniciar servicio?</h2>
              <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔧</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 4 }}>
                  #{confirmarIniciarModal.montacargas?.numeroEconomico} {confirmarIniciarModal.montacargas?.marca}
                </div>
                <div style={{ fontSize: "0.9rem" }}>{confirmarIniciarModal.cliente?.nombre}</div>
                {confirmarIniciarModal.problema && (
                  <div style={{ fontSize: "0.85rem", marginTop: 8, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8 }}>{confirmarIniciarModal.problema}</div>
                )}
              </div>
              {!online && (
                <div style={{ fontSize: "0.75rem", color: "var(--accent)", textAlign: "center", marginBottom: 8, padding: "6px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8 }}>
                  📵 Sin internet — se sincronizará cuando recuperes señal
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginBottom: 12 }}>📍 Se registrará tu ubicación al iniciar</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#000", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => iniciar(confirmarIniciarModal)} disabled={iniciandoId === confirmarIniciarModal._id}>
                  {iniciandoId === confirmarIniciarModal._id ? "Iniciando..." : "✅ Sí, iniciar"}
                </button>
                <button style={{ width: "100%", padding: "14px", borderRadius: 12, background: "transparent", border: "1.5px solid var(--border)", color: "var(--text)", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => setConfirmarIniciarModal(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal pausar técnico — CON DICTADO DE VOZ ── */}
        {pausarModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPausarModal(null)}>
            <div className="modal" style={{ maxWidth: 440 }}>
              <button className="modal-close" onClick={() => setPausarModal(null)}>✕</button>
              <h2 className="modal-title">⏸️ Pausar servicio</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
                <strong style={{ color: "var(--text)" }}>{pausarModal.folio}</strong> — {pausarModal.montacargas?.numeroEconomico} {pausarModal.montacargas?.marca}
              </p>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "1rem" }}>¿Por qué pausas el servicio?</label>
                {/* ── Dictado de voz ── */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={razonPausa}
                    onChange={e => setRazonPausa(e.target.value)}
                    placeholder="Escribe o usa el micrófono 🎙️..."
                    style={{ fontSize: "1rem", flex: 1 }}
                    autoFocus
                  />
                  <BtnMic onResult={texto => setRazonPausa(p => p ? p + " " + texto : texto)} />
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  🎙️ Toca el micrófono para dictar en lugar de escribir
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--surface2)", color: "var(--text)", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", opacity: !razonPausa.trim() ? 0.5 : 1 }}
                  onClick={pausar} disabled={!razonPausa.trim() || pausandoId === pausarModal._id}>
                  {pausandoId === pausarModal._id ? "Pausando..." : "⏸️ Confirmar pausa"}
                </button>
                <button style={{ width: "100%", padding: "14px", borderRadius: 12, background: "transparent", border: "1.5px solid var(--border)", color: "var(--text)", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => setPausarModal(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal cerrar técnico — CON DICTADO, HORÓMETRO OPCIONAL, BOTONES ESTATUS ── */}
        {cerrarModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCerrarModal(null)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <button className="modal-close" onClick={() => setCerrarModal(null)}>✕</button>
              <h2 className="modal-title">✅ Terminar servicio</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 8 }}>
                <strong style={{ color: "var(--text)" }}>{cerrarModal.folio}</strong> — {cerrarModal.montacargas?.numeroEconomico} {cerrarModal.montacargas?.marca}
              </p>
              {cerrarModal.horaInicio && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 12 }}>
                  ⏱️ Tiempo activo: <Cronometro horaInicio={cerrarModal.horaInicio} pausas={cerrarModal.pausas} />
                </p>
              )}
              {!online && (
                <div style={{ fontSize: "0.78rem", color: "var(--accent)", padding: "8px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, marginBottom: 10 }}>
                  📵 Sin internet — el cierre y las fotos se enviarán automáticamente cuando recuperes señal
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>📍 Se registrará tu ubicación al confirmar el cierre</div>

              <div className="form-grid">
                {/* ── Horómetro opcional ── */}
                <div className="form-group">
                  <label className="form-label">
                    Horómetro al cierre
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>(opcional — dejar en 0 si no aplica)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    value={cerrarForm.horometro}
                    onChange={e => setCerrarForm((p: any) => ({ ...p, horometro: +e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Próximo servicio</label>
                  <input className="form-input" type="date" value={cerrarForm.proximoServicio} onChange={e => setCerrarForm((p: any) => ({ ...p, proximoServicio: e.target.value }))} />
                </div>

                {/* ── Estatus como botones grandes ── */}
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" style={{ marginBottom: 8 }}>¿Cómo queda el equipo?</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCerrarForm((p: any) => ({ ...p, estatusMonta: "disponible" }))}
                      style={{
                        padding: "16px 12px", borderRadius: 12, border: `2px solid ${cerrarForm.estatusMonta === "disponible" ? "var(--green)" : "var(--border)"}`,
                        background: cerrarForm.estatusMonta === "disponible" ? "rgba(34,197,94,0.15)" : "var(--surface2)",
                        color: cerrarForm.estatusMonta === "disponible" ? "var(--green)" : "var(--text-muted)",
                        fontSize: "1rem", fontWeight: 700, cursor: "pointer", textAlign: "center",
                      }}
                    >
                      ✅ Disponible
                    </button>
                    <button
                      type="button"
                      onClick={() => setCerrarForm((p: any) => ({ ...p, estatusMonta: "rentado" }))}
                      style={{
                        padding: "16px 12px", borderRadius: 12, border: `2px solid ${cerrarForm.estatusMonta === "rentado" ? "var(--blue)" : "var(--border)"}`,
                        background: cerrarForm.estatusMonta === "rentado" ? "rgba(59,130,246,0.15)" : "var(--surface2)",
                        color: cerrarForm.estatusMonta === "rentado" ? "var(--blue)" : "var(--text-muted)",
                        fontSize: "1rem", fontWeight: 700, cursor: "pointer", textAlign: "center",
                      }}
                    >
                      🏭 Rentado
                    </button>
                  </div>
                </div>

                {/* ── Notas con dictado de voz ── */}
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Notas / trabajos realizados</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <textarea
                      className="form-textarea"
                      value={cerrarForm.notasCierre}
                      onChange={e => setCerrarForm((p: any) => ({ ...p, notasCierre: e.target.value }))}
                      placeholder="Escribe o usa el micrófono 🎙️ para dictar los trabajos realizados..."
                      rows={4}
                      style={{ fontSize: "1rem", flex: 1 }}
                    />
                    <BtnMic onResult={texto => setCerrarForm((p: any) => ({ ...p, notasCierre: p.notasCierre ? p.notasCierre + " " + texto : texto }))} />
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    🎙️ Toca el micrófono y habla — el texto aparece solo
                  </p>
                </div>

                <div className="form-group"><FotoUpload label="📋 Foto de hoja firmada" fotoKey="fotoHojaFirmada" tipo="hoja" /></div>
                <div className="form-group"><FotoUpload label="📸 Foto del equipo finalizado" fotoKey="fotoEquipoFinal" tipo="equipo" /></div>
                <div className="form-group"><FotoUpload label="🔩 Foto de refacciones utilizadas" fotoKey="fotoRefacciones" tipo="refacciones" /></div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <button style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#000", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={cerrar} disabled={saving}>
                  {saving ? "Cerrando..." : online ? "✅ Confirmar cierre" : "💾 Guardar offline"}
                </button>
                <button style={{ width: "100%", padding: "14px", borderRadius: 12, background: "transparent", border: "1.5px solid var(--border)", color: "var(--text)", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => setCerrarModal(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* animación pulso para micrófono activo */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </>
    );
  }

  // ── Vista normal (no técnico) ──
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="page-subtitle">{servicios.filter(s => s.estatus !== "cerrado").length} tickets abiertos</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["developer", "gerencia", "oficina"].includes(rol) && (
            <button className="btn btn-secondary" onClick={() => setModalReporte(true)}>📊 Reporte</button>
          )}
          {canCreate && (
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>+ Nuevo servicio</button>
          )}
        </div>
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
                <option value="pausado">Pausados</option>
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
                  <th>Tipo</th><th>Técnico</th><th>Orden refac.</th><th>Tiempo</th><th>Estatus</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const esMiServicio = rol === "tecnico" && String(s.tecnicoAsignado?._id) === String(userId);
                  const puedeOperar  = ["developer", "gerencia"].includes(rol) || esMiServicio;
                  const pausaActiva  = s.pausas?.find(p => !p.horaFin);
                  return (
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
                        {s.estatus === "cerrado" && s.horaInicio && s.horaFin ? (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {Math.round((new Date(s.horaFin).getTime() - new Date(s.horaInicio).getTime()) / 60000)} min
                          </span>
                        ) : s.horaInicio && s.estatus === "en_proceso" ? (
                          <Cronometro horaInicio={s.horaInicio} pausas={s.pausas} />
                        ) : s.estatus === "pausado" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--text-muted)", background: "var(--surface2)", padding: "3px 8px", borderRadius: 6 }}>
                            ⏸️ {pausaActiva?.razon ? pausaActiva.razon.slice(0, 20) + (pausaActiva.razon.length > 20 ? "..." : "") : "Pausado"}
                          </span>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td>
                        {soloVer ? (
                          <span className={`badge ${s.estatus === "abierto" ? "badge-red" : s.estatus === "en_proceso" ? "badge-amber" : "badge-gray"}`}>
                            {s.estatus === "en_proceso" ? "en proceso" : s.estatus}
                          </span>
                        ) : (
                          <select className="form-select" style={{ padding: "4px 10px", fontSize: "0.78rem", width: "auto" }}
                            value={s.estatus} onChange={e => cambiarEstatus(s, e.target.value)}>
                            <option value="abierto">Abierto</option>
                            <option value="en_proceso">En proceso</option>
                            <option value="pausado">Pausado</option>
                            <option value="cerrado">Cerrado</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => generarOrdenTrabajo(buildOrdenTrabajo(s))} title="Ver orden">👁️</button>
                          <button className="btn btn-primary btn-sm" onClick={() => imprimirOrdenTrabajo(buildOrdenTrabajo(s))} title="Imprimir">🖨️</button>
                          {s.ubicacionInicio && (
                            <a className="btn btn-secondary btn-sm" href={"https://www.google.com/maps?q=" + s.ubicacionInicio.lat + "," + s.ubicacionInicio.lng} target="_blank" rel="noreferrer" title="Ubicación inicio" style={{ textDecoration: "none" }}>📍</a>
                          )}
                          {s.ubicacionCierre && (
                            <a className="btn btn-secondary btn-sm" href={"https://www.google.com/maps?q=" + s.ubicacionCierre.lat + "," + s.ubicacionCierre.lng} target="_blank" rel="noreferrer" title="Ubicación cierre" style={{ textDecoration: "none" }}>🏁</a>
                          )}
                          {!soloVer && s.estatus === "abierto" && !s.horaInicio && puedeOperar && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--blue)", borderColor: "rgba(59,130,246,0.3)" }}
                              onClick={() => iniciar(s)} disabled={iniciandoId === s._id}>
                              {iniciandoId === s._id ? "..." : "▶️ Iniciar"}
                            </button>
                          )}
                          {!soloVer && s.estatus === "en_proceso" && puedeOperar && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
                              onClick={() => { setPausarModal(s); setRazonPausa(""); }} disabled={pausandoId === s._id}>
                              ⏸️ Pausar
                            </button>
                          )}
                          {!soloVer && s.estatus === "pausado" && puedeOperar && (
                            <button className="btn btn-secondary btn-sm" style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                              onClick={() => reanudar(s)} disabled={reanudandoId === s._id}>
                              {reanudandoId === s._id ? "..." : "▶️ Reanudar"}
                            </button>
                          )}
                          {!soloVer && s.estatus !== "cerrado" && puedeOperar && (
                            <button className="btn btn-amber btn-sm"
                              onClick={() => { setCerrarModal(s); setCerrarForm({ ...emptyCerrarForm, horometro: s.horometro ?? 0 }); }}>
                              Cerrar
                            </button>
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

      {/* ── Modal reporte ── */}
      {modalReporte && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalReporte(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModalReporte(false)}>✕</button>
            <h2 className="modal-title">📊 Reporte de servicios</h2>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Período</label>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {([["semana", "Esta semana"], ["mes", "Mes"], ["custom", "Rango"]] as const).map(([val, label], i, arr) => (
                  <button key={val} onClick={() => setReportePeriodo(val)}
                    style={{ flex: 1, padding: "10px 6px", border: "none", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: reportePeriodo === val ? "rgba(245,158,11,0.15)" : "var(--surface2)", color: reportePeriodo === val ? "var(--accent)" : "var(--text-muted)", fontWeight: reportePeriodo === val ? 700 : 400, fontSize: "0.78rem" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {reportePeriodo === "mes" && (
              <div className="form-group"><label className="form-label">Mes y año</label><input className="form-input" type="month" value={reporteMes} onChange={e => setReporteMes(e.target.value)} /></div>
            )}
            {reportePeriodo === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group"><label className="form-label">Desde</label><input className="form-input" type="date" value={reporteDesde} onChange={e => setReporteDesde(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Hasta</label><input className="form-input" type="date" value={reporteHasta} onChange={e => setReporteHasta(e.target.value)} /></div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Filtrar por técnico</label>
              <select className="form-select" value={reporteFiltroTecnico} onChange={e => setReporteFiltroTecnico(e.target.value)}>
                <option value="todos">Todos los técnicos</option>
                {usuarios.map(u => <option key={u._id} value={u._id}>{u.nombre}</option>)}
              </select>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Solo servicios <strong style={{ color: "var(--text)" }}>cerrados</strong> en el período.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalReporte(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={generarReporteServicios}>📄 Ver reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo servicio ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nuevo servicio</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select className="form-select" value={form.cliente} onChange={e => onClienteChange(e.target.value)}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montacargas *</label>
                {montasSinCliente && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>Este cliente no tiene equipos asignados — mostrando todos</p>}
                {form.cliente && !montasSinCliente && montasFiltradas.length > 0 && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>Mostrando {montasFiltradas.length} equipo{montasFiltradas.length !== 1 ? "s" : ""} de este cliente</p>}
                <select className="form-select" value={form.montacargas} onChange={e => onMontaChange(e.target.value)}>
                  <option value="">Selecciona equipo...</option>
                  {(montasSinCliente ? montas : montasFiltradas).map(m => (
                    <option key={m._id} value={m._id}>{m.numeroEconomico} — {m.marca}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de servicio</label>
                <select className="form-select" value={form.tipoServicio} onChange={e => setForm((p: any) => ({ ...p, tipoServicio: e.target.value }))}>
                  <option value="">Sin tipo</option>
                  {tipos.map(t => <option key={t._id} value={t._id}>{t.nombre}{t.intervaloHrs ? ` (${t.intervaloHrs} hrs)` : ""}</option>)}
                </select>
              </div>
              {canAsignarTecnico && (
                <div className="form-group">
                  <label className="form-label">Técnico asignado</label>
                  <select className="form-select" value={form.tecnicoAsignado} onChange={e => setForm((p: any) => ({ ...p, tecnicoAsignado: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {usuarios.map(u => <option key={u._id} value={u._id}>{u.nombre}</option>)}
                  </select>
                </div>
              )}
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

      {/* ── Modal pausar vista normal — CON DICTADO ── */}
      {pausarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPausarModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={() => setPausarModal(null)}>✕</button>
            <h2 className="modal-title">⏸️ Pausar servicio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>
              <strong style={{ color: "var(--text)" }}>{pausarModal.folio}</strong> — {pausarModal.montacargas?.numeroEconomico} {pausarModal.montacargas?.marca}
            </p>
            <div className="form-group">
              <label className="form-label">Razón de la pausa *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea className="form-textarea" rows={3} value={razonPausa} onChange={e => setRazonPausa(e.target.value)} placeholder="Escribe o usa el micrófono 🎙️..." autoFocus style={{ flex: 1 }} />
                <BtnMic onResult={texto => setRazonPausa(p => p ? p + " " + texto : texto)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPausarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={pausar} disabled={!razonPausa.trim() || pausandoId === pausarModal._id}>
                {pausandoId === pausarModal._id ? "Pausando..." : "⏸️ Confirmar pausa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cerrar vista normal — CON DICTADO Y HORÓMETRO OPCIONAL ── */}
      {cerrarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCerrarModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setCerrarModal(null)}>✕</button>
            <h2 className="modal-title">Cerrar servicio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 8 }}>
              <strong style={{ color: "var(--text)" }}>{cerrarModal.folio}</strong> — {cerrarModal.montacargas?.numeroEconomico} {cerrarModal.montacargas?.marca}
            </p>
            {cerrarModal.horaInicio && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 12 }}>
                ⏱️ Tiempo activo: <Cronometro horaInicio={cerrarModal.horaInicio} pausas={cerrarModal.pausas} />
              </p>
            )}
            {cerrarModal.pausas && cerrarModal.pausas.length > 0 && (
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 12 }}>
                ⏸️ {cerrarModal.pausas.length} pausa{cerrarModal.pausas.length > 1 ? "s" : ""} registrada{cerrarModal.pausas.length > 1 ? "s" : ""}
              </div>
            )}
            {cerrarModal.ordenRefaccion && cerrarModal.ordenRefaccion.estatus !== "surtida" && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--red)", fontSize: "0.82rem", color: "var(--red)", marginBottom: 12 }}>
                ⚠️ La orden <strong>{cerrarModal.ordenRefaccion.folio}</strong> aún no está surtida completamente.
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Horómetro al cierre
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>(dejar en 0 si no aplica)</span>
                </label>
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
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <textarea className="form-textarea" value={cerrarForm.notasCierre} onChange={e => setCerrarForm((p: any) => ({ ...p, notasCierre: e.target.value }))} placeholder="Escribe o usa el micrófono 🎙️..." rows={3} style={{ flex: 1 }} />
                  <BtnMic onResult={texto => setCerrarForm((p: any) => ({ ...p, notasCierre: p.notasCierre ? p.notasCierre + " " + texto : texto }))} />
                </div>
              </div>
              <div className="form-group"><FotoUpload label="📋 Foto de hoja firmada" fotoKey="fotoHojaFirmada" tipo="hoja" /></div>
              <div className="form-group"><FotoUpload label="📸 Foto del equipo finalizado" fotoKey="fotoEquipoFinal" tipo="equipo" /></div>
              <div className="form-group"><FotoUpload label="🔩 Foto de refacciones utilizadas" fotoKey="fotoRefacciones" tipo="refacciones" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCerrarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={cerrar} disabled={saving}>{saving ? "Cerrando..." : "Cerrar servicio"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </>
  );
}