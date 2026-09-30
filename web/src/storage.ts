import type { Project } from './types';
import { isProject } from './workspace.ts';
export { isProject } from './workspace.ts';

let connection: Promise<IDBDatabase> | undefined;
function db() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('form-workspaces', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { connection = undefined; reject(new Error('Browser storage is unavailable. Export your work to keep it.')); };
  });
  return connection;
}

export async function projects(): Promise<Project[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction('projects').objectStore('projects').getAll();
    req.onsuccess = () => resolve((req.result as unknown[]).filter(isProject).sort((a, b) => b.updated - a.updated));
    req.onerror = () => reject(new Error('Saved workspaces could not be read.'));
  });
}

export async function saveProject(project: Project) {
  if (!isProject(project)) throw new Error('This workspace contains invalid data and could not be saved.');
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('This workspace could not be saved. Export it to keep your changes.'));
    transaction.onabort = () => reject(new Error('Browser storage is full. Export this workspace to keep it.'));
  });
}

export async function forgetProject(id: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    transaction.objectStore('projects').delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('The workspace could not be removed.'));
    transaction.onabort = () => reject(new Error('The workspace could not be removed.'));
  });
}
