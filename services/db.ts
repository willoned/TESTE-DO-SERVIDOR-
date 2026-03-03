// src/services/db.ts

const DB_NAME = 'MasterViewDB';
const STORE_NAME = 'media_store';
const DB_VERSION = 1;

// Inicializa a conexão com o Banco de Dados Local
export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => resolve(request.result);
        
        // Cria a "tabela" caso seja a primeira vez a rodar o software
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

// Guarda um ficheiro (Blob/File) ou Base64 no disco
export const saveMediaToDB = async (id: string, fileData: Blob | string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(fileData, id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Recupera um ficheiro do disco através do seu ID
export const getMediaFromDB = async (id: string): Promise<Blob | string | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Apaga um ficheiro permanentemente para libertar espaço
export const deleteMediaFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};