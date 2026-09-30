import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { localDocument } from '../sample';
import type { Code, Engines } from '../types';

export function usePreview(code: Code, engines: Engines | null) {
  const fallback = useMemo(() => localDocument(code), [code]);
  const [preview, setPreview] = useState<{ code: Code; document: string; status: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void api.preview(code, abort.signal).then(result => {
        if (!abort.signal.aborted) setPreview({ code, document: result.document,
          status: result.removed_unsafe ? 'Unsafe content removed' : 'Protected preview' });
      }).catch(() => {
        if (!abort.signal.aborted) setPreview({ code, document: fallback, status: 'Offline preview' });
      });
    }, 350);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [code, engines, fallback]);
  // Never display the previous workspace while a new preview request is pending.
  return preview?.code === code ? preview : { document: fallback, status: 'Local preview' };
}
