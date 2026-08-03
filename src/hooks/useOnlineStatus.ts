import { useEffect, useState, useCallback } from "react";
import { sincronizarCola, contarPendientes } from "../utils/syncQueue";

export function useOnlineStatus() {
  const [online, setOnline]         = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);

  const actualizarPendientes = useCallback(async () => {
    const n = await contarPendientes();
    setPendientes(n);
  }, []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine || sincronizando) return;
    setSincronizando(true);
    try {
      const { ok, errores } = await sincronizarCola((restantes) => {
        setPendientes(restantes);
      });
      if (ok > 0) {
        setUltimaSync(new Date());
        console.log(`✅ Sincronizados ${ok} acciones offline`);
      }
      if (errores > 0) {
        console.warn(`⚠️ ${errores} acciones fallaron al sincronizar`);
      }
      await actualizarPendientes();
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando, actualizarPendientes]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      // Sincronizar automáticamente al recuperar internet
      sincronizar();
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    // Contar pendientes al montar
    actualizarPendientes();

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sincronizar, actualizarPendientes]);

  return { online, pendientes, sincronizando, ultimaSync, sincronizar, actualizarPendientes };
}