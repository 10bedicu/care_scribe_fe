export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("scribe-audio-storage", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("audio-files")) {
        db.createObjectStore("audio-files");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function putAudio(
  db: IDBDatabase,
  key: string,
  value: any,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio-files", "readwrite");
    const store = tx.objectStore("audio-files");

    store.put(value, key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type StoredAudio = {
  identifier: string;
  mimeType: string;
  data: ArrayBuffer;
};

export function getAudioByIdentifier(
  db: IDBDatabase,
  identifier: string,
): Promise<StoredAudio | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio-files", "readonly");
    const store = tx.objectStore("audio-files");

    const request = store.get(identifier);

    request.onsuccess = () => {
      resolve(request.result as StoredAudio | undefined);
    };

    request.onerror = () => reject(request.error);
  });
}
