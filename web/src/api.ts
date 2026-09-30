import type { Code, Element, Engines, Health, ImageInfo, Job, Engine } from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

let accessKey = '';
export function setAccessKey(key: string) { accessKey = key; }

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessKey) headers.set('X-Form-Key', accessKey);
  let response: Response;
  const timeout = AbortSignal.timeout(15000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try { response = await fetch(`/api/${path}`, { ...init, headers, signal }); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('The processing server is unavailable. Your workspace is still here.', 0);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(typeof payload.error === 'string' ? payload.error : `The request failed (${response.status}).`, response.status);
  }
  return response;
}

const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const api = {
  health: async (): Promise<Health> => (await request('health')).json(),
  engines: async (): Promise<Engines> => (await request('engines')).json(),
  submit: async (file: Blob, engine: Engine, signal: AbortSignal): Promise<{ id: string }> =>
    (await request(`jobs?engine=${engine}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type }, signal })).json(),
  job: async (id: string, signal: AbortSignal): Promise<Job> => (await request(`jobs/${encodeURIComponent(id)}`, { signal })).json(),
  cancel: async (id: string) => request(`jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  regenerate: async (elements: Element[], image: ImageInfo): Promise<Code> =>
    (await request('regenerate', json({ elements, image }))).json(),
  preview: async (code: Code, signal: AbortSignal): Promise<{ document: string; removed_unsafe: boolean }> =>
    (await request('preview', { ...json(code), signal })).json(),
  export: async (code: Code, name: string): Promise<Blob> => (await request('export', json({ code, name }))).blob(),
};

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
