import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

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
    await qz.websocket.connect();
    const config = qz.configs.create("GHIA GTP801");

    const fecha = new Date(vale.createdAt).toLocaleString("es-MX", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const LINE = "--------------------------------\n";
    const BR   = "\n";

    const fila = (izq: string, der: string) =>
      izq.substring(0, 22).padEnd(22) + der.substring(0, 10).padStart(10) + "\n";

    let d = "";

    // Init
    d += "\x1B\x40";

    // Header
    d += "\x1B\x61\x01";           // centrar
    d += "\x1B\x21\x30";           // doble alto+ancho
    d += "PIPSA\n";
    d += "\x1B\x21\x00";           // normal
    d += "Montacargas de Guadalajara\n";
    d += BR;
    d += "\x1B\x21\x08";           // negrita
    d += "VALE DE SALIDA DE MATERIAL\n";
    d += "\x1B\x21\x00";
    d += LINE;

    // Folio
    d += "\x1B\x61\x01";
    d += "\x1B\x21\x10";           // doble ancho
    d += `${vale.folio}\n`;
    d += "\x1B\x21\x00";
    d += BR;

    // Datos generales
    d += "\x1B\x61\x00";           // izquierda
    d += `Tecnico : ${vale.tecnico.nombre}\n`;
    d += `Fecha   : ${fecha}\n`;
    d += `Reg. por: ${vale.registradoPor?.nombre ?? "—"}\n`;

    if (vale.notas) {
      d += BR;
      d += `Notas: ${vale.notas}\n`;
    }

    d += LINE;

    // Encabezado tabla
    d += "\x1B\x21\x08";
    d += fila("DESCRIPCION", "CANT/UND");
    d += "\x1B\x21\x00";
    d += LINE;

    // Items
    for (const item of vale.items) {
      const cant = `${item.cantidad} ${item.unidad}`;
      if (item.nombre.length <= 22) {
        d += fila(item.nombre, cant);
      } else {
        d += item.nombre.substring(0, 32) + "\n";
        d += fila("", cant);
      }
      if (item.numeroParte) {
        d += `  Parte: ${item.numeroParte}\n`;
      }
    }

    d += LINE;

    // Firma
    d += BR;
    d += "\x1B\x61\x01";
    d += "Firma de recibido\n";
    d += BR;
    d += BR;
    d += BR;
    d += "________________________________\n";
    d += `${vale.tecnico.nombre}\n`;
    d += BR;
    d += BR;

    // Corte
    d += "\x1D\x56\x42\x00";

    const printData = [{ type: "raw", format: "plain", data: d, options: { language: "ESCPOS" } }];
    await qz.print(config, printData);
    await qz.websocket.disconnect();

  } catch (err: any) {
    console.error("Error imprimiendo vale:", err);
    alert("Error al imprimir: " + (err?.message ?? err));
  }
}

