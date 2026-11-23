/**
 * GlassUI.tsx  →  src/components/GlassUI.tsx
 * Piezas del estilo "cristal": iconos de línea, filtro segmentado con indicador
 * deslizante, pastilla de estatus con menú y menú de acciones (⋯).
 * Los estilos están en src/glass.css.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  dash:     <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  truck:    <><path d="M2 17V6h11v11" /><path d="M13 9h4l4 4v4h-8" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  wrench:   <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z" />,
  factory:  <><path d="M2 21V9l6 4V9l6 4V5h4v16Z" /><path d="M2 21h20" /></>,
  note:     <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  box:      <><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4" /></>,
  receipt:  <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
  user:     <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users:    <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-4-6.3" /></>,
  coins:    <><circle cx="9" cy="9" r="6" /><path d="M15 9.5a6 6 0 1 1-4.5 8.5" /><path d="M9 6.5v5" /></>,
  folder:   <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  key:      <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3" /></>,
  car:      <><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><circle cx="7.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /><path d="M3 12h18" /></>,
  trend:    <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  moon:     <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />,
  sun:      <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  left:     <path d="m15 18-6-6 6-6" />,
  right:    <path d="m9 18 6-6-6-6" />,
  dots:     <><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></>,
};
const EMOJI_A_ICONO: Record<string, string> = {
  "👁️": "eye", "🖨️": "printer", "✏️": "pencil", "📋": "clipboard", "📍": "pin", "🏁": "flag", "🗑️": "trash",
  "📊": "dash", "🏗️": "truck", "🔧": "wrench", "🏭": "factory", "📝": "note", "📦": "box", "🏢": "building", "📄": "clipboard", "🧾": "receipt", "👤": "user", "👥": "users", "💰": "coins", "📁": "folder", "🔑": "key", "🚗": "car", "📈": "trend",
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

// ── Combobox: escribe para buscar (reemplaza a los <select>) ─
export type Opcion = { value: string; label: string; sub?: string; fijo?: boolean };
const quita = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Combobox({ value, onChange, options, placeholder = "Selecciona...", disabled, clearable, emptyText = "Sin resultados", maxItems = 120 }: {
  value: string; onChange: (v: string) => void; options: Opcion[]; placeholder?: string;
  disabled?: boolean; clearable?: boolean; emptyText?: string; maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const sel = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const palabras = quita(q.trim()).split(/\s+/).filter(Boolean);   // "yale 12" → todas las palabras deben aparecer
    const base = palabras.length
      ? options.filter(o => o.fijo || (() => { const t = quita(o.label + " " + (o.sub ?? "")); return palabras.every(w => t.includes(w)); })())
      : options;
    return base.slice(0, maxItems);
  }, [options, q, maxItems]);

  const place = () => {
    if (!wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const abajo = window.innerHeight - r.bottom - 14, arriba = r.top - 14;
    const subir = abajo < 190 && arriba > abajo;
    setPos({ left: r.left, width: r.width, maxH: Math.max(140, Math.min(300, subir ? arriba : abajo)),
      ...(subir ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
  };

  useLayoutEffect(() => { if (open) place(); }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false); setQ("");
    };
    const onMove = (e: Event) => { if (!menu.current?.contains(e.target as Node)) place(); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const abrir = () => {
    if (disabled) return;
    setQ("");
    setHi(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };
  const elegir = (o?: Opcion) => {
    if (!o) return;
    onChange(o.value); setOpen(false); setQ(""); input.current?.blur();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) abrir(); else setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (open) { e.preventDefault(); elegir(filtered[hi]); } }
    else if (e.key === "Escape") { setOpen(false); setQ(""); input.current?.blur(); }
    else if (e.key === "Tab") { setOpen(false); setQ(""); }
  };

  return (
    <div ref={wrap} className={`g-combo${open ? " open" : ""}${disabled ? " disabled" : ""}`}>
      <input ref={input} className="form-input" disabled={disabled} autoComplete="off" spellCheck={false}
        value={open ? q : (sel?.label ?? "")}
        placeholder={open && sel ? sel.label : placeholder}
        onFocus={abrir} onClick={() => { if (!open) abrir(); }}
        onChange={e => { setQ(e.target.value); setHi(0); if (!open) setOpen(true); }}
        onKeyDown={onKey} />
      {clearable && value && !disabled
        ? <button type="button" className="g-combo-x" title="Quitar" tabIndex={-1}
            onMouseDown={e => e.preventDefault()} onClick={() => { onChange(""); setQ(""); }}>✕</button>
        : <span className="g-combo-caret"><Ico name="chevron" size={15} /></span>}
      {open && createPortal(
        <div ref={menu} role="listbox" className="g-menu g-combo-menu"
          style={{ left: pos?.left ?? -9999, width: pos?.width, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxH,
            visibility: pos ? "visible" : "hidden", transformOrigin: pos?.bottom !== undefined ? "bottom" : "top" }}>
          {filtered.length === 0
            ? <div className="g-combo-empty">{emptyText}</div>
            : filtered.map((o, i) => (
              <button key={o.value + i} type="button" role="option" data-i={i} aria-selected={o.value === value}
                className={`g-menu-item${i === hi ? " hi" : ""}${o.value === value ? " active" : ""}`}
                onMouseEnter={() => setHi(i)} onMouseDown={e => e.preventDefault()} onClick={() => elegir(o)}>
                <span className="g-combo-label">{o.label}</span>
                {o.sub && <span className="g-combo-sub">{o.sub}</span>}
                {o.value === value && <span style={{ marginLeft: "auto", flexShrink: 0 }}><Ico name="check" size={14} /></span>}
              </button>
            ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Icono a partir de un emoji (para el menú lateral) ──
export function IcoEmoji({ emoji, size = 16 }: { emoji: string; size?: number }) {
  return EMOJI_A_ICONO[emoji] ? <Ico name={EMOJI_A_ICONO[emoji]} size={size} /> : <span>{emoji}</span>;
}

// ── Reemplazo rápido de <select>: mismas opciones, diseño cristal y búsqueda ──
// Uso: <Select value={x} onChange={setX} options={[{value:"a",label:"A"}]} placeholder="Todos" />
export function Select({ value, onChange, options, placeholder = "Selecciona...", disabled }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
}) {
  return <Combobox value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} clearable />;
}