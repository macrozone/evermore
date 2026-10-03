import type { GeneratedObject } from "./generation";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("evermore-local-objects", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("objects", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local object storage is unavailable."));
  });
}
export async function loadLocalObjects(): Promise<GeneratedObject[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("objects", "readonly");
      const request = transaction.objectStore("objects").getAll();
      request.onsuccess = () => resolve(request.result as GeneratedObject[]);
      request.onerror = () => reject(new Error("Could not read the local object library."));
    });
  } finally { db.close(); }
}
export async function saveLocalObject(object: GeneratedObject): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("objects", "readwrite");
      transaction.objectStore("objects").put(object);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Could not save the object. Browser storage may be full."));
    });
  } finally { db.close(); }
}
