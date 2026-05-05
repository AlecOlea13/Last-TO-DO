import { useEffect, useState } from "react";
import { api } from "../api";

type Factura = {
  _id: string;
  cliente?: { _id: string; nombre: string };
  renta?: { _id: string };
  monto: number;
  fechaVencimiento: string;
  pagado: boolean;
  diasVencidos?: number;
  comentarios?: string;
};

type Cliente = { _id: string; nombre: string };
type Renta   = { _id: string; cliente: { nombre: string }; montacargas: { numeroEconomico: string } };

const emptyForm = {
  cliente: "", renta: "", monto: 0,
  fechaVencimiento: "", pagado: false, comentarios: "",
};

export default function Facturas() {
  const [facturas, setFacturas]   = useState<Factura[]>([]);
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [rentas, setRentas]       = useState<Renta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filtro, setFiltro]       = useState("todos");
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState<any>(emptyForm);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [f, c, r] = await Promise.all([api.get("/facturas"), api.get("/clientes"), api.get("/rentas")]);
      // Calcular días vencidos
      const hoy = Date.now();
      const withDias = f.data.map((fa: Factura) => ({
        ...fa,
        diasVencidos: !fa.pagado && new Date(fa.fechaVencimiento).getTime() < hoy
          ? Math.floor((hoy - new Date(fa.fechaVencimiento).getTime()) / 86400000)
          : 0,
      }));
      setFacturas(withDias);
      setClientes(c.data.filter((cl: any) => cl.estatus === "activo"));
      setRentas(r.data.filter((re: any) => re.estatus === "activa"));
    } catch {}
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.cliente || !form.monto || !form.fechaVencimiento) return;
    setSaving(true);
    try {
      const { data } = await api.post("/facturas", form);
      setFacturas(prev => [data, ...prev]);
      setModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function marcarPagada(id: string) {
    await api.post(`/facturas/${id}/pagar`, {});
    setFacturas(prev => prev.map(f => f._id === id ? { ...f, pagado: true, diasVencidos: 0 } : f));
  }

  const filtered = facturas.filter(f => {
    const matchSearch = (f.cliente?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (f.comentarios ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFiltro =
      filtro === "todos" ? true :
      filtro === "pendiente" ? !f.pagado && (f.diasVencidos ?? 0) === 0 :
      filtro === "vencida"   ? !f.pagado && (f.diasVencidos ?? 0) > 0 :
      filtro === "pagada"    ? f.pagado : true;
    return matchSearch && matchFiltro;
  });

  const totalPendiente = facturas.filter(f => !f.pagado).reduce((acc, f) => acc + f.monto, 0);
  const totalVencido   = facturas.filter(f => !f.pagado && (f.diasVencidos ?? 0) > 0).reduce((acc, f) => acc + f.monto, 0);

  function fmt(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cobranza</h1>
          <p className="page-subtitle">{facturas.filter(f => !f.pagado).length} facturas pendientes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>+ Nueva factura</button>
      </div>

      <div className="page-content">
        {/* Resumen */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat-card">
            <span className="stat-card-icon">💰</span>
            <p className="stat-card-value" style={{ color: "var(--green)", fontSize: "1.4rem" }}>${totalPendiente.toLocaleString()}</p>
            <p className="stat-card-label">Total por cobrar</p>
            <div className="stat-card-accent" style={{ background: "var(--green)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">⚠️</span>
            <p className="stat-card-value" style={{ color: "var(--red)", fontSize: "1.4rem" }}>${totalVencido.toLocaleString()}</p>
            <p className="stat-card-label">Monto vencido</p>
            <div className="stat-card-accent" style={{ background: "var(--red)" }} />
          </div>
          <div className="stat-card">
            <span className="stat-card-icon">✅</span>
            <p className="stat-card-value" style={{ color: "var(--blue)", fontSize: "1.4rem" }}>{facturas.filter(f => f.pagado).length}</p>
            <p className="stat-card-label">Facturas pagadas</p>
            <div className="stat-card-accent" style={{ background: "var(--blue)" }} />
          </div>
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <p className="table-card-title">Todas las facturas</p>
            <div className="table-toolbar">
              <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" style={{ width: "auto", padding: "8px 14px" }} value={filtro} onChange={e => setFiltro(e.target.value)}>
                <option value="todos">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="vencida">Vencidas</option>
                <option value="pagada">Pagadas</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">💸</span><p>Sin facturas{search ? " con ese filtro" : " registradas"}</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Vencimiento</th>
                  <th>Días vencidos</th>
                  <th>Comentarios</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f._id}>
                    <td style={{ fontWeight: 600 }}>{f.cliente?.nombre ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-head)", fontWeight: 700 }}>${f.monto.toLocaleString()}</td>
                    <td>{fmt(f.fechaVencimiento)}</td>
                    <td>
                      {!f.pagado && (f.diasVencidos ?? 0) > 0 ? (
                        <span style={{ color: "var(--red)", fontWeight: 600 }}>{f.diasVencidos} días</span>
                      ) : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{f.comentarios || "—"}</td>
                    <td>
                      {f.pagado ? (
                        <span className="badge badge-green">Pagada</span>
                      ) : (f.diasVencidos ?? 0) > 0 ? (
                        <span className="badge badge-red">Vencida</span>
                      ) : (
                        <span className="badge badge-amber">Pendiente</span>
                      )}
                    </td>
                    <td>
                      {!f.pagado && (
                        <button className="btn btn-primary btn-sm" onClick={() => marcarPagada(f._id)}>✓ Pagar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            <h2 className="modal-title">Nueva factura</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-select" value={form.cliente} onChange={e => setForm((p: any) => ({ ...p, cliente: e.target.value }))}>
                  <option value="">Selecciona cliente...</option>
                  {clientes.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Renta relacionada</label>
                <select className="form-select" value={form.renta} onChange={e => setForm((p: any) => ({ ...p, renta: e.target.value }))}>
                  <option value="">Sin renta</option>
                  {rentas.map(r => <option key={r._id} value={r._id}>{r.cliente?.nombre} — {r.montacargas?.numeroEconomico}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input className="form-input" type="number" value={form.monto} onChange={e => setForm((p: any) => ({ ...p, monto: +e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha vencimiento *</label>
                <input className="form-input" type="date" value={form.fechaVencimiento} onChange={e => setForm((p: any) => ({ ...p, fechaVencimiento: e.target.value }))} />
              </div>
              <div className="form-group span-2">
                <label className="form-label">Comentarios</label>
                <textarea className="form-textarea" value={form.comentarios} onChange={e => setForm((p: any) => ({ ...p, comentarios: e.target.value }))} placeholder="Notas adicionales..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
