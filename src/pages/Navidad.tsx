// ══════════════════════════════════════════════════════════════
//  Navidad.tsx — Tema navideño · Control Pipsa · Dic 2026
//
//  Para DESACTIVAR: CHRISTMAS_ENABLED = false
//  Todo es SVG + CSS (sin imágenes). Respeta "reducir movimiento".
//  Halloween.tsx re-exporta esto con los nombres viejos para no tocar Dashboard/Login.
// ══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";

export const CHRISTMAS_ENABLED = true;

const ROJO = "#ef4444", VERDE = "#22c55e", ORO = "#fbbf24", AZUL = "#60a5fa";
const COLORES_LUCES = [ROJO, VERDE, ORO, AZUL];

// Generador pseudoaleatorio determinista (misma nieve en cada render)
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ── Estilos del tema (se inyectan solos: no hay que tocar dashboard.css) ──
export function NavidadStyles() {
  return (
    <style>{`
      @keyframes nvFall { 0% { transform: translate3d(0,-8vh,0); } 100% { transform: translate3d(var(--drift,20px),108vh,0); } }
      @keyframes nvTwinkle { 0% { opacity:.35; filter:brightness(.8); } 100% { opacity:1; filter:brightness(1.35); } }
      @keyframes nvSwing { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      @keyframes nvFly { 0% { transform: translateX(-220px); opacity:0; } 6% { opacity:1; } 94% { opacity:1; } 100% { transform: translateX(calc(100vw + 40px)); opacity:0; } }
      @keyframes nvBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes nvGlowPulse { 0%,100% { opacity:.75; } 50% { opacity:1; } }

      .nv-bg { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden;
        background:
          radial-gradient(ellipse 55% 45% at 96% 4%,  rgba(239,68,68,0.10) 0%, transparent 60%),
          radial-gradient(ellipse 50% 42% at 4% 92%,  rgba(34,197,94,0.09) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 55% 100%, rgba(251,191,36,0.06) 0%, transparent 55%); }
      .nv-snow { position:fixed; inset:0; pointer-events:none; overflow:hidden; }
      .nv-snow-back  { z-index:0; }
      .nv-snow-front { z-index:60; }
      .nv-flake { position:absolute; top:0; border-radius:50%; background:#fff; will-change:transform;
        animation-name:nvFall; animation-timing-function:linear; animation-iteration-count:infinite; }

      .nv-lights { position:fixed; top:0; left:0; right:0; height:40px; z-index:55; pointer-events:none; }
      .nv-lights svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
      .nv-bulb { position:absolute; width:8px; height:12px; margin-left:-4px; border-radius:50% 50% 50% 50% / 35% 35% 65% 65%;
        animation:nvTwinkle 1.7s ease-in-out infinite alternate; }
      .nv-bulb::before { content:""; position:absolute; left:2px; top:-4px; width:4px; height:5px; background:#3b4252; border-radius:1px; }

      .nv-tree-zone { position:fixed; top:34px; right:26px; width:150px; height:170px; z-index:0; pointer-events:none; }
      .nv-ground { position:fixed; bottom:0; left:0; right:0; height:78px; z-index:0; pointer-events:none; }
      .nv-ground svg { width:100%; height:100%; display:block; }

      /* Tarjetas del dashboard: rojo y verde navideños (antes naranja/morado) */
      .dash-root.hw-theme .hw-card-orange { box-shadow:0 0 0 1px rgba(239,68,68,0.28), 0 4px 28px rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.30) !important; }
      .dash-root.hw-theme .hw-card-orange:hover { box-shadow:0 0 0 1px rgba(239,68,68,0.45), 0 8px 36px rgba(239,68,68,0.24); }
      .dash-root.hw-theme .hw-card-purple { box-shadow:0 0 0 1px rgba(34,197,94,0.28), 0 4px 28px rgba(34,197,94,0.15); border-color:rgba(34,197,94,0.30) !important; }
      .dash-root.hw-theme .hw-card-purple:hover { box-shadow:0 0 0 1px rgba(34,197,94,0.45), 0 8px 36px rgba(34,197,94,0.24); }
      .dash-root.hw-theme .sidebar { border-right-color: rgba(34,197,94,0.22); }
      .dash-root.hw-theme .page-title { text-shadow: 0 0 22px rgba(251,191,36,0.18); }

      @media (max-width: 900px) { .nv-tree-zone { width:110px; height:125px; top:60px; right:12px; } }
      @media (max-width: 640px) { .nv-tree-zone { display:none; } .nv-ground { height:48px; } .nv-lights { height:34px; } }
      @media (prefers-reduced-motion: reduce) {
        .nv-snow, .nv-flake, .nv-bulb, .nv-sleigh-fly { animation:none !important; }
        .nv-snow { display:none; }
        .nv-bulb { opacity:.9; }
      }
    `}</style>
  );
}