export default function Almacen() {
  const rol         = localStorage.getItem("rol") ?? "";
  const canEdit     = ["developer", "gerencia"].includes(rol);
  const canAddRefac = ["developer", "gerencia", "almacen", "supervisor_almacen"].includes(rol);
  const canSurtir   = ["developer", "gerencia", "oficina", "almacen", "supervisor_almacen"].includes(rol);
  const canUsadas   = ["developer", "gerencia", "almacen", "tecnico", "supervisor_almacen"].includes(rol);
  // ... todo lo demás igual ...

  const [tab, setTab] = useState<"inventario" | "ordenes" | "tipos" | "usadas" | "vales">("inventario");
  const [refacciones, setRefacciones] = useState<Refaccion[]>([]);
  const [ordenes, setOrdenes]         = useState<Orden[]>([]);
  const [tipos, setTipos]             = useState<TipoServicio[]>([]);
  const [usadas, setUsadas]           = useState<RefaccionUsada[]>([]);
  const [servicios, setServicios]     = useState<{ _id: string; folio: string; problema?: string }[]>([]);
  const [tecnicos, setTecnicos]       = useState<Usuario[]>([]);
  const [vales, setVales]             = useState<Vale[]>([]);
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
  const [fotosEvidencia, setFotosEvidencia]     = useState<string[]>([]);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);

  const [tipoModal, setTipoModal]     = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoServicio | null>(null);
  const [tipoForm, setTipoForm]       = useState<any>(emptyTipo);
  const [nuevoCheckItem, setNuevoCheckItem] = useState("");

  const [usadaModal, setUsadaModal] = useState(false);
  const [usadaForm, setUsadaForm]   = useState<any>(emptyUsada);
  const [uploadingUsada, setUploadingUsada] = useState(false);

  const [saving, setSaving] = useState(false);

  const evidenciaRef = useRef<HTMLInputElement>(null);
  const usadaFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

    async function load() {
    try {
    const [r, o, t, u, s, us, v] = await Promise.all([
      api.get("/refacciones"), api.get("/ordenes-refaccion"),
      api.get("/tipos-servicio"), api.get("/refacciones-usadas"),
      api.get("/servicios"), 
      // ── solo pedir users si tiene permiso ──
      ["developer", "gerencia", "oficina", "almacen", "supervisor_almacen"].includes(rol)
        ? api.get("/users")
        : Promise.resolve({ data: [] }),
      api.get("/vales-salida"),
    ]);
    // ... resto igual
      setRefacciones(r.data); setOrdenes(o.data); setTipos(t.data);
      setUsadas(u.data);
      setServicios(s.data.map((sv: any) => ({ _id: sv._id, folio: sv.folio, problema: sv.problema })));
      setTecnicos(us.data.filter((u: any) => ["tecnico", "almacen", "developer", "gerencia", "oficina"].includes(u.rol)));
      setVales(v.data);
    } catch {}
    finally { setLoading(false); }
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
    } catch {}
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

  function openValeManual() {
    setValeItems([]);
    setValeTecnico("");
    setValeNotas("");
    setValeModal(true);
  }
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
        tecnicoId: valeTecnico,
        notas: valeNotas || undefined,
        items: valeItems,
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

  const stockBajo         = refacciones.filter(r => r.stock <= r.stockMinimo).length;
  const ordenesPendientes = ordenes.filter(o => o.estatus === "pendiente").length;

  const tabStyle = (t: string) => ({
    padding: "8px 20px", borderRadius: "var(--radius-sm)", border: "1.5px solid", cursor: "pointer",
    borderColor: tab === t ? "var(--accent)" : "var(--border)",
    background: tab === t ? "rgba(255,180,0,0.1)" : "var(--surface2)",
    color: tab === t ? "var(--accent)" : "var(--text-muted)",
    fontWeight: tab === t ? 700 : 400, fontSize: "0.88rem",
  });

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
          {canSurtir && tab === "tipos" && <button className="btn btn-primary" onClick={openNewTipo}>+ Nuevo tipo</button>}
          {canUsadas && tab === "usadas" && <button className="btn btn-primary" onClick={openNuevaUsada}>+ Registrar refacción usada</button>}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
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
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => { setTab("inventario"); setSearch(""); }} style={tabStyle("inventario")}>📦 Inventario</button>
          <button onClick={() => { setTab("ordenes"); setSearch(""); }} style={tabStyle("ordenes")}>📋 Órdenes</button>
          {canUsadas && <button onClick={() => { setTab("usadas"); setSearch(""); }} style={tabStyle("usadas")}>🔩 Refacciones usadas</button>}
          {canSurtir && <button onClick={() => { setTab("tipos"); setSearch(""); }} style={tabStyle("tipos")}>⚙️ Tipos de servicio</button>}
          {canAddRefac && <button onClick={() => { setTab("vales"); setSearch(""); }} style={tabStyle("vales")}>📤 Vales de salida</button>}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">
              {tab === "inventario" ? "Inventario de refacciones" : tab === "ordenes" ? "Órdenes de refacciones" : tab === "usadas" ? "Refacciones usadas / reemplazadas" : tab === "vales" ? "Vales de salida de material" : "Tipos de servicio"}
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
                            <span key={i} style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {item.cantidad}× {item.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>{fmtHora(v.createdAt)}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{v.registradoPor?.nombre ?? "—"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{v.notas || "—"}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => imprimirValeTermico(v)} title="Imprimir vale">🖨️</button>
                      </td>
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
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                <select className="form-select" onChange={e => { const r = refacciones.find(r => r._id === e.target.value); if (r) { addValeItem(r); e.target.value = ""; } }} defaultValue="">
                  <option value="">+ Agregar refacción al vale...</option>
                  {refacciones.filter(r => r.stock > 0).map(r => <option key={r._id} value={r._id}>{r.nombre}{r.numeroParte ? ` (${r.numeroParte})` : ""} — Stock: {r.stock}</option>)}
                </select>
              </div>
              {valeItems.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>Sin items — agrega refacciones del selector de arriba</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
    </>
  );
}