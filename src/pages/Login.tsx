import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate                = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token",  data.token);
      localStorage.setItem("rol",    data.user.rol);
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("nombre", data.user.nombre);
      if (data.user.permisos) localStorage.setItem("permisos", JSON.stringify(data.user.permisos));
      navigate("/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Error al iniciar sesión");
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
          position: relative;
        }

        /* ── LEFT PANEL ── */
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

        /* warehouse floor gradient */
        .login-scene::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 30% 70%, rgba(240,184,0,0.06) 0%, transparent 60%),
            linear-gradient(170deg, #0a0e16 0%, #060a10 60%, #030507 100%);
          z-index: 0;
        }

        /* rack grid */
        .rack-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          opacity: 0.55;
        }

        /* scan beam */
        .scan-beam {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #f0b800 20%, #ffe566 50%, #f0b800 80%, transparent 100%);
          box-shadow: 0 0 18px 4px rgba(240,184,0,0.45), 0 0 60px 12px rgba(240,184,0,0.12);
          z-index: 3;
          animation: scanMove 3.2s ease-in-out infinite;
          top: 20%;
        }

        .scan-beam::before {
          content: '';
          position: absolute;
          inset: -40px 0;
          background: linear-gradient(180deg, transparent 0%, rgba(240,184,0,0.04) 50%, transparent 100%);
        }

        @keyframes scanMove {
          0%   { top: 18%; opacity: 0.9; }
          45%  { top: 78%; opacity: 1;   }
          55%  { top: 78%; opacity: 0.7; }
          100% { top: 18%; opacity: 0.9; }
        }

        /* ambient corner glow */
        .glow-corner {
          position: absolute;
          bottom: -120px;
          left: -80px;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(240,184,0,0.07) 0%, transparent 65%);
          z-index: 2;
          pointer-events: none;
        }

        .login-scene-content {
          position: relative;
          z-index: 4;
        }

        .login-eyebrow {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #f0b800;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-eyebrow::before {
          content: '';
          display: block;
          width: 28px;
          height: 1.5px;
          background: #f0b800;
        }

        .login-headline {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(48px, 6vw, 80px);
          font-weight: 900;
          line-height: 0.92;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          color: #f5f2ea;
          margin-bottom: 24px;
        }

        .login-headline span {
          color: #f0b800;
          display: block;
        }

        .login-sub {
          font-size: 14px;
          color: #6b7a8d;
          line-height: 1.6;
          max-width: 320px;
          font-weight: 400;
        }

        /* corner badge */
        .login-badge {
          position: absolute;
          top: 40px;
          left: 48px;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-badge-icon {
          width: 36px;
          height: 36px;
          background: #f0b800;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .login-badge-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #f5f2ea;
        }

        .login-badge-sub {
          font-size: 10px;
          color: #4a5568;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 1px;
        }

        /* scan counter */
        .scan-counter {
          position: absolute;
          top: 40px;
          right: 48px;
          z-index: 5;
          text-align: right;
        }

        .scan-counter-val {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #f0b800;
          letter-spacing: 0.12em;
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-end;
        }

        .scan-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f0b800;
          animation: blink 1.4s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }

        /* ── DIVIDER ── */
        .login-divider {
          width: 1px;
          background: linear-gradient(180deg, transparent 0%, #1c2530 20%, #1c2530 80%, transparent 100%);
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }

        /* ── RIGHT PANEL / CARD ── */
        .login-card-panel {
          width: 420px;
          flex-shrink: 0;
          background: #0d1117;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 56px 48px;
          position: relative;
          z-index: 10;
          border-left: 1px solid #1c2530;
        }

        .login-card-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #f0b800 50%, transparent 100%);
        }

        .card-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #f5f2ea;
          margin-bottom: 6px;
        }

        .card-subtitle {
          font-size: 13px;
          color: #4a5568;
          margin-bottom: 36px;
          font-weight: 400;
        }

        .form-field {
          margin-bottom: 16px;
        }

        .form-field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #4a5568;
          margin-bottom: 8px;
        }

        .form-field input {
          width: 100%;
          background: #06080c;
          border: 1px solid #1c2530;
          border-radius: 6px;
          padding: 12px 14px;
          font-size: 14px;
          color: #f5f2ea;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-field input::placeholder {
          color: #2d3748;
        }

        .form-field input:focus {
          border-color: #f0b800;
          box-shadow: 0 0 0 3px rgba(240,184,0,0.08);
        }

        .login-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 13px;
          color: #fc8181;
          margin-bottom: 16px;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: #f0b800;
          border: none;
          border-radius: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #06080c;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-btn:hover:not(:disabled) {
          background: #ffe566;
          transform: translateY(-1px);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* spinner inside button */
        .btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(6,8,12,0.3);
          border-top-color: #06080c;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #1c2530;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .login-footer-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #f0b800;
          flex-shrink: 0;
        }

        .login-footer-text {
          font-size: 11px;
          color: #2d3748;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* responsive */
        @media (max-width: 768px) {
          .login-scene { display: none; }
          .login-divider { display: none; }
          .login-card-panel {
            width: 100%;
            padding: 48px 28px;
            border-left: none;
          }
          .login-card-panel::before { display: none; }
          .login-root {
            background: #06080c;
          }
        }
      `}</style>

      <div className="login-root">

        {/* ── LEFT SCENE ── */}
        <div className="login-scene">

          {/* logo */}
          <div className="login-badge">
            <div className="login-badge-icon">🏗️</div>
            <div>
              <div className="login-badge-name">Control Pipsa</div>
              <div className="login-badge-sub">Gestión de flota</div>
            </div>
          </div>

          {/* live indicator */}
          <div className="scan-counter">
            <div className="scan-counter-val">
              <span className="scan-dot" />
              Sistema activo
            </div>
          </div>

          {/* rack SVG */}
          <svg className="rack-svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            {/* floor line */}
            <line x1="0" y1="560" x2="800" y2="560" stroke="#1c2530" strokeWidth="1.5"/>

            {/* perspective lines */}
            <line x1="400" y1="80" x2="0"   y2="560" stroke="#1a2230" strokeWidth="0.5"/>
            <line x1="400" y1="80" x2="800" y2="560" stroke="#1a2230" strokeWidth="0.5"/>
            <line x1="400" y1="80" x2="200" y2="560" stroke="#161e2c" strokeWidth="0.5"/>
            <line x1="400" y1="80" x2="600" y2="560" stroke="#161e2c" strokeWidth="0.5"/>

            {/* LEFT RACK */}
            {/* vertical posts */}
            <rect x="60"  y="100" width="6" height="440" fill="#1a2534" rx="1"/>
            <rect x="180" y="100" width="6" height="440" fill="#1a2534" rx="1"/>

            {/* shelves */}
            {[140, 220, 300, 380, 460, 540].map((y, i) => (
              <g key={i}>
                <rect x="58" y={y} width="130" height="5" fill="#22303f" rx="1"/>
                {/* crates */}
                <rect x="66"  y={y - 56} width="38" height="52" fill="#131c28" stroke="#1e2d3d" strokeWidth="1" rx="2"/>
                <rect x="110" y={y - 56} width="38" height="52" fill="#0f1820" stroke="#1e2d3d" strokeWidth="1" rx="2"/>
                {/* crate lines */}
                <line x1="85"  y1={y - 56} x2="85"  y2={y - 4} stroke="#1c2a3a" strokeWidth="0.8"/>
                <line x1="66"  y1={y - 32} x2="104" y2={y - 32} stroke="#1c2a3a" strokeWidth="0.8"/>
                <line x1="129" y1={y - 32} x2="148" y2={y - 32} stroke="#1c2a3a" strokeWidth="0.8"/>
                {/* amber accent on some crates */}
                {i % 2 === 0 && <rect x="66" y={y - 56} width="3" height="52" fill="#f0b800" opacity="0.4" rx="1"/>}
              </g>
            ))}

            {/* RIGHT RACK */}
            <rect x="614" y="100" width="6" height="440" fill="#1a2534" rx="1"/>
            <rect x="734" y="100" width="6" height="440" fill="#1a2534" rx="1"/>
            {[160, 240, 320, 400, 480, 540].map((y, i) => (
              <g key={i}>
                <rect x="612" y={y} width="130" height="5" fill="#22303f" rx="1"/>
                <rect x="620" y={y - 50} width="36" height="46" fill="#131c28" stroke="#1e2d3d" strokeWidth="1" rx="2"/>
                <rect x="662" y={y - 50} width="36" height="46" fill="#0f1820" stroke="#1e2d3d" strokeWidth="1" rx="2"/>
                <line x1="638" y1={y - 50} x2="638" y2={y - 4} stroke="#1c2a3a" strokeWidth="0.8"/>
                <line x1="620" y1={y - 28} x2="656" y2={y - 28} stroke="#1c2a3a" strokeWidth="0.8"/>
                {i % 2 === 1 && <rect x="696" y={y - 50} width="3" height="46" fill="#f0b800" opacity="0.35" rx="1"/>}
              </g>
            ))}

            {/* CENTER — forklift silhouette */}
            {/* mast */}
            <rect x="370" y="200" width="8"  height="320" fill="#151f2e" rx="2"/>
            <rect x="422" y="200" width="8"  height="320" fill="#151f2e" rx="2"/>
            {/* forks */}
            <rect x="340" y="340" width="100" height="8"  fill="#1c2b3a" rx="2"/>
            <rect x="340" y="354" width="100" height="8"  fill="#1c2b3a" rx="2"/>
            {/* carriage */}
            <rect x="358" y="300" width="84"  height="50" fill="#131c28" stroke="#1c2b3a" strokeWidth="1" rx="3"/>
            {/* body */}
            <rect x="348" y="420" width="104" height="100" fill="#0f1820" stroke="#1c2b3a" strokeWidth="1" rx="4"/>
            {/* wheels */}
            <circle cx="368" cy="530" r="18" fill="#0c1520" stroke="#1c2b3a" strokeWidth="1.5"/>
            <circle cx="432" cy="530" r="18" fill="#0c1520" stroke="#1c2b3a" strokeWidth="1.5"/>
            <circle cx="368" cy="530" r="6"  fill="#1c2b3a"/>
            <circle cx="432" cy="530" r="6"  fill="#1c2b3a"/>
            {/* counterweight */}
            <rect x="378" y="390" width="44"  height="32" fill="#131c28" stroke="#1c2b3a" strokeWidth="1" rx="2"/>
            {/* amber light */}
            <circle cx="400" cy="410" r="5" fill="#f0b800" opacity="0.7"/>
            <circle cx="400" cy="410" r="10" fill="#f0b800" opacity="0.08"/>

            {/* barcode on mast */}
            {[0,3,5,8,11,13,16,18].map((x, i) => (
              <rect key={i} x={375 + x} y="240" width={i % 3 === 0 ? 2 : 1} height="40" fill="#f0b800" opacity="0.5"/>
            ))}

            {/* floor shadow */}
            <ellipse cx="400" cy="555" rx="90" ry="6" fill="#000" opacity="0.5"/>
          </svg>

          {/* scan beam */}
          <div className="scan-beam" />
          <div className="glow-corner" />

          {/* bottom copy */}
          <div className="login-scene-content">
            <div className="login-eyebrow">Sistema de gestión</div>
            <h1 className="login-headline">
              Flota
              <span>Bajo</span>
              Control.
            </h1>
            <p className="login-sub">
              Inventario, servicios, rentas y cotizaciones — todo desde una sola plataforma.
            </p>
          </div>
        </div>

        {/* divider */}
        <div className="login-divider" />

        {/* ── RIGHT CARD ── */}
        <div className="login-card-panel">
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
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? <><span className="btn-spinner" /> Verificando...</> : "Ingresar →"}
            </button>
          </form>

          <div className="login-footer">
            <div className="login-footer-dot" />
            <div className="login-footer-text">Pipsa Montacargas · Zapopán, Jal.</div>
          </div>
        </div>
      </div>
    </>
  );
}