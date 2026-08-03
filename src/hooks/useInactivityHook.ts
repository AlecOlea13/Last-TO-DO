import { useEffect, useRef } from "react";

const INACTIVIDAD_MS = 4 * 60 * 60 * 1000; // 4 horas

const EVENTOS_ACTIVIDAD = [
  "mousedown", "mousemove", "keydown",
  "scroll", "touchstart", "click",
];

export function useInactivityLogout(onLogout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onLogout();
      }, INACTIVIDAD_MS);
    }

    // Iniciar timer al montar
    resetTimer();

    // Resetear en cada evento de actividad
    EVENTOS_ACTIVIDAD.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTOS_ACTIVIDAD.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [onLogout]);
}