import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { generarReporte, descargarPDF } from "../utils/generarReporte";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

const CATEGORIAS = ["Motor", "Transmisión", "Hidráulico", "Eléctrico", "Frenos", "Filtros", "Aceites", "Llantas", "Carrocería", "General"];
const MARCAS_COMPATIBLES = ["CAT", "Yale", "Crown", "Toyota", "Hyster", "Mitsubishi", "Nissan", "Komatsu", "Universal"];

type Refaccion = {
  _id: string; nombre: string; numeroParte?: string; categoria?: string;
  proveedor?: string; marcaCompatible?: string;
  unidad: string; stock: number; stockMinimo: number; precio: number; activo: boolean;
};

type OrdenItem = {
  refaccion: { _id: string; nombre: string; numeroParte?: string; unidad: string; stock: number };
  cantidadSolicitada: number; cantidadSurtida: number; confirmado: boolean;
};

type Orden = {
  _id: string; folio: string;
  servicio?: { _id: string; folio: string; problema: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string };
  items: OrdenItem[];
  estatus: "pendiente" | "surtida" | "parcial" | "cancelada";
  notas?: string; surtidoPor?: { nombre: string };
  fechaSurtido?: string; createdAt: string;
  fotosEvidencia?: string[];
};

type TipoServicioItem = { nombre: string; cantidad: number };
type TipoServicio = {
  _id: string; nombre: string; descripcion?: string;
  intervaloHrs?: number; refacciones: TipoServicioItem[];
  itemsChecklist: string[]; precioTotal: number; activo: boolean;
};

type RefaccionUsada = {
  _id: string; descripcion: string; numeroParte?: string; condicion: string;
  fotos: string[]; notas?: string;
  servicio?: { _id: string; folio: string; problema: string };
  registradoPor?: { nombre: string }; createdAt: string;
};

type Usuario = { _id: string; nombre: string; rol: string };

type ValeItem = { refaccion: string; nombre: string; numeroParte?: string; unidad: string; cantidad: number };
type Vale = {
  _id: string; folio: string;
  tecnico: { _id: string; nombre: string; rol: string };
  registradoPor?: { nombre: string };
  items: ValeItem[];
  notas?: string;
  createdAt: string;
};

type SolicitudItem = {
  nombre: string; cantidad: number; unidad: string;
  precioUnitario: number;
  precioEstimado: number; notas: string;
};

type SolicitudCotizacion = {
  _id: string; folio: string; tipo: string; tipoPeriodo?: string;
  cliente?: { _id?: string; nombre: string; direccion?: string; telefono?: string; contacto?: string };
  clienteOcasional?: { nombre: string; direccion?: string; telefono?: string; contacto?: string };
  montacargas?: {
    _id?: string; numeroEconomico: string; marca: string; modelo: string;
    capacidad?: string; serie?: string; alturaColapsada?: string; alturaLevante?: string;
    horquillas?: string; desplazadorLateral?: boolean; tipoLlantas?: string;
    voltaje?: string; tipoBateria?: string; incluyeCargador?: boolean;
    equipoSeguridad?: { alarmaReversa?: boolean; torretaAmbar?: boolean; luces?: boolean; extintor?: boolean };
  };
  asesor?: { _id?: string; nombre: string; puesto: string; telefono: string; email: string };
  total: number; subtotal: number; iva: number; estatus: string;
  items: { descripcion: string; total: number; cantidad: number; precioUnitario: number; imagen?: string; subconceptos?: { descripcion: string; precio: number }[] }[];
  fecha: string; lugar?: string; descripcionServicio?: string;
  condiciones?: string; notas?: string;
  equipoMarca?: string; equipoModelo?: string; equipoSerie?: string;
  numeroFactura?: string;
};

type Solicitud = {
  _id: string; folio: string;
  solicitadoPor: { nombre: string; rol: string };
  liberadaPor?: { nombre: string };
  cotizacion?: SolicitudCotizacion;
  items: SolicitudItem[];
  notas?: string;
  moneda?: "MXN" | "USD"; // ── NUEVO ──
  estatus: "sin_liberar" | "liberada" | "cancelada";
  fechaLiberacion?: string;
  createdAt: string;
};

const emptyRefaccion = {
  nombre: "", numeroParte: "", categoria: "", proveedor: "", marcaCompatible: "",
  unidad: "pieza", stock: 0, stockMinimo: 1, precio: 0,
};
const emptyTipo = { nombre: "", descripcion: "", intervaloHrs: "", itemsChecklist: [] as string[], precioTotal: 0, refacciones: [] as { nombre: string; cantidad: number }[] };
const emptyUsada = { descripcion: "", numeroParte: "", condicion: "desgastada", servicio: "", notas: "", fotos: [] as string[] };

const ESTATUS_BADGE: Record<string, string> = {
  pendiente: "badge-amber", surtida: "badge-green", parcial: "badge-blue", cancelada: "badge-gray",
};
const CONDICION_BADGE: Record<string, string> = {
  desgastada: "badge-amber", rota: "badge-red", quemada: "badge-red",
  corroida: "badge-gray", otro: "badge-blue",
};

const emptySolicitudItem = (): SolicitudItem => ({
  nombre: "", cantidad: 1, unidad: "pieza", precioUnitario: 0, precioEstimado: 0, notas: ""
});

function EscanerModal({ onScanned, onClose }: { onScanned: (codigo: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(true);
  const yaEscaneado = useRef(false);
  const detener = useCallback(() => { readerRef.current?.reset(); }, []);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    reader.decodeFromConstraints(
      { video: { facingMode: "environment" } },
      videoRef.current!,
      (result, err) => {
        if (result && !yaEscaneado.current) {
          yaEscaneado.current = true;
          setEscaneando(false);
          detener();
          onScanned(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) setError("No se pudo acceder a la cámara");
      }
    ).catch(() => setError("No se pudo acceder a la cámara"));
    return () => { detener(); };
  }, [detener, onScanned]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { detener(); onClose(); } }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <button className="modal-close" onClick={() => { detener(); onClose(); }}>✕</button>
        <h2 className="modal-title">📷 Escanear código de barras</h2>
        {error ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--red)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚠️</div>
            <p>{error}</p>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Verifica que el navegador tenga permiso de cámara</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 12 }}>Apunta la cámara al código de barras de la caja</p>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {escaneando && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "70%", height: 2, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)", animation: "scanLine 1.5s ease-in-out infinite alternate" }} />
              )}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: 10 }}>Detecta códigos QR, Code128, EAN, UPC y más</p>
          </>
        )}
        <style>{`@keyframes scanLine { from { top: 30%; } to { top: 70%; } }`}</style>
      </div>
    </div>
  );
}

