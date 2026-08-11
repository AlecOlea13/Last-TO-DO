import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

// ── Canvas wireframe + forklift ──
function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let animId   = 0;
    let w = 0, h = 0;

    // ── Grid points ──
    const COLS = 18, ROWS = 12;
    type Point = { x: number; y: number; ox: number; oy: number; vx: number; vy: number };
    let pts: Point[] = [];

    function resize() {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      pts = [];
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const ox = (c / COLS) * w;
          const oy = (r / ROWS) * h;
          pts.push({ x: ox, y: oy, ox, oy, vx: 0, vy: 0 });
        }
      }
    }

    // ── Forklift state ──
    let forkX   = w + 200;
    let forkDir = 1; // 1 = left→right entry from right, -1 = right side
    let forkActive = false;
    let forkTimer  = 0;
    const FORK_INTERVAL = 5000;
    const FORK_SPEED    = 3.5;
    let lastTime = 0;
    let elapsed  = 0;

    function launchForklift() {
      forkDir   = Math.random() > 0.5 ? 1 : -1;
      forkX     = forkDir === 1 ? -320 : w + 320;
      forkActive = true;
    }

    function drawForklift(x: number, dir: number) {
      ctx.save();
      ctx.translate(x, h * 0.72);
      if (dir === -1) ctx.scale(-1, 1);

      const sc = 1.1;
      ctx.scale(sc, sc);

      // shadow
      ctx.beginPath();
      ctx.ellipse(0, 108, 90, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      // wheels
      [[-52, 100], [52, 100]].forEach(([wx, wy]) => {
        ctx.beginPath();
        ctx.arc(wx, wy, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#0c1520";
        ctx.fill();
        ctx.strokeStyle = "#2a3d52";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(wx, wy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#1c2b3a";
        ctx.fill();
      });

      // body
      ctx.beginPath();
      ctx.roundRect(-58, 10, 116, 88, 6);
      ctx.fillStyle = "#0f1820";
      ctx.fill();
      ctx.strokeStyle = "#1e3048";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // cabin
      ctx.beginPath();
      ctx.roundRect(-30, -28, 60, 42, 4);
      ctx.fillStyle = "#131c28";
      ctx.fill();
      ctx.strokeStyle = "#1e3048";
      ctx.lineWidth = 1;
      ctx.stroke();

      // cabin window
      ctx.beginPath();
      ctx.roundRect(-22, -22, 44, 28, 3);
      ctx.fillStyle = "rgba(0,200,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "#1a3a52";
      ctx.lineWidth = 1;
      ctx.stroke();

      // mast
      ctx.fillStyle = "#151f2e";
      ctx.fillRect(52, -120, 7, 220);
      ctx.fillRect(68, -120, 7, 220);

      // forks
      ctx.fillStyle = "#1c2b3a";
      ctx.fillRect(44, -8, 90, 7);
      ctx.fillRect(44, 4,  90, 7);

      // carriage
      ctx.beginPath();
      ctx.roundRect(50, -40, 28, 36, 3);
      ctx.fillStyle = "#131c28";
      ctx.fill();
      ctx.strokeStyle = "#1e3048";
      ctx.lineWidth = 1;
      ctx.stroke();

      // amber beacon
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
      const grad = ctx.createRadialGradient(0, -35, 0, 0, -35, 18);
      grad.addColorStop(0, `rgba(240,184,0,${0.9 * pulse})`);
      grad.addColorStop(1, "rgba(240,184,0,0)");
      ctx.beginPath();
      ctx.arc(0, -35, 18, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -35, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,184,0,${pulse})`;
      ctx.fill();

      // headlight beam
      ctx.save();
      const beamGrad = ctx.createLinearGradient(72, 60, 200, 60);
      beamGrad.addColorStop(0, "rgba(240,230,100,0.25)");
      beamGrad.addColorStop(1, "rgba(240,230,100,0)");
      ctx.beginPath();
      ctx.moveTo(72, 50);
      ctx.lineTo(200, 20);
      ctx.lineTo(200, 100);
      ctx.lineTo(72, 82);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();

      // barcode on mast
      [0,3,5,8,11,14,16].forEach((bx, i) => {
        ctx.fillStyle = `rgba(240,184,0,${0.5 + 0.3 * pulse})`;
        ctx.fillRect(55 + bx, -90, i % 3 === 0 ? 2 : 1, 30);
      });

      // exhaust particles
      if (Math.random() > 0.4) {
        const px = -60 + (Math.random() - 0.5) * 10;
        const py = -10 + (Math.random() - 0.5) * 6;
        ctx.beginPath();
        ctx.arc(px, py, Math.random() * 4 + 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,130,160,${Math.random() * 0.3})`;
        ctx.fill();
      }

      ctx.restore();
    }

    function drawLogo() {
      const cx = w / 2;
      const cy = h / 2;

      // outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, 68, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(240,184,0,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(240,184,0,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // icon background
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,184,0,0.04)";
      ctx.fill();

      // forklift icon simplified
      ctx.save();
      ctx.translate(cx - 14, cy - 18);
      ctx.fillStyle = "rgba(240,184,0,0.5)";
      // mast
      ctx.fillRect(20, 0, 3, 36);
      ctx.fillRect(26, 0, 3, 36);
      // forks
      ctx.fillRect(14, 18, 24, 3);
      ctx.fillRect(14, 23, 24, 3);
      // body
      ctx.beginPath();
      ctx.roundRect(0, 24, 28, 20, 2);
      ctx.fill();
      // wheels
      ctx.beginPath();
      ctx.arc(6,  44, 5, 0, Math.PI * 2);
      ctx.arc(22, 44, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // PIPSA text
      ctx.font = "bold 13px 'Barlow Condensed', sans-serif";
      ctx.fillStyle = "rgba(240,184,0,0.35)";
      ctx.letterSpacing = "0.2em";
      ctx.textAlign = "center";
      ctx.fillText("PIPSA", cx, cy + 68);

      // rotating dashes
      const t = Date.now() / 4000;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 + t;
        const r1 = 74, r2 = i % 4 === 0 ? 82 : 78;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.strokeStyle = `rgba(240,184,0,${i % 4 === 0 ? 0.4 : 0.15})`;
        ctx.lineWidth = i % 4 === 0 ? 1.5 : 1;
        ctx.stroke();
      }
    }

    let scanY = 0;
    const SCAN_SPEED = 0.4;

    function draw(ts: number) {
      const dt = ts - lastTime;
      lastTime = ts;
      elapsed += dt;

      ctx.clearRect(0, 0, w, h);

      // background
      ctx.fillStyle = "#06080c";
      ctx.fillRect(0, 0, w, h);

      // ambient glow bottom-left
      const glow = ctx.createRadialGradient(w * 0.15, h * 0.85, 0, w * 0.15, h * 0.85, w * 0.5);
      glow.addColorStop(0, "rgba(240,184,0,0.045)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // ── grid ──
      const t  = elapsed / 1000;
      const cols1 = COLS + 1;

      // update points with wave
      pts.forEach((p, i) => {
        const col = i % cols1;
        const row = Math.floor(i / cols1);
        const wave = Math.sin(col * 0.4 + t * 0.8) * 6 + Math.cos(row * 0.5 + t * 0.6) * 4;
        p.x = p.ox + Math.sin(row * 0.3 + t * 0.5) * 3;
        p.y = p.oy + wave;
      });

      // draw grid lines
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const i = r * cols1 + c;
          const p = pts[i];

          // horizontal
          if (c < COLS) {
            const p2 = pts[i + 1];
            const dist = Math.hypot(p.x - w/2, p.y - h/2);
            const alpha = Math.max(0, 0.12 - dist / (w * 1.2));
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(30,48,72,${alpha + 0.04})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }

          // vertical
          if (r < ROWS) {
            const p2 = pts[i + cols1];
            const dist = Math.hypot(p.x - w/2, p.y - h/2);
            const alpha = Math.max(0, 0.12 - dist / (w * 1.2));
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(30,48,72,${alpha + 0.04})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }

          // dots at intersections
          const dist = Math.hypot(p.x - w/2, p.y - h/2);
          if (dist < w * 0.45) {
            const a = Math.max(0, 0.35 - dist / (w * 0.5));
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(240,184,0,${a})`;
            ctx.fill();
          }
        }
      }

      // ── scan line ──
      scanY += SCAN_SPEED;
      if (scanY > h + 40) scanY = -40;

      const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      scanGrad.addColorStop(0, "transparent");
      scanGrad.addColorStop(0.5, "rgba(240,184,0,0.07)");
      scanGrad.addColorStop(1, "transparent");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 30, w, 60);

      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.strokeStyle = "rgba(240,184,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── center logo ──
      drawLogo();

      // ── forklift ──
      forkTimer += dt;
      if (!forkActive && forkTimer >= FORK_INTERVAL) {
        forkTimer = 0;
        launchForklift();
      }

      if (forkActive) {
        forkX += forkDir === 1 ? FORK_SPEED * (dt / 16) * 2.5 : -FORK_SPEED * (dt / 16) * 2.5;

        // trail
        ctx.save();
        const trailGrad = ctx.createLinearGradient(
          forkDir === 1 ? forkX - 180 : forkX + 180, 0,
          forkX, 0
        );
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, "rgba(240,184,0,0.04)");
        ctx.fillStyle = trailGrad;
        ctx.fillRect(
          forkDir === 1 ? forkX - 180 : forkX,
          h * 0.55,
          180,
          h * 0.3
        );
        ctx.restore();

        drawForklift(forkX, forkDir);

        const gone = forkDir === 1 ? forkX > w + 320 : forkX < -320;
        if (gone) forkActive = false;
      }

      // floor line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.84);
      ctx.lineTo(w, h * 0.84);
      const floorGrad = ctx.createLinearGradient(0, 0, w, 0);
      floorGrad.addColorStop(0,   "transparent");
      floorGrad.addColorStop(0.2, "rgba(30,48,72,0.4)");
      floorGrad.addColorStop(0.8, "rgba(30,48,72,0.4)");
      floorGrad.addColorStop(1,   "transparent");
      ctx.strokeStyle = floorGrad;
      ctx.lineWidth = 1;
      ctx.stroke();

      // corner brackets
      const br = 24;
      ctx.strokeStyle = "rgba(240,184,0,0.2)";
      ctx.lineWidth = 1.5;
      // top-left
      ctx.beginPath(); ctx.moveTo(20, 20 + br); ctx.lineTo(20, 20); ctx.lineTo(20 + br, 20); ctx.stroke();
      // top-right
      ctx.beginPath(); ctx.moveTo(w - 20 - br, 20); ctx.lineTo(w - 20, 20); ctx.lineTo(w - 20, 20 + br); ctx.stroke();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(20, h - 20 - br); ctx.lineTo(20, h - 20); ctx.lineTo(20 + br, h - 20); ctx.stroke();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(w - 20 - br, h - 20); ctx.lineTo(w - 20, h - 20); ctx.lineTo(w - 20, h - 20 - br); ctx.stroke();

      animId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(canvas);
    resize();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

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

    // scan animation antes de llamar al API
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
          color: #3a4a5c;
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
          color: #3a5a3a;
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
        }

        .login-headline span { color: #f0b800; display: block; }

        .login-sub {
          font-size: 13px;
          color: #4a5568;
          line-height: 1.65;
          max-width: 300px;
        }

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

        .login-card-panel.success-fade {
          opacity: 0;
        }

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

        /* ── SCAN BUTTON ── */
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

        /* scan sweep inside button */
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

        /* success overlay */
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
          border-radius: 0;
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

        /* scan ring */
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
          <SceneCanvas />

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
                {loading ? <><span className="btn-spinner" /> Verificando...</> : scanning ? "Escaneando..." : "Ingresar →"}
              </span>
            </button>
          </form>

          <div className="login-footer">
            <div className="login-footer-dot" />
            <div className="login-footer-text">Pipsa Montacargas · Zapopán, Jal. · {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>
    </>
  );
}