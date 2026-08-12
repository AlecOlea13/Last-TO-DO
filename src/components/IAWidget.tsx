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

const API_BACK = (import.meta.env.VITE_API_URL ?? "https://pipsa-back.vercel.app").replace(/\/api$/, "");

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function resumenATexto(r: Resumen): string {
  const t = r.servicios?.tecnicoMasActivo;
  const tecnico = t ? `${t.nombre} (${t.total} servicios)` : "N/D";
  return `
RESUMEN SEMANAL — Control Pipsa (últimos 7 días)

SERVICIOS
- Nuevos esta semana: ${r.servicios.enSemana}
- Abiertos ahora: ${r.servicios.abiertosAhora}
- Técnico más activo: ${tecnico}
- Últimos: ${r.servicios.ultimos.map(s => `${s.folio} [${s.estatus}] técnico: ${s.tecnico?.nombre ?? "N/A"} equipo: ${s.montacargas?.numeroEconomico ?? "N/A"}`).join(" | ")}

COTIZACIONES
- Nuevas esta semana: ${r.cotizaciones.enSemana}
- Por estatus (30 días): ${Object.entries(r.cotizaciones.porEstatus).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Por tipo (30 días): ${Object.entries(r.cotizaciones.porTipo).map(([k, v]) => `${k}: ${v}`).join(", ")}

FACTURAS
- Emitidas esta semana: ${r.facturas.enSemana}
- Vigentes totales: ${r.facturas.vigentes}
- Monto facturado semana: ${formatMXN(r.facturas.montoSemana)}

SOLICITUDES DE COMPRA
- Nuevas esta semana: ${r.solicitudesCompra.enSemana}
- Por estatus (30 días): ${Object.entries(r.solicitudesCompra.porEstatus).map(([k, v]) => `${k}: ${v}`).join(", ")}
  `.trim();
}

export default function IAWidget() {
  const rol   = localStorage.getItem("rol")   ?? "";
  const token = localStorage.getItem("token") ?? "";

  const [abierto, setAbierto]                 = useState(false);
  const [mensajes, setMensajes]               = useState<Mensaje[]>([]);
  const [input, setInput]                     = useState("");
  const [cargando, setCargando]               = useState(false);
  const [resumen, setResumen]                 = useState<Resumen | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!["developer", "gerencia"].includes(rol)) return null;

  useEffect(() => {
    if (!abierto || resumen) return;
    cargarResumen();
  }, [abierto]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

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
      `¿Qué quieres saber?`;
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || cargando || !resumen) return;

    const nuevos: Mensaje[] = [...mensajes, { rol: "user", texto }];
    setMensajes(nuevos);
    setInput("");
    setCargando(true);

    try {
      const contexto = resumenATexto(resumen);
      const historial = nuevos.map(m => ({
        role: m.rol === "user" ? "user" : "assistant",
        content: m.texto,
      }));

      const mensajesAPI = [
        {
          role: "user",
          content: `Eres Pipsy, el asistente interno de Control Pipsa, un sistema de gestión de flota de montacargas. Responde siempre en español, de forma concisa y útil, y preséntate como Pipsy cuando sea relevante. Aquí están los datos reales de la semana:\n\n${contexto}\n\nResponde solo con base en estos datos. Si algo no está en los datos, dilo claramente.`,
        },
        { role: "assistant", content: "¡Hola! Soy Pipsy, listo para responder con base en los datos de Control Pipsa." },
        ...historial,
      ];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: mensajesAPI,
        }),
      });

      const data = await res.json();
      const respuesta = data.content?.[0]?.text ?? "Sin respuesta.";
      setMensajes(prev => [...prev, { rol: "assistant", texto: respuesta }]);
    } catch {
      setMensajes(prev => [...prev, { rol: "assistant", texto: "Error al consultar la IA. Intenta de nuevo." }]);
    } finally {
      setCargando(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(v => !v)}
        title="Pipsy — Asistente IA"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {abierto ? "✕" : "✦"}
      </button>

      {abierto && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 9998,
            width: 380,
            maxWidth: "calc(100vw - 48px)",
            height: 520,
            display: "flex",
            flexDirection: "column",
            background: "#0f0f1a",
            borderRadius: 16,
            border: "1px solid rgba(99,102,241,0.3)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            overflow: "hidden",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
            borderBottom: "1px solid rgba(99,102,241,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✦</span>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>Pipsy ✦</div>
              <div style={{ color: "#6366f1", fontSize: 11 }}>Asistente de Control Pipsa</div>
            </div>
            {resumen && (
              <button
                onClick={cargarResumen}
                title="Actualizar datos"
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                }}
              >
                ↺
              </button>
            )}
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {cargandoResumen && (
              <div style={{ color: "#6366f1", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                Cargando datos de la semana...
              </div>
            )}

            {mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.rol === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "9px 13px",
                  borderRadius: m.rol === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.rol === "user"
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.06)",
                  color: m.rol === "user" ? "#fff" : "#cbd5e1",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  border: m.rol === "assistant" ? "1px solid rgba(99,102,241,0.15)" : "none",
                }}
              >
                {m.texto.split(/(\*\*[^*]+\*\*)/).map((parte, j) =>
                  parte.startsWith("**") && parte.endsWith("**")
                    ? <strong key={j} style={{ color: "#a5b4fc" }}>{parte.slice(2, -2)}</strong>
                    : parte
                )}
              </div>
            ))}

            {cargando && (
              <div style={{
                alignSelf: "flex-start",
                color: "#6366f1",
                fontSize: 20,
                padding: "4px 8px",
                letterSpacing: 2,
              }}>
                ···
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(99,102,241,0.15)",
            display: "flex",
            gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={resumen ? "Pregunta a Pipsy..." : "Cargando datos..."}
              disabled={cargando || cargandoResumen || !resumen}
              rows={1}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 10,
                padding: "8px 12px",
                color: "#e2e8f0",
                fontSize: 13,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={enviar}
              disabled={cargando || !input.trim() || !resumen}
              style={{
                background: input.trim() && !cargando
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "rgba(99,102,241,0.2)",
                border: "none",
                borderRadius: 10,
                padding: "0 14px",
                cursor: input.trim() && !cargando ? "pointer" : "not-allowed",
                color: "#fff",
                fontSize: 16,
                transition: "background 0.2s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}