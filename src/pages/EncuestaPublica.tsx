import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type DatosEncuesta = {
  folioServicio: string;
  fechaServicio: string;
  problema?: string;
  cliente: string;
  tecnico?: string;
};

type Respuestas = {
  p1_atencion: number;
  p2_tiempoAcordado: "si" | "no" | "parcialmente" | "";
  p3_satisfaccion: number;
  p4_comunicacion: "si" | "no" | "parcialmente" | "";
  p5_general: number;
  comentarios: string;
  recomendaria: boolean | null;
};

const emptyRespuestas: Respuestas = {
  p1_atencion: 0,
  p2_tiempoAcordado: "",
  p3_satisfaccion: 0,
  p4_comunicacion: "",
  p5_general: 0,
  comentarios: "",
  recomendaria: null,
};

const API = "https://pipsa-back.vercel.app/api";

function Estrellas({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "2.2rem", lineHeight: 1, padding: "4px 2px",
            color: n <= (hover || value) ? "#f0b800" : "#2a2d3a",
            transition: "color 0.15s, transform 0.1s",
            transform: n <= (hover || value) ? "scale(1.15)" : "scale(1)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function OpcionesTriple({
  value, onChange,
}: {
  value: string;
  onChange: (v: "si" | "no" | "parcialmente") => void;
}) {
  const opciones: { v: "si" | "no" | "parcialmente"; label: string; color: string; bg: string }[] = [
    { v: "si",           label: "✅ Sí",           color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    { v: "parcialmente", label: "⚠️ Parcialmente", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    { v: "no",           label: "❌ No",           color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  ];
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {opciones.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          style={{
            flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
            border: `2px solid ${value === o.v ? o.color : "#2a2d3a"}`,
            background: value === o.v ? o.bg : "#1a1d27",
            color: value === o.v ? o.color : "#7a8099",
            fontWeight: 700, fontSize: "0.85rem", transition: "all 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function EncuestaPublica() {
  const { token } = useParams<{ token: string }>();

  const [estado, setEstado] = useState<"cargando" | "formulario" | "enviando" | "gracias" | "error">("cargando");
  const [datos, setDatos]   = useState<DatosEncuesta | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [respuestas, setRespuestas] = useState<Respuestas>(emptyRespuestas);
  const [paso, setPaso]     = useState(0); // para ir pregunta por pregunta en móvil

  useEffect(() => {
    fetch(`${API}/encuestas/responder/${token}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) { setErrorMsg(data.message ?? "Error al cargar"); setEstado("error"); return; }
        setDatos(data);
        setEstado("formulario");
      })
      .catch(() => { setErrorMsg("No se pudo conectar al servidor"); setEstado("error"); });
  }, [token]);

  function set<K extends keyof Respuestas>(key: K, val: Respuestas[K]) {
    setRespuestas(p => ({ ...p, [key]: val }));
  }

  async function enviar() {
    setEstado("enviando");
    try {
      const r = await fetch(`${API}/encuestas/responder/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(respuestas),
      });
      const data = await r.json();
      if (!r.ok) { setErrorMsg(data.message ?? "Error al enviar"); setEstado("error"); return; }
      setEstado("gracias");
    } catch {
      setErrorMsg("No se pudo conectar al servidor");
      setEstado("error");
    }
  }

  const completa =
    respuestas.p1_atencion > 0 &&
    respuestas.p2_tiempoAcordado !== "" &&
    respuestas.p3_satisfaccion > 0 &&
    respuestas.p4_comunicacion !== "" &&
    respuestas.p5_general > 0 &&
    respuestas.recomendaria !== null;

  const preguntas = [
    {
      id: "p1",
      label: "¿Cómo calificarías la atención de nuestro técnico?",
      render: () => <Estrellas value={respuestas.p1_atencion} onChange={v => set("p1_atencion", v)} />,
      ok: respuestas.p1_atencion > 0,
    },
    {
      id: "p2",
      label: "¿El servicio se realizó en el tiempo acordado?",
      render: () => <OpcionesTriple value={respuestas.p2_tiempoAcordado} onChange={v => set("p2_tiempoAcordado", v)} />,
      ok: respuestas.p2_tiempoAcordado !== "",
    },
    {
      id: "p3",
      label: "¿Quedaste satisfecho con la solución al problema de tu equipo?",
      render: () => <Estrellas value={respuestas.p3_satisfaccion} onChange={v => set("p3_satisfaccion", v)} />,
      ok: respuestas.p3_satisfaccion > 0,
    },
    {
      id: "p4",
      label: "¿El técnico te explicó claramente el trabajo realizado?",
      render: () => <OpcionesTriple value={respuestas.p4_comunicacion} onChange={v => set("p4_comunicacion", v)} />,
      ok: respuestas.p4_comunicacion !== "",
    },
    {
      id: "p5",
      label: "¿Cómo calificarías el servicio en general?",
      render: () => <Estrellas value={respuestas.p5_general} onChange={v => set("p5_general", v)} />,
      ok: respuestas.p5_general > 0,
    },
    {
      id: "comentarios",
      label: "Comentarios adicionales (opcional)",
      render: () => (
        <textarea
          value={respuestas.comentarios}
          onChange={e => set("comentarios", e.target.value)}
          placeholder="Cuéntanos qué podemos mejorar o qué te gustó..."
          rows={4}
          style={{
            width: "100%", background: "#1a1d27", border: "1.5px solid #2a2d3a",
            borderRadius: 10, padding: "12px 14px", color: "#e8eaf0",
            fontSize: "1rem", resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
      ),
      ok: true, // opcional
    },
    {
      id: "recomendaria",
      label: "¿Recomendarías Pipsa Montacargas a otras empresas?",
      render: () => (
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { v: true,  label: "👍 Sí, los recomendaría",  color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
            { v: false, label: "👎 No por el momento",      color: "#f87171", bg: "rgba(248,113,113,0.15)" },
          ].map(o => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => set("recomendaria", o.v)}
              style={{
                flex: 1, padding: "14px 10px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${respuestas.recomendaria === o.v ? o.color : "#2a2d3a"}`,
                background: respuestas.recomendaria === o.v ? o.bg : "#1a1d27",
                color: respuestas.recomendaria === o.v ? o.color : "#7a8099",
                fontWeight: 700, fontSize: "0.9rem", transition: "all 0.15s",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ),
      ok: respuestas.recomendaria !== null,
    },
  ];

  // ── Estilos globales inline (no depende del sistema de clases de Control Pipsa) ──
  const page: React.CSSProperties = {
    minHeight: "100vh", background: "#0f1117", color: "#e8eaf0",
    fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column",
    alignItems: "center", padding: "0 0 60px",
  };

  const card: React.CSSProperties = {
    width: "100%", maxWidth: 560, background: "#151820",
    borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    marginTop: 32,
  };

  if (estado === "cargando") return (
    <div style={{ ...page, justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #2a2d3a", borderTop: "3px solid #f0b800", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (estado === "error") return (
    <div style={{ ...page, justifyContent: "center", textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>😕</div>
      <h2 style={{ color: "#f87171", marginBottom: 8 }}>No se pudo cargar la encuesta</h2>
      <p style={{ color: "#7a8099", maxWidth: 340 }}>{errorMsg}</p>
    </div>
  );

  if (estado === "gracias") return (
    <div style={{ ...page, justifyContent: "center", textAlign: "center", padding: 32 }}>
      <div style={card}>
        <div style={{ background: "#1a1d27", padding: "28px 32px", borderBottom: "3px solid #22c55e", textAlign: "center" }}>
          <img src="https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png"
            style={{ width: 56, height: 56, objectFit: "contain", background: "#000", borderRadius: 8, marginBottom: 12 }} alt="Pipsa" />
          <div style={{ fontSize: "3rem", marginBottom: 8 }}>🎉</div>
          <h2 style={{ color: "#22c55e", fontSize: "1.4rem", marginBottom: 8 }}>¡Gracias por tu respuesta!</h2>
          <p style={{ color: "#aab0c6", fontSize: "0.95rem", lineHeight: 1.6 }}>
            Tu opinión nos ayuda a mejorar nuestro servicio.<br />
            En Pipsa Montacargas, tu satisfacción es nuestra prioridad.
          </p>
        </div>
        <div style={{ padding: "24px 32px", textAlign: "center" }}>
          <p style={{ color: "#7a8099", fontSize: "0.85rem" }}>
            Si tienes alguna urgencia o consulta adicional, llámanos directamente.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={page}>
      <div style={card}>
        {/* Header */}
        <div style={{ background: "#1a1d27", padding: "24px 28px", borderBottom: "3px solid #f0b800", display: "flex", alignItems: "center", gap: 14 }}>
          <img src="https://res.cloudinary.com/dijxgoytw/image/upload/v1778686227/Pipsa_logo_png_damxzy.png"
            style={{ width: 52, height: 52, objectFit: "contain", background: "#000", borderRadius: 8, flexShrink: 0 }} alt="Pipsa" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>Encuesta de satisfacción</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#f0b800" }}>Pipsa Montacargas</p>
          </div>
        </div>

        {/* Info del servicio */}
        {datos && (
          <div style={{ background: "#111318", padding: "14px 28px", borderBottom: "1px solid #2a2d3a", display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.68rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.06em" }}>Folio</p>
              <p style={{ margin: 0, fontWeight: 700, color: "#f0b800", fontSize: "1rem" }}>{datos.folioServicio}</p>
            </div>
            {datos.tecnico && (
              <div>
                <p style={{ margin: 0, fontSize: "0.68rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.06em" }}>Técnico</p>
                <p style={{ margin: 0, fontWeight: 600, color: "#e8eaf0", fontSize: "0.9rem" }}>{datos.tecnico}</p>
              </div>
            )}
            {datos.problema && (
              <div style={{ flex: "1 1 100%" }}>
                <p style={{ margin: 0, fontSize: "0.68rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.06em" }}>Servicio</p>
                <p style={{ margin: 0, color: "#aab0c6", fontSize: "0.88rem" }}>{datos.problema}</p>
              </div>
            )}
          </div>
        )}

        {/* Barra de progreso */}
        <div style={{ height: 4, background: "#1a1d27" }}>
          <div style={{
            height: "100%", background: "#f0b800",
            width: `${Math.round(((paso + 1) / preguntas.length) * 100)}%`,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Pregunta actual */}
        <div style={{ padding: "28px 28px 8px" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Pregunta {paso + 1} de {preguntas.length}
          </p>
          <p style={{ margin: "0 0 20px", fontSize: "1.05rem", fontWeight: 600, color: "#e8eaf0", lineHeight: 1.5 }}>
            {preguntas[paso].label}
          </p>
          {preguntas[paso].render()}
        </div>

        {/* Navegación */}
        <div style={{ padding: "20px 28px 28px", display: "flex", gap: 10 }}>
          {paso > 0 && (
            <button
              type="button"
              onClick={() => setPaso(p => p - 1)}
              style={{
                flex: 1, padding: "14px", borderRadius: 10, border: "1.5px solid #2a2d3a",
                background: "transparent", color: "#7a8099", fontSize: "0.95rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              ← Anterior
            </button>
          )}
          {paso < preguntas.length - 1 ? (
            <button
              type="button"
              onClick={() => { if (preguntas[paso].ok) setPaso(p => p + 1); }}
              disabled={!preguntas[paso].ok}
              style={{
                flex: 1, padding: "14px", borderRadius: 10, border: "none",
                background: preguntas[paso].ok ? "#f0b800" : "#2a2d3a",
                color: preguntas[paso].ok ? "#0f1117" : "#4a5068",
                fontSize: "1rem", fontWeight: 700, cursor: preguntas[paso].ok ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={!completa || estado === "enviando"}
              style={{
                flex: 1, padding: "14px", borderRadius: 10, border: "none",
                background: completa ? "#22c55e" : "#2a2d3a",
                color: completa ? "#0f1117" : "#4a5068",
                fontSize: "1rem", fontWeight: 700, cursor: completa ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {estado === "enviando" ? "Enviando..." : "✅ Enviar encuesta"}
            </button>
          )}
        </div>

        <div style={{ padding: "0 28px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#4a5068" }}>
            Tu respuesta es confidencial y nos ayuda a mejorar nuestro servicio.
          </p>
        </div>
      </div>
    </div>
  );
}