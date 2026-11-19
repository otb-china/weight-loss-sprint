function openRecords() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("weight-loss-sprint", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredRecords() {
  const db = await openRecords();
  try {
    const snapshot = await new Promise<string | undefined>((resolve, reject) => {
      const request = db.transaction("records").objectStore("records").get("snapshot");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return snapshot;
  } finally {
    db.close();
  }
}

export async function writeStoredRecords(data: string, previous: string | undefined) {
  const db = await openRecords();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction("records", "readwrite");
      const store = transaction.objectStore("records");
      const stored = store.get("snapshot");
      let canWrite = false;
      stored.onsuccess = () => {
        canWrite = stored.result === previous;
        if (canWrite) store.put(data, "snapshot");
      };
      transaction.oncomplete = () => resolve(canWrite);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
