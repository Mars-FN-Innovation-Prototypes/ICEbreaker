import { fileId } from "./phase1-domain";

export type LocalFile = {
  id: string;
  name: string;
  type: string;
  data: Blob;
  createdAt: string;
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("icebreaker-local-files", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser document storage is unavailable. Check browser permissions and available space.",
        ),
      );
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const request = operation(tx.objectStore("files"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(
        new Error(
          "Document storage failed. Your browser may be full; export a backup and free space.",
        ),
      );
    };
  });
}
export const allLocalFiles = () =>
  transaction<LocalFile[]>("readonly", (store) => store.getAll());
export const readLocalFile = (ref: string) =>
  transaction<LocalFile | undefined>("readonly", (store) =>
    store.get(fileId(ref)),
  );
export async function storeLocalFile(file: File): Promise<string> {
  if (!file.size || file.size > MAX_FILE_BYTES)
    throw new Error("Choose a non-empty file up to 20 MB.");
  if (!/\.(pdf|docx|xlsx|pptx|png|jpe?g|txt|csv)$/i.test(file.name))
    throw new Error(
      "Use PDF, DOCX, XLSX, PPTX, PNG, JPG, TXT or CSV. Active web content is not accepted.",
    );
  const files = await allLocalFiles();
  if (
    files.reduce((total, item) => total + item.data.size, 0) + file.size >
    MAX_TOTAL_BYTES
  )
    throw new Error(
      "The 150 MB local workspace limit has been reached. Export a backup before removing test files.",
    );
  const id = crypto.randomUUID();
  await transaction("readwrite", (store) =>
    store.add({
      id,
      name: file.name,
      type: file.type,
      data: file,
      createdAt: new Date().toISOString(),
    }),
  );
  return `ice-file:${id}:${encodeURIComponent(file.name)}`;
}
export async function restoreLocalFiles(files: LocalFile[]) {
  const existing = await allLocalFiles();
  const retained = existing.filter(
    (old) => !files.some((f) => f.id === old.id),
  );
  if (
    [...retained, ...files].reduce((sum, f) => sum + f.data.size, 0) >
    MAX_TOTAL_BYTES
  )
    throw new Error(
      "Restoring would exceed the 150 MB local file limit. Existing files have not changed.",
    );
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    // Merge files before restoring metadata. Existing files are never cleared.
    files.forEach((file) => store.put(file));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(
        new Error(
          "Restore failed; existing workspace metadata has not changed.",
        ),
      );
    };
  });
}
