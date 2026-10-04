import type { ChunkRecord } from "./model";
const DATABASE = "evermore-m1-outpaint-v1";
async function database() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(DATABASE, 1); request.onupgradeneeded = () => request.result.createObjectStore("chunks"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function savedChunk(key: string): Promise<ChunkRecord | undefined> {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => { const request = db.transaction("chunks").objectStore("chunks").get(key); request.onsuccess = () => resolve(request.result as ChunkRecord | undefined); request.onerror = () => reject(request.error); });
    }
    finally {
        db.close();
    }
}
export async function storeChunk(key: string, record: ChunkRecord) {
    const db = await database();
    try {
        await new Promise<void>((resolve, reject) => { const transaction = db.transaction("chunks", "readwrite"); transaction.objectStore("chunks").put(record, key); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
    }
    finally {
        db.close();
    }
}
