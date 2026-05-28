import { useEffect, useState } from "react";
import { api } from "../api";

type Concepto = {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
};

type Gasto = {
  _id: string;
  uuid?: string;
  fechaEmision?: string;
  rfcEmisor?: string;
  nombreEmisor?: string;
  rfcReceptor?: string;
  nombreReceptor?: string;
  conceptos: Concepto[];
  subtotal: number;
  iva: number;
  total: number;
  moneda?: string;
  notas?: string;
  xmlUrl?: string;
};

export default function Gastos() {
  const [gastos, setGastos]         = useState<Gasto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [modal, setModal]           = useState(false);
  const [detalleModal, setDetalle]  = useState<Gasto | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<Partial<Gasto>>({});
  const [xmlError, setXmlError]     = useState("");

  const rol = localStorage.getItem("rol") ?? "";
  const canDelete = ["developer", "gerencia"].includes(rol);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/gastos");
      setGastos(data);
    } catch {}
    finally { setLoading(false); }
  }

  function parseXML(file: File) {
    setParsing(true);
    setXmlError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");

        const ns  = "http://www.sat.gob.mx/cfd/4";
        const ns3 = "http://www.sat.gob.mx/cfd/3";

        const cfdi = doc.querySelector("Comprobante") ??
                     doc.getElementsByTagNameNS(ns,  "Comprobante")[0] ??
                     doc.getElementsByTagNameNS(ns3, "Comprobante")[0];

        if (!cfdi) throw new Error("No se encontró el nodo Comprobante en el XML");

        const getAttr = (node: Element | null | undefined, attr: string) =>
          node?.getAttribute(attr) ?? "";

        const emisor   = cfdi.querySelector("Emisor")   ?? cfdi.getElementsByTagName("Emisor")[0];
        const receptor = cfdi.querySelector("Receptor") ?? cfdi.getElementsByTagName("Receptor")[0];
        const timbre   = cfdi.querySelector("TimbreFiscalDigital") ??
                         cfdi.getElementsByTagName("TimbreFiscalDigital")[0];

        const conceptosNodes = Array.from(
          cfdi.querySelectorAll("Concepto").length > 0
            ? cfdi.querySelectorAll("Concepto")
            : cfdi.getElementsByTagName("Concepto")
        );

        const conceptos: Concepto[] = conceptosNodes.map(c => ({
          descripcion:   getAttr(c, "Descripcion")   || getAttr(c, "descripcion"),
          cantidad:      parseFloat(getAttr(c, "Cantidad")      || getAttr(c, "cantidad")      || "1"),
          valorUnitario: parseFloat(getAttr(c, "ValorUnitario") || getAttr(c, "valorUnitario") || "0"),
          importe:       parseFloat(getAttr(c, "Importe")       || getAttr(c, "importe")       || "0"),
        }));

        // Calcular IVA desde nodos Traslado
        let iva = 0;
        const traslados = Array.from(
          cfdi.querySelectorAll("Traslado").length > 0
            ? cfdi.querySelectorAll("Traslado")
            : cfdi.getElementsByTagName("Traslado")
        );
        traslados.forEach(t => {
          const imp = parseFloat(getAttr(t, "Importe") || getAttr(t, "importe") || "0");
          if (!isNaN(imp)) iva += imp;
        });

        const parsed: Partial<Gasto> = {
          uuid:          getAttr(timbre, "UUID") || getAttr(timbre, "uuid"),
          fechaEmision:  getAttr(cfdi, "Fecha")  || getAttr(cfdi, "fecha"),
          rfcEmisor:     getAttr(emisor,   "Rfc") || getAttr(emisor,   "rfc"),
          nombreEmisor:  getAttr(emisor,   "Nombre") || getAttr(emisor,   "nombre"),
          rfcReceptor:   getAttr(receptor, "Rfc") || getAttr(receptor, "rfc"),
          nombreReceptor:getAttr(receptor, "Nombre") || getAttr(receptor, "nombre"),
          subtotal:      parseFloat(getAttr(cfdi, "SubTotal") || getAttr(cfdi, "subTotal") || "0"),
          iva:           iva || parseFloat(getAttr(cfdi, "Iva") || "0"),
          total:         parseFloat(getAttr(cfdi, "Total") || getAttr(cfdi, "total") || "0"),
          moneda:        getAttr(cfdi, "Moneda") || "MXN",
          conceptos,
        };

        setForm(parsed);
        setParsing(false);
      } catch (err: any) {
        setXmlError(err.message ?? "Error al leer el XML");
        setParsing(false);
      }
    };
    reader.onerror = () => { setXmlError("No se pudo leer el archivo"); setParsing(false); };
    reader.readAsText(file, "UTF-8");
  }

  async function save() {
    if (!form.nombreEmisor && !form.rfcEmisor) return;
    setSaving(true);
    try {
      const { data } = await api.post("/gastos", form);
      setGastos(prev => [data, ...prev]);
      setModal(false);
      setForm({});
    } catch (e: any) {
      if (e?.response?.data?.message) alert(e.response.data.message);
    }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await api.delete(`/gastos/${id}`);
    setGastos(prev => prev.filter(g => g._id !== id));
  }

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  const totalMes = gastos
    .filter(g => {
      if (!g.fechaEmision) return false;
      const d = new Date(g.fechaEmision);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, g) => acc + g.total, 0);

  const totalGeneral = gastos.reduce((acc, g) => acc + g.total, 0);

  const filtered = gastos.filter(g =>
    (g.nombreEmisor ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (g.rfcEmisor    ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (g.uuid         ?? "").toLowerCase().includes(search.toLowerCase()) ||
    g.conceptos.some(c => c.descripcion.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">{gastos.length} facturas registradas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setXmlError(""); setModal(true); }}>
          + Subir XML
        </button>
      </div>

      <div className="page-content">

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat-card">
            <span className="stat-card-icon">📄</span>
            <p className="stat-card-value">{gastos.length}</p>
            <p className="stat-card-label">Total facturas</p>
            <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">📅</span>
            <p className="stat-card-value" style={{ color: "var(--accent)", fontSize: "1.4rem" }}>
              ${totalMes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
            <p className="stat-card-label">Gasto este mes</p>
            <div className="stat-card-accent" style={{ background: "var(--accent)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">💰</span>
            <p className="stat-card-value" style={{ color: "var(--red)", fontSize: "1.4rem" }}>
              ${totalGeneral.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
            <p className="stat-card-label">Gasto total</p>
            <div className="stat-card-accent" style={{ background: "var(--red)" }} />
          </div>
        </div>

        {/* Tabla */}
        <div className="table-card" style={{ overflowX: "auto" }}>
          <div className="table-card-header">
            <p className="table-card-title">Todas las facturas</p>
            <div className="table-toolbar">
              <input
                className="search-input"
                placeholder="🔍 Buscar proveedor, RFC, concepto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🧾</span>
              <p>Sin gastos{search ? " con ese filtro" : " registrados"}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>RFC Emisor</th>
                  <th>Conceptos</th>
                  <th>Subtotal</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g._id}>
                    <td>{fmt(g.fechaEmision)}</td>
                    <td style={{ fontWeight: 600 }}>{g.nombreEmisor ?? "—"}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{g.rfcEmisor ?? "—"}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 200 }}>
                      {g.conceptos.length > 0
                        ? g.conceptos[0].descripcion.slice(0, 60) + (g.conceptos[0].descripcion.length > 60 ? "..." : "")
                        : "—"}
                      {g.conceptos.length > 1 && (
                        <span style={{ marginLeft: 6, fontSize: "0.72rem", background: "var(--surface3)", padding: "1px 6px", borderRadius: 4 }}>
                          +{g.conceptos.length - 1}
                        </span>
                      )}
                    </td>
                    <td>${g.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: "var(--text-muted)" }}>${g.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 700, color: "var(--red)" }}>${g.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(g)}>👁️</button>
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => remove(g._id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal subir XML ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Subir factura XML</h2>

            {/* Drop zone */}
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed var(--border2)", borderRadius: "var(--radius)", padding: "32px 20px",
              cursor: "pointer", background: "var(--surface2)", gap: 8, transition: "border-color 0.2s",
            }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseXML(f); }}
            >
              <span style={{ fontSize: "2.5rem" }}>{parsing ? "⏳" : "📂"}</span>
              <p style={{ fontWeight: 600, color: "var(--text)" }}>
                {parsing ? "Leyendo XML..." : "Arrastra o selecciona tu XML del SAT"}
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Archivos .xml de CFDI 3.3 o 4.0</p>
              <input
                type="file" accept=".xml" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) parseXML(f); }}
              />
            </label>

            {xmlError && (
              <p style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: 8 }}>⚠ {xmlError}</p>
            )}

            {/* Preview de datos extraídos */}
            {form.nombreEmisor && !parsing && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  ✅ Datos extraídos del XML
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: "0.85rem" }}>
                  {[
                    { label: "Proveedor",  val: form.nombreEmisor },
                    { label: "RFC",        val: form.rfcEmisor },
                    { label: "Fecha",      val: form.fechaEmision ? new Date(form.fechaEmision).toLocaleDateString("es-MX") : "" },
                    { label: "UUID",       val: form.uuid?.slice(0, 20) + "..." },
                    { label: "Subtotal",   val: `$${(form.subtotal ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "IVA",        val: `$${(form.iva     ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "Total",      val: `$${(form.total   ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` },
                    { label: "Conceptos",  val: `${form.conceptos?.length ?? 0} concepto(s)` },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</p>
                      <p style={{ color: "var(--text)", fontWeight: 500 }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                <div className="form-group" style={{ marginTop: 4 }}>
                  <label className="form-label">Notas (opcional)</label>
                  <input
                    className="form-input"
                    value={form.notas ?? ""}
                    onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Ej. Factura de combustible enero"
                  />
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !form.nombreEmisor || parsing}
              >
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h2 className="modal-title">{detalleModal.nombreEmisor ?? "Factura"}</h2>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
              UUID: {detalleModal.uuid ?? "—"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 8 }}>
              {[
                { label: "Fecha emisión",    val: fmt(detalleModal.fechaEmision) },
                { label: "RFC Emisor",       val: detalleModal.rfcEmisor },
                { label: "Receptor",         val: detalleModal.nombreReceptor },
                { label: "RFC Receptor",     val: detalleModal.rfcReceptor },
                { label: "Moneda",           val: detalleModal.moneda },
                { label: "Notas",            val: detalleModal.notas },
              ].map(item => item.val ? (
                <div key={item.label}>
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 500, marginTop: 2 }}>{item.val}</p>
                </div>
              ) : null)}
            </div>

            {/* Conceptos */}
            {detalleModal.conceptos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Conceptos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detalleModal.conceptos.map((c, i) => (
                    <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "0.85rem", color: "var(--text)", fontWeight: 500 }}>{c.descripcion}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {c.cantidad} × ${c.valorUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p style={{ fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                        ${c.importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totales */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                <span>Subtotal:</span><span>${detalleModal.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                <span>IVA:</span><span>${detalleModal.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: "1rem", fontWeight: 700, color: "var(--red)" }}>
                <span>Total:</span><span>${detalleModal.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}