async function imprimirValeTermico(vale: Vale) {
  const qz = (window as any).qz;
  if (!qz) { alert("QZ Tray no está instalado o no está corriendo"); return; }
  try {
    qz.security.setCertificatePromise((resolve: any) => resolve(""));
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise((_toSign: any) => (resolve: any) => resolve(""));
    await qz.websocket.connect();
    const config = qz.configs.create("GHIA GTP801");
    const fecha = new Date(vale.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const LINE = "--------------------------------\n";
    const BR   = "\n";
    const fila = (izq: string, der: string) => izq.substring(0, 22).padEnd(22) + der.substring(0, 10).padStart(10) + "\n";
    let d = "";
    d += "\x1B\x40"; d += "\x1B\x61\x01"; d += "\x1B\x21\x30"; d += "PIPSA\n";
    d += "\x1B\x21\x00"; d += "Montacargas de Guadalajara\n"; d += BR;
    d += "\x1B\x21\x08"; d += "VALE DE SALIDA DE MATERIAL\n"; d += "\x1B\x21\x00"; d += LINE;
    d += "\x1B\x61\x01"; d += "\x1B\x21\x10"; d += `${vale.folio}\n`; d += "\x1B\x21\x00"; d += BR;
    d += "\x1B\x61\x00";
    d += `Tecnico : ${vale.tecnico.nombre}\n`;
    d += `Fecha   : ${fecha}\n`;
    d += `Reg. por: ${vale.registradoPor?.nombre ?? "—"}\n`;
    if (vale.notas) { d += BR; d += `Notas: ${vale.notas}\n`; }
    d += LINE; d += "\x1B\x21\x08"; d += fila("DESCRIPCION", "CANT/UND"); d += "\x1B\x21\x00"; d += LINE;
    for (const item of vale.items) {
      const cant = `${item.cantidad} ${item.unidad}`;
      if (item.nombre.length <= 22) { d += fila(item.nombre, cant); }
      else { d += item.nombre.substring(0, 32) + "\n"; d += fila("", cant); }
      if (item.numeroParte) { d += `  Parte: ${item.numeroParte}\n`; }
    }
    d += LINE; d += BR; d += "\x1B\x61\x01"; d += "Firma de recibido\n";
    d += BR; d += BR; d += BR;
    d += "________________________________\n"; d += `${vale.tecnico.nombre}\n`; d += BR; d += BR;
    d += "\x1D\x56\x42\x00";
    await qz.print(config, [{ type: "raw", format: "plain", data: d, options: { language: "ESCPOS" } }]);
    await qz.websocket.disconnect();
  } catch (err: any) {
    console.error("Error imprimiendo vale:", err);
    alert("Error al imprimir: " + (err?.message ?? err));
  }
}

function SearchableCotizacion({
  value, onChange, options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: SolicitudCotizacion[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const selected          = options.find(c => c._id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(c =>
    c.folio.toLowerCase().includes(query.toLowerCase()) ||
    (c.cliente?.nombre ?? c.clienteOcasional?.nombre ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function getLabel(c: SolicitudCotizacion) {
    const cliente = c.cliente?.nombre ?? c.clienteOcasional?.nombre ?? "Sin cliente";
    return `${c.folio} — ${cliente} (${c.tipo}) — $${c.total.toLocaleString()}`;
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          className="form-input"
          value={open ? query : (selected ? getLabel(selected) : "")}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          placeholder="Buscar por folio o cliente..."
        />
        {value && (
          <button
            onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem" }}
          >✕</button>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.85rem" }}>Sin resultados</div>
          ) : filtered.map(c => (
            <div key={c._id} onClick={() => { onChange(c._id); setOpen(false); setQuery(""); }}
              style={{ padding: "10px 14px", cursor: "pointer", fontSize: "0.85rem", background: c._id === value ? "rgba(245,158,11,0.1)" : "transparent", color: c._id === value ? "var(--accent)" : "var(--text)", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = c._id === value ? "rgba(245,158,11,0.1)" : "transparent")}>
              <span style={{ fontWeight: 700, color: "var(--blue)", marginRight: 6 }}>{c.folio}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                {c.cliente?.nombre ?? c.clienteOcasional?.nombre ?? "Sin cliente"} · {c.tipo} · ${c.total.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValeSearchable({
  refacciones, onAdd,
}: {
  refacciones: Refaccion[];
  onAdd: (r: Refaccion) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtradas = refacciones
    .filter(r => r.stock > 0)
    .filter(r =>
      r.nombre.toLowerCase().includes(query.toLowerCase()) ||
      (r.numeroParte ?? "").toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 Buscar refacción por nombre o número de parte..."
      />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.85rem" }}>Sin resultados</div>
          ) : filtradas.map(r => (
            <div key={r._id}
              onClick={() => { onAdd(r); setQuery(""); setOpen(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--border)", color: "var(--text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontWeight: 600 }}>{r.nombre}</span>
              {r.numeroParte && <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: "0.78rem" }}>({r.numeroParte})</span>}
              <span style={{ color: r.stock <= r.stockMinimo ? "var(--red)" : "var(--green)", marginLeft: 8, fontSize: "0.78rem", fontWeight: 700 }}>Stock: {r.stock}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Almacen() {
  const rol         = localStorage.getItem("rol") ?? "";
  const userId      = localStorage.getItem("userId") ?? "";
  const canEdit     = ["developer", "gerencia"].includes(rol);
  const canAddRefac = ["developer", "gerencia", "almacen", "supervisor_almacen"].includes(rol);
  const canSurtir   = ["developer", "gerencia", "oficina", "almacen", "supervisor_almacen"].includes(rol);
  const canUsadas   = ["developer", "gerencia", "almacen", "tecnico", "supervisor_almacen"].includes(rol);
  const canVerSolicitudes = ["developer", "gerencia", "oficina", "almacen", "supervisor_almacen"].includes(rol);
  const canLiberar        = ["developer", "gerencia"].includes(rol);
  const canVerSinLiberar  = ["developer", "gerencia"].includes(rol);
  const esGerencia        = ["developer", "gerencia"].includes(rol);

  const [tab, setTab] = useState<"inventario" | "ordenes" | "tipos" | "usadas" | "vales" | "solicitudes">("inventario");
  const [refacciones, setRefacciones] = useState<Refaccion[]>([]);
  const [ordenes, setOrdenes]         = useState<Orden[]>([]);
  const [tipos, setTipos]             = useState<TipoServicio[]>([]);
  const [usadas, setUsadas]           = useState<RefaccionUsada[]>([]);
  const [servicios, setServicios]     = useState<{ _id: string; folio: string; problema?: string }[]>([]);
  const [tecnicos, setTecnicos]       = useState<Usuario[]>([]);
  const [vales, setVales]             = useState<Vale[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cotizacionesDisp, setCotizacionesDisp] = useState<SolicitudCotizacion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const [modal, setModal]           = useState(false);
  const [stockModal, setStockModal] = useState<Refaccion | null>(null);
  const [editing, setEditing]       = useState<Refaccion | null>(null);
  const [form, setForm]             = useState<any>(emptyRefaccion);
  const [stockForm, setStockForm]   = useState<{ tipo: string; cantidad: number; tecnicoId: string; notas: string }>({ tipo: "entrada", cantidad: 1, tecnicoId: "", notas: "" });

  const [escanerModal, setEscanerModal] = useState(false);

  const [valeModal, setValeModal]     = useState(false);
  const [valeItems, setValeItems]     = useState<{ refaccionId: string; nombre: string; cantidad: number; unidad: string }[]>([]);
  const [valeTecnico, setValeTecnico] = useState("");
  const [valeNotas, setValeNotas]     = useState("");

  const [surtirModal, setSurtirModal]   = useState<Orden | null>(null);
  const [surtirItems, setSurtirItems]   = useState<any[]>([]);
  const [surtirNotas, setSurtirNotas]   = useState("");
  const [fotosEvidencia, setFotosEvidencia]         = useState<string[]>([]);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);

  const [tipoModal, setTipoModal]     = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoServicio | null>(null);
  const [tipoForm, setTipoForm]       = useState<any>(emptyTipo);
  const [nuevoCheckItem, setNuevoCheckItem] = useState("");

  const [usadaModal, setUsadaModal] = useState(false);
  const [usadaForm, setUsadaForm]   = useState<any>(emptyUsada);
  const [uploadingUsada, setUploadingUsada] = useState(false);

  const [solicitudModal, setSolicitudModal]   = useState(false);
  const [solicitudItems, setSolicitudItems]   = useState<SolicitudItem[]>([emptySolicitudItem()]);
  const [solicitudNotas, setSolicitudNotas]   = useState("");
  const [solicitudCotizId, setSolicitudCotizId] = useState("");
  const [solicitudMoneda, setSolicitudMoneda] = useState<"MXN" | "USD">("MXN"); // ── NUEVO ──
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [verCotizacion, setVerCotizacion]     = useState<SolicitudCotizacion | null>(null);

  const [saving, setSaving] = useState(false);

  const evidenciaRef = useRef<HTMLInputElement>(null);
  const usadaFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, o, t, u, s, v, cots] = await Promise.all([
        api.get("/refacciones"),
        api.get("/ordenes-refaccion"),
        api.get("/tipos-servicio"),
        api.get("/refacciones-usadas"),
        api.get("/servicios"),
        api.get("/vales-salida"),
        api.get("/cotizaciones").catch(() => ({ data: [] })),
      ]);
      setRefacciones(r.data);
      setOrdenes(o.data);
      setTipos(t.data);
      setUsadas(u.data);
      setServicios(s.data.map((sv: any) => ({ _id: sv._id, folio: sv.folio, problema: sv.problema })));
      setVales(v.data);

      let asesorDelUsuario: string | null = null;
      if (!esGerencia) {
        try {
          const { data: todosAsesores } = await api.get("/asesores");
          const miAsesor = todosAsesores.find(
            (a: any) => a.usuario?._id === userId || a.usuario === userId
          );
          if (miAsesor) asesorDelUsuario = miAsesor._id;
        } catch {}
      }

      setCotizacionesDisp(
        cots.data.filter((c: any) => {
          if (c.estatus === "cancelada") return false;
          if (!["servicio", "refacciones"].includes(c.tipo)) return false;
          if (esGerencia) return true;
          if (asesorDelUsuario && c.asesor?._id === asesorDelUsuario) return true;
          return false;
        })
      );
    } catch (e) {
      console.error("Error cargando almacén:", e);
    }

    try {
      const { data } = await api.get("/users");
      setTecnicos(data.filter((u: any) => ["tecnico", "almacen", "developer", "gerencia", "oficina"].includes(u.rol)));
    } catch {
      setTecnicos([]);
    }

    if (canVerSolicitudes) {
      try {
        const { data } = await api.get("/solicitudes-compra");
        setSolicitudes(data);
      } catch {
        setSolicitudes([]);
      }
    }

    setLoading(false);
  }

  const handleScanned = useCallback((codigo: string) => {
    setEscanerModal(false);
    const encontrada = refacciones.find(r =>
      r.numeroParte && r.numeroParte.trim().toLowerCase() === codigo.trim().toLowerCase()
    );
    if (encontrada) {
      setStockModal(encontrada);
      setStockForm({ tipo: "entrada", cantidad: 1, tecnicoId: "", notas: "" });
    } else {
      setEditing(null);
      setForm({ ...emptyRefaccion, numeroParte: codigo });
      setModal(true);
    }
  }, [refacciones]);

  function openNew() { setEditing(null); setForm(emptyRefaccion); setModal(true); }
  function openEdit(r: Refaccion) {
    setEditing(r);
    setForm({
      nombre: r.nombre, numeroParte: r.numeroParte ?? "", categoria: r.categoria ?? "",
      proveedor: r.proveedor ?? "", marcaCompatible: r.marcaCompatible ?? "",
      unidad: r.unidad, stock: r.stock, stockMinimo: r.stockMinimo, precio: r.precio,
    });
    setModal(true);
  }

  async function saveRefaccion() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/refacciones/${editing._id}`, form);
        setRefacciones(prev => prev.map(r => r._id === editing._id ? data : r));
      } else {
        const { data } = await api.post("/refacciones", form);
        setRefacciones(prev => [data, ...prev]);
      }
      setModal(false);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        alert("Ya existe una refacción con ese número de parte");
      }
    }
    finally { setSaving(false); }
  }

  async function ajustarStock() {
    if (!stockModal) return;
    if (stockForm.tipo === "salida") {
      if (!stockForm.tecnicoId) { alert("Selecciona el técnico que solicita el material"); return; }
      setSaving(true);
      try {
        const { data } = await api.post("/vales-salida", {
          tecnicoId: stockForm.tecnicoId,
          notas: stockForm.notas || undefined,
          items: [{ refaccionId: stockModal._id, nombre: stockModal.nombre, cantidad: stockForm.cantidad }],
        });
        setVales(prev => [data, ...prev]);
        setRefacciones(prev => prev.map(r => r._id === stockModal._id ? { ...r, stock: Math.max(0, r.stock - stockForm.cantidad) } : r));
        setStockModal(null);
      } catch {}
      finally { setSaving(false); }
    } else {
      setSaving(true);
      try {
        const { data } = await api.post(`/refacciones/${stockModal._id}/stock`, { tipo: stockForm.tipo, cantidad: stockForm.cantidad });
        setRefacciones(prev => prev.map(r => r._id === data._id ? data : r));
        setStockModal(null);
      } catch {}
      finally { setSaving(false); }
    }
  }

  function openValeManual() { setValeItems([]); setValeTecnico(""); setValeNotas(""); setValeModal(true); }
  function addValeItem(r: Refaccion) {
    setValeItems(prev => {
      const existe = prev.find(i => i.refaccionId === r._id);
      if (existe) return prev.map(i => i.refaccionId === r._id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { refaccionId: r._id, nombre: r.nombre, cantidad: 1, unidad: r.unidad }];
    });
  }
  async function guardarValeManual() {
    if (!valeTecnico || !valeItems.length) return;
    setSaving(true);
    try {
      const { data } = await api.post("/vales-salida", {
        tecnicoId: valeTecnico, notas: valeNotas || undefined, items: valeItems,
      });
      setVales(prev => [data, ...prev]);
      setRefacciones(prev => prev.map(r => {
        const item = valeItems.find(i => i.refaccionId === r._id);
        if (!item) return r;
        return { ...r, stock: Math.max(0, r.stock - item.cantidad) };
      }));
      setValeModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function removeRefaccion(r: Refaccion) {
    if (!confirm(`¿Eliminar ${r.nombre}?`)) return;
    await api.delete(`/refacciones/${r._id}`);
    setRefacciones(prev => prev.filter(x => x._id !== r._id));
  }

  function openSurtir(o: Orden) {
    setSurtirModal(o);
    setSurtirItems(o.items.map(i => ({ refaccionId: i.refaccion._id, cantidadSurtida: i.cantidadSolicitada })));
    setSurtirNotas(""); setFotosEvidencia([]);
  }
  async function subirEvidencia(file: File) {
    setUploadingEvidencia(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("upload_preset", UPLOAD_PRESET);
    try {
      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
      const data = await res.json();
      setFotosEvidencia(prev => [...prev, data.secure_url]);
    } catch { alert("Error al subir imagen"); }
    finally { setUploadingEvidencia(false); }
  }
  async function surtirOrden() {
    if (!surtirModal) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/ordenes-refaccion/${surtirModal._id}/surtir`, { items: surtirItems, notas: surtirNotas, fotosEvidencia });
      setOrdenes(prev => prev.map(o => o._id === data._id ? data : o));
      setSurtirModal(null); load();
    } catch {}
    finally { setSaving(false); }
  }

  function openNewTipo() { setEditingTipo(null); setTipoForm({ ...emptyTipo, itemsChecklist: [], refacciones: [] }); setNuevoCheckItem(""); setTipoModal(true); }
  function openEditTipo(t: TipoServicio) {
    setEditingTipo(t);
    setTipoForm({ nombre: t.nombre, descripcion: t.descripcion ?? "", intervaloHrs: t.intervaloHrs ?? "", itemsChecklist: [...(t.itemsChecklist ?? [])], precioTotal: t.precioTotal ?? 0, refacciones: t.refacciones.map(r => ({ nombre: r.nombre ?? "", cantidad: r.cantidad })) });
    setNuevoCheckItem(""); setTipoModal(true);
  }
  function addCheckItem() { if (!nuevoCheckItem.trim()) return; setTipoForm((p: any) => ({ ...p, itemsChecklist: [...p.itemsChecklist, nuevoCheckItem.trim()] })); setNuevoCheckItem(""); }
  function removeCheckItem(i: number) { setTipoForm((p: any) => ({ ...p, itemsChecklist: p.itemsChecklist.filter((_: any, idx: number) => idx !== i) })); }
  function addRefaccionTipo() { setTipoForm((p: any) => ({ ...p, refacciones: [...p.refacciones, { nombre: "", cantidad: 1 }] })); }
  function removeRefaccionTipo(i: number) { setTipoForm((p: any) => ({ ...p, refacciones: p.refacciones.filter((_: any, idx: number) => idx !== i) })); }
  function updateRefaccionTipo(i: number, field: string, val: any) { setTipoForm((p: any) => { const refs = [...p.refacciones]; refs[i] = { ...refs[i], [field]: val }; return { ...p, refacciones: refs }; }); }
  async function saveTipo() {
    if (!tipoForm.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = { nombre: tipoForm.nombre, descripcion: tipoForm.descripcion || null, intervaloHrs: tipoForm.intervaloHrs ? +tipoForm.intervaloHrs : null, itemsChecklist: tipoForm.itemsChecklist, precioTotal: +tipoForm.precioTotal || 0, refacciones: tipoForm.refacciones.filter((r: any) => r.nombre?.trim()) };
      if (editingTipo) { const { data } = await api.put(`/tipos-servicio/${editingTipo._id}`, payload); setTipos(prev => prev.map(t => t._id === editingTipo._id ? data : t)); }
      else { const { data } = await api.post("/tipos-servicio", payload); setTipos(prev => [data, ...prev]); }
      setTipoModal(false);
    } catch {}
    finally { setSaving(false); }
  }
  async function removeTipo(t: TipoServicio) { if (!confirm(`¿Eliminar tipo "${t.nombre}"?`)) return; await api.delete(`/tipos-servicio/${t._id}`); setTipos(prev => prev.filter(x => x._id !== t._id)); }

  function openNuevaUsada() { setUsadaForm(emptyUsada); setUsadaModal(true); }
  async function subirFotoUsada(file: File) {
    setUploadingUsada(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("upload_preset", UPLOAD_PRESET);
    try { const res = await fetch(CLOUDINARY_URL, { method: "POST", body: fd }); const data = await res.json(); setUsadaForm((p: any) => ({ ...p, fotos: [...p.fotos, data.secure_url] })); }
    catch { alert("Error al subir imagen"); }
    finally { setUploadingUsada(false); }
  }
  async function saveUsada() {
    if (!usadaForm.descripcion.trim()) return;
    setSaving(true);
    try {
      const payload = { ...usadaForm };
      if (!payload.servicio) delete payload.servicio;
      const { data } = await api.post("/refacciones-usadas", payload);
      setUsadas(prev => [data, ...prev]); setUsadaModal(false);
    } catch {}
    finally { setSaving(false); }
  }
  async function removeUsada(id: string) { if (!confirm("¿Eliminar este registro?")) return; await api.delete(`/refacciones-usadas/${id}`); setUsadas(prev => prev.filter(x => x._id !== id)); }

  function addSolicitudItem() { setSolicitudItems(p => [...p, emptySolicitudItem()]); }
  function removeSolicitudItem(i: number) { setSolicitudItems(p => p.filter((_, idx) => idx !== i)); }
  function updateSolicitudItem(i: number, field: string, val: any) {
    setSolicitudItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === "cantidad" || field === "precioUnitario") {
        updated.precioEstimado = updated.cantidad * updated.precioUnitario;
      }
      return updated;
    }));
  }

  // ── NUEVO: generar reporte de solicitud ──
  function generarReporteSolicitud(s: Solicitud) {
    const logoUrl = "https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png";
    const fecha   = new Date(s.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const mon     = s.moneda ?? "MXN";
    const simb    = mon === "USD" ? "USD $" : "$";
    const total   = s.items.reduce((sum, i) => sum + (i.precioEstimado ?? 0), 0);

    const itemsHtml = s.items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"}">
        <td style="padding:8px 12px;border:1px solid #ddd;font-weight:600">${item.nombre}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${item.cantidad}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${item.unidad}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${item.precioUnitario ? simb + item.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:700;color:#16a34a">${item.precioEstimado ? simb + item.precioEstimado.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-size:9pt">${item.notas || "—"}</td>
      </tr>
    `).join("");

    const cotHtml = s.cotizacion ? `
      <div style="background:#f0f7ff;border:1px solid #bbd6f5;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:10pt">
        <strong style="color:#1d4ed8">Cotización relacionada:</strong>
        ${s.cotizacion.folio} — ${s.cotizacion.cliente?.nombre ?? s.cotizacion.clienteOcasional?.nombre ?? "Sin cliente"}
        <span style="margin-left:12px;color:#555">${s.cotizacion.tipo}</span>
        <span style="margin-left:12px;font-weight:700;color:#f59e0b">$${s.cotizacion.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
      </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${s.folio}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:11pt;color:#222;padding:32px;max-width:820px;margin:auto; }
  .header { display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px; }
  .header-left { display:flex;align-items:center;gap:14px; }
  .logo { width:65px;height:65px;object-fit:contain;background:#000;border-radius:6px; }
  .company { font-size:11pt;font-weight:700;max-width:320px;line-height:1.4; }
  .header-right { text-align:right;font-size:9.5pt;line-height:1.8; }
  .title-box { background:#222;color:#fff;padding:10px 16px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px; }
  .title-box h1 { font-size:13pt;font-weight:900;letter-spacing:1px; }
  .meta { display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px; }
  .meta-item { background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:8px 12px; }
  .meta-label { font-size:8pt;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:2px; }
  .meta-value { font-size:10.5pt;font-weight:600;color:#222; }
  .moneda-badge { display:inline-block;background:${mon === "USD" ? "#1d4ed8" : "#15803d"};color:#fff;border-radius:6px;padding:3px 10px;font-size:9pt;font-weight:700;margin-left:8px; }
  .estatus-badge { display:inline-block;padding:3px 12px;border-radius:20px;font-size:9pt;font-weight:700;margin-left:8px; }
  table { width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt; }
  thead { background:#222;color:#fff; }
  thead th { padding:8px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.06em; }
  thead th:nth-child(2),thead th:nth-child(3) { text-align:center; }
  thead th:nth-child(4),thead th:nth-child(5) { text-align:right; }
  .total-row { display:flex;justify-content:flex-end;gap:40px;padding:10px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:11pt;font-weight:700; }
  .total-val { color:#16a34a; }
  .notas-box { background:#fffbeb;border:1px solid #f0d060;border-radius:4px;padding:10px 14px;font-size:10pt;margin-top:12px; }
  .firma-grid { display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px; }
  .firma-box { text-align:center; }
  .firma-line { border-top:1.5px solid #222;padding-top:6px;font-size:9.5pt;font-weight:700;text-transform:uppercase; }
  .footer { margin-top:32px;border-top:1px solid #ccc;padding-top:12px;font-size:9pt;color:#888;text-align:center; }
  .print-btn { position:fixed;top:16px;right:16px;padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-size:11pt;font-weight:700;cursor:pointer; }
  @media print { .print-btn { display:none; } body { padding:16px; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="header">
  <div class="header-left">
    <img src="${logoUrl}" class="logo" alt="Pipsa" />
    <div class="company">Equipos Industriales y Montacargas de Guadalajara S de RL de CV</div>
  </div>
  <div class="header-right">
    <strong>Zapopán, Jal.; ${fecha}</strong><br>
    Bahías de Huatulco No. 99-A, Col. Agua Blanca Industrial<br>
    45235, Zapopán, Jal.<br>
    www.pipsamontacargas.com
  </div>
</div>

<div class="title-box">
  <h1>SOLICITUD DE COMPRA</h1>
  <div>
    <span style="color:#f59e0b;font-weight:700;font-size:11pt">${s.folio}</span>
    <span class="moneda-badge">${mon === "USD" ? "💵 USD" : "🇲🇽 MXN"}</span>
    <span class="estatus-badge" style="${s.estatus === "sin_liberar" ? "background:rgba(245,158,11,0.2);color:#b45309" : s.estatus === "liberada" ? "background:rgba(34,197,94,0.2);color:#15803d" : "background:rgba(107,114,128,0.2);color:#374151"}">
      ${s.estatus === "sin_liberar" ? "Sin liberar" : s.estatus === "liberada" ? "✅ Liberada" : "❌ Cancelada"}
    </span>
  </div>
</div>

<div class="meta">
  <div class="meta-item">
    <div class="meta-label">Solicitado por</div>
    <div class="meta-value">${s.solicitadoPor?.nombre ?? "—"}</div>
  </div>
  <div class="meta-item">
    <div class="meta-label">Fecha</div>
    <div class="meta-value">${fecha}</div>
  </div>
  <div class="meta-item">
    <div class="meta-label">Liberado por</div>
    <div class="meta-value">${s.liberadaPor?.nombre ?? "Pendiente"}</div>
  </div>
</div>

${cotHtml}

<table>
  <thead>
    <tr>
      <th>Artículo</th>
      <th style="width:60px">Cant.</th>
      <th style="width:80px">Unidad</th>
      <th style="width:120px">Precio u.</th>
      <th style="width:130px">Total est.</th>
      <th>Notas / Proveedor</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

${total > 0 ? `
<div class="total-row">
  <span>Total estimado:</span>
  <span class="total-val">${simb}${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
</div>` : ""}

${s.notas ? `
<div class="notas-box">
  <strong>📝 Notas generales:</strong><br>
  <span style="white-space:pre-wrap">${s.notas}</span>
</div>` : ""}

<div class="firma-grid">
  <div class="firma-box"><div class="firma-line">Solicitado por: ${s.solicitadoPor?.nombre ?? "_______________"}</div></div>
  <div class="firma-box"><div class="firma-line">Autorizado por: ${s.liberadaPor?.nombre ?? "_______________"}</div></div>
</div>

<div class="footer">
  Control Pipsa — Equipos Industriales y Montacargas de Guadalajara · Documento generado automáticamente
</div>
<script>window.onload = function() { document.title = '${s.folio}'; };</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function guardarSolicitud() {
    if (!solicitudItems.some(i => i.nombre.trim())) return;
    setSavingSolicitud(true);
    try {
      const { data } = await api.post("/solicitudes-compra", {
        items: solicitudItems.filter(i => i.nombre.trim()),
        notas: solicitudNotas,
        cotizacionId: solicitudCotizId || undefined,
        moneda: solicitudMoneda, // ── NUEVO ──
      });
      setSolicitudes(prev => [data, ...prev]);
      setSolicitudModal(false);
      setSolicitudItems([emptySolicitudItem()]);
      setSolicitudNotas("");
      setSolicitudCotizId("");
      setSolicitudMoneda("MXN");
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSavingSolicitud(false); }
  }

  async function liberarSolicitud(id: string) {
    try {
      const { data } = await api.post(`/solicitudes-compra/${id}/liberar`);
      setSolicitudes(prev => prev.map(s => s._id === id ? data : s));
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
  }
  async function cancelarSolicitud(id: string) {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    try {
      const { data } = await api.post(`/solicitudes-compra/${id}/cancelar`);
      setSolicitudes(prev => prev.map(s => s._id === id ? data : s));
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
  }

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtHora(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  const filteredRef    = refacciones.filter(r => r.nombre.toLowerCase().includes(search.toLowerCase()) || (r.numeroParte ?? "").toLowerCase().includes(search.toLowerCase()) || (r.categoria ?? "").toLowerCase().includes(search.toLowerCase()) || (r.proveedor ?? "").toLowerCase().includes(search.toLowerCase()) || (r.marcaCompatible ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredOrd    = ordenes.filter(o => o.folio.toLowerCase().includes(search.toLowerCase()) || (o.servicio?.folio ?? "").toLowerCase().includes(search.toLowerCase()) || (o.montacargas?.numeroEconomico ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredTipos  = tipos.filter(t => t.nombre.toLowerCase().includes(search.toLowerCase()) || (t.descripcion ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredUsadas = usadas.filter(u => u.descripcion.toLowerCase().includes(search.toLowerCase()) || (u.servicio?.folio ?? "").toLowerCase().includes(search.toLowerCase()) || (u.numeroParte ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredVales  = vales.filter(v => v.folio.toLowerCase().includes(search.toLowerCase()) || v.tecnico.nombre.toLowerCase().includes(search.toLowerCase()));
  const filteredSols   = solicitudes.filter(s =>
    s.folio.toLowerCase().includes(search.toLowerCase()) ||
    s.solicitadoPor?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.items.some(i => i.nombre.toLowerCase().includes(search.toLowerCase())) ||
    (s.cotizacion?.folio ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stockBajo         = refacciones.filter(r => r.stock <= r.stockMinimo).length;
  const ordenesPendientes = ordenes.filter(o => o.estatus === "pendiente").length;
  const solsPendientes    = solicitudes.filter(s => s.estatus === "sin_liberar").length;

  const tabStyle = (t: string) => ({
    padding: "8px 20px", borderRadius: "var(--radius-sm)", border: "1.5px solid", cursor: "pointer",
    borderColor: tab === t ? "var(--accent)" : "var(--border)",
    background: tab === t ? "rgba(255,180,0,0.1)" : "var(--surface2)",
    color: tab === t ? "var(--accent)" : "var(--text-muted)",
    fontWeight: tab === t ? 700 : 400, fontSize: "0.88rem",
  });

  const cotizSeleccionada = cotizacionesDisp.find(c => c._id === solicitudCotizId);
  const totalSolicitud = solicitudItems.reduce((sum, i) => sum + i.precioEstimado, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Almacén</h1>
          <p className="page-subtitle">{refacciones.length} refacciones en inventario</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canAddRefac && tab === "inventario" && (
            <>
              <button className="btn btn-secondary" onClick={() => setEscanerModal(true)}>📷 Escanear</button>
              <button className="btn btn-secondary" onClick={openValeManual}>📤 Vale de salida</button>
              <button className="btn btn-primary" onClick={openNew}>+ Nueva refacción</button>
            </>
          )}
          {canAddRefac && tab === "vales" && (
            <button className="btn btn-secondary" onClick={openValeManual}>📤 Vale de salida</button>
          )}
          {canSurtir && tab === "tipos" && <button className="btn btn-primary" onClick={openNewTipo}>+ Nuevo tipo</button>}
          {canUsadas && tab === "usadas" && <button className="btn btn-primary" onClick={openNuevaUsada}>+ Registrar refacción usada</button>}
          {canVerSolicitudes && tab === "solicitudes" && (
            <button className="btn btn-primary" onClick={() => {
              setSolicitudItems([emptySolicitudItem()]);
              setSolicitudNotas("");
              setSolicitudCotizId("");
              setSolicitudMoneda("MXN"); // ── NUEVO ──
              setSolicitudModal(true);
            }}>
              + Nueva solicitud
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <div className="stat-card">
            <span className="stat-card-icon">📦</span>
            <p className="stat-card-value" style={{ color: "var(--blue)" }}>{refacciones.length}</p>
            <p className="stat-card-label">Total refacciones</p>
            <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("inventario")}>
            <span className="stat-card-icon">⚠️</span>
            <p className="stat-card-value" style={{ color: stockBajo > 0 ? "var(--red)" : "var(--green)" }}>{stockBajo}</p>
            <p className="stat-card-label">Stock bajo</p>
            <div className="stat-card-accent" style={{ background: stockBajo > 0 ? "var(--red)" : "var(--green)" }} />
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("ordenes")}>
            <span className="stat-card-icon">📋</span>
            <p className="stat-card-value" style={{ color: ordenesPendientes > 0 ? "var(--accent)" : "var(--green)" }}>{ordenesPendientes}</p>
            <p className="stat-card-label">Órdenes pendientes</p>
            <div className="stat-card-accent" style={{ background: ordenesPendientes > 0 ? "var(--accent)" : "var(--green)" }} />
          </div>
          {canVerSolicitudes && (
            <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("solicitudes")}>
              <span className="stat-card-icon">🛒</span>
              <p className="stat-card-value" style={{ color: solsPendientes > 0 ? "var(--orange)" : "var(--green)" }}>{solsPendientes}</p>
              <p className="stat-card-label">Solicitudes sin liberar</p>
              <div className="stat-card-accent" style={{ background: solsPendientes > 0 ? "var(--orange)" : "var(--green)" }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => { setTab("inventario"); setSearch(""); }} style={tabStyle("inventario")}>📦 Inventario</button>
          <button onClick={() => { setTab("ordenes"); setSearch(""); }} style={tabStyle("ordenes")}>📋 Órdenes</button>
          {canUsadas && <button onClick={() => { setTab("usadas"); setSearch(""); }} style={tabStyle("usadas")}>🔩 Refacciones usadas</button>}
          {canSurtir && <button onClick={() => { setTab("tipos"); setSearch(""); }} style={tabStyle("tipos")}>⚙️ Tipos de servicio</button>}
          {canAddRefac && <button onClick={() => { setTab("vales"); setSearch(""); }} style={tabStyle("vales")}>📤 Vales de salida</button>}
          {canVerSolicitudes && (
            <button onClick={() => { setTab("solicitudes"); setSearch(""); }} style={tabStyle("solicitudes")}>
              🛒 Solicitudes de compra
              {canVerSinLiberar && solsPendientes > 0 && (
                <span style={{ marginLeft: 6, background: "var(--orange)", color: "#fff", borderRadius: 99, fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px" }}>
                  {solsPendientes}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">
              {tab === "inventario"  ? "Inventario de refacciones"         :
               tab === "ordenes"     ? "Órdenes de refacciones"            :
               tab === "usadas"      ? "Refacciones usadas / reemplazadas" :
               tab === "vales"       ? "Vales de salida de material"       :
               tab === "solicitudes" ? "Solicitudes de compra"             :
               "Tipos de servicio"}
            </p>
            <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : tab === "inventario" ? (
            filteredRef.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📦</span><p>Sin refacciones registradas</p></div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>No. Parte</th><th>Categoría</th><th>Proveedor</th><th>Marca compat.</th><th>Unidad</th><th>Stock</th><th>Mín.</th><th>Precio</th><th></th></tr></thead>
                <tbody>
                  {filteredRef.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{r.numeroParte || "—"}</td>
                      <td>{r.categoria || "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>{r.proveedor || "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>{r.marcaCompatible || "—"}</td>
                      <td>{r.unidad}</td>
                      <td><span style={{ fontWeight: 700, color: r.stock <= r.stockMinimo ? "var(--red)" : "var(--green)" }}>{r.stock}</span></td>
                      <td style={{ color: "var(--text-muted)" }}>{r.stockMinimo}</td>
                      <td>${r.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canEdit && (<><button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏️</button><button className="btn btn-danger btn-sm" onClick={() => removeRefaccion(r)}>🗑️</button></>)}
                          {canAddRefac && (<button className="btn btn-primary btn-sm" onClick={() => { setStockModal(r); setStockForm({ tipo: "entrada", cantidad: 1, tecnicoId: "", notas: "" }); }} title="Ajustar stock">±</button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "ordenes" ? (
            filteredOrd.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📋</span><p>Sin órdenes registradas</p></div>
            ) : (
              <table>
                <thead><tr><th>Folio</th><th>Servicio</th><th>Equipo</th><th>Piezas</th><th>Fecha</th><th>Estatus</th><th></th></tr></thead>
                <tbody>
                  {filteredOrd.map(o => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{o.folio}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{o.servicio?.folio ?? "—"}</td>
                      <td style={{ fontWeight: 600 }}>{o.montacargas?.numeroEconomico} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{o.montacargas?.marca}</span></td>
                      <td>{o.items.length} pieza{o.items.length !== 1 ? "s" : ""}</td>
                      <td>{fmt(o.createdAt)}</td>
                      <td><span className={`badge ${ESTATUS_BADGE[o.estatus]}`}>{o.estatus}</span></td>
                      <td>{(o.estatus === "pendiente" || o.estatus === "parcial") && canSurtir && (<button className="btn btn-primary btn-sm" onClick={() => openSurtir(o)}>Surtir</button>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "vales" ? (
            filteredVales.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">📤</span><p>Sin vales de salida registrados</p></div>
            ) : (
              <table>
                <thead><tr><th>Folio</th><th>Técnico</th><th>Material</th><th>Fecha y hora</th><th>Registrado por</th><th>Notas</th><th></th></tr></thead>
                <tbody>
                  {filteredVales.map(v => (
                    <tr key={v._id}>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent)" }}>{v.folio}</td>
                      <td style={{ fontWeight: 600 }}>{v.tecnico.nombre}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {v.items.map((item, i) => (
                            <span key={i} style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{item.cantidad}× {item.nombre}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>{fmtHora(v.createdAt)}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{v.registradoPor?.nombre ?? "—"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{v.notas || "—"}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => imprimirValeTermico(v)} title="Imprimir vale">🖨️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "usadas" ? (
            filteredUsadas.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">🔩</span><p>Sin refacciones usadas registradas</p></div>
            ) : (
              <table>
                <thead><tr><th>Descripción</th><th>No. Parte</th><th>Condición</th><th>Servicio</th><th>Registrado por</th><th>Fecha</th><th>Fotos</th><th></th></tr></thead>
                <tbody>
                  {filteredUsadas.map(u => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 600 }}>{u.descripcion}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{u.numeroParte || "—"}</td>
                      <td><span className={`badge ${CONDICION_BADGE[u.condicion] ?? "badge-gray"}`}>{u.condicion}</span></td>
                      <td style={{ fontSize: "0.82rem" }}>{u.servicio?.folio ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                      <td style={{ fontSize: "0.82rem" }}>{u.registradoPor?.nombre ?? "—"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{fmt(u.createdAt)}</td>
                      <td>
                        {u.fotos.length > 0 ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            {u.fotos.map((f, i) => (
                              <a key={i} href={f} target="_blank" rel="noreferrer">
                                <img src={f} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
                              </a>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>}
                      </td>
                      <td>{canEdit && <button className="btn btn-danger btn-sm" onClick={() => removeUsada(u._id)}>🗑️</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "solicitudes" ? (
            filteredSols.filter(s => canVerSinLiberar || s.estatus === "liberada").length === 0 ? (
              <div className="empty-state"><span className="empty-icon">🛒</span><p>Sin solicitudes de compra</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Solicitado por</th>
                    <th>Cotización</th>
                    <th>Artículos</th>
                    <th>Notas</th>
                    <th>Fecha</th>
                    <th>Estatus</th>
                    <th>Liberado por</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSols
                    .filter(s => canVerSinLiberar || s.estatus === "liberada")
                    .map(s => (
                    <tr key={s._id}>
                      <td style={{ fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent)" }}>{s.folio}</td>
                      <td style={{ fontWeight: 600 }}>{s.solicitadoPor?.nombre ?? "—"}</td>
                      <td>
                        {s.cotizacion ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <button onClick={() => setVerCotizacion(s.cotizacion!)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                              <span style={{ fontWeight: 700, color: "var(--blue)", fontSize: "0.82rem" }}>{s.cotizacion.folio}</span>
                            </button>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {s.cotizacion.cliente?.nombre ?? s.cotizacion.clienteOcasional?.nombre ?? "—"}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "var(--accent)" }}>${s.cotizacion.total.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>—</span>
                        )}
                      </td>
                      {/* ── NUEVO: botón reporte en lugar de lista de artículos ── */}
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => generarReporteSolicitud(s)}
                          title="Ver solicitud completa"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          📄 Ver solicitud
                        </button>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                          {s.items.length} artículo{s.items.length !== 1 ? "s" : ""}
                          {s.moneda === "USD" && (
                            <span style={{ marginLeft: 6, color: "#1d4ed8", fontWeight: 700 }}>💵 USD</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 160 }}>{s.notas || "—"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{fmt(s.createdAt)}</td>
                      <td>
                        <span className={`badge ${s.estatus === "liberada" ? "badge-green" : s.estatus === "cancelada" ? "badge-gray" : "badge-amber"}`}>
                          {s.estatus === "sin_liberar" ? "Sin liberar" : s.estatus === "liberada" ? "Liberada" : "Cancelada"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{s.liberadaPor?.nombre ?? "—"}</td>
                      <td>
                        {canLiberar && s.estatus === "sin_liberar" && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => liberarSolicitud(s._id)}>✅ Liberar</button>
                            <button className="btn btn-danger btn-sm" onClick={() => cancelarSolicitud(s._id)}>Cancelar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            filteredTipos.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">⚙️</span><p>Sin tipos de servicio registrados</p></div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>Intervalo</th><th>Precio total</th><th>Lo que se checa</th><th>Refacciones</th><th></th></tr></thead>
                <tbody>
                  {filteredTipos.map(t => (
                    <tr key={t._id}>
                      <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                      <td>{t.intervaloHrs ? `${t.intervaloHrs} hrs` : "—"}</td>
                      <td style={{ fontWeight: 700, color: "var(--accent)" }}>{t.precioTotal ? `$${t.precioTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}</td>
                      <td>{(t.itemsChecklist?.length ?? 0) === 0 ? <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span> : <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.itemsChecklist.length} item{t.itemsChecklist.length !== 1 ? "s" : ""}</span>}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {t.refacciones.length === 0 ? <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span> : t.refacciones.map((r, i) => (<span key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "0.75rem" }}>{r.cantidad}× {r.nombre}</span>))}
                        </div>
                      </td>
                      <td>{canSurtir && (<div style={{ display: "flex", gap: 4 }}><button className="btn btn-secondary btn-sm" onClick={() => openEditTipo(t)}>✏️</button><button className="btn btn-danger btn-sm" onClick={() => removeTipo(t)}>🗑️</button></div>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {escanerModal && <EscanerModal onScanned={handleScanned} onClose={() => setEscanerModal(false)} />}

      {modal && canAddRefac && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">{editing ? "Editar refacción" : "Nueva refacción"}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Filtro de aceite" autoFocus /></div>
              <div className="form-group"><label className="form-label">No. de parte</label><input className="form-input" value={form.numeroParte} onChange={e => setForm((p: any) => ({ ...p, numeroParte: e.target.value }))} placeholder="Ej. HY-4521" /></div>
              <div className="form-group"><label className="form-label">Categoría</label><select className="form-select" value={form.categoria} onChange={e => setForm((p: any) => ({ ...p, categoria: e.target.value }))}><option value="">Sin categoría</option>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Proveedor</label><input className="form-input" value={form.proveedor} onChange={e => setForm((p: any) => ({ ...p, proveedor: e.target.value }))} placeholder="Ej. TVH, CAT..." /></div>
              <div className="form-group"><label className="form-label">Marca compatible</label><select className="form-select" value={form.marcaCompatible} onChange={e => setForm((p: any) => ({ ...p, marcaCompatible: e.target.value }))}><option value="">Universal / sin marca</option>{MARCAS_COMPATIBLES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Unidad</label><select className="form-select" value={form.unidad} onChange={e => setForm((p: any) => ({ ...p, unidad: e.target.value }))}><option value="pieza">Pieza</option><option value="litro">Litro</option><option value="juego">Juego</option><option value="par">Par</option><option value="metro">Metro</option><option value="kg">Kg</option></select></div>
              <div className="form-group"><label className="form-label">Stock inicial</label><input className="form-input" type="number" value={form.stock} onChange={e => setForm((p: any) => ({ ...p, stock: +e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Stock mínimo</label><input className="form-input" type="number" value={form.stockMinimo} onChange={e => setForm((p: any) => ({ ...p, stockMinimo: +e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Precio unitario ($)</label><input className="form-input" type="number" value={form.precio} onChange={e => setForm((p: any) => ({ ...p, precio: +e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveRefaccion} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {stockModal && canAddRefac && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStockModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <button className="modal-close" onClick={() => setStockModal(null)}>✕</button>
            <h2 className="modal-title">Ajustar stock</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 4 }}>
              <strong style={{ color: "var(--text)" }}>{stockModal.nombre}</strong> — Stock actual: <strong style={{ color: "var(--accent)" }}>{stockModal.stock} {stockModal.unidad}s</strong>
            </p>
            {stockModal.numeroParte && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 16 }}>No. parte: <strong style={{ color: "var(--text)" }}>{stockModal.numeroParte}</strong></p>}
            <div className="form-grid cols-1">
              <div className="form-group">
                <label className="form-label">Tipo de movimiento</label>
                <select className="form-select" value={stockForm.tipo} onChange={e => setStockForm(p => ({ ...p, tipo: e.target.value, tecnicoId: "" }))}>
                  <option value="entrada">📥 Entrada</option>
                  <option value="salida">📤 Salida</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input className="form-input" type="number" min={1} value={stockForm.cantidad} onChange={e => setStockForm(p => ({ ...p, cantidad: +e.target.value }))} />
              </div>
              {stockForm.tipo === "salida" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Técnico que solicita *</label>
                    <select className="form-select" value={stockForm.tecnicoId} onChange={e => setStockForm(p => ({ ...p, tecnicoId: e.target.value }))}>
                      <option value="">Selecciona técnico...</option>
                      {tecnicos.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas (opcional)</label>
                    <input className="form-input" value={stockForm.notas} onChange={e => setStockForm(p => ({ ...p, notas: e.target.value }))} placeholder="Ej. Para servicio SRV-008..." />
                  </div>
                  <div style={{ padding: "10px 14px", background: "rgba(79,124,255,0.08)", border: "1px solid rgba(79,124,255,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--blue)" }}>
                    📋 Se generará un vale de salida automáticamente
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={ajustarStock} disabled={saving}>{saving ? "Guardando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {valeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setValeModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setValeModal(false)}>✕</button>
            <h2 className="modal-title">📤 Nuevo vale de salida</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Técnico que solicita *</label>
                <select className="form-select" value={valeTecnico} onChange={e => setValeTecnico(e.target.value)}>
                  <option value="">Selecciona técnico...</option>
                  {tecnicos.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Notas (opcional)</label>
                <input className="form-input" value={valeNotas} onChange={e => setValeNotas(e.target.value)} placeholder="Ej. Para servicio SRV-008, montacargas #45..." />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Material a entregar</p>
              <ValeSearchable refacciones={refacciones} onAdd={addValeItem} />
              {valeItems.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>Sin items — agrega refacciones del selector de arriba</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {valeItems.map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: 8, alignItems: "center", padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{item.nombre}</span>
                      <input type="number" min={1} value={item.cantidad}
                        onChange={e => setValeItems(prev => prev.map((x, idx) => idx === i ? { ...x, cantidad: +e.target.value } : x))}
                        style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "center", width: "100%" }} />
                      <button onClick={() => setValeItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "1rem" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setValeModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarValeManual} disabled={saving || !valeTecnico || !valeItems.length}>
                {saving ? "Guardando..." : "✅ Generar vale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {surtirModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSurtirModal(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <button className="modal-close" onClick={() => setSurtirModal(null)}>✕</button>
            <h2 className="modal-title">Surtir orden {surtirModal.folio}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 16 }}>Servicio: <strong style={{ color: "var(--text)" }}>{surtirModal.servicio?.folio}</strong> — {surtirModal.montacargas?.numeroEconomico} {surtirModal.montacargas?.marca}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {surtirModal.items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>{item.refaccion.nombre}</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.refaccion.numeroParte ? `#${item.refaccion.numeroParte} · ` : ""}Stock: <strong style={{ color: item.refaccion.stock >= item.cantidadSolicitada ? "var(--green)" : "var(--red)" }}>{item.refaccion.stock}</strong></p>
                  </div>
                  <div style={{ textAlign: "center" }}><p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>Solicitado</p><p style={{ margin: 0, fontWeight: 700 }}>{item.cantidadSolicitada} {item.refaccion.unidad}</p></div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>A surtir</p>
                    <input type="number" min={0} max={item.cantidadSolicitada} value={surtirItems[i]?.cantidadSurtida ?? item.cantidadSolicitada} onChange={e => setSurtirItems(prev => prev.map((x, idx) => idx === i ? { ...x, cantidadSurtida: +e.target.value } : x))} style={{ width: 70, padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", textAlign: "center" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" value={surtirNotas} onChange={e => setSurtirNotas(e.target.value)} placeholder="Ej. Faltó 1 filtro, se pedirá mañana" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>📷 Fotos de evidencia (opcional)</label>
                <button className="btn btn-secondary btn-sm" onClick={() => evidenciaRef.current?.click()} disabled={uploadingEvidencia}>{uploadingEvidencia ? "Subiendo..." : "+ Foto"}</button>
                <input ref={evidenciaRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) subirEvidencia(f); e.target.value = ""; }} />
              </div>
              {fotosEvidencia.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {fotosEvidencia.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                      <button onClick={() => setFotosEvidencia(prev => prev.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "10px" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSurtirModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={surtirOrden} disabled={saving}>{saving ? "Confirmando..." : "Confirmar entrega"}</button>
            </div>
          </div>
        </div>
      )}

      {usadaModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setUsadaModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <button className="modal-close" onClick={() => setUsadaModal(false)}>✕</button>
            <h2 className="modal-title">Registrar refacción usada</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Descripción *</label><input className="form-input" value={usadaForm.descripcion} onChange={e => setUsadaForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej. Filtro de aceite desgastado" /></div>
              <div className="form-group"><label className="form-label">No. de parte</label><input className="form-input" value={usadaForm.numeroParte} onChange={e => setUsadaForm((p: any) => ({ ...p, numeroParte: e.target.value }))} placeholder="Ej. HY-4521" /></div>
              <div className="form-group"><label className="form-label">Condición</label><select className="form-select" value={usadaForm.condicion} onChange={e => setUsadaForm((p: any) => ({ ...p, condicion: e.target.value }))}><option value="desgastada">Desgastada</option><option value="rota">Rota</option><option value="quemada">Quemada</option><option value="corroida">Corroída</option><option value="otro">Otro</option></select></div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Servicio relacionado (opcional)</label><select className="form-select" value={usadaForm.servicio} onChange={e => setUsadaForm((p: any) => ({ ...p, servicio: e.target.value }))}><option value="">Sin servicio / descripción libre</option>{servicios.map(s => <option key={s._id} value={s._id}>{s.folio}{s.problema ? ` — ${s.problema.slice(0, 40)}` : ""}</option>)}</select></div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Notas adicionales</label><textarea className="form-textarea" rows={2} value={usadaForm.notas} onChange={e => setUsadaForm((p: any) => ({ ...p, notas: e.target.value }))} placeholder="Observaciones, detalles del daño..." /></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>📷 Fotos de la refacción usada</label>
                <button className="btn btn-secondary btn-sm" onClick={() => usadaFotoRef.current?.click()} disabled={uploadingUsada}>{uploadingUsada ? "Subiendo..." : "+ Agregar foto"}</button>
                <input ref={usadaFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoUsada(f); e.target.value = ""; }} />
              </div>
              {usadaForm.fotos.length === 0 ? (
                <div onClick={() => usadaFotoRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)", padding: 20, textAlign: "center", cursor: "pointer", background: "var(--surface2)" }}>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>📷 Toca para agregar fotos</p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {usadaForm.fotos.map((url: string, i: number) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                      <button onClick={() => setUsadaForm((p: any) => ({ ...p, fotos: p.fotos.filter((_: any, idx: number) => idx !== i) }))} style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "10px" }}>✕</button>
                    </div>
                  ))}
                  <div onClick={() => usadaFotoRef.current?.click()} style={{ width: 80, height: 80, border: "2px dashed var(--border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--surface2)" }}>
                    <span style={{ fontSize: "1.4rem", color: "var(--text-muted)" }}>+</span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setUsadaModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveUsada} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {tipoModal && canSurtir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTipoModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <button className="modal-close" onClick={() => setTipoModal(false)}>✕</button>
            <h2 className="modal-title">{editingTipo ? "Editar tipo de servicio" : "Nuevo tipo de servicio"}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Nombre *</label><input className="form-input" value={tipoForm.nombre} onChange={e => setTipoForm((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Preventivo 300 hrs" /></div>
              <div className="form-group"><label className="form-label">Intervalo (horas)</label><input className="form-input" type="number" value={tipoForm.intervaloHrs} onChange={e => setTipoForm((p: any) => ({ ...p, intervaloHrs: e.target.value }))} placeholder="Ej. 300" /></div>
              <div className="form-group"><label className="form-label">💰 Precio total del servicio</label><input className="form-input" type="number" value={tipoForm.precioTotal} onChange={e => setTipoForm((p: any) => ({ ...p, precioTotal: +e.target.value }))} placeholder="Ej. 4700" />{tipoForm.precioTotal > 0 && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>+ IVA: ${(tipoForm.precioTotal * 1.16).toLocaleString("es-MX", { minimumFractionDigits: 2 })} total con IVA</p>}</div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Descripción general (opcional)</label><input className="form-input" value={tipoForm.descripcion} onChange={e => setTipoForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej. Mantenimiento preventivo a montacargas combustión 5000 a 6000 lbs" /></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="form-input" value={nuevoCheckItem} onChange={e => setNuevoCheckItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }} placeholder="Ej. Ajuste de frenos — Enter para agregar" />
                <button className="btn btn-secondary btn-sm" onClick={addCheckItem} style={{ whiteSpace: "nowrap" }}>+ Agregar</button>
              </div>
              {tipoForm.itemsChecklist.length === 0 ? <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "8px 0" }}>Sin items</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                  {tipoForm.itemsChecklist.map((item: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.82rem", flex: 1 }}>• {item}</span>
                      <button onClick={() => removeCheckItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>🔧 Refacciones sugeridas</p>
                <button className="btn btn-secondary btn-sm" onClick={addRefaccionTipo}>+ Agregar</button>
              </div>
              {tipoForm.refacciones.length === 0 ? <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>Sin refacciones sugeridas</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tipoForm.refacciones.map((r: any, i: number) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: 8, alignItems: "center" }}>
                      <input className="form-input" value={r.nombre} onChange={e => updateRefaccionTipo(i, "nombre", e.target.value)} placeholder="Ej. Filtro de aceite..." />
                      <input className="form-input" type="number" min={1} value={r.cantidad} onChange={e => updateRefaccionTipo(i, "cantidad", +e.target.value)} style={{ padding: "8px", textAlign: "center" }} />
                      <button className="btn btn-danger btn-icon" onClick={() => removeRefaccionTipo(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTipoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTipo} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nueva solicitud ── */}
      {solicitudModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSolicitudModal(false)}>
          <div className="modal" style={{ maxWidth: 660 }}>
            <button className="modal-close" onClick={() => setSolicitudModal(false)}>✕</button>
            <h2 className="modal-title">🛒 Nueva solicitud de compra</h2>

            <div className="form-group">
              <label className="form-label">
                Cotización relacionada (opcional)
                {!esGerencia && cotizacionesDisp.length === 0 && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, fontSize: "0.7rem" }}>
                    — no tienes cotizaciones activas vinculadas a tu usuario
                  </span>
                )}
              </label>
              {cotizacionesDisp.length > 0 ? (
                <>
                  <SearchableCotizacion value={solicitudCotizId} onChange={setSolicitudCotizId} options={cotizacionesDisp} />
                  {cotizSeleccionada && (
                    <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(79,124,255,0.08)", border: "1px solid rgba(79,124,255,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "var(--blue)" }}>{cotizSeleccionada.folio}</span>
                          <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{cotizSeleccionada.tipo}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--accent)" }}>${cotizSeleccionada.total.toLocaleString()}</span>
                      </div>
                      {cotizSeleccionada.items?.[0] && (
                        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          {cotizSeleccionada.items[0].descripcion.slice(0, 80)}{cotizSeleccionada.items[0].descripcion.length > 80 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: "10px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {esGerencia ? "Sin cotizaciones activas de servicio o refacciones." : "Tu usuario no está vinculado a ningún asesor con cotizaciones activas."}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notas generales (opcional)</label>
              <textarea className="form-textarea" rows={2} value={solicitudNotas} onChange={e => setSolicitudNotas(e.target.value)} placeholder="Ej. Urgente para servicio preventivo de la semana..." />
            </div>

            {/* ── NUEVO: selector de moneda ── */}
            <div className="form-group">
              <label className="form-label">Moneda de la solicitud</label>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {(["MXN", "USD"] as const).map((val, i) => (
                  <button key={val} type="button" onClick={() => setSolicitudMoneda(val)}
                    style={{
                      flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
                      background: solicitudMoneda === val ? "rgba(245,158,11,0.15)" : "var(--surface2)",
                      color: solicitudMoneda === val ? "var(--accent)" : "var(--text-muted)",
                      fontWeight: solicitudMoneda === val ? 700 : 400, fontSize: "0.85rem",
                      borderRight: i === 0 ? "1px solid var(--border)" : "none",
                    }}>
                    {val === "MXN" ? "🇲🇽 Pesos (MXN)" : "🇺🇸 Dólares (USD)"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Artículos a solicitar</p>
                <button className="btn btn-secondary btn-sm" onClick={addSolicitudItem}>+ Agregar artículo</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px 90px 90px 32px", gap: 8, padding: "0 12px", marginBottom: 4 }}>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Artículo</span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "center" }}>Cant.</span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Unidad</span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>{solicitudMoneda === "USD" ? "USD $" : "$"} c/u</span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Total</span>
                <span />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {solicitudItems.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px 90px 90px 32px", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <input className="form-input" value={item.nombre} onChange={e => updateSolicitudItem(i, "nombre", e.target.value)} placeholder="Nombre..." style={{ padding: "6px 10px" }} />
                    <input className="form-input" type="number" min={1} value={item.cantidad} onChange={e => updateSolicitudItem(i, "cantidad", +e.target.value)} style={{ padding: "6px 8px", textAlign: "center" }} />
                    <select className="form-select" value={item.unidad} onChange={e => updateSolicitudItem(i, "unidad", e.target.value)} style={{ padding: "6px 8px" }}>
                      <option value="pieza">Pieza</option>
                      <option value="litro">Litro</option>
                      <option value="juego">Juego</option>
                      <option value="par">Par</option>
                      <option value="metro">Metro</option>
                      <option value="kg">Kg</option>
                    </select>
                    <input className="form-input" type="number" min={0} value={item.precioUnitario} onChange={e => updateSolicitudItem(i, "precioUnitario", +e.target.value)} placeholder="0" style={{ padding: "6px 8px", textAlign: "right" }} />
                    <div style={{ textAlign: "right", fontSize: "0.85rem", fontWeight: 700, color: item.precioEstimado > 0 ? "var(--green)" : "var(--text-muted)" }}>
                      {item.precioEstimado > 0 ? `${solicitudMoneda === "USD" ? "USD $" : "$"}${item.precioEstimado.toLocaleString("es-MX")}` : "—"}
                    </div>
                    <button onClick={() => removeSolicitudItem(i)} disabled={solicitudItems.length === 1}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "1rem", opacity: solicitudItems.length === 1 ? 0.3 : 1 }}>✕</button>
                  </div>
                ))}
              </div>
              {totalSolicitud > 0 && (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Total estimado:</span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--green)" }}>
                    {solicitudMoneda === "USD" ? "USD $" : "$"}{totalSolicitud.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                💡 La solicitud quedará <strong style={{ color: "var(--accent)" }}>Sin liberar</strong> hasta que gerencia o developer la apruebe.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSolicitudModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarSolicitud} disabled={savingSolicitud || !solicitudItems.some(i => i.nombre.trim())}>
                {savingSolicitud ? "Enviando..." : "📤 Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {verCotizacion && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setVerCotizacion(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setVerCotizacion(null)}>✕</button>
            <h2 className="modal-title">📄 {verCotizacion.folio}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <span className={`badge ${verCotizacion.tipo === "servicio" ? "badge-amber" : verCotizacion.tipo === "refacciones" ? "badge-purple" : "badge-blue"}`}>{verCotizacion.tipo}</span>
              <span className={`badge ${verCotizacion.estatus === "activa" ? "badge-green" : "badge-gray"}`}>{verCotizacion.estatus}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Cliente</span>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{verCotizacion.cliente?.nombre ?? verCotizacion.clienteOcasional?.nombre ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Fecha</span>
                <span style={{ fontSize: "0.85rem" }}>{fmt(verCotizacion.fecha)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total c/IVA</span>
                <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>${verCotizacion.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Conceptos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {verCotizacion.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--text)", flex: 1 }}>{item.descripcion.slice(0, 60)}{item.descripcion.length > 60 ? "…" : ""}</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap", color: "var(--text-muted)" }}>${item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {verCotizacion.subtotal !== undefined && (
                <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }}
                    onClick={() => generarReporte({ ...verCotizacion, cliente: verCotizacion.cliente ?? verCotizacion.clienteOcasional, lugar: verCotizacion.lugar ?? "Zapopán, Jal." })}>
                    👁️ Ver reporte
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }}
                    onClick={() => descargarPDF({ ...verCotizacion, cliente: verCotizacion.cliente ?? verCotizacion.clienteOcasional, lugar: verCotizacion.lugar ?? "Zapopán, Jal." })}>
                    📥 Descargar PDF
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setVerCotizacion(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}