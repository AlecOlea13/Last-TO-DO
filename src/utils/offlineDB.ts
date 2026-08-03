// ── IndexedDB para modo offline ──
const DB_NAME    = "pipsa-offline";
const DB_VERSION = 1;

export type AccionOffline = {
  id: string;
  tipo: "iniciar" | "pausar" | "reanudar" | "cerrar";
  servicioId: string;
  payload: any;
  timestamp: number;
};

export type FotoOffline = {
  id: string;
  accionId: string;
  tipo: "hoja" | "equipo" | "refacciones";
  base64: string;
  fileName: string;
};

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("acciones")) {
        const store = db.createObjectStore("acciones", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("fotos")) {
        db.createObjectStore("fotos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("servicios")) {
        db.createObjectStore("servicios", { keyPath: "_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Acciones pendientes ──
export async function guardarAccion(accion: AccionOffline): Promise<void> {
  const db    = await abrirDB();
  const tx    = db.transaction("acciones", "readwrite");
  tx.objectStore("acciones").put(accion);
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function obtenerAcciones(): Promise<AccionOffline[]> {
  const db    = await abrirDB();
  const tx    = db.transaction("acciones", "readonly");
  const store = tx.objectStore("acciones");
  const index = store.index("timestamp");
  return new Promise((res, rej) => {
    const req = index.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

export async function eliminarAccion(id: string): Promise<void> {
  const db = await abrirDB();
  const tx = db.transaction("acciones", "readwrite");
  tx.objectStore("acciones").delete(id);
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

// ── Fotos offline (base64) ──
export async function guardarFotoOffline(foto: FotoOffline): Promise<void> {
  const db = await abrirDB();
  const tx = db.transaction("fotos", "readwrite");
  tx.objectStore("fotos").put(foto);
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function obtenerFotosPorAccion(accionId: string): Promise<FotoOffline[]> {
  const db    = await abrirDB();
  const tx    = db.transaction("fotos", "readonly");
  const store = tx.objectStore("fotos");
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res((req.result as FotoOffline[]).filter(f => f.accionId === accionId));
    req.onerror   = () => rej(req.error);
  });
}

export async function eliminarFotosPorAccion(accionId: string): Promise<void> {
  const db    = await abrirDB();
  const tx    = db.transaction("fotos", "readwrite");
  const store = tx.objectStore("fotos");
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const fotos = (req.result as FotoOffline[]).filter(f => f.accionId === accionId);
      fotos.forEach(f => store.delete(f.id));
      tx.oncomplete = () => res();
    };
    req.onerror = () => rej(req.error);
  });
}

// ── Cache de servicios ──
export async function cachearServicios(servicios: any[]): Promise<void> {
  const db    = await abrirDB();
  const tx    = db.transaction("servicios", "readwrite");
  const store = tx.objectStore("servicios");
  store.clear();
  servicios.forEach(s => store.put(s));
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function obtenerServiciosCache(): Promise<any[]> {
  const db    = await abrirDB();
  const tx    = db.transaction("servicios", "readonly");
  const store = tx.objectStore("servicios");
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ── Helper: File → base64 ──
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}