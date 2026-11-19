import type { DeletedSprintRecord, SprintRecord } from "@/types/tool";

type StoredRecord = SprintRecord | DeletedSprintRecord;
type RecordsRead =
  | { revision: undefined; snapshot?: string }
  | { revision: number; records: StoredRecord[] };

const metadataStore = "records";
const recordStore = "recordsById";

function openRecords() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("weight-loss-sprint", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(metadataStore)) db.createObjectStore(metadataStore);
      db.createObjectStore(recordStore, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredRecords() {
  const db = await openRecords();
  try {
    return await new Promise<RecordsRead>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, recordStore], "readonly");
      const metadata = transaction.objectStore(metadataStore);
      const version = metadata.get("revision");
      transaction.onabort = () => reject(transaction.error);
      version.onsuccess = () => {
        const revision: number | undefined = version.result;
        if (revision === undefined) {
          const legacy = metadata.get("snapshot");
          legacy.onsuccess = () => resolve({ revision, snapshot: legacy.result });
        } else {
          const records = transaction.objectStore(recordStore).getAll();
          records.onsuccess = () => resolve({ revision, records: records.result });
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function writeStoredRecords(
  previousRevision: number | undefined,
  upserts: StoredRecord[],
  removedIds: string[] = [],
) {
  const db = await openRecords();
  try {
    return await new Promise<number | undefined>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, recordStore], "readwrite");
      const metadata = transaction.objectStore(metadataStore);
      const revision = metadata.get("revision");
      let nextRevision: number | undefined;
      transaction.oncomplete = () => resolve(nextRevision);
      transaction.onabort = () => reject(transaction.error);
      revision.onsuccess = () => {
        if (revision.result !== previousRevision) return;

        const records = transaction.objectStore(recordStore);
        for (const item of upserts) records.put(item);
        for (const id of removedIds) records.delete(id);

        if (previousRevision === undefined) metadata.delete("snapshot");
        nextRevision = (previousRevision ?? 0) + 1;
        metadata.put(nextRevision, "revision");
      };
    });
  } finally {
    db.close();
  }
}
