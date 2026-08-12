import { useState, useRef, useEffect } from "react";

interface Mensaje {
  rol: "user" | "assistant";
  texto: string;
}

interface Resumen {
  generadoEn: string;
  servicios: {
    enSemana: number;
    abiertosAhora: number;
    tecnicoMasActivo: { nombre: string; total: number } | null;
    ultimos: any[];
  };
  cotizaciones: {
    enSemana: number;
    porEstatus: Record<string, number>;
    porTipo: Record<string, number>;
    ultimas: any[];
  };
  facturas: {
    enSemana: number;
    vigentes: number;
    montoSemana: number;
    ultimas: any[];
  };
  solicitudesCompra: {
    enSemana: number;
    porEstatus: Record<string, number>;
  };
}

const API_BACK = "https://pipsa-back.vercel.app";

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const PREGUNTAS = [
  { id: "servicios_abiertos",   emoji: "🔧", texto: "¿Cuántos servicios hay abiertos?" },
  { id: "tecnico_activo",       emoji: "👷", texto: "¿Quién es el técnico más activo?" },
  { id: "facturado_semana",     emoji: "🧾", texto: "¿Cuánto se facturó esta semana?" },
  { id: "facturas_sin_pagar",   emoji: "💸", texto: "¿Cuántas facturas sin pagar?" },
  { id: "cotizaciones_semana",  emoji: "📋", texto: "¿Cuántas cotizaciones nuevas?" },
  { id: "cotizaciones_tipo",    emoji: "📊", texto: "¿Cómo van las cotizaciones por tipo?" },
  { id: "solicitudes_liberar",  emoji: "📦", texto: "¿Solicitudes sin liberar?" },
  { id: "resumen_completo",     emoji: "✦",  texto: "Resumen completo de la semana" },
];

function responderPregunta(id: string, r: Resumen): string {
  switch (id) {
    case "servicios_abiertos":
      return `🔧 Ahorita hay **${r.servicios.abiertosAhora}** servicio${r.servicios.abiertosAhora !== 1 ? "s" : ""} abierto${r.servicios.abiertosAhora !== 1 ? "s" : ""} o en proceso.\n\nEsta semana se abrieron **${r.servicios.enSemana}** en total.`;

    case "tecnico_activo": {
      const t = r.servicios.tecnicoMasActivo;
      if (!t) return "👷 No hay suficientes datos de técnicos esta semana.";
      return `👷 El técnico más activo esta semana es **${t.nombre}** con **${t.total}** servicio${t.total !== 1 ? "s" : ""} asignado${t.total !== 1 ? "s" : ""}.`;
    }

    case "facturado_semana":
      return `🧾 Esta semana se emitieron **${r.facturas.enSemana}** factura${r.facturas.enSemana !== 1 ? "s" : ""} por un total de **${formatMXN(r.facturas.montoSemana)}**.`;

    case "facturas_sin_pagar": {
      const sinPagar = r.facturas.vigentes;
      return `💸 Hay **${sinPagar}** factura${sinPagar !== 1 ? "s" : ""} vigente${sinPagar !== 1 ? "s" : ""} pendiente${sinPagar !== 1 ? "s" : ""} de pago.`;
    }

    case "cotizaciones_semana":
      return `📋 Esta semana se generaron **${r.cotizaciones.enSemana}** cotización${r.cotizaciones.enSemana !== 1 ? "es" : ""} nuevas.`;

    case "cotizaciones_tipo": {
      const tipos = Object.entries(r.cotizaciones.porTipo);
      if (!tipos.length) return "📊 No hay datos de cotizaciones por tipo en los últimos 30 días.";
      const lista = tipos.map(([k, v]) => `• **${k}**: ${v}`).join("\n");
      return `📊 Cotizaciones por tipo (últimos 30 días):\n\n${lista}`;
    }

    case "solicitudes_liberar": {
      const sinLiberar = r.solicitudesCompra.porEstatus["sin_liberar"] ?? 0;
      const liberadas  = r.solicitudesCompra.porEstatus["liberada"]    ?? 0;
      return `📦 Hay **${sinLiberar}** solicitud${sinLiberar !== 1 ? "es" : ""} de compra sin liberar y **${liberadas}** ya liberada${liberadas !== 1 ? "s" : ""} (últimos 30 días).`;
    }

    case "resumen_completo": {
      const t = r.servicios.tecnicoMasActivo;
      const tecnico = t ? `**${t.nombre}** (${t.total} servicios)` : "sin datos";
      const sinLiberar = r.solicitudesCompra.porEstatus["sin_liberar"] ?? 0;
      return `✦ **Resumen de la semana**\n\n` +
        `🔧 **Servicios:** ${r.servicios.enSemana} nuevos · ${r.servicios.abiertosAhora} abiertos · Técnico top: ${tecnico}\n\n` +
        `📋 **Cotizaciones:** ${r.cotizaciones.enSemana} nuevas esta semana\n\n` +
        `🧾 **Facturas:** ${r.facturas.enSemana} emitidas · ${formatMXN(r.facturas.montoSemana)} facturado\n\n` +
        `📦 **Compras:** ${r.solicitudesCompra.enSemana} nuevas · ${sinLiberar} sin liberar`;
    }

    default:
      return "No tengo datos para esa pregunta.";
  }
}

