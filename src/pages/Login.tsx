import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import logo from '../assets/logopip.png';

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("rol", data.user.rol);
      localStorage.setItem("nombre", data.user.nombre);
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("permisos", JSON.stringify(data.user.permisos ?? []));
      setAuth(data.token);
      nav("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow: hidden;
          background: #030508;
        }
        .login-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .login-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(180,120,0,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 30%, rgba(30,60,120,0.22) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 50% 90%, rgba(100,50,0,0.12) 0%, transparent 60%);
          animation: bgShift 12s ease-in-out infinite alternate;
        }
        .login-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 50% 40% at 70% 70%, rgba(200,140,0,0.1) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 10% 20%, rgba(20,40,100,0.15) 0%, transparent 55%);
          animation: bgShift2 15s ease-in-out infinite alternate;
        }
        @keyframes bgShift {
          0%   { opacity: 1; transform: scale(1) rotate(0deg); }
          50%  { opacity: 0.8; transform: scale(1.05) rotate(1deg); }
          100% { opacity: 1; transform: scale(1.02) rotate(-1deg); }
        }
        @keyframes bgShift2 {
          0%   { opacity: 0.6; transform: scale(1.02) rotate(0deg); }
          100% { opacity: 1; transform: scale(1) rotate(-2deg); }
        }
        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,180,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,180,0,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
          animation: gridPulse 8s ease-in-out infinite alternate;
        }
        @keyframes gridPulse {
          0%   { opacity: 0.6; }
          100% { opacity: 1; }
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          animation: float linear infinite;
          pointer-events: none;
        }
        @keyframes float {
          0%   { transform: translateY(110vh) translateX(0px) scale(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-10vh) translateX(var(--drift)) scale(1); opacity: 0; }
        }
        .scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,180,0,0.3), transparent);
          animation: scanMove 6s linear infinite;
          pointer-events: none;
          z-index: 1;
        }
        @keyframes scanMove {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 16px;
          background: rgba(10, 12, 20, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,180,0,0.15);
          border-radius: 24px;
          padding: 48px 40px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 32px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(255,140,0,0.06);
          animation: cardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,180,0,0.6), transparent);
          border-radius: 100%;
        }
        .login-card::after {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(255,140,0,0.12) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }
        .login-logo-wrap {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          filter: drop-shadow(0 0 16px rgba(255,180,0,0.4));
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(255,180,0,0.3)); }
          50%       { filter: drop-shadow(0 0 24px rgba(255,180,0,0.6)); }
        }
        .login-brand {
          font-size: 1.5rem;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.02em;
          margin-top: 12px;
          line-height: 1;
        }
        .login-brand span { color: #f0b800; }
        .login-subtitle {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.35);
          margin-top: 6px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 0 0 28px;
        }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .login-field { display: flex; flex-direction: column; gap: 6px; }
        .login-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .login-input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #fff;
          font-size: 0.95rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .login-input::placeholder { color: rgba(255,255,255,0.2); }
        .login-input:focus {
          border-color: rgba(255,180,0,0.5);
          background: rgba(255,180,0,0.04);
          box-shadow: 0 0 0 3px rgba(255,180,0,0.08), 0 0 20px rgba(255,180,0,0.06);
        }
        .login-pass-wrap {
          position: relative;
        }
        .login-pass-wrap .login-input {
          padding-right: 48px;
        }
        .login-show-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          font-size: 1.1rem;
          padding: 4px;
          line-height: 1;
          transition: color 0.2s;
        }
        .login-show-btn:hover { color: rgba(255,180,0,0.7); }
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          font-size: 0.82rem;
          color: #f87171;
          animation: shake 0.4s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .login-btn {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #f0b800 0%, #e08000 100%);
          color: #000;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          letter-spacing: 0.02em;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 20px rgba(240,184,0,0.3);
          margin-top: 4px;
        }
        .login-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.4s;
        }
        .login-btn:hover:not(:disabled)::before { left: 100%; }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(240,184,0,0.4);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-footer {
          text-align: center;
          margin-top: 28px;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.15);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .login-dots { display: inline-flex; gap: 4px; align-items: center; }
        .login-dots span {
          width: 5px; height: 5px;
          background: #000;
          border-radius: 50%;
          animation: dot 1s infinite;
        }
        .login-dots span:nth-child(2) { animation-delay: 0.15s; }
        .login-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="login-root">
        <div className="login-bg" />
        <div className="login-grid" />
        <div className="scan-line" />

        {[...Array(12)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${8 + i * 8}%`,
            width:  i % 3 === 0 ? "3px" : i % 3 === 1 ? "2px" : "1.5px",
            height: i % 3 === 0 ? "3px" : i % 3 === 1 ? "2px" : "1.5px",
            background: i % 4 === 0 ? "rgba(255,180,0,0.7)" : i % 4 === 1 ? "rgba(255,255,255,0.4)" : i % 4 === 2 ? "rgba(255,140,0,0.5)" : "rgba(100,150,255,0.4)",
            animationDuration: `${8 + (i * 1.3) % 7}s`,
            animationDelay: `${(i * 0.7) % 5}s`,
            ["--drift" as any]: `${(i % 2 === 0 ? 1 : -1) * (20 + i * 5)}px`,
          }} />
        ))}

        <div className="login-card">
          <div className="login-logo-wrap">
            <img src={logo} alt="Pipsa" className="login-logo" />
            <div className="login-brand">Control <span>Pipsa</span></div>
            <div className="login-subtitle">Sistema de Gestión de Flota</div>
          </div>

          <div className="login-divider" />

          <form className="login-form" onSubmit={onSubmit}>
            <div className="login-field">
              <label className="login-label">Usuario</label>
              <input
                className="login-input"
                type="text"
                placeholder="tu.usuario"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <div className="login-pass-wrap">
                <input
                  className="login-input"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-show-btn"
                  onClick={() => setShow(s => !s)}
                  aria-label="Mostrar/ocultar contraseña"
                >
                  {show ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="login-dots">
                  <span /><span /><span />
                </span>
              ) : "Iniciar sesión"}
            </button>
          </form>

          <div className="login-footer">
            Equipos Industriales y Montacargas · GDL
          </div>
        </div>
      </div>
    </>
  );
}