import { useEffect, useRef, useState } from "react";

// ── Rango de fechas centralizado: fácil de mover/quitar el próximo año ──
const TEASER_START = new Date(2026, 8, 22, 0, 0, 0); // 22 sep 2026 00:00 (meses en JS son 0-indexados: 8 = septiembre)
const TEASER_END   = new Date(2026, 9, 1, 0, 0, 0);  // 1 oct 2026 00:00 (exclusivo)

const SESSION_KEY = "pipsaHalloweenTeaserSeen2026";

function isWithinTeaserWindow(): boolean {
  const now = new Date();
  return now >= TEASER_START && now < TEASER_END;
}

// ── Íconos SVG inline, decorativos (aria-hidden en su uso) ──

function PumpkinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.2c-.3-.6-1-1.1-1.7-1.2" stroke="#84CC16" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="12" cy="14" rx="8" ry="7" fill="#FF7A00" />
      <path d="M4.3 14c0-3.6 1.6-6.2 3.6-7.2M19.7 14c0-3.6-1.6-6.2-3.6-7.2M9 6.6c.8-.9 2-1.4 3-1.4s2.2.5 3 1.4"
        stroke="#c95f00" strokeWidth="0.9" fill="none" opacity="0.55" />
      <path d="M8.6 12.5l1.8 2.2-1.8 2.2M15.4 12.5l-1.8 2.2 1.8 2.2"
        stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9.3 18.4c1 .6 4.4.6 5.4 0" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function BatIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 24" width="28" height="17" style={style} aria-hidden="true">
      <path
        d="M20 10c-2-4-7-7-10-6 1.5 1.3 2 2.6 2 3.6-3-1.4-8-1-9.6 1.6 2 .1 3.6.8 4.6 2-2.4.4-4.2 2-5 3.8 2.6-1 5-1 6.6.2C7 17 6.4 19 7 21c1.4-2 3-3.4 5-4 1.6 1.6 2.8 2.4 4 2.4 1.2 0 2.4-.8 4-2.4 2 .6 3.6 2 5 4 .6-2 0-4-1.6-6.4 1.6-1.2 4-1.2 6.6-.2-.8-1.8-2.6-3.4-5-3.8 1-1.2 2.6-1.9 4.6-2-1.6-2.6-6.6-3-9.6-1.6 0-1 .5-2.3 2-3.6-3-1-8 2-10 6z"
        fill="#8B5CF6"
      />
    </svg>
  );
}

function ForkliftIcon() {
  return (
    <svg viewBox="0 0 140 70" width="100%" height="100%" aria-hidden="true">
      {/* mástil */}
      <rect x="52" y="8" width="4" height="46" fill="#2a2a2a" />
      <rect x="60" y="8" width="4" height="46" fill="#2a2a2a" />
      {/* calabaza sobre las horquillas */}
      <ellipse cx="30" cy="34" rx="9" ry="7.5" fill="#FF7A00" />
      <path d="M23 34l3.5 3.5-3.5 3.5M37 34l-3.5 3.5 3.5 3.5" stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M27 40c1 .6 5 .6 6 0" stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* horquillas */}
      <rect x="16" y="46" width="42" height="3" fill="#3a3a3a" />
      <rect x="16" y="52" width="42" height="3" fill="#3a3a3a" />
      {/* cuerpo del montacargas */}
      <rect x="58" y="26" width="46" height="28" rx="4" fill="#F2BE00" />
      <rect x="66" y="14" width="30" height="4" fill="#2a2a2a" />
      <circle cx="72" cy="58" r="8" fill="#1a1a1a" />
      <circle cx="72" cy="58" r="3" fill="#555" />
      <circle cx="98" cy="58" r="8" fill="#1a1a1a" />
      <circle cx="98" cy="58" r="3" fill="#555" />
      <rect x="90" y="30" width="10" height="10" rx="1.5" fill="#1a1a1a" opacity="0.75" />
    </svg>
  );
}

export default function HalloweenTeaser() {
  // Se decide una sola vez al montar: si estamos fuera del rango, el
  // componente no renderiza nada y no registra listeners ni animaciones.
  const [active] = useState(isWithinTeaserWindow);

  const [showIntro, setShowIntro] = useState(false);
  const [playFull, setPlayFull]   = useState(false);   // animación completa (montacargas + murciélagos)
  const [toastOn, setToastOn]     = useState(false);
  const [fullSeen, setFullSeen]   = useState(false);

  const reduceMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;
    setFullSeen(sessionStorage.getItem(SESSION_KEY) === "1");
    // pequeño resplandor inicial, una sola vez, luego queda quieta
    const t = window.setTimeout(() => setShowIntro(true), 500);
    timersRef.current.push(t);
    return () => timersRef.current.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function closeAll() {
    clearTimers();
    setPlayFull(false);
    setToastOn(false);
  }

  function handleClick() {
    if (fullSeen || reduceMotion) {
      // Ya se vio la animación completa esta sesión (o el usuario prefiere
      // movimiento reducido): solo mensaje breve, sin recorrido.
      clearTimers();
      setToastOn(true);
      const t = window.setTimeout(() => setToastOn(false), 2600);
      timersRef.current.push(t);
      return;
    }

    clearTimers();
    setPlayFull(true);
    // el toast aparece un poco después de que arranca el montacargas
    const t1 = window.setTimeout(() => setToastOn(true), 900);
    // toda la secuencia dura ~5s y se limpia sola
    const t2 = window.setTimeout(() => {
      setPlayFull(false);
      setToastOn(false);
      sessionStorage.setItem(SESSION_KEY, "1");
      setFullSeen(true);
    }, 5200);
    timersRef.current.push(t1, t2);
  }

  useEffect(() => {
    if (!playFull && !toastOn) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [playFull, toastOn]);

  const batPositions = [
    { top: "58%", left: "28%", delay: "0.2s" },
    { top: "42%", left: "52%", delay: "0.6s" },
    { top: "64%", left: "70%", delay: "0.35s" },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Descubrir adelanto de Halloween"
        className={`hween-btn${showIntro ? " intro" : ""}`}
        onClick={handleClick}
      >
        <PumpkinIcon />
        <span className="hween-tooltip" role="tooltip">Carga especial en camino…</span>
      </button>

      {(playFull || toastOn) && (
        <div className="hween-overlay" aria-hidden="true">
          {playFull && !reduceMotion && (
            <>
              <div className="hween-forklift-wrap">
                <ForkliftIcon />
              </div>
              {batPositions.map((b, i) => (
                <BatIcon key={i} style={{ top: b.top, left: b.left, position: "absolute", animationDelay: b.delay }} />
              ))}
            </>
          )}
        </div>
      )}

      {toastOn && (
        <div className={`hween-toast${toastOn ? " show" : ""}`} role="status">
          <button
            type="button"
            className="hween-toast-close"
            aria-label="Cerrar aviso"
            style={{ pointerEvents: "auto" }}
            onClick={closeAll}
          >
            ✕
          </button>
          <p className="hween-toast-title">Algo extraño está llegando a Control PIPSA…</p>
          <p className="hween-toast-sub">Próximamente: edición Halloween.</p>
        </div>
      )}
    </>
  );
}
