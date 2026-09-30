import { useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import type { Code } from '../types';

export function Editor({ code, onChange, onReset, notify, disabled }: { code: Code; onChange: (code: Code) => void;
  onReset: () => void; notify: (message: string) => void; disabled: boolean }) {
  const [tab, setTab] = useState<keyof Code>('html');
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code[tab]); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { notify('Clipboard access is unavailable. Select the code and copy it manually.'); }
  }
  return <div className="editor">
    <div className="editor-bar"><div className="editor-tabs" role="tablist" aria-label="Code file">
      {(['html', 'css'] as const).map(file => <button key={file} role="tab" aria-selected={tab === file}
        className={tab === file ? 'active' : ''} onClick={() => setTab(file)}><span className={`file-dot ${file}`} />{file === 'html' ? 'index.html' : 'styles.css'}</button>)}
    </div><div className="editor-actions"><button disabled={disabled} aria-label="Reset code to generated version" title="Reset to generated version" onClick={onReset}><RotateCcw size={15} /></button>
      <button aria-label={`Copy ${tab.toUpperCase()} code`} title="Copy code" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div>
    <div className="editor-body"><div className="line-numbers" aria-hidden="true">{code[tab].split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
      <textarea aria-label={`${tab.toUpperCase()} code editor`} maxLength={tab === 'html' ? 150000 : 100000} readOnly={disabled} spellCheck={false} value={code[tab]}
        onChange={event => onChange({ ...code, [tab]: event.target.value })} wrap="off" /></div>
    <div className="editor-footer"><span>{code[tab].split('\n').length} lines <span>·</span> UTF-8</span><span>Changes update the preview automatically</span></div>
  </div>;
}
