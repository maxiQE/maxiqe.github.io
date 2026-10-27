// The browser's copy of the data folder's text files (IndexedDbBlobStore.cs): one IndexedDB object store, key to text.
const Database = 'simfell';
const Store = 'blobs';
let opened;

function open() {
    opened ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(Database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(Store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return opened;
}

async function request(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(Store, mode);
        const result = action(transaction.objectStore(Store));
        transaction.oncomplete = () => resolve(result.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

export async function read(key) {
    return (await request('readonly', store => store.get(key))) ?? null;
}

export function write(key, text) {
    return request('readwrite', store => store.put(text, key));
}

export function remove(key) {
    return request('readwrite', store => store.delete(key));
}

/** Every key starting with `prefix/`. */
export async function list(prefix) {
    const from = prefix + '/';
    return request('readonly', store => store.getAllKeys(IDBKeyRange.bound(from, from + '￿')));
}
