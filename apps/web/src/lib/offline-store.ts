import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "clinicflow-offline";
const DB_VERSION = 1;
const STORE = "borradores";

export interface BorradorOffline {
  clave: string;
  contenido: string;
  guardadoAt: string;
}

interface OfflineDB extends DBSchema {
  borradores: {
    key: string;
    value: BorradorOffline;
    indexes: { "por-guardado": string };
  };
}

let conexion: Promise<IDBPDatabase<OfflineDB>> | null = null;

function disponible(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBPDatabase<OfflineDB>> {
  if (!conexion) {
    conexion = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "clave" });
        store.createIndex("por-guardado", "guardadoAt");
      },
    });
  }
  return conexion;
}

export async function guardarBorrador(clave: string, contenido: string): Promise<boolean> {
  if (!disponible()) return false;
  try {
    const db = await abrir();
    await db.put(STORE, { clave, contenido, guardadoAt: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}

export async function leerBorrador(clave: string): Promise<BorradorOffline | null> {
  if (!disponible()) return null;
  try {
    const db = await abrir();
    return (await db.get(STORE, clave)) ?? null;
  } catch {
    return null;
  }
}

export async function eliminarBorrador(clave: string): Promise<boolean> {
  if (!disponible()) return false;
  try {
    const db = await abrir();
    await db.delete(STORE, clave);
    return true;
  } catch {
    return false;
  }
}

export async function listarBorradores(): Promise<BorradorOffline[]> {
  if (!disponible()) return [];
  try {
    const db = await abrir();
    return await db.getAllFromIndex(STORE, "por-guardado");
  } catch {
    return [];
  }
}

export async function vaciarBorradores(): Promise<boolean> {
  if (!disponible()) return false;
  try {
    await deleteDB(DB_NAME);
    conexion = null;
    return true;
  } catch {
    return false;
  }
}
