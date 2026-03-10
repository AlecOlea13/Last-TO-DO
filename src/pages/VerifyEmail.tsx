import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

type State = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg]     = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setMsg("No se encontró el token de verificación.");
      return;
    }

    api
      .get(`/auth/verify-email?token=${token}`)
      .then(() => {
        setState("success");
        setMsg("¡Correo verificado! Ya puedes iniciar sesión.");
        setTimeout(() => navigate("/"), 3000);
      })
      .catch((err) => {
  console.error("ERROR VERIFY:", err.response?.status, err.response?.data);
  setState("error");
  setMsg(err?.response?.data?.message ?? "El enlace es inválido o ya expiró.");
});
  }, []);

  const icon    = { loading: "⏳", success: "✅", error: "❌" }[state];
  const color   = { loading: "#4f7cff", success: "#22c55e", error: "#ef4444" }[state];
  const heading = { loading: "Verificando…", success: "¡Listo!", error: "Algo salió mal" }[state];

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0d0f14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        background: "#151820",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "20px",
        padding: "48px 40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>{icon}</div>

        <h2 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "1.6rem",
          fontWeight: 800,
          color: color,
          margin: "0 0 12px",
          letterSpacing: "-0.02em",
        }}>
          {heading}
        </h2>

        <p style={{ color: "#7a8099", fontSize: "0.95rem", margin: "0 0 28px" }}>
          {msg || "Estamos verificando tu correo, un momento…"}
        </p>

        {state === "loading" && (
          <div style={{
            width: "36px", height: "36px",
            border: "3px solid rgba(255,255,255,0.07)",
            borderTopColor: "#4f7cff",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
            margin: "0 auto",
          }} />
        )}

        {state === "success" && (
          <p style={{ color: "#7a8099", fontSize: "0.82rem" }}>
            Redirigiendo al login en 3 segundos…
          </p>
        )}

        {state === "error" && (
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "11px 28px",
              background: "#4f7cff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontFamily: "'Syne', sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ir al login
          </button>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