export default function IAWidget() {
  const rol   = localStorage.getItem("rol")   ?? "";
  const token = localStorage.getItem("token") ?? "";

  const [abierto, setAbierto]                 = useState(false);
  const [mensajes, setMensajes]               = useState<Mensaje[]>([]);
  const [resumen, setResumen]                 = useState<Resumen | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [vistaPreguntas, setVistaPreguntas]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!["developer", "gerencia"].includes(rol)) return null;

  useEffect(() => {
    if (!abierto || resumen) return;
    cargarResumen();
  }, [abierto]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function cargarResumen() {
    setCargandoResumen(true);
    try {
      const res = await fetch(`${API_BACK}/api/resumen`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Sin datos");
      const data: Resumen = await res.json();
      setResumen(data);
      setMensajes([{ rol: "assistant", texto: generarIntro(data) }]);
    } catch {
      setMensajes([{ rol: "assistant", texto: "No pude cargar el resumen. Intenta de nuevo." }]);
    } finally {
      setCargandoResumen(false);
    }
  }

  function generarIntro(r: Resumen): string {
    const t = r.servicios.tecnicoMasActivo;
    const tecnico = t ? `**${t.nombre}** con ${t.total} servicios` : "sin datos suficientes";
    const monto = formatMXN(r.facturas.montoSemana);
    return `¡Hola! Soy **Pipsy**, tu asistente de Control Pipsa. Aquí el resumen de los últimos 7 días:\n\n` +
      `🔧 **Servicios:** ${r.servicios.enSemana} nuevos · ${r.servicios.abiertosAhora} abiertos ahora · Técnico más activo: ${tecnico}\n\n` +
      `📋 **Cotizaciones:** ${r.cotizaciones.enSemana} nuevas esta semana\n\n` +
      `🧾 **Facturas:** ${r.facturas.enSemana} emitidas · ${monto} facturado\n\n` +
      `📦 **Solicitudes de compra:** ${r.solicitudesCompra.enSemana} nuevas\n\n` +
      `Elige una pregunta 👇`;
  }

  function handlePregunta(id: string) {
    if (!resumen) return;
    const pregunta = PREGUNTAS.find(p => p.id === id);
    if (!pregunta) return;
    const respuesta = responderPregunta(id, resumen);
    setMensajes(prev => [
      ...prev,
      { rol: "user",      texto: pregunta.texto },
      { rol: "assistant", texto: respuesta },
    ]);
    setVistaPreguntas(false);
  }

  function renderTexto(texto: string) {
    return texto.split(/(\*\*[^*]+\*\*)/).map((parte, j) =>
      parte.startsWith("**") && parte.endsWith("**")
        ? <strong key={j} style={{ color: "#a5b4fc" }}>{parte.slice(2, -2)}</strong>
        : parte
    );
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(v => !v)}
        title="Pipsy — Asistente IA"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, transition: "transform 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {abierto ? "✕" : "✦"}
      </button>

      {abierto && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 9998,
          width: 380, maxWidth: "calc(100vw - 48px)", height: 520,
          display: "flex", flexDirection: "column",
          background: "#0f0f1a", borderRadius: 16,
          border: "1px solid rgba(99,102,241,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          overflow: "hidden", fontFamily: "'Inter', sans-serif",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
            borderBottom: "1px solid rgba(99,102,241,0.2)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✦</span>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>Pipsy ✦</div>
              <div style={{ color: "#6366f1", fontSize: 11 }}>Asistente de Control Pipsa</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {resumen && (
                <button onClick={cargarResumen} title="Actualizar datos"
                  style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 16, padding: 4 }}>
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {cargandoResumen && (
              <div style={{ color: "#6366f1", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                Cargando datos de la semana...
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.rol === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%", padding: "9px 13px",
                borderRadius: m.rol === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.rol === "user"
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "rgba(255,255,255,0.06)",
                color: m.rol === "user" ? "#fff" : "#cbd5e1",
                fontSize: 13, lineHeight: 1.5,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                border: m.rol === "assistant" ? "1px solid rgba(99,102,241,0.15)" : "none",
              }}>
                {renderTexto(m.texto)}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Panel de preguntas o botón */}
          <div style={{
            borderTop: "1px solid rgba(99,102,241,0.15)",
            background: "rgba(255,255,255,0.02)",
          }}>
            {vistaPreguntas ? (
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ color: "#6366f1", fontSize: 11, marginBottom: 2 }}>¿Qué quieres saber?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PREGUNTAS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePregunta(p.id)}
                      disabled={!resumen}
                      style={{
                        background: "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.25)",
                        borderRadius: 20, padding: "5px 11px",
                        color: "#c7d2fe", fontSize: 12, cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.25)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,0.12)")}
                    >
                      {p.emoji} {p.texto}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setVistaPreguntas(false)}
                  style={{
                    alignSelf: "flex-end", background: "none", border: "none",
                    color: "#6366f1", fontSize: 11, cursor: "pointer", padding: "2px 4px",
                  }}
                >
                  Cerrar ✕
                </button>
              </div>
            ) : (
              <div style={{ padding: "10px 12px", display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => setVistaPreguntas(true)}
                  disabled={!resumen || cargandoResumen}
                  style={{
                    background: resumen ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.2)",
                    border: "none", borderRadius: 20, padding: "8px 24px",
                    color: "#fff", fontSize: 13, cursor: resumen ? "pointer" : "not-allowed",
                    width: "100%", transition: "opacity 0.2s",
                  }}
                >
                  ✦ Hacer una pregunta
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </>
  );
}