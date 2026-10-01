// ══════════════════════════════════════════════════════════════
//  Halloween.tsx — Decoraciones temporales de Halloween
//  Control Pipsa · Octubre 2026
//
//  Para DESACTIVAR: cambiar HALLOWEEN_ENABLED a false
//  Para ELIMINAR:   borrar este archivo y su import en Dashboard.tsx y Login.tsx
// ══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";

export const HALLOWEEN_ENABLED = true;

// ── SVGs decorativos ────────────────────────────────────────

export function SpiderWeb({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 120"
      style={{ pointerEvents: "none", ...style }}
    >
      {/* Radiales */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={i}
            x1="0" y1="0"
            x2={Math.cos(rad) * 110}
            y2={Math.sin(rad) * 110}
            stroke="rgba(180,140,255,0.18)"
            strokeWidth="0.6"
          />
        );
      })}
      {/* Arcos concéntricos */}
      {[20,42,66,92].map((r, i) => (
        <circle key={i} cx="0" cy="0" r={r} fill="none" stroke="rgba(180,140,255,0.14)" strokeWidth="0.6" />
      ))}
    </svg>
  );
}

export function BatSvg({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 40 24"
      width="28" height="17"
      style={{ pointerEvents: "none", ...style }}
    >
      <path
        d="M20 10c-2-4-7-7-10-6 1.5 1.3 2 2.6 2 3.6-3-1.4-8-1-9.6 1.6 2 .1 3.6.8 4.6 2-2.4.4-4.2 2-5 3.8 2.6-1 5-1 6.6.2C7 17 6.4 19 7 21c1.4-2 3-3.4 5-4 1.6 1.6 2.8 2.4 4 2.4 1.2 0 2.4-.8 4-2.4 2 .6 3.6 2 5 4 .6-2 0-4-1.6-6.4 1.6-1.2 4-1.2 6.6-.2-.8-1.8-2.6-3.4-5-3.8 1-1.2 2.6-1.9 4.6-2-1.6-2.6-6.6-3-9.6-1.6 0-1 .5-2.3 2-3.6-3-1-8 2-10 6z"
        fill="rgba(139,92,246,0.55)"
      />
    </svg>
  );
}

export function MoonSvg({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 32 32"
      width="18" height="18"
      style={{ pointerEvents: "none", ...style }}
    >
      <path
        d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2zm0 26a12 12 0 0 1 0-24 10 10 0 0 0 0 24z"
        fill="rgba(251,191,36,0.5)"
      />
      <path
        d="M16 6a10 10 0 1 0 10 10A10 10 0 0 0 16 6zm4 17.3A8 8 0 0 1 13 8.1a8 8 0 0 0 7 15.2z"
        fill="rgba(251,191,36,0.6)"
      />
    </svg>
  );
}

// ── Fantasma ────────────────────────────────────────────────
export function Ghost() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ x: 0, y: 0 });
  const timerRef              = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!HALLOWEEN_ENABLED || reduceMotion) return;

    function schedule() {
      // aparece cada 45–90s
      const delay = 45000 + Math.random() * 45000;
      timerRef.current = window.setTimeout(() => {
        const x = 60 + Math.random() * 30; // % desde derecha
        const y = 20 + Math.random() * 50;
        setPos({ x, y });
        setVisible(true);
        // desaparece después de 4s
        timerRef.current = window.setTimeout(() => {
          setVisible(false);
          schedule();
        }, 4000);
      }, delay);
    }

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!HALLOWEEN_ENABLED) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        right: `${pos.x}%`,
        top: `${pos.y}%`,
        zIndex: 0,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 1.2s ease",
        transform: visible ? "translateY(0)" : "translateY(20px)",
      }}
    >
      <svg viewBox="0 0 60 80" width="48" height="64" aria-hidden="true" focusable="false">
        {/* cuerpo */}
        <ellipse cx="30" cy="32" rx="22" ry="26" fill="rgba(220,220,255,0.12)" />
        {/* cabeza */}
        <ellipse cx="30" cy="22" rx="18" ry="18" fill="rgba(220,220,255,0.14)" />
        {/* cola ondulada */}
        <path
          d="M8 54 Q14 66 20 58 Q26 50 30 62 Q34 74 40 62 Q46 50 52 58 Q58 66 60 54 L60 80 Q50 72 40 80 Q30 72 20 80 Q10 72 0 80 L0 54 Z"
          fill="rgba(220,220,255,0.10)"
        />
        {/* ojos */}
        <ellipse cx="23" cy="22" rx="3.5" ry="4" fill="rgba(139,92,246,0.4)" />
        <ellipse cx="37" cy="22" rx="3.5" ry="4" fill="rgba(139,92,246,0.4)" />
        {/* brillo */}
        <ellipse cx="30" cy="16" rx="8" ry="4" fill="rgba(255,255,255,0.05)" />
      </svg>
    </div>
  );
}

// ── Murciélagos voladores (dashboard bg) ────────────────────
export function FloatingBats() {
  if (!HALLOWEEN_ENABLED) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "180px",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {[
        { top: "18%", left: "12%",  delay: "0s",    dur: "22s", scale: 0.7 },
        { top: "38%", left: "28%",  delay: "7s",    dur: "28s", scale: 0.9 },
        { top: "10%", left: "62%",  delay: "14s",   dur: "20s", scale: 0.6 },
        { top: "55%", left: "78%",  delay: "3s",    dur: "26s", scale: 1.0 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: b.top,
            left: "-60px",
            animation: `hwBatFly ${b.dur} ${b.delay} ease-in-out infinite`,
            opacity: 0,
            transform: `scale(${b.scale})`,
          }}
        >
          <BatSvg />
        </div>
      ))}
    </div>
  );
}

// ── Niebla (login) ───────────────────────────────────────────
export function FogLayer() {
  if (!HALLOWEEN_ENABLED) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "200px",
        pointerEvents: "none",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        bottom: 0, left: "-50%",
        width: "200%",
        height: "100%",
        background: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(139,92,246,0.12) 0%, transparent 70%)",
        animation: "hwFog 24s ease-in-out infinite alternate",
      }} />
      <div style={{
        position: "absolute",
        bottom: 0, left: "-50%",
        width: "200%",
        height: "70%",
        background: "radial-gradient(ellipse 60% 50% at 40% 100%, rgba(249,115,22,0.07) 0%, transparent 70%)",
        animation: "hwFog2 30s ease-in-out infinite alternate",
      }} />
    </div>
  );
}