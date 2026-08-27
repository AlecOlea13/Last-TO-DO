import { useEffect, useState, useRef } from "react";
import { api } from "../api";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

type Monta = { _id: string; numeroEconomico: string; marca: string; modelo?: string };
type Reporte = {
  _id: string;
  folio: string;
  cliente?: { nombre: string };
  creadoPor?: { nombre: string };
  montacargas?: { _id: string; numeroEconomico: string; marca: string; modelo?: string };
  descripcion: string;
  foto?: string;
  estatus: "abierto" | "en_proceso" | "cerrado";
  notaInterna?: string;
  createdAt: string;
};

const ESTATUS_BADGE: Record<string, string> = {
  abierto:    "badge-red",
  en_proceso: "badge-amber",
  cerrado:    "badge-gray",
};

const ESTATUS_LABEL: Record<string, string> = {
  abierto:    "Abierto",
  en_proceso: "En proceso",
  cerrado:    "Cerrado",
};

export default function ReportesCliente() {
  const rol        = localStorage.getItem("rol") ?? "";
  const esCliente  = rol === "cliente";
  const puedeGestionar = ["developer", "gerencia"].includes(rol);

  const [reportes, setReportes]       = useState<Reporte[]>([]);
  const [montas, setMontas]           = useState<Monta[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(false);
  const [detalleModal, setDetalleModal] = useState<Reporte | null>(null);
  const [saving, setSaving]           = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ montacargasId: "", descripcion: "", foto: "" });
  const [notaEditar, setNotaEditar]   = useState("");
  const [estatusEditar, setEstatusEditar] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/reportes-cliente");
      setReportes(data);
      if (esCliente) {
        const { data: m } = await api.get("/reportes-cliente/mis-montacargas");
        setMontas(m);
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function crearReporte() {
    if (!form.descripcion.trim()) return;
    setSaving(true);
    try {
      await api.post("/reportes-cliente", {
        descripcion:   form.descripcion.trim(),
        montacargasId: form.montacargasId || undefined,
        foto:          form.foto || undefined,
      });
      setModal(false);
      setForm({ montacargasId: "", descripcion: "", foto: "" });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Error al crear reporte");
    }
    finally { setSaving(false); }
  }

  async function actualizarReporte() {
    if (!detalleModal) return;
    setSaving(true);
    try {
      await api.put(`/reportes-cliente/${detalleModal._id}`, {
        estatus:     estatusEditar,
        notaInterna: notaEditar,
      });
      setDetalleModal(null);
      await load();
    } catch { alert("Error al actualizar"); }
    finally { setSaving(false); }
  }

  async function subirFoto(file: File) {
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
      const data = await res.json();
      setForm(p => ({ ...p, foto: data.secure_url }));
    } catch { alert("Error al subir foto"); }
    finally { setUploadingFoto(false); }
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const nombreCliente = localStorage.getItem("nombre") ?? "Cliente";

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{esCliente ? `Reportes de ${nombreCliente.split(" ")[0]}` : "Reportes de Clientes"}</h1>
          <p className="page-subtitle">{reportes.length} reporte{reportes.length !== 1 ? "s" : ""} registrado{reportes.length !== 1 ? "s" : ""}</p>
        </div>
        {esCliente && (
          <button className="btn btn-primary" onClick={() => { setForm({ montacargasId: "", descripcion: "", foto: "" }); setModal(true); }}>
            + Nuevo reporte
          </button>
        )}
      </div>

      <div className="page-content">
        {reportes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>{esCliente ? "Aún no has creado ningún reporte." : "Sin reportes de clientes."}</p>
            {esCliente && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal(true)}>Crear primer reporte</button>}
          </div>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  {!esCliente && <th>Cliente</th>}
                  <th>Equipo</th>
                  <th>Descripción</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reportes.map(r => (
                  <tr key={r._id}>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>{r.folio}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{fmt(r.createdAt)}</td>
                    {!esCliente && <td>{r.cliente?.nombre ?? "—"}</td>}
                    <td style={{ fontSize: "0.82rem" }}>
                      {r.montacargas ? `#${r.montacargas.numeroEconomico} ${r.montacargas.marca}` : "—"}
                    </td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.descripcion}
                    </td>
                    <td><span className={`badge ${ESTATUS_BADGE[r.estatus]}`}>{ESTATUS_LABEL[r.estatus]}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => { setDetalleModal(r); setNotaEditar(r.notaInterna ?? ""); setEstatusEditar(r.estatus); }}>
                        👁️ Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal nuevo reporte ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">📝 Nuevo reporte</h2>
            <div className="form-grid">
              {montas.length > 0 && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Montacargas (opcional)</label>
                  <select className="form-select" value={form.montacargasId} onChange={e => setForm(p => ({ ...p, montacargasId: e.target.value }))}>
                    <option value="">Sin equipo específico</option>
                    {montas.map(m => (
                      <option key={m._id} value={m._id}>#{m.numeroEconomico} — {m.marca} {m.modelo ?? ""}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Descripción del problema *</label>
                <textarea className="form-textarea" rows={4} value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Describe el problema o situación que quieres reportar..." />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Foto (opcional)</label>
                <div onClick={() => fotoRef.current?.click()}
                  style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)", padding: 16, textAlign: "center", cursor: "pointer", background: "var(--surface2)" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  {form.foto ? (
                    <img src={form.foto} alt="foto" style={{ maxHeight: 140, borderRadius: 6, objectFit: "cover" }} />
                  ) : uploadingFoto ? (
                    <div className="spinner" style={{ width: 24, height: 24, margin: "auto" }} />
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>📷 Toca para adjuntar una foto</p>
                  )}
                </div>
                <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearReporte} disabled={saving || !form.descripcion.trim()}>
                {saving ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalleModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <button className="modal-close" onClick={() => setDetalleModal(null)}>✕</button>
            <h2 className="modal-title">📝 {detalleModal.folio}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
              {detalleModal.cliente?.nombre ?? "—"} · {fmt(detalleModal.createdAt)}
            </p>

            {detalleModal.montacargas && (
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: "0.85rem", color: "var(--text)" }}>
                🏗️ #{detalleModal.montacargas.numeroEconomico} — {detalleModal.montacargas.marca} {detalleModal.montacargas.modelo ?? ""}
              </div>
            )}

            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px", marginBottom: 12, fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.6 }}>
              {detalleModal.descripcion}
            </div>

            {detalleModal.foto && (
              <div style={{ marginBottom: 16 }}>
                <img src={detalleModal.foto} alt="foto" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
              </div>
            )}

            {puedeGestionar ? (
              <>
                <div className="form-group">
                  <label className="form-label">Estatus</label>
                  <select className="form-select" value={estatusEditar} onChange={e => setEstatusEditar(e.target.value)}>
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nota interna</label>
                  <textarea className="form-textarea" rows={3} value={notaEditar}
                    onChange={e => setNotaEditar(e.target.value)}
                    placeholder="Notas internas sobre este reporte..." />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDetalleModal(null)}>Cerrar</button>
                  <button className="btn btn-primary" onClick={actualizarReporte} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span className={`badge ${ESTATUS_BADGE[detalleModal.estatus]}`}>{ESTATUS_LABEL[detalleModal.estatus]}</span>
                </div>
                {detalleModal.notaInterna && (
                  <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    💬 {detalleModal.notaInterna}
                  </div>
                )}
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDetalleModal(null)}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}