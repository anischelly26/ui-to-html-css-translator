import type { Code, Element, ImageInfo, Project, Result } from './types';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const code = (value: unknown): value is Code => record(value)
  && typeof value.html === 'string' && value.html.length <= 150_000
  && typeof value.css === 'string' && value.css.length <= 100_000;
const image = (value: unknown): value is ImageInfo => record(value)
  && integer(value.width, 1, 2400) && integer(value.height, 1, 2400) && color(value.background);

function element(value: unknown, dimensions: ImageInfo): value is Element {
  if (!record(value) || !record(value.bounds)) return false;
  const box = value.bounds;
  return typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,48}$/.test(value.id)
    && ['text', 'heading', 'input', 'button', 'container'].includes(value.kind as string)
    && typeof value.text === 'string' && value.text.length <= 3000
    && color(value.color) && color(value.foreground)
    && (value.confidence === null || (typeof value.confidence === 'number'
      && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100))
    && integer(box.x, 0, dimensions.width - 1) && integer(box.y, 0, dimensions.height - 1)
    && integer(box.width, 1, dimensions.width) && integer(box.height, 1, dimensions.height)
    && box.x + box.width <= dimensions.width && box.y + box.height <= dimensions.height;
}

function result(value: unknown): value is Result {
  if (!record(value) || !image(value.image) || !Array.isArray(value.elements)) return false;
  const dimensions = value.image;
  return code(value.code) && value.elements.length <= 180 && value.elements.every(item => element(item, dimensions))
    && new Set(value.elements.map(item => item.id)).size === value.elements.length
    && Array.isArray(value.warnings) && value.warnings.length <= 100
    && value.warnings.every(note => typeof note === 'string' && note.length <= 3000)
    && Array.isArray(value.palette) && value.palette.length <= 180 && value.palette.every(color)
    && ['local', 'ollama'].includes(value.engine as string) && integer(value.duration_ms, 0, Number.MAX_SAFE_INTEGER);
}

export function isProject(value: unknown): value is Project {
  if (!record(value)) return false;
  return value.version === 1 && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 80
    && typeof value.name === 'string' && value.name.length <= 80 && code(value.code) && code(value.baseline)
    && result(value.result) && typeof value.sample === 'boolean' && integer(value.updated, 0, 8_640_000_000_000_000)
    && (value.source === null || (typeof value.source === 'string' && value.source.length <= 12_000_000
      && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.source)));
}

// Reconstruction history restores the inspector and generated baseline together with the editor.
export type WorkspaceSnapshot = Pick<Project, 'code' | 'baseline' | 'result'>;
export const checkpoint = ({ code, baseline, result }: Project): WorkspaceSnapshot => ({ code, baseline, result });
export const restore = (project: Project, snapshot: WorkspaceSnapshot): Project => ({ ...project, ...snapshot, updated: Date.now() });
export const workspaceName = (name: string) => name.trim() || 'Untitled workspace';
