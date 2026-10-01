// ══════════════════════════════════════════════════════════════
//  Halloween.tsx — Decoraciones temporales · Control Pipsa · Oct 2026
//
//  Para DESACTIVAR: HALLOWEEN_ENABLED = false
//  Para ELIMINAR:   borrar este archivo + imports en Dashboard.tsx y Login.tsx
// ══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";

export const HALLOWEEN_ENABLED = true;

// ── SVG: Telaraña ────────────────────────────────────────────
export function SpiderWeb({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 140 140"
      style={{ pointerEvents: "none", ...style }}>
      {/* Radiales */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line key={i} x1="0" y1="0"
            x2={Math.cos(rad) * 135} y2={Math.sin(rad) * 135}
            stroke="rgba(190,150,255,0.32)" strokeWidth="0.7" />
        );
      })}
      {/* Arcos */}
      {[22,46,72,100,130].map((r, i) => (
        <circle key={i} cx="0" cy="0" r={r} fill="none"
          stroke="rgba(190,150,255,0.22)" strokeWidth="0.7" />
      ))}
    </svg>
  );
}

// ── SVG: Araña ───────────────────────────────────────────────
export function Spider({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 28 28" width="18" height="18"
      style={{ pointerEvents: "none", ...style }}>
      {/* hilo */}
      <line x1="14" y1="0" x2="14" y2="7" stroke="rgba(190,150,255,0.35)" strokeWidth="0.8"/>
      {/* cuerpo */}
      <ellipse cx="14" cy="12" rx="4" ry="5"
        fill="rgba(30,20,50,0.85)"
        style={{ filter: "drop-shadow(0 0 3px rgba(139,92,246,0.5))" }} />
      {/* cabeza */}
      <circle cx="14" cy="8" r="2.8"
        fill="rgba(30,20,50,0.85)"
        style={{ filter: "drop-shadow(0 0 2px rgba(139,92,246,0.4))" }} />
      {/* ojos */}
      <circle cx="12.8" cy="7.8" r="0.7" fill="rgba(139,92,246,0.9)" />
      <circle cx="15.2" cy="7.8" r="0.7" fill="rgba(139,92,246,0.9)" />
      {/* patas izquierda */}
      <line x1="10" y1="10" x2="4"  y2="7"  stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
      <line x1="10" y1="12" x2="3"  y2="11" stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
      <line x1="10" y1="14" x2="4"  y2="16" stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
      {/* patas derecha */}
      <line x1="18" y1="10" x2="24" y2="7"  stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
      <line x1="18" y1="12" x2="25" y2="11" stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
      <line x1="18" y1="14" x2="24" y2="16" stroke="rgba(100,80,140,0.7)" strokeWidth="0.9"/>
    </svg>
  );
}

// ── SVG: Murciélago ──────────────────────────────────────────
export function BatSvg({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 24"
      width="32" height="19" style={{ pointerEvents: "none", ...style }}>
      <path
        d="M20 10c-2-4-7-7-10-6 1.5 1.3 2 2.6 2 3.6-3-1.4-8-1-9.6 1.6 2 .1 3.6.8 4.6 2-2.4.4-4.2 2-5 3.8 2.6-1 5-1 6.6.2C7 17 6.4 19 7 21c1.4-2 3-3.4 5-4 1.6 1.6 2.8 2.4 4 2.4 1.2 0 2.4-.8 4-2.4 2 .6 3.6 2 5 4 .6-2 0-4-1.6-6.4 1.6-1.2 4-1.2 6.6-.2-.8-1.8-2.6-3.4-5-3.8 1-1.2 2.6-1.9 4.6-2-1.6-2.6-6.6-3-9.6-1.6 0-1 .5-2.3 2-3.6-3-1-8 2-10 6z"
        fill="rgba(139,92,246,0.6)" />
    </svg>
  );
}

// ── SVG: Luna ────────────────────────────────────────────────
export function MoonSvg({ style }: { style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100"
      style={{ pointerEvents: "none", ...style }}>
      <defs>
        <radialGradient id="moonGrad" cx="40%" cy="40%">
          <stop offset="0%"   stopColor="rgba(251,191,36,0.22)" />
          <stop offset="60%"  stopColor="rgba(245,158,11,0.12)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      {/* halo exterior */}
      <circle cx="50" cy="50" r="48" fill="rgba(245,158,11,0.04)" />
      {/* luna creciente */}
      <circle cx="50" cy="50" r="38" fill="url(#moonGrad)" />
      <circle cx="68" cy="42" r="30" fill="rgba(10,12,16,0.92)" />
      {/* cráteres sutiles */}
      <circle cx="34" cy="44" r="4" fill="rgba(245,158,11,0.06)" />
      <circle cx="28" cy="58" r="2.5" fill="rgba(245,158,11,0.05)" />
      <circle cx="42" cy="62" r="3" fill="rgba(245,158,11,0.04)" />
    </svg>
  );
}

