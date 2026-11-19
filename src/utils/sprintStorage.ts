import type { DeletedSprintRecord, SprintRecord } from "@/types/tool";
import { createRecordThumbnail, photoDataToBlob } from "./recordPhoto";

type StoredRecord = SprintRecord | DeletedSprintRecord;
type RecordsRead =
  | { revision: undefined; snapshot?: string }
  | { revision: number; records: StoredRecord[] };

const metadataStore = "records";
const recordStore = "recordsById";
const photoStore = "photosById";
const thumbnailStore = "photoThumbnailsById";
const toolId = "weight-loss-sprint";
const revisionKey = `${toolId}:revision`;
const snapshotKey = `${toolId}:snapshot`;
const themeKey = `${toolId}:theme`;

export class RecordsUpgradeBlockedError extends Error {}

export function withoutInlinePhoto<T extends StoredRecord>(item: T): T {
  if (item.photo === undefined) return item;
  const { photo: _photo, ...record } = item;
  return { ...record, photoId: item.id } as T;
}

function openRecords() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(toolId, 4);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new RecordsUpgradeBlockedError("请关闭其他减重冲刺页面，然后刷新重试"));
    };
    request.onupgradeneeded = () => {
      if (blocked) {
        request.transaction?.abort();
        return;
      }
      const db = request.result;
      const upgrade = request.transaction!;
      const metadata = db.objectStoreNames.contains(metadataStore)
        ? upgrade.objectStore(metadataStore)
        : db.createObjectStore(metadataStore);
      const hadRecords = db.objectStoreNames.contains(recordStore);
      const records = hadRecords ? upgrade.objectStore(recordStore) : db.createObjectStore(recordStore, { keyPath: "id" });
      const photos = db.createObjectStore(photoStore);
      db.createObjectStore(thumbnailStore);
      if (hadRecords) {
        const cursor = records.openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          try {
            const item: StoredRecord = entry.value;
            if (item.photo !== undefined) {
              photos.put(photoDataToBlob(item.photo), item.id);
              entry.update(withoutInlinePhoto(item));
            }
            entry.continue();
          } catch {
            upgrade.abort();
          }
        };
      }
      for (const [key, alias] of [
        [revisionKey, "revision"],
        [snapshotKey, "snapshot"],
        [themeKey, "theme"],
      ] as const) {
        const canonical = metadata.get(key);
        canonical.onsuccess = () => {
          if (canonical.result !== undefined) return;
          const legacy = metadata.get(alias);
          legacy.onsuccess = () => {
            if (legacy.result !== undefined) metadata.put(legacy.result, key);
          };
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function storeTheme(theme?: string): Promise<unknown> {
  const db = await openRecords();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(metadataStore, "readwrite");
      const metadata = transaction.objectStore(metadataStore);
      const request = metadata.get(themeKey);
      let value: unknown;
      let failure: unknown;
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(failure ?? transaction.error);
      request.onsuccess = () => {
        try {
          if (theme === undefined && request.result !== undefined) {
            value = request.result;
            return;
          }
          if (theme !== undefined) value = theme;
          else {
            const legacy = localStorage.getItem(themeKey);
            value = legacy === null ? null : JSON.parse(legacy);
          }
          metadata.put(value, themeKey);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function readStoredRecords() {
  const db = await openRecords();
  try {
    return await new Promise<RecordsRead>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, recordStore], "readonly");
      const metadata = transaction.objectStore(metadataStore);
      const version = metadata.get(revisionKey);
      transaction.onabort = () => reject(transaction.error);
      version.onsuccess = () => {
        const revision: number | undefined = version.result;
        if (revision === undefined) {
          const legacy = metadata.get(snapshotKey);
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
  const attachments = new Map<string, { photo: Blob; thumbnail?: Blob }>();
  for (const item of upserts) {
    if (item.photo === undefined) continue;
    const photo = photoDataToBlob(item.photo);
    // A thumbnail can be regenerated later if the browser cannot decode it now.
    const thumbnail = await createRecordThumbnail(photo).catch(() => undefined);
    attachments.set(item.id, { photo, thumbnail });
  }
  const db = await openRecords();
  try {
    return await new Promise<number | undefined>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, recordStore, photoStore, thumbnailStore], "readwrite", { durability: "strict" });
      const metadata = transaction.objectStore(metadataStore);
      const revision = metadata.get(revisionKey);
      let nextRevision: number | undefined;
      transaction.oncomplete = () => resolve(nextRevision);
      transaction.onabort = () => reject(transaction.error);
      revision.onsuccess = () => {
        if (revision.result !== previousRevision) return;

        const records = transaction.objectStore(recordStore);
        const photos = transaction.objectStore(photoStore);
        const thumbnails = transaction.objectStore(thumbnailStore);
        for (const item of upserts) {
          records.put(withoutInlinePhoto(item));
          const attachment = attachments.get(item.id);
          if (attachment) {
            photos.put(attachment.photo, item.id);
            if (attachment.thumbnail) thumbnails.put(attachment.thumbnail, item.id);
            else thumbnails.delete(item.id);
          } else if (!item.photoId) {
            photos.delete(item.id);
            thumbnails.delete(item.id);
          }
        }
        for (const id of removedIds) {
          records.delete(id);
          photos.delete(id);
          thumbnails.delete(id);
        }

        if (previousRevision === undefined) {
          metadata.delete(snapshotKey);
          metadata.delete("snapshot");
        }
        nextRevision = (previousRevision ?? 0) + 1;
        metadata.put(nextRevision, revisionKey);
      };
    });
  } finally {
    db.close();
  }
}

export async function readPhoto(id: string, thumbnail = false) {
  const db = await openRecords();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const store = thumbnail ? thumbnailStore : photoStore;
      const request = db.transaction(store).objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function readThumbnail(id: string, expectedRevision: number) {
  const saved = await readPhoto(id, true);
  if (saved) return saved;
  const photo = await readPhoto(id);
  if (!photo) return undefined;
  const thumbnail = await createRecordThumbnail(photo);
  await cacheThumbnail(id, thumbnail, expectedRevision).catch(() => {});
  return thumbnail;
}

async function cacheThumbnail(id: string, thumbnail: Blob, expectedRevision: number) {
  const db = await openRecords();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, thumbnailStore], "readwrite");
      const revision = transaction.objectStore(metadataStore).get(revisionKey);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      revision.onsuccess = () => {
        if (revision.result === expectedRevision) transaction.objectStore(thumbnailStore).put(thumbnail, id);
      };
    });
  } finally {
    db.close();
  }
}

export async function readBackupPhotos(ids: string[], expectedRevision: number) {
  const db = await openRecords();
  try {
    return await new Promise<Map<string, Blob>>((resolve, reject) => {
      const transaction = db.transaction([metadataStore, photoStore], "readonly");
      const store = transaction.objectStore(photoStore);
      const revision = transaction.objectStore(metadataStore).get(revisionKey);
      const photos = new Map<string, Blob>();
      transaction.onabort = () => reject(transaction.error);
      transaction.oncomplete = () => {
        if (revision.result !== expectedRevision || photos.size !== ids.length) {
          reject(new Error("Incomplete photo backup"));
        } else resolve(photos);
      };
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) photos.set(id, request.result);
        };
      }
    });
  } finally {
    db.close();
  }
}
