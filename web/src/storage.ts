import type { Project } from './types';

let connection: Promise<IDBDatabase> | undefined;
function db() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('form-workspaces', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(new Error('Browser storage is unavailable. Export your work to keep it.')); };
  });
  return connection;
}

export function isProject(project: unknown): project is Project {
  if (!project || typeof project !== 'object') return false;
  const p = project as Partial<Project>;
  const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  const code = (value: unknown) => !!value && typeof value === 'object'
    && typeof (value as { html?: unknown }).html === 'string' && typeof (value as { css?: unknown }).css === 'string'
    && ((value as { html: string }).html.length <= 150000) && ((value as { css: string }).css.length <= 100000);
  return p.version === 1 && typeof p.id === 'string' && p.id.length <= 80 && typeof p.name === 'string' && p.name.length <= 80
    && typeof p.code?.html === 'string' && typeof p.code.css === 'string'
    && typeof p.baseline?.html === 'string' && typeof p.baseline.css === 'string'
    && code(p.code) && code(p.baseline) && code(p.result?.code)
    && (p.source === null || (typeof p.source === 'string' && p.source.length <= 12_000_000
      && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.source)))
    && Array.isArray(p.result?.elements) && p.result.elements.length <= 180 && p.result.elements.every(element =>
      !!element && typeof element.id === 'string' && /^[a-zA-Z0-9_-]{1,48}$/.test(element.id)
      && ['text', 'heading', 'input', 'button', 'container'].includes(element.kind)
      && typeof element.text === 'string' && element.text.length <= 3000 && color(element.color) && color(element.foreground)
      && (element.confidence === null || (typeof element.confidence === 'number' && element.confidence >= 0 && element.confidence <= 100))
      && !!element.bounds && ['x', 'y', 'width', 'height'].every(key => Number.isInteger(element.bounds[key as keyof typeof element.bounds]))
      && element.bounds.x >= 0 && element.bounds.y >= 0 && element.bounds.width > 0 && element.bounds.height > 0)
    && Array.isArray(p.result.warnings) && p.result.warnings.every(note => typeof note === 'string')
    && Array.isArray(p.result.palette) && p.result.palette.every(color)
    && ['local', 'ollama'].includes(p.result.engine) && Number.isFinite(p.result.duration_ms)
    && !!p.result.image && typeof p.result.image.width === 'number'
    && p.result.image.width > 0 && p.result.image.width <= 2400 && p.result.image.height > 0 && p.result.image.height <= 2400
    && color(p.result.image.background) && typeof p.updated === 'number' && Number.isFinite(p.updated) && typeof p.sample === 'boolean';
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
  });
}
