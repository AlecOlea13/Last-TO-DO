import {
  obtenerAcciones, eliminarAccion,
  obtenerFotosPorAccion, eliminarFotosPorAccion,
  type AccionOffline,
} from "./offlineDB";
import { api } from "../api";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dijxgoytw/image/upload";
const UPLOAD_PRESET  = "pipsa productos";

async function subirFotoBase64(base64: string, fileName: string): Promise<string> {
  // Convertir base64 a blob
  const arr  = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  const blob = new Blob([u8arr], { type: mime });
  const file = new File([blob], fileName, { type: mime });

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
  const data = await res.json();
  return data.secure_url;
}

async function procesarAccion(accion: AccionOffline): Promise<void> {
  const { tipo, servicioId, payload } = accion;

  if (tipo === "iniciar") {
    await api.post(`/servicios/${servicioId}/iniciar`, payload);
  }

  else if (tipo === "pausar") {
    await api.post(`/servicios/${servicioId}/pausar`, payload);
  }

  else if (tipo === "reanudar") {
    await api.post(`/servicios/${servicioId}/reanudar`, payload);
  }

  else if (tipo === "cerrar") {
    // Subir fotos guardadas offline si existen
    const fotos = await obtenerFotosPorAccion(accion.id);
    const payloadFinal = { ...payload };

    for (const foto of fotos) {
      try {
        const url = await subirFotoBase64(foto.base64, foto.fileName);
        if (foto.tipo === "hoja")        payloadFinal.fotoHojaFirmada  = url;
        if (foto.tipo === "equipo")      payloadFinal.fotoEquipoFinal  = url;
        if (foto.tipo === "refacciones") payloadFinal.fotoRefacciones  = url;
      } catch (err) {
        console.error("Error subiendo foto offline:", err);
      }
    }

    await api.post(`/servicios/${servicioId}/cerrar`, payloadFinal);
    await eliminarFotosPorAccion(accion.id);
  }
}

export async function sincronizarCola(
  onProgreso?: (pendientes: number) => void
): Promise<{ ok: number; errores: number }> {
  const acciones = await obtenerAcciones();
  let ok = 0;
  let errores = 0;

  for (const accion of acciones) {
    try {
      await procesarAccion(accion);
      await eliminarAccion(accion.id);
      ok++;
      onProgreso?.(acciones.length - ok - errores);
    } catch (err) {
      console.error(`Error sincronizando acción ${accion.tipo}:`, err);
      errores++;
    }
  }

  return { ok, errores };
}

export async function contarPendientes(): Promise<number> {
  const acciones = await obtenerAcciones();
  return acciones.length;
}