// ── Nieve ────────────────────────────────────────────────────
function Snow({ count, front }: { count: number; front?: boolean }) {
  const flakes = useMemo(() => {
    const r = rng(front ? 4242 : 1717);
    return Array.from({ length: count }, () => {
      const size = front ? 3 + r() * 4 : 1.5 + r() * 3.2;
      return {
        left: r() * 100, size,
        opacity: front ? 0.35 + r() * 0.3 : 0.25 + r() * 0.55,
        dur: (front ? 11 : 9) + r() * 14, delay: -r() * 24, drift: (r() - 0.4) * 90,
        blur: size > 4 ? 1 : 0,
      };
    });
  }, [count, front]);
  return (
    <div aria-hidden="true" className={`nv-snow ${front ? "nv-snow-front" : "nv-snow-back"}`}>
      {flakes.map((f, i) => (
        <span key={i} className="nv-flake" style={{
          left: `${f.left}%`, width: f.size, height: f.size, opacity: f.opacity,
          animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`,
          filter: f.blur ? "blur(0.8px)" : undefined,
          ["--drift" as any]: `${f.drift}px`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

// ── Guirnalda de luces en todo el borde superior ─────────────
function LightsString() {
  const SEG = 5, N = 30;
  const yAt = (xPct: number) => { const t = ((xPct * SEG) / 100) % 1; return 3 + 17 * 4 * t * (1 - t); };
  const wire = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) { const x = i / 2; pts.push(`${i === 0 ? "M" : "L"}${x},${yAt(x)}`); }
    return pts.join(" ");
  }, []);
  const bulbs = useMemo(() => Array.from({ length: N }, (_, i) => {
    const x = ((i + 0.5) / N) * 100; return { x, y: yAt(x), c: COLORES_LUCES[i % 4], d: (i * 0.37) % 1.7 };
  }), []);
  return (
    <div aria-hidden="true" className="nv-lights">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d={wire} fill="none" stroke="rgba(120,130,150,0.55)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      {bulbs.map((b, i) => (
        <span key={i} className="nv-bulb" style={{
          left: `${b.x}%`, top: b.y + 3, background: b.c,
          boxShadow: `0 0 9px 2px ${b.c}`, animationDelay: `-${b.d}s`,
        }} />
      ))}
    </div>
  );
}

// ── SVG: Rama de pino con luces (esquinas) ───────────────────
export function CornerGarland({ style }: { style?: React.CSSProperties }) {
  const bez = (t: number) => { // curva cuadrática M0,8 Q60,10 120,52
    const x = 2 * (1 - t) * t * 60 + t * t * 120, y = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * 10 + t * t * 52;
    return { x, y };
  };
  const needles = Array.from({ length: 16 }, (_, i) => {
    const t = (i + 1) / 17, p = bez(t), a = Math.atan2(bez(t + 0.02).y - p.y, bez(t + 0.02).x - p.x);
    const L = 14 - t * 4;
    return [a + 0.9, a - 0.9].map(da => ({ x1: p.x, y1: p.y, x2: p.x + Math.cos(da) * L, y2: p.y + Math.sin(da) * L, t }));
  }).flat();
  const luces = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9].map((t, i) => ({ ...bez(t), c: COLORES_LUCES[i % 4], i }));
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 140 140" style={{ pointerEvents: "none", ...style }}>
      <path d="M0,8 Q60,10 120,52" fill="none" stroke="#2b6a45" strokeWidth="3.4" strokeLinecap="round" />
      {needles.map((n, i) => (
        <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={i % 3 === 0 ? "#2f8a55" : "#1f6b43"} strokeWidth="1.8" strokeLinecap="round" />
      ))}
      {luces.map(l => (
        <circle key={l.i} cx={l.x} cy={l.y + 5} r="3.2" fill={l.c}
          style={{ filter: `drop-shadow(0 0 4px ${l.c})`, animation: `nvTwinkle 1.5s ${l.i * 0.28}s ease-in-out infinite alternate` }} />
      ))}
      {/* bayas rojas y moño dorado en la esquina */}
      {[[8, 22], [15, 28], [11, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#dc2626" />)}
      <polygon points="3,4 20,12 3,20" fill="#d4a017" opacity=".9" />
      <polygon points="3,4 -14,12 3,20" fill="#e6b422" opacity=".9" />
    </svg>
  );
}

// ── SVG: Esfera colgante ─────────────────────────────────────
export function HangingOrnament({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 28 36" width="20" height="26"
      style={{ pointerEvents: "none", transformOrigin: "50% 0", ...style }}>
      <line x1="14" y1="0" x2="14" y2="9" stroke="rgba(220,200,140,0.7)" strokeWidth="0.9" />
      <rect x="11" y="8" width="6" height="4" rx="1" fill="#d4a017" />
      <circle cx="14" cy="23" r="10" fill="#dc2626" style={{ filter: "drop-shadow(0 0 5px rgba(239,68,68,0.55))" }} />
      <path d="M5 21 Q14 28 23 21" fill="none" stroke="#fbbf24" strokeWidth="1.6" opacity=".85" />
      <ellipse cx="10.5" cy="18.5" rx="3" ry="2" fill="#fff" opacity=".35" />
    </svg>
  );
}

// ── SVG: Arbolito de Navidad ─────────────────────────────────
export function ChristmasTree({ style }: { style?: React.CSSProperties }) {
  const adornos: [number, number, string][] = [[40, 56, ROJO], [62, 62, ORO], [34, 82, AZUL], [58, 84, ROJO], [72, 90, ORO], [26, 100, ORO], [48, 102, ROJO]];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 124" style={{ pointerEvents: "none", ...style }}>
      <defs>
        <linearGradient id="nvTreeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f9e5f" /><stop offset="100%" stopColor="#14633a" />
        </linearGradient>
      </defs>
      <rect x="44" y="104" width="12" height="14" rx="2" fill="#7a4a24" />
      <polygon points="50,28 78,64 22,64" fill="url(#nvTreeG)" />
      <polygon points="50,46 84,88 16,88" fill="url(#nvTreeG)" />
      <polygon points="50,66 90,110 10,110" fill="url(#nvTreeG)" />
      {/* nieve en las puntas */}
      <path d="M40 38 Q50 34 60 38 L50 28 Z" fill="#fff" opacity=".85" />
      <path d="M30 70 Q50 62 70 70 L50 52 Z" fill="#fff" opacity=".35" />
      {adornos.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="3.6" fill={c}
          style={{ filter: `drop-shadow(0 0 3px ${c})`, animation: `nvTwinkle 1.4s ${i * 0.23}s ease-in-out infinite alternate` }} />
      ))}
      <polygon points="50,6 53,15 62,15 55,21 58,30 50,24 42,30 45,21 38,15 47,15"
        fill="#fbbf24" style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.9))", animation: "nvGlowPulse 2.2s ease-in-out infinite" }} />
    </svg>
  );
}

// ── SVG: Trineo de Santa con reno ────────────────────────────
export function Sleigh({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 150 56" width="96" height="36" style={{ pointerEvents: "none", ...style }}>
      {/* reno */}
      <g fill="#8b5a2b" stroke="#8b5a2b" strokeWidth="2" strokeLinecap="round">
        <ellipse cx="30" cy="30" rx="13" ry="7" stroke="none" />
        <line x1="22" y1="34" x2="17" y2="46" /><line x1="28" y1="36" x2="26" y2="47" />
        <line x1="34" y1="36" x2="40" y2="46" /><line x1="39" y1="33" x2="46" y2="43" />
        <line x1="40" y1="26" x2="48" y2="17" strokeWidth="3" />
        <circle cx="51" cy="14" r="5.2" stroke="none" />
      </g>
      <g stroke="#a67847" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M49 10 L46 2 M46 2 L42 4 M46 2 L47 -1" /><path d="M53 10 L56 3 M56 3 L60 5" />
      </g>
      <circle cx="56" cy="15" r="2.2" fill="#ef4444" style={{ filter: "drop-shadow(0 0 4px #ef4444)" }} />
      {/* riendas */}
      <path d="M44 28 Q70 22 92 30" fill="none" stroke="#d4a017" strokeWidth="1.2" />
      {/* trineo */}
      <path d="M86 24 H128 Q132 24 131 30 Q128 42 112 42 H92 Q86 42 86 34 Z" fill="#dc2626" />
      <path d="M84 46 H120 Q134 46 136 34" fill="none" stroke="#fbbf24" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="94" y1="42" x2="94" y2="46" stroke="#fbbf24" strokeWidth="1.6" /><line x1="116" y1="42" x2="116" y2="46" stroke="#fbbf24" strokeWidth="1.6" />
      {/* Santa */}
      <circle cx="108" cy="18" r="7" fill="#dc2626" />
      <circle cx="108" cy="21" r="4.6" fill="#fde7d0" /><path d="M103.5 22 Q108 30 112.5 22 Q108 26 103.5 22" fill="#fff" />
      <path d="M101 17 Q108 5 116 15 Z" fill="#dc2626" /><circle cx="116" cy="15" r="2.2" fill="#fff" />
      <rect x="100.6" y="15.6" width="14" height="2.6" rx="1.3" fill="#fff" />
      {/* regalos */}
      <rect x="118" y="19" width="9" height="7" fill="#22c55e" /><line x1="122.5" y1="19" x2="122.5" y2="26" stroke="#fbbf24" strokeWidth="1.2" />
    </svg>
  );
}

// ── Santa cruza la pantalla de vez en cuando ─────────────────
export function SantaFlight() {
  const [vuelo, setVuelo] = useState<{ top: number; k: number } | null>(null);
  const timer = useRef<number | null>(null);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!CHRISTMAS_ENABLED || reduce) return;
    let k = 0;
    const programar = (primera: boolean) => {
      const espera = primera ? 7000 : 55000 + Math.random() * 45000;
      timer.current = window.setTimeout(() => {
        setVuelo({ top: 12 + Math.random() * 40, k: ++k });
        timer.current = window.setTimeout(() => { setVuelo(null); programar(false); }, 17000);
      }, espera);
    };
    programar(true);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [reduce]);

  if (!CHRISTMAS_ENABLED || !vuelo) return null;
  return (
    <div key={vuelo.k} aria-hidden="true" className="nv-sleigh-fly" style={{
      position: "fixed", top: `${vuelo.top}%`, left: 0, zIndex: 58, pointerEvents: "none",
      animation: "nvFly 16s linear forwards",
    }}>
      <div style={{ position: "absolute", right: 70, top: 14, width: 170, height: 10, borderRadius: 99,
        background: "linear-gradient(to left, rgba(251,191,36,0.55), rgba(251,191,36,0))", filter: "blur(4px)" }} />
      <div style={{ animation: "nvBob 2.4s ease-in-out infinite", filter: "drop-shadow(0 0 10px rgba(251,191,36,0.35))" }}>
        <Sleigh style={{ width: 120, height: 45 }} />
      </div>
    </div>
  );
}

// ── Capa global (dashboard): fondo + nieve + luces + arbolito + nieve en el piso ──
export function ChristmasGlobalLayer() {
  if (!CHRISTMAS_ENABLED) return null;
  return (
    <>
      <NavidadStyles />
      <div aria-hidden="true" className="nv-bg" />
      <Snow count={46} />
      <Snow count={12} front />
      <LightsString />
      <div aria-hidden="true" className="nv-tree-zone">
        <ChristmasTree style={{ width: 118, height: 142, position: "absolute", right: 0, top: 18, opacity: 0.95 }} />
        <HangingOrnament style={{ position: "absolute", top: 0, right: 124, animation: "nvSwing 4.5s ease-in-out infinite" }} />
        <HangingOrnament style={{ position: "absolute", top: 0, right: 148, width: 14, height: 18, opacity: .85, animation: "nvSwing 5.5s 1s ease-in-out infinite" }} />
      </div>
      <div aria-hidden="true" className="nv-ground">
        <svg viewBox="0 0 1200 78" preserveAspectRatio="none">
          <defs><linearGradient id="nvSnowG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaf2ff" stopOpacity=".92" /><stop offset="100%" stopColor="#b7c8e6" stopOpacity=".55" />
          </linearGradient></defs>
          <path d="M0,50 Q60,22 140,42 T300,40 T470,46 T640,34 T820,44 T1000,36 T1200,48 L1200,78 L0,78 Z" fill="url(#nvSnowG)" />
        </svg>
      </div>
    </>
  );
}

// ── Login: nieve cayendo + piso nevado ───────────────────────
export function SnowGround() {
  if (!CHRISTMAS_ENABLED) return null;
  return (
    <>
      <NavidadStyles />
      <Snow count={55} front />
      <div aria-hidden="true" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, pointerEvents: "none", zIndex: 5 }}>
        <svg viewBox="0 0 1200 90" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs><linearGradient id="nvSnowL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2f7ff" stopOpacity=".95" /><stop offset="100%" stopColor="#b7c8e6" stopOpacity=".6" />
          </linearGradient></defs>
          <path d="M0,58 Q80,24 170,46 T360,44 T560,52 T760,36 T980,48 T1200,40 L1200,90 L0,90 Z" fill="url(#nvSnowL)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 100% at 50% 100%, rgba(239,68,68,0.10) 0%, transparent 70%)" }} />
      </div>
    </>
  );
}