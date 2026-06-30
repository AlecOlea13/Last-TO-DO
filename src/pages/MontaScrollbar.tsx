import { useEffect, useRef, useState } from "react";

const MONTA_ICON_URL = "https://res.cloudinary.com/dijxgoytw/image/upload/v1782746689/montacargas_jma8wd.png";

export default function MontaScrollbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [progress, setProgress] = useState(0);
  const [hasScroll, setHasScroll] = useState(false);
  const [trackHeight, setTrackHeight] = useState(window.innerHeight);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    function update() {
      const max = el!.scrollHeight - el!.clientHeight;
      setHasScroll(max > 4);
      const p = max > 0 ? el!.scrollTop / max : 0;
      setProgress(Math.min(1, Math.max(0, p)));
      setTrackHeight(window.innerHeight);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const t1 = setTimeout(update, 300);
    const t2 = setTimeout(update, 1000);

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [targetRef]);

  function scrollToY(clientY: number) {
    const track = trackRef.current;
    const el = targetRef.current;
    if (!track || !el) return;
    const rect = track.getBoundingClientRect();
    const handleHalf = 14;
    const usable = rect.height - handleHalf * 2;
    const rel = Math.min(1, Math.max(0, (clientY - rect.top - handleHalf) / usable));
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = rel * max;
  }

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    scrollToY(e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    scrollToY(e.clientY);
  }
  function onPointerUp() {
    draggingRef.current = false;
  }

  if (!hasScroll) return null;

  const handleHalf = 14;
  const usable = trackHeight - handleHalf * 2;
  const top = handleHalf + progress * usable;

  return (
    <div
      ref={trackRef}
      className="monta-scrollbar-track"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="monta-scrollbar-handle" style={{ top }}>
        <img src={MONTA_ICON_URL} alt="" draggable={false} />
      </div>
    </div>
  );
}