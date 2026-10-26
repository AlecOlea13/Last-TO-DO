import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type AccionMenu = {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
};

/**
 * Botón "⋯" que despliega un menú de acciones.
 *
 * El menú se dibuja en <body> con position: fixed, así NO lo recorta el
 * overflow de tablas/tarjetas, y se reposiciona solo: se alinea al borde
 * derecho del botón, y si no cabe a la derecha/abajo, se ajusta/voltea.
 */
export default function MenuAcciones({
  acciones,
  titulo = "Más acciones",
  label = "⋯",
}: {
  acciones: AccionMenu[];
  titulo?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState<{ top: number; left: number } | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibles = acciones.filter(a => !a.hidden);

  // Posicionar al abrir (ya con el tamaño real del menú)
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r  = btnRef.current.getBoundingClientRect();
    const mw = menuRef.current.offsetWidth;
    const mh = menuRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M  = 8;

    let left = r.right - mw;                       // alineado al borde derecho del botón
    left = Math.max(M, Math.min(left, vw - mw - M));

    let top = r.bottom + 4;                        // debajo del botón
    if (top + mh > vh - M) top = r.top - mh - 4;   // si no cabe, hacia arriba
    top = Math.max(M, top);

    setPos({ top, left });
  }, [open, visibles.length]);

  // Cerrar: clic afuera, Esc, scroll o resize
  useEffect(() => {
    if (!open) return;
    const cerrar = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true); // captura scroll de cualquier contenedor
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [open]);

  if (visibles.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-secondary btn-sm"
        title={titulo}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setPos(null); setOpen(o => !o); }}
        style={{ fontWeight: 800, letterSpacing: 1, minWidth: 34 }}
      >
        {label}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? "visible" : "hidden", // se mide fuera de vista y luego se muestra
            zIndex: 1000,
            minWidth: 190,
            padding: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {visibles.map((a, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={e => { e.stopPropagation(); setOpen(false); a.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", textAlign: "left",
                padding: "9px 12px", border: "none", borderRadius: 6,
                background: "transparent", cursor: a.disabled ? "not-allowed" : "pointer",
                color: a.danger ? "var(--red)" : "var(--text)",
                opacity: a.disabled ? 0.5 : 1,
                fontSize: "0.85rem", fontFamily: "inherit",
              }}
              onMouseEnter={e => { if (!a.disabled) e.currentTarget.style.background = "var(--surface2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {a.icon && <span style={{ width: 18, textAlign: "center" }}>{a.icon}</span>}
              <span>{a.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}