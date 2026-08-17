import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const VIDEO_URL = "https://res.cloudinary.com/dijxgoytw/video/upload/v1787007690/Video_Project_vfj2p2.mp4";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess]   = useState(false);
  const navigate                = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setError("");
    setScanning(true);
    await new Promise(r => setTimeout(r, 1400));
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      setSuccess(true);
      localStorage.setItem("token",  data.token);
      localStorage.setItem("rol",    data.user.rol);
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("nombre", data.user.nombre);
      if (data.user.permisos) localStorage.setItem("permisos", JSON.stringify(data.user.permisos));
      await new Promise(r => setTimeout(r, 900));
      navigate("/dashboard");
    } catch (e: any) {
      setScanning(false);
      setSuccess(false);
      setError(e?.response?.data?.message ?? "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          background: #06080c;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }

        /* ── LEFT SCENE ── */
        .login-scene {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 48px;
          min-width: 0;
        }

        .login-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.55;
          pointer-events: none;
        }

        .login-video-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(6,8,12,0.7) 0%,
            rgba(6,8,12,0.3) 50%,
            rgba(6,8,12,0.7) 100%
          );
          pointer-events: none;
        }

        .login-video-overlay-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 220px;
          background: linear-gradient(to top, #06080c, transparent);
          pointer-events: none;
        }

        .login-badge {
          position: absolute;
          top: 36px;
          left: 44px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-badge-icon {
          width: 34px;
          height: 34px;
          background: #f0b800;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        .login-badge-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #f5f2ea;
        }

        .login-badge-sub {
          font-size: 9px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 1px;
        }

        .live-indicator {
          position: absolute;
          top: 40px;
          right: 44px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #4ade80;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          animation: blink 1.6s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(74,222,128,0.6);
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .login-scene-content {
          position: relative;
          z-index: 10;
        }

        .login-eyebrow {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #f0b800;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-eyebrow::before {
          content: '';
          display: block;
          width: 24px;
          height: 1.5px;
          background: #f0b800;
        }

        .login-headline {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(44px, 5.5vw, 76px);
          font-weight: 900;
          line-height: 0.9;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          color: #f5f2ea;
          margin-bottom: 20px;
          text-shadow: 0 2px 20px rgba(0,0,0,0.5);
        }

        .login-headline span { color: #f0b800; display: block; }

        .login-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          line-height: 1.65;
          max-width: 300px;
        }

        /* corner brackets */
        .corner { position: absolute; width: 24px; height: 24px; z-index: 10; }
        .corner-tl { top: 20px; left: 20px; border-top: 1.5px solid rgba(240,184,0,0.3); border-left: 1.5px solid rgba(240,184,0,0.3); }
        .corner-tr { top: 20px; right: 20px; border-top: 1.5px solid rgba(240,184,0,0.3); border-right: 1.5px solid rgba(240,184,0,0.3); }
        .corner-bl { bottom: 20px; left: 20px; border-bottom: 1.5px solid rgba(240,184,0,0.3); border-left: 1.5px solid rgba(240,184,0,0.3); }
        .corner-br { bottom: 20px; right: 20px; border-bottom: 1.5px solid rgba(240,184,0,0.3); border-right: 1.5px solid rgba(240,184,0,0.3); }

        /* ── DIVIDER ── */
        .login-divider {
          width: 1px;
          background: linear-gradient(180deg, transparent 0%, #1c2530 25%, #1c2530 75%, transparent 100%);
          flex-shrink: 0;
        }

        /* ── RIGHT CARD ── */
        .login-card-panel {
          width: 400px;
          flex-shrink: 0;
          background: #0a0e16;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 56px 44px;
          position: relative;
          border-left: 1px solid #141e2c;
          transition: opacity 0.6s ease;
        }

        .login-card-panel.success-fade { opacity: 0; }

        .login-card-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #f0b800 50%, transparent 100%);
        }

        .card-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #f5f2ea;
          margin-bottom: 4px;
        }

        .card-subtitle {
          font-size: 12px;
          color: #3a4a5c;
          margin-bottom: 32px;
        }

        .form-field { margin-bottom: 14px; }

        .form-field label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #3a4a5c;
          margin-bottom: 7px;
        }

        .form-field input {
          width: 100%;
          background: #06080c;
          border: 1px solid #141e2c;
          border-radius: 5px;
          padding: 11px 13px;
          font-size: 14px;
          color: #f5f2ea;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-field input::placeholder { color: #1e2d3d; }

        .form-field input:focus {
          border-color: #f0b800;
          box-shadow: 0 0 0 3px rgba(240,184,0,0.07);
        }

        .login-error {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 5px;
          padding: 9px 13px;
          font-size: 12px;
          color: #fc8181;
          margin-bottom: 14px;
        }

        .login-btn {
          width: 100%;
          padding: 12px;
          background: #f0b800;
          border: none;
          border-radius: 5px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #06080c;
          cursor: pointer;
          margin-top: 6px;
          position: relative;
          overflow: hidden;
          transition: background 0.15s, transform 0.1s;
        }

        .login-btn:hover:not(:disabled) {
          background: #ffe566;
          transform: translateY(-1px);
        }

        .login-btn:disabled { cursor: not-allowed; }

        .btn-scan-bar {
          position: absolute;
          top: 0; bottom: 0; left: -100%;
          width: 60%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: btnSweep 1.4s ease-in-out infinite;
        }

        @keyframes btnSweep {
          0%   { left: -60%; }
          100% { left: 160%; }
        }

        .btn-label {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(6,8,12,0.25);
          border-top-color: #06080c;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .success-overlay {
          position: absolute;
          inset: 0;
          background: rgba(240,184,0,0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 20;
          animation: fadeIn 0.4s ease;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .success-icon {
          font-size: 36px;
          animation: popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
        }

        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        .success-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #f0b800;
        }

        .success-sub {
          font-size: 11px;
          color: #4a5568;
          letter-spacing: 0.08em;
        }

        .scan-ring {
          width: 60px; height: 60px;
          border: 2px solid rgba(240,184,0,0.15);
          border-top-color: #f0b800;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .login-footer {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 1px solid #141e2c;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .login-footer-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #f0b800;
          flex-shrink: 0;
        }

        .login-footer-text {
          font-size: 10px;
          color: #1e2d3d;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @media (max-width: 768px) {
          .login-scene, .login-divider { display: none; }
          .login-card-panel {
            width: 100%;
            padding: 44px 28px;
            border-left: none;
          }
          .login-card-panel::before { display: none; }
        }
      `}</style>

      <div className="login-root">

        {/* ── LEFT SCENE ── */}
        <div className="login-scene">

          {/* Video de fondo */}
          <video
            className="login-video"
            src={VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
          />

          {/* Overlays para oscurecer y difuminar bordes */}
          <div className="login-video-overlay" />
          <div className="login-video-overlay-bottom" />

          {/* Esquinas decorativas */}
          <div className="corner corner-tl" />
          <div className="corner corner-tr" />
          <div className="corner corner-bl" />
          <div className="corner corner-br" />

          <div className="login-badge">
            <div className="login-badge-icon">🏗️</div>
            <div>
              <div className="login-badge-name">Control Pipsa</div>
              <div className="login-badge-sub">Gestión de flota</div>
            </div>
          </div>

          <div className="live-indicator">
            <span className="live-dot" />
            Sistema activo
          </div>

          <div className="login-scene-content">
            <div className="login-eyebrow">Sistema de gestión</div>
            <h1 className="login-headline">
              Flota
              <span>Bajo</span>
              Control.
            </h1>
            <p className="login-sub">
              Inventario, servicios, rentas y cotizaciones — todo en una sola plataforma.
            </p>
          </div>
        </div>

        <div className="login-divider" />

        {/* ── RIGHT CARD ── */}
        <div className={`login-card-panel ${success ? "success-fade" : ""}`}>

          {scanning && (
            <div className="success-overlay">
              {success ? (
                <>
                  <div className="success-icon">✅</div>
                  <div className="success-text">Acceso concedido</div>
                  <div className="success-sub">Redirigiendo al sistema...</div>
                </>
              ) : (
                <>
                  <div className="scan-ring" />
                  <div className="success-text" style={{ fontSize: 13 }}>Verificando credenciales</div>
                </>
              )}
            </div>
          )}

          <div className="card-title">Acceso</div>
          <div className="card-subtitle">Ingresa tus credenciales para continuar</div>

          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label>Usuario</label>
              <input
                type="text"
                placeholder="nombre.apellido"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={scanning}
              />
            </div>
            <div className="form-field">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={scanning}
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="login-btn" type="submit" disabled={scanning}>
              {scanning && <span className="btn-scan-bar" />}
              <span className="btn-label">
                {loading
                  ? <><span className="btn-spinner" /> Verificando...</>
                  : scanning
                  ? "Escaneando..."
                  : "Ingresar →"}
              </span>
            </button>
          </form>

          <div className="login-footer">
            <div className="login-footer-dot" />
            <div className="login-footer-text">
              Pipsa Montacargas · Zapopán, Jal. · {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}