import { useEffect, useState } from "react";

const API_BACK = "https://pipsa-back.vercel.app";

type Documento = {
  folioFactura: string;
  total: number;
  montoPagado: number;
  estatus: "pendiente" | "parcial";
  fechaEmision: string;
};

type ClienteCartera = {
  _id: string;
  totalFacturado: number;
  totalCobrado: number;
  saldoPendiente: number;
  facturas: number;
  facturasPendientes: number;
  facturasParciales: number;
  ultimaEmision: string;
  documentos: Documento[];
};

type Cartera = {
  totalCartera: number;
  clientes: ClienteCartera[];
};

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmt(date?: string) {
  if (!date) return "—";
  const [y, m, d] = date.split("T")[0].split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function semaforo(saldo: number, total: number) {
  const pct = total > 0 ? saldo / total : 0;
  if (pct >= 1)   return { color: "var(--red)",    label: "Sin cobrar" };
  if (pct >= 0.5) return { color: "var(--accent)", label: "Parcial" };
  return              { color: "var(--green)",   label: "Casi cobrado" };
}

export default function Cartera() {
  const token = localStorage.getItem("token") ?? "";

  const [cartera, setCartera]   = useState<Cartera | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [detalle, setDetalle]   = useState<ClienteCartera | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BACK}/api/resumen/cartera`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCartera(data);
    } catch {
      setCartera(null);
    } finally {
      setLoading(false);
    }
  }

  const filtrados = (cartera?.clientes ?? []).filter(c =>
    c._id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cartera de Clientes</h1>
          <p className="page-subtitle">
            {cartera?.clientes.length ?? 0} clientes con saldo pendiente
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>↺ Actualizar</button>
      </div>

      <div className="page-content">

        {/* Stats */}
        {cartera && (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div className="stat-card">
              <span className="stat-card-icon">👥</span>
              <p className="stat-card-value" style={{ color: "var(--blue)" }}>
                {cartera.clientes.length}
              </p>
              <p className="stat-card-label">Clientes con deuda</p>
              <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
            </div>
            <div className="stat-card">
              <span className="stat-card-icon">⏳</span>
              <p className="stat-card-value" style={{ color: "var(--red)", fontSize: "1.3rem" }}>
                {formatMXN(cartera.totalCartera)}
              </p>
              <p className="stat-card-label">Total por cobrar</p>
              <div className="stat-card-accent" style={{ background: "var(--red)" }} />
            </div>
            <div className="stat-card">
              <span className="stat-card-icon">📄</span>
              <p className="stat-card-value" style={{ color: "var(--accent)" }}>
                {cartera.clientes.reduce((a, c) => a + c.facturas, 0)}
              </p>
              <p className="stat-card-label">Facturas pendientes</p>
              <div className="stat-card-accent" style={{ background: "var(--accent)" }} />
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Saldo por cliente</p>
            <div className="table-toolbar">
              <input
                className="search-input"
                placeholder="🔍 Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💰</span>
              <p>Sin clientes con saldo pendiente</p>
            </div>
          ) : (
            <table style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Cliente</th>
                  <th style={{ minWidth: 80, textAlign: "center" }}>Facturas</th>
                  <th style={{ minWidth: 130, textAlign: "right" }}>Total facturado</th>
                  <th style={{ minWidth: 130, textAlign: "right" }}>Cobrado</th>
                  <th style={{ minWidth: 140, textAlign: "right" }}>Saldo pendiente</th>
                  <th style={{ minWidth: 100 }}>Última emisión</th>
                  <th style={{ minWidth: 90 }}>Estado</th>
                  <th style={{ minWidth: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const s = semaforo(c.saldoPendiente, c.totalFacturado);
                  return (
                    <tr key={c._id}>
                      <td style={{ fontWeight: 600 }}>{c._id ?? "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700 }}>{c.facturas}</span>
                        {c.facturasParciales > 0 && (
                          <span style={{ fontSize: "0.7rem", color: "var(--accent)", marginLeft: 4 }}>
                            ({c.facturasParciales} parcial{c.facturasParciales !== 1 ? "es" : ""})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                        {formatMXN(c.totalFacturado)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--green)", fontWeight: 600 }}>
                        {formatMXN(c.totalCobrado)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: s.color, fontSize: "0.88rem" }}>
                          {formatMXN(c.saldoPendiente)}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {fmt(c.ultimaEmision)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, color: s.color,
                          background: `${s.color}20`, padding: "2px 8px", borderRadius: 10,
                        }}>
                          {s.label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetalle(c)}
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal detalle cliente */}
      {detalle && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h2 className="modal-title">{detalle._id}</h2>

            {/* Resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total facturado", val: formatMXN(detalle.totalFacturado), color: "var(--text)" },
                { label: "Cobrado",         val: formatMXN(detalle.totalCobrado),   color: "var(--green)" },
                { label: "Saldo pendiente", val: formatMXN(detalle.saldoPendiente), color: "var(--red)" },
              ].map(item => (
                <div key={item.label} style={{
                  background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                  padding: "12px 14px", border: "1px solid var(--border)",
                }}>
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                    {item.label}
                  </p>
                  <p style={{ fontWeight: 700, color: item.color, fontSize: "0.95rem" }}>{item.val}</p>
                </div>
              ))}
            </div>

            {/* Facturas */}
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              Facturas pendientes ({detalle.documentos.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {detalle.documentos.map((d, i) => {
                const saldo = d.total - d.montoPagado;
                return (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                    gap: 12,
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        {d.folioFactura || "Sin folio"}
                        <span style={{
                          marginLeft: 8, fontSize: "0.68rem", fontWeight: 700,
                          color: d.estatus === "parcial" ? "var(--accent)" : "var(--red)",
                          background: d.estatus === "parcial" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                          padding: "1px 7px", borderRadius: 8,
                        }}>
                          {d.estatus === "parcial" ? "Parcial" : "Pendiente"}
                        </span>
                      </p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Emitida: {fmt(d.fechaEmision)}
                        {d.montoPagado > 0 && (
                          <span style={{ marginLeft: 10, color: "var(--green)" }}>
                            Pagado: {formatMXN(d.montoPagado)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Saldo</p>
                      <p style={{ fontWeight: 700, color: "var(--red)", fontSize: "0.9rem" }}>
                        {formatMXN(saldo)}
                      </p>
                    </div>
                  </div>
                );
              })}
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