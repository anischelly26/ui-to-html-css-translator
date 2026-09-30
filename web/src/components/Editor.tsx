import { useEffect, useRef, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import type { Code } from '../types';
import { Tabs } from './Tabs';

export function Editor({ code, onChange, onReset, notify, disabled }: { code: Code; onChange: (code: Code) => void;
  onReset: () => void; notify: (message: string) => void; disabled: boolean }) {
  const [tab, setTab] = useState<keyof Code>('html');
  const [copied, setCopied] = useState(false);
  const gutter = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gutter.current) gutter.current.scrollTop = 0; }, [tab]);
  async function copy() {
    try { await navigator.clipboard.writeText(code[tab]); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { notify('Clipboard access is unavailable. Select the code and copy it manually.'); }
  }
  return <div className="editor">
    <div className="editor-bar"><Tabs value={tab} onChange={setTab} label="Code file" className="editor-tabs" panelId="code-file"
      items={(['html', 'css'] as const).map(file => ({ value: file, name: file === 'html' ? 'index.html' : 'styles.css',
        label: <><span className={`file-dot ${file}`} />{file === 'html' ? 'index.html' : 'styles.css'}</> }))} />
    <div className="editor-actions"><button disabled={disabled} aria-label="Reset code to generated version" title="Reset to generated version" onClick={onReset}><RotateCcw size={15} /></button>
      <button aria-label={`Copy ${tab.toUpperCase()} code`} title="Copy code" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div>
    <div id="code-file" role="tabpanel" aria-label={`${tab.toUpperCase()} file`} className="editor-body"><div ref={gutter} className="line-numbers" aria-hidden="true">{code[tab].split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
      <textarea key={tab} aria-label={`${tab.toUpperCase()} code editor`} maxLength={tab === 'html' ? 150000 : 100000} readOnly={disabled} spellCheck={false} value={code[tab]}
        onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop; }}
        onChange={event => onChange({ ...code, [tab]: event.target.value })} wrap="off" /></div>
    <div className="editor-footer"><span>{code[tab].split('\n').length} lines <span>·</span> UTF-8</span><span>Changes update the preview automatically</span></div>
  </div>;
}
