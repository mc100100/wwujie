
import { CanvasElement, Project, Asset } from '../types';

const DB_NAME = 'GrsaiStudioDB';
const DB_VERSION = 2; // 升级版本
const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'assets';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening database');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 新增资产库仓库
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const store = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

// Project Methods
export const getAllProjects = async (): Promise<Project[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev');
    const projects: Project[] = [];
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        projects.push(cursor.value);
        cursor.continue();
      } else {
        resolve(projects);
      }
    };
    request.onerror = () => reject('Error fetching projects');
  });
};

export const saveProject = async (project: Project): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error saving project');
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error deleting project');
  });
};

export const createNewProjectTemplate = (name: string): Project => {
  const now = Date.now();
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
    name,
    elements: [],
    createdAt: now,
    updatedAt: now
  };
};

// Asset Methods
export const getAllAssets = async (): Promise<Asset[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ASSETS], 'readonly');
    const store = transaction.objectStore(STORE_ASSETS);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');
    const assets: Asset[] = [];
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        assets.push(cursor.value);
        cursor.continue();
      } else {
        resolve(assets);
      }
    };
    request.onerror = () => reject('Error fetching assets');
  });
};

export const saveAsset = async (asset: Asset): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ASSETS], 'readwrite');
    const store = transaction.objectStore(STORE_ASSETS);
    const request = store.put(asset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error saving asset');
  });
};

export const deleteAsset = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ASSETS], 'readwrite');
    const store = transaction.objectStore(STORE_ASSETS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error deleting asset');
  });
};
