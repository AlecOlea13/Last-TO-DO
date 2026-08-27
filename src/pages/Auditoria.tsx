import { useEffect, useState, useRef } from "react";
import { api } from "../api";

const SUPABASE_URL    = "https://qhcvngcgajlodyoeckfz.supabase.co";
const SUPABASE_KEY    = "sb_publishable_ICaO1LC13OZOR5dOy6wcyA_mB3bZ2H7";
const SUPABASE_BUCKET = "documentos";

type Version = {
  _id: string;
  version: number;
  url: string;
  nombre: string;
  tipo: string;
  nota: string;
  fecha: string;
  subidoPor?: { nombre: string };
};

type Hallazgo = {
  _id: string;
  clave: string;
  numero: number;
  nombre: string;
  descripcion: string;
  clasificacion: "mayor" | "menor";
  proceso: string;
  documentos: Version[];
};

export default function Auditoria() {
  const rol         = localStorage.getItem("rol") ?? "";
  const puedeEditar = ["developer", "gerencia"].includes(rol);

  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [subiendo, setSubiendo]   = useState<string | null>(null);
  const [notaTemp, setNotaTemp]   = useState<Record<string, string>>({});
  const fileRefs                  = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/hallazgos");
      setHallazgos(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function subirDocumento(hallazgoId: string, file: File) {
    setSubiendo(hallazgoId);
    try {
      const ext      = file.name.split(".").pop();
      const fileName = `${hallazgoId}_${Date.now()}.${ext}`;

      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`,
        {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type":  file.type,
            "x-upsert":      "true",
          },
          body: file,
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Error al subir");
      }

      const url = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;

      await api.post(`/hallazgos/${hallazgoId}/documentos`, {
        url,
        nombre: file.name,
        tipo:   file.type,
        nota:   notaTemp[hallazgoId] ?? "",
      });

      setNotaTemp(p => ({ ...p, [hallazgoId]: "" }));
      await load();
    } catch (e: any) {
      alert("Error al subir el documento: " + e.message);
    } finally {
      setSubiendo(null);
    }
  }

  async function eliminarDocumento(hallazgoId: string, docId: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await api.delete(`/hallazgos/${hallazgoId}/documentos/${docId}`);
      await load();
    } catch {
      alert("Error al eliminar");
    }
  }

  function fmtFecha(d: string) {
    return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function iconTipo(tipo: string) {
    if (tipo.includes("pdf"))                             return "📄";
    if (tipo.includes("image"))                           return "🖼️";
    if (tipo.includes("excel") || tipo.includes("sheet")) return "📊";
    if (tipo.includes("spreadsheet"))                     return "📊";
    return "📎";
  }

  function botonDoc(doc: Version) {
    const esPdf    = doc.tipo.includes("pdf");
    const esImagen = doc.tipo.includes("image");

    if (esImagen) {
      return (
        <a href={doc.url} target="_blank" rel="noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: "none", flexShrink: 0 }}>
          👁️ Ver
        </a>
      );
    }

    if (esPdf) {
      return (
        <a href={doc.url} download={doc.nombre} target="_blank" rel="noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: "none", flexShrink: 0 }}>
          ⬇️ Descargar
        </a>
      );
    }

    return (
      <a href={doc.url} download={doc.nombre} target="_blank" rel="noreferrer"
        className="btn btn-secondary btn-sm"
        style={{ textDecoration: "none", flexShrink: 0 }}>
        ⬇️ Descargar
      </a>
    );
  }

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentación Auditoría</h1>
          <p className="page-subtitle">Dicka Logistics — Auditoría 17/08/2026 · {hallazgos.length} hallazgos</p>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hallazgos.map(h => {
            const abierto   = expandido === h._id;
            const ultimoDoc = h.documentos[h.documentos.length - 1];
            return (
              <div key={h._id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>

                <div
                  onClick={() => setExpandido(abierto ? null : h._id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", userSelect: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: h.clasificacion === "mayor" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                    border: `1.5px solid ${h.clasificacion === "mayor" ? "var(--red)" : "var(--accent)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: "0.9rem",
                    color: h.clasificacion === "mayor" ? "var(--red)" : "var(--accent)",
                  }}>
                    {h.numero}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>{h.nombre}</span>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99, textTransform: "uppercase",
                        background: h.clasificacion === "mayor" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: h.clasificacion === "mayor" ? "var(--red)" : "var(--accent)",
                        border: `1px solid ${h.clasificacion === "mayor" ? "var(--red)" : "var(--accent)"}`,
                      }}>
                        NC {h.clasificacion}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{h.clave} · {h.proceso}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {h.documentos.length === 0
                        ? <span style={{ color: "var(--red)" }}>⚠ Sin documentos</span>
                        : <span style={{ color: "var(--green)" }}>✓ {h.documentos.length} documento{h.documentos.length > 1 ? "s" : ""} · v{ultimoDoc?.version}</span>
                      }
                    </div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>{abierto ? "▲" : "▼"}</span>
                </div>

                {abierto && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

                    <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                      {h.descripcion}
                    </div>

                    {h.documentos.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Versiones</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[...h.documentos].reverse().map(doc => (
                            <div key={doc._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                              <span style={{ fontSize: "1.3rem" }}>{iconTipo(doc.tipo)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  v{doc.version} — {doc.nombre}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                  {fmtFecha(doc.fecha)}{doc.subidoPor ? ` · ${doc.subidoPor.nombre}` : ""}{doc.nota ? ` · ${doc.nota}` : ""}
                                </div>
                              </div>
                              {botonDoc(doc)}
                              {puedeEditar && (
                                <button className="btn btn-secondary btn-sm" style={{ color: "var(--red)", flexShrink: 0 }}
                                  onClick={() => eliminarDocumento(h._id, doc._id)}>
                                  🗑️
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {puedeEditar && (
                      <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "14px 16px", border: "1.5px dashed var(--border)" }}>
                        <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {h.documentos.length === 0 ? "Subir primer documento" : `Subir v${h.documentos.length + 1}`}
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            className="form-input"
                            placeholder="Nota opcional (ej: acuse de trámite)"
                            value={notaTemp[h._id] ?? ""}
                            onChange={e => setNotaTemp(p => ({ ...p, [h._id]: e.target.value }))}
                            style={{ flex: 1, minWidth: 180 }}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={subiendo === h._id}
                            onClick={() => fileRefs.current[h._id]?.click()}
                          >
                            {subiendo === h._id ? "Subiendo..." : "📎 Subir documento"}
                          </button>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,image/*"
                          style={{ display: "none" }}
                          ref={el => { fileRefs.current[h._id] = el; }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(h._id, f); e.target.value = ""; }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}