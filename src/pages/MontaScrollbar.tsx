import { useEffect, useRef, useState } from "react";

export default function MontaScrollbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement> }) {
  const [progress, setProgress] = useState(0); // 0 a 1
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    function updateProgress() {
      const max = el!.scrollHeight - el!.clientHeight;
      const p = max > 0 ? el!.scrollTop / max : 0;
      setProgress(Math.min(1, Math.max(0, p)));
    }

    updateProgress();
    el.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      el.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
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

  // No mostrar si no hay scroll posible
  const el = targetRef.current;
  const hasScroll = el ? el.scrollHeight > el.clientHeight + 4 : false;
  if (!hasScroll) return null;

  const trackHeight = trackRef.current?.clientHeight ?? window.innerHeight;
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
      <div
        className="monta-scrollbar-handle"
        style={{ top }}
      >
        🏗️
      </div>
    </div>
  );
}