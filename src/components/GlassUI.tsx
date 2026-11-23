/**
 * GlassUI.tsx  →  src/components/GlassUI.tsx
 * Piezas del estilo "cristal": iconos de línea, filtro segmentado con indicador
 * deslizante, pastilla de estatus con menú y menú de acciones (⋯).
 * Los estilos están en src/glass.css.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ── Iconos de línea (estilo Lucide) ──────────────────────────
const PATHS: Record<string, ReactNode> = {
  search:   <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  chart:    <><path d="M3 3v18h18" /><path d="M8 17V9" /><path d="M13 17V5" /><path d="M18 17v-6" /></>,
  plus:     <path d="M12 5v14M5 12h14" />,
  check:    <path d="M20 6 9 17l-5-5" />,
  chevron:  <path d="m6 9 6 6 6-6" />,
  play:     <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  pause:    <><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" /></>,
  eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  printer:  <><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /></>,
  pencil:   <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  clipboard:<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
  pin:      <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  flag:     <><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></>,
  trash:    <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>,
  dots:     <><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></>,
};
const EMOJI_A_ICONO: Record<string, string> = {
  "👁️": "eye", "🖨️": "printer", "✏️": "pencil", "📋": "clipboard", "📍": "pin", "🏁": "flag", "🗑️": "trash",
};

export function Ico({ name, size = 15 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block" }}>
      {PATHS[name]}
    </svg>
  );
}

// ── Menú flotante (portal): no lo recorta ninguna tarjeta ────
function usePop(align: "left" | "right") {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) return;
    const r = btn.current.getBoundingClientRect();
    const mw = menu.current.offsetWidth, mh = menu.current.offsetHeight, M = 8;
    let left = align === "right" ? r.right - mw : r.left;
    left = Math.max(M, Math.min(left, window.innerWidth - mw - M));
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - M) top = Math.max(M, r.top - mh - 6);
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const cerrar = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [open]);

  const toggle = () => { setPos(null); setOpen(o => !o); };
  const close = () => setOpen(false);
  return { open, pos, btn, menu, toggle, close };
}

function Menu({ pop, children }: { pop: ReturnType<typeof usePop>; children: ReactNode }) {
  if (!pop.open) return null;
  return createPortal(
    <div ref={pop.menu} role="menu" className="g-menu"
      style={{ top: pop.pos?.top ?? -9999, left: pop.pos?.left ?? -9999, visibility: pop.pos ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body
  );
}

// ── Menú de acciones (⋯) ─────────────────────────────────────
export type ItemMenu = { label: string; icon: string; onClick: () => void; danger?: boolean; disabled?: boolean };

export function MenuAcciones({ items }: { items: ItemMenu[] }) {
  const pop = usePop("right");
  return (
    <>
      <button ref={pop.btn} type="button" className="g-more" title="Más acciones" aria-haspopup="menu"
        aria-expanded={pop.open} onClick={pop.toggle}>
        <Ico name="dots" size={16} />
      </button>
      <Menu pop={pop}>
        {items.map((it, i) => (
          <button key={i} type="button" role="menuitem" disabled={it.disabled}
            className={`g-menu-item${it.danger ? " danger" : ""}`}
            onClick={() => { pop.close(); it.onClick(); }}>
            {EMOJI_A_ICONO[it.icon] ? <Ico name={EMOJI_A_ICONO[it.icon]} size={16} /> : <span style={{ width: 16, textAlign: "center" }}>{it.icon}</span>}
            <span>{it.label}</span>
          </button>
        ))}
      </Menu>
    </>
  );
}

// ── Pastilla de estatus con menú ─────────────────────────────
export const ESTATUS_SERVICIO: Record<string, { label: string; tone: string }> = {
  abierto:    { label: "Abierto",    tone: "blue"   },
  en_proceso: { label: "En proceso", tone: "amber"  },
  pausado:    { label: "Pausado",    tone: "violet" },
  cerrado:    { label: "Cerrado",    tone: "green"  },
};

export function EstatusPill({ value, onChange, readOnly }: { value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  const pop = usePop("left");
  const cfg = ESTATUS_SERVICIO[value] ?? { label: value, tone: "gray" };
  if (readOnly || !onChange) {
    return <span className={`g-pill g-pill--${cfg.tone} g-pill--static`}><i />{cfg.label}</span>;
  }
  return (
    <>
      <button ref={pop.btn} type="button" className={`g-pill g-pill--${cfg.tone}`} aria-haspopup="menu"
        aria-expanded={pop.open} onClick={pop.toggle}>
        <i />{cfg.label}<span className="g-pill-caret"><Ico name="chevron" size={12} /></span>
      </button>
      <Menu pop={pop}>
        {Object.entries(ESTATUS_SERVICIO).map(([k, v]) => (
          <button key={k} type="button" role="menuitem" className={`g-menu-item${k === value ? " active" : ""}`}
            onClick={() => { pop.close(); if (k !== value) onChange(k); }}>
            <span className={`g-dot g-dot--${v.tone}`} /><span>{v.label}</span>
            {k === value && <span style={{ marginLeft: "auto" }}><Ico name="check" size={14} /></span>}
          </button>
        ))}
      </Menu>
    </>
  );
}

// ── Filtro segmentado con indicador que se desliza ───────────
export function Segmentado({ value, onChange, opciones }: {
  value: string; onChange: (v: string) => void; opciones: { v: string; label: string }[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, opciones.length]);

  return (
    <div ref={wrap} className="g-seg" role="tablist">
      {thumb && <span className="g-seg-thumb" style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }} />}
      {opciones.map(o => (
        <button key={o.v} type="button" role="tab" data-v={o.v} aria-selected={o.v === value}
          className={o.v === value ? "on" : ""} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── Campo de búsqueda con lupa ───────────────────────────────
export function Buscador({ value, onChange, placeholder = "Buscar..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="g-search">
      <Ico name="search" size={15} />
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}