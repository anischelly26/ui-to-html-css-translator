export type Kind = 'text' | 'heading' | 'button' | 'input' | 'container';
export type Engine = 'local' | 'ollama';
export interface Element {
  id: string; kind: Kind; text: string; confidence: number | null;
  bounds: { x: number; y: number; width: number; height: number };
  color: string; foreground: string;
}
export interface Code { html: string; css: string }
export interface ImageInfo { width: number; height: number; background: string }
export interface Result {
  code: Code; elements: Element[]; image: ImageInfo; engine: Engine;
  duration_ms: number; warnings: string[]; palette: string[];
}
export interface Project {
  version: 1; id: string; name: string; updated: number; source: string | null;
  result: Result; code: Code; baseline: Code; sample: boolean;
}
export interface Health { status: string; version: string; ocr_available: boolean; access_key_required: boolean }
export interface Engines { local: boolean; ollama: boolean; model: string }
export interface Job { id: string; status: string; progress: number; result: Result | null; error: string | null }