// ── SVG: Fantasma ────────────────────────────────────────────
export function Ghost() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ x: 75, y: 25 });
  const timerRef              = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!HALLOWEEN_ENABLED || reduceMotion) return;
    function schedule() {
      const delay = 50000 + Math.random() * 40000; // 50–90s
      timerRef.current = window.setTimeout(() => {
        setPos({ x: 55 + Math.random() * 30, y: 15 + Math.random() * 45 });
        setVisible(true);
        timerRef.current = window.setTimeout(() => {
          setVisible(false);
          schedule();
        }, 5000);
      }, delay);
    }
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!HALLOWEEN_ENABLED) return null;

  return (
    <div aria-hidden="true" style={{
      position: "fixed",
      right: `${100 - pos.x}%`,
      top: `${pos.y}%`,
      zIndex: 0,
      pointerEvents: "none",
      opacity: visible ? 1 : 0,
      transition: "opacity 2s ease, transform 2s ease",
      transform: visible ? "translateY(0px)" : "translateY(18px)",
    }}>
      <svg viewBox="0 0 56 80" width="52" height="74"
        aria-hidden="true" focusable="false"
        style={{ filter: "blur(0.5px)" }}>
        <defs>
          <radialGradient id="ghostGrad" cx="50%" cy="35%">
            <stop offset="0%"   stopColor="rgba(230,225,255,0.18)" />
            <stop offset="55%"  stopColor="rgba(200,190,255,0.10)" />
            <stop offset="100%" stopColor="rgba(180,160,255,0)" />
          </radialGradient>
        </defs>
        <ellipse cx="28" cy="28" rx="20" ry="24" fill="url(#ghostGrad)" />
        <path d="M8 42 Q11 56 16 50 Q20 44 24 54 Q28 64 32 54 Q36 44 40 50 Q45 56 48 42 L48 70 Q40 64 32 70 Q24 64 16 70 Q9 64 8 70 Z"
          fill="rgba(200,190,255,0.07)" />
        <ellipse cx="22" cy="27" rx="3" ry="3.5" fill="rgba(139,92,246,0.25)" />
        <ellipse cx="34" cy="27" rx="3" ry="3.5" fill="rgba(139,92,246,0.25)" />
        <ellipse cx="28" cy="20" rx="7" ry="3.5" fill="rgba(255,255,255,0.04)" />
      </svg>
    </div>
  );
}

// ── Capa global de ambientación (fondo + luna + murciélagos + niebla) ──
export function HalloweenGlobalLayer() {
  if (!HALLOWEEN_ENABLED) return null;
  return (
    <>
      {/* ── Capa fija de fondo ambiental ── */}
      <div aria-hidden="true" className="hw-global-bg" />

      {/* ── Luna + murciélagos: esquina superior derecha ── */}
      <div aria-hidden="true" className="hw-moon-zone">
        <MoonSvg style={{ width: 110, height: 110, opacity: 0.9 }} />
        {/* murciélagos estáticos cerca de la luna */}
        <BatSvg style={{ position:"absolute", top: 8,  right: 118, opacity: 0.45, transform: "rotate(-12deg) scale(0.8)" }} />
        <BatSvg style={{ position:"absolute", top: 40, right: 130, opacity: 0.30, transform: "rotate(8deg) scale(0.65)" }} />
        <BatSvg style={{ position:"absolute", top: 18, right: 90,  opacity: 0.38, transform: "rotate(-5deg) scale(0.9)", animation: "hwBatFloat 6s ease-in-out infinite" }} />
        <BatSvg style={{ position:"absolute", top: 55, right: 105, opacity: 0.25, transform: "scale(0.55)", animation: "hwBatFloat 8s 2s ease-in-out infinite" }} />
      </div>

      {/* ── Niebla inferior fija ── */}
      <div aria-hidden="true" className="hw-fog-bottom" />
    </>
  );
}

// ── Niebla para Login ────────────────────────────────────────
export function FogLayer() {
  if (!HALLOWEEN_ENABLED) return null;
  return (
    <div aria-hidden="true" style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      height: "200px", pointerEvents: "none", zIndex: 5, overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", bottom: 0, left: "-50%",
        width: "200%", height: "100%",
        background: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(139,92,246,0.14) 0%, transparent 70%)",
        animation: "hwFog 24s ease-in-out infinite alternate",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: "-50%",
        width: "200%", height: "70%",
        background: "radial-gradient(ellipse 60% 50% at 40% 100%, rgba(249,115,22,0.08) 0%, transparent 70%)",
        animation: "hwFog2 30s ease-in-out infinite alternate",
      }} />
    </div>
  );
}